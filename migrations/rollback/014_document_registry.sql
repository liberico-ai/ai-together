-- Rollback of 014 only. Throwaway test copy use; never run against production data.
-- Order: roll back 015 first. Refuses to run while analytics.document_index (015) still exists; no CASCADE.
BEGIN;
DO $$ BEGIN
  IF to_regclass('analytics.document_index') IS NOT NULL THEN
    RAISE EXCEPTION 'Roll back 015 before 014: analytics.document_index still exists.';
  END IF;
END $$;
DROP TABLE IF EXISTS document_commands, document_revisions, document_records, document_templates;
DELETE FROM schema_migrations WHERE version='014';
COMMIT;
