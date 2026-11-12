-- Chairman and at least one distinct, Telegram-linked BoM member must approve
-- a new account before an invitation can be issued. Seats are provisioned after identity
-- verification; this migration grants nobody a new seat or project.
BEGIN;

CREATE TABLE IF NOT EXISTS identity.account_approval_seats (
 tenant_id uuid NOT NULL, seat text NOT NULL CHECK(seat IN ('chairman','bom_chu','bom_quan','bom_phuong')),
 user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,seat), UNIQUE(tenant_id,user_id),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS identity.account_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 registration_id uuid NOT NULL, proposer_id uuid NOT NULL,
 grants jsonb NOT NULL CHECK(jsonb_typeof(grants)='array'),
 reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 500),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','expired','issued')),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '48 hours'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(registration_id,tenant_id) REFERENCES identity.registration_requests(id,tenant_id),
 FOREIGN KEY(proposer_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 UNIQUE(id,tenant_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS account_approval_active_registration
 ON identity.account_approvals(tenant_id,registration_id)
 WHERE state IN ('pending','approved','issued');
CREATE INDEX IF NOT EXISTS account_approvals_pending
 ON identity.account_approvals(tenant_id,state,created_at DESC);
CREATE TABLE IF NOT EXISTS identity.account_approval_voters (
 approval_id uuid NOT NULL, tenant_id uuid NOT NULL,
 seat text NOT NULL CHECK(seat IN ('chairman','bom_chu','bom_quan','bom_phuong')),
 user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(approval_id,seat), UNIQUE(approval_id,user_id),
 FOREIGN KEY(approval_id,tenant_id) REFERENCES identity.account_approvals(id,tenant_id),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS identity.account_approval_votes (
 approval_id uuid NOT NULL, tenant_id uuid NOT NULL,
 voter_id uuid NOT NULL, choice text NOT NULL CHECK(choice IN ('agree','reject')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(approval_id,voter_id),
 FOREIGN KEY(approval_id,tenant_id) REFERENCES identity.account_approvals(id,tenant_id),
 FOREIGN KEY(voter_id,tenant_id) REFERENCES identity.users(id,tenant_id)
);
ALTER TABLE identity.invitations ADD COLUMN IF NOT EXISTS account_approval_id uuid;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='invitation_account_approval_fk') THEN
  ALTER TABLE identity.invitations ADD CONSTRAINT invitation_account_approval_fk
   FOREIGN KEY(account_approval_id,tenant_id) REFERENCES identity.account_approvals(id,tenant_id);
 END IF;
END $$;

DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['account_approval_seats','account_approvals','account_approval_voters','account_approval_votes'] LOOP
  EXECUTE format('ALTER TABLE identity.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE identity.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON identity.%I',tab);
  EXECUTE format('CREATE POLICY tenant_scope ON identity.%I TO libetech_identity USING
   (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)
   WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
END $$;
GRANT SELECT ON identity.account_approval_seats,identity.account_approvals,
 identity.account_approval_voters,identity.account_approval_votes TO libetech_identity;
GRANT INSERT ON identity.account_approvals,identity.account_approval_voters,
 identity.account_approval_votes TO libetech_identity;
GRANT UPDATE(state,updated_at) ON identity.account_approvals TO libetech_identity;
GRANT UPDATE(account_approval_id) ON identity.invitations TO libetech_identity;
DROP TRIGGER IF EXISTS account_approval_votes_immutable ON identity.account_approval_votes;
CREATE TRIGGER account_approval_votes_immutable BEFORE UPDATE OR DELETE ON identity.account_approval_votes
 FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
INSERT INTO schema_migrations(version) VALUES('009') ON CONFLICT(version) DO NOTHING;
COMMIT;
