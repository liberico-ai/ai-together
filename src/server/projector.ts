import type { Queryable } from './db';
// Codified Z1 → Z2 pipeline. Dashboard reads only the projection.
export async function projectWorkSummary(tx: Queryable, tenantId: string, projectId: string) {
  await tx.query(`INSERT INTO analytics.work_summary(tenant_id, project_id, metrics, snapshot_at)
    SELECT $1::uuid, $2::uuid, jsonb_build_object(
      'total', count(*), 'doing', count(*) FILTER(WHERE state = 'doing'),
      'review', count(*) FILTER(WHERE state = 'review'), 'done', count(*) FILTER(WHERE state = 'done'),
      'blocked', count(*) FILTER(WHERE state = 'blocked'),
      'missing_owner', count(*) FILTER(WHERE assignee_id IS NULL AND state <> 'done'),
      'missing_due', count(*) FILTER(WHERE due_at IS NULL AND state <> 'done'),
      'missing_spec', count(*) FILTER(WHERE (spec_url IS NULL OR criteria = '') AND state <> 'done'),
      'overdue', count(*) FILTER(WHERE due_at < now() AND state <> 'done')
    ), now() FROM work_items WHERE tenant_id = $1 AND project_id = $2
    ON CONFLICT(tenant_id, project_id) DO UPDATE SET metrics = excluded.metrics, snapshot_at = excluded.snapshot_at, updated_at = now()`, [tenantId, projectId]);
}
