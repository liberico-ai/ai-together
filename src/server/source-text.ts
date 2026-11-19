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

/** `revisionNo` is the number of the revision shown (the newest by LATEST_REVISION_ORDER, not the highest number): the same row the display mode, text and hash come from, and present whatever the display mode is. */
export type VisibleMessage={sourceEventId:string;ref:string;revisionNo:number;observedAt:string;forwarded:boolean;displayMode:DisplayMode;text:string|null;contentHash:string|null};
/**
 * Newest revision of each message in the thread of one candidate (same chat_id and thread_key, project $1 only), the newest `limit` messages by
 * observed_at then id, returned oldest first (ties by id), each shown by its own stored mode and the current config. A candidate that is not in the project gives [].
 * Each message also names the number of the revision it shows (`revisionNo`); a number is not text, so it is given for a hidden or pointer-only message too.
 */
export async function visibleThreadMessages(tx:Queryable,projectId:string,candidateId:string,excerptChats:readonly string[],limit:number):Promise<VisibleMessage[]> {
 const n=Math.max(0,Math.min(Math.trunc(limit),200));
 const rows=(await tx.query<{id:string;source_id:string;revision_no:number;observed_at:unknown;forwarded:boolean;display_mode:DisplayMode;visible_text:string|null;visible_hash:string|null}>(
  `SELECT t.id,t.source_id,t.revision_no,t.observed_at,t.forwarded,t.display_mode,t.visible_text,t.visible_hash FROM (
     SELECT e.id,e.source_id,r.revision_no,e.observed_at,e.forwarded,${visibleColumnsSql('r','e','$3')}
     FROM intake_candidates c
     JOIN source_events e ON e.project_id=c.project_id AND e.chat_id=c.chat_id AND e.thread_key=c.thread_key
     JOIN LATERAL (SELECT * FROM source_event_revisions r WHERE r.source_event_id=e.id ORDER BY ${LATEST_REVISION_ORDER} LIMIT 1) r ON true
     WHERE c.id=$2::uuid AND c.project_id=$1::uuid AND e.project_id=$1::uuid
     ORDER BY e.observed_at DESC, e.id DESC LIMIT $4::int) t
   ORDER BY t.observed_at ASC, t.id ASC`,[projectId,candidateId,[...excerptChats],n])).rows;
 return rows.map(r=>({sourceEventId:r.id,ref:r.source_id,revisionNo:r.revision_no,observedAt:new Date(r.observed_at as string).toISOString(),forwarded:r.forwarded,displayMode:r.display_mode,text:r.visible_text,contentHash:r.visible_hash}));
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

/** What the check of one candidate draft against its thread found. `hasBaseline:false` is the whole answer for a draft with no baseline: `changed` is then false and `position` null, and the caller holds the draft. */
export type ThreadFreshness={hasBaseline:boolean;changed:boolean;position:string|null};
/** A revision number is a whole number that fits the integer column it is compared with. */
const MAX_REVISION_NO=2147483647;
/**
 * OQ-53 (1 (b), 2 (a), 3 (b)). For the thread of one candidate of project $1 (same chat_id and thread_key, as visibleThreadMessages), the ids a draft names (`namedIds`) and the
 * pairs (message id, revision number) it states in `messageRevisions` (`revisions`), in one statement and so one snapshot:
 * 1. hasBaseline is false when no named message belongs to the thread, or a named message of the thread has no pair, or the candidate is not visible: no later rule is looked at.
 * 2. changed when a pair names a revision that is not the latest of its message by LATEST_REVISION_ORDER (a number the message does not have is not the latest either, nor is a message that has no revision);
 *    one probe of the index of the revisions of the message for each pair, not one pass over the thread for each pair (IS DISTINCT FROM: a message with no revision gives NULL, and that is a change);
 * 3. changed when the number of the last revision of the thread differs from the baseline, the largest number among the pairs of the thread, or the thread has no counter, or no pair has a number;
 * 4. changed when any revision of any message of the thread has no number (a revision stored while the numbering was off), whether or not the draft names it.
 * position is that last number as text, to be written down by the confirmation; it is not a number the caller may trust beyond the rule that produced it.
 * Reads ids and numbers only: no text and no hash leave the database. A project or candidate id that is not a lower-case uuid gives hasBaseline:false without a statement; a named id that is
 * not a lower-case uuid is ignored; a pair whose id is not a lower-case uuid, or whose number is not a whole number from 1 to 2147483647, is left out and never sent.
 * Every table is read under the project of the call in the statement itself, not through row-level security alone. tx must be a transaction already scoped to the tenant and project
 * (scoped): the tenant boundary is row-level security. The tables that number a thread are named here and nowhere else in src.
 */
export async function threadFreshness(tx:Queryable,projectId:string,candidateId:string,namedIds:readonly string[],revisions:readonly {id:string;revisionNo:number}[]):Promise<ThreadFreshness> {
 const none:ThreadFreshness={hasBaseline:false,changed:false,position:null};
 if(!UUID_LOWER.test(String(projectId))||!UUID_LOWER.test(String(candidateId))) return none;
 const named=namedIds.filter(x=>typeof x==='string'&&UUID_LOWER.test(x));
 const pairIds:string[]=[],pairNumbers:number[]=[];
 for(const p of Array.isArray(revisions)?revisions:[]) {
  if(!p||typeof p.id!=='string'||!UUID_LOWER.test(p.id)||typeof p.revisionNo!=='number'||!Number.isInteger(p.revisionNo)||p.revisionNo<1||p.revisionNo>MAX_REVISION_NO) continue;
  pairIds.push(p.id);pairNumbers.push(p.revisionNo);
 }
 const row=(await tx.query<{has_baseline:boolean|null;not_latest:boolean|null;unnumbered:boolean|null;baseline:string|null;head:string|null}>(
  `WITH thread AS (
    SELECT e.id FROM intake_candidates c
    JOIN source_events e ON e.project_id=c.project_id AND e.chat_id=c.chat_id AND e.thread_key=c.thread_key
    WHERE c.id=$2::uuid AND c.project_id=$1::uuid AND e.project_id=$1::uuid),
   stated AS (SELECT p.id AS event_id, p.no FROM unnest($4::uuid[],$5::int[]) AS p(id,no) JOIN thread t ON t.id=p.id)
   SELECT
    (EXISTS(SELECT 1 FROM thread t WHERE t.id = ANY($3::uuid[]))
      AND NOT EXISTS(SELECT 1 FROM thread t WHERE t.id = ANY($3::uuid[]) AND NOT EXISTS(SELECT 1 FROM stated s WHERE s.event_id=t.id))) AS has_baseline,
    EXISTS(SELECT 1 FROM stated s WHERE s.no IS DISTINCT FROM
             (SELECT r.revision_no FROM source_event_revisions r WHERE r.source_event_id=s.event_id AND r.project_id=$1::uuid ORDER BY ${LATEST_REVISION_ORDER} LIMIT 1)) AS not_latest,
    EXISTS(SELECT 1 FROM thread t JOIN source_event_revisions r ON r.source_event_id=t.id AND r.project_id=$1::uuid
           WHERE NOT EXISTS(SELECT 1 FROM source_revision_positions q WHERE q.revision_id=r.id AND q.project_id=$1::uuid)) AS unnumbered,
    (SELECT max(q.thread_seq)::text FROM stated s
       JOIN source_event_revisions r ON r.source_event_id=s.event_id AND r.revision_no=s.no AND r.project_id=$1::uuid
       JOIN source_revision_positions q ON q.revision_id=r.id AND q.project_id=$1::uuid) AS baseline,
    (SELECT h.last_seq::text FROM intake_candidates c
       JOIN intake_thread_heads h ON h.tenant_id=c.tenant_id AND h.project_id=$1::uuid AND h.chat_id=c.chat_id AND h.thread_key=c.thread_key
       WHERE c.id=$2::uuid AND c.project_id=$1::uuid) AS head`,[projectId,candidateId,named,pairIds,pairNumbers])).rows[0];
 if(row?.has_baseline!==true) return none;
 const baseline=row.baseline??null,head=row.head??null;
 // anything the statement does not say plainly counts as a change
 const changed=row.not_latest!==false||row.unnumbered!==false||baseline===null||head===null||head!==baseline;
 return {hasBaseline:true,changed,position:head};
}
