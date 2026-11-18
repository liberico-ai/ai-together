import type {Queryable} from './db';
import {LATEST_REVISION_ORDER} from './intake';

// The one place that decides whether the stored text of a Telegram revision may leave the database (OQ-30 (b), decided 14/11/2026).
// Every reader of revision text goes through here; the rule lives in SQL so hidden and pointer-only text and hashes never reach Node.
export type StoredMode='excerpt'|'pointer_only';
/**
 * How one revision is shown: 'excerpt' = it stored text and the current config still allows it; 'hidden' = it stored text but the current
 * config no longer allows it (group flag removed, or the project now mapped to IBS_HI); 'pointer_only' = it stored none. Only 'excerpt' carries text or hash.
 */
export type DisplayMode='excerpt'|'hidden'|'pointer_only';
export function displayMode(stored:StoredMode|null,allowed:boolean):DisplayMode {
 if(stored!=='excerpt') return 'pointer_only';
 return allowed?'excerpt':'hidden';
}

/** Latest domain code of project p (SQL expression of a uuid): the mapping row with the highest mapping_version, NULL when unmapped. `intelligence.ai_drafts_pointer_only_guard()` of migration 022 applies the same rule inside the database: the two must change together. */
export const latestDomainSql=(p:string)=>
 `(SELECT m.domain_code FROM project_domain_mappings m WHERE m.project_id=${p} ORDER BY m.mapping_version DESC LIMIT 1)`;
/** True when the latest mapping row of project p is IBS_HI (AGENTS.md:16: pointers, hashes and Tech work metadata only). Unmapped and other labels decide nothing. */
export const isIbsHiSql=(p:string)=>`(coalesce(${latestDomainSql(p)},'')='IBS_HI')`;

/** True while the current config still lets the text of source event e show: group flagged (OQ-28 (c)) and the project's latest mapping row is not IBS_HI. chats = placeholder of a text[] parameter. */
export const textAllowedSql=(e:string,chats:string)=>
 `(${e}.chat_id = ANY(${chats}::text[]) AND NOT ${isIbsHiSql(`${e}.project_id`)})`;

/** Three columns for revision r of source event e: display_mode, visible_text, visible_hash. Text and hash are NULL unless display_mode='excerpt'. */
export const visibleColumnsSql=(r:string,e:string,chats:string)=>{
 const allowed=textAllowedSql(e,chats);
 return `CASE WHEN ${r}.content_mode IS DISTINCT FROM 'excerpt' THEN 'pointer_only' WHEN ${allowed} THEN 'excerpt' ELSE 'hidden' END AS display_mode,
  CASE WHEN ${r}.content_mode='excerpt' AND ${allowed} THEN ${r}.text_excerpt END AS visible_text,
  CASE WHEN ${r}.content_mode='excerpt' AND ${allowed} THEN ${r}.content_hash END AS visible_hash`;
};

/** Body of the CTE `lat` for project $1: cid, match_hash (raw hash, for comparison inside SQL only) and the three visible columns. Newest revision by LATEST_REVISION_ORDER. */
export const latestRevisionCte=(chats:string)=>
 `SELECT DISTINCT ON (c.id) c.id AS cid, r.content_hash AS match_hash, ${visibleColumnsSql('r','e',chats)}
  FROM intake_candidates c JOIN source_events e ON e.id=c.root_source_event_id JOIN source_event_revisions r ON r.source_event_id=e.id
  WHERE c.project_id=$1 ORDER BY c.id, ${LATEST_REVISION_ORDER}`;

/** «Cùng nội dung» hint as before: equal stored hash inside the project, compared in SQL; the hash itself is not returned.
 * Relies on the caller's aliases: `lat` (latest revisions), `l` (the current row of `lat`) and `c` (the candidate row). */
export const DUPLICATE_HINT_SQL=`(SELECT coalesce(json_agg(l2.cid ORDER BY l2.cid),'[]'::json) FROM lat l2 WHERE l2.match_hash=l.match_hash AND l2.cid<>c.id)`;

export type VisibleRevision={revisionNo:number;editedAt:string|null;displayMode:DisplayMode;text:string|null;contentHash:string|null;textTruncated:boolean;recordedAt:string};
/** Revisions of one source event, newest first, each shown by its own stored mode and the current config. excerptChats empty or missing = everything hidden. */
export async function listVisibleRevisions(tx:Queryable,sourceEventId:string,excerptChats:readonly string[]):Promise<VisibleRevision[]> {
 const rows=(await tx.query<{revision_no:number;edited_at:unknown;display_mode:DisplayMode;visible_text:string|null;visible_hash:string|null;text_truncated:boolean;created_at:unknown}>(
  `SELECT r.revision_no, r.edited_at, ${visibleColumnsSql('r','e','$2')}, r.text_truncated, r.created_at
   FROM source_event_revisions r JOIN source_events e ON e.id=r.source_event_id
   WHERE r.source_event_id=$1 ORDER BY ${LATEST_REVISION_ORDER}`,[sourceEventId,[...excerptChats]])).rows;
 return rows.map(r=>({revisionNo:r.revision_no,editedAt:r.edited_at==null?null:new Date(r.edited_at as string).toISOString(),displayMode:r.display_mode,text:r.visible_text,contentHash:r.visible_hash,
  textTruncated:r.text_truncated,recordedAt:new Date(r.created_at as string).toISOString()}));
}

export type VisibleMessage={sourceEventId:string;ref:string;observedAt:string;forwarded:boolean;displayMode:DisplayMode;text:string|null;contentHash:string|null};
/**
 * Newest revision of each message in the thread of one candidate (same chat_id and thread_key, project $1 only), the newest `limit` messages by
 * observed_at then id, returned oldest first (ties by id), each shown by its own stored mode and the current config. A candidate that is not in the project gives [].
 */
export async function visibleThreadMessages(tx:Queryable,projectId:string,candidateId:string,excerptChats:readonly string[],limit:number):Promise<VisibleMessage[]> {
 const n=Math.max(0,Math.min(Math.trunc(limit),200));
 const rows=(await tx.query<{id:string;source_id:string;observed_at:unknown;forwarded:boolean;display_mode:DisplayMode;visible_text:string|null;visible_hash:string|null}>(
  `SELECT t.id,t.source_id,t.observed_at,t.forwarded,t.display_mode,t.visible_text,t.visible_hash FROM (
     SELECT e.id,e.source_id,e.observed_at,e.forwarded,${visibleColumnsSql('r','e','$3')}
     FROM intake_candidates c
     JOIN source_events e ON e.project_id=c.project_id AND e.chat_id=c.chat_id AND e.thread_key=c.thread_key
     JOIN LATERAL (SELECT * FROM source_event_revisions r WHERE r.source_event_id=e.id ORDER BY ${LATEST_REVISION_ORDER} LIMIT 1) r ON true
     WHERE c.id=$2::uuid AND c.project_id=$1::uuid AND e.project_id=$1::uuid
     ORDER BY e.observed_at DESC, e.id DESC LIMIT $4::int) t
   ORDER BY t.observed_at ASC, t.id ASC`,[projectId,candidateId,[...excerptChats],n])).rows;
 return rows.map(r=>({sourceEventId:r.id,ref:r.source_id,observedAt:new Date(r.observed_at as string).toISOString(),forwarded:r.forwarded,displayMode:r.display_mode,text:r.visible_text,contentHash:r.visible_hash}));
}

const UUID_LOWER=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/**
 * True when the thread of one candidate of project $1 (same chat_id and thread_key, as visibleThreadMessages) holds at least one revision, of any
 * message, that stored text which the current configuration does not show: the group is not flagged, or the project's latest mapping is IBS_HI.
 * Every revision of every message of the thread is looked at: no cap, and not only the newest revision of a message.
 * A flag list that cannot be evaluated (a null element and no match) counts as not flagged: the test is IS NOT TRUE, never NOT.
 * One boolean: no text and no hash leave the database. A candidate or project id that is not a lower-case uuid gives true without a statement:
 * closed, because such an id is never a reason to show content. A candidate that is not in the project gives false (EXISTS over nothing): callers reach this only for a
 * draft row of the project, and the context check already answers ENTITY_NOT_FOUND for a missing entity.
 */
export async function threadHasHiddenText(tx:Queryable,projectId:string,candidateId:string,excerptChats:readonly string[]):Promise<boolean> {
 if(!UUID_LOWER.test(String(projectId))||!UUID_LOWER.test(String(candidateId))) return true;
 const row=(await tx.query<{hidden:boolean}>(
  `SELECT EXISTS(SELECT 1 FROM intake_candidates c
    JOIN source_events e ON e.project_id=c.project_id AND e.chat_id=c.chat_id AND e.thread_key=c.thread_key
    JOIN source_event_revisions r ON r.source_event_id=e.id
    WHERE c.id=$2::uuid AND c.project_id=$1::uuid AND e.project_id=$1::uuid AND r.project_id=$1::uuid
      AND r.content_mode='excerpt' AND (${textAllowedSql('e','$3')}) IS NOT TRUE) AS hidden`,[projectId,candidateId,[...excerptChats]])).rows[0];
 return row?.hidden!==false;
}

/**
 * True when project $1 holds at least one revision, of any message, that stored text which the current configuration does not show: its group is not
 * flagged, or the project's latest mapping is IBS_HI. Every revision of every message of the project is looked at: no cap, and not only the newest revision.
 * A flag list that cannot be evaluated (a null element and no match) counts as not flagged: the test is IS NOT TRUE, never NOT.
 * One boolean: no text and no hash leave the database.
 * Closed: a project id that is not a lower-case uuid, a statement that returns no row, and a project the calling transaction cannot see (another tenant,
 * a project outside its scope, an id that does not exist) all give true.
 * tx must be a transaction already scoped to the tenant and project (scoped): the tenant boundary is row-level security.
 */
export async function projectHasHiddenText(tx:Queryable,projectId:string,excerptChats:readonly string[]):Promise<boolean> {
 if(!UUID_LOWER.test(String(projectId))) return true;
 const row=(await tx.query<{hidden:boolean}>(
  `SELECT (NOT EXISTS(SELECT 1 FROM projects p WHERE p.id=$1::uuid)
     OR EXISTS(SELECT 1 FROM source_events e JOIN source_event_revisions r ON r.source_event_id=e.id
      WHERE e.project_id=$1::uuid AND r.project_id=$1::uuid
        AND r.content_mode='excerpt' AND (${textAllowedSql('e','$2')}) IS NOT TRUE)) AS hidden`,[projectId,[...excerptChats]])).rows[0];
 return row?.hidden!==false;
}

export type ThreadFreshness={hasBaseline:boolean;newerMessage:boolean;laterEdit:boolean};
/**
 * For the thread of one candidate of project $1 (same chat_id and thread_key, as visibleThreadMessages) and the ids a draft names:
 * hasBaseline = the draft names at least one message of this thread; the baseline is the latest created_at among those;
 * newerMessage = a message of the thread the draft does not name was recorded at or after the baseline;
 * laterEdit = a later revision (revision_no > 1) of any message of the thread was recorded at or after the baseline.
 * Reads ids and record times only: no text and no hash leave the database. Ids that are not lower-case uuids are ignored.
 * The tenant boundary is the row-level security of the three tables, not a condition of this statement.
 * hasBaseline:false is also the answer for a malformed id and for a candidate that is not visible; the other two fields then mean nothing and the caller must hold the draft.
 * tx must be a transaction already scoped to the tenant and project (scoped): the tenant boundary is row-level security.
 */
export async function threadFreshness(tx:Queryable,projectId:string,candidateId:string,namedIds:readonly string[]):Promise<ThreadFreshness> {
 const none={hasBaseline:false,newerMessage:false,laterEdit:false};
 if(!UUID_LOWER.test(String(projectId))||!UUID_LOWER.test(String(candidateId))) return none;
 const named=namedIds.filter(x=>typeof x==='string'&&UUID_LOWER.test(x));
 const row=(await tx.query<{has_baseline:boolean|null;newer_message:boolean|null;later_edit:boolean|null}>(
  `WITH thread AS (
    SELECT e.id, e.created_at FROM intake_candidates c
    JOIN source_events e ON e.project_id=c.project_id AND e.chat_id=c.chat_id AND e.thread_key=c.thread_key
    WHERE c.id=$2::uuid AND c.project_id=$1::uuid AND e.project_id=$1::uuid),
   base AS (SELECT max(t.created_at) AS at FROM thread t WHERE t.id = ANY($3::uuid[]))
   SELECT (SELECT b.at IS NOT NULL FROM base b) AS has_baseline,
    EXISTS(SELECT 1 FROM thread t, base b WHERE (t.id = ANY($3::uuid[])) IS NOT TRUE AND t.created_at >= b.at) AS newer_message,
    EXISTS(SELECT 1 FROM source_event_revisions r JOIN thread t ON t.id=r.source_event_id, base b
           WHERE r.project_id=$1::uuid AND r.revision_no>1 AND r.created_at >= b.at) AS later_edit`,[projectId,candidateId,named])).rows[0];
 return {hasBaseline:row?.has_baseline===true,newerMessage:row?.newer_message===true,laterEdit:row?.later_edit===true};
}
