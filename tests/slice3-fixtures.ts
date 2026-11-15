import {createHash,randomUUID} from 'node:crypto';
import type {Allocation} from '../src/server/bom';
import type {Database,Queryable} from '../src/server/db';
import {docApprovalCode,type DocApprovalType} from '../src/server/access-grants';
import {DocumentService} from '../src/server/documents';
import {demoProfiles,ids} from '../src/server/identities';
import type {DocumentDetail,Principal} from '../src/server/types';
import type {Harness} from './slice1-db';
import {member,pm} from './slice1-fixtures';

/** Wraps a database so every row any query returns to the service is kept; tests then assert what the service was ever handed. */
export function recordingDb(db:Database):{db:Database;rows():unknown[]} {
 const seen:unknown[]=[];
 const wrap=(q:Queryable):Queryable=>({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{const r=await q.query<T>(sql,params);seen.push(...r.rows);return r;}});
 return {rows:()=>seen,db:{...wrap(db),transaction:fn=>db.transaction(tx=>fn(wrap(tx))),close:()=>db.close()}};
}

/** Adds one project-to-domain mapping row (synthetic source), as tests/inbox-service.test.ts does. */
export async function mapDomain(h:Harness,projectId:string,code:'LIBERICO_BU'|'XECA'|'IBS_HI',version=1):Promise<void> {
 await h.operator.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,$3,$4,'synthetic-source',$5)",[ids.tenant,projectId,code,pm.id,version]);
}

export const reviewer:Principal={...demoProfiles.technical,grants:[{projectId:ids.sales,role:'technical',reportPermissions:[]}]};
export const approver:Principal={...demoProfiles.business,grants:[{projectId:ids.sales,role:'business',reportPermissions:[]}]};
export const transportApprover:Principal={id:'14000000-0000-4000-8000-000000000031',tenantId:ids.tenant,projectIds:[ids.transport],name:'Người duyệt Vận tải mẫu',role:'technical',
  grants:[{projectId:ids.transport,role:'technical',reportPermissions:[]}]};
export const aiPrincipal={id:'33000000-0000-4000-8000-000000000001',tenantId:ids.tenant};

let docSeq=0;
/** Registers a document through DocumentService; the canonical link is unique per call and the idempotency key is generated. */
export async function registerDoc(h:Harness,p:Principal,over:Record<string,unknown>={}):Promise<DocumentDetail> {
 docSeq+=1;
 return new DocumentService(h.db).register(p,{projectId:ids.sales,refCode:'',docType:'design',title:`Tài liệu tổng hợp số ${docSeq}`,sourceType:'drive',
  canonicalUri:`https://docs.google.com/docs/slice3-${docSeq}`,ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[],...over},randomUUID());
}

/** Proposes the next revision; expected version and base revision come from the document handed in. */
export async function proposeRev(h:Harness,p:Principal,doc:DocumentDetail,over:Record<string,unknown>={}):Promise<DocumentDetail> {
 return new DocumentService(h.db).proposeRevision(p,doc.record.id,{expectedVersion:doc.record.version,basedOnRevisionId:doc.record.latest_revision_id,sourceRevision:null,
  sourceHash:null,sourceModifiedAt:null,changes:{summary:'Thay đổi tổng hợp cho bản thử',present:[],missing:[]},sourceRefs:[],...over},randomUUID());
}

let snapSeq=0;
/** Operational login inserts a verified, snapshotted revision (runtime cannot) and moves the document's latest pointer, version+1. */
export async function frozenRevision(h:Harness,documentId:string,proposedBy:string,hash:string=createHash('sha256').update('slice3-frozen-'+documentId).digest('hex')):Promise<{revisionId:string;version:number;hash:string}> {
 snapSeq+=1;
 return h.operator.transaction(async tx=>{
  await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,[ids.sales,ids.transport].join(',')]);
  const rec=(await tx.query<{project_id:string;canonical_uri:string;source_type:string;latest_revision_id:string|null;version:number}>(
   'SELECT project_id,canonical_uri,source_type,latest_revision_id,version FROM document_records WHERE id=$1 FOR UPDATE',[documentId])).rows[0];
  const no=(await tx.query<{n:number}>('SELECT coalesce(max(revision_no),0)+1 AS n FROM document_revisions WHERE document_id=$1',[documentId])).rows[0].n;
  const revisionId=(await tx.query<{id:string}>(`INSERT INTO document_revisions(tenant_id,project_id,document_id,revision_no,based_on_revision_id,source_id,source_type,
    source_hash,hash_verification,snapshot_ref,proposed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'verified',$9,$10) RETURNING id`,
   [ids.tenant,rec.project_id,documentId,no,rec.latest_revision_id,rec.canonical_uri,rec.source_type,hash,`synthetic://snapshot/${snapSeq}`,proposedBy])).rows[0].id;
  const version=(await tx.query<{version:number}>('UPDATE document_records SET latest_revision_id=$1,version=version+1,updated_at=now() WHERE id=$2 RETURNING version',[revisionId,documentId])).rows[0].version;
  return {revisionId,version,hash};
 });
}

/** The STT-5 scenario of tests/spec004.test.ts on the slice-1 harness: three BoM seats plus a chair, an enabled scope, a live source. */
export async function seedBom(h:Harness):Promise<{workId:string;roster:Principal[];chair:Principal;selection:Allocation;source:string}> {
 const source='Đầu việc Tech!A6:H6';
 const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
 const fingerprint=digest([source,'LBRC','Triển khai bot Hermes','QuânTV, PhươngHV','Đang triển khai'].join('|'));
 const third:Principal={...demoProfiles.engineer,id:randomUUID(),name:'Ghế BoM thử nghiệm',grants:[{projectId:ids.sales,role:'engineer',reportPermissions:[]}]};
 const chair:Principal={...pm,id:randomUUID(),name:'Quản trị thử nghiệm'};
 const roster:Principal[]=[member,pm,third];
 const workId=randomUUID();
 for(const [i,p] of [...roster,chair].entries()) {
  // seedSlice1 already inserted pm and member
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5,'test-fixture') ON CONFLICT DO NOTHING`,
   [p.id,p.tenantId,'slice3-bom-'+i,p.name,p.role]);
  await h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[p.tenantId,p.id,ids.sales]);
  await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[p.tenantId,p.id,String(9100000000+i)]);
 }
 await h.operator.query(`INSERT INTO work_items(id,tenant_id,project_id,service_id,code,title,state,assignee_id)
  VALUES($1,$2,$3,$4,'STT-5','Triển khai bot Hermes','doing',$5)`,[workId,ids.tenant,ids.sales,ids.salesService,member.id]);
 await h.operator.query('INSERT INTO bom_scopes(tenant_id,project_id,seat_ids,enabled) VALUES($1,$2,$3,true)',[ids.tenant,ids.sales,roster.map(p=>p.id)]);
 await h.operator.query(`INSERT INTO bom_sources(work_id,tenant_id,project_id,source_ref,fingerprint,checked_at,valid_until)
  VALUES($1,$2,$3,$4,$5,now(),now()+interval '1 minute')`,[workId,ids.tenant,ids.sales,source,fingerprint]);
 const selection:Allocation={lead_id:pm.id,parts:[{owner_id:member.id,output:'Hồ sơ bàn giao triển khai thử',criteria:'Có kết quả kiểm tra và mốc ghi nhận',dueAt:null,dependency:''}]};
 return {workId,roster,chair,selection,source};
}

/** Active, activated users and memberships (project_role set explicitly): pm manager in sales and transport, member engineer, reviewer technical,
 * approver business (all sales), transportApprover technical (transport). The three sales principals above keep their ids. ON CONFLICT DO NOTHING. */
export async function seedMembers(h:Harness):Promise<void> {
 const rows:{p:Principal;username:string;role:string;projects:string[]}[]=[
  {p:pm,username:'slice3-pm',role:'manager',projects:[ids.sales,ids.transport]},
  {p:member,username:'slice3-member',role:'engineer',projects:[ids.sales]},
  {p:reviewer,username:'slice3-reviewer',role:'technical',projects:[ids.sales]},
  {p:approver,username:'slice3-approver',role:'business',projects:[ids.sales]},
  {p:transportApprover,username:'slice3-transport-approver',role:'technical',projects:[ids.transport]},
 ];
 for(const r of rows) {
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5,'fixture-only')
   ON CONFLICT DO NOTHING`,[r.p.id,r.p.tenantId,r.username,r.p.name,r.role]);
  for(const project of r.projects) await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role)
   VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[r.p.tenantId,r.p.id,project,r.role]);
 }
}

/** Operational login: inserts a synthetic access_change ballot in state 'issued' that names this project and these codes, then sets the
 * membership's report_permissions to what it held plus the codes. The guard of migration 019 accepts it because the ballot names them. */
export async function grantDocApproval(h:Harness,userId:string,projectId:string,types:DocApprovalType[]):Promise<void> {
 const codes=types.map(docApprovalCode);
 const grants=JSON.stringify([{projectId,role:'engineer',reportPermissions:codes}]);
 const previous=JSON.stringify([{projectId,role:'engineer',reportPermissions:[]}]);
 await h.operator.query(`INSERT INTO identity.account_approvals(tenant_id,kind,subject_user_id,subject_account_version,previous_grants,proposer_id,grants,reason,state)
  VALUES($1,'access_change',$2,1,$3,$4,$5,'Phiếu đổi quyền tổng hợp cho bản thử','issued')`,[ids.tenant,userId,previous,pm.id,grants]);
 await h.operator.query(`UPDATE identity.memberships SET report_permissions=(SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(report_permissions||$3::text[]) c),updated_at=now()
  WHERE user_id=$1 AND project_id=$2`,[userId,projectId,codes]);
}

/** Operational login (superuser, so the designation guard is skipped): inserts one review_delegations row granted by pm. Default type ['design']. Returns its id. */
export async function delegate(h:Harness,projectId:string,delegateId:string,docTypes:string[]=['design']):Promise<string> {
 return (await h.operator.query<{id:string}>(`INSERT INTO review_delegations(tenant_id,project_id,delegate_id,doc_types,granted_by,basis)
  VALUES($1,$2,$3,$4::text[],$5,'Chỉ định mẫu cho bản thử') RETURNING id`,[ids.tenant,projectId,delegateId,docTypes,pm.id])).rows[0].id;
}

/** Operational login: revokes a delegation as pm with the fixed basis 'Thu hồi mẫu'; the revoke trigger stamps the time and the version. */
export async function revokeDelegation(h:Harness,id:string):Promise<void> {
 await h.operator.query("UPDATE review_delegations SET revoked_at=now(),revoked_by=$2,revoke_basis='Thu hồi mẫu' WHERE id=$1",[id,pm.id]);
}

/** Wraps a database so that, inside a transaction, `hook` runs once, just before the first statement whose text matches `pattern`.
 * The hook uses another connection (the operational login) to change what the service has already read; it must not touch the service's own transaction. */
export function beforeStatement(db:Database,pattern:RegExp,hook:()=>Promise<void>):Database {
 let fired=false;
 const wrap=(q:Queryable):Queryable=>({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{
  if(!fired&&pattern.test(sql)){fired=true;await hook();}
  return q.query<T>(sql,params);
 }});
 return {...wrap(db),transaction:fn=>db.transaction(tx=>fn(wrap(tx))),close:()=>db.close()};
}
