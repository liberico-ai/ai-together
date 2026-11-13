-- SPEC-007 case (b), slice 2: an access-change ballot reuses identity.account_approvals and its tally (Chairman + one BoM, OQ-29 open).
-- Expand only: four columns are added and registration_id is relaxed to nullable. No row is inserted or changed except schema_migrations;
-- existing rows read kind='registration' through the column default. The ballot freezes the subject's current grants (previous_grants)
-- and account version; it never changes memberships itself. RLS (ENABLE + FORCE) and the tenant_scope policy with USING and WITH CHECK
-- come from 009 and are unchanged; no grant is needed: libetech_identity already holds INSERT on the table and UPDATE(state,updated_at).
-- Rollback: migrations/rollback/018_access_change_approval.sql (refuses while an access_change row exists).
BEGIN;
ALTER TABLE identity.account_approvals ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'registration' CHECK(kind IN ('registration','access_change'));
ALTER TABLE identity.account_approvals ADD COLUMN IF NOT EXISTS subject_user_id uuid;
ALTER TABLE identity.account_approvals ADD COLUMN IF NOT EXISTS subject_account_version integer;
ALTER TABLE identity.account_approvals ADD COLUMN IF NOT EXISTS previous_grants jsonb;
ALTER TABLE identity.account_approvals ALTER COLUMN registration_id DROP NOT NULL;
DO $$ BEGIN
  -- A registration ballot names a registration and no subject; an access-change ballot names a subject, its version and frozen grants.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname='account_approvals_kind_shape' AND conrelid='identity.account_approvals'::regclass) THEN
    ALTER TABLE identity.account_approvals ADD CONSTRAINT account_approvals_kind_shape CHECK(
      (kind='registration' AND registration_id IS NOT NULL AND subject_user_id IS NULL)
      OR (kind='access_change' AND registration_id IS NULL AND subject_user_id IS NOT NULL
          AND subject_account_version IS NOT NULL AND previous_grants IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname='account_approvals_subject_fk' AND conrelid='identity.account_approvals'::regclass) THEN
    ALTER TABLE identity.account_approvals ADD CONSTRAINT account_approvals_subject_fk
      FOREIGN KEY(subject_user_id,tenant_id) REFERENCES identity.users(id,tenant_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS account_approvals_subject ON identity.account_approvals(subject_user_id);
-- At most one open access-change ballot per person (the registration counterpart is account_approval_active_registration, 009).
CREATE UNIQUE INDEX IF NOT EXISTS account_approval_active_access_change ON identity.account_approvals(tenant_id,subject_user_id)
  WHERE kind='access_change' AND state IN ('pending','approved');
INSERT INTO schema_migrations(version) VALUES('018') ON CONFLICT(version) DO NOTHING;
COMMIT;
