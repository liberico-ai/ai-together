-- Rollback of 017 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 018, then 017, then 016. Refuses to run while identity.account_approvals.kind (018) exists; no CASCADE.
-- Roles are cluster-wide objects and are kept.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='identity' AND table_name='account_approvals' AND column_name='kind') THEN
    RAISE EXCEPTION 'Roll back 018 before 017: identity.account_approvals.kind still exists.';
  END IF;
END $$;
DROP TRIGGER IF EXISTS delivery_receipts_derive_project ON delivery_receipts;
DROP FUNCTION IF EXISTS delivery_receipts_derive_project();
DROP TABLE IF EXISTS delivery_receipts, outbox_messages;
DELETE FROM schema_migrations WHERE version='017';
COMMIT;
