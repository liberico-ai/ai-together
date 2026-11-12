-- Rollback of 015 only. Throwaway test copy use; never run against production data. Role libetech_projector (from 005) is kept.
BEGIN;
DROP TABLE IF EXISTS analytics.document_index;
DO $$ BEGIN
  IF to_regclass('public.document_records') IS NOT NULL THEN REVOKE SELECT ON public.document_records FROM libetech_projector; END IF;
  IF to_regclass('public.document_revisions') IS NOT NULL THEN REVOKE SELECT ON public.document_revisions FROM libetech_projector; END IF;
END $$;
DELETE FROM schema_migrations WHERE version='015';
COMMIT;
