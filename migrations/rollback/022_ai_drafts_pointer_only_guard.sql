-- Rollback of 022 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 022 before 021. Refuses while a later migration is recorded. No CASCADE. No data is touched: drafts, decisions and mappings stay.
-- Removing the guards re-opens the write of an AI draft for an IBS_HI project (OQ-45 point 3 (b) is then enforced nowhere at write time).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ DECLARE f text; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '022') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 022.';
  END IF;
  -- dynamic and guarded, so the file can run again after a trigger, a function, a table or the schema is gone, and on a database that holds an
  -- earlier body of 022 (one trigger, one function)
  IF pg_catalog.to_regclass('intelligence.ai_drafts') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS ai_drafts_pointer_only_guard ON intelligence.ai_drafts';
    EXECUTE 'DROP TRIGGER IF EXISTS ai_drafts_declared_scope_guard ON intelligence.ai_drafts';
  END IF;
  IF pg_catalog.to_regclass('public.project_domain_mappings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS project_domain_mappings_draft_lock ON public.project_domain_mappings';
  END IF;
  FOREACH f IN ARRAY ARRAY['intelligence.ai_drafts_pointer_only_guard()', 'intelligence.ai_drafts_declared_scope_guard()', 'intelligence.project_domain_mappings_draft_lock()'] LOOP
    IF pg_catalog.to_regprocedure(f) IS NOT NULL THEN
      EXECUTE 'DROP FUNCTION ' || f;
    END IF;
  END LOOP;
END $$;
DELETE FROM schema_migrations WHERE version = '022';
COMMIT;
