import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {native,openHarness,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,sameBuProject,viewer} from './slice1-fixtures';
import {ZodError} from 'zod';
import {exportDocumentsCsv,findDocuments} from '../src/server/document-index';
import {scoped} from '../src/server/db';
import {ids} from '../src/server/identities';
import {DocumentService} from '../src/server/documents';
import {syncTemplateIndex} from '../src/server/document-templates';
import {projectDocumentIndex} from '../src/server/document-projector';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const svc=()=>new DocumentService(h.db);
const base=(over:Record<string,unknown>={})=>({projectId:ids.sales,refCode:'DOC-IDX-1',docType:'design',title:'Tài liệu chỉ mục tổng hợp',templateCode:'T3',sourceType:'drive',
  canonicalUri:'https://example.com/docs/idx-1',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:['a']},sourceLinks:[],...over});
const propose=(doc:string,over:Record<string,unknown>={},key='idx-rev-0001')=>svc().proposeRevision(pm,doc,{expectedVersion:1,basedOnRevisionId:null,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
  changes:{summary:'Tóm tắt thay đổi tổng hợp',present:['Mục A'],missing:['x','y']},sourceRefs:[],...over},key);
async function fixture(){
  for(const t of [ids.tenant,ids.otherTenant]) await h.operator.transaction(tx=>syncTemplateIndex(tx,t));
  const a=await svc().register(pm,base(),'idx-doc-0001');
  const r1=(await propose(a.record.id)).record.latest_revision_id!;
  const a2=await propose(a.record.id,{expectedVersion:2,basedOnRevisionId:r1},'idx-rev-0002');
  const b=await svc().register(pm,base({refCode:'DOC-IDX-2',canonicalUri:'https://example.com/docs/idx-2',title:'Tài liệu chưa có bản'}),'idx-doc-0002');
  return {a:a2,b};
}
const rows=async(where='')=>(await h.operator.query<Record<string,any>>(`SELECT * FROM analytics.document_index ${where} ORDER BY ref_code`)).rows;
const count=async(t:string)=>(await h.operator.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;

describe('document index projector',()=>{
  test('projector writes one index row per record and is idempotent',async()=>{
    await fixture();
    expect((await projectDocumentIndex(h.operator,ids.tenant,ids.sales)).rows).toBe(2);
    expect((await projectDocumentIndex(h.operator,ids.tenant,ids.sales)).rows).toBe(2);
    expect(await count('analytics.document_index')).toBe(2);
    const [x,y]=await rows();
    expect(x).toMatchObject({ref_code:'DOC-IDX-1',latest_revision_no:2,approved_revision_no:null,hash_verification:'self_declared',freeze_state:'SOURCE_NOT_FROZEN',missing_count:3});
    expect(y).toMatchObject({ref_code:'DOC-IDX-2',latest_revision_no:null,hash_verification:null,missing_count:1});
  });
  test('projector records when it ran',async()=>{
    const {a}=await fixture();
    const one=await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    const t1=new Date((await rows())[0].projected_at).getTime();
    const two=await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    const r=(await rows())[0];
    expect(new Date(r.projected_at).getTime()).toBeGreaterThanOrEqual(t1);
    expect(Date.parse(two.projectedAt)).toBeGreaterThanOrEqual(Date.parse(one.projectedAt));
    expect(r.record_version).toBe(a.record.version);
  });
  test('index is stale, not wrong, until the projector runs again',async()=>{
    const {a}=await fixture();
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    await propose(a.record.id,{expectedVersion:a.record.version,basedOnRevisionId:a.record.latest_revision_id,sourceHash:'b'.repeat(64)},'idx-rev-0003');
    const stale=(await h.operator.query<{n:number;lt:boolean}>(`SELECT i.latest_revision_no n,i.record_updated_at<r.updated_at lt
      FROM analytics.document_index i JOIN document_records r ON r.id=i.document_id WHERE r.id=$1`,[a.record.id])).rows[0];
    expect(stale).toEqual({n:2,lt:true});
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    expect((await rows("WHERE ref_code='DOC-IDX-1'"))[0].latest_revision_no).toBe(3);
  });
  test('the index returns nothing without RLS context and cannot be written by runtime',async()=>{
    await fixture();
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    const none=await h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');
      return (await tx.query('SELECT 1 FROM analytics.document_index')).rows;});
    expect(none).toHaveLength(0);
    const seen=await scoped(h.db,pm,async tx=>(await tx.query('SELECT 1 FROM analytics.document_index')).rows);
    expect(seen).toHaveLength(2);
    for(const sql of ["INSERT INTO analytics.document_index(tenant_id,project_id) VALUES(gen_random_uuid(),gen_random_uuid())",
      "UPDATE analytics.document_index SET title='x'","DELETE FROM analytics.document_index"])
      await expect(scoped(h.db,pm,tx=>tx.query(sql))).rejects.toThrow();
    expect(await count('analytics.document_index')).toBe(2);
  });
  test('projector is confined to the project it was given',async()=>{
    await fixture();
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    expect(await count(`analytics.document_index WHERE project_id<>'${ids.sales}'`)).toBe(0);
    expect((await projectDocumentIndex(h.operator,ids.tenant,ids.transport)).rows).toBe(0);
    expect((await projectDocumentIndex(h.operator,ids.otherTenant,ids.sales)).rows).toBe(0);
    expect(await count('analytics.document_index')).toBe(2);
  });
  test('a lost source keeps its history',async()=>{
    const {a}=await fixture();
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    const before=[await count('document_records'),await count('document_revisions'),await count('registry_events')];
    await h.operator.query("UPDATE document_records SET source_state='unavailable',source_checked_at=now() WHERE id=$1",[a.record.id]);
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    expect((await rows("WHERE ref_code='DOC-IDX-1'"))[0].source_state).toBe('unavailable');
    expect(await count('analytics.document_index')).toBe(2);
    expect([await count('document_records'),await count('document_revisions'),await count('registry_events')]).toEqual(before);
    expect((await svc().detail(pm,a.record.id)).revisions).toHaveLength(2);
  });
});

describe.skipIf(!native)('document index on the web login',()=>{
  test('the web login cannot assume the projector role',async()=>{
    await fixture();
    const err=await projectDocumentIndex(h.db,ids.tenant,ids.sales).then(()=>null,(e:{code?:string;message:string})=>e);
    console.log('OQ-22 evidence:',err?.code,err?.message);
    expect(err).not.toBeNull();
    expect(await count('analytics.document_index')).toBe(0);
  });
});

describe('document index reads (DOC-10, R-02)',()=>{
  const reg=async(refCode:string,title:string,over:Record<string,unknown>={})=>(await svc().register(pm,base({refCode,title,canonicalUri:'https://example.com/docs/'+(refCode||'x')+Math.random().toString(36).slice(2),...over}),'k-'+Math.random().toString(36).slice(2,12))).record;
  const codeOf=async(p:Promise<unknown>)=>p.then(()=>null,(e:{code?:string;status?:number;message?:string})=>e);
  const GENERIC='Không tìm thấy tài liệu trong phạm vi được cấp.';
  async function seedRead(){
    for(const t of [ids.tenant,ids.otherTenant]) await h.operator.transaction(tx=>syncTemplateIndex(tx,t));
    const a=await reg('XECA006','Nâng package theo npm audit');
    const b=await reg('DOC-P2','Báo cáo 100% hoàn_thành',{docType:'plan'});
    const c=await reg('LBRC014','Bản ghi đối soát LBRC014');
    const t=await reg('DOC-T1','Tài liệu vận tải mẫu',{projectId:ids.transport,docType:'plan'});
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    await projectDocumentIndex(h.operator,ids.tenant,ids.transport);
    return {a,b,c,t};
  }
  test('list by project returns only that project\'s index rows with total and projectedAt (synthetic — chờ tin gốc)',async()=>{
    await seedRead();
    const r=await findDocuments(h.db,pm,{projectId:ids.sales});
    expect(r.source).toBe('Z2');
    expect(r.rows.map(x=>x.ref_code).sort()).toEqual(['DOC-P2','LBRC014','XECA006']);
    expect(r.rows.every(x=>x.project_id===ids.sales)).toBe(true);
    expect(r.total).toBe(3);
    expect(typeof r.projectedAt).toBe('string');
    const t=await findDocuments(h.db,pm,{projectId:ids.transport});
    expect(t.rows.map(x=>x.ref_code)).toEqual(['DOC-T1']);
    expect(t.total).toBe(1);
    const page=await findDocuments(h.db,pm,{projectId:ids.sales,limit:1,offset:1});
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(3);
  });
  test('an unprojected project has total 0 and projectedAt null (synthetic — chờ tin gốc)',async()=>{
    await seedRead();
    expect(await findDocuments(h.db,pm,{projectId:ids.transport,q:'zzzz'})).toMatchObject({rows:[],total:0});
    await h.operator.query('DELETE FROM analytics.document_index WHERE project_id=$1',[ids.transport]);
    expect(await findDocuments(h.db,pm,{projectId:ids.transport})).toMatchObject({rows:[],total:0,projectedAt:null});
  });
  test('search matches title, type and code case-insensitively and treats wildcards literally (synthetic — chờ tin gốc)',async()=>{
    await seedRead();
    const f=async(q:string)=>(await findDocuments(h.db,pm,{projectId:ids.sales,q})).rows.map(x=>x.ref_code).sort();
    expect(await f('nâng PACKAGE')).toEqual(['XECA006']);
    expect(await f('xeca006')).toEqual(['XECA006']);
    expect(await f('design')).toEqual(['LBRC014','XECA006']);
    expect(await f('%')).toEqual(['DOC-P2']);
    expect(await f('_')).toEqual(['DOC-P2']);
    expect(await f('\\')).toEqual([]);
    expect((await findDocuments(h.db,pm,{projectId:ids.sales,q:'design',docType:'design'})).total).toBe(2);
    expect((await findDocuments(h.db,pm,{projectId:ids.sales,docType:'plan'})).total).toBe(1);
  });
  test('cross-project and cross-tenant reads are denied before any query (synthetic — chờ tin gốc)',async()=>{
    await seedRead();
    let calls=0;
    const spy=new Proxy(h.db,{get:(t,k,r)=>{const v=Reflect.get(t,k,r);
      return (k==='query'||k==='transaction')&&typeof v==='function'?(...a:unknown[])=>{calls++;return (v as (...x:unknown[])=>unknown).apply(t,a);}:v;}});
    for(const [p,pid] of [[member,ids.transport],[member,sameBuProject],[outsider,ids.sales],[viewer,ids.sales]] as const){
      const e=await codeOf(findDocuments(spy,p,{projectId:pid,q:'LBRC014'}));
      expect(e).toMatchObject({code:'SCOPE_DENIED',status:404,message:GENERIC});
      expect(e?.message).not.toMatch(/LBRC014|XECA006|vận tải|Bán hàng|\d/i);
    }
    expect(calls).toBe(0);
    const v=await findDocuments(h.db,viewer,{projectId:ids.transport});
    expect(v.rows.map(x=>x.ref_code)).toEqual(['DOC-T1']);
    expect((await findDocuments(h.db,viewer,{projectId:ids.transport,q:'LBRC014'})).total).toBe(0);
  });
  test('a call without projectId is rejected',async()=>{
    await expect(findDocuments(h.db,pm,{})).rejects.toBeInstanceOf(ZodError);
    await expect(findDocuments(h.db,pm,{q:'x'})).rejects.toBeInstanceOf(ZodError);
  });
  test('a principal recomputed after membership removal can no longer list, search or export (synthetic — chờ tin gốc)',async()=>{
    await seedRead();
    const before={...member};
    const after={...member,projectIds:[sameBuProject],grants:[{projectId:sameBuProject,role:'engineer' as const,reportPermissions:[]}]};
    expect((await findDocuments(h.db,before,{projectId:ids.sales})).rows.length).toBeGreaterThan(0);
    expect(await codeOf(findDocuments(h.db,after,{projectId:ids.sales}))).toMatchObject({code:'SCOPE_DENIED'});
    expect(await codeOf(findDocuments(h.db,after,{projectId:ids.sales,q:'xeca'}))).toMatchObject({code:'SCOPE_DENIED'});
    expect(await codeOf(exportDocumentsCsv(h.db,after,ids.sales))).toMatchObject({code:'SCOPE_DENIED'});
    await expect(findDocuments(h.db,after,{})).rejects.toBeInstanceOf(ZodError);
    expect(await findDocuments(h.db,after,{projectId:sameBuProject})).toMatchObject({rows:[],total:0});
  });
  test('bot cannot read the document index (synthetic — chờ tin gốc)',async()=>{
    await seedRead();
    expect(await codeOf(findDocuments(h.db,bot,{projectId:ids.transport}))).toMatchObject({code:'READ_ONLY'});
    expect(await codeOf(exportDocumentsCsv(h.db,bot,ids.transport))).toMatchObject({code:'READ_ONLY'});
  });
  test('limit is capped at 200 and unknown fields are rejected',async()=>{
    await expect(findDocuments(h.db,pm,{projectId:ids.sales,limit:201})).rejects.toBeInstanceOf(ZodError);
    await expect(findDocuments(h.db,pm,{projectId:ids.sales,limit:0})).rejects.toBeInstanceOf(ZodError);
    await expect(findDocuments(h.db,pm,{projectId:ids.sales,offset:-1})).rejects.toBeInstanceOf(ZodError);
    await expect(findDocuments(h.db,pm,{projectId:ids.sales,tenantId:ids.otherTenant})).rejects.toBeInstanceOf(ZodError);
    await expect(findDocuments(h.db,pm,{projectId:ids.sales,q:''})).rejects.toBeInstanceOf(ZodError);
    await expect(findDocuments(h.db,pm,{projectId:ids.sales,docType:'secret'})).rejects.toBeInstanceOf(ZodError);
  });
  test('export has the fixed header, shows Chưa có for an empty approved pointer and neutralises formulas',async()=>{
    for(const t of [ids.tenant]) await h.operator.transaction(tx=>syncTemplateIndex(tx,t));
    const f=await reg('DOC-F1','=HYPERLINK("http://x","y")');
    await reg('DOC-F2','Tài liệu, có "ngoặc"\nxuống dòng');
    await propose(f.id);
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    const csv=await exportDocumentsCsv(h.db,pm,ids.sales);
    expect(csv.split('\n')[0]).toBe('ma,loai,tieu_de,chu_noi_dung,nguon,ban_dang_soan,ban_chuan,muc_hash,trang_thai_nguon,dong_bang,thoi_diem_chieu');
    expect(csv).toContain('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(csv).toContain('"Tài liệu, có ""ngoặc""\nxuống dòng"');
    const line1=csv.split('\n').find(l=>l.startsWith('"DOC-F1"'))!;
    expect(line1).toContain('"r1","Chưa có","tự khai"');
    expect(line1).toContain('"SOURCE_NOT_FROZEN"');
    expect(csv).toContain('"Chưa có","Chưa có",""');
    expect(csv).not.toContain('đã duyệt');
  });
  test('export is denied across projects (synthetic — chờ tin gốc)',async()=>{
    await seedRead();
    expect(await codeOf(exportDocumentsCsv(h.db,member,ids.transport))).toMatchObject({code:'SCOPE_DENIED',status:404,message:GENERIC});
    expect(await codeOf(exportDocumentsCsv(h.db,outsider,ids.sales))).toMatchObject({code:'SCOPE_DENIED'});
    await expect(exportDocumentsCsv(h.db,pm,'not-a-uuid')).rejects.toBeInstanceOf(Error);
  });
});
