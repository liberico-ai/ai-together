import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {scoped} from '../src/server/db';
import {ids} from '../src/server/identities';
import {ZodError} from 'zod';
import {DocumentService} from '../src/server/documents';
import {syncTemplateIndex,templateManifest} from '../src/server/document-templates';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const base=()=>({projectId:ids.sales,refCode:'DOC-DEMO-1',docType:'design',title:'Tài liệu tổng hợp số một',templateCode:'T3',sourceType:'drive',
  canonicalUri:'https://docs.google.com/docs/demo-1',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[]});
const count=async(t:string)=>(await h.operator.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
const svc=()=>new DocumentService(h.db);
const codeOf=async(p:Promise<unknown>)=>p.then(()=>null,(e:{code?:string;status?:number})=>({code:e.code,status:e.status}));
async function templates(){
  for(const tenant of [ids.tenant,ids.otherTenant]) await h.operator.transaction(tx=>syncTemplateIndex(tx,tenant));
}

describe('document registration',()=>{
  test('register creates one record with an empty approved pointer and SOURCE_NOT_FROZEN',async()=>{
    await templates();
    const d=await svc().register(pm,base(),'doc-key-0001');
    expect(d.record.version).toBe(1);
    expect(d.record.latest_revision_id).toBeNull();
    expect(d.record.approved_revision_id).toBeNull();
    expect(d.record.freeze_state).toBe('SOURCE_NOT_FROZEN');
    expect(d.record.classification).toBe('unclassified');
    expect(d.revisions).toEqual([]);
    expect(d.events.filter(e=>e.kind==='document_registered')).toHaveLength(1);
    expect(d.events).toHaveLength(1);
    const got=await svc().detail(pm,d.record.id);
    expect(got.record.id).toBe(d.record.id);
  });
  test('unknown template code is TEMPLATE_UNKNOWN',async()=>{
    await h.exec('TRUNCATE document_templates CASCADE');
    expect(await codeOf(svc().register(pm,base(),'doc-key-0002'))).toEqual({code:'TEMPLATE_UNKNOWN',status:422});
  });
  test('same key and same request replays; no second record',async()=>{
    await templates();
    const a=await svc().register(pm,base(),'doc-key-0001');
    const b=await svc().register(pm,base(),'doc-key-0001');
    expect(b.record.id).toBe(a.record.id);
    expect(await count('document_records')).toBe(1);
    expect(await count("registry_events WHERE kind='document_registered'")).toBe(1);
  });
  test('same key for a different document in the same project is IDEMPOTENCY_CONFLICT',async()=>{
    await templates();
    await svc().register(pm,base(),'doc-key-0001');
    expect(await codeOf(svc().register(pm,{...base(),canonicalUri:'https://docs.google.com/docs/other'},'doc-key-0001'))).toEqual({code:'IDEMPOTENCY_CONFLICT',status:409});
    expect(await count('document_records')).toBe(1);
  });
  test('same key reused to register in another project is IDEMPOTENCY_CONFLICT and creates nothing there',async()=>{
    await templates();
    await svc().register(pm,base(),'doc-key-0001');
    expect(await codeOf(svc().register(pm,{...base(),projectId:ids.transport,canonicalUri:'https://docs.google.com/docs/transport-1'},'doc-key-0001'))).toEqual({code:'IDEMPOTENCY_CONFLICT',status:409});
    expect(await count(`document_records WHERE project_id='${ids.transport}'`)).toBe(0);
    expect(await count('document_records')).toBe(1);
  });
  test('document operations no longer write to the shared commands table',async()=>{
    await templates();
    const before=await count('commands');
    const d=await svc().register(pm,base(),'doc-key-0001');
    await svc().proposeRevision(pm,d.record.id,{expectedVersion:1,basedOnRevisionId:null,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
      changes:{summary:'Tóm tắt thay đổi tổng hợp',present:[],missing:[]},sourceRefs:[]},'rev-key-0001');
    expect(await count('commands')).toBe(before);
    expect(await count('document_commands')).toBe(2);
  });
  test('the same source cannot be registered twice in a project',async()=>{
    await templates();
    await svc().register(pm,base(),'doc-key-0001');
    const e=await svc().register(pm,base(),'doc-key-0002').catch(x=>x);
    expect(e).toMatchObject({code:'DOCUMENT_ALREADY_REGISTERED',status:409});
    expect(await count('document_records')).toBe(1);
    expect(await count("registry_events WHERE kind='document_registered'")).toBe(1);
    const t=await svc().register(pm,{...base(),projectId:ids.transport},'doc-key-0003');
    expect(t.record.project_id).toBe(ids.transport);
    expect(JSON.stringify(e.message)).not.toContain(ids.sales);
  });
  test('malformed source pointers are rejected',async()=>{
    for(const u of ['http://example.com/a','https://user:pw@example.com/a','not a url'])
      await expect(svc().register(pm,{...base(),templateCode:undefined,canonicalUri:u},'doc-key-0004')).rejects.toBeInstanceOf(ZodError);
    const d=await svc().register(pm,{...base(),templateCode:undefined,canonicalUri:'  https://docs.google.com/docs/x  '},'doc-key-0005');
    expect(d.record.canonical_uri).toBe('https://docs.google.com/docs/x');
  });
  test('identity, approval and snapshot fields in the body are rejected',async()=>{
    for(const extra of [{tenantId:ids.tenant},{actorId:pm.id},{approvedRevisionId:pm.id},{classification:'secret'},{snapshotRef:'x'}])
      await expect(svc().register(pm,{...base(),templateCode:undefined,...extra},'doc-key-0006')).rejects.toBeInstanceOf(ZodError);
    expect(await count('document_records')).toBe(0);
  });
  test('bot, viewer and outsider cannot register',async()=>{
    const r=(p:typeof pm,projectId:string)=>svc().register(p,{...base(),templateCode:undefined,projectId,title:'Tiêu đề không được lộ ra'},'doc-key-0007');
    expect(await codeOf(r(bot,ids.transport))).toMatchObject({code:'READ_ONLY'});
    expect(await codeOf(r(viewer,ids.transport))).toMatchObject({code:'READ_ONLY'});
    expect(await codeOf(r(outsider,ids.sales))).toMatchObject({code:'SCOPE_DENIED',status:404});
    const e=await r(member,ids.transport).catch(x=>x);
    expect(e).toMatchObject({code:'SCOPE_DENIED',status:404});
    expect(e.message).toBe('Không tìm thấy tài liệu trong phạm vi được cấp.');
    expect(await count('document_records')).toBe(0);
  });
  test('detail is denied for bot and out of scope with one sentence',async()=>{
    const d=await svc().register(pm,{...base(),templateCode:undefined},'doc-key-0008');
    expect(await codeOf(svc().detail(bot,d.record.id))).toMatchObject({code:'READ_ONLY'});
    const a=await svc().detail(outsider,d.record.id).catch(x=>x);
    const b=await svc().detail(pm,'00000000-0000-4000-8000-0000000000ff').catch(x=>x);
    expect(a).toMatchObject({code:'SCOPE_DENIED',status:404});
    expect(a.message).toBe(b.message);
  });
});

describe('document tables',()=>{
  const tables=['document_records','document_revisions','document_templates'];
  test('document tables return nothing without RLS context',async()=>{
    await templates();
    await svc().register(pm,base(),'doc-key-0001');
    for(const t of tables){
      const rows=await h.db.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query(`SELECT * FROM ${t}`)).rows;});
      expect(rows,t).toHaveLength(0);
    }
  });
  test('document_commands returns nothing without RLS context and rejects another project or tenant',async()=>{
    await templates();
    await svc().register(pm,base(),'doc-key-0001');
    const rows=await h.db.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query('SELECT * FROM document_commands')).rows;});
    expect(rows).toHaveLength(0);
    const ins=(p:typeof pm,project:string,tenant:string)=>scoped(h.db,p,tx=>tx.query(
      "INSERT INTO document_commands(tenant_id,project_id,actor_id,command_key,request_hash) VALUES($1,$2,$3,'cmd-key-9999',$4)",[tenant,project,p.id,'h']));
    await expect(ins(pm,ids.sales,ids.otherTenant)).rejects.toThrow();
    await expect(ins(outsider,ids.sales,ids.tenant)).rejects.toThrow();
    await expect(ins(member,ids.transport,ids.tenant)).rejects.toThrow();
    await expect(ins(pm,ids.sales,ids.tenant)).resolves.toBeTruthy();
  });
  const rec=(project:string,tenant:string,uri:string)=>scoped(h.db,pm,tx=>tx.query(
    "INSERT INTO document_records(tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by) VALUES($1,$2,'design','Tiêu đề thử nghiệm','drive',$3,$4)",[tenant,project,uri,pm.id]));
  test('runtime cannot insert for another project or tenant',async()=>{
    await expect(rec(ids.sales,ids.otherTenant,'https://docs.google.com/t1')).rejects.toThrow();
    await expect(scoped(h.db,outsider,tx=>tx.query(
      "INSERT INTO document_records(tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by) VALUES($1,$2,'design','Tiêu đề thử nghiệm','drive','https://docs.google.com/t2',$3)",[ids.tenant,ids.sales,outsider.id]))).rejects.toThrow();
    await expect(scoped(h.db,member,tx=>tx.query(
      "INSERT INTO document_records(tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by) VALUES($1,$2,'design','Tiêu đề thử nghiệm','drive','https://docs.google.com/t3',$3)",[ids.tenant,ids.transport,member.id]))).rejects.toThrow();
    await expect(scoped(h.db,pm,tx=>tx.query(
      "INSERT INTO document_templates(tenant_id,code,template_version,doc_type,title,path,content_hash) VALUES($1,'TX','1','other','x','p',$2)",[ids.tenant,'a'.repeat(64)]))).rejects.toThrow();
    await expect(rec(ids.sales,ids.tenant,'https://docs.google.com/t4')).resolves.toBeTruthy();
    const revision=(p:typeof pm,project:string,tenant:string)=>scoped(h.db,p,async tx=>{
      const id=(await tx.query<{id:string}>("SELECT id FROM document_records LIMIT 1")).rows[0].id;
      return tx.query("INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by) VALUES($1,$2,$3,1,'https://docs.google.com/u','drive',$4)",[tenant,project,id,p.id]);
    });
    await expect(revision(pm,ids.sales,ids.otherTenant)).rejects.toThrow();
  });
  test('runtime cannot set the approved pointer, a verified hash or a snapshot',async()=>{
    const d=await (async()=>{await templates();return svc().register(pm,base(),'doc-key-0001');})();
    const ins=(extra:string,val:unknown)=>scoped(h.db,pm,tx=>tx.query(
      `INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by,${extra}) VALUES($1,$2,$3,1,'https://docs.google.com/u','drive',$4,$5)`,
      [ids.tenant,ids.sales,d.record.id,pm.id,val]));
    await expect(ins('hash_verification','verified')).rejects.toThrow();
    await expect(ins('snapshot_ref','x')).rejects.toThrow();
    await expect(ins('hash_verification','self_declared')).rejects.toThrow(/permission denied/); // column not granted; the default is self_declared
    await expect(ins('source_revision','abc')).resolves.toBeTruthy();
    const revId=(await h.operator.query<{id:string}>('SELECT id FROM document_revisions LIMIT 1')).rows[0].id;
    await expect(scoped(h.db,pm,tx=>tx.query('UPDATE document_records SET approved_revision_id=$1 WHERE id=$2',[revId,d.record.id]))).rejects.toThrow();
    await expect(scoped(h.db,pm,tx=>tx.query("UPDATE document_records SET freeze_state='FROZEN' WHERE id=$1",[d.record.id]))).rejects.toThrow();
    await expect(scoped(h.db,pm,tx=>tx.query('UPDATE document_records SET latest_revision_id=$1,version=version+1,updated_at=now() WHERE id=$2',[revId,d.record.id]))).resolves.toBeTruthy();
    await expect(h.operator.query('UPDATE document_revisions SET changes=\'{}\'')).rejects.toThrow('Append-only history');
    await expect(h.operator.query('DELETE FROM document_records')).rejects.toThrow();
  });
  test('runtime cannot claim a source state or a source check time',async()=>{
    for(const [col,val] of [['source_state','fresh'],['source_checked_at','2026-01-01T00:00:00Z']])
      await expect(scoped(h.db,pm,tx=>tx.query(
        `INSERT INTO document_records(tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by,${col}) VALUES($1,$2,'design','Tiêu đề thử nghiệm','drive','https://docs.google.com/s1',$3,$4)`,
        [ids.tenant,ids.sales,pm.id,val]))).rejects.toThrow();
    expect(await count('document_records')).toBe(0);
  });
  test('a pointer cannot reference a revision of another record',async()=>{
    await templates();
    const a=await svc().register(pm,base(),'doc-key-0001');
    const b=await svc().register(pm,{...base(),canonicalUri:'https://docs.google.com/docs/b'},'doc-key-0002');
    await scoped(h.db,pm,tx=>tx.query("INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by) VALUES($1,$2,$3,1,'https://docs.google.com/u','drive',$4)",[ids.tenant,ids.sales,a.record.id,pm.id]));
    const rev=(await h.operator.query<{id:string}>('SELECT id FROM document_revisions')).rows[0].id;
    await expect(scoped(h.db,pm,tx=>tx.query('UPDATE document_records SET latest_revision_id=$1 WHERE id=$2',[rev,b.record.id]))).rejects.toThrow();
  });
  test('no document table has a content column',async()=>{
    const cols=(await h.operator.query<{table_name:string;column_name:string;data_type:string}>(
      "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('document_records','document_revisions','document_templates')")).rows;
    expect(cols.length).toBeGreaterThan(20);
    expect(cols.filter(c=>c.data_type==='bytea')).toEqual([]);
    expect(cols.filter(c=>['content','body','snapshot'].includes(c.column_name))).toEqual([]);
  });
  test('template index holds T0..T6 with the manifest hashes and refuses a reused version',async()=>{
    await h.exec('TRUNCATE document_templates CASCADE');
    const first=await h.operator.transaction(tx=>syncTemplateIndex(tx,ids.tenant));
    expect(first.inserted).toBe(7);
    const rows=(await h.operator.query<{code:string;template_version:string;doc_type:string;title:string;path:string;content_hash:string}>(
      'SELECT code,template_version,doc_type,title,path,content_hash FROM document_templates WHERE tenant_id=$1 ORDER BY code',[ids.tenant])).rows;
    expect(rows).toEqual(templateManifest.map(t=>({code:t.code,template_version:t.version,doc_type:t.docType,title:t.title,path:t.path,content_hash:t.sha256})));
    expect(templateManifest.map(t=>t.code)).toEqual(['T0','T1','T2','T3','T4','T5','T6']);
    expect((await h.operator.transaction(tx=>syncTemplateIndex(tx,ids.tenant))).inserted).toBe(0);
    const changed=templateManifest.map(t=>t.code==='T0'?{...t,sha256:'b'.repeat(64)}:t);
    expect(await codeOf(h.operator.transaction(tx=>syncTemplateIndex(tx,ids.tenant,changed)))).toEqual({code:'TEMPLATE_VERSION_REUSED',status:409});
  });
});

describe('document revision proposals',()=>{
  const propose=(doc:string,over:Record<string,unknown>={},key='rev-key-0001',p=pm)=>svc().proposeRevision(p,doc,{expectedVersion:1,basedOnRevisionId:null,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
    changes:{summary:'Tóm tắt thay đổi tổng hợp',present:['Mục A'],missing:[]},sourceRefs:[],...over},key);
  const reg=async(uri='https://docs.google.com/docs/demo-1',key='doc-key-0001')=>{await templates();return svc().register(pm,{...base(),canonicalUri:uri},key);};
  const snap=async(id:string)=>({rev:await count('document_revisions'),ev:await count("registry_events WHERE kind='revision_proposed'"),
    v:(await h.operator.query<{version:number}>('SELECT version FROM document_records WHERE id=$1',[id])).rows[0].version});
  const two=async()=>{
    const d=await reg();
    const r1=(await propose(d.record.id,{},'rev-key-0001')).record.latest_revision_id!;
    const r2d=await propose(d.record.id,{expectedVersion:2,basedOnRevisionId:r1,sourceHash:'a'.repeat(64)},'rev-key-0002');
    return {d,r1,r2:r2d.record.latest_revision_id!,r2d};
  };
  test('proposing a revision moves only the draft pointer',async()=>{
    const d=await reg();
    const a=await propose(d.record.id,{},'rev-key-0001');
    const r1=a.record.latest_revision_id!;
    expect(r1).toBeTruthy();expect(a.record.approved_revision_id).toBeNull();expect(a.record.version).toBe(2);
    await h.operator.query('UPDATE document_records SET approved_revision_id=$1 WHERE id=$2',[r1,d.record.id]);
    const b=await propose(d.record.id,{expectedVersion:2,basedOnRevisionId:r1},'rev-key-0002');
    expect(b.record.latest_revision_id).not.toBe(r1);expect(b.record.approved_revision_id).toBe(r1);expect(b.record.version).toBe(3);
    expect(b.events.filter(e=>e.kind==='revision_proposed')).toHaveLength(2);
  });
  test('revisions are immutable and numbered without gaps',async()=>{
    const {r2d}=await two();
    expect(r2d.revisions.map(r=>r.revision_no)).toEqual([1,2]);
    await expect(h.operator.query("UPDATE document_revisions SET changes='{}'")).rejects.toThrow('Append-only history');
    await expect(h.operator.query('DELETE FROM document_revisions')).rejects.toThrow('Append-only history');
    await expect(h.operator.query('DELETE FROM document_records')).rejects.toThrow();
  });
  test('every stored hash is self-declared and no snapshot exists',async()=>{
    await two();
    expect((await h.operator.query<{v:string}>('SELECT DISTINCT hash_verification v FROM document_revisions')).rows.map(r=>r.v)).toEqual(['self_declared']);
    expect(await count('document_revisions WHERE snapshot_ref IS NOT NULL')).toBe(0);
  });
  test('stale expectedVersion or stale base is REVISION_CONFLICT with no revision, event or version change',async()=>{
    const {d,r1}=await two();
    const before=await snap(d.record.id);
    expect(before.v).toBe(3);
    expect(await codeOf(propose(d.record.id,{expectedVersion:1,basedOnRevisionId:r1},'rev-key-0003'))).toEqual({code:'REVISION_CONFLICT',status:409});
    expect(await codeOf(propose(d.record.id,{expectedVersion:3,basedOnRevisionId:r1},'rev-key-0004'))).toEqual({code:'REVISION_CONFLICT',status:409});
    expect(await snap(d.record.id)).toEqual(before);
  });
  test('same key and same request replays; same key with another revision or document conflicts',async()=>{
    const {d,r1,r2,r2d}=await two();
    const again=await propose(d.record.id,{expectedVersion:2,basedOnRevisionId:r1,sourceHash:'a'.repeat(64)},'rev-key-0002');
    expect(again).toEqual(r2d);expect(again.record.latest_revision_id).toBe(r2);
    expect(await count('document_revisions')).toBe(2);
    expect(await codeOf(propose(d.record.id,{expectedVersion:2,basedOnRevisionId:r1,sourceHash:'a'.repeat(64),changes:{summary:'Tóm tắt khác hẳn',present:[],missing:[]}},'rev-key-0002'))).toEqual({code:'IDEMPOTENCY_CONFLICT',status:409});
    const o=await svc().register(pm,{...base(),templateCode:undefined,canonicalUri:'https://docs.google.com/docs/other'},'doc-key-0009');
    expect(await codeOf(propose(o.record.id,{},'rev-key-0002'))).toEqual({code:'IDEMPOTENCY_CONFLICT',status:409});
    expect((await svc().detail(pm,o.record.id)).record.version).toBe(1);
    expect(await count('document_revisions')).toBe(2);
  });
  test('same key reused for a revision in another project is IDEMPOTENCY_CONFLICT',async()=>{
    await templates();
    await svc().register(pm,base(),'shared-key-01');
    const o=await svc().register(pm,{...base(),projectId:ids.transport,templateCode:undefined,canonicalUri:'https://docs.google.com/docs/transport-1'},'doc-key-0009');
    const before=await snap(o.record.id);
    expect(await codeOf(propose(o.record.id,{},'shared-key-01'))).toEqual({code:'IDEMPOTENCY_CONFLICT',status:409});
    expect(await snap(o.record.id)).toEqual(before);
    expect(before.v).toBe(1);expect(before.rev).toBe(0);
  });
  test('the approved pointer cannot point at another document\'s revision',async()=>{
    const {d,r1}=await two();
    const o=await svc().register(pm,{...base(),templateCode:undefined,canonicalUri:'https://docs.google.com/docs/other'},'doc-key-0009');
    const ob=(await propose(o.record.id,{},'rev-key-0009')).record.latest_revision_id!;
    await expect(h.operator.query('UPDATE document_records SET approved_revision_id=$1 WHERE id=$2',[ob,d.record.id])).rejects.toThrow();
    await expect(h.operator.query('UPDATE document_records SET approved_revision_id=$1 WHERE id=$2',[r1,d.record.id])).resolves.toBeTruthy();
  });
  test('bot and viewer cannot propose; fields outside the schema are rejected',async()=>{
    const d=await reg();
    expect(await codeOf(propose(d.record.id,{},'rev-key-0005',bot))).toMatchObject({code:'READ_ONLY'});
    expect(await codeOf(propose(d.record.id,{},'rev-key-0005',{...viewer,projectIds:[ids.sales],grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]}))).toMatchObject({code:'READ_ONLY'});
    expect(await codeOf(propose(d.record.id,{},'rev-key-0005',outsider))).toMatchObject({code:'SCOPE_DENIED',status:404});
    for(const extra of [{hashVerification:'verified'},{status:'approved'},{tenantId:ids.tenant},{snapshotRef:'x'}])
      await expect(propose(d.record.id,extra,'rev-key-0006')).rejects.toBeInstanceOf(ZodError);
    for(const bad of [{sourceHash:'xyz'},{sourceRefs:[{kind:'git_sha',label:'a',value:'abc'}]},{sourceRefs:[{kind:'url',label:'a',value:'http://example.com/x'}]},
      {sourceRefs:[{kind:'url',label:'a',value:'https://u:p@example.com/x'}]},{changes:{summary:'ngắn',present:[],missing:[]}}])
      await expect(propose(d.record.id,bad,'rev-key-0006')).rejects.toBeInstanceOf(ZodError);
    await expect(propose(d.record.id,{sourceRefs:[{kind:'git_sha',label:'commit',value:'b'.repeat(40)},{kind:'url',label:'trang',value:'https://docs.google.com/x'}]},'rev-key-0007')).resolves.toBeTruthy();
    expect(await count('document_revisions')).toBe(1);
  });
});
