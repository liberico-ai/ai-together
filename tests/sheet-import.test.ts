import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {bot,member,pm,seedSlice1,viewer} from './slice1-fixtures';
import {approver,mapDomain,reviewer,seedMembers} from './slice3-fixtures';
import {clearImports,envelope,newKey,projectIds,refOf,row8,seedImport,SHEET,SOURCE_ID,SOURCE_KEY,SOURCE_URL,tech} from './sheet-import-fixtures';
import type {Database,Queryable} from '../src/server/db';
import {SheetImportService} from '../src/server/sheet-import';
import {WorkRequestService} from '../src/server/work-requests';
import {ids} from '../src/server/identities';
import {scoped} from '../src/server/db';
import type {Principal} from '../src/server/types';

type R=Record<string,unknown>;
const NOTE_CANARY='đoạn-ghi-chú-canary-qzx81';
const KEPT_NOTE='ghi-chú-được-giữ-mhd55';
const TITLE_CANARY='tiêu-đề-canary-wvn42';

let h:Harness;
beforeEach(async()=>{
  h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);await seedImport(h);await clearImports(h);
  for(const [i,p] of [pm,reviewer,approver].entries())
    await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[ids.tenant,p.id,String(9300000000+i)]);
  await h.operator.query('INSERT INTO bom_scopes(tenant_id,project_id,seat_ids,enabled) VALUES($1,$2,$3,true)',[ids.tenant,ids.sales,[pm.id,reviewer.id,approver.id]]);
});
afterEach(async()=>{vi.restoreAllMocks();await h.reset();await h.close();});

const svc=()=>new SheetImportService(h.db);
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const mapping=(over:Record<string,string>={})=>Object.entries({LBRC:projectIds.lbrc,XECA:projectIds.xeca,'IBS HI':projectIds.ibs,...over}).map(([buLabel,projectId])=>({buLabel,projectId}));
/** Preview, then commit with the default mapping and the given owners. */
async function go(who:Principal,lines:string[],o:{key?:string;projects?:{buLabel:string;projectId:string}[];owners?:R[]}={}){
  const env=envelope(lines);
  // the preview is told the mapping the commit will use, when the case chooses one
  const pre=await svc().preview(who,{...env,...(o.projects?{projects:o.projects}:{}),...(o.owners?{owners:o.owners}:{})});
  const receipt=await svc().commit(who,{...env,previewDigest:pre.previewDigest,requestKey:o.key??newKey(),projects:o.projects??mapping(),owners:o.owners??[]});
  return {pre,receipt};
}
const results=(r:{results:{row:number;result:string;reasons:string[];flags:string[]}[]})=>r.results.map(x=>[x.row,x.result,...x.reasons]);
const denied=(p:Principal)=>expect(svc().preview(p,envelope([row8()]))).rejects.toMatchObject({code:'IMPORT_DENIED',status:403});

// ---------- who may import ----------
test('(17) a viewer, a member, a manager of other projects and the bot are denied; a Team Tech member and the manager of the target project may import',async()=>{
  for(const p of [viewer,member,reviewer,bot]) await denied(p);
  const env=envelope([row8({stt:'1'})]);
  for(const p of [viewer,member,bot]){
    const pre=await svc().preview(tech,env);
    await expect(svc().commit(p,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[]})).rejects.toMatchObject({code:'IMPORT_DENIED',status:403});
  }
  // pm manages sales and transport only: LBRC·Team Tech is not theirs (work_request_filer says no), so its rows come out NOT_A_FILER and the batch does not abort
  const pre=await svc().preview(pm,{...env,projects:mapping()});
  expect(pre.rows[0]).toMatchObject({result:'needs_reconciliation',reasons:['NOT_A_FILER']});
  const refused=await svc().commit(pm,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[]});
  expect(results(refused)).toEqual([[2,'needs_reconciliation','NOT_A_FILER']]);
  expect(await n('work_requests')+await n('work_import_rows')).toBe(0);
  // the roster member imports into a project with no grant; the manager imports into their own project
  expect(results((await go(tech,[row8()])).receipt)).toEqual([[2,'imported']]);
  const own=await go(pm,[row8({stt:'9',title:'Việc cho dự án bán hàng TEST009'})],{projects:mapping({LBRC:ids.sales})});
  expect(results(own.receipt)).toEqual([[2,'imported']]);
  expect(await rows('SELECT requester_id,project_id,origin,state FROM work_requests ORDER BY project_id')).toEqual(expect.arrayContaining([
    {requester_id:pm.id,project_id:ids.sales,origin:'import',state:'pending'},{requester_id:tech.id,project_id:projectIds.lbrc,origin:'import',state:'pending'}]));
});

// ---------- the preview writes nothing ----------
test('(5) the preview writes nothing: no request, event, key row, batch, work item or audit event',async()=>{
  const tables=['work_requests','work_request_events','work_import_rows','work_import_batches','work_items','audit_events'];
  const before=await Promise.all(tables.map(n));
  const pre=await svc().preview(tech,envelope([row8({stt:'1'}),row8({stt:'2',bu:'XECA',title:'Việc thứ hai TEST002 đủ dài'})]));
  expect(await Promise.all(tables.map(n))).toEqual(before);
  expect(pre.rows).toHaveLength(2);
  expect(pre.fileHash).toMatch(/^[a-f0-9]{64}$/);
  expect(pre.previewDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(pre.buLabels).toEqual(expect.arrayContaining([{label:'LBRC',rows:1,defaultProjectId:projectIds.lbrc},{label:'XECA',rows:1,defaultProjectId:projectIds.xeca}]));
  // the same file and database state give the same digest
  expect((await svc().preview(tech,envelope([row8({stt:'1'}),row8({stt:'2',bu:'XECA',title:'Việc thứ hai TEST002 đủ dài'})]))).previewDigest).toBe(pre.previewDigest);
});

test('the envelope is strict: no tenant, importer, state or origin from the request; a bad file, link or host is refused',async()=>{
  for(const extra of [{tenantId:ids.tenant},{importerId:pm.id},{state:'approved'},{origin:'form'}])
    await expect(svc().preview(tech,{...envelope([row8()]),...extra})).rejects.toBeInstanceOf(ZodError);
  const pre=await svc().preview(tech,envelope([row8()]));
  const commit=(over:R)=>svc().commit(tech,{...envelope([row8()]),previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[],...over});
  for(const extra of [{tenantId:ids.tenant},{importerId:pm.id},{state:'approved'},{origin:'form'},{requesterId:pm.id}]) await expect(commit(extra)).rejects.toBeInstanceOf(ZodError);
  await expect(commit({projects:[{buLabel:'LBRC',projectId:projectIds.lbrc,state:'approved'}]})).rejects.toBeInstanceOf(ZodError);
  await expect(commit({owners:[{text:'A',projectId:projectIds.lbrc,userId:member.id,origin:'form'}]})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().preview(tech,{...envelope([row8()]),fileBase64:'***'})).rejects.toBeInstanceOf(ZodError);
  await expect(svc().preview(tech,envelope([row8()],{sourceUrl:'http://docs.google.com/spreadsheets/d/TESTSHEETKEY0001/edit'}))).rejects.toMatchObject({code:'SOURCE_URL_REJECTED',status:422});
  await expect(svc().preview(tech,envelope([row8()],{sourceUrl:'https://example.com/spreadsheets/d/TESTSHEETKEY0001/edit'}))).rejects.toMatchObject({code:'SOURCE_URL_REJECTED'});
  await expect(svc().preview(tech,envelope([row8()],{sourceUrl:'https://docs.google.com/document/d/TESTSHEETKEY0001/edit'}))).rejects.toMatchObject({code:'SOURCE_URL_REJECTED'});
  expect(await n('work_requests')).toBe(0);
});

// ---------- cells as written, blanks flagged ----------
test('(6) a blank due is flagged and kept blank; an ambiguous dd/mm stays blank and flagged; a clear date becomes 16:00 Vietnam time; the cell is kept as written',async()=>{
  const {receipt}=await go(tech,[
    row8({stt:'1',title:'Việc không có hạn TEST101',due:''}),
    row8({stt:'2',title:'Việc hạn hai nghĩa TEST102',due:'05/11/2026'}),
    row8({stt:'3',title:'Việc hạn rõ ràng TEST103',due:'25/11/2026'}),
    row8({stt:'4',title:'Việc hạn dạng ISO TEST104',due:'2026-12-01 00:00:00'}),
    row8({stt:'5',title:'Việc hạn sai TEST105',due:'31/02/2026'}),
    row8({stt:'6',title:'Việc hạn chữ TEST106',due:'sớm nhất có thể'}),
  ]);
  expect(receipt.results.map(r=>r.result)).toEqual(Array(6).fill('imported'));
  const by=Object.fromEntries(receipt.results.map(r=>[r.stt,r.flags]));
  expect(by['1']).toContain('MISSING_DUE');expect(by['2']).toContain('AMBIGUOUS_DUE');expect(by['5']).toContain('INVALID_DUE');expect(by['6']).toContain('INVALID_DUE');
  expect(by['3']).not.toEqual(expect.arrayContaining(['MISSING_DUE','AMBIGUOUS_DUE','INVALID_DUE']));
  const got=await rows<{stt:string;due_raw:string;due_at:string|null}>(`SELECT k.stt,k.due_raw,r.due_at FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id ORDER BY k.stt`);
  expect(got.map(g=>[g.stt,g.due_raw,g.due_at?new Date(g.due_at).toISOString():null])).toEqual([
    ['1','',null],['2','05/11/2026',null],['3','25/11/2026','2026-11-25T09:00:00.000Z'],['4','2026-12-01 00:00:00','2026-12-01T09:00:00.000Z'],['5','31/02/2026',null],['6','sớm nhất có thể',null]]);
});

test('status is kept as written and never mapped; a blank or unknown label is flagged; a «Hoàn thành» row still waits in the queue',async()=>{
  const {receipt}=await go(tech,[
    row8({stt:'1',title:'Việc đã xong TEST201',status:'Hoàn thành'}),
    row8({stt:'2',title:'Việc tạm dừng TEST202',status:'Tạm dừng'}),
    row8({stt:'3',title:'Việc nhãn lạ TEST203',status:'Chờ sếp xem'}),
    row8({stt:'4',title:'Việc không trạng thái TEST204',status:''}),
  ]);
  expect(results(receipt)).toEqual([[2,'imported'],[3,'imported'],[4,'imported'],[5,'imported']]);
  expect(receipt.results[2].flags).toContain('UNKNOWN_STATUS');expect(receipt.results[3].flags).toContain('MISSING_STATUS');
  expect(await rows('SELECT stt,source_status FROM work_import_rows ORDER BY stt')).toEqual([{stt:'1',source_status:'Hoàn thành'},{stt:'2',source_status:'Tạm dừng'},{stt:'3',source_status:'Chờ sếp xem'},{stt:'4',source_status:''}]);
  expect(await rows("SELECT DISTINCT state FROM work_requests")).toEqual([{state:'pending'}]);
  expect(await n('work_items')).toBe(await n("work_items WHERE code NOT LIKE 'WR-%'"));
  expect(await n("work_items WHERE title LIKE '%TEST20%'")).toBe(0);
});

test('(7) a multi-person owner cell is flagged and left unassigned; a single name needs a confirmed mapping; the cell text is always kept',async()=>{
  const owners=['Người A và Người B','Người A, Người B','Người A/Người B','Người A & Người B','Người A; Người B','Người A\nNgười B'];
  const {receipt}=await go(tech,[...owners.map((o,i)=>row8({stt:String(i+1),title:`Việc nhiều người TEST30${i}`,owner:o})),
    row8({stt:'7',title:'Việc một tên TEST307',owner:'Người thực hiện'}),row8({stt:'8',title:'Việc không tên TEST308',owner:''})]);
  for(const r of receipt.results.slice(0,6)) expect(r.flags).toContain('MULTI_OWNER');
  expect(receipt.results[6].flags).toContain('OWNER_NOT_MAPPED');
  expect(receipt.results[7].flags).toContain('MISSING_OWNER');
  const got=await rows<{stt:string;owner_raw:string;assignee_id:string|null}>('SELECT k.stt,k.owner_raw,r.assignee_id FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id ORDER BY k.stt');
  expect(got.every(g=>g.assignee_id===null)).toBe(true);
  expect(got.map(g=>g.owner_raw)).toEqual([...owners,'Người thực hiện','']);
});

test('(7) a confirmed single-name mapping sets the proposed assignee; a person who is not an engineer of the target project, or that the importer cannot see, is refused and nothing is written',async()=>{
  const lines=[row8({stt:'1',title:'Việc có người thực hiện TEST401',owner:'Người thực hiện'})];
  const sales=mapping({LBRC:ids.sales});
  const pre=await svc().preview(pm,envelope(lines));
  // the importer sees the engineer of the sales project as a candidate by exact name only
  expect(pre.owners).toEqual([{text:'Người thực hiện',rows:1,candidates:[{userId:member.id,name:'Người thực hiện',projectIds:[ids.sales]}]}]);
  const commit=(who:Principal,userId:string,over:R={})=>svc().commit(who,{...envelope(lines),previewDigest:pre.previewDigest,requestKey:newKey(),projects:sales,owners:[{text:'Người thực hiện',projectId:ids.sales,userId,...over}]});
  await expect(commit(pm,approver.id)).rejects.toMatchObject({code:'OWNER_NOT_IN_PROJECT',status:422});
  await expect(commit(pm,randomUUID())).rejects.toMatchObject({code:'OWNER_NOT_IN_PROJECT'});
  // the roster member holds no grant in sales: nobody there is visible to them, even the real engineer
  const prep=await svc().preview(tech,envelope(lines));
  expect(prep.owners[0].candidates).toEqual([]);
  await expect(svc().commit(tech,{...envelope(lines),previewDigest:prep.previewDigest,requestKey:newKey(),projects:sales,owners:[{text:'Người thực hiện',projectId:ids.sales,userId:member.id}]})).rejects.toMatchObject({code:'OWNER_NOT_IN_PROJECT'});
  expect(await n('work_requests')+await n('work_import_rows')+await n('work_import_batches')).toBe(0);
  const ok=await commit(pm,member.id);
  expect(results(ok)).toEqual([[2,'imported']]);
  expect(ok.results[0].flags).not.toContain('OWNER_NOT_MAPPED');
  expect(await rows('SELECT assignee_id,technical_id,business_id FROM work_requests')).toEqual([{assignee_id:member.id,technical_id:null,business_id:null}]);
  expect((await rows<{owner_raw:string}>('SELECT owner_raw FROM work_import_rows'))[0].owner_raw).toBe('Người thực hiện');
});

// ---------- idempotency ----------
test('(8) importing the same file again writes nothing new; a row inserted above is the only new request',async()=>{
  const base=[row8({stt:'1',title:'Việc thứ nhất TEST501'}),row8({stt:'2',title:'Việc thứ hai TEST502',bu:'XECA'}),row8({stt:'3',title:'Việc thứ ba TEST503',bu:'IBS HI'})];
  const first=await go(tech,base);
  expect(first.receipt.results.map(r=>r.result)).toEqual(['imported','imported','imported']);
  const snapshot=async()=>({r:await rows('SELECT id,version,created_at FROM work_requests ORDER BY id'),k:await rows('SELECT id,created_at FROM work_import_rows ORDER BY id')});
  const was=await snapshot();
  const again=await go(tech,base);
  expect(again.pre.rows.map(r=>r.result)).toEqual(['duplicate','duplicate','duplicate']);
  expect(again.receipt.results.map(r=>r.result)).toEqual(['duplicate','duplicate','duplicate']);
  expect(again.receipt.id).not.toBe(first.receipt.id);
  expect(await snapshot()).toEqual(was);
  expect(await n('work_requests')).toBe(3);
  // a row inserted at the top: every old row moves down one source row, STT is unchanged
  const grown=await go(tech,[row8({stt:'0',title:'Việc chèn lên đầu TEST500'}),...base]);
  expect(results(grown.receipt)).toEqual([[2,'imported'],[3,'duplicate'],[4,'duplicate'],[5,'duplicate']]);
  expect(await n('work_requests')).toBe(4);
  // another Team Tech member importing the same file is told the same
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'imp-tech2',$3,'viewer','fixture-only')`,['14000000-0000-4000-8000-000000000078',ids.tenant,'Thành viên Tech hai']);
  await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,'14000000-0000-4000-8000-000000000078',ids.transport]);
  await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,'14000000-0000-4000-8000-000000000078']);
  const second:Principal={...tech,id:'14000000-0000-4000-8000-000000000078',name:'Thành viên Tech hai'};
  const other=await go(second,base);
  // the second member cannot read the keys the first one holds: every row is «STT đã được nhập», in the preview as at the commit, and nothing new is written (OQ-62 câu 8)
  expect(other.pre.rows.map(r=>[r.result,...r.reasons])).toEqual([['needs_reconciliation','STT_IMPORTED'],['needs_reconciliation','STT_IMPORTED'],['needs_reconciliation','STT_IMPORTED']]);
  expect(results(other.receipt)).toEqual([[2,'needs_reconciliation','STT_IMPORTED'],[3,'needs_reconciliation','STT_IMPORTED'],[4,'needs_reconciliation','STT_IMPORTED']]);
  expect(await n('work_requests')).toBe(4);
});

test('(9) a changed cell under the same STT is «cần đối soát» SOURCE_CHANGED; the old key row and request do not change by a byte',async()=>{
  await go(tech,[row8({stt:'1',title:'Việc cần sửa TEST601',due:'25/11/2026'}),row8({stt:'2',title:'Việc giữ nguyên TEST602'})]);
  const was=await rows(`SELECT md5(k::text) k,md5(r::text) r FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id ORDER BY k.stt`);
  const {pre,receipt}=await go(tech,[row8({stt:'1',title:'Việc cần sửa TEST601',due:'30/11/2026'}),row8({stt:'2',title:'Việc giữ nguyên TEST602'})]);
  expect(results(receipt)).toEqual([[2,'needs_reconciliation','SOURCE_CHANGED'],[3,'duplicate']]);
  expect(pre.rows.map(r=>r.reasons)).toEqual([['SOURCE_CHANGED'],[]]);
  expect(await rows(`SELECT md5(k::text) k,md5(r::text) r FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id ORDER BY k.stt`)).toEqual(was);
  expect(await n('work_requests')).toBe(2);
});

test('(10) another STT with the same content, another STT with the same work code, and duplicates inside one file are not imported',async()=>{
  await go(tech,[row8({stt:'1',title:'Việc gốc không mã'}),row8({stt:'2',title:'Việc mã đã dùng TEST702',note:'ghi chú hai'})]);
  const {receipt}=await go(tech,[
    row8({stt:'11',title:'Việc gốc không mã'}),                      // same content, another STT
    row8({stt:'12',title:'Việc khác nội dung TEST702'}),             // same code, another STT
    row8({stt:'13',title:'Việc hoàn toàn mới TEST703'}),
  ]);
  expect(results(receipt)).toEqual([[2,'needs_reconciliation','CONTENT_UNDER_OTHER_STT'],[3,'needs_reconciliation','CODE_UNDER_OTHER_ROW'],[4,'imported']]);
  // inside one file: the same STT twice, the same code twice, the same content twice: both rows of each pair wait
  const dup=await go(tech,[
    row8({stt:'21',title:'Việc trùng STT một TEST711'}),row8({stt:'21',title:'Việc trùng STT hai TEST712'}),
    row8({stt:'22',title:'Việc trùng mã một TEST713'}),row8({stt:'23',title:'Việc trùng mã hai TEST713'}),
    row8({stt:'24',title:'Việc trùng nội dung không mã'}),row8({stt:'25',title:'Việc trùng nội dung không mã'}),
    row8({stt:'26',title:'Việc đứng một mình TEST715'}),
  ]);
  expect(results(dup.receipt)).toEqual([[2,'needs_reconciliation','DUPLICATE_STT'],[3,'needs_reconciliation','DUPLICATE_STT'],
    [4,'needs_reconciliation','DUPLICATE_CODE_IN_FILE'],[5,'needs_reconciliation','DUPLICATE_CODE_IN_FILE'],
    [6,'needs_reconciliation','DUPLICATE_CONTENT_IN_FILE'],[7,'needs_reconciliation','DUPLICATE_CONTENT_IN_FILE'],[8,'imported']]);
  expect(await n('work_requests')).toBe(4);
});

test('(16) a wrong preview digest is PREVIEW_STALE; the same request key returns the stored receipt; another file under that key is IDEMPOTENCY_CONFLICT',async()=>{
  const env=envelope([row8({stt:'1',title:'Việc chống ghi lặp TEST801'})]);
  const pre=await svc().preview(tech,env);
  const body=(over:R={})=>({...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[],...over});
  await expect(svc().commit(tech,body({previewDigest:'0'.repeat(64)}))).rejects.toMatchObject({code:'PREVIEW_STALE',status:409});
  await expect(svc().commit(tech,body({previewDigest:'xyz'}))).rejects.toBeInstanceOf(ZodError);
  expect(await n('work_requests')).toBe(0);
  const key=newKey();
  const first=await svc().commit(tech,body({requestKey:key}));
  expect(first.replayed).toBe(false);
  const replay=await svc().commit(tech,body({requestKey:key}));
  expect(replay.replayed).toBe(true);expect(replay.id).toBe(first.id);
  expect(replay.results).toEqual(first.results);
  expect(await n('work_requests')).toBe(1);expect(await n('work_import_batches')).toBe(1);
  // another file, its own correct digest, the same key
  const env2=envelope([row8({stt:'2',title:'Việc của tệp khác TEST802'})]);
  const pre2=await svc().preview(tech,env2);
  await expect(svc().commit(tech,{...env2,previewDigest:pre2.previewDigest,requestKey:key,projects:mapping(),owners:[]})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT',status:409});
  expect(await n('work_requests')).toBe(1);
  // the key belongs to its importer
  const other=await go(pm,[row8({stt:'3',title:'Việc của người khác TEST803'})],{key,projects:mapping({LBRC:ids.sales})});
  expect(other.receipt.replayed).toBe(false);
});

// ---------- BU mapping ----------
test('(11) an unknown BU label is UNMAPPED_BU; a default is offered only for one project with exactly the same name and BU',async()=>{
  const {pre,receipt}=await go(tech,[row8({stt:'1',bu:'ABCD',title:'Việc nhãn BU lạ TEST901'}),row8({stt:'2',title:'Việc nhãn BU quen TEST902'})]);
  expect(pre.buLabels.find(b=>b.label==='ABCD')).toEqual({label:'ABCD',rows:1,defaultProjectId:null});
  expect(results(receipt)).toEqual([[2,'needs_reconciliation','UNMAPPED_BU'],[3,'imported']]);
  await h.operator.query("UPDATE projects SET name='XECA - Team Tech' WHERE id=$1",[projectIds.xeca]);
  await h.operator.query("INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,'LBRC · Team Tech','LBRC')",[randomUUID(),ids.tenant]);
  const again=await svc().preview(tech,envelope([row8({stt:'3',bu:'XECA',title:'Việc nhãn quen TEST903'}),row8({stt:'4',title:'Việc hai dự án cùng tên TEST904'})]));
  expect(again.buLabels).toEqual(expect.arrayContaining([{label:'XECA',rows:1,defaultProjectId:null},{label:'LBRC',rows:1,defaultProjectId:null}]));
  expect(again.rows.map(r=>r.reasons)).toEqual([['UNMAPPED_BU'],['UNMAPPED_BU']]);
  // a label mapped to a project that is not in the tenant catalog is refused outright
  const env=envelope([row8({stt:'5',title:'Việc dự án ngoài tenant TEST905'})]);
  const pre5=await svc().preview(tech,env);
  await expect(svc().commit(tech,{...env,previewDigest:pre5.previewDigest,requestKey:newKey(),projects:[{buLabel:'LBRC',projectId:ids.otherProject}],owners:[]})).rejects.toMatchObject({status:404});
});

test('(12) every request is origin import and pending, with the source ref, a blank criteria and the cells as written; no work item appears',async()=>{
  const before=await n('work_items');
  const {receipt}=await go(tech,[
    row8({stt:'1',title:'Việc đầy đủ TEST1001',owner:'Người thực hiện',collab:'Người B',status:'Hoàn thành',due:'25/11/2026',note:'ghi chú đầy đủ'}),
    row8({stt:'2',bu:'XECA',title:'Việc XECA TEST1002'})]);
  expect(receipt.results.map(r=>r.result)).toEqual(['imported','imported']);
  const got=await rows<R>(`SELECT r.origin,r.state,r.source_ref,r.criteria,r.title,r.code,r.requester_id,r.requester_name,r.priority,r.spec_url,r.project_id,
      k.stt,k.source_row,k.source_ref ksr,k.owner_raw,k.collaborators_raw,k.source_status,k.due_raw,k.source_note,k.bu_label,k.source_id,k.sheet,k.source_type,k.quality_score,k.flags,k.fingerprint,k.content_hash,k.batch_id,k.ingested_at
    FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id ORDER BY k.stt`);
  expect(got[0]).toMatchObject({origin:'import',state:'pending',source_ref:refOf(2),ksr:refOf(2),criteria:'',title:'Việc đầy đủ TEST1001',code:'TEST1001',requester_id:tech.id,requester_name:tech.name,priority:'normal',
    spec_url:null,project_id:projectIds.lbrc,stt:'1',source_row:2,owner_raw:'Người thực hiện',collaborators_raw:'Người B',source_status:'Hoàn thành',due_raw:'25/11/2026',source_note:'ghi chú đầy đủ',
    bu_label:'LBRC',source_id:SOURCE_ID,sheet:SHEET,source_type:'google_sheet'});
  expect(got[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);expect(got[0].content_hash).toMatch(/^[a-f0-9]{64}$/);expect(got[0].ingested_at).toBeTruthy();
  // policy flags (OWNER_NOT_MAPPED, IBS_NOTE_NOT_STORED) do not lower the score; only defects of the sheet do
  expect(got[0].flags).toContain('OWNER_NOT_MAPPED');expect(got[0].quality_score).toBe(100);
  expect(got[1].quality_score).toBe(100-20*(got[1].flags as string[]).filter(f=>!['OWNER_NOT_MAPPED','IBS_NOTE_NOT_STORED'].includes(f)).length);
  expect(got[1].quality_score).toBe(80);
  expect(got[1]).toMatchObject({project_id:projectIds.xeca,source_ref:refOf(3),code:'TEST1002'});
  expect(await n('work_items')).toBe(before);
  const events=await rows<{kind:string;actor_id:string;payload:R}>('SELECT kind,actor_id,payload FROM work_request_events');
  expect(events.map(e=>e.kind)).toEqual(['submitted','submitted']);
  expect(events.every(e=>e.actor_id===tech.id&&e.payload.origin==='import'&&e.payload.batchId===got[0].batch_id)).toBe(true);
  // the imported request reads like any other request for the requester
  expect((await new WorkRequestService(h.db).list(tech,{})).items.every(i=>i.origin==='import'&&i.state==='pending')).toBe(true);
});

test('M8 câu 7 (2): a code is read from the title, then from the note for a LBRC or XECA row (CODE_FROM_NOTE), never from the note of an IBS HI row; two different codes are MULTI_CODE and the code stays blank; a title outside 5-200 characters is not imported or cut',async()=>{
  const long='x'.repeat(201);
  const {receipt}=await go(tech,[
    row8({stt:'1',title:'Việc có mã chỉ trong ghi chú',owner:'Người A',note:'xem LBRC014 ở đây'}),row8({stt:'9',title:'Việc có mã LBRC015 ở tiêu đề',note:'xem LBRC016 ở đây'}),
    row8({stt:'2',title:'Việc hai mã TEST1102 và TEST1103'}),
    row8({stt:'3',title:'Việc không có mã nào'}),
    row8({stt:'4',title:'ngắn'}),row8({stt:'5',title:long}),row8({stt:'',title:'Việc không có STT TEST1104'}),row8({stt:'a b c',title:'Việc STT chứa dấu cách TEST1105'}),
    row8({stt:'6',bu:'XECA',title:'Việc XECA mã ở ghi chú',note:'theo XECA031'}),row8({stt:'7',bu:'IBS HI',title:'Việc IBS mã ở ghi chú',note:'theo IBS0041'}),
    row8({stt:'8',title:'Việc ghi chú hai mã',note:'LBRC017 và LBRC018'}),
  ]);
  expect(results(receipt)).toEqual([[2,'imported'],[3,'imported'],[4,'imported'],[5,'imported'],[6,'needs_reconciliation','TITLE_LENGTH'],[7,'needs_reconciliation','TITLE_LENGTH'],
    [8,'needs_reconciliation','MISSING_STT'],[9,'needs_reconciliation','INVALID_STT'],[10,'imported'],[11,'imported'],[12,'imported']]);
  expect(receipt.results[0].flags).toContain('CODE_FROM_NOTE');expect(receipt.results[1].flags).not.toContain('CODE_FROM_NOTE');
  expect(receipt.results[2].flags).toContain('MULTI_CODE');expect(receipt.results[10].flags).toContain('MULTI_CODE');
  expect(receipt.results[9].flags).not.toContain('CODE_FROM_NOTE');
  expect(await rows('SELECT stt,code FROM work_import_rows ORDER BY stt')).toEqual([{stt:'1',code:'LBRC014'},{stt:'2',code:null},{stt:'3',code:null},{stt:'6',code:'XECA031'},{stt:'7',code:null},{stt:'8',code:null},{stt:'9',code:'LBRC015'}]);
  expect(await rows('SELECT k.stt,r.code FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id WHERE k.stt IN ($1,$2) ORDER BY k.stt',['1','6'])).toEqual([{stt:'1',code:'LBRC014'},{stt:'6',code:'XECA031'}]);
  // CODE_FROM_NOTE records the rule of this import, not a defect of the sheet: it does not lower the quality score (the row has an owner, a status and a due date)
  expect((await rows<{quality_score:number}>("SELECT quality_score FROM work_import_rows WHERE stt='1'"))[0].quality_score).toBe(100);
  // the preview carries the code the rows would get; an IBS HI row reads the title only
  const pre=await svc().preview(tech,envelope([row8({stt:'1',title:'Việc có mã LBRC020 ở tiêu đề',note:'xem LBRC021'}),row8({stt:'2',title:'Việc chỉ có mã ở ghi chú',note:'LBRC022'}),
    row8({stt:'3',bu:'IBS HI',title:'Việc IBS chỉ có mã ở ghi chú',note:'IBS0042'})]));
  expect(pre.rows.map(r=>r.code)).toEqual(['LBRC020','LBRC022',null]);
});

test('M8 câu 6: the batch keeps the name of the file the PM picked, with its hash and time; a path is refused; leaving the name out keeps it blank',async()=>{
  const env=envelope([row8({stt:'1',title:'Việc có tên tệp TEST1151'})],{fileName:'Đầu việc Tech - 25-11.csv'});
  const pre=await svc().preview(tech,env);
  const receipt=await svc().commit(tech,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[]});
  expect(receipt).toMatchObject({fileName:'Đầu việc Tech - 25-11.csv',fileHash:pre.fileHash});
  expect(await rows('SELECT file_name,file_hash,created_at IS NOT NULL AS timed FROM work_import_batches WHERE id=$1',[receipt.id])).toEqual([{file_name:'Đầu việc Tech - 25-11.csv',file_hash:pre.fileHash,timed:true}]);
  expect((await svc().receipt(tech,receipt.id)).fileName).toBe('Đầu việc Tech - 25-11.csv');
  for(const bad of ['../bang.csv','thu-muc/bang.csv','C:\\bang.csv','dòng\nhai.csv',''])
    await expect(svc().preview(tech,envelope([row8()],{fileName:bad}))).rejects.toBeInstanceOf(ZodError);
  const {receipt:plain}=await go(tech,[row8({stt:'2',title:'Việc không tên tệp TEST1152'})]);
  expect(plain.fileName).toBeNull();
});

test('M2 + M8: the owner cell may name a Team Tech member with no membership in the target project; the preview offers them and the request names them',async()=>{
  const env=envelope([row8({stt:'1',title:'Việc giao cho Tech TEST1161',owner:tech.name})]);
  const pre=await svc().preview(tech,env);
  expect(pre.owners).toEqual([{text:tech.name,rows:1,candidates:[expect.objectContaining({userId:tech.id,name:tech.name})]}]);
  expect(pre.owners[0].candidates[0].projectIds).toContain(projectIds.lbrc);
  const owners=[{text:tech.name,projectId:projectIds.lbrc,userId:tech.id}];
  const receipt=await svc().commit(tech,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners});
  expect(results(receipt)).toEqual([[2,'imported']]);
  expect((await rows<{assignee_id:string}>('SELECT r.assignee_id FROM work_requests r JOIN work_import_rows k ON k.request_id=r.id'))[0].assignee_id).toBe(tech.id);
  // a person who is neither an engineer of the project in the importer's scope nor on Team Tech is still refused
  const other=envelope([row8({stt:'2',title:'Việc giao cho điều phối TEST1162',owner:pm.name})]);
  const second=await svc().preview(tech,other);
  await expect(svc().commit(tech,{...other,previewDigest:second.previewDigest,requestKey:newKey(),projects:mapping(),owners:[{text:pm.name,projectId:projectIds.lbrc,userId:pm.id}]}))
    .rejects.toMatchObject({code:'OWNER_NOT_IN_PROJECT'});
});

test('a code that already names a work item of the target project is «cần đối soát» CODE_EXISTS and nothing is written for the row',async()=>{
  await h.operator.query(`INSERT INTO work_items(tenant_id,project_id,service_id,code,title,state) VALUES($1,$2,$3,'TEST1201','Việc đã có mã này','doing')`,[ids.tenant,ids.sales,ids.salesService]);
  const {receipt}=await go(pm,[row8({stt:'1',title:'Việc trùng mã việc có sẵn TEST1201'}),row8({stt:'2',title:'Việc mã mới TEST1202'})],{projects:mapping({LBRC:ids.sales})});
  expect(results(receipt)).toEqual([[2,'needs_reconciliation','CODE_EXISTS'],[3,'imported']]);
  expect(await n('work_import_rows')).toBe(1);
});

// ---------- IBS HI ----------
const SCAN_TYPES="('text','character varying','jsonb','json','ARRAY')";
/** Every text-like column of every table of the application schemas, searched for `needle`. */
async function whereFound(needle:string):Promise<string[]>{
  const cols=await rows<{s:string;t:string;c:string}>(`SELECT c.table_schema s,c.table_name t,c.column_name c FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE t.table_type='BASE TABLE' AND c.table_schema IN ('public','identity','analytics','intelligence') AND c.data_type IN ${SCAN_TYPES}`);
  const found:string[]=[];
  for(const {s,t,c} of cols){
    const hit=await rows<{n:string}>(`SELECT count(*) n FROM "${s}"."${t}" WHERE "${c}"::text LIKE $1`,['%'+needle+'%']);
    if(Number(hit[0].n)>0) found.push(`${s}.${t}.${c}`);
  }
  return found;
}
const logs=()=>{const sink:string[]=[];for(const m of ['log','error','warn','info','debug'] as const) vi.spyOn(console,m).mockImplementation((...a:unknown[])=>{sink.push(a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));});return sink;};

test('(13) IBS HI: the note canary is in no column of any table, no preview, commit answer, receipt or log; title, owner, collaborators, status and due are kept; LBRC and XECA rows keep the note',async()=>{
  const sink=logs();
  const lines=[
    row8({stt:'1',bu:'IBS HI',title:TITLE_CANARY+' TEST1301',owner:'Người thực hiện',collab:'Người B, Người C',status:'Đang làm',due:'25/11/2026',note:NOTE_CANARY}),
    row8({stt:'2',bu:'LBRC',title:'Việc LBRC có ghi chú TEST1302',note:KEPT_NOTE+'-lbrc'}),
    row8({stt:'3',bu:'XECA',title:'Việc XECA có ghi chú TEST1303',note:KEPT_NOTE+'-xeca'}),
  ];
  const env=envelope(lines);
  const pre=await svc().preview(tech,env);
  const answer=await svc().commit(tech,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[]});
  const receipt=await svc().receipt(tech,answer.id);
  for(const [name,doc] of [['preview',pre],['commit',answer],['receipt',receipt]] as const) expect(JSON.stringify(doc),name).not.toContain(NOTE_CANARY);
  expect(sink.join('\n')).not.toContain(NOTE_CANARY);
  // the IBS HI note exists nowhere; the LBRC and XECA notes exist in their row's source_note and nowhere else
  expect(await whereFound(NOTE_CANARY)).toEqual([]);
  expect(await whereFound(KEPT_NOTE+'-lbrc')).toEqual(['public.work_import_rows.source_note']);
  expect(await whereFound(KEPT_NOTE+'-xeca')).toEqual(['public.work_import_rows.source_note']);
  expect(answer.results[0]).toMatchObject({row:2,result:'imported'});
  expect(answer.results[0].flags).toContain('IBS_NOTE_NOT_STORED');
  expect(answer.results[1].flags).not.toContain('IBS_NOTE_NOT_STORED');
  // kept: the title, the owner text, the collaborators, the status, the due as written, the BU label, the code, the pointers and both hashes
  expect(await rows(`SELECT r.title,r.code,r.project_id,k.owner_raw,k.collaborators_raw,k.source_status,k.due_raw,k.source_note,k.bu_label,k.source_ref,k.fingerprint,k.content_hash
    FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id WHERE k.stt='1'`)).toEqual([expect.objectContaining({title:TITLE_CANARY+' TEST1301',code:'TEST1301',project_id:projectIds.ibs,owner_raw:'Người thực hiện',
      collaborators_raw:'Người B, Người C',source_status:'Đang làm',due_raw:'25/11/2026',source_note:'',bu_label:'IBS HI',source_ref:refOf(2)})]);
  // the preview does show the title of the IBS HI row (people metadata, as 011) but never a note
  expect(pre.rows[0]).toMatchObject({stt:'1',title:TITLE_CANARY+' TEST1301',result:'valid'});
  expect(Object.keys(pre.rows[0])).not.toContain('note');
});

test('(13) the IBS HI test is the union: the sheet label, the BU of the target project, or its latest confirmed domain mapping; and the database trigger refuses a note on such a row',async()=>{
  // the label LBRC is mapped to the IBS HI project: the project says IBS HI
  const a=await go(tech,[row8({stt:'1',title:'Việc nhãn LBRC dự án IBS TEST1401',note:NOTE_CANARY+'-a'})],{projects:mapping({LBRC:projectIds.ibs})});
  expect(a.receipt.results[0].flags).toContain('IBS_NOTE_NOT_STORED');
  // the label XECA is mapped to a project whose latest mapping is IBS_HI (an older one said XECA)
  await mapDomain(h,ids.transport,'XECA',1);await mapDomain(h,ids.transport,'IBS_HI',2);
  const b=await go(tech,[row8({stt:'2',bu:'XECA',title:'Việc nhãn XECA dự án đã ánh xạ IBS TEST1402',note:NOTE_CANARY+'-b'})],{projects:mapping({XECA:ids.transport})});
  expect(b.receipt.results[0].flags).toContain('IBS_NOTE_NOT_STORED');
  // the latest mapping says Liberico BU: the same project then keeps the note
  await mapDomain(h,ids.transport,'LIBERICO_BU',3);
  const c=await go(tech,[row8({stt:'3',bu:'XECA',title:'Việc dự án đã đổi miền TEST1403',note:KEPT_NOTE+'-c'})],{projects:mapping({XECA:ids.transport})});
  expect(c.receipt.results[0].flags).not.toContain('IBS_NOTE_NOT_STORED');
  expect(await whereFound(NOTE_CANARY+'-a')).toEqual([]);expect(await whereFound(NOTE_CANARY+'-b')).toEqual([]);
  expect(await whereFound(KEPT_NOTE+'-c')).toEqual(['public.work_import_rows.source_note']);
  // the trigger, whatever the writer: label, project BU, project mapping, and no tenant context at all
  const insert=(project:string,label:string,note:string,stt:string,context:boolean)=>h.operator.transaction(async tx=>{
    if(context) await tx.query("SELECT set_config('app.tenant_id',$1,true)",[ids.tenant]);
    const request=randomUUID(),batch=randomUUID();
    await tx.query(`INSERT INTO work_requests(id,tenant_id,project_id,requester_id,requester_name,origin,request_key,request_hash,title) VALUES($1,$2,$3,$4,'Tên thử','import',$5,$6,'Việc ghi trực tiếp thử')`,
      [request,ids.tenant,project,tech.id,randomUUID(),'c'.repeat(64)]);
    await tx.query(`INSERT INTO work_import_batches(id,tenant_id,importer_id,importer_name,request_key,preview_digest,file_hash,source_id,source_url,sheet,counts,mapping,mapping_hash,results)
      VALUES($1,$2,$3,'Tên thử',$4,$5,$5,'direct','https://docs.google.com/x','s','[]','{}',$5,'[]')`,[batch,ids.tenant,tech.id,randomUUID(),'d'.repeat(64)])
    await tx.query(`INSERT INTO work_import_rows(tenant_id,project_id,importer_id,batch_id,request_id,source_id,sheet,source_row,stt,source_ref,fingerprint,content_hash,bu_label,source_note,quality_score)
      VALUES($1,$2,$3,$4,$5,'direct','s',2,$6,'direct/s!A2:H2',$7,$7,$8,$9,100)`,[ids.tenant,project,tech.id,batch,request,stt,createHash('sha256').update(stt).digest('hex'),label,note]);
  });
  await expect(insert(projectIds.lbrc,'IBS HI','x','d1',true)).rejects.toThrow(/IBS HI import row holds no note/);
  await expect(insert(projectIds.ibs,'LBRC','x','d2',true)).rejects.toThrow(/IBS HI import row holds no note/);
  await mapDomain(h,projectIds.xeca,'IBS_HI',1);
  await expect(insert(projectIds.xeca,'XECA','x','d3',true)).rejects.toThrow(/IBS HI import row holds no note/);
  // no tenant context at all: the trigger does not need one (it reads the project itself, row security off)
  await expect(insert(projectIds.xeca,'XECA','x','d4',false)).rejects.toThrow(/IBS HI import row holds no note/);
  await expect(insert(projectIds.lbrc,'IBS HI - Tekla','x','d4b',false)).rejects.toThrow(/IBS HI import row holds no note/);
  await expect(insert(projectIds.lbrc,'ｉｂｓ-hi','x','d4c',false)).rejects.toThrow(/IBS HI import row holds no note/);
  await insert(projectIds.lbrc,'LBRC','','d5',false);
  await insert(projectIds.lbrc,'LBRC','a note on a Liberico BU row','d6',true);
  expect(await n("work_import_rows WHERE stt IN ('d5','d6')")).toBe(2);
});

// ---------- counts ----------
const walk=(v:unknown,fn:(k:string)=>void)=>{if(Array.isArray(v)) v.forEach(x=>walk(x,fn));else if(v&&typeof v==='object') for(const [k,x] of Object.entries(v)){fn(k);walk(x,fn);}};
test('(14) counts are per sheet BU label and per confirmed reporting domain; there is no key that sums across groups anywhere',async()=>{
  await mapDomain(h,projectIds.xeca,'XECA');
  const lines=[
    row8({stt:'1',title:'Việc LBRC một TEST1501'}),row8({stt:'2',title:'Việc LBRC hai TEST1502'}),row8({stt:'3',title:'Việc LBRC ngắn',due:''}),
    row8({stt:'4',bu:'XECA',title:'Việc XECA TEST1504'}),row8({stt:'5',bu:'IBS HI',title:'Việc IBS HI TEST1505'}),row8({stt:'6',bu:'ZZZ',title:'Việc nhãn lạ TEST1506'}),
    row8({stt:'7',title:'Việc LBRC trùng STT TEST1507'}),row8({stt:'7',title:'Việc LBRC trùng STT khác TEST1508'}),
  ];
  const {pre,receipt}=await go(tech,lines);
  const group=(c:{byBuLabel:{label:string}[]},label:string)=>c.byBuLabel.find(g=>g.label===label);
  for(const c of [pre.counts,receipt.counts]){
    expect(group(c,'LBRC')).toEqual({label:'LBRC',rows:5,valid:3,needsReconciliation:2,duplicate:0});
    expect(group(c,'XECA')).toEqual({label:'XECA',rows:1,valid:1,needsReconciliation:0,duplicate:0});
    expect(group(c,'IBS HI')).toEqual({label:'IBS HI',rows:1,valid:1,needsReconciliation:0,duplicate:0});
    expect(group(c,'ZZZ')).toEqual({label:'ZZZ',rows:1,valid:0,needsReconciliation:1,duplicate:0});
    // by confirmed reporting domain of the target project; unmapped projects are «Chưa xác nhận»; the unmapped label has no project and is not here
    // one group per unmapped target project: three unconfirmed projects are never folded into one figure
    expect(c.byReportingDomain).toEqual(expect.arrayContaining([{label:'Xeca',rows:1,valid:1,needsReconciliation:0,duplicate:0},
      {label:'Chưa xác nhận · LBRC · Team Tech',rows:5,valid:3,needsReconciliation:2,duplicate:0},{label:'Chưa xác nhận · IBS HI · Team Tech',rows:1,valid:1,needsReconciliation:0,duplicate:0}]));
    expect(c.byReportingDomain).toHaveLength(3);
    expect(c.byReportingDomain.some(g=>g.label==='Chưa xác nhận')).toBe(false);
  }
  // after the import, a second run counts the same rows as duplicates, per group
  const again=await go(tech,lines);
  expect(group(again.receipt.counts,'LBRC')).toEqual({label:'LBRC',rows:5,valid:0,needsReconciliation:2,duplicate:3});
  // nothing sums across groups: not in the answers, not in the stored batch
  const forbidden=/^(total|totals|sum|all|overall|grand|combined|rows_total|count)$/i;
  const stored=await rows<{counts:unknown;mapping:unknown;results:unknown}>('SELECT counts,mapping,results FROM work_import_batches');
  for(const doc of [pre,receipt,again.receipt,...stored]) walk(doc,k=>expect(k,'key '+k).not.toMatch(forbidden));
  expect(Object.keys(receipt.counts).sort()).toEqual(['byBuLabel','byReportingDomain']);
});

// ---------- approval ----------
test('(15) the importer who holds a BoM seat does not approve their own import; another seat approves and the work item carries the confirmed assignee; changing it later still needs 3/3',async()=>{
  const {receipt}=await go(pm,[row8({stt:'1',title:'Việc nhập để BoM duyệt TEST1601',owner:'Người thực hiện',status:'Hoàn thành'})],
    {projects:mapping({LBRC:ids.sales}),owners:[{text:'Người thực hiện',projectId:ids.sales,userId:member.id}]});
  expect(receipt.results[0].result).toBe('imported');
  const [req]=await rows<{id:string;version:number}>('SELECT id,version FROM work_requests');
  const decision=(over:R={})=>({decision:'approve',expectedVersion:req.version,serviceId:ids.salesService,code:null,note:'Đã xem xét và đồng ý tạo việc.',...over});
  await expect(new WorkRequestService(h.db).decide(pm,req.id,decision(),randomUUID())).rejects.toMatchObject({code:'SELF_APPROVAL',status:403});
  const done=await new WorkRequestService(h.db).decide(reviewer,req.id,decision(),randomUUID());
  expect(done.request).toMatchObject({state:'approved',decided_by:reviewer.id});
  expect(done.work).toMatchObject({code:'TEST1601',assignee_id:member.id,technical_id:null,business_id:null,state:'planned'});
  const audit=await rows<{payload:R}>("SELECT payload FROM audit_events WHERE work_id=$1 AND kind='created'",[done.work!.id]);
  expect(audit[0].payload).toMatchObject({requestId:req.id,requestedBy:pm.id,origin:'import'});
  // the initial assignment is the confirmed mapping; any later change of the assignee is stopped by the 3/3 guard
  await expect(scoped(h.db,pm,async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);
    await tx.query('UPDATE work_items SET assignee_id=$2 WHERE id=$1',[done.work!.id,pm.id]);
  })).rejects.toThrow();
  expect((await rows<{assignee_id:string}>('SELECT assignee_id FROM work_items WHERE id=$1',[done.work!.id]))[0].assignee_id).toBe(member.id);
});

test('the batch receipt reads back for its importer only, with row numbers and reason codes and no cell text',async()=>{
  const {receipt}=await go(tech,[row8({stt:'1',title:'Việc để đọc biên nhận TEST1701',note:KEPT_NOTE+'-r'}),row8({stt:'1',title:'Việc trùng STT TEST1702'})]);
  const read=await svc().receipt(tech,receipt.id);
  expect(read).toMatchObject({id:receipt.id,fileHash:receipt.fileHash,results:receipt.results});
  expect(JSON.stringify(read)).not.toContain('TEST1701');expect(JSON.stringify(read)).not.toContain(KEPT_NOTE);
  await expect(svc().receipt(pm,receipt.id)).rejects.toMatchObject({code:'NOT_FOUND',status:404});
  await expect(svc().receipt(tech,randomUUID())).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(svc().receipt(tech,'not-a-uuid')).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(svc().receipt(bot,receipt.id)).rejects.toMatchObject({code:'IMPORT_DENIED'});
  const stored=JSON.stringify((await rows('SELECT results,counts,mapping FROM work_import_batches'))[0]);
  expect(stored).not.toContain('TEST1701');
});

test('annotations: a BoM seat reads the source status, due and ref of an imported request beside it; a person without access to the project reads nothing',async()=>{
  await go(pm,[row8({stt:'1',title:'Việc có chú thích TEST1801',status:'Hoàn thành',due:'05/11/2026'})],{projects:mapping({LBRC:ids.sales})});
  const [req]=await rows<{id:string}>('SELECT id FROM work_requests');
  const seen=await svc().annotations(reviewer,[req.id]);
  expect(seen[req.id]).toMatchObject({sourceStatus:'Hoàn thành',dueRaw:'05/11/2026',sourceRef:refOf(2),sourceId:SOURCE_ID,sheet:SHEET,stt:'1',buLabel:'LBRC',flags:expect.any(Array)});
  expect(await svc().annotations(viewer,[req.id])).toEqual({});
  expect(await svc().annotations(member,[req.id])).toEqual({});
  expect(Object.keys(await svc().annotations(pm,[req.id]))).toEqual([req.id]);
});

test('(13) a code-shaped string in the note of an IBS HI row, by label or by target, is never read and reaches no column, preview, answer, receipt or log; the note of a LBRC row is read (M8 câu 7 (2), 0.9.2)',async()=>{
  const sink=logs();
  const SHAPED='ABC123';
  const note=`xem ${SHAPED} ở đây`;
  const lines=[row8({stt:'1',bu:'IBS HI',title:'Việc IBS HI không có mã trong tiêu đề',note}),row8({stt:'2',bu:'LBRC',title:'Việc LBRC không có mã trong tiêu đề',note})];
  const env=envelope(lines);
  const pre=await svc().preview(tech,env);
  const answer=await svc().commit(tech,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[]});
  const receipt=await svc().receipt(tech,answer.id);
  const via=await go(tech,[row8({stt:'3',bu:'LBRC',title:'Việc nhãn LBRC dự án IBS HI không mã',note:'xem DEF456'})],{projects:mapping({LBRC:projectIds.ibs})});
  expect(await rows('SELECT stt,code,source_note FROM work_import_rows ORDER BY stt')).toEqual([{stt:'1',code:null,source_note:''},{stt:'2',code:SHAPED,source_note:note},{stt:'3',code:null,source_note:''}]);
  expect(await whereFound('DEF456')).toEqual([]);
  // the IBS HI row says nothing of its note anywhere; the LBRC row carries its code, flagged as taken from the note
  const one=(doc:{rows?:{stt:string}[];results?:{stt?:string}[]})=>JSON.stringify((doc.rows??doc.results??[]).filter(r=>r.stt==='1'));
  for(const [name,doc] of [['preview',pre],['receipt',receipt]] as const) expect(one(doc as never),name).not.toContain(SHAPED);
  expect(pre.rows.find(r=>r.stt==='2')).toMatchObject({code:SHAPED,flags:expect.arrayContaining(['CODE_FROM_NOTE'])});
  expect(JSON.stringify(via.receipt)).not.toContain('DEF456');
  expect(sink.join('\n')).not.toContain('DEF456');
  // no count or flag of an IBS HI row says anything of the note's content beyond that it was not stored
  const two=await go(tech,[row8({stt:'4',bu:'IBS HI',title:'Việc IBS HI hai mã trong ghi chú',note:'GHI111 và GHI222'})]);
  expect(two.receipt.results[0].flags).not.toContain('MULTI_CODE');
  expect(two.receipt.results[0].flags).not.toContain('CODE_FROM_NOTE');
});

// ======================= fix batch (items 1-22 of the review) =======================
const stored=(stt:string)=>rows<{fingerprint:string;content_hash:string;request_hash:string;source_note:string;code:string|null}>(
  `SELECT k.fingerprint,k.content_hash,r.request_hash,k.source_note,k.code FROM work_import_rows k JOIN work_requests r ON r.id=k.request_id WHERE k.stt=$1`,[stt]).then(x=>x[0]);

test('(2) two IBS HI rows that differ only in the note have the same fingerprint, content hash and request hash; a held IBS HI row and an upload that differs only in the note is «trùng» with no reason',async()=>{
  const ibs=(note:string)=>[row8({stt:'1',bu:'IBS HI',title:'Việc IBS HI để so băm',owner:'Người A',status:'Đang làm',due:'25/11/2026',note})];
  await go(tech,ibs('ghi-chú-một'));
  const first=await stored('1');
  // the same sheet row with another note, in an empty database
  await h.operator.query('TRUNCATE work_import_batches CASCADE');await h.operator.query('TRUNCATE work_requests CASCADE');
  await go(tech,ibs('một-ghi-chú-hoàn-toàn-khác'));
  const second=await stored('1');
  expect(second).toEqual(first);
  expect(first.source_note).toBe('');
  // held row + upload that differs only in the note: the same row, no «SOURCE_CHANGED», no «CONTENT…», nothing that says the note changed
  const again=await go(tech,ibs('lần-ba-ghi-chú-khác'));
  expect(again.pre.rows[0]).toMatchObject({result:'duplicate',reasons:[]});
  expect(again.receipt.results[0]).toMatchObject({result:'duplicate',reasons:[]});
  // a non-IBS row keeps the note in its hashes: a changed note is a changed row
  await go(tech,[row8({stt:'7',bu:'XECA',title:'Việc XECA để so băm',note:'ghi-chú-xeca-một'})]);
  const changed=await go(tech,[row8({stt:'7',bu:'XECA',title:'Việc XECA để so băm',note:'ghi-chú-xeca-hai'})]);
  expect(changed.receipt.results[0]).toMatchObject({result:'needs_reconciliation',reasons:['SOURCE_CHANGED']});
  // the request hash is of the stored request fields: it does not move with a note of a non-IBS row either
  expect((await stored('7')).request_hash).toMatch(/^[a-f0-9]{64}$/);
});

test('(5) the conflict answer is a class by row and nothing else: no person, project, request or content; and preview and commit read it the same',async()=>{
  await go(tech,[row8({stt:'1',title:'Việc đã nhập từ trước TEST5001',note:'ghi chú riêng'})]);
  const ask=(who:Principal,stt:string[],code:(string|null)[],content:string[],fp:string[])=>scoped(h.db,who,async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[who.id]);
    return (await tx.query<R>('SELECT * FROM public.work_import_key_conflicts($1,$2,$3::text[],$4::text[],$5::text[],$6::text[])',[SOURCE_KEY,SHEET,stt,code,content,fp])).rows;
  });
  const [held]=await rows<{stt:string;fingerprint:string;content_hash:string}>('SELECT stt,fingerprint,content_hash FROM work_import_rows');
  const stt=[held.stt,held.stt,'2','3','4'],code=[null,null,null,'TEST5001',null];
  const content=['x'.repeat(64),'x'.repeat(64),held.content_hash,'y'.repeat(64),'z'.repeat(64)],fp=[held.fingerprint,'e'.repeat(64),'f'.repeat(64),'f'.repeat(64),'f'.repeat(64)];
  // the importer reads the held row, so it is told every class: unchanged, changed, its content under another STT, its code under another row
  expect(await ask(tech,stt,code,content,fp)).toEqual([{idx:1,class:'DUPLICATE'},{idx:2,class:'SOURCE_CHANGED'},{idx:3,class:'CONTENT_UNDER_OTHER_STT'},{idx:4,class:'CODE_UNDER_OTHER_ROW'},{idx:5,class:null}]);
  // a manager who cannot read that project's rows learns only the declared disclosure, «this STT was already imported in this source» (STT_IMPORTED), the same answer
  // whether the guess of its content is right or wrong; a guessed code or content of that row answers like one that was never imported (Codex P0, gate round 1)
  const out=await ask(pm,stt,code,content,fp);
  expect(out).toEqual([{idx:1,class:'STT_IMPORTED'},{idx:2,class:'STT_IMPORTED'},{idx:3,class:null},{idx:4,class:null},{idx:5,class:null}]);
  for(const r of out) expect(Object.keys(r).sort()).toEqual(['class','idx']);
  // another source or another tenant: nothing; no person set in the context: nothing
  expect(await scoped(h.db,pm,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);
    return (await tx.query('SELECT * FROM public.work_import_key_conflicts($1,$2,$3::text[],$4::text[],$5::text[],$6::text[])',['OTHERKEYOTHERKEY1',SHEET,[held.stt],[null],[held.content_hash],[held.fingerprint]])).rows.filter((r:R)=>r.class);})).toEqual([]);
  expect(await scoped(h.db,pm,async tx=>(await tx.query('SELECT * FROM public.work_import_key_conflicts($1,$2,$3::text[],$4::text[],$5::text[],$6::text[])',[SOURCE_KEY,SHEET,[held.stt],[null],[held.content_hash],[held.fingerprint]])).rows)).toEqual([]);   // no person in the context
  expect((await ask({...pm,tenantId:ids.otherTenant,projectIds:[ids.otherProject]},[held.stt],[null],[held.content_hash],[held.fingerprint])).filter(r=>r.class)).toEqual([]);
  // the columns of the answer are the whole disclosure
  const cols=await rows<{n:string}>("SELECT unnest(proargnames) n FROM pg_proc WHERE proname='work_import_key_conflicts' AND proargmodes IS NOT NULL ORDER BY 1");
  expect(cols.map(c=>c.n).filter(n=>['idx','class'].includes(n)).sort()).toEqual(['class','idx']);
  // preview and commit use it alike: a second importer with no sight of the rows is told «STT đã được nhập» in the preview as at the commit, and nothing is written
  const second:Principal={...tech,id:'14000000-0000-4000-8000-000000000078',name:'Thành viên Tech hai'};
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'imp-tech2',$3,'viewer','fixture-only')`,[second.id,ids.tenant,second.name]);
  await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,second.id,ids.transport]);
  await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,second.id]);
  const seen=await go(second,[row8({stt:'1',title:'Việc đã nhập từ trước TEST5001',note:'ghi chú riêng'})]);
  expect([seen.pre.rows[0].result,...seen.pre.rows[0].reasons]).toEqual(['needs_reconciliation','STT_IMPORTED']);
  expect(results(seen.receipt)).toEqual([[2,'needs_reconciliation','STT_IMPORTED']]);
  expect(await n('work_import_rows')).toBe(1);expect(await n('work_requests')).toBe(1);
});

test('(22) a commit is no probe either: the code and content keys are per importer, the STT key per source and sheet; a BoM seat of the project is told every class',async()=>{
  const defs=await rows<{conname:string;def:string}>("SELECT conname,pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid='public.work_import_rows'::regclass AND conname LIKE 'work_import_key_%' ORDER BY conname");
  expect(defs.map(d=>[d.conname,d.def.replace(/\s+/g,' ')])).toEqual([
    ['work_import_key_code','UNIQUE (tenant_id, source_id, sheet, importer_id, code)'],
    ['work_import_key_content','UNIQUE (tenant_id, source_id, sheet, importer_id, content_hash)'],
    ['work_import_key_stt','UNIQUE (tenant_id, source_id, sheet, stt)'],
  ]);
  await go(tech,[row8({stt:'1',title:'Việc đã nhập ở LBRC TEST2201'}),row8({stt:'4',title:'Việc không mã đã nhập ở LBRC',note:'ghi chú hai hai'})]);
  // the manager of sales cannot read the LBRC rows: a new STT with the code of one, and a new STT with the very content of the other, go in like rows never imported
  const lbrcSales=[{buLabel:'LBRC',projectId:ids.sales}];
  const asPm=await go(pm,[row8({stt:'2',title:'Việc khác ở bán hàng TEST2201'}),row8({stt:'3',title:'Việc không mã đã nhập ở LBRC',note:'ghi chú hai hai'})],{projects:lbrcSales});
  expect(asPm.pre.rows.map(r=>[r.result,...r.reasons])).toEqual([['valid'],['valid']]);
  expect(results(asPm.receipt)).toEqual([[2,'imported'],[3,'imported']]);
  // the manager reads their own rows: the same file again is «trùng»
  expect(results((await go(pm,[row8({stt:'2',title:'Việc khác ở bán hàng TEST2201'})],{projects:lbrcSales})).receipt)).toEqual([[2,'duplicate']]);
  // a row of sales imported by the Tech member: the manager holds a BoM seat of sales, reads it, and is told its code and its change
  await go(tech,[row8({stt:'5',title:'Việc của bán hàng TEST2205'})],{projects:lbrcSales});
  const seat=await svc().preview(pm,{...envelope([row8({stt:'5',title:'Việc của bán hàng đã sửa, bỏ mã'}),row8({stt:'6',title:'Việc mới cùng mã TEST2205'})]),projects:lbrcSales});
  expect(seat.rows.map(r=>[r.result,...r.reasons])).toEqual([['needs_reconciliation','SOURCE_CHANGED'],['needs_reconciliation','CODE_UNDER_OTHER_ROW']]);
});

test('(23) the database refuses a batch from the bot, a viewer or an engineer, who may import into no project; a Team Tech member and a manager write theirs',async()=>{
  const insert=(who:Principal)=>scoped(h.db,who,async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[who.id]);
    await tx.query(`INSERT INTO work_import_batches(tenant_id,importer_id,importer_name,request_key,preview_digest,file_hash,source_id,source_url,sheet,counts,mapping,mapping_hash,results)
      VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,'{}','{}',$5,'[]')`,[who.tenantId,who.id,who.name,newKey(),'a'.repeat(64),SOURCE_KEY,SOURCE_URL,SHEET]);
  });
  for(const who of [bot,viewer,member]){
    const e=await insert(who).then(()=>null,x=>x as {code?:string});
    expect(e,'expected a refusal for '+who.role).toBeTruthy();expect(e?.code).toBe('42501');
  }
  await insert(tech);await insert(pm);
  expect(await n('work_import_batches')).toBe(2);
});

test('(6) the source is the spreadsheet key alone: the same file under a link with another gid, or none, imports 0 more; only the tab «Đầu việc Tech» is accepted',async()=>{
  const lines=[row8({stt:'1',title:'Việc cùng bảng khác liên kết TEST6001'})];
  const link=(tail:string)=>`https://docs.google.com/spreadsheets/d/${SOURCE_KEY}/edit${tail}`;
  const importVia=async(url:string)=>{const env=envelope(lines,{sourceUrl:url});const pre=await svc().preview(tech,env);
    return svc().commit(tech,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[]});};
  expect((await importVia(SOURCE_URL)).results[0].result).toBe('imported');
  for(const tail of ['#gid=0','','?gid=999','?gid=0#gid=5'])
    expect((await importVia(link(tail))).results[0].result,tail).toBe('duplicate');
  expect(await n('work_requests')).toBe(1);
  expect((await rows<{source_id:string}>('SELECT source_id FROM work_import_rows'))[0].source_id).toBe(SOURCE_KEY);
  await expect(svc().preview(tech,envelope(lines,{sheet:'Trang khác'}))).rejects.toBeInstanceOf(ZodError);
  // a decomposed spelling of the same tab name is the same tab, stored in the composed form
  expect((await svc().preview(tech,envelope(lines,{sheet:SHEET.normalize('NFD')}))).source.sheet).toBe(SHEET);
});

test('(8) an unchanged file imported again after a seat approved the request is «trùng», not «CODE_EXISTS»',async()=>{
  const lines=[row8({stt:'1',title:'Việc nhập rồi duyệt TEST8001',owner:'Người thực hiện'})];
  const sales=mapping({LBRC:ids.sales}),owners=[{text:'Người thực hiện',projectId:ids.sales,userId:member.id}];
  const first=await go(pm,lines,{projects:sales,owners});
  expect(first.receipt.results[0].result).toBe('imported');
  const [req]=await rows<{id:string;version:number}>('SELECT id,version FROM work_requests');
  const done=await new WorkRequestService(h.db).decide(reviewer,req.id,{decision:'approve',expectedVersion:req.version,serviceId:ids.salesService,code:null,note:'Đã xem xét và đồng ý tạo việc.'},randomUUID());
  expect(done.work).toMatchObject({code:'TEST8001',assignee_id:member.id});
  const again=await go(pm,lines,{projects:sales,owners});
  expect(again.pre.rows[0]).toMatchObject({result:'duplicate',reasons:[]});
  expect(again.receipt.results[0]).toMatchObject({result:'duplicate',reasons:[]});
  expect(await n('work_requests')).toBe(1);
  // another row of the file that really clashes with the work item still waits
  await h.operator.query(`INSERT INTO work_items(tenant_id,project_id,service_id,code,title,state) VALUES($1,$2,$3,'TEST8002','Việc có sẵn mã khác','doing')`,[ids.tenant,ids.sales,ids.salesService]);
  const clash=await go(pm,[row8({stt:'2',title:'Việc khác trùng mã TEST8002'})],{projects:sales});
  expect(clash.receipt.results[0]).toMatchObject({result:'needs_reconciliation',reasons:['CODE_EXISTS']});
});

test('(11) any label that contains «ibs» once normalised is read as IBS HI: its note is dropped even when it is mapped to a project that is not',async()=>{
  for(const [i,label] of ['IBS HI - Tekla','Ibs-hi','ＩＢＳ'].entries()){
    const stt=String(i+1);
    const r=await go(tech,[row8({stt,bu:label,title:`Việc nhãn lạ có IBS số ${stt}`,note:NOTE_CANARY+stt})],{projects:[{buLabel:label,projectId:ids.transport}]});
    expect(r.receipt.results[0],label).toMatchObject({result:'imported'});
    expect(r.receipt.results[0].flags).toContain('IBS_NOTE_NOT_STORED');
    expect((await stored(stt)).source_note).toBe('');
    expect(await whereFound(NOTE_CANARY+stt)).toEqual([]);
  }
});

test('(10) a row with no target project is read without its note: its hashes do not depend on it, and an explicit empty mapping leaves every row «UNMAPPED_BU»',async()=>{
  const a=await svc().preview(tech,envelope([row8({stt:'1',title:'Việc chưa có đích TEST1001',note:'ghi-chú-một'})]));
  const b=await svc().preview(tech,{...envelope([row8({stt:'1',title:'Việc chưa có đích TEST1001',note:'ghi-chú-hai'})]),projects:[]});
  expect(a.rows[0].reasons).toEqual([]);
  expect(b.rows[0].reasons).toEqual(['UNMAPPED_BU']);
  expect(b.counts.byReportingDomain).toEqual([]);
});

test('(13) an owner is bound to a cell text only when the account name is that text',async()=>{
  const lines=[row8({stt:'1',title:'Việc gán người sai tên TEST1301',owner:'Tên khác hẳn'})];
  const pre=await svc().preview(pm,envelope(lines));
  await expect(svc().commit(pm,{...envelope(lines),previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping({LBRC:ids.sales}),owners:[{text:'Tên khác hẳn',projectId:ids.sales,userId:member.id}]})).rejects.toMatchObject({code:'OWNER_NOT_IN_PROJECT'});
  await expect(svc().preview(pm,{...envelope(lines),projects:mapping({LBRC:ids.sales}),owners:[{text:'Tên khác hẳn',projectId:ids.sales,userId:member.id}]})).rejects.toMatchObject({code:'OWNER_NOT_IN_PROJECT'});
  expect(await n('work_requests')).toBe(0);
});

test('(14) rows are filed in STT order, whatever their order in the file; the receipt keeps the file order',async()=>{
  const sink:string[]=[];
  const wrap=(q:Queryable):Queryable=>({query:async<T=R>(sql:string,params?:unknown[])=>{if(/INSERT INTO work_import_rows/.test(sql)) sink.push(String(params![8]));return q.query<T>(sql,params);}});
  const spy:Database={...wrap(h.db),transaction:fn=>h.db.transaction(tx=>fn(wrap(tx))),close:()=>h.db.close()};
  const s=new SheetImportService(spy);
  const env=envelope([row8({stt:'9',title:'Việc chín TEST1409'}),row8({stt:'3',title:'Việc ba TEST1403'}),row8({stt:'5',title:'Việc năm TEST1405'})]);
  const pre=await s.preview(tech,env);
  const done=await s.commit(tech,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping(),owners:[]});
  expect(sink).toEqual(['3','5','9']);
  expect(done.results.map(r=>[r.row,r.stt])).toEqual([[2,'9'],[3,'3'],[4,'5']]);
});

test('(16) a row whose content is held under another STT reads as held, not as changed (renumbered or swapped STT)',async()=>{
  await go(tech,[row8({stt:'1',title:'Việc thứ nhất TEST1601'}),row8({stt:'2',title:'Việc thứ hai TEST1602'})]);
  const swapped=await go(tech,[row8({stt:'1',title:'Việc thứ hai TEST1602'}),row8({stt:'2',title:'Việc thứ nhất TEST1601'})]);
  expect(results(swapped.receipt)).toEqual([[2,'needs_reconciliation','CONTENT_UNDER_OTHER_STT'],[3,'needs_reconciliation','CONTENT_UNDER_OTHER_STT']]);
  // an edited row (content held nowhere) is still a change
  const edited=await go(tech,[row8({stt:'1',title:'Việc thứ nhất đã sửa TEST1601'})]);
  expect(results(edited.receipt)).toEqual([[2,'needs_reconciliation','SOURCE_CHANGED']]);
});

test('(17) the preview takes the mapping the commit will use: counts, flags, the IBS HI decision and CODE_EXISTS are then the commit\'s',async()=>{
  await h.operator.query(`INSERT INTO work_items(tenant_id,project_id,service_id,code,title,state) VALUES($1,$2,$3,'TEST1701','Việc đã có mã này','doing')`,[ids.tenant,ids.sales,ids.salesService]);
  const lines=[row8({stt:'1',title:'Việc xem trước theo ánh xạ TEST1701',note:NOTE_CANARY+'-p'}),row8({stt:'2',title:'Việc thứ hai TEST1702'})];
  const env=envelope(lines);
  const byDefault=await svc().preview(tech,env);
  expect(byDefault.rows[0].reasons).toEqual([]);
  // mapped into the sales project: the code clash shows now
  const into=async(who:Principal,project:string)=>svc().preview(who,{...env,projects:[{buLabel:'LBRC',projectId:project}]});
  const sales=await into(pm,ids.sales);
  expect(sales.rows[0].reasons).toEqual(['CODE_EXISTS']);expect(sales.counts.byBuLabel[0]).toEqual({label:'LBRC',rows:2,valid:1,needsReconciliation:1,duplicate:0});
  // mapped into the IBS HI project: the note is not stored, said by the preview too
  const ibs=await into(tech,projectIds.ibs);
  expect(ibs.rows[0].flags).toContain('IBS_NOTE_NOT_STORED');expect(JSON.stringify(ibs)).not.toContain(NOTE_CANARY);
  // unselected: no target, the rows need reconciliation
  expect((await svc().preview(tech,{...env,projects:[]})).rows.map(r=>r.reasons)).toEqual([['UNMAPPED_BU'],['UNMAPPED_BU']]);
  // and the preview of a mapping is the commit of that mapping
  const pre=await into(pm,ids.sales);
  const done=await svc().commit(pm,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:[{buLabel:'LBRC',projectId:ids.sales}],owners:[]});
  expect(done.results.map(r=>[r.result,...r.reasons])).toEqual(pre.rows.map(r=>[r.result==='valid'?'imported':r.result,...r.reasons]));
  expect(done.counts).toEqual(pre.counts);
});

test('(18) the same request key and preview with another mapping is IDEMPOTENCY_CONFLICT; with the same mapping it replays',async()=>{
  const env=envelope([row8({stt:'1',title:'Việc khoá chống lặp theo ánh xạ TEST1801'})]);
  const pre=await svc().preview(tech,env);
  const key=newKey();
  const body=(projects:{buLabel:string;projectId:string}[])=>({...env,previewDigest:pre.previewDigest,requestKey:key,projects,owners:[]});
  const first=await svc().commit(tech,body(mapping()));
  expect((await svc().commit(tech,body(mapping()))).replayed).toBe(true);
  await expect(svc().commit(tech,body([{buLabel:'LBRC',projectId:projectIds.xeca}]))).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT',status:409});
  expect(first.replayed).toBe(false);expect(await n('work_requests')).toBe(1);
});

test('(21) work_import_project_facts answers nothing for a person who is neither on the Team Tech roster nor holds a grant in the project',async()=>{
  const facts=(who:Principal,project:string)=>scoped(h.db,who,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[who.id]);
    return (await tx.query('SELECT * FROM public.work_import_project_facts($1)',[project])).rows;});
  expect(await facts(viewer,ids.sales)).toEqual([]);          // outsider: not Tech, no grant in sales
  expect(await facts(member,projectIds.lbrc)).toEqual([]);
  expect(await facts(tech,projectIds.lbrc)).toEqual([{bu:'LBRC',domain_code:null}]);   // a Team Tech member sees any project of the tenant
  expect(await facts(pm,ids.sales)).toHaveLength(1);           // a grant in the project
});

test('(11) the preview says per row whether it is read title-only: label, project BU, latest mapping or no target',async()=>{
  await mapDomain(h,ids.transport,'IBS_HI',1);
  const env=envelope([row8({stt:'1',bu:'LBRC',title:'Việc nhãn thường TEST1101'}),row8({stt:'2',bu:'IBS HI - Tekla',title:'Việc nhãn có IBS TEST1102'}),row8({stt:'3',bu:'XECA',title:'Việc dự án đã ánh xạ IBS TEST1103'}),row8({stt:'4',bu:'ZZZ',title:'Việc không đích TEST1104'})]);
  const pre=await svc().preview(tech,{...env,projects:[{buLabel:'LBRC',projectId:projectIds.lbrc},{buLabel:'IBS HI - Tekla',projectId:ids.sales},{buLabel:'XECA',projectId:ids.transport}]});
  expect(pre.rows.map(r=>r.titleOnly)).toEqual([false,true,true,true]);
});

test('(17) per target project: a manager of X who is not a manager of Y and not on the roster files the X rows; the Y rows are NOT_A_FILER, in the preview as in the commit',async()=>{
  const mx:Principal={id:'14000000-0000-4000-8000-000000000091',tenantId:ids.tenant,projectIds:[ids.sales,ids.transport],name:'Điều phối X thử',role:'viewer',
    grants:[{projectId:ids.sales,role:'manager',reportPermissions:[]},{projectId:ids.transport,role:'viewer',reportPermissions:[]}]};
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'imp-mx',$3,'viewer','fixture-only')`,[mx.id,ids.tenant,mx.name]);
  await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'manager'),($1,$2,$4,'viewer')`,[ids.tenant,mx.id,ids.sales,ids.transport]);
  const lines=[row8({stt:'1',bu:'LBRC',title:'Việc cho dự án X một TEST1701'}),row8({stt:'2',bu:'LBRC',title:'Việc cho dự án X hai TEST1702'}),
    row8({stt:'3',bu:'XECA',title:'Việc cho dự án Y một TEST1703'}),row8({stt:'4',bu:'XECA',title:'Việc cho dự án Y hai TEST1704'})];
  const projects=[{buLabel:'LBRC',projectId:ids.sales},{buLabel:'XECA',projectId:ids.transport}];
  const out=await go(mx,lines,{projects}).catch((e:Error)=>e);
  expect(out).not.toBeInstanceOf(Error);
  const {pre,receipt}=out as Awaited<ReturnType<typeof go>>;
  const shape=(r:{result:string;reasons:string[]})=>[r.result,...r.reasons];
  expect(pre.rows.map(shape)).toEqual([['valid'],['valid'],['needs_reconciliation','NOT_A_FILER'],['needs_reconciliation','NOT_A_FILER']]);
  expect(receipt.results.map(shape)).toEqual([['imported'],['imported'],['needs_reconciliation','NOT_A_FILER'],['needs_reconciliation','NOT_A_FILER']]);
  expect(receipt.counts.byBuLabel).toEqual(pre.counts.byBuLabel);
  expect(receipt.counts.byBuLabel).toEqual([{label:'LBRC',rows:2,valid:2,needsReconciliation:0,duplicate:0},{label:'XECA',rows:2,valid:0,needsReconciliation:2,duplicate:0}]);
  expect(await n('work_requests')).toBe(2);expect(await n('work_import_rows')).toBe(2);
  expect(await rows('SELECT DISTINCT project_id FROM work_requests')).toEqual([{project_id:ids.sales}]);
  // a viewer-only grant to Y never lets a Y row through: the same answer when Y is the only target
  const only=await go(mx,[row8({stt:'9',bu:'XECA',title:'Việc chỉ cho dự án Y TEST1709'})],{projects});
  expect(only.receipt.results.map(shape)).toEqual([['needs_reconciliation','NOT_A_FILER']]);
  expect(await n('work_requests')).toBe(2);
});
