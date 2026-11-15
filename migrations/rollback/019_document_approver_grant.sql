-- Rollback of 019 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 019, then 018, then 017. Refuses while a later migration is recorded, and while any membership or any access-change
-- ballot (grants or previous_grants) carries a doc_approve code: the three-value CHECK restored here could not read those rows, and a ballot
-- naming a code would apply a value the old schema rejects. No CASCADE; no role is touched.
BEGIN;
-- Same lock_timeout as 019: the CHECK swap takes ACCESS EXCLUSIVE on identity.memberships.
SET LOCAL lock_timeout = '5s';
-- Read the rows without row-level security: a role that RLS would filter gets an error here instead of a silent empty count.
SET LOCAL row_security = off;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '019') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 019.';
  END IF;
  IF EXISTS (SELECT 1 FROM identity.memberships m WHERE pg_catalog.array_to_string(m.report_permissions,',') LIKE '%doc_approve:%') THEN
    RAISE EXCEPTION 'Roll back 019 refused: a membership carries a doc_approve code.';
  END IF;
  IF EXISTS (SELECT 1 FROM identity.account_approvals a WHERE a.grants::text LIKE '%doc_approve:%' OR coalesce(a.previous_grants::text,'') LIKE '%doc_approve:%') THEN
    RAISE EXCEPTION 'Roll back 019 refused: an approval ballot carries a doc_approve code.';
  END IF;
END $$;
DROP TRIGGER IF EXISTS memberships_doc_approve_guard ON identity.memberships;
DROP FUNCTION IF EXISTS identity.memberships_doc_approve_guard();
DROP FUNCTION IF EXISTS public.document_approvers(uuid);
-- The three-value CHECK comes back under its 004 name first, then the 019 CHECK goes, so the column is never unchecked.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname='memberships_report_permissions_check' AND conrelid='identity.memberships'::regclass) THEN
    ALTER TABLE identity.memberships ADD CONSTRAINT memberships_report_permissions_check CHECK (
      report_permissions <@ ARRAY['people_read','quality_review','report_approve']::text[]);
  END IF;
END $$;
ALTER TABLE identity.memberships DROP CONSTRAINT IF EXISTS memberships_grant_permissions_check;
DELETE FROM schema_migrations WHERE version='019';
COMMIT;
