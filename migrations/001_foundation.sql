-- Additive and idempotent. External installation uses a separate migration command.
BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'libetech_runtime') THEN
    CREATE ROLE libetech_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, name text NOT NULL, bu text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, tenant_id)
);
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  name text NOT NULL, owner text NOT NULL, repository text NOT NULL, environment text NOT NULL,
  desired_sha text, observed_sha text, observed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id, tenant_id) REFERENCES projects(id, tenant_id), UNIQUE(id, tenant_id, project_id)
);
CREATE TABLE IF NOT EXISTS work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, service_id uuid NOT NULL,
  code text NOT NULL, title text NOT NULL, state text NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','doing','review','blocked','done')),
  priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high')),
  assignee_id uuid, technical_id uuid, business_id uuid, due_at timestamptz,
  criteria text NOT NULL DEFAULT '', spec_url text, source_sha text CHECK(source_sha IS NULL OR source_sha ~ '^[a-f0-9]{40}$'),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0), revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(service_id, tenant_id, project_id) REFERENCES services(id, tenant_id, project_id),
  UNIQUE(id, tenant_id, project_id), UNIQUE(tenant_id, project_id, code),
  CHECK(assignee_id IS NULL OR technical_id IS NULL OR assignee_id <> technical_id),
  CHECK(assignee_id IS NULL OR business_id IS NULL OR assignee_id <> business_id)
);
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, work_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('spec','checks','release','uat')),
  source_id text NOT NULL, source_type text NOT NULL CHECK(source_type IN ('github','manual')),
  source_sha text NOT NULL CHECK(source_sha ~ '^[a-f0-9]{40}$'), revision integer NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(), quality_score numeric(3,2) NOT NULL CHECK(quality_score >= 0 AND quality_score <= 1),
  note text NOT NULL, actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(work_id, tenant_id, project_id) REFERENCES work_items(id, tenant_id, project_id), UNIQUE(id, tenant_id, project_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, work_id uuid NOT NULL,
  actor_id uuid NOT NULL, kind text NOT NULL, payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(work_id, tenant_id, project_id) REFERENCES work_items(id, tenant_id, project_id)
);
CREATE TABLE IF NOT EXISTS commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, actor_id uuid NOT NULL,
  command_key text NOT NULL, request_hash text NOT NULL, response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id, tenant_id) REFERENCES projects(id, tenant_id), UNIQUE(tenant_id, project_id, actor_id, command_key)
);
CREATE TABLE IF NOT EXISTS analytics.work_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  metrics jsonb NOT NULL, snapshot_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id, tenant_id) REFERENCES projects(id, tenant_id), UNIQUE(tenant_id, project_id)
);
CREATE INDEX IF NOT EXISTS services_project_idx ON services(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS work_service_idx ON work_items(service_id, tenant_id, project_id);
CREATE INDEX IF NOT EXISTS work_updated_idx ON work_items(tenant_id, project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS evidence_work_idx ON evidence(work_id, tenant_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS events_work_idx ON audit_events(work_id, tenant_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS commands_created_idx ON commands(tenant_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS summary_snapshot_idx ON analytics.work_summary(tenant_id, project_id, snapshot_at);
CREATE INDEX IF NOT EXISTS projects_created_idx ON projects(created_at);
CREATE INDEX IF NOT EXISTS services_created_idx ON services(created_at);
CREATE INDEX IF NOT EXISTS work_created_idx ON work_items(created_at);
CREATE INDEX IF NOT EXISTS migrations_created_idx ON schema_migrations(created_at);
DO $$ DECLARE tab text; project_col text; BEGIN
  FOREACH tab IN ARRAY ARRAY['projects','services','work_items','evidence','audit_events','commands','analytics.work_summary'] LOOP
    project_col := CASE WHEN tab = 'projects' THEN 'id' ELSE 'project_id' END;
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tab);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tab);
    EXECUTE format('DROP POLICY IF EXISTS scope_policy ON %s', tab);
    EXECUTE format('CREATE POLICY scope_policy ON %s USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid AND %I = ANY(string_to_array(coalesce(current_setting(''app.project_ids'', true), ''''), '','')::uuid[]))', tab, project_col);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA public, analytics TO libetech_runtime;
GRANT SELECT ON projects, services, work_items, evidence, audit_events, commands, analytics.work_summary TO libetech_runtime;
GRANT INSERT ON work_items, evidence, audit_events, commands TO libetech_runtime;
GRANT UPDATE ON work_items, commands TO libetech_runtime;
GRANT INSERT, UPDATE ON analytics.work_summary TO libetech_runtime;
CREATE OR REPLACE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only history cannot be updated or deleted'; END $$;
DROP TRIGGER IF EXISTS audit_immutable ON audit_events;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS evidence_immutable ON evidence;
CREATE TRIGGER evidence_immutable BEFORE UPDATE OR DELETE ON evidence FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
INSERT INTO schema_migrations(version) VALUES ('001') ON CONFLICT(version) DO NOTHING;
COMMIT;
