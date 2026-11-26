-- Where the reminder of one project and kind goes (migration 031, Q-F1). RUN ONLY BY THE OPERATOR. Group ids are data from outside the repository: the chat id
-- is read from the environment (psql \getenv), so it appears neither in this file nor in the command line.
-- One target per project and kind; running it again with the same values changes nothing. Every real change writes one reminder_config_events row with the source.
-- expected_version: the version the operator read from the last run (0 for a target that does not exist yet). A change is refused when the target moved since,
-- so an older command never undoes a newer decision.
-- An enabled target is refused for a project without a confirmed domain, or of IBS HI. A disabled target sends nothing.
--
--   LIBETECH_REMINDER_CHAT_ID=<group id> psql -X -v ON_ERROR_STOP=1 -d <database> \
--     -v tenant_id=<tenant uuid> -v project_id=<project uuid> -v kind=golive_status|bom_meeting \
--     -v topic_id= -v send_time=08:30 -v lead_days=1 -v enabled=true|false -v source='<where the decision comes from>' -v expected_version=<n> \
--     -f deploy/reminder-targets.sql
--
-- The group must serve exactly this project in the server's bridge config (chatScopes), and a project the gateway pulls (an intake chat serves it); otherwise the
-- scheduler skips the target (group_not_for_project, not_in_intake_scope) and the gateway's pull drops anything queued (REMINDER_ROUTE_REFUSED). It must also be
-- listed in the gateway's intake.json "chats", or the gateway refuses the message (TARGET_NOT_ALLOWED). A shared group is refused (Q-GV5F-6).
\getenv chat_id LIBETECH_REMINDER_CHAT_ID
BEGIN;
SELECT CASE WHEN length(:'source') BETWEEN 3 AND 300 THEN 1 ELSE 1/0 END AS source_ok;
SELECT set_config('libetech.reminder_source', :'source', true) IS NOT NULL AS source_set;
-- the divisor is the CASE itself: a constant 1/0 in a branch would be folded by the planner even when not taken
SELECT 1 / (CASE WHEN :'expected_version'::int = 0 OR EXISTS (SELECT 1 FROM reminder_targets
  WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid AND kind = :'kind') THEN 1 ELSE 0 END) AS target_known;
INSERT INTO reminder_targets AS t(tenant_id, project_id, kind, chat_id, topic_id, send_time, lead_days, enabled)
 VALUES (:'tenant_id'::uuid, :'project_id'::uuid, :'kind', :'chat_id', :'topic_id', :'send_time'::time, :'lead_days'::smallint, :'enabled'::boolean)
 ON CONFLICT (tenant_id, project_id, kind) DO UPDATE SET chat_id = EXCLUDED.chat_id, topic_id = EXCLUDED.topic_id, send_time = EXCLUDED.send_time,
  lead_days = EXCLUDED.lead_days, enabled = EXCLUDED.enabled, version = t.version + 1, updated_at = now()
 WHERE (t.chat_id, t.topic_id, t.send_time, t.lead_days, t.enabled) IS DISTINCT FROM (EXCLUDED.chat_id, EXCLUDED.topic_id, EXCLUDED.send_time, EXCLUDED.lead_days, EXCLUDED.enabled)
  AND t.version = :'expected_version'::int;
-- refused when the target moved since it was read: nothing above changed it, so it does not hold what was asked
SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM reminder_targets WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid AND kind = :'kind'
  AND (chat_id, topic_id, send_time, lead_days, enabled) IS NOT DISTINCT FROM (:'chat_id', :'topic_id', :'send_time'::time, :'lead_days'::smallint, :'enabled'::boolean))
  THEN 1 ELSE 0 END) AS written;
-- the read-back never prints the group id; its version is the expected_version of the next change
SELECT kind, topic_id <> '' AS has_topic, to_char(send_time, 'HH24:MI') AS send_time, lead_days, enabled, version FROM reminder_targets
 WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid ORDER BY kind;
COMMIT;
