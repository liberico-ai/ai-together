-- Rollback of 022 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 022 before 021. Refuses while a later migration is recorded. No CASCADE. No data is touched: drafts and decisions stay.
-- Removing the guard re-opens the write of an AI draft for an IBS_HI project (OQ-45 point 3 (b) is then enforced nowhere at write time).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '022') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 022.';
  END IF;
  -- dynamic and guarded, so the file can run again after the trigger, the function, the table or the schema is gone
  IF pg_catalog.to_regclass('intelligence.ai_drafts') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS ai_drafts_pointer_only_guard ON intelligence.ai_drafts';
  END IF;
  IF pg_catalog.to_regprocedure('intelligence.ai_drafts_pointer_only_guard()') IS NOT NULL THEN
    EXECUTE 'DROP FUNCTION intelligence.ai_drafts_pointer_only_guard()';
  END IF;
END $$;
DELETE FROM schema_migrations WHERE version = '022';
COMMIT;
