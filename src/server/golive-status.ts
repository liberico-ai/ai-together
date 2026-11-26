import type { Database } from './db';
import { AppError } from './errors';

/**
 * Z1 → Z2 GO LIVE status of one project, one row per Team Tech member (GIAO VIỆC 5 F). Operator login only (OQ-22): no service and no route calls it.
 * Only names and counts leave Z1, never a title, a code or a text. «Evidence» means a row at the work's current revision. A project that may not get
 * reminders (no confirmed domain, or IBS HI) gets no row.
 */
export async function projectGoliveStatus(db: Database, tenantId: string, projectId: string): Promise<{ members: number; projectedAt: string }> {
  return db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE libetech_projector');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)", [tenantId, projectId]);
    const allowed = (await tx.query<{ ok: boolean }>('SELECT public.reminder_project_allowed($1,$2) AS ok', [tenantId, projectId])).rows[0]?.ok === true;
    if (!allowed) throw new AppError('REMINDER_PROJECT_REFUSED', 'Dự án này chưa nhận nhắc việc: cần miền đã xác nhận, khác IBS HI.', 422);
    const at = (await tx.query<{ n: Date | string }>('SELECT now() AS n')).rows[0].n;
    // whoever left the roster, or can no longer sign in, leaves the projection with this run
    await tx.query(`DELETE FROM analytics.golive_member_status s WHERE s.tenant_id=$1 AND s.project_id=$2
      AND NOT EXISTS (SELECT 1 FROM public.tech_roster_members() m WHERE m.user_id=s.member_id)`, [tenantId, projectId]);
    const open = "FROM work_items w WHERE w.tenant_id=$1::uuid AND w.project_id=$2::uuid AND w.assignee_id=m.user_id AND w.state<>'done'";
    const written = (await tx.query(`INSERT INTO analytics.golive_member_status(tenant_id,project_id,member_id,member_name,requests_filed,open_work,open_without_evidence,projected_at)
      SELECT $1::uuid,$2::uuid,m.user_id,left(m.name,200),
        (SELECT count(*) FROM work_requests r WHERE r.tenant_id=$1::uuid AND r.project_id=$2::uuid AND r.requester_id=m.user_id),
        (SELECT count(*) ${open}),
        (SELECT count(*) ${open} AND NOT EXISTS (SELECT 1 FROM evidence e WHERE e.tenant_id=w.tenant_id AND e.project_id=w.project_id AND e.work_id=w.id AND e.revision=w.revision)),
        $3::timestamptz
      FROM public.tech_roster_members() m
      ON CONFLICT(tenant_id,project_id,member_id) DO UPDATE SET member_name=EXCLUDED.member_name,requests_filed=EXCLUDED.requests_filed,
        open_work=EXCLUDED.open_work,open_without_evidence=EXCLUDED.open_without_evidence,projected_at=EXCLUDED.projected_at,updated_at=now()
      RETURNING member_id`, [tenantId, projectId, at])).rows;
    return { members: written.length, projectedAt: new Date(at).toISOString() };
  });
}
