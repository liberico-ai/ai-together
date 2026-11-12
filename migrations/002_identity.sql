-- Additive identity infrastructure. Separate logins are provisioned by the installer.
BEGIN;
CREATE SCHEMA IF NOT EXISTS identity;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='libetech_identity') THEN
  CREATE ROLE libetech_identity NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS identity.users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 username text NOT NULL CHECK(username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'), name text NOT NULL,
 password_hash text, role text NOT NULL CHECK(role IN ('manager','engineer','technical','business','viewer')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,username), UNIQUE(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS identity.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL, project_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id), UNIQUE(tenant_id,user_id,project_id)
);
CREATE TABLE IF NOT EXISTS identity.invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS identity.sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS identity.throttle (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, bucket text NOT NULL,
 window_start timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,bucket)
);
CREATE TABLE IF NOT EXISTS identity.telegram_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
 code_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS identity.telegram_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL, telegram_id text NOT NULL CHECK(telegram_id ~ '^[1-9][0-9]{0,19}$'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id), UNIQUE(tenant_id,user_id), UNIQUE(tenant_id,telegram_id)
);
CREATE TABLE IF NOT EXISTS identity.events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid, kind text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS identity.bridge_nonces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,nonce)
);
CREATE TABLE IF NOT EXISTS analytics.reconciliations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, code text NOT NULL,
 source_id text NOT NULL, source_type text NOT NULL, ingested_at timestamptz NOT NULL, quality_score numeric(3,2) NOT NULL CHECK(quality_score BETWEEN 0 AND 1),
 source_sha text NOT NULL CHECK(source_sha ~ '^[a-f0-9]{40}$'), snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id), UNIQUE(tenant_id,project_id,code,snapshot_hash)
);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['users','memberships','invitations','sessions','throttle','telegram_codes','telegram_links','events','bridge_nonces'] LOOP
  EXECUTE format('ALTER TABLE identity.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE identity.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON identity.%I',tab);
  EXECUTE format('CREATE POLICY tenant_scope ON identity.%I TO libetech_identity USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON identity.%I(tenant_id,created_at)',tab||'_tenant_created',tab);
 END LOOP;
END $$;
ALTER TABLE analytics.reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.reconciliations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_policy ON analytics.reconciliations;
CREATE POLICY scope_policy ON analytics.reconciliations USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
CREATE INDEX IF NOT EXISTS reconciliation_project_created ON analytics.reconciliations(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS memberships_user ON identity.memberships(user_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS memberships_project ON identity.memberships(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS sessions_user ON identity.sessions(user_id,tenant_id,expires_at);
CREATE INDEX IF NOT EXISTS invites_user ON identity.invitations(user_id,tenant_id,expires_at);
CREATE INDEX IF NOT EXISTS telegram_codes_user ON identity.telegram_codes(user_id,tenant_id,expires_at);
CREATE INDEX IF NOT EXISTS identity_events_user ON identity.events(user_id,tenant_id,created_at);
GRANT USAGE ON SCHEMA identity TO libetech_identity;
GRANT SELECT ON ALL TABLES IN SCHEMA identity TO libetech_identity;
GRANT INSERT ON identity.sessions,identity.throttle,identity.telegram_codes,identity.telegram_links,identity.events,identity.bridge_nonces TO libetech_identity;
GRANT UPDATE(password_hash,updated_at) ON identity.users TO libetech_identity;
GRANT UPDATE ON identity.sessions,identity.throttle,identity.invitations,identity.telegram_codes TO libetech_identity;
GRANT SELECT ON analytics.reconciliations TO libetech_runtime;
DROP TRIGGER IF EXISTS identity_events_immutable ON identity.events;
CREATE TRIGGER identity_events_immutable BEFORE UPDATE OR DELETE ON identity.events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS reconciliations_immutable ON analytics.reconciliations;
CREATE TRIGGER reconciliations_immutable BEFORE UPDATE OR DELETE ON analytics.reconciliations FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
INSERT INTO schema_migrations(version) VALUES('002') ON CONFLICT(version) DO NOTHING;
COMMIT;
