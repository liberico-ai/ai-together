-- Rollback of 013 only. Throwaway test copy use; never run against production data.
BEGIN;
DROP TABLE IF EXISTS registry_events, project_domain_mappings, project_channels, project_profiles;
DELETE FROM schema_migrations WHERE version='013';
COMMIT;
