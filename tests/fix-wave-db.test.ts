import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {outsider,pm,seedSlice1} from './slice1-fixtures';
import {scoped} from '../src/server/db';
import {ids} from '../src/server/identities';
import {DocumentService} from '../src/server/documents';
import {ProjectRegistryService} from '../src/server/projects-registry';
import {syncTemplateIndex} from '../src/server/document-templates';
import {projectDocumentIndex} from '../src/server/document-projector';
import {exportDocumentsCsv} from '../src/server/document-index';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const dir=(p:string)=>path.join(process.cwd(),p);
const svc=()=>new DocumentService(h.db);
const base=(over:Record<string,unknown>={})=>({projectId:ids.sales,refCode:'DOC-FW-1',docType:'design',title:'Tài liệu đợt sửa tổng hợp',sourceType:'drive',
  canonicalUri:'https://docs.google.com/docs/fw-1',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[],...over});
const revBody=(over:Record<string,unknown>={})=>({expectedVersion:1,basedOnRevisionId:null,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
  changes:{summary:'Tóm tắt thay đổi tổng hợp',present:['Mục A'],missing:[]},sourceRefs:[],...over});
const key=(()=>{let n=0;return ()=>'fw-key-'+String(++n).padStart(6,'0');})();
const codeOf=async(p:Promise<unknown>)=>p.then(()=>null,(e:{code?:string;status?:number})=>({code:e.code,status:e.status}));
const count=async(t:string)=>(await h.operator.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
const sorted=(rows:{n:string}[])=>rows.map(r=>r.n).sort();
const tablesNew=`('project_profiles','project_channels','project_domain_mappings','registry_events','document_templates','document_records','document_revisions','document_commands')`;
async function catalog(){
  const q=async(sql:string)=>sorted((await h.operator.query<{n:string}>(sql)).rows);
  return {
    constraints:await q(`SELECT conrelid::regclass::text||'.'||conname n FROM pg_constraint WHERE conrelid::regclass::text IN ${tablesNew.replace(')',",'analytics.document_index')")}`),
    indexes:await q(`SELECT schemaname||'.'||tablename||'.'||indexname n FROM pg_indexes WHERE (schemaname='public' AND tablename IN ${tablesNew}) OR (schemaname='analytics' AND tablename='document_index')`),
    policies:await q(`SELECT schemaname||'.'||tablename||'.'||policyname n FROM pg_policies WHERE (schemaname='public' AND tablename IN ${tablesNew}) OR (schemaname='analytics' AND tablename='document_index')`),
    grants:await q(`SELECT table_schema||'.'||table_name||'.'||column_name||'.'||grantee||'.'||privilege_type n FROM information_schema.column_privileges WHERE grantee IN ('libetech_runtime','libetech_projector') AND ((table_schema='public' AND table_name IN ${tablesNew}) OR (table_schema='analytics' AND table_name='document_index'))`),
  };
}
const rollbackSql=(f:string)=>readFile(dir('migrations/rollback/'+f),'utf8');
const forwardSql=(f:string)=>readFile(dir('migrations/'+f),'utf8');
const FILES=['013_project_registry.sql','014_document_registry.sql','015_document_index_z2.sql'];

describe('item 1 rollback safety',()=>{
  test('rollback files carry no CASCADE',async()=>{
    for(const f of FILES) expect((await rollbackSql(f)).replace(/--.*$/gm,''),f).not.toMatch(/CASCADE/i);
  });
  test('an out-of-order rollback raises and changes nothing',async()=>{
    const before=await catalog();
    for(const f of ['013_project_registry.sql','014_document_registry.sql']){
      await expect(h.exec(await rollbackSql(f)),f).rejects.toThrow();
      await h.exec('ROLLBACK').catch(()=>{});
      expect(await catalog(),f).toEqual(before);
      expect((await h.operator.query("SELECT 1 FROM schema_migrations WHERE version=$1",[f.slice(0,3)])).rows,f).toHaveLength(1);
    }
    expect(await h.operator.query("SELECT to_regclass('public.document_records')::text r").then(r=>(r.rows[0] as {r:string}).r)).toBe('document_records');
  });
  test('forward → rollback 015,014,013 → forward restores an identical catalog',async()=>{
    const before=await catalog();
    expect(before.constraints.length).toBeGreaterThan(20);
    for(const f of [...FILES].reverse()) await h.exec(await rollbackSql(f));
    expect((await catalog()).policies).toEqual([]);
    for(const f of FILES) await h.exec(await forwardSql(f));
    expect(await catalog()).toEqual(before);
  });
});

describe('item 2 column-level INSERT grants',()=>{
  const docPromise=async()=>svc().register(pm,base(),key());
  type Case={table:string;cols:string;vals:(doc?:string)=>unknown[]};
  const cases:Case[]=[
    {table:'registry_events',cols:'tenant_id,project_id,entity_type,entity_id,actor_id,kind,command_key,payload',
      vals:()=>[ids.tenant,ids.sales,'project_profile','00000000-0000-4000-8000-0000000000aa',pm.id,'k','ck','{}']},
    {table:'project_profiles',cols:'tenant_id,project_id,updated_by',vals:()=>[ids.tenant,ids.sales,pm.id]},
    {table:'project_channels',cols:'tenant_id,project_id,chat_id,mode,policy_version,proposed_by',vals:()=>[ids.tenant,ids.sales,'-100123','command_reply','p1',pm.id]},
    {table:'document_records',cols:'tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by',
      vals:()=>[ids.tenant,ids.sales,'design','Tiêu đề thử nghiệm','drive','https://docs.google.com/grant-1',pm.id]},
    {table:'document_revisions',cols:'tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by',
      vals:d=>[ids.tenant,ids.sales,d,1,'https://docs.google.com/docs/fw-1','drive',pm.id]},
    {table:'document_commands',cols:'tenant_id,project_id,actor_id,command_key,request_hash',vals:()=>[ids.tenant,ids.sales,pm.id,'grant-cmd-0001','h']},
  ];
  const extras:Record<string,[string,unknown][]>={
    registry_events:[['created_at','2020-01-01T00:00:00Z'],['id','00000000-0000-4000-8000-0000000000bb']],
    project_profiles:[['created_at','2020-01-01T00:00:00Z'],['version',1]],
    project_channels:[['created_at','2020-01-01T00:00:00Z'],['version',1]],
    document_records:[['created_at','2020-01-01T00:00:00Z'],['classification','public'],['version',1]],
    document_revisions:[['created_at','2020-01-01T00:00:00Z'],['quality_score',1],['ingested_at','2020-01-01T00:00:00Z'],['hash_verification','self_declared']],
    document_commands:[['created_at','2020-01-01T00:00:00Z']],
  };
  for(const c of cases) test(`${c.table}: the columns the service writes work, protected columns are denied`,async()=>{
    const d=c.table==='document_revisions'?(await docPromise()).record.id:undefined;
    const ins=(cols:string,vals:unknown[])=>scoped(h.db,pm,tx=>tx.query(`INSERT INTO ${c.table}(${cols}) VALUES(${vals.map((_,i)=>'$'+(i+1)).join(',')})`,vals));
    for(const [col,val] of extras[c.table])
      await expect(ins(`${c.cols},${col}`,[...c.vals(d),val]),`${c.table}.${col}`).rejects.toThrow(/permission denied/);
    await expect(ins(c.cols,c.vals(d)),c.table).resolves.toBeTruthy();
  });
  test('the revision service insert leaves quality_score and hash_verification to the defaults',async()=>{
    const d=await docPromise();
    await svc().proposeRevision(pm,d.record.id,revBody(),key());
    const r=(await h.operator.query<{quality_score:string;hash_verification:string}>('SELECT quality_score,hash_verification FROM document_revisions')).rows[0];
    expect(Number(r.quality_score)).toBe(0);expect(r.hash_verification).toBe('self_declared');
  });
});

describe('item 3 FK index',()=>{
  test('document_revisions has a (tenant_id, project_id, created_at DESC) index',async()=>{
    const defs=(await h.operator.query<{indexdef:string}>("SELECT indexdef FROM pg_indexes WHERE tablename='document_revisions'")).rows.map(r=>r.indexdef);
    expect(defs.some(d=>/\(tenant_id, project_id, created_at DESC\)/.test(d))).toBe(true);
  });
});

describe('item 4 template index script',()=>{
  const run=(args:string[],env:Record<string,string>)=>spawnSync('npx',['tsx','scripts/sync-document-templates.ts',...args],{cwd:process.cwd(),encoding:'utf8',
    env:{PATH:process.env.PATH??'',HOME:process.env.HOME??'',...env} as unknown as NodeJS.ProcessEnv});
  test('refuses without an operator URL or with a bad tenant id, before any connection',()=>{
    const a=run([ids.tenant],{});
    expect(a.status).not.toBe(0);expect(a.stderr).toMatch(/MIGRATION_DATABASE_URL/);
    const b=run(['not-a-uuid'],{MIGRATION_DATABASE_URL:'postgres://invalid.invalid:1/none'});
    expect(b.status).not.toBe(0);expect(b.stderr).toMatch(/UUID|tenant/i);
    expect(a.stdout+b.stdout+a.stderr+b.stderr).not.toContain('invalid.invalid');
  });
  test('source only syncs inside a transaction and prints just tenantId and inserted',async()=>{
    const s=await readFile(dir('scripts/sync-document-templates.ts'),'utf8');
    expect(s).toMatch(/syncTemplateIndex/);expect(s).toMatch(/transaction/);expect(s).toMatch(/tenantId,\s*inserted/);
  });
});

describe('item 5 UPDATE isolation',()=>{
  const ids2=ids.transport;
  async function seed(){
    const a=await svc().register(pm,base({canonicalUri:'https://docs.google.com/docs/iso-a'}),key());
    const b=await svc().register(pm,base({projectId:ids2,refCode:'DOC-FW-2',canonicalUri:'https://docs.google.com/docs/iso-b'}),key());
    for(const p of [ids.sales,ids2]) await h.operator.query("INSERT INTO project_profiles(tenant_id,project_id,updated_by,objective) VALUES($1,$2,$3,'orig')",[ids.tenant,p,pm.id]);
    return {a,b};
  }
  const asA={...pm,projectIds:[ids.sales]};
  const upd=(p:typeof pm,sql:string,params:unknown[]=[])=>scoped(h.db,p,async tx=>{await tx.query(sql,params);});
  const affected=(p:typeof pm,sql:string,params:unknown[]=[])=>scoped(h.db,p,async tx=>(await tx.query<{id:string}>(sql+' RETURNING id',params)).rows.length);
  test('project A cannot update project B rows (0 rows, unchanged)',async()=>{
    const {b}=await seed();
    expect(await affected(asA,"UPDATE project_profiles SET objective='hacked' WHERE project_id=$1",[ids2])).toBe(0);
    expect((await h.operator.query<{objective:string}>('SELECT objective FROM project_profiles WHERE project_id=$1',[ids2])).rows[0].objective).toBe('orig');
    expect(await affected(asA,"UPDATE document_records SET version=version+1 WHERE id=$1",[b.record.id])).toBe(0);
    expect((await h.operator.query<{version:number}>('SELECT version FROM document_records WHERE id=$1',[b.record.id])).rows[0].version).toBe(1);
    await scoped(h.db,{...pm,projectIds:[ids2]},tx=>tx.query("INSERT INTO document_commands(tenant_id,project_id,actor_id,command_key,request_hash) VALUES($1,$2,$3,'iso-cmd-b-0001','h')",[ids.tenant,ids2,pm.id]));
    expect(await affected(asA,"UPDATE document_commands SET response='{}'::jsonb WHERE command_key='iso-cmd-b-0001'")).toBe(0);
    expect((await h.operator.query<{response:unknown}>("SELECT response FROM document_commands WHERE command_key='iso-cmd-b-0001'")).rows[0].response).toBeNull();
  });
  test('a tenant outsider updates nothing',async()=>{
    const {a}=await seed();
    expect(await affected(outsider,"UPDATE project_profiles SET objective='hacked'")).toBe(0);
    expect(await affected(outsider,"UPDATE document_records SET version=version+1 WHERE id=$1",[a.record.id])).toBe(0);
    expect(await affected(outsider,"UPDATE document_commands SET response='{}'::jsonb")).toBe(0);
    expect((await h.operator.query<{objective:string}>('SELECT objective FROM project_profiles')).rows.every(r=>r.objective==='orig')).toBe(true);
  });
  test('moving a row to another project or tenant is rejected',async()=>{
    const {a}=await seed();
    const both={...pm,projectIds:[ids.sales,ids2]};
    await expect(upd(both,'UPDATE project_profiles SET project_id=$1 WHERE project_id=$2',[ids2,ids.sales])).rejects.toThrow();
    await expect(upd(both,'UPDATE project_profiles SET tenant_id=$1 WHERE project_id=$2',[ids.otherTenant,ids.sales])).rejects.toThrow();
    await expect(upd(both,'UPDATE document_records SET project_id=$1 WHERE id=$2',[ids2,a.record.id])).rejects.toThrow();
    await expect(upd(both,'UPDATE document_records SET tenant_id=$1 WHERE id=$2',[ids.otherTenant,a.record.id])).rejects.toThrow();
    await expect(upd(both,"UPDATE document_commands SET project_id=$1 WHERE command_key=$2",[ids2,'fw-none'])).rejects.toThrow();
    await scoped(h.db,asA,tx=>tx.query("INSERT INTO document_commands(tenant_id,project_id,actor_id,command_key,request_hash) VALUES($1,$2,$3,'iso-move-0001','h')",[ids.tenant,ids.sales,pm.id]));
    await expect(upd(both,"UPDATE document_commands SET project_id=$1 WHERE command_key='iso-move-0001'",[ids2])).rejects.toThrow();
    await expect(upd(both,"UPDATE document_commands SET tenant_id=$1 WHERE command_key='iso-move-0001'",[ids.otherTenant])).rejects.toThrow();
    expect((await h.operator.query<{project_id:string}>('SELECT project_id FROM project_profiles ORDER BY project_id')).rows.map(r=>r.project_id).sort()).toEqual([ids.sales,ids2].sort());
  });
});

describe('item 6 repoUrl',()=>{
  test('an invalid repoUrl is a ZodError, never a thrown TypeError',async()=>{
    const s=new ProjectRegistryService(h.db);
    const input=(repoUrl:unknown)=>({expectedVersion:0,objective:'Mục tiêu mẫu',ownerBu:'BU mẫu',pmLabel:'PM mẫu',vaultPointer:null,repoUrl,status:'proposed'});
    for(const bad of ['abc','','http://example.com/r','https://u:p@example.com/r',42])
      expect(await s.saveProfile(pm,ids.sales,input(bad),key()).catch(e=>e),String(bad)).toBeInstanceOf(ZodError);
    expect((await s.saveProfile(pm,ids.sales,input('https://example.com/r'),key())).repo_url).toBe('https://example.com/r');
  });
});

describe('item 7 source link hardening',()=>{
  test('DB refuses a non-https canonical_uri and revision source_id',async()=>{
    const d=await svc().register(pm,base(),key());
    await expect(h.operator.query("UPDATE document_records SET canonical_uri='http://example.com/x' WHERE id=$1",[d.record.id])).rejects.toThrow(/check/i);
    await expect(h.operator.query("INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by) VALUES($1,$2,$3,1,'ftp://x','drive',$4)",
      [ids.tenant,ids.sales,d.record.id,pm.id])).rejects.toThrow(/check/i);
  });
  const names=['token','access_token','id_token','auth','authorization','key','api_key','apikey','sig','signature','x-amz-signature','x-amz-credential','x-amz-security-token','x-goog-signature','x-goog-credential','code','password','secret'];
  test('registration refuses a credential-bearing query parameter (any case) with a Vietnamese message',async()=>{
    for(const n of names)
      for(const spelled of [n,n.toUpperCase()]){
        const e=await svc().register(pm,base({canonicalUri:`https://docs.google.com/d?x=1&${spelled}=abc`}),key()).catch(x=>x);
        expect(e,spelled).toBeInstanceOf(ZodError);
        expect((e as ZodError).issues[0].message,spelled).toMatch(/tham số/);
      }
    expect(await count('document_records')).toBe(0);
    await expect(svc().register(pm,base({canonicalUri:'https://docs.google.com/d?page=2&q=ok'}),key())).resolves.toBeTruthy();
  });
  test('url source refs are checked and normalised like canonicalUri',async()=>{
    const d=await svc().register(pm,base(),key());
    for(const n of ['sig','X-Amz-Signature','token'])
      expect(await svc().proposeRevision(pm,d.record.id,revBody({sourceRefs:[{kind:'url',label:'l',value:`https://example.com/a?${n}=1`}]}),key()).catch(e=>e),n).toBeInstanceOf(ZodError);
    const ok=await svc().proposeRevision(pm,d.record.id,revBody({sourceRefs:[{kind:'url',label:'l',value:'  https://EXAMPLE.com/a b  '}]}),key());
    expect(ok.revisions[0].source_refs[0].value).toBe('https://example.com/a%20b');
  });
  test('openSource re-validates the stored URI and returns the host',async()=>{
    const d=await svc().register(pm,base({canonicalUri:'https://docs.google.com/d?x=1'}),key());
    expect(await svc().openSource(pm,d.record.id)).toMatchObject({uri:'https://docs.google.com/d?x=1',host:'docs.google.com',sourceType:'drive'});
    for(const bad of ['https://docs.google.com/d?token=zzz','https://user:pw@docs.google.com/d','https://docs.google.com/d?Sig=1']){
      await h.operator.query('UPDATE document_records SET canonical_uri=$1 WHERE id=$2',[bad,d.record.id]);
      expect(await codeOf(svc().openSource(pm,d.record.id)),bad).toEqual({code:'SOURCE_UNAVAILABLE',status:409});
    }
  });
});

describe('round 1: fragment, path and normalised secret names',()=>{
  const bad=['https://docs.google.com/d#access_token=x','https://docs.google.com/d#?token=x','https://docs.google.com/doc;token=x','https://docs.google.com/d?token[]=x',
    'https://docs.google.com/d?resourcekey=x','https://docs.google.com/d?X-Goog-Credential=x','https://docs.google.com/d?%74oken=x','https://docs.google.com/a;v=1;sig=x/b',
    'https://docs.google.com/d?session_id=x','https://docs.google.com/d#x=1&client-secret=y'];
  test('registration and url refs reject them; a normal Google Docs link is accepted',async()=>{
    for(const u of bad) expect(await svc().register(pm,base({canonicalUri:u}),key()).catch(e=>e),u).toBeInstanceOf(ZodError);
    const d=await svc().register(pm,base({canonicalUri:'https://docs.google.com/document/d/abc/edit#heading=h.1'}),key());
    for(const u of bad) expect(await svc().proposeRevision(pm,d.record.id,revBody({sourceRefs:[{kind:'url',label:'l',value:u}]}),key()).catch(e=>e),u).toBeInstanceOf(ZodError);
    expect(d.record.canonical_uri).toBe('https://docs.google.com/document/d/abc/edit#heading=h.1');
  });
  test('openSource on a stored bad URI is SOURCE_UNAVAILABLE without the uri',async()=>{
    const d=await svc().register(pm,base(),key());
    for(const u of bad){
      await h.operator.query('UPDATE document_records SET canonical_uri=$1 WHERE id=$2',[u,d.record.id]);
      const e=await svc().openSource(pm,d.record.id).catch(x=>x);
      expect(e,u).toMatchObject({code:'SOURCE_UNAVAILABLE',status:409});
      expect(JSON.stringify(e)+String(e.message),u).not.toContain('docs.google.com');
    }
  });
  test('template_version is ordered numerically (0.10.0 beats 0.9.0)',async()=>{
    await h.exec('TRUNCATE document_templates CASCADE');
    await h.operator.transaction(async tx=>{
      for(const v of ['0.10.0','0.9.0']) await tx.query("INSERT INTO document_templates(tenant_id,code,template_version,doc_type,title,path,content_hash) VALUES($1,'T3',$2,'design','t','p',$3)",[ids.tenant,v,'a'.repeat(64)]);
    });
    const d=await svc().register(pm,base({templateCode:'T3'}),key());
    expect((await h.operator.query<{template_version:string}>('SELECT t.template_version FROM document_records r JOIN document_templates t ON t.id=r.template_id WHERE r.id=$1',[d.record.id])).rows[0].template_version).toBe('0.10.0');
  });
});

describe('round 2',()=>{
  test('plain heading anchors are accepted; fragments with parameters are still checked',async()=>{
    for(const f of ['session-management','token-handling','authorization','tokens']){
      const u='https://docs.google.com/guide#'+f;
      expect((await svc().register(pm,base({canonicalUri:u,refCode:'DOC-A-'+f.length}),key())).record.canonical_uri,u).toBe(u);
    }
    for(const u of ['https://docs.google.com/g#access_token=x','https://docs.google.com/g#?token=x','https://docs.google.com/g#a=1&session=2'])
      expect(await svc().register(pm,base({canonicalUri:u}),key()).catch(e=>e),u).toBeInstanceOf(ZodError);
  });
  test('percent-encoded fragment parameters are decoded and checked; a malformed escape is a validation error',async()=>{
    for(const f of ['access_token%3Dxyz','x%26token%3Dy','%E0%A4%A']){
      const u='https://docs.google.com/g#'+f;
      const e=await svc().register(pm,base({canonicalUri:u}),key()).catch(x=>x);
      expect(e,u).toBeInstanceOf(ZodError);
      expect((e as ZodError).issues[0].message,u).toMatch(/tham số/);
    }
    for(const f of ['session-management','token-handling','authorization','tokens','heading=h.1'])
      await expect(svc().register(pm,base({canonicalUri:'https://docs.google.com/g#'+f,refCode:'DOC-B-'+f.length}),key()),f).resolves.toBeTruthy();
  });
  test('template_version must be dotted digits',async()=>{
    const ins=(v:string)=>h.operator.query("INSERT INTO document_templates(tenant_id,code,template_version,doc_type,title,path,content_hash) VALUES($1,'T3',$2,'design','t','p',$3)",[ids.tenant,v,'a'.repeat(64)]);
    for(const v of ['v1','1.','1..2','1.0-rc','']) await expect(ins(v),v).rejects.toThrow(/check/i);
    await h.exec('TRUNCATE document_templates CASCADE');
    await expect(ins('1.10.0')).resolves.toBeTruthy();
  });
});

describe('item 8 toChannel',()=>{
  test('registry returns the stored state, approver and enabled_from',async()=>{
    await h.operator.query("INSERT INTO project_channels(tenant_id,project_id,chat_id,mode,state,approver_id,enabled_from,policy_version,proposed_by) VALUES($1,$2,'-100777','active','active',$3,'2026-01-02T03:04:05Z','p1',$3)",[ids.tenant,ids.sales,pm.id]);
    const r=await new ProjectRegistryService(h.db).registry(pm,ids.sales);
    expect(r.channels[0]).toMatchObject({state:'active',approver_id:pm.id,enabled_from:'2026-01-02T03:04:05.000Z'});
  });
});

describe('item 9 chat and topic caps',()=>{
  const ch=(over:Record<string,unknown>)=>({expectedVersion:1,chatId:'-100123',topicId:'',mode:'command_reply',policyVersion:'p1',...over});
  test('chatId and topicId are length-capped',async()=>{
    const s=new ProjectRegistryService(h.db);
    await s.saveProfile(pm,ids.sales,{expectedVersion:0,objective:'Mục tiêu mẫu',ownerBu:'BU mẫu',pmLabel:'PM mẫu',vaultPointer:null,repoUrl:null,status:'proposed'},key());
    for(const bad of [{chatId:'-'+'1'.repeat(20)},{chatId:'-0'},{chatId:'100'},{topicId:'1'.repeat(11)},{topicId:'abc'},{topicId:'-1'}])
      expect(await s.proposeChannel(pm,ids.sales,ch(bad),key()).catch(e=>e),JSON.stringify(bad)).toBeInstanceOf(ZodError);
    await expect(s.proposeChannel(pm,ids.sales,ch({expectedVersion:1,chatId:'-'+'1'.repeat(19),topicId:'1'.repeat(10)}),key())).resolves.toBeTruthy();
    await expect(s.proposeChannel(pm,ids.sales,ch({expectedVersion:2,chatId:'-100124',topicId:''}),key())).resolves.toBeTruthy();
  });
});

describe('item 10 revision event versions',()=>{
  test('revision_proposed payload carries versionBefore and versionAfter',async()=>{
    const d=await svc().register(pm,base(),key());
    const r=await svc().proposeRevision(pm,d.record.id,revBody(),key());
    const e=r.events.find(x=>x.kind==='revision_proposed')!;
    expect(e.payload).toMatchObject({versionBefore:1,versionAfter:2});
  });
});

describe('item 13 deterministic template choice',()=>{
  test('same created_at: the higher template_version wins whatever the id order',async()=>{
    await h.operator.transaction(tx=>syncTemplateIndex(tx,ids.tenant));
    await h.exec('TRUNCATE document_templates CASCADE');
    const hash='a'.repeat(64);
    const add=(id:string,v:string)=>h.operator.query("INSERT INTO document_templates(id,tenant_id,code,template_version,doc_type,title,path,content_hash,created_at) VALUES($1,$2,'T3',$3,'design','t','p',$4,'2026-01-01T00:00:00Z')",[id,ids.tenant,v,hash]);
    await add('00000000-0000-4000-8000-000000000001','1');
    await add('ffffffff-ffff-4fff-8fff-ffffffffffff','2');
    await add('00000000-0000-4000-8000-000000000002','0');
    const d=await svc().register(pm,base({templateCode:'T3'}),key());
    const t=(await h.operator.query<{template_version:string}>('SELECT t.template_version FROM document_records r JOIN document_templates t ON t.id=r.template_id WHERE r.id=$1',[d.record.id])).rows[0];
    expect(t.template_version).toBe('2');
  });
});

describe('item 14 CSV export cap',()=>{
  test('more than 5000 rows is EXPORT_TOO_LARGE',async()=>{
    await h.operator.query(`INSERT INTO document_records(tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by)
      SELECT $1,$2,'other','Tài liệu mẫu '||g,'drive','https://docs.google.com/bulk/'||g,$3 FROM generate_series(1,5001) g`,[ids.tenant,ids.sales,pm.id]);
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    expect(await count('analytics.document_index')).toBe(5001);
    const e=await exportDocumentsCsv(h.db,pm,ids.sales).catch(x=>x);
    expect(e).toMatchObject({code:'EXPORT_TOO_LARGE',status:422,message:'Danh sách quá dài để xuất một lần (trên 5000 tài liệu). Liên hệ quản trị để xuất theo đợt.'});
  },60000);
});

describe('item 15 projector overlap',()=>{
  test('an older record version never overwrites a newer index row',async()=>{
    await h.operator.transaction(tx=>syncTemplateIndex(tx,ids.tenant));
    const d=await svc().register(pm,base({templateCode:'T3'}),key());
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    await h.operator.query("UPDATE analytics.document_index SET record_version=5,title='MỚI HƠN' WHERE document_id=$1",[d.record.id]);
    const before=(await h.operator.query<{projected_at:unknown}>('SELECT projected_at FROM analytics.document_index')).rows[0].projected_at;
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    const row=(await h.operator.query<{title:string;record_version:number;projected_at:unknown}>('SELECT title,record_version,projected_at FROM analytics.document_index')).rows[0];
    expect(row).toMatchObject({title:'MỚI HƠN',record_version:5});
    expect(new Date(row.projected_at as string).getTime()).toBe(new Date(before as string).getTime());
  });
  test('a newer record version still updates the row',async()=>{
    const d=await svc().register(pm,base(),key());
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    await svc().proposeRevision(pm,d.record.id,revBody(),key());
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    expect((await h.operator.query<{record_version:number;latest_revision_no:number}>('SELECT record_version,latest_revision_no FROM analytics.document_index')).rows[0]).toMatchObject({record_version:2,latest_revision_no:1});
  });
});
