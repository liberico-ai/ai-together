-- Rollback of 018 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 018, then 017, then 016. Refuses while a later migration is recorded or while any access_change ballot exists:
-- such a row has no registration and cannot be represented once registration_id is NOT NULL again. No CASCADE; no role is touched.
BEGIN;
-- Read the rows without row-level security: a role that RLS would filter gets an error here instead of a silent empty count.
SET LOCAL row_security = off;
DO $$ DECLARE has_rows boolean; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '018') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 018.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='identity' AND table_name='account_approvals' AND column_name='kind') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM identity.account_approvals WHERE kind = ''access_change'')' INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION 'Roll back 018 refused: access_change ballots exist in identity.account_approvals.';
    END IF;
  END IF;
END $$;
DROP INDEX IF EXISTS identity.account_approval_active_access_change;
DROP INDEX IF EXISTS identity.account_approvals_subject;
ALTER TABLE identity.account_approvals DROP CONSTRAINT IF EXISTS account_approvals_kind_shape;
ALTER TABLE identity.account_approvals DROP CONSTRAINT IF EXISTS account_approvals_subject_fk;
ALTER TABLE identity.account_approvals DROP CONSTRAINT IF EXISTS account_approvals_kind_check;
ALTER TABLE identity.account_approvals DROP COLUMN IF EXISTS previous_grants;
ALTER TABLE identity.account_approvals DROP COLUMN IF EXISTS subject_account_version;
ALTER TABLE identity.account_approvals DROP COLUMN IF EXISTS subject_user_id;
ALTER TABLE identity.account_approvals DROP COLUMN IF EXISTS kind;
ALTER TABLE identity.account_approvals ALTER COLUMN registration_id SET NOT NULL;
DELETE FROM schema_migrations WHERE version='018';
COMMIT;
