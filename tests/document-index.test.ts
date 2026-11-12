import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {native,openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
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
