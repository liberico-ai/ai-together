-- Chairman-authorized, one-time pilot onboarding. No application role can insert
-- exceptions. This does not change the normal Chairman + BoM voting workflow.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS invitation_tenant_id_uq ON identity.invitations(id,tenant_id);
CREATE TABLE IF NOT EXISTS identity.pilot_onboarding_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 registration_id uuid NOT NULL,
 user_id uuid NOT NULL,
 invitation_id uuid NOT NULL,
 authorized_by uuid NOT NULL,
 batch_key text NOT NULL CHECK (batch_key='pilot-20261111'),
 reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 500),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(registration_id,tenant_id) REFERENCES identity.registration_requests(id,tenant_id),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 FOREIGN KEY(invitation_id,tenant_id) REFERENCES identity.invitations(id,tenant_id),
 FOREIGN KEY(authorized_by,tenant_id) REFERENCES identity.users(id,tenant_id),
 UNIQUE(tenant_id,registration_id), UNIQUE(tenant_id,user_id), UNIQUE(tenant_id,invitation_id),
 CHECK (expires_at > created_at AND expires_at <= created_at + interval '72 hours')
);
ALTER TABLE identity.pilot_onboarding_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.pilot_onboarding_exceptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON identity.pilot_onboarding_exceptions;
CREATE POLICY tenant_scope ON identity.pilot_onboarding_exceptions TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT ON identity.pilot_onboarding_exceptions TO libetech_identity;
DROP TRIGGER IF EXISTS immutable_history ON identity.pilot_onboarding_exceptions;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON identity.pilot_onboarding_exceptions
 FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
INSERT INTO schema_migrations(version) VALUES('012') ON CONFLICT(version) DO NOTHING;
COMMIT;
