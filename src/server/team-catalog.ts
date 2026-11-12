import type {Database} from './db';
import {scoped} from './db';
import type {Principal} from './types';

export type SourceTask={bu:string;stt:string;source_row:number;title:string;source_owner:string;
 collaborators:string;source_status:string;due_raw:string;source_note:string;source_ref:string;
 source_modified_at:string|null;imported_at:string;snapshot_hash:string};
export type SourcePlatform={bu:string;name:string;source_url:string;source_modified_at:string|null};

/** Rows are source claims under the viewer's project RLS; they are not Z1 work or acceptance. */
export async function teamCatalog(db:Database,p:Principal) {
 return scoped(db,p,async tx=>{
  const tasks=(await tx.query<SourceTask>(`SELECT p.bu,t.stt,t.source_row,t.title,t.source_owner,
   t.collaborators,t.source_status,t.due_raw,t.source_note,t.source_ref,
   t.source_modified_at,t.imported_at,t.snapshot_hash
   FROM analytics.tech_source_tasks t JOIN projects p ON p.id=t.project_id AND p.tenant_id=t.tenant_id
   ORDER BY p.bu,t.source_row`)).rows;
  const platforms=(await tx.query<SourcePlatform>(`SELECT p.bu,c.name,c.source_url,c.source_modified_at
   FROM analytics.tech_platform_catalog c JOIN projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id
   ORDER BY p.bu,c.name`)).rows;
  return {tasks,platforms};
 });
}
