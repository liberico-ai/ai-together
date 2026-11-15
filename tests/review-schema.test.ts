import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {approver,delegate,frozenRevision,grantDocApproval,proposeRev,registerDoc,reviewer,revokeDelegation,seedMembers,transportApprover} from './slice3-fixtures';
import {scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

// Migration 020: review delegations, comments, decisions, dependencies and review events, with the guards that make the roles of
// slice 3 hold in the database itself. Runtime access goes through scoped() (SET LOCAL ROLE libetech_runtime), the operational login
// is the harness superuser. Project roles are always set explicitly on the membership, never read from the account.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
type Err={message:string;code?:string};
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const P=(id:string,projects:string[]):Principal=>({id,tenantId:ids.tenant,projectIds:projects,name:'Người mẫu',role:'manager'});
/** Runs as the runtime role in the scope of the given projects; sets app.person_id unless person is null (then pm is only the session owner). */
const as=<T>(person:string|null,projects:string[],fn:(tx:Queryable)=>Promise<T>)=>scoped(h.db,P(person??pm.id,projects),async tx=>{
 if(person) await tx.query("SELECT set_config('app.person_id',$1,true)",[person]);
 return fn(tx);
});
/** Operational login with the same context variables set (document_approvers reads them). */
const asOp=<T>(projects:string[],fn:(tx:Queryable)=>Promise<T>)=>h.operator.transaction(async tx=>{
 await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,projects.join(',')]);
 return fn(tx);
});
const failure=async(p:Promise<unknown>):Promise<Err>=>{
 try{await p;}catch(e){return e as Err;}
 throw new Error('expected a refusal');
};
const noAuthorityCode=(e:Err)=>expect(e.code??'',e.message).not.toMatch(/^LTR0/);
const S=[ids.sales];

async function mkUser(memberships:[string,string][],opts:{active?:boolean}={}):Promise<string> {
 const id=randomUUID();
 await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,'Người mẫu','viewer','fixture-only')`,[id,ids.tenant,'rs-'+id]);
 if(opts.active===false) await h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[id]);
 for(const [project,role] of memberships) await h.operator.query(
  'INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',[ids.tenant,id,project,role]);
 return id;
}

const insDel=(tx:Queryable,over:{tenant?:string;project?:string;delegate?:string;types?:string[]|null;granted?:string;basis?:string}={}) => {
 const v={tenant:ids.tenant,project:ids.sales,delegate:reviewer.id,types:['design'] as string[]|null,granted:pm.id,basis:'Chỉ định mẫu',...over};
 return tx.query<{id:string}>(`INSERT INTO review_delegations(tenant_id,project_id,delegate_id,doc_types,granted_by,basis) VALUES($1,$2,$3,$4::text[],$5,$6) RETURNING id`,
  [v.tenant,v.project,v.delegate,v.types,v.granted,v.basis]);
};
const revoke=(tx:Queryable,id:string,by:string|null,basis:string|null='Thu hồi mẫu',at:string='2000-01-01T00:00:00Z')=>tx.query<R>(
 `UPDATE review_delegations SET revoked_at=$2,revoked_by=$3,revoke_basis=$4 WHERE id=$1 RETURNING id,version,revoked_at,revoked_by,updated_at`,[id,at,by,basis]);

type W={docId:string;revisionId:string;version:number;hash:string;revisionNo:number;delegationId:string;project:string};
/** A design document of sales whose only revision was proposed by member and is frozen; reviewer holds a design delegation. */
async function world(over:{project?:string;docType?:string;author?:string;delegateTo?:string}={}):Promise<W> {
 const project=over.project??ids.sales;
 const doc=await registerDoc(h,pm,{projectId:project,docType:over.docType??'design'});
 const fr=await frozenRevision(h,doc.record.id,over.author??member.id);
 const revisionNo=(await rows<{n:number}>('SELECT revision_no n FROM document_revisions WHERE id=$1',[fr.revisionId]))[0].n;
 const delegationId=await delegate(h,project,over.delegateTo??reviewer.id,[over.docType??'design']);
 return {docId:doc.record.id,revisionId:fr.revisionId,version:fr.version,hash:fr.hash,revisionNo,delegationId,project};
}
/** Another revision (any freezing level) through the operational login; moves the latest pointer and the record version. */
async function rawRevision(docId:string,proposedBy:string,o:{snapshot?:string|null;verification?:string;hash?:string|null}={}) {
 const snapshot=o.snapshot===undefined?'synthetic://snapshot/raw':o.snapshot,verification=o.verification??'verified',hash=o.hash===undefined?'b'.repeat(64):o.hash;
 const rec=(await rows<{project_id:string;canonical_uri:string;source_type:string;latest_revision_id:string|null}>(
  'SELECT project_id,canonical_uri,source_type,latest_revision_id FROM document_records WHERE id=$1',[docId]))[0];
 const no=(await rows<{n:number}>('SELECT coalesce(max(revision_no),0)+1 n FROM document_revisions WHERE document_id=$1',[docId]))[0].n;
 const revisionId=(await rows<{id:string}>(`INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,based_on_revision_id,source_id,source_type,source_hash,hash_verification,snapshot_ref,proposed_by)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,[ids.tenant,rec.project_id,docId,no,rec.latest_revision_id,rec.canonical_uri,rec.source_type,hash,verification,snapshot,proposedBy]))[0].id;
 const version=(await rows<{version:number}>('UPDATE document_records SET latest_revision_id=$1,version=version+1 WHERE id=$2 RETURNING version',[revisionId,docId]))[0].version;
 return {revisionId,version,hash:hash??null,no};
}
const decisionCols='tenant_id,project_id,document_id,document_revision_id,revision_no,revision_hash,record_version,result,scope_note,exceptions,authority,delegation_id,decided_by,command_key,request_id,trace_id';
type D={result:string;authority:string;decided_by:string;delegation_id:string|null;revision_no:number;revision_hash:string|null;record_version:number;document_id:string;document_revision_id:string;project:string};
const decisionOf=(w:W,over:Partial<D>={}):D=>({result:'changes_requested',authority:'review_delegation',decided_by:reviewer.id,delegation_id:w.delegationId,revision_no:w.revisionNo,
 revision_hash:w.hash,record_version:w.version,document_id:w.docId,document_revision_id:w.revisionId,project:w.project,...over});
const insDec=(tx:Queryable,d:D,tenant:string=ids.tenant)=>tx.query<{id:string}>(`INSERT INTO review_decisions(${decisionCols}) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Phạm vi mẫu cho bản thử','[]',$9,$10,$11,$12,$13,$13) RETURNING id`,
 [tenant,d.project,d.document_id,d.document_revision_id,d.revision_no,d.revision_hash,d.record_version,d.result,d.authority,d.delegation_id,d.decided_by,'k-'+randomUUID(),randomUUID()]);
const decideAsRuntime=(d:D)=>as(d.decided_by,[d.project],tx=>insDec(tx,d));
const approvalOf=(w:W,by:string,over:Partial<D>={}):D=>decisionOf(w,{result:'approved',authority:'approval_grant',decided_by:by,delegation_id:null,...over});

const insComment=(tx:Queryable,w:W,actor:string,over:{kind?:string;parent?:string|null;project?:string;doc?:string;rev?:string}={}) => tx.query<{id:string}>(
 `INSERT INTO review_comments(tenant_id,project_id,document_id,document_revision_id,parent_id,kind,anchor,body,actor_id,request_id,trace_id)
  VALUES($1,$2,$3,$4,$5,$6,'',$7,$8,$9,$9) RETURNING id`,
 [ids.tenant,over.project??w.project,over.doc??w.docId,over.rev??w.revisionId,over.parent??null,over.kind??'comment','Nhận xét mẫu',actor,randomUUID()]);
const insCommentIn=(tx:Queryable,w:W,actor:string,over:{tenant:string}) => tx.query(
 `INSERT INTO review_comments(tenant_id,project_id,document_id,document_revision_id,parent_id,kind,anchor,body,actor_id,request_id,trace_id)
  VALUES($1,$2,$3,$4,NULL,'comment','','Nhận xét mẫu',$5,$6,$6)`,[over.tenant,w.project,w.docId,w.revisionId,actor,randomUUID()]);
const insEvent=(tx:Queryable,actor:string,over:{project?:string;tenant?:string}={}) => tx.query(
 `INSERT INTO review_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload) VALUES($1,$2,'review_comment',$3,$4,'comment_added',$5,$5,'{}')`,
 [over.tenant??ids.tenant,over.project??ids.sales,randomUUID(),actor,randomUUID()]);
const insDep=(tx:Queryable,up:W,down:string,by:string,over:{upstream?:string;tenant?:string}={}) => tx.query<{id:string}>(
 `INSERT INTO document_dependencies(tenant_id,project_id,upstream_document_id,upstream_revision_id,dependent_document_id,note,confirmed_by) VALUES($1,$2,$3,$4,$5,'',$6) RETURNING id`,
 [over.tenant??ids.tenant,up.project,over.upstream??up.docId,up.revisionId,down,by]);

const tables=['review_delegations','review_comments','review_decisions','document_dependencies','review_events'];

// Seeds one row in every review table through the operational login; returns what a later case needs.
async function seedAll(project=ids.sales) {
 const decider=project===ids.sales?reviewer.id:transportApprover.id;
 const w=await world({project,delegateTo:decider});
 const other=await registerDoc(h,pm,{projectId:project});
 await insComment(h.operator,w,pm.id);
 await asOp([project],tx=>insDec(tx,decisionOf(w,{decided_by:decider})));
 await insDep(h.operator,w,other.record.id,pm.id);
 await insEvent(h.operator,pm.id,{project});
 return {w,other:other.record.id};
}

test('review tables return nothing without RLS context',async()=>{
 await seedAll();
 for(const t of tables){
  const none=await h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query(`SELECT * FROM ${t}`)).rows;});
  expect(none,t).toHaveLength(0);
  const some=await as(pm.id,S,async tx=>(await tx.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n);
  expect(some,t+' control').toBe(1);
 }
});

test('runtime reads only its own tenant and project; writes outside its project, or into another tenant, are refused',async()=>{
 const sales=await seedAll(ids.sales);
 const transport=await seedAll(ids.transport);
 // reads: the transport rows are invisible from a sales-only scope
 for(const t of tables) expect(await as(pm.id,S,async tx=>(await tx.query<{n:number}>(`SELECT count(*)::int n FROM ${t} WHERE project_id=$1`,[ids.transport])).rows[0].n),t).toBe(0);
 // writes outside the scope are refused by the policy (comments, events, dependencies, decisions) or the designation guard (delegations)
 expect((await failure(as(pm.id,S,tx=>insComment(tx,transport.w,pm.id)))).message).toMatch(/row-level security/);
 expect((await failure(as(pm.id,S,tx=>insEvent(tx,pm.id,{project:ids.transport})))).message).toMatch(/row-level security/);
 expect((await failure(as(pm.id,S,tx=>insEvent(tx,pm.id,{tenant:ids.otherTenant})))).message).toMatch(/row-level security/);
 // cross-tenant inserts are refused by the tenant clause of WITH CHECK, one case per table (the delegation is refused by RLS before its guard)
 const rls=/row-level security/;
 expect((await failure(as(pm.id,S,tx=>insCommentIn(tx,sales.w,pm.id,{tenant:ids.otherTenant})))).message).toMatch(rls);
 // a decision: the BEFORE guard looks the document up under the row's own tenant and refuses first (it runs ahead of WITH CHECK), so either refusal is accepted
 expect((await failure(as(reviewer.id,S,tx=>insDec(tx,decisionOf(sales.w,{decided_by:reviewer.id,delegation_id:sales.w.delegationId}),ids.otherTenant)))).message).toMatch(/row-level security|A decision names a document of the project/);
 expect((await failure(as(pm.id,S,tx=>insDep(tx,sales.w,sales.other,pm.id,{tenant:ids.otherTenant})))).message).toMatch(rls);
 expect((await failure(as(pm.id,S,tx=>insDel(tx,{tenant:ids.otherTenant,delegate:approver.id})))).message).toMatch(rls);
 expect((await failure(as(pm.id,S,tx=>insDep(tx,transport.w,transport.other,pm.id)))).message).toMatch(/row-level security/);
 // these two are refused by the guards, not by the policy: the document is not visible from this scope, the designation is not eligible
 expect((await failure(as(reviewer.id,S,tx=>insDec(tx,decisionOf(transport.w,{decided_by:reviewer.id,delegation_id:transport.w.delegationId}))))).message).toBe('A decision names a document of the project');
 expect((await failure(as(pm.id,S,tx=>insDel(tx,{project:ids.transport,delegate:transportApprover.id})))).code).toBe('LTR02');
 // updates across the scope change nothing
 const before=await rows('SELECT * FROM document_dependencies WHERE project_id=$1',[ids.transport]);
 const flagged=await as(pm.id,S,async tx=>(await tx.query(`UPDATE document_dependencies SET needs_review=true,flagged_revision_id=upstream_revision_id,flagged_at=now() WHERE project_id=$1 RETURNING id`,[ids.transport])).rows);
 expect(flagged).toHaveLength(0);
 expect(await rows('SELECT * FROM document_dependencies WHERE project_id=$1',[ids.transport])).toEqual(before);
 const revoked=await as(pm.id,S,async tx=>(await tx.query('UPDATE review_delegations SET revoked_at=now(),revoked_by=$2,revoke_basis=$3 WHERE id=$1 RETURNING id',[transport.w.delegationId,pm.id,'Thu hồi mẫu'])).rows);
 expect(revoked).toHaveLength(0);
 expect((await rows('SELECT revoked_at FROM review_delegations WHERE id=$1',[transport.w.delegationId]))[0]).toEqual({revoked_at:null});
 expect(sales.w.docId).toBeTruthy();
});

test('review tables are invisible to another tenant that holds the project id, and fail closed with no context',async()=>{
 await seedAll();
 const foreign={...P(pm.id,S),tenantId:ids.otherTenant};
 for(const t of tables){
  // control: the owning scope sees the seeded row, so an empty answer below is the policy's doing
  expect(await as(pm.id,S,async tx=>(await tx.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n),t+' control').toBe(1);
  // catches removal of the tenant_id clause of the select policy: the sales project id is in app.project_ids, only the tenant differs
  expect(await scoped(h.db,foreign,async tx=>(await tx.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n),t+' other tenant').toBe(0);
  // catches a policy that passes, or raises, when the setting is absent (current_setting without missing_ok)
  const bare=await h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query(`SELECT count(*)::int n FROM ${t}`)).rows[0] as {n:number};});
  expect(bare.n,t+' no context').toBe(0);
 }
});

test('a decision, a comment, a delegation and an event are bound to the acting person',async()=>{
 const w=await world();
 const wrongActor=member.id;
 const rls=/row-level security/;
 // the actor differs from app.person_id: the other guards pass, the policy refuses
 expect((await failure(as(wrongActor,S,tx=>insDec(tx,decisionOf(w))))).message).toMatch(rls);
 expect((await failure(as(wrongActor,S,tx=>insComment(tx,w,reviewer.id)))).message).toMatch(rls);
 expect((await failure(as(wrongActor,S,tx=>insEvent(tx,reviewer.id)))).message).toMatch(rls);
 expect((await failure(as(wrongActor,S,tx=>insDel(tx,{delegate:approver.id,granted:pm.id})))).message).toMatch(rls);
 // app.person_id not set at all
 expect((await failure(as(null,S,tx=>insDec(tx,decisionOf(w))))).message).toMatch(rls);
 expect((await failure(as(null,S,tx=>insComment(tx,w,reviewer.id)))).message).toMatch(rls);
 expect((await failure(as(null,S,tx=>insEvent(tx,pm.id)))).message).toMatch(rls);
 expect((await failure(as(null,S,tx=>insDel(tx,{delegate:approver.id,granted:pm.id})))).message).toMatch(rls);
 // controls: the right person writes each
 await as(reviewer.id,S,tx=>insDec(tx,decisionOf(w)));
 await as(reviewer.id,S,tx=>insComment(tx,w,reviewer.id));
 await as(reviewer.id,S,tx=>insEvent(tx,reviewer.id));
 await as(pm.id,S,tx=>insDel(tx,{delegate:approver.id}));
});

test('a delegation cannot name its own granter',async()=>{
 const own=insDel(h.operator,{delegate:pm.id,granted:pm.id});
 expect((await failure(own)).message).toMatch(/review_delegations_no_self_grant/);
 // a manager designating themselves through the runtime role passes the designation guard (a manager is an eligible member) and meets the CHECK
 expect((await failure(as(pm.id,S,tx=>insDel(tx,{delegate:pm.id,granted:pm.id})))).message).toMatch(/review_delegations_no_self_grant/);
});

test('a delegation must list document types and only known ones',async()=>{
 const bad:[string[]|null,RegExp][]=[
  [[],/review_delegations_doc_types_check/],[null,/null value/i],[['unknown'],/review_delegations_doc_types_check/],
  [['design','unknown'],/review_delegations_doc_types_check/],[Array(9).fill('design'),/review_delegations_doc_types_check/],
 ];
 for(const [types,pattern] of bad) expect((await failure(insDel(h.operator,{types}))).message,JSON.stringify(types)).toMatch(pattern);
 await insDel(h.operator,{types:['project_index','change_brief','requirements','design','plan','verification','guide','other']});
});

test('only a manager of that very project designates: an engineer, and a manager of project A who is only a member of project B, are refused in B',async()=>{
 // X: manager of transport (A), engineer of sales (B); the account-level role is viewer, so only the project role can matter
 const x=await mkUser([[ids.transport,'manager'],[ids.sales,'engineer']]);
 const both=[ids.sales,ids.transport];
 const message='A reviewer is designated by a manager of the project, among its members';
 for(const [who,label] of [[member.id,'engineer'],[reviewer.id,'technical'],[approver.id,'business'],[x,'manager elsewhere']] as const){
  const e=await failure(as(who,both,tx=>insDel(tx,{delegate:reviewer.id===who?approver.id:reviewer.id,granted:who})));
  expect(e.code,label).toBe('LTR02');
  expect(e.message,label).toContain(message);
 }
 // control: X designates in the project where X is a manager, among that project's members
 await as(x,both,tx=>insDel(tx,{project:ids.transport,delegate:transportApprover.id,granted:x}));
 await as(pm.id,S,tx=>insDel(tx));
});

test('the delegate must be an active member of the project with a reading role',async()=>{
 const outsider=await mkUser([[ids.transport,'engineer']]);
 const viewerMember=await mkUser([[ids.sales,'viewer']]);
 const locked=await mkUser([[ids.sales,'engineer']],{active:false});
 const noPassword=await mkUser([[ids.sales,'engineer']]);
 await h.operator.query('UPDATE identity.users SET password_hash=NULL WHERE id=$1',[noPassword]);
 for(const [who,label] of [[outsider,'not a member'],[viewerMember,'viewer'],[locked,'inactive'],[noPassword,'not activated'],[randomUUID(),'unknown account']] as const){
  const e=await failure(as(pm.id,S,tx=>insDel(tx,{delegate:who})));
  expect(e.code,label).toBe('LTR02');
 }
 for(const role of ['manager','engineer','technical','business']){
  const ok=await mkUser([[ids.sales,role]]);
  await as(pm.id,S,tx=>insDel(tx,{delegate:ok}));
 }
});

test('any manager of that very project revokes, also one who did not designate; the trigger stamps the time and bumps the version',async()=>{
 const id=await as(pm.id,S,async tx=>(await insDel(tx)).rows[0].id);
 const pm2=await mkUser([[ids.sales,'manager']]);
 const before=Date.now()-60_000;
 // the caller hands in a time in the past and later a time in the future: neither survives
 const r=(await as(pm2,S,async tx=>(await revoke(tx,id,pm2,'Thu hồi mẫu','2999-01-01T00:00:00Z')).rows))[0];
 expect(r.version).toBe(2);
 expect(r.revoked_by).toBe(pm2);
 expect(new Date(r.revoked_at as string).getTime()).toBeGreaterThan(before);
 expect(new Date(r.revoked_at as string).getTime()).toBeLessThan(Date.now()+60_000);
 expect(new Date(r.updated_at as string).getTime()).toBe(new Date(r.revoked_at as string).getTime());
 const other=await as(pm.id,S,async tx=>(await insDel(tx,{delegate:approver.id})).rows[0].id);
 const old=(await as(pm.id,S,async tx=>(await revoke(tx,other,pm.id,'Thu hồi mẫu','2000-01-01T00:00:00Z')).rows))[0];
 expect(new Date(old.revoked_at as string).getFullYear()).toBeGreaterThan(2020);
});

test('runtime changes the revoke columns only',async()=>{
 const id=await as(pm.id,S,async tx=>(await insDel(tx)).rows[0].id);
 const denied:[string,unknown[]][]=[
  ["doc_types=ARRAY['plan']::text[]",[]],['delegate_id=$2',[approver.id]],['granted_by=$2',[member.id]],["basis='Căn cứ khác'",[]],
  ['version=9',[]],['updated_at=now()',[]],['tenant_id=$2',[ids.otherTenant]],['project_id=$2',[ids.transport]],['id=$2',[randomUUID()]],
  ["revoked_at=now(),version=9",[]],
 ];
 for(const [set,params] of denied) expect((await failure(as(pm.id,S,tx=>tx.query(`UPDATE review_delegations SET ${set} WHERE id=$1`,[id,...params])))).message,set).toMatch(/permission denied/);
 expect((await failure(as(pm.id,S,tx=>tx.query('DELETE FROM review_delegations WHERE id=$1',[id])))).message).toMatch(/permission denied/);
 for(const col of ['revoked_at','revoked_by','revoke_basis','version','updated_at','created_at','id'])
  expect((await failure(as(pm.id,S,tx=>tx.query(`INSERT INTO review_delegations(tenant_id,project_id,delegate_id,doc_types,granted_by,basis,${col}) VALUES($1,$2,$3,ARRAY['design'],$4,'Chỉ định mẫu',NULL)`,
   [ids.tenant,ids.sales,approver.id,pm.id])))).message,col).toMatch(/permission denied/);
 expect((await rows('SELECT doc_types,delegate_id,version FROM review_delegations WHERE id=$1',[id]))[0]).toEqual({doc_types:['design'],delegate_id:reviewer.id,version:1});
});

test('a revoke cannot be undone or repeated',async()=>{
 const id=await as(pm.id,S,async tx=>(await insDel(tx)).rows[0].id);
 const pm2=await mkUser([[ids.sales,'manager']]);
 await as(pm2,S,tx=>revoke(tx,id,pm2));
 const frozen=await rows('SELECT * FROM review_delegations WHERE id=$1',[id]);
 // runtime: the revoked row is no longer a target, so neither undoing nor repeating touches it
 const undone=await as(pm.id,S,async tx=>(await tx.query('UPDATE review_delegations SET revoked_at=NULL,revoked_by=NULL,revoke_basis=NULL WHERE id=$1 RETURNING id',[id])).rows);
 expect(undone).toHaveLength(0);
 const again=await as(pm.id,S,async tx=>(await revoke(tx,id,pm.id,'Thu hồi lần hai')).rows);
 expect(again).toHaveLength(0);
 expect(await rows('SELECT * FROM review_delegations WHERE id=$1',[id])).toEqual(frozen);
 // operational login bypasses the policy but not the trigger; these are integrity refusals without a dedicated code
 for(const sql of ['UPDATE review_delegations SET revoked_at=NULL,revoked_by=NULL,revoke_basis=NULL WHERE id=$1',
   "UPDATE review_delegations SET revoked_at=now(),revoked_by=revoked_by,revoke_basis='Thu hồi lần hai' WHERE id=$1",
   "UPDATE review_delegations SET basis='Căn cứ khác' WHERE id=$1"]){
  const e=await failure(h.operator.query(sql,[id]));noAuthorityCode(e);
 }
 expect(await rows('SELECT * FROM review_delegations WHERE id=$1',[id])).toEqual(frozen);
 // the operational login cannot rewrite the identity columns of a live delegation either
 const live=await delegate(h,ids.sales,approver.id);
 for(const set of ["doc_types=ARRAY['plan']::text[]",'delegate_id=gen_random_uuid()','granted_by=gen_random_uuid()',"basis='Căn cứ khác'",'created_at=now()-interval \'1 day\'']){
  const e=await failure(h.operator.query(`UPDATE review_delegations SET ${set},revoked_at=now(),revoked_by=$2,revoke_basis='Thu hồi mẫu' WHERE id=$1`,[live,pm.id]));noAuthorityCode(e);
 }
 // the fixture revoke goes through the same trigger: version and time are stamped
 await revokeDelegation(h,live);
 expect((await rows<{version:number}>('SELECT version FROM review_delegations WHERE id=$1',[live]))[0].version).toBe(2);
});

test('a member who is not a manager of the project is refused',async()=>{
 const technical=await mkUser([[ids.sales,'technical']]);
 const message='A delegation is revoked by a manager of the project';
 const id=await delegate(h,ids.sales,reviewer.id);
 for(const [who,label] of [[member.id,'engineer'],[technical,'technical'],[approver.id,'business'],[reviewer.id,'the delegate itself, a technical member']] as const){
  const e=await failure(as(who,S,tx=>revoke(tx,id,who)));
  expect(e.code,label).toBe('LTR03');
  expect(e.message,label).toBe(message);
 }
 expect((await rows('SELECT revoked_at FROM review_delegations WHERE id=$1',[id]))[0]).toEqual({revoked_at:null});
});

test('a manager of another project changes nothing and learns nothing',async()=>{
 const id=await delegate(h,ids.sales,reviewer.id);
 const x=await mkUser([[ids.transport,'manager'],[ids.sales,'engineer']]);
 const y=await mkUser([[ids.transport,'manager']]);
 // sales is not in their scope: no row, no error that carries a name or a code
 for(const who of [x,y]) expect(await as(who,[ids.transport],async tx=>(await revoke(tx,id,who)).rows),'out of scope').toHaveLength(0);
 // sales is in x's scope but x is an engineer there
 const e=await failure(as(x,[ids.sales,ids.transport],tx=>revoke(tx,id,x)));
 expect(e.code).toBe('LTR03');
 expect(e.message).toBe('A delegation is revoked by a manager of the project');
 expect(e.message).not.toContain(reviewer.name);
 expect((await rows('SELECT revoked_at,version FROM review_delegations WHERE id=$1',[id]))[0]).toEqual({revoked_at:null,version:1});
});

test('a revoke names the acting person and carries a basis',async()=>{
 const id=await delegate(h,ids.sales,reviewer.id);
 const pm2=await mkUser([[ids.sales,'manager']]);
 // revoked_by is another manager, or app.person_id is missing: the trigger accepts the manager, the policy refuses
 expect((await failure(as(pm2,S,tx=>revoke(tx,id,pm.id)))).message).toMatch(/row-level security/);
 expect((await failure(as(null,S,tx=>revoke(tx,id,pm.id)))).message).toMatch(/row-level security/);
 expect((await failure(as(pm2,S,tx=>revoke(tx,id,pm2,null)))).message).toMatch(/row-level security|null value|check constraint/);
 expect((await failure(as(pm2,S,tx=>revoke(tx,id,pm2,'abc')))).message).toMatch(/review_delegations_revoke_basis_check/);
 expect((await failure(as(pm2,S,tx=>revoke(tx,id,pm2,'     ')))).message).toMatch(/review_delegations_revoke_basis_check/);
 await failure(as(pm2,S,tx=>revoke(tx,id,null)));
 expect((await rows('SELECT revoked_at FROM review_delegations WHERE id=$1',[id]))[0]).toEqual({revoked_at:null});
 await as(pm2,S,tx=>revoke(tx,id,pm2));
});

test('decisions and comments written before a revoke are unchanged, and a new designation of the same person is accepted after it',async()=>{
 const w=await world();
 await as(reviewer.id,S,tx=>insComment(tx,w,reviewer.id));
 await as(reviewer.id,S,tx=>insDec(tx,decisionOf(w)));
 const snap=async()=>({c:await rows('SELECT * FROM review_comments ORDER BY id'),d:await rows('SELECT * FROM review_decisions ORDER BY id'),e:await rows('SELECT * FROM review_events ORDER BY id')});
 const before=await snap();
 await as(pm.id,S,tx=>revoke(tx,w.delegationId,pm.id));
 expect(await snap()).toEqual(before);
 expect((await rows('SELECT revoked_at FROM review_delegations WHERE id=$1',[w.delegationId]))[0].revoked_at).not.toBeNull();
 // a second active designation of the same person is refused while the first is live, accepted once it is revoked
 const fresh=await as(pm.id,S,async tx=>(await insDel(tx,{delegate:reviewer.id})).rows[0].id);
 expect(fresh).not.toBe(w.delegationId);
 expect((await failure(as(pm.id,S,tx=>insDel(tx,{delegate:reviewer.id})))).message).toMatch(/uq_review_delegations_active|duplicate key/);
});

test('the author cannot decide the own revision, also by raw SQL',async()=>{
 // member authored the frozen revision; give the author both kinds of authority
 const w=await world();
 const own=await delegate(h,ids.sales,member.id);
 await grantDocApproval(h,member.id,ids.sales,['design']);
 const byDelegation=decisionOf(w,{decided_by:member.id,delegation_id:own});
 const byGrant=approvalOf(w,member.id);
 for(const d of [byDelegation,byGrant]){
  const e1=await failure(decideAsRuntime(d));
  expect(e1.message).toBe('The author of a revision does not decide it');noAuthorityCode(e1);
  const e2=await failure(asOp(S,tx=>insDec(tx,d)));
  expect(e2.message).toBe('The author of a revision does not decide it');noAuthorityCode(e2);
 }
 expect(await rows('SELECT id FROM review_decisions')).toHaveLength(0);
});

test('a review-delegation decision needs an active delegation of the same person, project and document type',async()=>{
 const w=await world();
 const others=await delegate(h,ids.sales,approver.id);
 const wrongType=await delegate(h,ids.sales,await mkUser([[ids.sales,'technical']]),['plan']);
 const wrongTypeUser=(await rows<{delegate_id:string}>('SELECT delegate_id FROM review_delegations WHERE id=$1',[wrongType]))[0].delegate_id;
 const cases:[string,D][]=[
  ['someone else’s delegation',decisionOf(w,{delegation_id:others})],
  ['document type outside doc_types',decisionOf(w,{decided_by:wrongTypeUser,delegation_id:wrongType})],
  ['no delegation id',decisionOf(w,{delegation_id:null})],
  ['unknown delegation',decisionOf(w,{delegation_id:randomUUID()})],
 ];
 for(const [label,d] of cases) expect((await failure(decideAsRuntime(d))).code,label).toBe('LTR01');
 // the delegation of the same person, revoked
 await revokeDelegation(h,w.delegationId);
 expect((await failure(decideAsRuntime(decisionOf(w)))).code,'revoked').toBe('LTR01');
 // a delegation of another project is not visible to the guard either
 const transport=await world({project:ids.transport});
 expect((await failure(decideAsRuntime(decisionOf(w,{delegation_id:transport.delegationId})))).code,'other project').toBe('LTR01');
 // control: a fresh designation of the reviewer works
 const fresh=await delegate(h,ids.sales,reviewer.id);
 await decideAsRuntime(decisionOf(w,{delegation_id:fresh}));
 expect(await rows('SELECT id FROM review_decisions')).toHaveLength(1);
});

test('a reviewer cannot record an approval by raw SQL',async()=>{
 const w=await world();
 // a delegation can never approve: the table CHECK refuses it even when every guard passes
 const e=await failure(decideAsRuntime(decisionOf(w,{result:'approved'})));
 expect(e.message).toMatch(/review_decisions_approval_needs_grant/);noAuthorityCode(e);
 // approval_grant without a row in document_approvers, with another type, or held by a project viewer
 const plan=await mkUser([[ids.sales,'technical']]);
 await grantDocApproval(h,plan,ids.sales,['plan']);
 const viewerHolder=await mkUser([[ids.sales,'viewer']]);
 await grantDocApproval(h,viewerHolder,ids.sales,['design']);
 for(const [who,label] of [[reviewer.id,'no code'],[plan,'another document type'],[viewerHolder,'project viewer']] as const)
  for(const result of ['approved','changes_requested']) {
   const f=await failure(decideAsRuntime(approvalOf(w,who,{result})));
   expect(f.code,label+' '+result).toBe('LTR01');
  }
 // control: the business approver with the design code approves
 await grantDocApproval(h,approver.id,ids.sales,['design']);
 await decideAsRuntime(approvalOf(w,approver.id));
 expect((await rows('SELECT result,authority,delegation_id FROM review_decisions'))).toEqual([{result:'approved',authority:'approval_grant',delegation_id:null}]);
});

test('a decision must name the latest revision, its hash and the current record version',async()=>{
 const w=await world();
 const second=await rawRevision(w.docId,member.id);
 const latest:W={...w,revisionId:second.revisionId,version:second.version,hash:second.hash as string,revisionNo:second.no};
 const bad:[string,D][]=[
  ['an older revision',decisionOf(w,{record_version:second.version})],
  ['a hash that does not match',decisionOf(latest,{revision_hash:'c'.repeat(64)})],
  ['a null hash for a hashed revision',decisionOf(latest,{revision_hash:null})],
  ['a wrong revision number',decisionOf(latest,{revision_no:latest.revisionNo+1})],
  ['a stale record version',decisionOf(latest,{record_version:latest.version-1})],
  ['a future record version',decisionOf(latest,{record_version:latest.version+1})],
  ['a revision of another document',decisionOf(latest,{document_id:(await registerDoc(h,pm)).record.id})],
 ];
 for(const [label,d] of bad){const e=await failure(decideAsRuntime(d));noAuthorityCode(e);expect(e.message,label).toBeTruthy();}
 expect(await rows('SELECT id FROM review_decisions')).toHaveLength(0);
 await decideAsRuntime(decisionOf(latest));
 expect(await rows('SELECT id FROM review_decisions')).toHaveLength(1);
});

test('approval needs the approval grant and a frozen revision',async()=>{
 const w=await world();
 await grantDocApproval(h,approver.id,ids.sales,['design']);
 // each way a revision can fall short of frozen; the guard raises before the CHECK, with no authority code
 const shortfalls:[string,{snapshot?:string|null;verification?:string;hash?:string|null}][]=[
  ['no snapshot',{snapshot:null}],['self-declared hash',{verification:'self_declared'}],['no hash',{hash:null}],
 ];
 for(const [label,o] of shortfalls){
  const r=await rawRevision(w.docId,member.id,o);
  const d=approvalOf({...w,revisionId:r.revisionId,version:r.version,hash:r.hash as string,revisionNo:r.no},approver.id,{revision_hash:r.hash});
  const e=await failure(decideAsRuntime(d));noAuthorityCode(e);
  expect(e.message,label).toBe('An approval needs a verified, snapshotted revision');
 }
 // the same revision may still receive a changes_requested decision: the freezing rule is for approval only
 const last=await rawRevision(w.docId,member.id,{snapshot:null,verification:'self_declared',hash:null});
 const open:W={...w,revisionId:last.revisionId,version:last.version,hash:'',revisionNo:last.no};
 await decideAsRuntime(decisionOf(open,{revision_hash:null}));
 // an approver without the grant cannot approve a frozen revision
 const frozen=await frozenRevision(h,w.docId,member.id);
 const f:W={...w,revisionId:frozen.revisionId,version:frozen.version,hash:frozen.hash,revisionNo:(await rows<{n:number}>('SELECT revision_no n FROM document_revisions WHERE id=$1',[frozen.revisionId]))[0].n};
 expect((await failure(decideAsRuntime(approvalOf(f,reviewer.id)))).code).toBe('LTR01');
 await decideAsRuntime(approvalOf(f,approver.id));
 expect((await rows('SELECT result FROM review_decisions WHERE document_revision_id=$1',[f.revisionId]))).toEqual([{result:'approved'}]);
});

test('runtime can move the approved pointer only to a revision that has an approval decision',async()=>{
 const w=await world();
 await grantDocApproval(h,approver.id,ids.sales,['design']);
 const message='Approved pointer requires an approval decision on a frozen revision';

 const move=(to:string|null,person:string|null=approver.id)=>as(person,S,async tx=>(await tx.query<{approved_revision_id:string|null}>(
  'UPDATE document_records SET approved_revision_id=$2,updated_at=now() WHERE id=$1 RETURNING approved_revision_id',[w.docId,to])).rows);
 expect((await failure(move(w.revisionId))).message).toBe(message);
 // a changes_requested decision is not an approval
 await decideAsRuntime(decisionOf(w));
 expect((await failure(move(w.revisionId))).message).toBe(message);
 // another revision of the same document, with no decision
 const second=await frozenRevision(h,w.docId,member.id);
 expect((await failure(move(second.revisionId))).message).toBe(message);
 const f:W={...w,revisionId:second.revisionId,version:second.version,hash:second.hash,revisionNo:(await rows<{n:number}>('SELECT revision_no n FROM document_revisions WHERE id=$1',[second.revisionId]))[0].n};
 await decideAsRuntime(approvalOf(f,approver.id));
 expect(await move(second.revisionId)).toEqual([{approved_revision_id:second.revisionId}]);
 // the first revision still has no approval; clearing the pointer is refused too
 expect((await failure(move(w.revisionId))).message).toBe(message);
 expect((await failure(move(null))).message).toBe(message);
 // writes that leave the pointer alone are not blocked
 await as(pm.id,S,tx=>tx.query('UPDATE document_records SET updated_at=now() WHERE id=$1',[w.docId]));
 // the operational login still sets it directly, as in slice 1
 await h.operator.query('UPDATE document_records SET approved_revision_id=$2 WHERE id=$1',[w.docId,w.revisionId]);
 expect((await rows('SELECT approved_revision_id FROM document_records WHERE id=$1',[w.docId]))[0]).toEqual({approved_revision_id:w.revisionId});
 await h.operator.query('UPDATE document_records SET approved_revision_id=NULL WHERE id=$1',[w.docId]);
 expect(await rows('SELECT approved_revision_id FROM document_records WHERE id=$1',[w.docId])).toEqual([{approved_revision_id:null}]);
});

test('one decision per revision',async()=>{
 const w=await world();
 await as(reviewer.id,S,tx=>insDec(tx,decisionOf(w)));
 const e=await failure(as(reviewer.id,S,tx=>insDec(tx,decisionOf(w,{result:'changes_requested'}))));
 expect(e.code).toBe('23505');
 expect(e.message).toMatch(/review_decisions_document_revision_id_key/);
});

test('history tables reject update and delete; delegations and dependencies reject delete',async()=>{
 const {w,other}=await seedAll();
 const append=/Append-only history/;
 for(const [sql,p] of [
  ["UPDATE review_comments SET body='x'",[]],['DELETE FROM review_comments',[]],
  ["UPDATE review_decisions SET scope_note='Phạm vi khác nhau'",[]],['DELETE FROM review_decisions',[]],
  ["UPDATE review_events SET kind='x'",[]],['DELETE FROM review_events',[]],
  ['DELETE FROM review_delegations',[]],['DELETE FROM document_dependencies',[]],
 ] as [string,unknown[]][]) expect((await failure(h.operator.query(sql,p))).message,sql).toMatch(append);
 // the pieces the history relies on are still there
 for(const t of tables) expect((await rows<{n:number}>(`SELECT count(*)::int n FROM ${t}`))[0].n,t).toBe(1);
 expect(w.docId).not.toBe(other);
});

test('a dependency cannot point a document at itself and is unique per pair',async()=>{
 const up=await world();
 const down=await registerDoc(h,pm);
 expect((await failure(insDep(h.operator,up,up.docId,pm.id))).message).toMatch(/document_dependencies_not_self/);
 await as(pm.id,S,tx=>insDep(tx,up,down.record.id,pm.id));
 const dup=await failure(as(pm.id,S,tx=>insDep(tx,up,down.record.id,pm.id)));
 expect(dup.code).toBe('23505');
 // runtime registers an unflagged dependency only
 const third=(await registerDoc(h,pm)).record.id;
 expect((await failure(as(pm.id,S,tx=>tx.query(`INSERT INTO document_dependencies(tenant_id,project_id,upstream_document_id,upstream_revision_id,dependent_document_id,confirmed_by,needs_review)
   VALUES($1,$2,$3,$4,$5,$6,true)`,[ids.tenant,ids.sales,up.docId,up.revisionId,third,pm.id])))).message).toMatch(/permission denied/);
 // flagging: both columns move together, to a revision of the upstream document only
 const flag=(to:string|null,flag:boolean)=>as(pm.id,S,tx=>tx.query(
  `UPDATE document_dependencies SET needs_review=$2,flagged_revision_id=$3,flagged_at=now(),version=version+1,updated_at=now() WHERE dependent_document_id=$1 RETURNING version`,[down.record.id,flag,to]));
 const notCleared='A dependency flag is set or advanced, not cleared';
 expect((await failure(flag(null,true))).message).toBe(notCleared);
 expect((await failure(flag(up.revisionId,false))).message).toBe(notCleared);
 // the pair CHECK holds for the operational login too, which the guard lets through
 expect((await failure(h.operator.query('UPDATE document_dependencies SET needs_review=true,version=version+1 WHERE dependent_document_id=$1',[down.record.id]))).message).toMatch(/document_dependencies_flag_pair/);
 const foreign=await frozenRevision(h,(await registerDoc(h,pm)).record.id,member.id);
 expect((await failure(flag(foreign.revisionId,true))).message).toBe('A dependency flag moves to a newer revision of the upstream document');
 // the guard refuses first for the runtime role, so the foreign key on (flagged_revision_id, upstream_document_id) is shown through the operational login, which the guard lets through
 expect((await failure(h.operator.query('UPDATE document_dependencies SET needs_review=true,flagged_revision_id=$2,flagged_at=now(),version=version+1 WHERE dependent_document_id=$1',[down.record.id,foreign.revisionId]))).code).toBe('23503');
 expect((await failure(flag(up.revisionId,true))).message).toBe('A dependency flag moves to a newer revision of the upstream document');
 const newerUp=await frozenRevision(h,up.docId,member.id);
 expect((await flag(newerUp.revisionId,true)).rows).toEqual([{version:2}]);
 expect((await failure(as(pm.id,S,tx=>tx.query("UPDATE document_dependencies SET note='x' WHERE dependent_document_id=$1",[down.record.id])))).message).toMatch(/permission denied/);
});

test('no review table has a bytes or file content column',async()=>{
 const cols=await rows<{table_name:string;column_name:string;data_type:string}>(
  `SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1)`,[tables]);
 expect(new Set(cols.map(c=>c.table_name))).toEqual(new Set(tables));
 expect(cols.filter(c=>c.data_type==='bytea'||/bytes|blob|binary|file|content|attachment|snapshot/i.test(c.column_name))).toEqual([]);
 expect(new Set(cols.map(c=>c.data_type))).toEqual(new Set(['uuid','timestamp with time zone','text','integer','boolean','jsonb','ARRAY']));
});

test('column-level grants: INSERT leaves ids, timestamps and decided_at to defaults; UPDATE covers only the named columns; nothing else is granted',async()=>{
 const allow=async(role:string,table:string,priv:'INSERT'|'UPDATE')=>(await rows<{column_name:string;ok:boolean}>(
  `SELECT column_name,has_column_privilege($1,$2,column_name,$3) ok FROM information_schema.columns WHERE table_schema='public' AND table_name=$4 ORDER BY ordinal_position`,
  [role,'public.'+table,priv,table])).filter(c=>c.ok).map(c=>c.column_name).sort();
 const insert:Record<string,string[]>={
  review_delegations:'tenant_id,project_id,delegate_id,doc_types,granted_by,basis'.split(','),
  review_comments:'tenant_id,project_id,document_id,document_revision_id,parent_id,kind,anchor,body,actor_id,request_id,trace_id'.split(','),
  review_decisions:decisionCols.split(','),
  document_dependencies:'tenant_id,project_id,upstream_document_id,upstream_revision_id,dependent_document_id,note,confirmed_by'.split(','),
  review_events:'tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload'.split(','),
 };
 const update:Record<string,string[]>={review_delegations:['revoke_basis','revoked_at','revoked_by'],review_comments:[],review_decisions:[],review_events:[],
  document_dependencies:['flagged_at','flagged_revision_id','needs_review','updated_at','version']};
 for(const t of tables){
  expect(await allow('libetech_runtime',t,'INSERT'),t+' INSERT').toEqual([...insert[t]].sort());
  expect(await allow('libetech_runtime',t,'UPDATE'),t+' UPDATE').toEqual(update[t]);
  for(const priv of ['DELETE','TRUNCATE','REFERENCES','TRIGGER'])
   expect((await rows<{ok:boolean}>('SELECT has_table_privilege($1,$2,$3) ok',['libetech_runtime','public.'+t,priv]))[0].ok,t+' '+priv).toBe(false);
  expect((await rows<{ok:boolean}>('SELECT has_table_privilege($1,$2,$3) ok',['libetech_runtime','public.'+t,'SELECT']))[0].ok,t+' SELECT').toBe(true);
  if((await rows<{r:string|null}>("SELECT to_regrole('libetech_ai')::text r"))[0].r)
   for(const priv of ['SELECT','INSERT','UPDATE','DELETE']) expect((await rows<{ok:boolean}>('SELECT has_table_privilege($1,$2,$3) ok',['libetech_ai','public.'+t,priv]))[0].ok,'ai '+t+' '+priv).toBe(false);
 }
 expect((await rows<{ok:boolean}>("SELECT has_column_privilege('libetech_runtime','public.document_records','approved_revision_id','UPDATE') ok"))[0].ok).toBe(true);
 // and the grant is refused at statement time for the columns that stay with the defaults
 const w=await world();
 const old='2020-01-01T00:00:00Z',idv='00000000-0000-4000-8000-0000000000cc';
 const w1=[ids.tenant,ids.sales,w.docId,w.revisionId];
 const tries:[string,string,unknown[]][]=[
  ['review_comments','tenant_id,project_id,document_id,document_revision_id,kind,body,actor_id,request_id,trace_id,created_at',[...w1,'comment','x',pm.id,idv,idv,old]],
  ['review_comments','tenant_id,project_id,document_id,document_revision_id,kind,body,actor_id,request_id,trace_id,id',[...w1,'comment','x',pm.id,idv,idv,idv]],
  ['review_decisions',decisionCols+',decided_at',[ids.tenant,ids.sales,w.docId,w.revisionId,1,w.hash,w.version,'changes_requested','Phạm vi mẫu','[]','review_delegation',w.delegationId,reviewer.id,'k',idv,idv,old]],
  ['review_decisions',decisionCols+',id',[ids.tenant,ids.sales,w.docId,w.revisionId,1,w.hash,w.version,'changes_requested','Phạm vi mẫu','[]','review_delegation',w.delegationId,reviewer.id,'k',idv,idv,idv]],
  ['review_events','tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload,created_at',[ids.tenant,ids.sales,'review_comment',idv,pm.id,'k',idv,idv,'{}',old]],
  ['document_dependencies','tenant_id,project_id,upstream_document_id,upstream_revision_id,dependent_document_id,confirmed_by,flagged_at',[...w1,w.docId,pm.id,old]],
 ];
 for(const [t,cols,vals] of tries)
  expect((await failure(as(pm.id,S,tx=>tx.query(`INSERT INTO ${t}(${cols}) VALUES(${vals.map((_,i)=>'$'+(i+1)).join(',')})`,vals)))).message,t+' '+cols.split(',').pop()).toMatch(/permission denied/);
});

test('confirmed_by is bound to the acting person',async()=>{
 const up=await world();
 const down=await registerDoc(h,pm);
 const rls=/row-level security/;
 expect((await failure(as(member.id,S,tx=>insDep(tx,up,down.record.id,pm.id)))).message).toMatch(rls);
 expect((await failure(as(null,S,tx=>insDep(tx,up,down.record.id,pm.id)))).message).toMatch(rls);
 await as(pm.id,S,tx=>insDep(tx,up,down.record.id,pm.id));
});

test('an insert with no context at all is refused on every review table',async()=>{
 const {w,other}=await seedAll();
 const bare=(fn:(tx:Queryable)=>Promise<unknown>)=>h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return fn(tx);});
 expect((await failure(bare(tx=>insDel(tx,{delegate:approver.id})))).code).toBe('LTR02');
 expect((await failure(bare(tx=>insDec(tx,decisionOf(w))))).message).toBe('A decision names a document of the project');
 expect((await failure(bare(tx=>insComment(tx,w,pm.id)))).message).toMatch(/row-level security/);
 expect((await failure(bare(tx=>insDep(tx,w,other,pm.id,{upstream:w.docId})))).message).toMatch(/row-level security/);
 expect((await failure(bare(tx=>insEvent(tx,pm.id)))).message).toMatch(/row-level security/);
 for(const t of tables) expect((await rows<{n:number}>(`SELECT count(*)::int n FROM ${t}`))[0].n,t).toBe(1);
});

test('a delegate who lost the project role or was deactivated cannot decide, although the delegation was never revoked',async()=>{
 const w=await world();
 const setRole=(role:string)=>h.operator.query('UPDATE identity.memberships SET project_role=$2 WHERE user_id=$1 AND project_id=$3',[reviewer.id,role,ids.sales]);
 await setRole('viewer');
 expect((await failure(decideAsRuntime(decisionOf(w)))).code,'viewer').toBe('LTR01');
 await setRole('technical');
 await h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[reviewer.id]);
 expect((await failure(decideAsRuntime(decisionOf(w)))).code,'deactivated').toBe('LTR01');
 expect((await rows('SELECT revoked_at FROM review_delegations WHERE id=$1',[w.delegationId]))[0]).toEqual({revoked_at:null});
 await h.operator.query('UPDATE identity.users SET active=true WHERE id=$1',[reviewer.id]);
 await decideAsRuntime(decisionOf(w));
 expect(await rows('SELECT id FROM review_decisions')).toHaveLength(1);
});

test('the approved pointer cannot go back to an older approved revision, nor be moved by anyone but the approver',async()=>{
 const w=await world();
 await grantDocApproval(h,approver.id,ids.sales,['design']);
 const message='Approved pointer requires an approval decision on a frozen revision';
 const move=(to:string,person:string|null)=>as(person,S,async tx=>(await tx.query<{approved_revision_id:string|null}>(
  'UPDATE document_records SET approved_revision_id=$2,updated_at=now() WHERE id=$1 RETURNING approved_revision_id',[w.docId,to])).rows);
 const pointer=async()=>(await rows<{p:string|null}>('SELECT approved_revision_id p FROM document_records WHERE id=$1',[w.docId]))[0].p;
 await decideAsRuntime(approvalOf(w,approver.id));
 expect(await move(w.revisionId,approver.id)).toEqual([{approved_revision_id:w.revisionId}]);
 const second=await frozenRevision(h,w.docId,member.id);
 const w2:W={...w,revisionId:second.revisionId,version:second.version,hash:second.hash,revisionNo:(await rows<{n:number}>('SELECT revision_no n FROM document_revisions WHERE id=$1',[second.revisionId]))[0].n};
 await decideAsRuntime(approvalOf(w2,approver.id));
 // revision 2 is approved and the latest; the pointer is still on revision 1: only the approver moves it
 for(const who of [reviewer.id,pm.id,null]) {
  expect((await failure(move(second.revisionId,who))).message,String(who)).toBe(message);
  expect(await pointer()).toBe(w.revisionId);
 }
 expect(await move(second.revisionId,approver.id)).toEqual([{approved_revision_id:second.revisionId}]);
 // it never goes back to revision 1, which also carries an approval decision and is frozen
 for(const who of [approver.id,reviewer.id,pm.id,null]) {
  expect((await failure(move(w.revisionId,who))).message,String(who)).toBe(message);
  expect(await pointer()).toBe(second.revisionId);
 }
 // one statement that moves both pointers back to the older approved revision is refused too, and leaves the row as it was
 const row=async()=>(await rows('SELECT latest_revision_id,approved_revision_id,version FROM document_records WHERE id=$1',[w.docId]))[0];
 const before=await row();
 const both=(to:string)=>as(approver.id,S,tx=>tx.query('UPDATE document_records SET latest_revision_id=$2,approved_revision_id=$2 WHERE id=$1',[w.docId,to]));
 await failure(both(w.revisionId));
 expect(await row()).toEqual(before);
 // the same statement forward: revision 3 is approved while it is the latest, then the operational login puts latest back on revision 2;
 // moving latest and approved to revision 3 in one statement is refused because the pointer must follow the latest BEFORE the statement
 const third=await frozenRevision(h,w.docId,member.id);
 const w3:W={...w,revisionId:third.revisionId,version:third.version,hash:third.hash,revisionNo:(await rows<{n:number}>('SELECT revision_no n FROM document_revisions WHERE id=$1',[third.revisionId]))[0].n};
 await decideAsRuntime(approvalOf(w3,approver.id));
 await h.operator.query('UPDATE document_records SET latest_revision_id=$2 WHERE id=$1',[w.docId,second.revisionId]);
 const before3=await row();
 expect((await failure(both(third.revisionId))).message).toBe(message);
 expect(await row()).toEqual(before3);
});

test('the latest-revision pointer only moves forward for the runtime role',async()=>{
 const doc=await registerDoc(h,pm);
 const r1=await proposeRev(h,pm,doc);
 const r2=await proposeRev(h,pm,r1);
 const first=r1.record.latest_revision_id as string,second=r2.record.latest_revision_id as string;
 expect(first).not.toBe(second);
 const other=await proposeRev(h,pm,await registerDoc(h,pm));
 const otherRev=other.record.latest_revision_id as string;
 const msg='The latest revision of a document only moves forward';
 const move=(to:string|null)=>as(pm.id,S,tx=>tx.query('UPDATE document_records SET latest_revision_id=$2 WHERE id=$1',[doc.record.id,to]));
 const latest=async()=>(await rows<{l:string|null}>('SELECT latest_revision_id l FROM document_records WHERE id=$1',[doc.record.id]))[0].l;
 for(const [label,to] of [['an older revision',first],['a revision of another document',otherRev],['NULL',null]] as [string,string|null][]){
  expect((await failure(move(to))).message,label).toBe(msg);
  expect(await latest(),label).toBe(second);
 }
 // the service path still works, and the operational login still sets it directly
 const r3=await proposeRev(h,pm,r2);
 expect(r3.record.latest_revision_id).not.toBe(second);
 await h.operator.query('UPDATE document_records SET latest_revision_id=$2 WHERE id=$1',[doc.record.id,first]);
 expect(await latest()).toBe(first);
});

test('runtime sets or advances a dependency flag but cannot clear it; the version moves by exactly one',async()=>{
 const up=await world();
 const down=await registerDoc(h,pm);
 await as(pm.id,S,tx=>insDep(tx,up,down.record.id,pm.id));
 const upd=(set:string,params:unknown[]=[])=>as(pm.id,S,async tx=>(await tx.query<R>(
  `UPDATE document_dependencies SET ${set} WHERE dependent_document_id=$1 RETURNING needs_review,flagged_revision_id,version`,[down.record.id,...params])).rows);
 const first=await frozenRevision(h,up.docId,member.id);
 const newer=await frozenRevision(h,up.docId,member.id);
 const older='A dependency flag moves to a newer revision of the upstream document';
 // with no flag yet, the confirmed revision itself is not newer
 expect((await failure(upd('needs_review=true,flagged_revision_id=$2,version=version+1',[up.revisionId]))).message).toBe(older);
 // a stamp supplied in the past is overwritten with the transaction time
 expect(await upd("needs_review=true,flagged_revision_id=$2,flagged_at='2000-01-01T00:00:00Z',version=version+1,updated_at='2000-01-01T00:00:00Z'",[first.revisionId]))
  .toEqual([{needs_review:true,flagged_revision_id:first.revisionId,version:2}]);
 const stamps=(await rows<{flagged_at:Date;updated_at:Date}>('SELECT flagged_at,updated_at FROM document_dependencies WHERE dependent_document_id=$1',[down.record.id]))[0];
 expect(stamps.flagged_at.getFullYear()).toBeGreaterThan(2020);expect(stamps.updated_at.getFullYear()).toBeGreaterThan(2020);
 expect(await upd('flagged_revision_id=$2,flagged_at=now(),version=version+1',[newer.revisionId]))
  .toEqual([{needs_review:true,flagged_revision_id:newer.revisionId,version:3}]);
 // advancing to an older revision, or to the same one as a move, is refused
 expect((await failure(upd('flagged_revision_id=$2,version=version+1',[first.revisionId]))).message).toBe(older);
 expect((await failure(upd('flagged_revision_id=$2,version=version+1',[up.revisionId]))).message).toBe(older);
 const state=await rows('SELECT * FROM document_dependencies WHERE dependent_document_id=$1',[down.record.id]);
 const cleared='A dependency flag is set or advanced, not cleared';
 expect((await failure(upd('needs_review=false,flagged_revision_id=NULL,flagged_at=NULL,version=version+1'))).message).toBe(cleared);
 expect((await failure(upd('needs_review=false,version=version+1'))).message).toBe(cleared);
 expect((await failure(upd('flagged_revision_id=NULL,version=version+1'))).message).toBe(cleared);
 expect((await failure(upd('updated_at=now(),version=version+2'))).message).toBe('A dependency version moves by exactly one');
 expect((await failure(upd('updated_at=now()'))).message).toBe('A dependency version moves by exactly one');
 // flagged_at needs a flagged revision
 expect((await failure(h.operator.query('UPDATE document_dependencies SET flagged_revision_id=NULL,needs_review=false,flagged_at=now(),version=version+1 WHERE dependent_document_id=$1',[down.record.id]))).message).toMatch(/document_dependencies_flagged_at_pair/);
 expect(await rows('SELECT * FROM document_dependencies WHERE dependent_document_id=$1',[down.record.id])).toEqual(state);
});

test('a reply cannot point at a comment of another document or revision',async()=>{
 const w=await world();
 const root=await as(reviewer.id,S,async tx=>(await insComment(tx,w,reviewer.id)).rows[0].id);
 const other=await registerDoc(h,pm);
 const ow=await frozenRevision(h,other.record.id,member.id);
 const second=await rawRevision(w.docId,member.id);
 // same project, but the parent is on another document, or on another revision of the same document
 const e1=await failure(as(reviewer.id,S,tx=>insComment(tx,w,reviewer.id,{kind:'addressed',parent:root,doc:other.record.id,rev:ow.revisionId})));
 expect(e1.code).toBe('23503');
 const e2=await failure(as(reviewer.id,S,tx=>insComment(tx,w,reviewer.id,{kind:'addressed',parent:root,rev:second.revisionId})));
 expect(e2.code).toBe('23503');
 await as(reviewer.id,S,tx=>insComment(tx,w,reviewer.id,{kind:'addressed',parent:root}));
});

test('review_events and decisions carry bounds as database backstops',async()=>{
 const w=await world();
 const ev=(kind:string,payload:unknown)=>as(pm.id,S,tx=>tx.query(`INSERT INTO review_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,request_id,trace_id,payload)
  VALUES($1,$2,'review_comment',$3,$4,$5,$6,$6,$7)`,[ids.tenant,ids.sales,randomUUID(),pm.id,kind,randomUUID(),JSON.stringify(payload)]));
 expect((await failure(ev('',{}))).message).toMatch(/review_events_kind_length/);
 expect((await failure(ev('k'.repeat(65),{}))).message).toMatch(/review_events_kind_length/);
 expect((await failure(ev('k',{text:'x'.repeat(8200)}))).message).toMatch(/review_events_payload_size/);
 await ev('k'.repeat(64),{text:'x'.repeat(100)});
 const dec=(exceptions:string)=>as(reviewer.id,S,tx=>tx.query(`INSERT INTO review_decisions(${decisionCols}) VALUES($1,$2,$3,$4,$5,$6,$7,'changes_requested','Phạm vi mẫu cho bản thử',$8,'review_delegation',$9,$10,'k',$11,$11)`,
  [ids.tenant,ids.sales,w.docId,w.revisionId,w.revisionNo,w.hash,w.version,exceptions,w.delegationId,reviewer.id,randomUUID()]));
 expect((await failure(dec('{"a":1}'))).message).toMatch(/review_decisions_exceptions_array/);
 expect((await failure(dec(JSON.stringify(Array(11).fill('x'))))).message).toMatch(/review_decisions_exceptions_bounds/);
 expect((await failure(dec(JSON.stringify(Array(10).fill('x'.repeat(2000)))))).message).toMatch(/review_decisions_exceptions_bounds/);
 await dec(JSON.stringify(Array(10).fill('x'.repeat(100))));
});

test('each authority branch raises its own SQLSTATE and no integrity branch does',async()=>{
 const w=await world();
 const x=await mkUser([[ids.transport,'manager'],[ids.sales,'engineer']]);
 const both=[ids.sales,ids.transport];
 const live=await delegate(h,ids.sales,approver.id);
 const dep2=await registerDoc(h,pm);
 await as(pm.id,S,tx=>insDep(tx,w,dep2.record.id,pm.id));
 const attempts:[string,string|null,()=>Promise<unknown>][]=[
  // authority branches: one code each
  ['decision: no authority','LTR01',()=>decideAsRuntime(approvalOf(w,reviewer.id))],
  ['decision: delegate lost the role','LTR01',async()=>{await h.operator.query("UPDATE identity.memberships SET project_role='viewer' WHERE user_id=$1",[reviewer.id]);
    try{await decideAsRuntime(decisionOf(w));}finally{await h.operator.query("UPDATE identity.memberships SET project_role='technical' WHERE user_id=$1",[reviewer.id]);}}],
 ['designation: granter is an engineer','LTR02',()=>as(member.id,S,tx=>insDel(tx,{delegate:reviewer.id,granted:member.id}))],
  ['designation: delegate not a member','LTR02',()=>as(pm.id,S,tx=>insDel(tx,{delegate:transportApprover.id}))],
  ['revocation: revoker is an engineer','LTR03',()=>as(x,both,tx=>revoke(tx,live,x))],
  // integrity and platform branches: no LTR code
  ['decision: wrong hash','none',()=>decideAsRuntime(decisionOf(w,{revision_hash:'d'.repeat(64)}))],
  ['decision: stale record version','none',()=>decideAsRuntime(decisionOf(w,{record_version:w.version+5}))],
  ['check violation','none',()=>insDel(h.operator,{delegate:pm.id,granted:pm.id})],
  ['row-level security violation','none',()=>as(member.id,S,tx=>insEvent(tx,pm.id))],
  ['column-privilege violation','none',()=>as(pm.id,S,tx=>tx.query('UPDATE review_delegations SET basis=$2 WHERE id=$1',[live,'Căn cứ khác']))],
  ['unique violation','none',()=>insDel(h.operator,{delegate:approver.id})],
  ['revoke guard: repeat','none',async()=>{await revokeDelegation(h,live);await h.operator.query("UPDATE review_delegations SET revoked_at=now(),revoked_by=revoked_by,revoke_basis='Thu hồi lần hai' WHERE id=$1",[live]);}],
  ['pointer guard','none',()=>as(pm.id,S,tx=>tx.query('UPDATE document_records SET approved_revision_id=$2 WHERE id=$1',[w.docId,w.revisionId]))],
  ['flag guard: clear','none',()=>as(pm.id,S,tx=>tx.query("UPDATE document_dependencies SET needs_review=false,flagged_revision_id=NULL,flagged_at=NULL,version=version+1 WHERE dependent_document_id=$1",[dep2.record.id]))],
  ['flag guard: version','none',()=>as(pm.id,S,tx=>tx.query("UPDATE document_dependencies SET updated_at=now(),version=version+3 WHERE dependent_document_id=$1",[dep2.record.id]))],
 ];
 for(const [label,code,run] of attempts){
  const e=await failure(run());
  if(code==='none') noAuthorityCode(e); else expect(e.code,label).toBe(code);
 }
 // the platform codes themselves, for the record
 const codeOf=async(p:Promise<unknown>)=>(await failure(p)).code;
 expect(await codeOf(insDel(h.operator,{delegate:pm.id,granted:pm.id}))).toBe('23514');
 expect(await codeOf(as(member.id,S,tx=>insEvent(tx,pm.id)))).toBe('42501');
 expect(await codeOf(as(pm.id,S,tx=>tx.query('UPDATE review_delegations SET basis=$2 WHERE id=$1',[live,'Căn cứ khác'])))).toBe('42501');
});

describe.skipIf(!native)('decision guard lock (native PostgreSQL)',()=>{
 test('two raw concurrent decisions on one revision end with one row and no deadlock',async()=>{
  const w=await world();
  const second=await mkUser([[ids.sales,'technical']]);
  await delegate(h,ids.sales,second);
  let all!:Promise<PromiseSettledResult<unknown>[]>;
  // the operational login holds the document row; both deciders park on the guard's row lock, then are released together
  await h.operator.transaction(async tx=>{
   await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[w.docId]);
   const mine=(await rows<{id:string}>('SELECT id FROM review_delegations WHERE delegate_id=$1',[second]))[0].id;
   // as the service will: after the insert, the same transaction updates the document row (version bump)
   const decide=(d:D)=>as(d.decided_by,S,async tx=>{await insDec(tx,d);await tx.query('UPDATE document_records SET version=version+1 WHERE id=$1',[w.docId]);});
   all=Promise.allSettled([decide(decisionOf(w)),decide(decisionOf(w,{decided_by:second,delegation_id:mine}))]);
   await waitForBlocked(h,2);
  });
  const res=await all;
  expect(res.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const lost=res.find(r=>r.status==='rejected') as PromiseRejectedResult;
  expect(['23505','P0001']).toContain((lost.reason as Err).code);
  if((lost.reason as Err).code==='P0001') expect((lost.reason as Err).message).toBe('A decision names the latest revision and the current record version');
  expect((lost.reason as Err).code).not.toBe('40P01');
  expect(await rows('SELECT id FROM review_decisions WHERE document_revision_id=$1',[w.revisionId])).toHaveLength(1);
 });
});
