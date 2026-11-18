import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {outsider,pm,sameBuProject,seedSlice1} from './slice1-fixtures';
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
type Refusal={code?:string;message:string;detail?:string;hint?:string;where?:string;schema?:string;table?:string;constraint?:string}|null;
const AI=aiPrincipal.id;
const HASH='a'.repeat(64);
const S=[ids.sales];
const LTZ='LTZ01';
const MESSAGE='An AI draft is not stored for a pointer-only project';
const RLS='new row violates row-level security policy for table "ai_drafts"';
const NS=1346653516;
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
const bare=(over:R)=>refusal(h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_ai');return insertDraft(tx,over);}));
// every field of an error that pg gives: two refusals compared with it must not differ in any of them (S-2)
const answer=(e:Refusal)=>e&&{code:e.code,message:e.message,detail:e.detail,hint:e.hint,where:e.where};
const mapIn=(tx:Queryable,project:string,code:'LIBERICO_BU'|'XECA'|'IBS_HI',version:number)=>tx.query(
  "INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,$3,$4,'synthetic-source',$5)",[ids.tenant,project,code,pm.id,version]);
// the advisory locks of the key space of the former body of migration 022 (an advisory lock), read inside the transaction that would hold them
const locks=async(q:Queryable)=>(await q.query<{mode:string;o:number|string;s:number}>(`SELECT mode, objid::bigint AS o, objsubid AS s FROM pg_locks WHERE locktype='advisory' AND classid=$1
  AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) ORDER BY 1`,[NS])).rows;
const LOCK_LINE='PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE;';
// the one foreign key of a table that references public.projects, read from the catalog
const fkToProjects=async(table:string)=>{
  const fk=await rows<{conname:string}>("SELECT conname FROM pg_constraint WHERE conrelid=$1::regclass AND contype='f' AND confrelid='public.projects'::regclass",[table]);
  expect(fk,table).toHaveLength(1);
  return fk[0].conname;
};
// a decision row with the columns decide writes; the draft's value hash is HASH (draftVals)
const insertDecision=(q:Queryable,draftId:string,over:R={})=>{
  const v:R={tenant_id:ids.tenant,project_id:ids.sales,draft_id:draftId,draft_value_hash:HASH,result:'confirmed',reason:'',document_revision_id:null,decided_by:pm.id,
    command_key:'decision-'+randomUUID(),request_id:randomUUID(),trace_id:randomUUID(),...over},keys=Object.keys(v);
  return q.query<{id:string}>(`INSERT INTO draft_decisions(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,keys.map(k=>v[k]));
};
const decisions=async(draftId:string)=>(await rows<{n:number}>('SELECT count(*)::int n FROM draft_decisions WHERE draft_id=$1',[draftId]))[0].n;
const DECISION_MESSAGE='A draft of a pointer-only project is not confirmed';
const mappings=async(project:string)=>(await rows<{n:number}>('SELECT count(*)::int n FROM public.project_domain_mappings WHERE project_id=$1',[project]))[0].n;
// an AI-role transaction that inserts a draft of a project and stays open until released: the shape of G24
const openDraft=(project:string)=>{
  const held=latch(),opened=latch();
  const done=h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_ai');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.ai_principal_id',$3,true)",[ids.tenant,project,AI]);
    await insertDraft(tx,{project_id:project});
    opened.open();
    await held.promise;
  });
  // opened, or the error of the transaction: a holder that fails never leaves the test waiting
  return {ready:Promise.race([opened.promise,done]),release:held.open,done};
};
// a statement that may wait: inside its own transaction, under a statement_timeout below the timeout of the test, so a missing cap shows as 57014
const capped=(fn:(tx:Queryable)=>Promise<unknown>)=>refusal(h.operator.transaction(async tx=>{await tx.query("SET LOCAL statement_timeout = '8s'");return fn(tx);}));
const cappedAi=(fn:(tx:Queryable)=>Promise<unknown>,projects:string[])=>refusal(asAi(async tx=>{await tx.query("SET LOCAL statement_timeout = '8s'");return fn(tx);},{projects}));
// a promise that is settled from outside: the way a test holds a transaction open on one connection while another connection acts
const latch=()=>{let open!:()=>void;const promise=new Promise<void>(r=>{open=r;});return {promise,open};};
const blockedOrSettled=(p:Promise<unknown>)=>Promise.race([p.then(()=>'settled',()=>'settled'),waitForBlocked(h,1).then(()=>'blocked',()=>'never blocked')]);

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

  test('G4 the guard reads the mapping of the row\'s own tenant: a row that names another tenant is answered by row-level security, a row that reaches the definer guard with a tenant that does not own the project is answered 23503, never LTZ01, and nothing is stored',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const e=await aiInsert({project_id:ids.transport,tenant_id:ids.otherTenant},{projects:[ids.transport]});
    expect(e?.message).toMatch(/row-level security/);
    expect(e?.code).not.toBe(LTZ);
    expect(await count()).toBe(0);
    // (a) DB-2: the operational login is not bound by row-level security, so its row reaches the definer guard with the tenant term mismatched
    const a=await refusal(insertDraft(h.operator,{tenant_id:ids.otherTenant,project_id:ids.transport}));
    expect(a?.code,'(a)').toBe('23503');
    expect(a?.code,'(a)').not.toBe(LTZ);
    // (b) the AI role declares its own tenant and a project of the other tenant, which that tenant mapped IBS_HI: the cross-tenant probe
    await h.operator.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,'IBS_HI',$3,'synthetic-source',1)",
      [ids.otherTenant,ids.otherProject,outsider.id]);
    const b=await aiInsert({project_id:ids.otherProject},{projects:[ids.otherProject]});
    expect(b?.code,'(b)').toBe('23503');
    expect(b?.code,'(b)').not.toBe(LTZ);
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

  test('G7 34d without a transaction context nothing is stored and nothing is told: an IBS_HI project and any other project get the same answer, the one row-level security gives',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const answers=[await bare({project_id:ids.transport}),await bare({project_id:ids.sales})];
    for(const e of answers){
      expect(e).not.toBeNull();
      expect(e!.code).toBe('42501');
      expect(e!.message).toBe(RLS);
      expect(e!.code).not.toBe(LTZ);
    }
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

  test('G9 a role bound by row-level security cannot tell an IBS_HI project outside its declared scope from any other: the same SQLSTATE and the same message; inside the declared scope the guard answers LTZ01',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const ibs=await aiInsert({project_id:ids.transport},{projects:[ids.sales]});
    const other=await aiInsert({project_id:sameBuProject},{projects:[ids.sales]});
    expect(ibs).not.toBeNull();
    expect(other).not.toBeNull();
    expect(answer(ibs)).toEqual(answer(other));
    expect(ibs!.code).toBe('42501');
    expect(ibs!.code).not.toBe(LTZ);
    // inside the declared scope the one bit is still there: that is the part of the AI login design, not of this file
    expect((await aiInsert({project_id:ids.transport},{projects:[ids.transport]}))?.code).toBe(LTZ);
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

  // Measured on PGlite: the first statement of either definer function that meets row-level security is the row lock on public.projects (FORCE RLS, 010).
  const G11_SENTENCE='query would be affected by row-level security policy for table "projects"';
  test('G11 fail-closed: when the guard function is owned by a role that row-level security filters, every insert is refused; when the lock function of a mapping is, every mapping insert is refused',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    await rolledBack(h.operator,async(tx,probe)=>{
      await tx.query('ALTER FUNCTION intelligence.ai_drafts_pointer_only_guard() OWNER TO libetech_runtime');
      await tx.query('SET LOCAL ROLE libetech_ai');
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.ai_principal_id',$3,true)",[ids.tenant,[ids.sales,ids.transport].join(','),AI]);
      for(const project of [ids.sales,ids.transport]){
        const v=draftVals({project_id:project}),keys=Object.keys(v);
        const msg=await probe(`INSERT INTO intelligence.ai_drafts(${keys.join(',')}) VALUES(${keys.map((k,i)=>`$${i+1}${JSONB_COLUMNS.has(k)?'::jsonb':''}`).join(',')})`,keys.map(k=>v[k]));
        expect(msg,project).not.toBeNull();
        expect(msg,project).toBe(G11_SENTENCE);
      }
    });
    // the twin: the lock function of a mapping insert owned by the runtime role
    await rolledBack(h.operator,async(tx,probe)=>{
      await tx.query('ALTER FUNCTION intelligence.project_domain_mappings_draft_lock() OWNER TO libetech_runtime');
      const msg=await probe("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,'XECA',$3,'synthetic-source',1)",[ids.tenant,ids.sales,pm.id]);
      expect(msg).not.toBeNull();
      expect(msg).toBe(G11_SENTENCE);
      expect((await tx.query<{n:number}>('SELECT count(*)::int n FROM public.project_domain_mappings WHERE project_id=$1',[ids.sales])).rows[0].n).toBe(0);
    });
    expect(await mappings(ids.sales)).toBe(0);
  });

  test('G12 running 022 again changes nothing: the exact triggers of the three tables (four triggers), four functions with pinned settings and the order they fire in, no grant; the file inserts no data and creates no role',async()=>{
    const sql=await readFile(path.join(process.cwd(),'migrations',F),'utf8');
    const FN=['ai_drafts_declared_scope_guard','ai_drafts_pointer_only_guard','project_domain_mappings_draft_lock','draft_decisions_pointer_only_guard'];
    const shape=async()=>({
      triggers:await rows(`SELECT tgrelid::regclass::text t,tgname,tgenabled,tgtype,pg_get_triggerdef(oid) d FROM pg_trigger WHERE NOT tgisinternal
        AND tgrelid IN ('intelligence.ai_drafts'::regclass,'public.draft_decisions'::regclass,'public.project_domain_mappings'::regclass) ORDER BY 1,2`),
      functions:await rows(`SELECT n.nspname,p.proname,p.prosecdef,p.proconfig::text c,p.proacl::text a,pg_get_userbyid(p.proowner) o,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE p.proname IN ('ai_drafts_declared_scope_guard','ai_drafts_pointer_only_guard','project_domain_mappings_draft_lock','draft_decisions_pointer_only_guard','draft_decisions_guard') ORDER BY 1,2`),
      acl:await rows(`SELECT relname,relacl::text a,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('intelligence.ai_drafts'::regclass,'public.draft_decisions'::regclass) ORDER BY 1`),
      policies:await rows("SELECT tablename,policyname,roles::text r,cmd,qual,with_check FROM pg_policies WHERE tablename IN ('ai_drafts','draft_decisions') ORDER BY 1,2"),
      migrations:await rows("SELECT version FROM schema_migrations WHERE version='022'"),
    });
    // the whole body of each function, not fragments: the text of the file between AS $$ and the closing $$;
    const fileFns=[...sql.matchAll(/CREATE OR REPLACE FUNCTION (intelligence\.\w+)\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)].map(m=>({name:m[1],body:m[2].trim()}));
    expect(fileFns.map(f=>f.name)).toEqual(FN.map(n=>'intelligence.'+n));
    const bodyOf=async(name:string)=>(await rows<{p:string}>('SELECT prosrc p FROM pg_proc WHERE proname=$1',[name]))[0].p.trim();
    const sameBodies=async()=>{for(const f of fileFns) expect(await bodyOf(f.name.replace('intelligence.','')),f.name).toBe(f.body);};
    // first comparison: the bodies the harness installed when the database was built, read BEFORE the file is applied again
    await sameBodies();
    const before=await shape();
    await h.exec(sql);await h.exec(sql);
    expect(await shape()).toEqual(before);
    const names=async(t:string)=>(await rows<{tgname:string}>('SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid=$1::regclass ORDER BY 1',[t])).map(r=>r.tgname);
    expect(await names('intelligence.ai_drafts')).toEqual(['ai_drafts_declared_scope_guard','ai_drafts_immutable','ai_drafts_pointer_only_guard']);
    expect(await names('public.draft_decisions')).toEqual(['draft_decisions_guard','draft_decisions_immutable','draft_decisions_pointer_only_guard']);
    expect(await names('public.project_domain_mappings')).toEqual(['project_domain_mappings_draft_lock','project_domain_mappings_immutable']);
    // the order they fire in: BEFORE INSERT row triggers of one table fire by name, so the scope guard answers before the definer guard reads anything
    expect((await rows<{tgname:string}>("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='intelligence.ai_drafts'::regclass AND tgtype=7 ORDER BY tgname")).map(r=>r.tgname))
      .toEqual(['ai_drafts_declared_scope_guard','ai_drafts_pointer_only_guard']);
    // on the decision table: 021's guard (the draft read under the caller's own scope) answers before the definer guard reads any mapping
    expect((await rows<{tgname:string}>("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.draft_decisions'::regclass AND tgtype=7 ORDER BY tgname")).map(r=>r.tgname))
      .toEqual(['draft_decisions_guard','draft_decisions_pointer_only_guard']);
    for(const n of FN){
      const g=await rows<{tgenabled:string;tgtype:number;d:string}>("SELECT tgenabled,tgtype,pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname=$1 AND NOT tgisinternal",[n]);
      expect(g,n).toHaveLength(1);
      expect(g[0].tgenabled,n).toBe('O');
      expect(g[0].tgtype,n).toBe(7);
      expect(g[0].d,n).toMatch(/BEFORE INSERT/);
      expect(g[0].d,n).toMatch(/FOR EACH ROW/);
    }
    const PINS:Record<string,{prosecdef:boolean;proconfig:string[];provolatile:string}>={
      ai_drafts_declared_scope_guard:{prosecdef:false,proconfig:['search_path=pg_catalog, pg_temp'],provolatile:'v'},
      ai_drafts_pointer_only_guard:{prosecdef:true,proconfig:['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s'],provolatile:'v'},
      project_domain_mappings_draft_lock:{prosecdef:true,proconfig:['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s'],provolatile:'v'},
      draft_decisions_pointer_only_guard:{prosecdef:true,proconfig:['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s'],provolatile:'v'},
    };
    for(const n of FN){
      const fn=await rows<{prosecdef:boolean;proconfig:string[];provolatile:string}>('SELECT p.prosecdef,p.proconfig,p.provolatile FROM pg_proc p WHERE p.proname=$1',[n]);
      expect(fn,n).toHaveLength(1);
      expect(fn[0],n).toEqual(PINS[n]);
    }
    // the owner of the three definer functions is not bound by row-level security: a superuser or a role with BYPASSRLS
    const owners=await rows<{proname:string;ok:boolean}>(`SELECT p.proname,(r.rolsuper OR r.rolbypassrls) ok FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
      WHERE p.proname IN ('ai_drafts_pointer_only_guard','project_domain_mappings_draft_lock','draft_decisions_pointer_only_guard') ORDER BY 1`);
    expect(owners).toEqual([{proname:'ai_drafts_pointer_only_guard',ok:true},{proname:'draft_decisions_pointer_only_guard',ok:true},{proname:'project_domain_mappings_draft_lock',ok:true}]);
    const def=(await rows<{d:string}>("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname='ai_drafts_pointer_only_guard'"))[0].d.replace(/\s+/g,' ');
    for(const f of ['FROM public.project_domain_mappings m','m.tenant_id = NEW.tenant_id AND m.project_id = NEW.project_id','ORDER BY m.mapping_version DESC LIMIT 1',
      "latest = 'IBS_HI'","ERRCODE = 'LTZ01'","current_setting('transaction_isolation') <> 'read committed'","ERRCODE = 'LTZ02'"]) expect(def,f).toContain(f);
    const src=async(n:string)=>(await rows<{p:string}>('SELECT prosrc p FROM pg_proc WHERE proname=$1',[n]))[0].p;
    // in the definer guard: the isolation check, then the row lock on the project, then the read of the mapping
    const guard=await src('ai_drafts_pointer_only_guard');
    const at=(t:string)=>guard.indexOf(t);
    for(const f of [LOCK_LINE,'IF NOT FOUND THEN',"ERRCODE = '23503'"]) expect(guard,f).toContain(f);
    expect(at("'transaction_isolation'")).toBeGreaterThan(-1);
    expect(at("'transaction_isolation'")).toBeLessThan(at('FOR NO KEY UPDATE'));
    expect(at('FOR NO KEY UPDATE')).toBeLessThan(at('FROM public.project_domain_mappings'));
    expect(guard).not.toContain('pg_advisory');
    // in the scope guard: two nested IFs, the first asks only whether row-level security binds the role; the app.* settings are read inside it
    const scope=await src('ai_drafts_declared_scope_guard');
    expect(scope.indexOf('row_security_active(TG_RELID) THEN')).toBeGreaterThan(-1);
    expect(scope.indexOf('row_security_active(TG_RELID) THEN')).toBeLessThan(scope.indexOf("current_setting('app.tenant_id'"));
    for(const f of ['IF pg_catalog.row_security_active(TG_RELID) THEN','IS NOT TRUE THEN',"ERRCODE = '42501'",'HINT = ','NEW.tenant_id =','NEW.project_id = ANY','NEW.ai_principal_id =']) expect(scope,f).toContain(f);
    const lock=await src('project_domain_mappings_draft_lock');
    for(const f of [LOCK_LINE,'IF NOT FOUND THEN']) expect(lock,f).toContain(f);
    expect(lock).not.toContain('pg_advisory');
    // the decision guard: a rejection returns first; then the isolation check, the row lock, the read of the mapping
    const decision=await src('draft_decisions_pointer_only_guard');
    for(const f of [LOCK_LINE,'IF NOT FOUND THEN',"ERRCODE = '23503'","ERRCODE = 'LTZ01'","ERRCODE = 'LTZ02'","NEW.result IS DISTINCT FROM 'confirmed'"]) expect(decision,f).toContain(f);
    const dat=(t:string)=>decision.indexOf(t);
    expect(dat("NEW.result IS DISTINCT FROM 'confirmed'")).toBeLessThan(dat("'transaction_isolation'"));
    expect(dat("'transaction_isolation'")).toBeLessThan(dat('FOR NO KEY UPDATE'));
    expect(dat('FOR NO KEY UPDATE')).toBeLessThan(dat('FROM public.project_domain_mappings'));
    expect(decision).not.toContain('pg_advisory');
    // second comparison, after the re-apply
    await sameBodies();
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

  test('G16 the guard refuses a write from a transaction that is not READ COMMITTED: READ UNCOMMITTED, REPEATABLE READ and SERIALIZABLE are answered LTZ02 whatever the project (REPEATABLE READ also for an IBS_HI project), and nothing is stored',async()=>{
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

  // ---- Round 1 of the Codex gate, CX1: the declared-scope guard ----
  test('G19 the declared-scope guard answers for every row the insert policy would refuse, with the policy\'s own words, whether or not the project is IBS_HI',async()=>{
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const before=await count();
    // each kind of row the policy ai_insert refuses, run once for the IBS_HI project and once for an unmapped one
    const kinds:[string,(p:string)=>Promise<Refusal>][]=[
      ['(a) a project that is not in the declared list',p=>aiInsert({project_id:p},{projects:[ids.sales]})],
      ['(b) a row of another tenant (the scope names the project itself)',p=>aiInsert({project_id:p,tenant_id:ids.otherTenant},{projects:[p]})],
      ['(c) another ai_principal_id on the row',p=>aiInsert({project_id:p,ai_principal_id:randomUUID()},{projects:[p]})],
      ['(d) app.ai_principal_id not declared',p=>refusal(asAi(tx=>insertDraft(tx,{project_id:p}),{projects:[p],principal:null}))],
      ['(e) app.tenant_id declared as another tenant',p=>refusal(asAi(tx=>insertDraft(tx,{project_id:p}),{tenant:ids.otherTenant,projects:[p]}))],
      ['(f) nothing declared',p=>bare({project_id:p})],
    ];
    for(const [label,run] of kinds) for(const project of [ids.transport,sameBuProject]){
      const e=await run(project);
      expect(e,label+' '+project).not.toBeNull();
      expect(e!.code,label+' '+project).toBe('42501');
      expect(e!.message,label+' '+project).toBe(RLS);
      expect(e!.code,label+' '+project).not.toBe(LTZ);
    }
    expect(await count()).toBe(before);
    // the answer of row-level security itself, for each of the six kinds of row (DB-3), with the scope guard switched off for one transaction each,
    // which always rolls back (it throws), so the trigger is never left switched off, on PGlite or on a native database.
    // The project is unmapped, so the definer guard lets the row through to the policy. Kind (b) names a project of the other tenant: a row whose
    // (tenant, project) pair does not exist is answered 23503 by the definer guard before the policy is checked (WITH CHECK runs after BEFORE triggers).
    type Declared={tenant?:string;projects?:string[];principal?:string|null}|null;
    const offKinds:[string,R,Declared][]=[
      ['(a) a project that is not in the declared list',{project_id:sameBuProject},{projects:[ids.sales]}],
      ['(b) a row of another tenant (the scope names the project itself)',{project_id:ids.otherProject,tenant_id:ids.otherTenant},{projects:[ids.otherProject]}],
      ['(c) another ai_principal_id on the row',{project_id:sameBuProject,ai_principal_id:randomUUID()},{projects:[sameBuProject]}],
      ['(d) app.ai_principal_id not declared',{project_id:sameBuProject},{projects:[sameBuProject],principal:null}],
      ['(e) app.tenant_id declared as another tenant',{project_id:sameBuProject},{tenant:ids.otherTenant,projects:[sameBuProject]}],
      ['(f) nothing declared',{project_id:sameBuProject},null],
    ];
    for(const [label,over,declared] of offKinds){
      const own=await refusal(h.operator.transaction(async tx=>{
        await tx.query('ALTER TABLE intelligence.ai_drafts DISABLE TRIGGER ai_drafts_declared_scope_guard');
        await tx.query('SET LOCAL ROLE libetech_ai');
        if(declared){
          await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[declared.tenant??ids.tenant,(declared.projects??S).join(',')]);
          if(declared.principal!==null) await tx.query("SELECT set_config('app.ai_principal_id',$1,true)",[declared.principal??AI]);
        }
        await insertDraft(tx,over);
        throw new Error('must not be stored');
      }));
      expect(own,label).not.toBeNull();
      expect(own!.code,label).toBe('42501');
      expect(own!.message,label).toBe(RLS);
      expect(own!.hint,label).toBeUndefined();
    }
    expect(await rows("SELECT tgenabled FROM pg_trigger WHERE tgname='ai_drafts_declared_scope_guard'")).toEqual([{tgenabled:'O'}]);
    expect(await count()).toBe(before);
  });

  test('G20 the role cannot switch the scope guard off, cannot call or change the functions of 022, and no runtime role takes the row lock of a project by itself',async()=>{
    expect((await refusal(asAi(tx=>tx.query('SET LOCAL session_replication_role = replica'))))?.message).toMatch(/permission denied/);
    expect((await refusal(asAi(tx=>tx.query('ALTER TABLE intelligence.ai_drafts DISABLE TRIGGER ai_drafts_declared_scope_guard'))))?.message).toMatch(/must be owner|permission denied/);
    expect((await refusal(asAi(tx=>tx.query('SELECT intelligence.ai_drafts_declared_scope_guard()'))))?.message).toMatch(/permission denied/);
    expect((await refusal(asAi(tx=>tx.query('SELECT intelligence.project_domain_mappings_draft_lock()'))))?.message).toMatch(/permission denied/);
    expect((await refusal(asAi(tx=>tx.query('SELECT intelligence.draft_decisions_pointer_only_guard()'))))?.message).toMatch(/permission denied/);
    // DB-7 (a): the cap lives in proconfig, and the role cannot change it
    expect((await refusal(asAi(tx=>tx.query('ALTER FUNCTION intelligence.project_domain_mappings_draft_lock() SET lock_timeout = 0'))))?.message).toMatch(/must be owner/);
    // the lock is a row lock on public.projects: a role that may only read the table (or not even that) cannot take it
    for(const strength of ['FOR NO KEY UPDATE','FOR SHARE']){
      const sql=`SELECT 1 FROM public.projects WHERE id=$1 ${strength}`;
      expect((await refusal(asAi(tx=>tx.query(sql,[ids.sales]))))?.message,'AI '+strength).toMatch(/permission denied/);
      expect((await refusal(asRuntime(pm.id,S,tx=>tx.query(sql,[ids.sales]))))?.message,'runtime '+strength).toMatch(/permission denied/);
    }
    // R-3, S-7: every libetech role, not only these two. Each attempt runs in its own transaction, which always ends in an error and rolls back.
    const roles=(await rows<{rolname:string}>("SELECT rolname FROM pg_roles WHERE rolname LIKE 'libetech%' ORDER BY 1")).map(r=>r.rolname);
    expect(roles.length).toBeGreaterThanOrEqual(9);
    for(const role of roles){
      expect(role).toMatch(/^libetech[a-z0-9_]*$/);
      const e=await refusal(h.operator.transaction(async tx=>{
        await tx.query(`SET LOCAL ROLE ${role}`);
        await tx.query('SELECT 1 FROM public.projects WHERE id=$1 FOR NO KEY UPDATE',[ids.sales]);
        throw new Error('the row lock was taken by '+role);
      }));
      expect(e?.message,role).toMatch(/permission denied/);
    }
    // and the catalog: no explicit grant of UPDATE, DELETE or TRUNCATE on public.projects, on the table or on a column, to PUBLIC or to a role that is
    // not a superuser (query F of the database re-look, reduced to the ACL entries; predefined pg_* roles are outside it)
    expect(await rows(`SELECT 'table' lvl, coalesce(r.rolname,'PUBLIC') grantee, a.privilege_type
        FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
       WHERE c.oid='public.projects'::regclass AND a.privilege_type IN ('UPDATE','DELETE','TRUNCATE') AND (a.grantee=0 OR NOT r.rolsuper)
      UNION ALL
      SELECT 'column '||t.attname, coalesce(r.rolname,'PUBLIC'), a.privilege_type
        FROM pg_attribute t CROSS JOIN LATERAL aclexplode(t.attacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
       WHERE t.attrelid='public.projects'::regclass AND a.privilege_type IN ('UPDATE','DELETE','TRUNCATE') AND (a.grantee=0 OR NOT r.rolsuper)
      ORDER BY 1,2,3`)).toEqual([]);
    const PINS:Record<string,{prosecdef:boolean;proconfig:string[]}>={
      ai_drafts_declared_scope_guard:{prosecdef:false,proconfig:['search_path=pg_catalog, pg_temp']},
      project_domain_mappings_draft_lock:{prosecdef:true,proconfig:['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s']},
      draft_decisions_pointer_only_guard:{prosecdef:true,proconfig:['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s']},
    };
    for(const [name,pin] of Object.entries(PINS)){
      expect(await rows('SELECT p.prosecdef,p.proconfig FROM pg_proc p WHERE p.proname=$1',[name]),name).toEqual([pin]);
      expect(await rows<{is_owner:boolean}>(`SELECT a.grantee = p.proowner AS is_owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace, aclexplode(p.proacl) a
        WHERE n.nspname='intelligence' AND p.proname=$1`,[name]),name).toEqual([{is_owner:true}]);
      expect(await rows<{ok:boolean}>("SELECT has_function_privilege('libetech_ai',p.oid,'EXECUTE') ok FROM pg_proc p WHERE p.proname=$1",[name]),name).toEqual([{ok:false}]);
    }
    expect(await rows(`SELECT n.nspname||'.'||p.proname f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE p.prosecdef AND has_function_privilege('libetech_ai',p.oid,'EXECUTE')`)).toEqual([]);
    // A CONTROL, not a protection of the scope guard: after row_security = off, PostgreSQL refuses the insert of a role that row-level security binds
    // before any trigger fires, the same for every project. This holds today and holds with or without the scope guard (measured on PGlite: 42501,
    // "query would be affected by row-level security policy for table "ai_drafts"").
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const off=(project:string)=>refusal(asAi(async tx=>{await tx.query('SET LOCAL row_security = off');return insertDraft(tx,{project_id:project});}));
    const [a,b]=[await off(ids.transport),await off(sameBuProject)];
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(answer(a)).toEqual(answer(b));
    expect(a!.code).not.toBe(LTZ);
    expect(await count()).toBe(0);
  });

  test('G25 the policies that the scope guard mirrors are pinned: one INSERT policy and one SELECT policy on intelligence.ai_drafts for libetech_ai, permissive, with this WITH CHECK and this USING, and no restrictive policy',async()=>{
    // Changing either constant means changing the scope guard of migration 022 (intelligence.ai_drafts_declared_scope_guard). The trigger must be as
    // tight as the INTERSECTION of ai_insert and ai_select: an insert with RETURNING or ON CONFLICT (the statement of submitDraft) is also checked
    // against the USING of ai_select on the new row, with the same 42501. A stricter policy of either kind, or a restrictive one, would let a row past
    // the trigger that row-level security refuses: the definer guard would answer first again.
    const AI_SELECT_USING="((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid) AND (project_id = ANY ((string_to_array(COALESCE(current_setting('app.project_ids'::text, true), ''::text), ','::text))::uuid[])))";
    const select=await rows(`SELECT polname, polcmd, pg_get_expr(polqual,polrelid) using_expr FROM pg_policy
      WHERE polrelid='intelligence.ai_drafts'::regclass AND polcmd IN ('r','*') AND (0 = ANY(polroles) OR 'libetech_ai'::regrole::oid = ANY(polroles)) ORDER BY 1`);
    expect(select).toEqual([{polname:'ai_select',polcmd:'r',using_expr:AI_SELECT_USING}]);
    const AI_INSERT_CHECK="((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid) AND (project_id = ANY ((string_to_array(COALESCE(current_setting('app.project_ids'::text, true), ''::text), ','::text))::uuid[])) AND (ai_principal_id = (NULLIF(current_setting('app.ai_principal_id'::text, true), ''::text))::uuid))";
    const policies=await rows<{polname:string;polcmd:string;polpermissive:boolean;roles:string[];with_check:string}>(`SELECT polname, polcmd, polpermissive,
      (SELECT array_agg(rolname::text ORDER BY 1) FROM pg_roles WHERE oid=ANY(polroles)) roles, pg_get_expr(polwithcheck,polrelid) with_check
      FROM pg_policy WHERE polrelid='intelligence.ai_drafts'::regclass ORDER BY 1`);
    expect(policies.length).toBeGreaterThan(0);
    for(const p of policies) expect(p.polpermissive,p.polname).toBe(true);
    expect(policies.filter(p=>['a','*'].includes(p.polcmd))).toEqual([{polname:'ai_insert',polcmd:'a',polpermissive:true,roles:['libetech_ai'],with_check:AI_INSERT_CHECK}]);
  });

  test('G26 whatever the statement, a row outside the declared scope gets one answer for an IBS_HI project and for any other: MERGE, a multi-row insert in both orders, the statement of submitDraft on a stored key, a setting that is not a uuid',async()=>{
    const KEY:Record<string,string>={[ids.transport]:'g26-'+randomUUID(),[sameBuProject]:'g26-'+randomUUID()};
    // a draft of each project is stored before the IBS_HI mapping: the statement of submitDraft then meets a key that exists
    for(const project of [ids.transport,sameBuProject]) await insertDraft(h.operator,{project_id:project,dedupe_key:KEY[project]});
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const before=await count();
    const cols=(v:R)=>Object.keys(v);
    const ph=(v:R,at:number)=>cols(v).map((k,i)=>`$${at+i}${JSONB_COLUMNS.has(k)?'::jsonb':''}`).join(',');
    const outside={projects:[ids.sales]};
    const shapes:[string,string,(p:string)=>Promise<Refusal>][]=[
      ['MERGE','42501',p=>{const v=draftVals({project_id:p});return refusal(asAi(tx=>tx.query(`MERGE INTO intelligence.ai_drafts d USING (SELECT 1) s ON false WHEN NOT MATCHED THEN INSERT (${cols(v).join(',')})
        VALUES (${ph(v,1)})`,cols(v).map(k=>v[k])),outside));}],
      ['in-scope row, then outside row','42501',p=>{const a=draftVals({project_id:ids.sales}),b=draftVals({project_id:p});
        return refusal(asAi(tx=>tx.query(`INSERT INTO intelligence.ai_drafts(${cols(a).join(',')}) VALUES (${ph(a,1)}),(${ph(b,cols(a).length+1)})`,[...cols(a).map(k=>a[k]),...cols(b).map(k=>b[k])]),outside));}],
      ['outside row, then in-scope row','42501',p=>{const a=draftVals({project_id:p}),b=draftVals({project_id:ids.sales});
        return refusal(asAi(tx=>tx.query(`INSERT INTO intelligence.ai_drafts(${cols(a).join(',')}) VALUES (${ph(a,1)}),(${ph(b,cols(a).length+1)})`,[...cols(a).map(k=>a[k]),...cols(b).map(k=>b[k])]),outside));}],
      ['the statement of submitDraft on a stored key','42501',p=>{const v=draftVals({project_id:p,dedupe_key:KEY[p]});
        return refusal(asAi(tx=>tx.query(`INSERT INTO intelligence.ai_drafts(${cols(v).join(',')}) VALUES (${ph(v,1)}) ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`,cols(v).map(k=>v[k])),outside));}],
      ['app.project_ids is not a uuid','22P02',p=>refusal(asAi(tx=>insertDraft(tx,{project_id:p}),{projects:['x']}))],
      ['app.tenant_id is not a uuid','22P02',p=>refusal(asAi(tx=>insertDraft(tx,{project_id:p}),{tenant:'x'}))],
    ];
    for(const [label,code,run] of shapes){
      const a=await run(ids.transport),b=await run(sameBuProject);
      expect(a,label).not.toBeNull();
      expect(b,label).not.toBeNull();
      expect(answer(a),label).toEqual(answer(b));
      expect(a!.code,label).toBe(code);
      expect(a!.code,label).not.toBe(LTZ);
      if(code==='42501') expect(a!.message,label).toBe(RLS);
    }
    expect(await count()).toBe(before);
    // the operational login is not bound by row-level security: a broken app.* setting left in its session decides nothing, and it is still stopped for IBS_HI
    const control=(project:string)=>refusal(h.operator.transaction(async tx=>{
      await tx.query("SELECT set_config('app.project_ids','x',true),set_config('app.tenant_id','y',true)");
      return insertDraft(tx,{project_id:project});
    }));
    expect((await control(ids.transport))?.code).toBe(LTZ);
    expect(await control(sameBuProject)).toBeNull();
    expect(await count()).toBe(before+1);
  });

  // ---- CX4: a row lock on the project row (FOR NO KEY UPDATE), in the guard and in a mapping insert ----
  // One PGlite connection cannot observe the strength of a row lock: these cases assert what one connection sees. The strength is pinned by G12/G20
  // (the text of the functions) and by the native cases G24, G27 and N3-N6.
  test('G21 the guard and the lock function lock the project row of a row while that row is handled, before the foreign-key check at the end of the statement: the next row of the same statement sees the row locked by this transaction; no advisory lock is taken',async()=>{
    // R-1: the foreign-key check also locks the project row, but only at the end of the statement. Row 2 of a two-row statement reads, through a
    // correlated sub-query evaluated when row 2 is produced, whether the project row of row 1 carries this transaction's id in its xmax: it does
    // only if the trigger of row 1 locked it. xmax is compared with the transaction's own id, so a stale xmax of an earlier transaction reads false.
    const FLAG_OF=ids.sales; // the project of row 1
    const flag=(of:string)=>`'flag-'||(SELECT (p.xmax::text = pg_current_xact_id()::xid::text)::text FROM public.projects p WHERE p.id = ${of})`;
    const now=async(tx:Queryable)=>(await tx.query<{f:string}>(`SELECT ${flag('$1::uuid')} f`,[FLAG_OF])).rows[0].f;
    // draft side, as the operational login (it may read public.projects): row 1 of ids.sales, row 2 of ids.transport carries the flag in model_version
    await rolledBack(h.operator,async tx=>{
      expect(await now(tx),'draft side, before').toBe('flag-false');
      const v=draftVals(),keys=Object.keys(v),own=keys.filter(k=>!['project_id','entity_id','dedupe_key','model_version'].includes(k));
      const expr=(k:string)=>k==='project_id'?'u.project_id':k==='entity_id'?'gen_random_uuid()':k==='dedupe_key'?"'draft-'||gen_random_uuid()::text"
        :k==='model_version'?`CASE WHEN u.flag_of IS NULL THEN 'synthetic-model' ELSE ${flag('u.flag_of')} END`:`$${own.indexOf(k)+1}::${CAST[k]??'text'}`;
      const n=own.length;
      await tx.query(`INSERT INTO intelligence.ai_drafts(${keys.join(',')}) SELECT ${keys.map(expr).join(',')}
        FROM (VALUES ($${n+1}::uuid,NULL::uuid),($${n+2}::uuid,$${n+3}::uuid)) u(project_id,flag_of)`,[...own.map(k=>v[k]),ids.sales,ids.transport,FLAG_OF]);
      expect((await tx.query<{m:string}>("SELECT model_version m FROM intelligence.ai_drafts WHERE project_id=$1 AND model_version LIKE 'flag-%'",[ids.transport])).rows,'draft side')
        .toEqual([{m:'flag-true'}]);
      // (i) no advisory lock of the key space of the former body of 022
      expect(await locks(tx),'draft side').toEqual([]);
    });
    // mapping side: row 1 of ids.sales, row 2 of ids.transport carries the flag in source
    await rolledBack(h.operator,async tx=>{
      expect(await now(tx),'mapping side, before').toBe('flag-false');
      await tx.query(`INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version)
        SELECT $1::uuid,u.project_id,'XECA',$2::uuid,CASE WHEN u.flag_of IS NULL THEN 'synthetic-source' ELSE ${flag('u.flag_of')} END,1
        FROM (VALUES ($3::uuid,NULL::uuid),($4::uuid,$5::uuid)) u(project_id,flag_of)`,[ids.tenant,pm.id,ids.sales,ids.transport,FLAG_OF]);
      expect((await tx.query<{s:string}>('SELECT source s FROM project_domain_mappings WHERE project_id=$1',[ids.transport])).rows,'mapping side').toEqual([{s:'flag-true'}]);
      expect(await locks(tx),'mapping side').toEqual([]);
    });
    expect(await count()).toBe(0);
    expect(await mappings(ids.sales)+await mappings(ids.transport)).toBe(0);
  });

  test('G22 a draft insert in the transaction that wrote an IBS_HI mapping is refused; a row without a project is answered by the table',async()=>{
    const e=await refusal(h.operator.transaction(async tx=>{
      await mapIn(tx,ids.sales,'IBS_HI',1);
      return insertDraft(tx,{project_id:ids.sales});
    }));
    expect(e).not.toBeNull();
    expect(e!.code).toBe(LTZ);
    expect(await count()).toBe(0);
    expect((await refusal(insertDraft(h.operator,{project_id:null})))?.code).toBe('23502');
    expect(await count()).toBe(0);
    // DB-5: the other order in one transaction, a draft and then a mapping of the same project, does not wait for itself
    await rolledBack(h.operator,async tx=>{
      await insertDraft(tx,{project_id:ids.sales});
      await mapIn(tx,ids.sales,'XECA',1);
    });
    // the order of a one-transaction restore: a new project row, a draft for it, a mapping for it, a second draft for it
    await rolledBack(h.operator,async tx=>{
      const p=randomUUID();
      await tx.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)',[p,ids.tenant,'Dự án phục hồi mẫu','BU mẫu']);
      await insertDraft(tx,{project_id:p});
      await mapIn(tx,p,'XECA',1);
      await insertDraft(tx,{project_id:p});
    });
    expect(await count()).toBe(0);
  });

  test('N1 a draft for a (tenant, project) pair that does not exist is refused 23503 by the guard itself, and nothing is stored',async()=>{
    const ghost=randomUUID();
    const cases:[string,()=>Promise<Refusal>][]=[
      ['(a) the AI role, a random project in its declared scope',()=>aiInsert({project_id:ghost},{projects:[ghost]})],
      ['(b) the operational login, a random project',()=>refusal(insertDraft(h.operator,{project_id:randomUUID()}))],
      ['(c) the operational login, a project of another tenant',()=>refusal(insertDraft(h.operator,{tenant_id:ids.otherTenant,project_id:ids.sales}))],
    ];
    const fk=await fkToProjects('intelligence.ai_drafts');
    for(const [label,run] of cases){
      const e=await run();
      expect(e,label).not.toBeNull();
      expect(e!.code,label).toBe('23503');
      expect(e!.message,label).toContain('foreign key');
      expect(e!.hint,label).toContain('ai_drafts_pointer_only_guard');
      // R-2: the fields of the refusal are the catalog's, not only words in the function
      expect({schema:e!.schema,table:e!.table,constraint:e!.constraint},label).toEqual({schema:'intelligence',table:'ai_drafts',constraint:fk});
    }
    expect(await count()).toBe(0);
  });

  test('N2 a mapping for a project that does not exist is refused 23503 by the lock function, and a mapping insert leaves the lock_timeout of the session as it was',async()=>{
    const ghost=randomUUID();
    const e=await refusal(mapIn(h.operator,ghost,'IBS_HI',1));
    expect(e).not.toBeNull();
    expect(e!.code).toBe('23503');
    expect(e!.message).toContain('foreign key');
    expect(e!.hint).toContain('project_domain_mappings_draft_lock');
    expect({schema:e!.schema,table:e!.table,constraint:e!.constraint}).toEqual({schema:'public',table:'project_domain_mappings',constraint:await fkToProjects('public.project_domain_mappings')});
    expect(await mappings(ghost)).toBe(0);
    await rolledBack(h.operator,async tx=>{
      await tx.query("SET LOCAL lock_timeout = '1234ms'");
      const show=async()=>(await tx.query<{lock_timeout:string}>('SHOW lock_timeout')).rows[0].lock_timeout;
      expect(await show()).toBe('1234ms');
      await mapIn(tx,ids.sales,'XECA',1);
      expect(await show()).toBe('1234ms');
    });
    expect(await mappings(ids.sales)).toBe(0);
  });

  // ---- Class sweep F1: the decision table holds a confirmation to the same rule at the moment it is written ----
  test('P1 a confirmed decision of a project that is IBS_HI is refused LTZ01 when it is written; a rejection is stored',async()=>{
    const draft=(await insertDraft(h.operator)).rows[0].id;
    await mapDomain(h,ids.sales,'IBS_HI',1);
    // the operational login
    const e=await refusal(insertDecision(h.operator,draft));
    expect(e).not.toBeNull();
    expect(e!.code).toBe(LTZ);
    expect(e!.message).toBe(DECISION_MESSAGE);
    expect(await decisions(draft)).toBe(0);
    // the runtime role in its scope (the role decide writes as)
    const r=await refusal(asRuntime(pm.id,S,tx=>insertDecision(tx,draft)));
    expect(r).not.toBeNull();
    expect(r!.code).toBe(LTZ);
    expect(r!.message).toBe(DECISION_MESSAGE);
    expect(await decisions(draft)).toBe(0);
    // a rejection confirms nothing and is stored
    expect(await refusal(asRuntime(pm.id,S,tx=>insertDecision(tx,draft,{result:'rejected',reason:'Lý do đủ dài'})))).toBeNull();
    expect(await decisions(draft)).toBe(1);
  });

  test('P2 the decision guard binds only confirmations of a READ COMMITTED transaction; a confirmation for a (tenant, project) pair with no draft is answered by the guard of 021 first',async()=>{
    const draft=(await insertDraft(h.operator)).rows[0].id;
    const repeatable=(over:R)=>refusal(h.operator.transaction(async tx=>{
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await insertDecision(tx,draft,over);
      throw new Error('stored, rolled back on purpose');
    }));
    const c=await repeatable({});
    expect(c?.code).toBe('LTZ02');
    expect(c?.message).toBe('A draft is confirmed in a READ COMMITTED transaction');
    // a rejection is not held, at any isolation level: it reaches the end and is rolled back by the test itself
    expect((await repeatable({result:'rejected',reason:'Lý do đủ dài'}))?.message).toBe('stored, rolled back on purpose');
    expect(await decisions(draft)).toBe(0);
    // a pair that does not exist: draft_decisions_guard (021) fires first by name and finds no draft of that project
    const ghost=await refusal(insertDecision(h.operator,draft,{project_id:randomUUID()}));
    expect(ghost).not.toBeNull();
    expect(ghost!.code).toBe('P0001');
    expect(ghost!.message).toBe('A decision names a draft of its own project');
    expect(ghost!.where).toContain('draft_decisions_guard');
    expect(ghost!.where).not.toContain('draft_decisions_pointer_only_guard');
    expect(await decisions(draft)).toBe(0);
  });

  test('P3 a decision about a draft outside the caller\'s scope is answered by draft_decisions_guard, whatever the label of the project',async()=>{
    const draft=(await insertDraft(h.operator,{project_id:ids.transport})).rows[0].id;
    const outside=()=>refusal(asRuntime(pm.id,[ids.sales],tx=>insertDecision(tx,draft,{project_id:ids.transport})));
    const unmapped=await outside();
    await mapDomain(h,ids.transport,'IBS_HI',1);
    const ibs=await outside();
    expect(unmapped).not.toBeNull();
    expect(ibs).not.toBeNull();
    expect(answer(ibs)).toEqual(answer(unmapped));
    expect(ibs!.code).not.toBe(LTZ);
    expect(unmapped!.code).not.toBe(LTZ);
    expect(await decisions(draft)).toBe(0);
  });

  // Native only (G23, G24, G27, N3-N6): each needs two connections or more; PGlite has one.
  test.skipIf(!native)('G23 a draft insert waits for an uncommitted mapping of its project and then reads it: refused LTZ01 when the mapping commits IBS_HI, stored when the mapping is rolled back',async()=>{
    const gate=new Error('mapping rolled back on purpose');
    const attempt=async(project:string,end:'commit'|'rollback')=>{
      const held=latch(),opened=latch();
      const writer=h.operator.transaction(async tx=>{
        await mapIn(tx,project,'IBS_HI',1);
        opened.open();
        await held.promise;
        if(end==='rollback') throw gate;
      }).catch(e=>{if(e!==gate) throw e;});
      await opened.promise;
      const before=await count();
      const draft=aiInsert({project_id:project},{projects:[project]});
      try {
        expect(await blockedOrSettled(draft)).toBe('blocked');
      } finally {
        held.open();
        await writer;
      }
      return {e:await draft,before};
    };
    const refused=await attempt(ids.transport,'commit');
    expect(refused.e).not.toBeNull();
    expect(refused.e!.code).toBe(LTZ);
    expect(await count()).toBe(refused.before);
    const stored=await attempt(sameBuProject,'rollback');
    expect(stored.e).toBeNull();
    expect(await count()).toBe(stored.before+1);
  });

  test.skipIf(!native)('G24 a mapping insert waits for an open draft insert of its project: the draft is stored first, the mapping commits after it, and the next draft is refused',async()=>{
    const held=latch(),opened=latch();
    const writer=h.operator.transaction(async tx=>{
      await tx.query('SET LOCAL ROLE libetech_ai');
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.ai_principal_id',$3,true)",[ids.tenant,ids.transport,AI]);
      await insertDraft(tx,{project_id:ids.transport});
      opened.open();
      await held.promise;
    });
    let mapping:Promise<void>|undefined;
    try {
      await opened.promise;
      mapping=mapDomain(h,ids.transport,'IBS_HI',1);
      expect(await blockedOrSettled(mapping)).toBe('blocked');
      // another project is not waited for
      await mapDomain(h,ids.sales,'XECA',1);
    } finally {
      held.open();
      await writer;
    }
    await mapping;
    expect(await count()).toBe(1);
    expect((await rows<{domain_code:string}>('SELECT domain_code FROM public.project_domain_mappings WHERE project_id=$1 ORDER BY mapping_version DESC LIMIT 1',[ids.transport]))[0].domain_code).toBe('IBS_HI');
    expect((await aiInsert({project_id:ids.transport},{projects:[ids.transport]}))?.code).toBe(LTZ);
    expect(await count()).toBe(1);
  });

  // Native only (G27, N3-N6): each statement that may wait runs in a transaction of its own under a statement_timeout of 8 s (capped / cappedAi), below
  // the 20 s of the test: a wait without the cap of the functions shows as 57014 in an assertion on the code, never as a vitest timeout (S-3).
  test.skipIf(!native)('G27 an open draft transaction of a project holds up a mapping insert of that project for no longer than the cap: 55P03 between 4 and 9 seconds, nothing written; once the draft commits the mapping goes through and the next draft is refused',async()=>{
    // No session of the AI role can hold the lock by itself any more (G20); what it can do is keep a draft transaction open. The cap of 5 seconds in
    // the function turns that into a refusal with a name.
    const P=ids.transport;
    const before=await count();
    const one=openDraft(P);
    try {
      await one.ready;
      const t0=Date.now();
      const e=await capped(tx=>mapIn(tx,P,'IBS_HI',1));
      const elapsed=Date.now()-t0;
      expect(e).not.toBeNull();
      expect(e!.code).toBe('55P03');
      expect(elapsed).toBeGreaterThanOrEqual(4000);
      expect(elapsed).toBeLessThan(9000);
      expect(await mappings(P)).toBe(0);
    } finally {
      one.release();
      await one.done;
    }
    expect(await count()).toBe(before+1);
    expect(await capped(tx=>mapIn(tx,P,'IBS_HI',1))).toBeNull();
    expect((await aiInsert({project_id:P},{projects:[P]}))?.code).toBe(LTZ);
    expect(await count()).toBe(before+1);
  },20000);

  test.skipIf(!native)('N3 a draft of a project row that the statement cannot see is refused 23503 at that row, at once, even when the project and its IBS_HI mapping commit while the statement runs',async()=>{
    // Gap B-1 of the database review: without the refusal the first row passes unseen and the foreign key, checked at the end of the statement, finds the
    // project committed meanwhile. The second row is computed slowly so that the statement would still run when A commits.
    const fresh=randomUUID();
    const held=latch(),opened=latch();
    const a=h.operator.transaction(async tx=>{
      await tx.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)',[fresh,ids.tenant,'Dự án mới mẫu','BU mẫu']);
      await mapIn(tx,fresh,'IBS_HI',1);
      opened.open();
      await held.promise;
    });
    const before=await count();
    let e:Refusal=null,elapsed=0;
    try {
      await Promise.race([opened.promise,a]);
      const v=draftVals(),keys=Object.keys(v),own=keys.filter(k=>!['project_id','entity_id','dedupe_key','model_version'].includes(k));
      const expr=(k:string)=>k==='project_id'?'u.project_id':k==='entity_id'?'gen_random_uuid()':k==='dedupe_key'?"'draft-'||gen_random_uuid()::text"
        :k==='model_version'?'(SELECT \'synthetic-model\'::text FROM pg_sleep(u.pause))':`$${own.indexOf(k)+1}::${CAST[k]??'text'}`;
      const t0=Date.now();
      const b=cappedAi(tx=>tx.query(`INSERT INTO intelligence.ai_drafts(${keys.join(',')}) SELECT ${keys.map(expr).join(',')}
        FROM (VALUES ($${own.length+1}::uuid,0::float8),($${own.length+2}::uuid,1.5::float8)) u(project_id,pause)`,[...own.map(k=>v[k]),fresh,ids.sales]),[fresh,ids.sales])
        .then(r=>{elapsed=Date.now()-t0;return r;});
      // A commits while B would still be computing its second row
      await Promise.race([b,new Promise(r=>setTimeout(r,500))]);
      held.open();
      await a;
      e=await b;
    } finally {
      held.open();
      await a;
    }
    expect(e).not.toBeNull();
    expect(e!.code).toBe('23503');
    expect(e!.hint).toContain('ai_drafts_pointer_only_guard');
    expect(elapsed).toBeLessThan(1000);
    expect(await count()).toBe(before);
    // committed now: the mapping is seen, and a single-row draft of the new project is refused
    expect((await aiInsert({project_id:fresh},{projects:[fresh]}))?.code).toBe(LTZ);
    expect(await count()).toBe(before);
    // the project and its mapping are removed by the reset of afterEach (TRUNCATE projects … CASCADE), like the rows of G23 and G24
  },20000);

  test.skipIf(!native)('N4 waiters are served in order of arrival: a mapping insert that waits for an open draft is not overtaken by a draft that comes after it',async()=>{
    const P=ids.transport;
    const before=await count();
    const one=openDraft(P);
    let mapping:Promise<Refusal>|undefined,late:Promise<Refusal>|undefined;
    try {
      await one.ready;
      mapping=capped(tx=>mapIn(tx,P,'IBS_HI',1));
      await waitForBlocked(h,1);
      late=cappedAi(tx=>insertDraft(tx,{project_id:P}),[P]);
      await waitForBlocked(h,2);
    } finally {
      one.release();
      await one.done;
    }
    expect(await mapping).toBeNull();
    const e=await late;
    expect(e).not.toBeNull();
    expect(e!.code).toBe(LTZ);
    expect(await count()).toBe(before+1);
  },20000);

  test.skipIf(!native)('N5 what an open draft transaction holds up: an UPDATE of the project row waits (55P03 under a lock_timeout of 500 ms); the lock of a foreign-key check of any other table does not',async()=>{
    const P=ids.transport;
    const one=openDraft(P);
    try {
      await one.ready;
      await rolledBack(h.operator,async tx=>{
        await tx.query("SET LOCAL statement_timeout = '8s'");
        await tx.query("SET LOCAL lock_timeout = '500ms'");
        await tx.query('SAVEPOINT u');
        const e=await refusal(tx.query('UPDATE public.projects SET updated_at = updated_at WHERE id = $1',[P]));
        await tx.query('ROLLBACK TO SAVEPOINT u');
        expect(e).not.toBeNull();
        expect(e!.code).toBe('55P03');
        expect(await refusal(tx.query('SELECT 1 FROM public.projects WHERE id = $1 FOR KEY SHARE NOWAIT',[P]))).toBeNull();
      });
    } finally {
      one.release();
      await one.done;
    }
  },20000);

  test.skipIf(!native)('N6 the old advisory key decides nothing: a session that holds it does not delay a mapping insert of its project nor a draft insert of another project',async()=>{
    const P=ids.transport;
    const held=latch(),opened=latch();
    let unlocked:boolean|null=null;
    const holder=h.operator.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_lock($1::int, hashtext($2::text))',[NS,P]);
      try {
        opened.open();
        await held.promise;
      } finally {
        unlocked=(await tx.query<{u:boolean}>('SELECT pg_advisory_unlock($1::int, hashtext($2::text)) u',[NS,P])).rows[0].u;
      }
    });
    const before=await count();
    let mapped:Refusal=null,drafted:Refusal=null,tMap=0,tDraft=0;
    try {
      await Promise.race([opened.promise,holder]);
      let t0=Date.now();
      mapped=await capped(tx=>mapIn(tx,P,'IBS_HI',1));
      tMap=Date.now()-t0;
      t0=Date.now();
      drafted=await cappedAi(tx=>insertDraft(tx,{project_id:ids.sales}),[ids.sales]);
      tDraft=Date.now()-t0;
    } finally {
      held.open();
      await holder;
    }
    expect(mapped).toBeNull();
    expect(tMap).toBeLessThan(1000);
    expect(drafted).toBeNull();
    expect(tDraft).toBeLessThan(1000);
    expect(await mappings(P)).toBe(1);
    expect(await count()).toBe(before+1);
    // the session-level key is released before its connection goes back to the pool
    expect(unlocked).toBe(true);
    expect((await rows<{n:number}>("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND classid=$1",[NS]))[0].n).toBe(0);
  },20000);

  test.skipIf(!native)('N7 the ordinary contention path: a second draft of a project waits for an open draft transaction of that project and is then stored',async()=>{
    const P=ids.transport;
    const before=await count();
    const one=openDraft(P);
    let second:Promise<Refusal>|undefined;
    try {
      await one.ready;
      second=cappedAi(tx=>insertDraft(tx,{project_id:P}),[P]);
      await waitForBlocked(h,1);
    } finally {
      one.release();
      await one.done;
    }
    expect(await second).toBeNull();
    expect(await count()).toBe(before+2);
  },20000);

  test.skipIf(!native)('P4 a confirmation waits for an uncommitted IBS_HI mapping of its project and is then refused LTZ01; when the mapping is rolled back it is stored',async()=>{
    const gate=new Error('mapping rolled back on purpose');
    const attempt=async(project:string,end:'commit'|'rollback')=>{
      const draft=(await insertDraft(h.operator,{project_id:project})).rows[0].id;
      const held=latch(),opened=latch();
      const writer=h.operator.transaction(async tx=>{
        await mapIn(tx,project,'IBS_HI',1);
        opened.open();
        await held.promise;
        if(end==='rollback') throw gate;
      }).catch(e=>{if(e!==gate) throw e;});
      let confirm:Promise<Refusal>|undefined;
      try {
        await Promise.race([opened.promise,writer]);
        confirm=capped(tx=>insertDecision(tx,draft,{project_id:project}));
        await waitForBlocked(h,1);
      } finally {
        held.open();
        await writer;
      }
      return {e:await confirm,draft};
    };
    const refused=await attempt(ids.transport,'commit');
    expect(refused.e).not.toBeNull();
    expect(refused.e!.code).toBe(LTZ);
    expect(refused.e!.message).toBe(DECISION_MESSAGE);
    expect(await decisions(refused.draft)).toBe(0);
    const stored=await attempt(sameBuProject,'rollback');
    expect(stored.e).toBeNull();
    expect(await decisions(stored.draft)).toBe(1);
  },20000);

  test.skipIf(!native)('P5 a mapping insert waits for an open confirmation of its project: the decision is stored first and the mapping after it',async()=>{
    const P=ids.transport;
    const draft=(await insertDraft(h.operator,{project_id:P})).rows[0].id;
    const held=latch(),opened=latch();
    const holder=h.operator.transaction(async tx=>{
      await insertDecision(tx,draft,{project_id:P});
      opened.open();
      await held.promise;
    });
    let mapping:Promise<Refusal>|undefined;
    try {
      await Promise.race([opened.promise,holder]);
      mapping=capped(tx=>mapIn(tx,P,'IBS_HI',1));
      await waitForBlocked(h,1);
    } finally {
      held.open();
      await holder;
    }
    expect(await mapping).toBeNull();
    expect(await decisions(draft)).toBe(1);
    expect(await mappings(P)).toBe(1);
  },20000);
});
