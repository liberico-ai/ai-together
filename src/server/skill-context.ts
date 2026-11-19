import {z} from 'zod';
import {scoped,type Database,type Queryable} from './db';
import {READ_ROLES} from './document-review';
import {AppError} from './errors';
import {isIbsHiSql,visibleThreadMessages} from './source-text';
import type {ContextSource,SkillContext,SkillName} from './skill-contracts';
import {SKILLS} from './skill-contracts';
import {projectRole} from './types';
import type {DocType,Principal} from './types';

// Slice 3, Task 10: the context handed to a PM/BA skill, built under the rights of the person who asked. One project per context, every statement
// filters by project_id, the text of a message comes only from source-text.ts (visibility decided in SQL), and an IBS HI project gives pointers only.
// Nothing here calls a model. Every denial is one answer: the caller cannot tell an unknown project from one outside its scope.
const NOT_FOUND='Không tìm thấy mục trong phạm vi được cấp.';
const denied=()=>new AppError('SCOPE_DENIED',NOT_FOUND,404);
const invalid=(message:string)=>new AppError('INVALID_INPUT',message,422);

export const MAX_MESSAGES=20,MAX_DOCUMENTS=50,MAX_REVISIONS=30,MAX_SOURCES=100;
type Kind=ContextSource['kind'];
/** Which kinds of source each skill may receive. The manifests of Task 11 copy this table. */
export const CONTEXT_KINDS:Record<SkillName,readonly Kind[]>={
 intake_analyst:['source_event','document'],
 ba_elicitation:['source_event','document','document_revision'],
 pm_planning:['source_event','document','document_revision'],
 technical_writer:['document','document_revision'],
 doc_reviewer:['document','document_revision'],
 release_librarian:['document','document_revision'], // R10-g: only the content of the approved revision; the newest unapproved revision is a pointer (OQ-57)
};

const lower=z.string().transform(s=>s.toLowerCase());
const inputSchema=z.strictObject({skill:z.enum(SKILLS),projectId:lower,candidateId:lower.optional(),documentId:lower.optional()});
export type SkillContextInput={skill:SkillName;projectId:string;candidateId?:string;documentId?:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const strings=(v:unknown):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];

export async function buildSkillContextIn(tx:Queryable,p:Principal,input:SkillContextInput,excerptChats:readonly string[]):Promise<SkillContext> {
 const skill=input.skill,allowed=CONTEXT_KINDS[skill];
 if(!allowed) throw invalid('Kỹ năng không hợp lệ.');
 if(!p||p.role==='bot'||!Array.isArray(p.projectIds)) throw denied();
 const [projectIn,candidateIn,documentIn]=[input.projectId,input.candidateId,input.documentId].map(v=>v===undefined?undefined:String(v).toLowerCase());
 if(!projectIn||!UUID.test(projectIn)) throw denied();
 const project=(await tx.query<{id:string;pointer_only:boolean}>(`SELECT p.id, ${isIbsHiSql('p.id')} AS pointer_only FROM projects p WHERE p.id=$1::uuid`,[projectIn])).rows[0];
 // role and scope are judged on the id the database returned
 if(!project||!p.projectIds.includes(project.id)||!READ_ROLES.has(projectRole(p,project.id))) throw denied();
 const projectId=project.id,pointerOnly=project.pointer_only;
 // An input no kind of this skill can honour is refused, never ignored.
 if(candidateIn!==undefined&&!allowed.includes('source_event')) throw invalid('Kỹ năng này không nhận tin nguồn.');
 if(documentIn!==undefined&&!allowed.includes('document_revision')) throw invalid('Kỹ năng này không nhận các bản của tài liệu.');
 if((candidateIn!==undefined&&!UUID.test(candidateIn))||(documentIn!==undefined&&!UUID.test(documentIn))) throw denied();

 const sources:ContextSource[]=[];
 if(candidateIn!==undefined) {
  const cand=(await tx.query<{id:string}>('SELECT id FROM intake_candidates WHERE id=$1::uuid AND project_id=$2::uuid',[candidateIn,projectId])).rows[0];
  if(!cand) throw denied();
  for(const m of await visibleThreadMessages(tx,projectId,cand.id,excerptChats,MAX_MESSAGES)) {
   const shown=!pointerOnly&&m.displayMode==='excerpt';
   sources.push({id:m.sourceEventId,kind:'source_event',ref:m.ref,mode:m.displayMode,text:shown?m.text:null,hash:shown?m.contentHash:null,observedAt:m.observedAt,forwarded:m.forwarded,revisionNo:m.revisionNo});
  }
 }
 let documentId:string|null=null;
 if(documentIn!==undefined) {
  const doc=(await tx.query<{id:string}>('SELECT id FROM document_records WHERE id=$1::uuid AND project_id=$2::uuid',[documentIn,projectId])).rows[0];
  if(!doc) throw denied();
  documentId=doc.id;
 }
 // Documents: ref_code in byte order, then id; the named document first so a cut never drops it.
 const docs=(await tx.query<{id:string;ref_code:string;doc_type:DocType;title:string|null;latest_revision_id:string|null;approved_revision_id:string|null}>(
  `SELECT d.id,d.ref_code,d.doc_type,CASE WHEN $2::boolean THEN NULL ELSE d.title END AS title,d.latest_revision_id,d.approved_revision_id
   FROM document_records d WHERE d.project_id=$1::uuid
   ORDER BY coalesce(d.id=$3::uuid,false) DESC, d.ref_code COLLATE "C", d.id LIMIT $4::int`,[projectId,pointerOnly,documentId,MAX_DOCUMENTS])).rows;
 for(const d of docs) sources.push({id:d.id,kind:'document',refCode:d.ref_code,docType:d.doc_type,title:d.title,latestRevisionId:d.latest_revision_id,approvedRevisionId:d.approved_revision_id});

 if(documentId!==null) {
  // Newest first. R10-g, read as «only the content of the approved revision»: the release librarian gets the approved revision of the document in full, and the newest revision when it is
  // not the approved one as a pointer (id, document, number; OQ-57). A pointer carries no summary, no list, no source hash and a constant verification; every field is cut here, in
  // the statement, so what it hides never reaches this process. `hide` is every field of content (also for an IBS HI project); `pointer` is the cut of an unapproved revision.
  const librarian=skill==='release_librarian';
  const revs=(await tx.query<{id:string;revision_no:number;summary:string|null;present:unknown;missing:unknown;source_hash:string|null;hash_verification:'self_declared'|'verified'}>(
   `SELECT v.id,v.revision_no,
     CASE WHEN m.hide THEN NULL ELSE v.changes->>'summary' END AS summary,
     CASE WHEN m.hide THEN '[]'::jsonb ELSE coalesce(v.changes->'present','[]'::jsonb) END AS present,
     CASE WHEN m.hide THEN '[]'::jsonb ELSE coalesce(v.changes->'missing','[]'::jsonb) END AS missing,
     CASE WHEN m.pointer THEN NULL ELSE v.source_hash END AS source_hash,
     CASE WHEN m.pointer THEN 'self_declared' ELSE v.hash_verification END AS hash_verification
    FROM document_records d
    JOIN document_revisions v ON v.document_id=d.id AND v.project_id=d.project_id
    CROSS JOIN LATERAL (SELECT ($4::boolean AND v.id IS DISTINCT FROM d.approved_revision_id) AS pointer,
      ($3::boolean OR ($4::boolean AND v.id IS DISTINCT FROM d.approved_revision_id)) AS hide) m
    WHERE d.project_id=$1::uuid AND d.id=$2::uuid
     AND (NOT $4::boolean OR v.id=d.approved_revision_id
      OR v.id=(SELECT n.id FROM document_revisions n WHERE n.project_id=d.project_id AND n.document_id=d.id ORDER BY n.revision_no DESC, n.id LIMIT 1))
    ORDER BY v.revision_no DESC, v.id LIMIT $5::int`,[projectId,documentId,pointerOnly,librarian,MAX_REVISIONS])).rows;
  for(const r of revs) sources.push({id:r.id,kind:'document_revision',documentId,revisionNo:r.revision_no,summary:r.summary,present:strings(r.present),missing:strings(r.missing),sourceHash:r.source_hash,hashVerification:r.hash_verification});
 }
 for(const s of sources) if(!allowed.includes(s.kind)) throw new AppError('CONTEXT_KIND_FORBIDDEN','Ngữ cảnh chứa loại nguồn ngoài bảng của kỹ năng.',500);
 if(sources.length>MAX_SOURCES) throw new AppError('CONTEXT_TOO_LARGE','Ngữ cảnh vượt trần nguồn.',500);
 return {skill,projectId,pointerOnly,sources};
}

/** `raw` is read by a strict schema: a forged tenantId, actorId or projectIds array is an unknown field (422). Reads inside one scoped transaction on exactly one project. */
export async function buildSkillContext(db:Database,p:Principal,raw:unknown,excerptChats:readonly string[]):Promise<SkillContext> {
 const input=inputSchema.parse(raw);
 if(!p||p.role==='bot'||!p.projectIds?.length||!UUID.test(input.projectId)||!p.projectIds.map(x=>x.toLowerCase()).includes(input.projectId)) throw denied();
 return scoped(db,{...p,projectIds:[input.projectId]},tx=>buildSkillContextIn(tx,p,input,excerptChats));
}
