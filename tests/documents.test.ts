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
  canonicalUri:'https://example.com/docs/demo-1',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[]});
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
    expect(await codeOf(svc().register(pm,{...base(),canonicalUri:'https://example.com/docs/other'},'doc-key-0001'))).toEqual({code:'IDEMPOTENCY_CONFLICT',status:409});
    expect(await count('document_records')).toBe(1);
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
    const d=await svc().register(pm,{...base(),templateCode:undefined,canonicalUri:'  https://example.com/docs/x  '},'doc-key-0005');
    expect(d.record.canonical_uri).toBe('https://example.com/docs/x');
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
  const rec=(project:string,tenant:string,uri:string)=>scoped(h.db,pm,tx=>tx.query(
    "INSERT INTO document_records(tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by) VALUES($1,$2,'design','Tiêu đề thử nghiệm','drive',$3,$4)",[tenant,project,uri,pm.id]));
  test('runtime cannot insert for another project or tenant',async()=>{
    await expect(rec(ids.sales,ids.otherTenant,'https://example.com/t1')).rejects.toThrow();
    await expect(scoped(h.db,outsider,tx=>tx.query(
      "INSERT INTO document_records(tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by) VALUES($1,$2,'design','Tiêu đề thử nghiệm','drive','https://example.com/t2',$3)",[ids.tenant,ids.sales,outsider.id]))).rejects.toThrow();
    await expect(scoped(h.db,member,tx=>tx.query(
      "INSERT INTO document_records(tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by) VALUES($1,$2,'design','Tiêu đề thử nghiệm','drive','https://example.com/t3',$3)",[ids.tenant,ids.transport,member.id]))).rejects.toThrow();
    await expect(scoped(h.db,pm,tx=>tx.query(
      "INSERT INTO document_templates(tenant_id,code,template_version,doc_type,title,path,content_hash) VALUES($1,'TX','1','other','x','p',$2)",[ids.tenant,'a'.repeat(64)]))).rejects.toThrow();
    await expect(rec(ids.sales,ids.tenant,'https://example.com/t4')).resolves.toBeTruthy();
    const revision=(p:typeof pm,project:string,tenant:string)=>scoped(h.db,p,async tx=>{
      const id=(await tx.query<{id:string}>("SELECT id FROM document_records LIMIT 1")).rows[0].id;
      return tx.query("INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by) VALUES($1,$2,$3,1,'u','drive',$4)",[tenant,project,id,p.id]);
    });
    await expect(revision(pm,ids.sales,ids.otherTenant)).rejects.toThrow();
  });
  test('runtime cannot set the approved pointer, a verified hash or a snapshot',async()=>{
    const d=await (async()=>{await templates();return svc().register(pm,base(),'doc-key-0001');})();
    const ins=(extra:string,val:unknown)=>scoped(h.db,pm,tx=>tx.query(
      `INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by,${extra}) VALUES($1,$2,$3,1,'u','drive',$4,$5)`,
      [ids.tenant,ids.sales,d.record.id,pm.id,val]));
    await expect(ins('hash_verification','verified')).rejects.toThrow();
    await expect(ins('snapshot_ref','x')).rejects.toThrow();
    await expect(ins('hash_verification','self_declared')).resolves.toBeTruthy();
    const revId=(await h.operator.query<{id:string}>('SELECT id FROM document_revisions LIMIT 1')).rows[0].id;
    await expect(scoped(h.db,pm,tx=>tx.query('UPDATE document_records SET approved_revision_id=$1 WHERE id=$2',[revId,d.record.id]))).rejects.toThrow();
    await expect(scoped(h.db,pm,tx=>tx.query("UPDATE document_records SET freeze_state='FROZEN' WHERE id=$1",[d.record.id]))).rejects.toThrow();
    await expect(scoped(h.db,pm,tx=>tx.query('UPDATE document_records SET latest_revision_id=$1,version=version+1,updated_at=now() WHERE id=$2',[revId,d.record.id]))).resolves.toBeTruthy();
    await expect(h.operator.query('UPDATE document_revisions SET changes=\'{}\'')).rejects.toThrow('Append-only history');
    await expect(h.operator.query('DELETE FROM document_records')).rejects.toThrow();
  });
  test('a pointer cannot reference a revision of another record',async()=>{
    await templates();
    const a=await svc().register(pm,base(),'doc-key-0001');
    const b=await svc().register(pm,{...base(),canonicalUri:'https://example.com/docs/b'},'doc-key-0002');
    await scoped(h.db,pm,tx=>tx.query("INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by) VALUES($1,$2,$3,1,'u','drive',$4)",[ids.tenant,ids.sales,a.record.id,pm.id]));
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
