-- Rollback of 021 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 021, then 020, then 019, then 018. Refuses while a later migration is recorded. No CASCADE.
-- libetech_ai is a cluster-wide role and is kept (OQ-20); it holds nothing once the schema is gone. Nothing of 019 or 020 is touched.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Read the rows without row-level security: a role that RLS would filter gets an error here instead of a silent empty count.
SET LOCAL row_security = off;
DO $$ DECLARE decisions bigint := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '021') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 021.';
  END IF;
  -- dynamic, so the file can run again after the table is gone; drafts alone do not block, a person's recorded decision does
  IF pg_catalog.to_regclass('public.draft_decisions') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.draft_decisions' INTO decisions;
    IF decisions > 0 THEN
      RAISE EXCEPTION 'Roll back 021 refused: a recorded decision of a person would be destroyed.';
    END IF;
  END IF;
END $$;
DROP TABLE IF EXISTS draft_decisions;
DROP TABLE IF EXISTS intelligence.ai_drafts;
DROP FUNCTION IF EXISTS public.draft_decisions_guard();
DROP SCHEMA IF EXISTS intelligence;
DELETE FROM schema_migrations WHERE version = '021';
COMMIT;
