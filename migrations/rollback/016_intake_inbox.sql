-- Rollback of 016 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 018, then 017, then 016. Refuses to run while outbox_messages (017) exists; no CASCADE.
-- Roles libetech_intake and libetech_intake_svc are cluster-wide objects and are kept.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.outbox_messages') IS NOT NULL THEN
    RAISE EXCEPTION 'Roll back 017 before 016: outbox_messages still exists.';
  END IF;
END $$;
DROP TABLE IF EXISTS intake_events, intake_candidates, intake_attachments, source_event_revisions, source_events;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='libetech_intake') THEN
    IF to_regclass('public.project_domain_mappings') IS NOT NULL THEN REVOKE SELECT ON project_domain_mappings FROM libetech_intake; END IF;
    REVOKE SELECT(id,tenant_id) ON projects FROM libetech_intake;
  END IF;
END $$;
DELETE FROM schema_migrations WHERE version='016';
COMMIT;
