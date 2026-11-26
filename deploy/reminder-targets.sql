-- Where the reminder of one project and kind goes (migration 031, Q-F1). RUN ONLY BY THE OPERATOR. Group ids are data from outside the repository: the chat id
-- is read from the environment (psql \getenv), so it appears neither in this file nor in the command line.
-- One target per project and kind; running it again with the same values changes nothing. Every real change writes one reminder_config_events row with the source.
-- An enabled target is refused for a project without a confirmed domain, or of IBS HI. A disabled target sends nothing.
--
--   LIBETECH_REMINDER_CHAT_ID=<group id> psql -X -v ON_ERROR_STOP=1 -d <database> \
--     -v tenant_id=<tenant uuid> -v project_id=<project uuid> -v kind=golive_status|bom_meeting \
--     -v topic_id= -v send_time=08:30 -v lead_days=1 -v enabled=true|false -v source='<where the decision comes from>' \
--     -f deploy/reminder-targets.sql
--
-- The group must also be listed in the gateway's intake.json (chats or poolChats), or the gateway refuses the message (TARGET_NOT_ALLOWED), and the project must
-- be one an intake chat serves, or the scheduler skips the target (not_in_intake_scope).
\getenv chat_id LIBETECH_REMINDER_CHAT_ID
BEGIN;
SELECT CASE WHEN length(:'source') BETWEEN 3 AND 300 THEN 1 ELSE 1/0 END AS source_ok;
SELECT set_config('libetech.reminder_source', :'source', true) IS NOT NULL AS source_set;
INSERT INTO reminder_targets AS t(tenant_id, project_id, kind, chat_id, topic_id, send_time, lead_days, enabled)
 VALUES (:'tenant_id'::uuid, :'project_id'::uuid, :'kind', :'chat_id', :'topic_id', :'send_time'::time, :'lead_days'::smallint, :'enabled'::boolean)
 ON CONFLICT (tenant_id, project_id, kind) DO UPDATE SET chat_id = EXCLUDED.chat_id, topic_id = EXCLUDED.topic_id, send_time = EXCLUDED.send_time,
  lead_days = EXCLUDED.lead_days, enabled = EXCLUDED.enabled, updated_at = now()
 WHERE (t.chat_id, t.topic_id, t.send_time, t.lead_days, t.enabled) IS DISTINCT FROM (EXCLUDED.chat_id, EXCLUDED.topic_id, EXCLUDED.send_time, EXCLUDED.lead_days, EXCLUDED.enabled);
-- the read-back never prints the group id
SELECT kind, topic_id <> '' AS has_topic, to_char(send_time, 'HH24:MI') AS send_time, lead_days, enabled FROM reminder_targets
 WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid ORDER BY kind;
COMMIT;
