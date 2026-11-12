-- Rollback of 013 only. Throwaway test copy use; never run against production data.
-- Order: roll back 015, then 014, then 013. Refuses to run while document_records (014) still exists; no CASCADE.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.document_records') IS NOT NULL THEN
    RAISE EXCEPTION 'Roll back 014 before 013: document_records still exists.';
  END IF;
END $$;
DROP TABLE IF EXISTS registry_events, project_domain_mappings, project_channels, project_profiles;
DELETE FROM schema_migrations WHERE version='013';
COMMIT;
