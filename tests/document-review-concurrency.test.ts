import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {approver,beforeStatement,delegate,frozenRevision,grantDocApproval,proposeRev,registerDoc,reviewer,revokeDelegation,seedMembers} from './slice3-fixtures';
import {ReviewService} from '../src/server/document-review';
import {DocumentService} from '../src/server/documents';
import {ids} from '../src/server/identities';
import type {Database} from '../src/server/db';
import type {Principal} from '../src/server/types';

// Two connections are needed: the operational login holds or changes what the service has read, the web login runs the service.
describe.skipIf(!native)('document review concurrency (native PostgreSQL)',()=>{
  let h:Harness;
  beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
  afterEach(async()=>{await h.reset();await h.close();});
  const n=async(sql:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${sql}`)).rows[0].n);
  const svc=(db:Database=h.db)=>new ReviewService(db);
  const body=(w:{revisionId:string;version:number;hash:string|null},over:Record<string,unknown>={})=>({revisionId:w.revisionId,sourceHash:w.hash,expectedVersion:w.version,
    result:'approved',scopeNote:'Đã đọc đúng bản này',exceptions:[],...over});
  const frozenDoc=async(author:Principal=member)=>{
    const doc=await registerDoc(h,pm);
    const f=await frozenRevision(h,doc.record.id,author.id);
    return {docId:doc.record.id,revisionId:f.revisionId,version:f.version,hash:f.hash as string|null};
  };
  const rec=async(docId:string)=>(await h.operator.query<{version:number;latest_revision_id:string;approved_revision_id:string|null}>(
    'SELECT version,latest_revision_id,approved_revision_id FROM document_records WHERE id=$1',[docId])).rows[0];
  /** The operational login holds the document row; every call parks on its FOR UPDATE, then all are released together. */
  const race=async(docId:string,count:number,calls:()=>Promise<unknown>[])=>{
    let all!:Promise<PromiseSettledResult<unknown>[]>;
    await h.operator.transaction(async tx=>{
      await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[docId]);
      all=Promise.allSettled(calls());
      await waitForBlocked(h,count);
    });
    return all;
  };
  const codes=(res:PromiseSettledResult<unknown>[])=>res.map(r=>r.status==='fulfilled'?'ok':(r.reason as {code?:string}).code);

  test('two approvals of the same revision in parallel store one review_decisions row',async()=>{
    await grantDocApproval(h,approver.id,ids.sales,['design']);await grantDocApproval(h,pm.id,ids.sales,['design']);
    const w=await frozenDoc();
    const res=await race(w.docId,2,()=>[svc().decide(approver,w.docId,body(w),randomUUID(),randomUUID()),svc().decide(pm,w.docId,body(w),randomUUID(),randomUUID())]);
    expect(codes(res).sort()).toEqual(['REVIEW_ALREADY_DECIDED','ok']);
    expect(await n('review_decisions')).toBe(1);expect(await n('review_events')).toBe(1);
    const r=await rec(w.docId);
    expect(r.approved_revision_id).toBe(w.revisionId);expect(r.version).toBe(w.version+1);
  });

  test('one person sending two approvals with two keys stores one decision',async()=>{
    await grantDocApproval(h,approver.id,ids.sales,['design']);
    const w=await frozenDoc();
    const res=await race(w.docId,2,()=>[svc().decide(approver,w.docId,body(w),randomUUID(),randomUUID()),svc().decide(approver,w.docId,body(w),randomUUID(),randomUUID())]);
    expect(codes(res).sort()).toEqual(['REVIEW_ALREADY_DECIDED','ok']);
    expect(await n('review_decisions')).toBe(1);
    const r=await rec(w.docId);
    expect(r.approved_revision_id).toBe(w.revisionId);expect(r.version).toBe(w.version+1);
  });

  test('an approval and a changes_requested on the same revision store exactly one decision',async()=>{
    await grantDocApproval(h,approver.id,ids.sales,['design']);await delegate(h,ids.sales,reviewer.id);
    const w=await frozenDoc();
    const res=await race(w.docId,2,()=>[svc().decide(approver,w.docId,body(w),randomUUID(),randomUUID()),
      svc().decide(reviewer,w.docId,body(w,{result:'changes_requested'}),randomUUID(),randomUUID())]);
    expect(codes(res).sort()).toEqual(['REVIEW_ALREADY_DECIDED','ok']);
    expect(await n('review_decisions')).toBe(1);
    const r=await rec(w.docId),approved=(await h.operator.query<{result:string}>('SELECT result FROM review_decisions')).rows[0].result==='approved';
    expect(r.approved_revision_id).toBe(approved?w.revisionId:null);expect(r.version).toBe(approved?w.version+1:w.version);
  });

  test('a decision racing a new revision proposal never lands on the newer revision',async()=>{
    await grantDocApproval(h,approver.id,ids.sales,['design']);await delegate(h,ids.sales,reviewer.id);
    for(const result of ['approved','changes_requested'] as const) {
      const w=await frozenDoc();
      const doc=await new DocumentService(h.db).detail(pm,w.docId);
      const proposal={expectedVersion:doc.record.version,basedOnRevisionId:doc.record.latest_revision_id,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
        changes:{summary:'Bản mới đề xuất đồng thời',present:[],missing:[]},sourceRefs:[]};
      const res=await race(w.docId,2,()=>[
        svc().decide(result==='approved'?approver:reviewer,w.docId,body(w,{result}),randomUUID(),randomUUID()),
        new DocumentService(h.db).proposeRevision(member,w.docId,proposal,randomUUID())]);
      const revisions=(await h.operator.query<{id:string}>('SELECT id FROM document_revisions WHERE document_id=$1 ORDER BY revision_no',[w.docId])).rows.map(r=>r.id);
      const decided=(await h.operator.query<{document_revision_id:string}>('SELECT document_revision_id FROM review_decisions WHERE document_id=$1',[w.docId])).rows;
      for(const d of decided) expect(d.document_revision_id).toBe(w.revisionId);
      expect(decided.length+codes(res).filter(c=>c==='REVISION_CONFLICT').length).toBeGreaterThanOrEqual(1);
      const r=await rec(w.docId);
      expect([null,w.revisionId]).toContain(r.approved_revision_id);
      // an approval and a proposal on one version cannot both succeed; a changes_requested and a proposal can, with the decision on the older revision
      if(result==='approved') expect(codes(res).filter(c=>c==='ok')).toHaveLength(1);
      else expect([revisions.length,codes(res)[1]]).toEqual([2,'ok']);
      for(const c of codes(res)) expect(['ok','REVISION_CONFLICT']).toContain(c);
    }
  });

  test('authority lost between the read and the insert is answered APPROVER_NOT_AUTHORIZED and nothing is stored',async()=>{
    const delegationId=await delegate(h,ids.sales,reviewer.id);await grantDocApproval(h,approver.id,ids.sales,['design']);
    // 1. the review delegation is revoked just before the INSERT of the decision
    const a=await frozenDoc();
    const revoking=svc(beforeStatement(h.db,/INSERT INTO review_decisions/,()=>revokeDelegation(h,delegationId)));
    let before={decisions:await n('review_decisions'),events:await n('review_events'),commands:await n('document_commands')};
    let e=await revoking.decide(reviewer,a.docId,body(a,{result:'changes_requested'}),randomUUID(),randomUUID()).then(()=>null,x=>x);
    expect(e).toMatchObject({code:'APPROVER_NOT_AUTHORIZED',status:403});
    expect({decisions:await n('review_decisions'),events:await n('review_events'),commands:await n('document_commands')}).toEqual(before);
    expect((await rec(a.docId)).version).toBe(a.version);
    // 2. the approval grant is reduced in identity.memberships just before the INSERT (changes_requested, then approved)
    for(const result of ['changes_requested','approved'] as const) {
      await grantDocApproval(h,approver.id,ids.sales,['design']);
      const b=await frozenDoc();
      const reducing=svc(beforeStatement(h.db,/INSERT INTO review_decisions/,async()=>{
        await h.operator.query("UPDATE identity.memberships SET report_permissions='{}' WHERE user_id=$1 AND project_id=$2",[approver.id,ids.sales]);
      }));
      before={decisions:await n('review_decisions'),events:await n('review_events'),commands:await n('document_commands')};
      e=await reducing.decide(approver,b.docId,body(b,{result}),randomUUID(),randomUUID()).then(()=>null,x=>x);
      expect(e,result).toMatchObject({code:'APPROVER_NOT_AUTHORIZED',status:403});
      expect({decisions:await n('review_decisions'),events:await n('review_events'),commands:await n('document_commands')}).toEqual(before);
      const r=await rec(b.docId);
      expect(r.version).toBe(b.version);expect(r.approved_revision_id).toBeNull();
    }
    // and the service still decides once authority is back, so the refusals above came from the lost authority
    await grantDocApproval(h,approver.id,ids.sales,['design']);
    const c=await frozenDoc();
    const out=await svc().decide(approver,c.docId,body(c),randomUUID(),randomUUID());
    expect(out.item.decision?.result).toBe('approved');
  });
  test('two resolved on one thread sent together store one row and one event; the other answers COMMENT_RESOLVED',async()=>{
    await grantDocApproval(h,approver.id,ids.sales,['design']);await delegate(h,ids.sales,reviewer.id);
    const doc=await registerDoc(h,pm),w=await proposeRev(h,member,doc);
    const root=(await svc().comment(reviewer,w.record.id,{kind:'comment',revisionId:w.record.latest_revision_id,anchor:'',body:'Cần làm rõ phạm vi'},randomUUID(),randomUUID())).comments[0];
    const resolve=(p:Principal)=>svc().comment(p,w.record.id,{kind:'resolved',parentId:root.id,body:'Đã xác nhận xử lý'},randomUUID(),randomUUID());
    const res=await race(w.record.id,2,()=>[resolve(reviewer),resolve(approver)]);
    expect(codes(res).sort()).toEqual(['COMMENT_RESOLVED','ok']);
    expect(await n("review_comments WHERE kind='resolved'")).toBe(1);expect(await n("review_events WHERE kind='review.resolved'")).toBe(1);
  });
});
