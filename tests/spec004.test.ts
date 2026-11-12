import { afterEach,beforeEach,expect,test } from 'vitest';
import { createHash,randomUUID } from 'node:crypto';
import { embeddedDatabase,pooledDatabase,scoped,type Database } from '../src/server/db';
import { demoProfiles as demo,ids,otherPrincipal } from '../src/server/identities';
import { BomService } from '../src/server/bom';
import { WorkService } from '../src/server/service';
import { seed } from '../src/server/seed';
import type { Principal } from '../src/server/types';

const source='Đầu việc Tech!A6:H6';
const sha='8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const testFingerprint=digest([source,'LBRC','Triển khai bot Hermes','QuânTV, PhươngHV','Đang triển khai'].join('|'));
const chair={...demo.manager,id:randomUUID(),name:'Quản trị thử nghiệm'};
const quyen={...demo.engineer,name:'BoM kỹ thuật thử nghiệm'};
const manager={...demo.manager,name:'BoM điều phối thử nghiệm'};
const third:Principal={...demo.engineer,id:randomUUID(),name:'Ghế BoM thử nghiệm'};
const roster=[quyen,manager,third];
const stt5=randomUUID();
let db:Database, operator:Database, bom:BomService, work:WorkService;
const key=()=>randomUUID();
const selection={lead_id:manager.id,parts:[{owner_id:quyen.id,output:'Hồ sơ bàn giao triển khai thử',
  criteria:'Có kết quả kiểm tra và mốc ghi nhận',dueAt:null,dependency:''}]};
const submit=(allocation=selection,priorId?:string)=>bom.command(manager,
  {action:'propose',workId:stt5,expectedVersion:1,allocation,reason:'Phân công mô phỏng trong bản thử',priorId},key());
const agree=(proposalId:string,p:Principal,requestKey=key())=>bom.command(p,
  {action:'vote',proposalId,choice:'agree',note:'Xác nhận bằng phiên thử nghiệm'},requestKey);

beforeEach(async()=>{
  process.env.LIBETECH_DEMO='1';
  const native=process.env.SPEC004_TEST_DATABASE_URL;
  const web=process.env.SPEC004_WEB_DATABASE_URL;
  if(native&&(!/^spec004_verify(?:_[0-9]+)?$/.test(new URL(native).pathname.slice(1))
    ||new URL(native).hostname!=='127.0.0.1')) throw new Error('Use an isolated loopback SPEC-004 database.');
  if(web&&(!native||new URL(web).host!==new URL(native).host||new URL(web).pathname!==new URL(native).pathname)) {
    throw new Error('Web must use the same isolated test database.');
  }
  operator=native?pooledDatabase(native):await embeddedDatabase();
  db=web?pooledDatabase(web,true):operator;
  await seed(operator);
  bom=new BomService(db);work=new WorkService(db);
  for(const [index,p] of [...roster,chair].entries()) {
    await operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
      VALUES($1,$2,$3,$4,$5,'test-fixture')`,[p.id,p.tenantId,'spec004-'+index,p.name,p.role]);
    await operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id) VALUES($1,$2,$3)',[p.tenantId,p.id,ids.sales]);
    await operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[p.tenantId,p.id,String(index+1)]);
  }
  await operator.query(`INSERT INTO work_items(id,tenant_id,project_id,service_id,code,title,state,assignee_id)
    VALUES($1,$2,$3,$4,'STT-5','Triển khai bot Hermes','doing',$5)`,[stt5,ids.tenant,ids.sales,ids.salesService,quyen.id]);
  await operator.query('INSERT INTO bom_scopes(tenant_id,project_id,seat_ids,enabled) VALUES($1,$2,$3,true)',
    [ids.tenant,ids.sales,roster.map(p=>p.id)]);
  await operator.query(`INSERT INTO bom_sources(work_id,tenant_id,project_id,source_ref,fingerprint,checked_at,valid_until)
    VALUES($1,$2,$3,$4,$5,now(),now()+interval '1 minute')`,[stt5,ids.tenant,ids.sales,source,testFingerprint]);
  await operator.query(`INSERT INTO analytics.reconciliations(tenant_id,project_id,code,source_id,source_type,ingested_at,
    quality_score,source_sha,snapshot_hash,result) VALUES($1,$2,'LBRC014',$3,'github-rest+workbook-snapshot',now(),.75,$4,$5,$6)`,
    [ids.tenant,ids.sales,'https://github.com/liberico-ai/btnet-saleman/commit/'+sha,sha,digest(sha),
      JSON.stringify({code:'LBRC014',sourceStatus:'Hoàn thành',acceptedSha:null})]);
});
afterEach(async()=>{
  if(db!==operator) await db.close();
  if(process.env.SPEC004_TEST_DATABASE_URL) await operator.query(`TRUNCATE projects,identity.users,
    identity.telegram_links,identity.memberships,services,work_items,analytics.reconciliations CASCADE`);
  await operator.close();
});

test('STT 5 applies once at 3/3 and preserves the LBRC014 SHA and acceptance snapshot',async()=>{
  const original=(await work.detail(manager,stt5)).work;
  const reconciliation=(await work.workspace(manager)).reconciliations;
  expect(reconciliation[0]).toMatchObject({code:'LBRC014',source_sha:sha,result:{acceptedSha:null}});
  const sent=await submit();
  const id=sent.proposal.id;
  expect(sent).toMatchObject({proposal:{source_ref:source,state:'pending'},votes:[],receipt:null});
  await agree(id,quyen);
  const second=await agree(id,manager);
  expect(second).toMatchObject({proposal:{state:'pending'},receipt:null});
  expect(second.votes).toHaveLength(2);
  expect((await work.detail(manager,stt5)).work).toEqual(original);
  const lastKey=key();
  const final=await Promise.all([agree(id,third,lastKey),agree(id,third,lastKey)]);
  expect(final[0]).toMatchObject({proposal:{state:'applied'},receipt:{proposal_id:id,work_version:2}});
  expect(final[0].votes).toHaveLength(3);
  expect(final[1].receipt).toEqual(final[0].receipt);
  const after=await work.detail(manager,stt5);
  expect(after.work).toMatchObject({assignee_id:manager.id,version:2,revision:original.revision,state:'doing',source_sha:null});
  expect(after.events.filter(event=>event.kind==='bom_allocation_applied')).toHaveLength(1);
  expect(after.acceptance).toEqual({technical:false,business:false});
  expect((await work.workspace(manager)).reconciliations).toEqual(reconciliation);
  expect((await bom.read(manager,stt5,roster.map(p=>p.id))).allocation).toEqual(selection);
});

test('two proposals at the same version create just one receipt',async()=>{
  const candidates=await Promise.all([submit(),submit({...selection,lead_id:third.id})]);
  for(const {proposal} of candidates) {await agree(proposal.id,quyen);await agree(proposal.id,manager);}
  const outcomes=await Promise.all(candidates.map(({proposal})=>agree(proposal.id,third)));
  expect(outcomes.map(item=>item.proposal.state).sort()).toEqual(['applied','reconcile']);
  expect(outcomes.filter(item=>item.receipt)).toHaveLength(1);
  expect((await work.detail(manager,stt5)).work.version).toBe(2);
});

test('source drift after 2/3 holds the work for reconciliation',async()=>{
  const {proposal:{id}}=await submit();
  await agree(id,quyen);await agree(id,manager);
  await operator.query('UPDATE bom_sources SET fingerprint=$1 WHERE work_id=$2',[digest('nguồn đã thay đổi'),stt5]);
  expect(await agree(id,third)).toMatchObject({proposal:{state:'reconcile'},receipt:null});
  expect((await work.detail(manager,stt5)).work.version).toBe(1);
});

test('a revised proposal starts from 0/3 and keeps the previous decisions',async()=>{
  const {proposal:{id}}=await submit();
  await agree(id,manager);
  const revised=await bom.command(third,{action:'vote',proposalId:id,choice:'revise',note:'Điều chỉnh phần bàn giao'},key());
  expect(revised.proposal.state).toBe('revise');
  await expect(agree(id,quyen)).rejects.toMatchObject({code:'PROPOSAL_CLOSED'});
  const next=await submit({...selection,lead_id:third.id},id);
  expect(next).toMatchObject({proposal:{prior_id:id,state:'pending'},votes:[],receipt:null});
  expect((await bom.read(manager,stt5,[])).cards.find(card=>card.proposal.id===id)?.votes).toHaveLength(2);
});

test('cross-BU, cross-tenant, chair and forged actor cannot access decisions',async()=>{
  const {proposal:{id}}=await submit();
  for(const p of [demo.customer,otherPrincipal,chair,demo.bot]) {
    await expect(agree(id,p)).rejects.toMatchObject({code:'SCOPE_DENIED'});
    await expect(bom.read(p,stt5,[])).rejects.toMatchObject({code:'SCOPE_DENIED'});
  }
  await expect(bom.command(manager,{action:'vote',proposalId:id,actorId:third.id,choice:'agree',note:'Đổi người xác nhận'},key())).rejects.toThrow();
  for(const p of [demo.customer,otherPrincipal]) {
    const rows=await scoped(db,p,tx=>tx.query('SELECT id FROM bom_proposals'));
    expect(rows.rows).toEqual([]);
  }
});

test('revise cannot bypass 3/3, and BoM vote never grants acceptance',async()=>{
  await expect(work.command(manager,stt5,{kind:'revise',expectedVersion:1,assigneeId:third.id,
    technicalId:demo.technical.id,businessId:demo.business.id,sourceSha:sha,criteria:'Tiêu chí thử nghiệm',
    specUrl:'https://example.com/spec',dueAt:null,note:'Thử ghi theo API cũ'},key())).rejects.toMatchObject({code:'BOM_REQUIRED'});
  await expect(scoped(db,manager,tx=>tx.query('UPDATE work_items SET assignee_id=$2 WHERE id=$1',[stt5,third.id])))
    .rejects.toThrow('BoM receipt with 3/3 votes required');
  const {proposal:{id}}=await submit();
  await agree(id,manager);await agree(id,quyen);await agree(id,third);
  await expect(work.command(quyen,stt5,{kind:'technical_accept',expectedVersion:2,sourceSha:sha,
    revision:1,evidenceId:randomUUID(),confirmed:true,note:'Thử nghiệm thu sau khi đổi vai'},key()))
    .rejects.toMatchObject({code:'SELF_ACCEPTANCE'});
});

test('revoked Telegram and out-of-project recipients prevent application',async()=>{
  await expect(submit({...selection,lead_id:demo.customer.id})).rejects.toMatchObject({code:'INVALID_ASSIGNMENT'});
  const {proposal:{id}}=await submit();
  await agree(id,manager);await agree(id,quyen);
  await operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[quyen.id]);
  expect(await agree(id,third)).toMatchObject({proposal:{state:'reconcile'},receipt:null});
  expect((await work.detail(manager,stt5)).work.version).toBe(1);
});

test('reject, cancel and expiry all preserve the original STT 5 assignment',async()=>{
  const rejected=(await submit()).proposal.id;
  await agree(rejected,manager);
  expect(await bom.command(third,{action:'vote',proposalId:rejected,choice:'reject',note:'Cần xem lại phương án'},key()))
    .toMatchObject({proposal:{state:'rejected'},receipt:null});
  const cancelled=(await submit()).proposal.id;
  expect(await bom.command(manager,{action:'cancel',proposalId:cancelled,note:'Rút phiếu thử nghiệm'},key()))
    .toMatchObject({proposal:{state:'cancelled'},receipt:null});
  const expired=(await submit()).proposal.id;
  await operator.query("UPDATE bom_proposals SET expires_at=now()-interval '1 second' WHERE id=$1",[expired]);
  expect(await agree(expired,manager)).toMatchObject({proposal:{state:'expired'},votes:[],receipt:null});
  expect((await work.detail(manager,stt5)).work).toMatchObject({assignee_id:quyen.id,version:1,state:'doing'});
});

test('receipt write failure rolls back the third vote and assignment together',async()=>{
  const {proposal:{id}}=await submit();
  await agree(id,manager);await agree(id,quyen);
  await operator.query(`CREATE OR REPLACE FUNCTION spec004_reject_receipt() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture receipt failure'; END $$`);
  await operator.query(`CREATE TRIGGER spec004_reject_receipt BEFORE INSERT ON bom_receipts
    FOR EACH ROW EXECUTE FUNCTION spec004_reject_receipt()`);
  try {
    await expect(agree(id,third)).rejects.toThrow('fixture receipt failure');
  } finally {
    await operator.query('DROP TRIGGER spec004_reject_receipt ON bom_receipts');
  }
  const view=await bom.read(manager,stt5,[]);
  expect(view.work).toMatchObject({assignee_id:quyen.id,version:1});
  expect(view.cards[0]).toMatchObject({proposal:{state:'pending'},receipt:null});
  expect(view.cards[0].votes).toHaveLength(2);
  expect(await agree(id,third)).toMatchObject({proposal:{state:'applied'},receipt:{work_version:2}});
});
