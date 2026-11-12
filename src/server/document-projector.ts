import type { Database } from './db';

/** Z1 → Z2 document index. Operator login only; not called by any service or route (OQ-22). Never deletes rows. */
export async function projectDocumentIndex(db: Database, tenantId: string, projectId: string): Promise<{ rows: number; projectedAt: string }> {
  return db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE libetech_projector');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)", [tenantId, projectId]);
    const written = (await tx.query<{ projected_at: Date | string }>(`
      INSERT INTO analytics.document_index(tenant_id,project_id,document_id,ref_code,doc_type,title,owner_label,source_type,
        latest_revision_no,approved_revision_no,hash_verification,source_state,freeze_state,missing_count,review_due_at,
        record_version,record_updated_at,projected_at)
      SELECT r.tenant_id,r.project_id,r.id,r.ref_code,r.doc_type,r.title,r.owner_label,r.source_type,
        l.revision_no,a.revision_no,l.hash_verification,
        CASE WHEN r.source_state IN ('unavailable','denied') THEN r.source_state
          WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.source_links)='array' THEN r.source_links ELSE '[]'::jsonb END) k
            WHERE k->>'kind'='z2_source_ref' AND NOT EXISTS (SELECT 1 FROM analytics.tech_source_tasks t
              WHERE t.tenant_id=r.tenant_id AND t.project_id=r.project_id AND t.source_ref=k->>'value')) THEN 'stale'
          ELSE r.source_state END,
        r.freeze_state,
        coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(r.metadata->'missingFields')='array' THEN r.metadata->'missingFields' END),0)
          + coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(l.changes->'missing')='array' THEN l.changes->'missing' END),0),
        r.review_due_at,r.version,r.updated_at,now()
      FROM document_records r
      LEFT JOIN document_revisions l ON l.id=r.latest_revision_id
      LEFT JOIN document_revisions a ON a.id=r.approved_revision_id
      WHERE r.tenant_id=$1 AND r.project_id=$2
      ON CONFLICT(tenant_id,project_id,document_id) DO UPDATE SET
        ref_code=EXCLUDED.ref_code,doc_type=EXCLUDED.doc_type,title=EXCLUDED.title,owner_label=EXCLUDED.owner_label,
        source_type=EXCLUDED.source_type,latest_revision_no=EXCLUDED.latest_revision_no,approved_revision_no=EXCLUDED.approved_revision_no,
        hash_verification=EXCLUDED.hash_verification,source_state=EXCLUDED.source_state,freeze_state=EXCLUDED.freeze_state,
        missing_count=EXCLUDED.missing_count,review_due_at=EXCLUDED.review_due_at,record_version=EXCLUDED.record_version,
        record_updated_at=EXCLUDED.record_updated_at,projected_at=now(),updated_at=now()
      WHERE analytics.document_index.record_version <= EXCLUDED.record_version
      RETURNING projected_at`, [tenantId, projectId])).rows;
    const at = written[0]?.projected_at ?? (await tx.query<{ n: Date | string }>('SELECT now() AS n')).rows[0].n;
    return { rows: written.length, projectedAt: new Date(at).toISOString() };
  });
}
