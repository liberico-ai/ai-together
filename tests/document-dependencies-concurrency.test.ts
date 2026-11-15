import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {proposeRev,registerDoc,seedMembers} from './slice3-fixtures';
import {DependencyService} from '../src/server/document-dependencies';
import {DocumentService} from '../src/server/documents';
import {ids} from '../src/server/identities';

// The operational login holds the upstream row; the link (FOR SHARE) and the proposal (FOR UPDATE) both park on it and are released together.
describe.skipIf(!native)('document dependency link racing a proposal (native PostgreSQL)',()=>{
  let h:Harness;
  beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
  afterEach(async()=>{await h.reset();await h.close();});
  type R=Record<string,unknown>;
  const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const codes=(res:PromiseSettledResult<unknown>[])=>res.map(r=>r.status==='fulfilled'?'ok':(r.reason as {code?:string}).code);

  test('the link either names the old latest and succeeds before the proposal (which then flags it), or answers REVISION_CONFLICT; never a link to a revision the command did not name',async()=>{
    for(let round=0;round<4;round++) {
      const up=await proposeRev(h,pm,await registerDoc(h,pm)),dep=await registerDoc(h,pm);
      const seen=up.record.latest_revision_id as string;
      const proposal={expectedVersion:up.record.version,basedOnRevisionId:seen,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
        changes:{summary:'Bản mới đề xuất đồng thời',present:[],missing:[]},sourceRefs:[]};
      let all!:Promise<PromiseSettledResult<unknown>[]>;
      await h.operator.transaction(async tx=>{
        await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[up.record.id]);
        all=Promise.allSettled([
          new DependencyService(h.db).link(pm,{projectId:ids.sales,upstreamDocumentId:up.record.id,upstreamRevisionId:seen,dependentDocumentId:dep.record.id},randomUUID(),randomUUID()),
          new DocumentService(h.db).proposeRevision(member,up.record.id,proposal,randomUUID())]);
        await waitForBlocked(h,2);
      });
      const res=await all,c=codes(res);
      expect(c[1],'the proposal always wins or follows').toBe('ok');
      const latest=(await rows<{latest_revision_id:string}>('SELECT latest_revision_id FROM document_records WHERE id=$1',[up.record.id]))[0].latest_revision_id;
      expect(latest).not.toBe(seen);
      const links=await rows<{upstream_revision_id:string;needs_review:boolean;flagged_revision_id:string|null}>('SELECT upstream_revision_id,needs_review,flagged_revision_id FROM document_dependencies WHERE dependent_document_id=$1',[dep.record.id]);
      if(c[0]==='ok') {
        // linked before the proposal committed: it names what it saw and the new revision flagged it
        expect(links).toEqual([{upstream_revision_id:seen,needs_review:true,flagged_revision_id:latest}]);
      } else {
        expect(c[0]).toBe('REVISION_CONFLICT');
        expect(links).toEqual([]);
        expect(Number((await rows<{n:string}>("SELECT count(*) n FROM review_events WHERE kind='dependency.linked' AND payload->>'dependentDocumentId'=$1",[dep.record.id]))[0].n)).toBe(0);
      }
    }
  });
});
