-- Rollback of 023 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 023 before 022. Refuses while a later migration is recorded, and while a decision row carries the position of a thread. No CASCADE. Source events,
-- revisions, drafts and decisions are not touched: what goes is what 023 made (the trigger and the function on the revision table, the counter table and the number
-- table; the trigger and the function on the decision table, and on that table the column subject_thread_seq with its check constraint and its INSERT grant).
-- The numbers themselves are lost.
-- Four things to know before running it:
-- 1. Rolling back re-opens the gap in the order of commit that 023 closed (OQ-53 point 3 (b)): a revision stored afterwards has no number, and a confirmation of a
--    candidate draft is no longer compared with the thread it read. The code of the PR that added 023 does not run on a database that has been rolled back.
-- 2. After the first confirmation of a candidate draft this file REFUSES, and the row that stops it cannot be removed (draft_decisions is append-only: a delete or an
--    update is stopped by its trigger, whoever asks): from then on 023 only goes forward. The plan to undo a deployment (R-05) is a forward fix, not "run this file".
--    Before that first confirmation the file runs. A confirmation that is in flight when the file runs is waited for (the file takes the decision table first), then
--    seen. The refusal needs the rows to be visible: it runs with row_security = off, so a role that row-level security binds gets an error here and never a silent "no rows".
-- 3. Roll back only when the AI write path is closed and every pipeline run that was in flight has been dropped: after the next application of 023 every
--    context built before is stale (OQ-53 condition N10).
-- 4. After a rollback and a new application the numbers of the revisions that already exist are given again, in the order of created_at, revision_no and id,
--    and may be in a different order from the order of commit (A to 1 and B to 2 before the rollback can become B to 1 and A to 2 after it).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL row_security = off;
DO $$ DECLARE carrying boolean; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '023') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 023.';
  END IF;
  -- dynamic and guarded, so the file can run again after the trigger, the function, the column or a table is gone
  -- The decision table is taken before it is looked at (review R-S-1): a confirmation that is in flight is waited for, so that the check below sees its row. Without the lock the
  -- check could run while that row was not yet committed, the file would then wait for the confirmation at the next statement, go on after it, and drop the column with the
  -- position that had just been written. The wait ends at lock_timeout with 55P03 and nothing changes.
  IF pg_catalog.to_regclass('public.draft_decisions') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.draft_decisions IN ACCESS EXCLUSIVE MODE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid = pg_catalog.to_regclass('public.draft_decisions') AND a.attname = 'subject_thread_seq' AND NOT a.attisdropped) THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.draft_decisions WHERE subject_thread_seq IS NOT NULL)' INTO carrying;
    IF carrying THEN
      RAISE EXCEPTION 'Roll back stops: a decision of a person carries the position of its thread. That row cannot be removed (the table is append-only) and the position would be lost; from the first confirmation of a candidate draft 023 only goes forward. Fix forward instead.';
    END IF;
  END IF;
  -- the confirming half: the trigger and the function first, then what they read and write
  IF pg_catalog.to_regclass('public.draft_decisions') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS draft_decisions_subject_order_guard ON public.draft_decisions';
  END IF;
  IF pg_catalog.to_regprocedure('public.draft_decisions_subject_order_guard()') IS NOT NULL THEN
    EXECUTE 'DROP FUNCTION public.draft_decisions_subject_order_guard()';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid = pg_catalog.to_regclass('public.draft_decisions') AND a.attname = 'subject_thread_seq' AND NOT a.attisdropped) THEN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'libetech_runtime') THEN
      EXECUTE 'REVOKE INSERT (subject_thread_seq) ON public.draft_decisions FROM libetech_runtime';
    END IF;
    EXECUTE 'ALTER TABLE public.draft_decisions DROP CONSTRAINT IF EXISTS draft_decisions_thread_seq_only_confirmed';
    EXECUTE 'ALTER TABLE public.draft_decisions DROP COLUMN IF EXISTS subject_thread_seq';
  END IF;
  -- the intake half
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
