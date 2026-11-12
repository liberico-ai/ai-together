BEGIN;
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS account_version integer NOT NULL DEFAULT 1 CHECK (account_version > 0);
ALTER TABLE identity.memberships ADD COLUMN IF NOT EXISTS project_role text CHECK (project_role IN ('manager','engineer','technical','business','viewer'));
ALTER TABLE identity.memberships ADD COLUMN IF NOT EXISTS report_permissions text[] NOT NULL DEFAULT '{}' CHECK (
 report_permissions <@ ARRAY['people_read','quality_review','report_approve']::text[]
);
ALTER TABLE identity.invitations ADD COLUMN IF NOT EXISTS issuer_id uuid REFERENCES identity.users(id);
ALTER TABLE identity.invitations ADD COLUMN IF NOT EXISTS account_version integer;
ALTER TABLE identity.events ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE identity.events ADD COLUMN IF NOT EXISTS detail jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS identity.github_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 user_id uuid NOT NULL,
 github_id text NOT NULL CHECK (github_id ~ '^[1-9][0-9]{0,19}$'),
 source_id text NOT NULL,
 verified_by uuid NOT NULL,
 ended_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 FOREIGN KEY(verified_by,tenant_id) REFERENCES identity.users(id,tenant_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS github_current_user ON identity.github_links(tenant_id,user_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS github_current_id ON identity.github_links(tenant_id,github_id) WHERE ended_at IS NULL;
ALTER TABLE identity.github_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.github_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON identity.github_links;
CREATE POLICY tenant_scope ON identity.github_links TO libetech_identity
 USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

GRANT INSERT (tenant_id,username,name,role) ON identity.users TO libetech_identity;
GRANT UPDATE (active,account_version) ON identity.users TO libetech_identity;
GRANT INSERT,DELETE ON identity.memberships TO libetech_identity;
GRANT INSERT ON identity.invitations TO libetech_identity;
GRANT DELETE ON identity.telegram_links TO libetech_identity;
GRANT SELECT,INSERT ON identity.github_links TO libetech_identity;
GRANT UPDATE (ended_at,updated_at) ON identity.github_links TO libetech_identity;
INSERT INTO schema_migrations(version) VALUES('004') ON CONFLICT(version) DO NOTHING;
COMMIT;
