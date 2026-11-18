import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,type Harness} from './slice1-db';
import {pm,sameBuProject,seedSlice1} from './slice1-fixtures';
import {aiPrincipal,mapDomain,seedMembers} from './slice3-fixtures';
import {rolledBack} from './slice2-fixtures';
import {scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// Migration 022: a BEFORE INSERT guard on intelligence.ai_drafts refuses a draft of a project whose latest domain mapping is IBS_HI (OQ-45 point 3 (b)).
const F='022_ai_drafts_pointer_only_guard.sql';
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
type Refusal={code?:string;message:string}|null;
const AI=aiPrincipal.id;
const HASH='a'.repeat(64);
const S=[ids.sales];
const LTZ='LTZ01';
const MESSAGE='An AI draft is not stored for a pointer-only project';
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const count=async()=>(await rows<{n:number}>('SELECT count(*)::int n FROM intelligence.ai_drafts'))[0].n;
const P=(id:string,projects:string[]):Principal=>({id,tenantId:ids.tenant,projectIds:projects,name:'Người mẫu',role:'manager'});
const asRuntime=<T>(person:string|null,projects:string[],fn:(tx:Queryable)=>Promise<T>)=>scoped(h.db,P(person??pm.id,projects),async tx=>{
  if(person) await tx.query("SELECT set_config('app.person_id',$1,true)",[person]);
  return fn(tx);
});
const asAi=<T>(fn:(tx:Queryable)=>Promise<T>,o:{tenant?:string;projects?:string[];principal?:string|null}={})=>h.operator.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE libetech_ai');
  await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[o.tenant??ids.tenant,(o.projects??S).join(',')]);
  if(o.principal!==null) await tx.query("SELECT set_config('app.ai_principal_id',$1,true)",[o.principal??AI]);
  return fn(tx);
});
const JSONB_COLUMNS=new Set(['value','sources','questions']);
const draftVals=(over:R={}):R=>({tenant_id:ids.tenant,project_id:ids.sales,entity_type:'intake_candidate',entity_id:randomUUID(),signal_type:'intake_analyst',
  skill_version:'1.0.0',manifest_hash:HASH,model_version:'synthetic-model',value:'{"summary":"mẫu"}',value_hash:HASH,sources:'[{"ref":"synthetic-source"}]',
  questions:'[]',confidence:50,input_hash:HASH,ai_principal_id:AI,trace_id:randomUUID(),dedupe_key:'draft-'+randomUUID(),...over});
const insertDraft=(tx:Queryable,over:R={})=>{
  const v=draftVals(over),keys=Object.keys(v);
  return tx.query<{id:string}>(`INSERT INTO intelligence.ai_drafts(${keys.join(',')}) VALUES(${keys.map((k,i)=>`$${i+1}${JSONB_COLUMNS.has(k)?'::jsonb':''}`).join(',')}) RETURNING id`,keys.map(k=>v[k]));
};
const CAST:Record<string,string>={tenant_id:'uuid',ai_principal_id:'uuid',trace_id:'uuid',value:'jsonb',sources:'jsonb',questions:'jsonb',confidence:'int'};
const refusal=(p:Promise<unknown>):Promise<Refusal>=>p.then(()=>null,e=>e as Refusal);
const aiInsert=(over:R={},o:{projects?:string[]}={})=>refusal(asAi(tx=>insertDraft(tx,over),o));

describe('migration 022: the pointer-only guard',()=>{
  test('G1 the guard refuses a draft for a project whose latest mapping row is IBS_HI: SQLSTATE LTZ01, a message without ids, nothing stored',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const before=await count();
    const e=await aiInsert({project_id:ids.transport},{projects:[ids.transport]});
    expect(e).not.toBeNull();
    expect(e!.code).toBe(LTZ);
    expect(e!.message).toBe(MESSAGE);
    expect(e!.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(await count()).toBe(before);
  });

  test('G2 an unmapped project, a project under another label and a project whose latest row left IBS_HI still store',async()=>{
    expect(await aiInsert()).toBeNull();
    await mapDomain(h,ids.sales,'XECA',1);
    expect(await aiInsert()).toBeNull();
    await mapDomain(h,ids.transport,'IBS_HI',1);
    await mapDomain(h,ids.transport,'LIBERICO_BU',2);
    expect(await aiInsert({project_id:ids.transport},{projects:[ids.transport]})).toBeNull();
    expect(await count()).toBe(3);
  });

  test('G3 the highest mapping_version decides, whatever the order the rows were written in',async()=>{
    await mapDomain(h,ids.sales,'IBS_HI',5);
    await mapDomain(h,ids.sales,'XECA',4);
    const e=await aiInsert();
    expect(e?.code).toBe(LTZ);
    expect(await count()).toBe(0);
  });

  test('G4 the guard reads the mapping of the row\'s own tenant: a row that names another tenant is answered by row-level security and is not stored',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const e=await aiInsert({project_id:ids.transport,tenant_id:ids.otherTenant},{projects:[ids.transport]});
    expect(e?.message).toMatch(/row-level security/);
    expect(e?.code).not.toBe(LTZ);
    expect(await count()).toBe(0);
  });

  test('G5 the guard answers before the conflict check: the dedupe key of a draft stored before the mapping is refused on replay, and one row stays',async()=>{
    const K='draft-replay-'+randomUUID();
    expect(await aiInsert({project_id:ids.transport,dedupe_key:K},{projects:[ids.transport]})).toBeNull();
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const v=draftVals({project_id:ids.transport,dedupe_key:K}),keys=Object.keys(v);
    const e=await refusal(asAi(tx=>tx.query(`INSERT INTO intelligence.ai_drafts(${keys.join(',')}) VALUES(${keys.map((k,i)=>`$${i+1}${JSONB_COLUMNS.has(k)?'::jsonb':''}`).join(',')})
      ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`,keys.map(k=>v[k])),{projects:[ids.transport]}));
    expect(e).not.toBeNull();
    expect(e!.code).toBe(LTZ);
    expect((await rows<{n:number}>('SELECT count(*)::int n FROM intelligence.ai_drafts WHERE dedupe_key=$1',[K]))[0].n).toBe(1);
  });

  test('G6 the pointer-only guard also stops the operational login',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const e=await refusal(insertDraft(h.operator,{project_id:ids.transport}));
    expect(e?.code).toBe(LTZ);
    expect(await count()).toBe(0);
  });

  test('G7 34d without a transaction context nothing is stored: an IBS_HI project is answered by the guard, any other project by row-level security',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const bare=(over:R)=>refusal(h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_ai');return insertDraft(tx,over);}));
    expect((await bare({project_id:ids.transport}))?.code).toBe(LTZ);
    const other=await bare({project_id:ids.sales});
    expect(other?.message).toMatch(/row-level security/);
    expect(other?.code).not.toBe(LTZ);
    expect(await count()).toBe(0);
  });

  test('G8 34a 34e the AI role gains nothing to read or call',async()=>{
    expect((await refusal(asAi(tx=>tx.query('SELECT 1 FROM public.project_domain_mappings'))))?.message).toMatch(/permission denied/);
    expect((await refusal(asAi(tx=>tx.query('SELECT intelligence.ai_drafts_pointer_only_guard()'))))?.message).toMatch(/permission denied/);
    expect(await rows<{is_owner:boolean}>(`SELECT a.grantee = p.proowner AS is_owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace, aclexplode(p.proacl) a
      WHERE n.nspname='intelligence' AND p.proname='ai_drafts_pointer_only_guard'`)).toEqual([{is_owner:true}]);
    expect(await rows(`SELECT n.nspname||'.'||p.proname f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE p.prosecdef AND has_function_privilege('libetech_ai',p.oid,'EXECUTE')`)).toEqual([]);
    expect((await rows(`SELECT rolsuper,rolbypassrls,rolcanlogin,
      EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.roleid=r.oid) has_member,EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) is_member
      FROM pg_roles r WHERE rolname='libetech_ai'`))[0]).toEqual({rolsuper:false,rolbypassrls:false,rolcanlogin:false,has_member:false,is_member:false});
    expect((await rows<{ok:boolean}>("SELECT has_table_privilege('libetech_ai','public.project_domain_mappings','SELECT') ok"))[0].ok).toBe(false);
  });

  test('G9 what the AI role can tell apart is one bit, and this test says so: an IBS_HI project outside the declared scope is answered LTZ01, any other project outside it by row-level security',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    expect((await aiInsert({project_id:ids.transport},{projects:[ids.sales]}))?.code).toBe(LTZ);
    const other=await aiInsert({project_id:sameBuProject},{projects:[ids.sales]});
    expect(other?.message).toMatch(/row-level security/);
    expect(other?.code).not.toBe(LTZ);
    expect(await count()).toBe(0);
  });

  test('G10 34c update and delete of a draft stay refused',async()=>{
    const id=(await insertDraft(h.operator)).rows[0].id;
    expect((await refusal(asAi(tx=>tx.query("UPDATE intelligence.ai_drafts SET model_version='x' WHERE id=$1",[id]))))?.message).toMatch(/permission denied/);
    expect((await refusal(asAi(tx=>tx.query('DELETE FROM intelligence.ai_drafts WHERE id=$1',[id]))))?.message).toMatch(/permission denied/);
    expect((await refusal(asRuntime(pm.id,S,tx=>tx.query("UPDATE intelligence.ai_drafts SET model_version='x' WHERE id=$1",[id]))))?.message).toMatch(/permission denied/);
    expect((await refusal(asRuntime(pm.id,S,tx=>tx.query('DELETE FROM intelligence.ai_drafts WHERE id=$1',[id]))))?.message).toMatch(/permission denied/);
    expect((await refusal(h.operator.query("UPDATE intelligence.ai_drafts SET model_version='x' WHERE id=$1",[id])))?.message).toMatch(/Append-only/);
    expect((await refusal(h.operator.query('DELETE FROM intelligence.ai_drafts WHERE id=$1',[id])))?.message).toMatch(/Append-only/);
    expect(await count()).toBe(1);
  });

  test('G11 fail-closed: when the guard function is owned by a role that row-level security filters, every insert is refused',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    await rolledBack(h.operator,async(tx,probe)=>{
      await tx.query('ALTER FUNCTION intelligence.ai_drafts_pointer_only_guard() OWNER TO libetech_runtime');
      await tx.query('SET LOCAL ROLE libetech_ai');
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.ai_principal_id',$3,true)",[ids.tenant,[ids.sales,ids.transport].join(','),AI]);
      for(const project of [ids.sales,ids.transport]){
        const v=draftVals({project_id:project}),keys=Object.keys(v);
        const msg=await probe(`INSERT INTO intelligence.ai_drafts(${keys.join(',')}) VALUES(${keys.map((k,i)=>`$${i+1}${JSONB_COLUMNS.has(k)?'::jsonb':''}`).join(',')})`,keys.map(k=>v[k]));
        expect(msg,project).not.toBeNull();
        expect(msg).toMatch(/row-level security policy for table "project_domain_mappings"/);
      }
    });
  });

  test('G12 running 022 again changes nothing: the exact triggers of both tables, one enabled BEFORE INSERT row guard, one function, pinned settings, no grant; the file inserts no data and creates no role',async()=>{
    const sql=await readFile(path.join(process.cwd(),'migrations',F),'utf8');
    const shape=async()=>({
      triggers:await rows(`SELECT tgrelid::regclass::text t,tgname,tgenabled,tgtype,pg_get_triggerdef(oid) d FROM pg_trigger WHERE NOT tgisinternal
        AND tgrelid IN ('intelligence.ai_drafts'::regclass,'public.draft_decisions'::regclass) ORDER BY 1,2`),
      functions:await rows(`SELECT n.nspname,p.proname,p.prosecdef,p.proconfig::text c,p.proacl::text a,pg_get_userbyid(p.proowner) o FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE p.proname IN ('ai_drafts_pointer_only_guard','draft_decisions_guard') ORDER BY 1,2`),
      acl:await rows(`SELECT relname,relacl::text a,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('intelligence.ai_drafts'::regclass,'public.draft_decisions'::regclass) ORDER BY 1`),
      policies:await rows("SELECT tablename,policyname,roles::text r,cmd,qual,with_check FROM pg_policies WHERE tablename IN ('ai_drafts','draft_decisions') ORDER BY 1,2"),
      migrations:await rows("SELECT version FROM schema_migrations WHERE version='022'"),
    });
    const before=await shape();
    await h.exec(sql);await h.exec(sql);
    expect(await shape()).toEqual(before);
    const names=async(t:string)=>(await rows<{tgname:string}>('SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid=$1::regclass ORDER BY 1',[t])).map(r=>r.tgname);
    expect(await names('intelligence.ai_drafts')).toEqual(['ai_drafts_immutable','ai_drafts_pointer_only_guard']);
    expect(await names('public.draft_decisions')).toEqual(['draft_decisions_guard','draft_decisions_immutable']);
    const g=(await rows<{tgenabled:string;tgtype:number;d:string}>("SELECT tgenabled,tgtype,pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname='ai_drafts_pointer_only_guard' AND NOT tgisinternal"));
    expect(g).toHaveLength(1);
    expect(g[0].tgenabled).toBe('O');
    expect(g[0].tgtype).toBe(7);
    expect(g[0].d).toMatch(/BEFORE INSERT/);
    expect(g[0].d).toMatch(/FOR EACH ROW/);
    const fn=await rows<{prosecdef:boolean;proconfig:string[];super:boolean;bypass:boolean}>(`SELECT p.prosecdef,p.proconfig,r.rolsuper super,r.rolbypassrls bypass FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
      WHERE p.proname='ai_drafts_pointer_only_guard'`);
    expect(fn).toHaveLength(1);
    expect(fn[0].prosecdef).toBe(true);
    expect(fn[0].proconfig).toContain('search_path=pg_catalog, pg_temp');
    expect(fn[0].proconfig).toContain('row_security=off');
    expect(fn[0].super||fn[0].bypass).toBe(true);
    const def=(await rows<{d:string}>("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname='ai_drafts_pointer_only_guard'"))[0].d.replace(/\s+/g,' ');
    for(const f of ['FROM public.project_domain_mappings m','m.tenant_id = NEW.tenant_id AND m.project_id = NEW.project_id','ORDER BY m.mapping_version DESC LIMIT 1',
      "latest = 'IBS_HI'","ERRCODE = 'LTZ01'","current_setting('transaction_isolation') <> 'read committed'","ERRCODE = 'LTZ02'"]) expect(def,f).toContain(f);
    // the whole body, not fragments: the text of the file between AS $$ and the closing $$; equals prosrc
    const open=sql.indexOf('AS $$')+'AS $$'.length,close=sql.indexOf('$$;',open);
    expect(open).toBeGreaterThan(4);
    expect(close).toBeGreaterThan(open);
    const prosrc=(await rows<{p:string}>("SELECT prosrc p FROM pg_proc WHERE proname='ai_drafts_pointer_only_guard'"))[0].p;
    expect(sql.slice(open,close).trim()).toBe(prosrc.trim());
    const code=sql.replace(/--.*$/gm,'');
    expect(code).not.toMatch(/\bINSERT INTO (?!schema_migrations)/i);
    for(const re of [/\bGRANT\b/i,/CREATE\s+ROLE/i,/ALTER\s+ROLE/i,/\bPASSWORD\b/i,/CASCADE/i]) expect(code).not.toMatch(re);
    const lines=sql.trimEnd().split('\n');
    expect(lines.pop()).toBe('COMMIT;');
    expect(lines.pop()).toBe("INSERT INTO schema_migrations(version) VALUES('022') ON CONFLICT(version) DO NOTHING;");
  });

  test('G13 the guard gives no answer to a role that may not insert drafts',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const runtime=await refusal(asRuntime(pm.id,[ids.transport],tx=>insertDraft(tx,{project_id:ids.transport})));
    const intake=await refusal(h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_intake');return insertDraft(tx,{project_id:ids.transport});}));
    for(const e of [runtime,intake]){
      expect(e).not.toBeNull();
      expect(e!.message).toMatch(/permission denied/);
      expect(e!.code).not.toBe(LTZ);
    }
    expect(await count()).toBe(0);
  });

  test('G14 the guard decides each row of a multi-row insert: one IBS_HI row refuses the whole statement and nothing is stored',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const many=(projects:string[])=>refusal(asAi(tx=>{
      const v=draftVals(),keys=Object.keys(v),own=keys.filter(k=>!['project_id','entity_id','dedupe_key'].includes(k));
      const expr=(k:string)=>k==='project_id'?'u.project_id':k==='entity_id'?'gen_random_uuid()':k==='dedupe_key'?"'draft-'||gen_random_uuid()::text":`$${own.indexOf(k)+1}::${CAST[k]??'text'}`;
      return tx.query(`INSERT INTO intelligence.ai_drafts(${keys.join(',')}) SELECT ${keys.map(expr).join(',')} FROM unnest($${own.length+1}::uuid[]) u(project_id)`,[...own.map(k=>v[k]),projects]);
    },{projects:[ids.sales,ids.transport]}));
    const e=await many([ids.sales,ids.transport]);
    expect(e).not.toBeNull();
    expect(e!.code).toBe(LTZ);
    expect(await count()).toBe(0);
    expect(await many([ids.sales,ids.sales])).toBeNull();
    expect(await count()).toBe(2);
  });

  test('G15 a row without tenant_id or project_id is answered by the table, not by the guard',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    for(const over of [{tenant_id:null},{project_id:null}]){
      const e=await aiInsert(over,{projects:[ids.transport]});
      expect(e).not.toBeNull();
      expect(e!.code).not.toBe(LTZ);
      expect(e!.message).toMatch(/row-level security/);
      expect((await refusal(insertDraft(h.operator,over)))?.code).toBe('23502');
    }
    expect(await count()).toBe(0);
  });

  test('G16 the guard refuses a write from a transaction that is not READ COMMITTED: REPEATABLE READ and SERIALIZABLE are answered LTZ02 whatever the project, and nothing is stored',async()=>{
    const LTZ2='LTZ02',MSG2='An AI draft is written in a READ COMMITTED transaction';
    const check=(e:Refusal,label:string)=>{
      expect(e,label).not.toBeNull();
      expect(e!.code,label).toBe(LTZ2);
      expect(e!.message,label).toBe(MSG2);
      expect(e!.message,label).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    };
    // The isolation level is judged first, whatever the project: a project mapped IBS_HI is answered LTZ02 at REPEATABLE READ, not LTZ01.
    await mapDomain(h,ids.transport,'IBS_HI',1);
    for(const level of ['READ UNCOMMITTED','REPEATABLE READ','SERIALIZABLE']){
      for(const project of level==='REPEATABLE READ'?[ids.sales,ids.transport]:[ids.sales]){
        const before=await count();
        const label=level+' '+project;
        const e=await refusal(h.operator.transaction(async tx=>{
          await tx.query(`SET TRANSACTION ISOLATION LEVEL ${level}`);
          await tx.query('SET LOCAL ROLE libetech_ai');
          await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.ai_principal_id',$3,true)",[ids.tenant,project,AI]);
          return insertDraft(tx,{project_id:project});
        }));
        check(e,label);
        expect(await count(),label).toBe(before);
      }
    }
    const before=await count();
    check(await refusal(h.operator.transaction(async tx=>{
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      return insertDraft(tx,{project_id:ids.sales});
    })),'operational login');
    expect(await count()).toBe(before);
    expect(await aiInsert()).toBeNull();
    expect(await count()).toBe(before+1);
  });

  // Native only: the case needs two connections (the transaction and the one that commits the mapping); PGlite has one.
  test.skipIf(!native)('G17 REPEATABLE READ opened before the IBS_HI mapping was committed is refused LTZ02; READ COMMITTED sees a mapping committed after it began and is refused LTZ01',async()=>{
    const open=async(level:boolean,project:string,between:()=>Promise<unknown>)=>refusal(h.operator.transaction(async tx=>{
      if(level) await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await tx.query('SET LOCAL ROLE libetech_ai');
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.ai_principal_id',$3,true)",[ids.tenant,project,AI]);
      await tx.query('SELECT count(*) FROM intelligence.ai_drafts');
      await between();
      return insertDraft(tx,{project_id:project});
    }));
    const before=await count();
    expect((await open(true,ids.transport,()=>mapDomain(h,ids.transport,'IBS_HI',1)))?.code).toBe('LTZ02');
    expect(await count()).toBe(before);
    // ids.sales has no mapping row at all when this transaction opens
    expect((await rows<{n:number}>('SELECT count(*)::int n FROM public.project_domain_mappings WHERE project_id=$1',[ids.sales]))[0].n).toBe(0);
    expect((await open(false,ids.sales,()=>mapDomain(h,ids.sales,'IBS_HI',1)))?.code).toBe(LTZ);
    expect(await count()).toBe(before);
  });

  test('G18 MERGE is judged like INSERT: a MERGE that would insert a draft for an IBS_HI project is refused LTZ01 and nothing is stored',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const merge=(over:R)=>{
      const v=draftVals(over),keys=Object.keys(v);
      return refusal(h.operator.query(`MERGE INTO intelligence.ai_drafts d USING (SELECT 1) s ON false WHEN NOT MATCHED THEN INSERT (${keys.join(',')})
        VALUES (${keys.map((k,i)=>`$${i+1}${JSONB_COLUMNS.has(k)?'::jsonb':''}`).join(',')})`,keys.map(k=>v[k])));
    };
    const e=await merge({project_id:ids.transport});
    expect(e).not.toBeNull();
    expect(e!.code).toBe(LTZ);
    expect(await count()).toBe(0);
    expect(await merge({project_id:ids.sales})).toBeNull();
    expect(await count()).toBe(1);
    // the same MERGE under the AI role, its context for the IBS_HI project
    const v=draftVals({project_id:ids.transport}),keys=Object.keys(v);
    const ai=await refusal(asAi(tx=>tx.query(`MERGE INTO intelligence.ai_drafts d USING (SELECT 1) s ON false WHEN NOT MATCHED THEN INSERT (${keys.join(',')})
      VALUES (${keys.map((k,i)=>`$${i+1}${JSONB_COLUMNS.has(k)?'::jsonb':''}`).join(',')})`,keys.map(k=>v[k])),{projects:[ids.transport]}));
    expect(ai).not.toBeNull();
    expect(ai!.code).toBe(LTZ);
    expect(await count()).toBe(1);
  });
});
