-- BoM seats of one project: the three people who may decide work requests and vote 3/3. RUN ONLY BY THE OPERATOR; the people are data from outside the repository.
-- Upserts the bom_scopes row with exactly three seats and enabled = true. The version moves only when the seats or the enabled flag actually change.
-- Writes one identity.events row per run (kind bom_seats_set) with the project, the resulting version, whether anything changed, and the source named below.
-- Control over assignment starts with the seats: once enabled, the 3/3 ballot only moves an existing assignee (bom_guard_assignment, migration 006), so a
-- non-done work item with no assignee would be stranded. The file counts them first, prints the count, and fails when it is above 0 unless the operator
-- passes -v allow_unassigned=1 after deciding what to do with them.
-- Both operator scripts write tables under FORCE ROW LEVEL SECURITY: run them as the database superuser, or as a role with BYPASSRLS. The role that ran is
-- recorded in the event (db_role).
-- A seat counts only when the person also has a membership of the project, an active activated account and a Telegram link (migration 024, work_request_seat()):
-- memberships go through the access-change approval flow, not through this file.
--
--   psql -X -v ON_ERROR_STOP=1 -d <database> \
--     -v tenant_id=<tenant uuid> -v project_id=<project uuid> -v seat_ids=<uuid>,<uuid>,<uuid> -v source='<where the list comes from>' \
--     [-v allow_unassigned=1] -f deploy/bom-seats.sql
\if :{?allow_unassigned}
\else
\set allow_unassigned 0
\endif
BEGIN;
-- the scope of the project is set for the policies of the tables (a login without BYPASSRLS needs it; a superuser is not harmed by it)
SELECT set_config('app.tenant_id', :'tenant_id', true), set_config('app.project_ids', :'project_id', true);
SELECT CASE WHEN cardinality(string_to_array(:'seat_ids', ',')) = 3 THEN 1 ELSE 1/0 END AS three_seats;
SELECT CASE WHEN length(:'source') BETWEEN 3 AND 300 THEN 1 ELSE 1/0 END AS source_ok;
-- no such project in that tenant: the count is 0 and the division fails the file (a constant 1/0 would be folded by the planner even when not taken). A
-- superuser is not held by the policies, so the tenant is checked here and in every statement below, not left to row level security.
SELECT 1 / count(*) AS project_exists FROM projects WHERE id = :'project_id'::uuid AND tenant_id = :'tenant_id'::uuid;
SELECT count(*) AS unassigned_open_work FROM work_items WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid AND state <> 'done' AND assignee_id IS NULL;
-- the divisor depends on the table, so the planner cannot fold the division in the branch that is not taken
SELECT 1 / CASE WHEN :'allow_unassigned' = '1' OR NOT EXISTS (SELECT 1 FROM work_items WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid AND state <> 'done' AND assignee_id IS NULL)
 THEN 1 ELSE 0 END AS no_stranded_work;
WITH p AS (SELECT id, tenant_id FROM projects WHERE id = :'project_id'::uuid AND tenant_id = :'tenant_id'::uuid),
 old AS (SELECT seat_ids FROM bom_scopes WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid),
 up AS (
  INSERT INTO bom_scopes(tenant_id, project_id, seat_ids, enabled)
   SELECT tenant_id, id, string_to_array(:'seat_ids', ',')::uuid[], true FROM p
  ON CONFLICT (tenant_id, project_id) DO UPDATE
   SET seat_ids = EXCLUDED.seat_ids, enabled = true, version = bom_scopes.version + 1, updated_at = now()
   WHERE bom_scopes.seat_ids IS DISTINCT FROM EXCLUDED.seat_ids OR NOT bom_scopes.enabled
  RETURNING tenant_id, project_id, version)
INSERT INTO identity.events(tenant_id, user_id, actor_id, kind, detail)
 SELECT p.tenant_id, NULL, NULL, 'bom_seats_set',
  jsonb_build_object('project_id', p.id, 'source', :'source', 'db_role', session_user, 'changed', EXISTS (SELECT 1 FROM up),
   'old_seat_ids', (SELECT to_jsonb(old.seat_ids) FROM old), 'seat_ids', to_jsonb(string_to_array(:'seat_ids', ',')::uuid[]),
   'version', coalesce((SELECT version FROM up), (SELECT s.version FROM bom_scopes s WHERE s.tenant_id = p.tenant_id AND s.project_id = p.id)))
 FROM p;
SELECT version, enabled, cardinality(seat_ids) AS seats FROM bom_scopes WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid;
COMMIT;
