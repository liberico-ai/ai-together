// Probe for case 5 (tests/document-review.test.ts, «the flags of detail() and the answers of comment() agree for every state of a thread»).
// Question: when every row is written in one instant, is the last comment of the list the comment the call has just written — and what does the
// service answer when a reply is sent to that last comment instead? Run from the repository root (PGlite, no SLICE1_* variable set):
//   npx tsx docs/reviews/clock-ties-five-cases-evidence-20261120/probes/last-comment.mts
// The comment a call wrote is found by the request id of the call (review_comments.request_id), not by its place in the list.
import {randomUUID} from 'node:crypto';
import {openHarness} from '../../../../tests/slice1-db.ts';
import {member,pm,seedSlice1} from '../../../../tests/slice1-fixtures.ts';
import {delegate,proposeRev,registerDoc,reviewer,seedMembers} from '../../../../tests/slice3-fixtures.ts';
import {ReviewService} from '../../../../src/server/document-review.ts';
import {ids} from '../../../../src/server/identities.ts';
import type {Principal} from '../../../../src/server/types.ts';

const h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);
const real=Date.now,held=real();Date.now=()=>held;                       // from here on every PGlite transaction gets one now()
await delegate(h,ids.sales,reviewer.id);
const doc=await registerDoc(h,pm,{projectId:ids.sales,docType:'design'});
await proposeRev(h,member,doc,{sourceHash:'a1'.repeat(32)});
const docId=doc.record.id;
const revisionId=(await h.operator.query<{id:string}>('SELECT latest_revision_id AS id FROM document_records WHERE id=$1',[docId])).rows[0].id;
const svc=new ReviewService(h.db);
const send=async(p:Principal,raw:Record<string,unknown>)=>{
  const req=randomUUID(),view=await svc.comment(p,docId,raw,randomUUID(),req);
  const id=(await h.operator.query<{id:string}>('SELECT id FROM review_comments WHERE request_id=$1',[req])).rows[0].id;
  return {id,view,last:view.comments.at(-1)!};
};
const answer=(p:Principal,raw:Record<string,unknown>)=>svc.comment(p,docId,raw,randomUUID(),randomUUID()).then(()=>'ok',e=>(e as {code:string}).code);

const N=Number(process.argv[2]??12);
let notNew=0,lastWasReply=0;const toLastReply:string[]=[],toNewRoot:string[]=[];
for(let i=1;i<=N;i++){
  // as the case does: a new top-level comment, then «the last comment of the list» is taken to be it
  const root=await send(reviewer,{kind:'comment',revisionId,anchor:'Mục 1',body:'Cần làm rõ phạm vi'});
  const isNew=root.last.id===root.id;
  if(!isNew) notNew++;
  let line=`#${String(i).padStart(2,'0')} comments=${String(root.view.comments.length).padStart(2)} instants=${new Set(root.view.comments.map(c=>c.createdAt)).size} `
    +`new comment at index ${String(root.view.comments.findIndex(c=>c.id===root.id)).padStart(2)}; last of the list: kind=${root.last.kind.padEnd(9)} is the new comment=${isNew}`;
  if(root.last.kind!=='comment'){
    // the case would now send its reply to a reply row: nothing is written, the answer is the «not found» one
    lastWasReply++;
    const out=await answer(member,{kind:'addressed',parentId:root.last.id,body:'Thử theo bảng'});
    toLastReply.push(out);line+=`; addressed sent to that last row -> ${out}`;
  }
  // the same reply sent to the comment the call really wrote
  const out=await answer(member,{kind:'addressed',parentId:root.id,body:'Thử theo bảng'});
  toNewRoot.push(out);line+=`; addressed sent to the new comment -> ${out}`;
  console.log(line);
}
Date.now=real;
const count=(a:string[])=>Object.entries(a.reduce<Record<string,number>>((m,x)=>({...m,[x]:(m[x]??0)+1}),{})).map(([k,v])=>`${k}×${v}`).join(', ')||'none';
console.log(`calls=${N}; the last comment of the list was not the new comment in ${notNew}; it was a reply row in ${lastWasReply}`);
console.log(`answers to «addressed» by the author of the revision — sent to the last row when it was a reply: ${count(toLastReply)}; sent to the new comment: ${count(toNewRoot)}`);
await h.close();
