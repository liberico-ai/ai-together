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

/** True while the current config still lets the text of source event e show: group flagged (OQ-28 (c)) and the project's latest mapping row is not IBS_HI. chats = placeholder of a text[] parameter. */
export const textAllowedSql=(e:string,chats:string)=>
 `(${e}.chat_id = ANY(${chats}::text[]) AND coalesce((SELECT m.domain_code FROM project_domain_mappings m WHERE m.project_id=${e}.project_id ORDER BY m.mapping_version DESC LIMIT 1),'')<>'IBS_HI')`;

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

/** «Cùng nội dung» hint as before: equal stored hash inside the project, compared in SQL; the hash itself is not returned. */
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
