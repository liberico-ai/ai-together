-- Rollback of 020 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 021, then 020, then 019. Refuses while a later migration is recorded, and while an approval decision exists: the approved
-- pointers it justifies would lose their basis. No CASCADE; no role is touched; nothing of 019 is touched.
BEGIN;
-- Same lock_timeout as 020: dropping the pointer trigger takes a lock on document_records.
SET LOCAL lock_timeout = '5s';
-- Read the rows without row-level security: a role that RLS would filter gets an error here instead of a silent empty count.
SET LOCAL row_security = off;
DO $$ DECLARE approvals bigint := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '020') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 020.';
  END IF;
  -- dynamic, so the file can run again after the tables are gone
  IF pg_catalog.to_regclass('public.review_decisions') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.review_decisions WHERE result = ''approved''' INTO approvals;
    IF approvals > 0 THEN
      RAISE EXCEPTION 'Roll back 020 refused: approved pointers would lose their basis.';
    END IF;
  END IF;
END $$;
DROP TRIGGER IF EXISTS document_records_approval_guard ON document_records;
DROP TRIGGER IF EXISTS review_decisions_guard ON review_decisions;
DROP TRIGGER IF EXISTS review_delegations_revoke_guard ON review_delegations;
DROP TRIGGER IF EXISTS review_delegations_guard ON review_delegations;
DROP FUNCTION IF EXISTS public.document_records_approval_guard();
DROP FUNCTION IF EXISTS public.review_decisions_guard();
DROP FUNCTION IF EXISTS public.review_delegations_revoke_guard();
DROP FUNCTION IF EXISTS public.review_delegations_guard();
REVOKE UPDATE(approved_revision_id) ON document_records FROM libetech_runtime;
DROP TABLE IF EXISTS review_events, document_dependencies, review_decisions, review_comments, review_delegations;
DELETE FROM schema_migrations WHERE version = '020';
COMMIT;
