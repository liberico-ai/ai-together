-- Rollback of 014 only. Throwaway test copy use; never run against production data.
BEGIN;
DROP TABLE IF EXISTS document_commands, document_revisions, document_records, document_templates CASCADE;
DELETE FROM schema_migrations WHERE version='014';
COMMIT;
