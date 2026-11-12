import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {openHarness,type Harness} from './slice1-db';
import {bot,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {lbrc014,lbrc014R1,lbrc014R2,SHA_ANDROID,SHA_FUNC,SHA_IOS,sourceRows,xeca005,xeca006} from './slice1-cases';
import {findDocuments} from '../src/server/document-index';
import {ids} from '../src/server/identities';
import {DocumentService} from '../src/server/documents';
import {syncTemplateIndex} from '../src/server/document-templates';
import {projectDocumentIndex} from '../src/server/document-projector';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);
  for(const t of [ids.tenant,ids.otherTenant]) await h.operator.transaction(tx=>syncTemplateIndex(tx,t));
  for(const s of sourceRows) await h.operator.query(`INSERT INTO analytics.tech_source_tasks(tenant_id,project_id,source_id,source_row,stt,source_ref,snapshot_hash,fingerprint,title,source_status)
    VALUES($1,$2,'synthetic-sheet',$3,$4,$5,$6,$7,$8,$9)`,[ids.tenant,ids.transport,s.row,String(s.row),s.ref,'c'.repeat(64),s.fp,s.title,s.status]);});
afterEach(async()=>{await h.reset();await h.close();});

const svc=()=>new DocumentService(h.db);
const reg=(c:Record<string,unknown>,project:string,key:string)=>svc().register(pm,{...c,projectId:project},key);
const revise=(id:string,r:Record<string,unknown>,v:number,based:string|null,key:string)=>svc().proposeRevision(pm,id,{...r,expectedVersion:v,basedOnRevisionId:based},key);
const count=async(t:string)=>(await h.operator.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
const sourceDigest=async()=>(await h.operator.query<{n:number;d:string}>(`SELECT count(*)::int n,md5(string_agg(fingerprint||source_status,',' ORDER BY source_row)) d FROM analytics.tech_source_tasks`)).rows[0];
async function xecaPair(){
  const a=await reg(xeca006,ids.transport,'case-x006-0001'),b=await reg(xeca005,ids.transport,'case-x005-0001');
  await projectDocumentIndex(h.operator,ids.tenant,ids.transport);return {a,b};
}
async function lbrc(){
  const d=await reg(lbrc014,ids.sales,'case-lbrc-0001');
  const r1=await revise(d.record.id,lbrc014R1,1,null,'case-lbrc-rev1');
  const r2=await revise(d.record.id,lbrc014R2,2,r1.record.latest_revision_id,'case-lbrc-rev2');
  return {d,r1,r2};
}

describe('slice 1 document cases',()=>{
  test('DOC-13 XECA006 and XECA005 are two separate index entries (synthetic — chờ tin gốc)',async()=>{
    const {a,b}=await xecaPair();
    expect(a.record.id).not.toBe(b.record.id);
    const rows=(await h.operator.query<Record<string,any>>(`SELECT document_id,ref_code FROM analytics.document_index WHERE project_id=$1`,[ids.transport])).rows;
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(r=>r.ref_code))).toEqual(new Set(['XECA006','XECA005']));
    expect(a.record.canonical_uri).not.toBe(b.record.canonical_uri);
    const found=await findDocuments(h.db,pm,{projectId:ids.transport,q:'XECA006'});
    expect(found.rows).toHaveLength(1);expect(found.rows[0].ref_code).toBe('XECA006');
  });
  test('XECA006 lists its missing fields as Chưa có and has no approved baseline (synthetic — chờ tin gốc)',async()=>{
    const {a}=await xecaPair();
    const d=await svc().detail(pm,a.record.id);
    expect(d.record.metadata.missingFields).toEqual(xeca006.metadata.missingFields);
    expect(d.record.metadata.missingFields).toHaveLength(7);
    expect(d.record.approved_revision_id).toBeNull();
    const row=(await h.operator.query<Record<string,any>>(`SELECT missing_count,approved_revision_no FROM analytics.document_index WHERE document_id=$1`,[a.record.id])).rows[0];
    expect(row).toEqual({missing_count:7,approved_revision_no:null});
  });
  test('DOC-14 LBRC014 keeps the earlier revision and the iOS supplement, with what is present and what is missing',async()=>{
    const d=await reg(lbrc014,ids.sales,'case-lbrc-0001');
    const r1=await revise(d.record.id,lbrc014R1,1,null,'case-lbrc-rev1');
    const before=structuredClone((await svc().detail(pm,d.record.id)).revisions[0]);
    const r2=await revise(d.record.id,lbrc014R2,2,r1.record.latest_revision_id,'case-lbrc-rev2');
    expect(r2.revisions).toHaveLength(2);
    expect(r2.revisions[0]).toEqual(before);
    const shas=new Set(r2.revisions.flatMap(r=>r.source_refs.map(x=>x.value)));
    for(const s of [SHA_FUNC,SHA_ANDROID,SHA_IOS]) expect(shas.has(s)).toBe(true);
    const latest=r2.revisions[1];
    expect(latest.changes.present).toContain('báo cáo iOS');
    expect(latest.changes.missing).toEqual(expect.arrayContaining(['U4','U6']));
    expect(r2.record.latest_revision_id).toBe(latest.id);
    expect(r2.record.approved_revision_id).toBeNull();
  });
  test('source links keep the Z2 source_ref labelled chưa đối soát and create no work item (synthetic — chờ tin gốc)',async()=>{
    const wi=await count('work_items');
    const a=await reg(xeca006,ids.transport,'case-x006-0001');
    expect(a.record.source_links[0]).toEqual({kind:'z2_source_ref',value:'Đầu việc Tech!A42:H42',label:'chưa đối soát',present:true});
    expect(await count('work_items')).toBe(wi);
  });
  test('PM-08 indexing leaves the Z2 source rows unchanged (synthetic — chờ tin gốc)',async()=>{
    const before=await sourceDigest();
    await xecaPair();
    expect(await sourceDigest()).toEqual(before);
    expect(before.n).toBe(2);
    const st=(await h.operator.query<{source_status:string}>(`SELECT source_status FROM analytics.tech_source_tasks WHERE source_ref='Đầu việc Tech!A34:H34'`)).rows[0];
    expect(st.source_status).toBe('Hoàn thành');
  });
  test('DOC-18 a vanished source row leaves the record and its history (synthetic — chờ tin gốc)',async()=>{
    const a=await reg(xeca006,ids.transport,'case-x006-0001');
    const r=await revise(a.record.id,{...lbrc014R1,sourceRefs:[]},1,null,'case-x006-rev1');
    await h.operator.query(`DELETE FROM analytics.tech_source_tasks WHERE source_ref='Đầu việc Tech!A42:H42'`);
    const d=await svc().detail(pm,a.record.id);
    expect(d.record.id).toBe(a.record.id);
    expect(d.revisions).toHaveLength(1);expect(d.revisions[0].id).toBe(r.record.latest_revision_id);
    expect(d.record.source_links[0].present).toBe(false);
    expect(await count('document_records')).toBe(1);
  });
  test('openSource re-checks scope on every call and never leaks across projects',async()=>{
    const {d}=await lbrc();
    const opened=await svc().openSource(pm,d.record.id);
    expect(opened).toEqual({uri:lbrc014.canonicalUri,host:'example.com',sourceType:'drive',sourceState:expect.any(String),title:lbrc014.title});
    for(const who of [viewer,outsider]){
      const e=await svc().openSource(who,d.record.id).catch(x=>x);
      expect(e).toMatchObject({code:'SCOPE_DENIED',status:404});
      expect(String(e.message)).not.toContain('LBRC014');
    }
    await expect(svc().openSource(bot,d.record.id)).rejects.toMatchObject({code:'READ_ONLY'});
    await h.operator.query(`UPDATE document_records SET source_state='unavailable' WHERE id=$1`,[d.record.id]);
    const e=await svc().openSource(pm,d.record.id).catch(x=>x);
    expect(e).toMatchObject({code:'SOURCE_UNAVAILABLE',status:409});
    expect(JSON.stringify(e)).not.toContain('example.com');
    const det=await svc().detail(pm,d.record.id);
    expect(det.revisions).toHaveLength(2);
  });
  test('no reporting-domain row exists after indexing both cases',async()=>{
    await xecaPair();await lbrc();
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    expect(await count('project_domain_mappings')).toBe(0);
  });
});
