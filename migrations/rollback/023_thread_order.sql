-- Rollback of 023 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 023 before 022. Refuses while a later migration is recorded. No CASCADE. Source events, revisions, drafts and decisions are not touched:
-- what goes is what 023 made (the trigger and the function on the revision table, the counter table and the number table). The numbers themselves are lost.
-- Three things to know before running it:
-- 1. Rolling back re-opens the gap in the order of commit that 023 closed (OQ-53 point 3 (b)): a revision stored afterwards has no number. The code of
--    the PR that added 023 does not run on a database that has been rolled back.
-- 2. Roll back only when the AI write path is closed and every pipeline run that was in flight has been dropped: after the next application of 023 every
--    context built before is stale (OQ-53 condition N10).
-- 3. After a rollback and a new application the numbers of the revisions that already exist are given again, in the order of created_at, revision_no and id,
--    and may be in a different order from the order of commit (A to 1 and B to 2 before the rollback can become B to 1 and A to 2 after it).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '023') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 023.';
  END IF;
  -- dynamic and guarded, so the file can run again after the trigger, the function or a table is gone
  IF pg_catalog.to_regclass('public.source_event_revisions') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS source_event_revisions_thread_position ON public.source_event_revisions';
  END IF;
  IF pg_catalog.to_regprocedure('public.source_event_revisions_thread_position()') IS NOT NULL THEN
    EXECUTE 'DROP FUNCTION public.source_event_revisions_thread_position()';
  END IF;
  IF pg_catalog.to_regclass('public.source_revision_positions') IS NOT NULL THEN
    EXECUTE 'DROP TABLE public.source_revision_positions';
  END IF;
  IF pg_catalog.to_regclass('public.intake_thread_heads') IS NOT NULL THEN
    EXECUTE 'DROP TABLE public.intake_thread_heads';
  END IF;
END $$;
DELETE FROM schema_migrations WHERE version = '023';
COMMIT;
