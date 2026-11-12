-- Source-backed Team Tech catalog. Source statuses are never Z1 acceptance.
BEGIN;
CREATE TABLE IF NOT EXISTS analytics.tech_source_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  source_id text NOT NULL, source_row integer NOT NULL CHECK(source_row > 1), stt text NOT NULL,
  source_ref text NOT NULL, snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
  fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
  source_modified_at timestamptz, imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL, source_owner text NOT NULL DEFAULT '', collaborators text NOT NULL DEFAULT '',
  source_status text NOT NULL, due_raw text NOT NULL DEFAULT '', source_note text NOT NULL DEFAULT '',
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  UNIQUE(tenant_id,source_id,source_row)
);
CREATE TABLE IF NOT EXISTS analytics.tech_platform_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  source_id text NOT NULL, source_url text NOT NULL, source_modified_at timestamptz,
  name text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  UNIQUE(tenant_id,source_id,project_id,name)
);
CREATE TABLE IF NOT EXISTS analytics.tech_source_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  source_id text NOT NULL, snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
  source_modified_at timestamptz, task_count integer NOT NULL, platform_count integer NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,source_id,snapshot_hash)
);
ALTER TABLE analytics.tech_source_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.tech_source_tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_policy ON analytics.tech_source_tasks;
CREATE POLICY scope_policy ON analytics.tech_source_tasks
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
ALTER TABLE analytics.tech_platform_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.tech_platform_catalog FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_policy ON analytics.tech_platform_catalog;
CREATE POLICY scope_policy ON analytics.tech_platform_catalog
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
GRANT SELECT ON analytics.tech_source_tasks,analytics.tech_platform_catalog TO libetech_runtime;
WITH tenants AS (
  SELECT DISTINCT tenant_id FROM identity.users WHERE username='chairman' AND active AND password_hash IS NOT NULL
), desired(bu,name) AS (
  VALUES ('XECA','XECA · Team Tech'),('LBRC','LBRC · Team Tech'),('IBS HI','IBS HI · Team Tech')
)
INSERT INTO projects(tenant_id,bu,name)
SELECT t.tenant_id,d.bu,d.name FROM tenants t CROSS JOIN desired d
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.tenant_id=t.tenant_id AND p.bu=d.bu AND p.name=d.name);
WITH added AS (
  INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role,report_permissions)
  SELECT u.tenant_id,u.id,p.id,'manager',ARRAY[]::text[]
  FROM identity.users u JOIN projects p ON p.tenant_id=u.tenant_id
  WHERE u.username='chairman' AND u.active AND u.password_hash IS NOT NULL
    AND p.name IN ('XECA · Team Tech','LBRC · Team Tech','IBS HI · Team Tech')
  ON CONFLICT(tenant_id,user_id,project_id) DO NOTHING
  RETURNING tenant_id,user_id,project_id
)
INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail)
SELECT tenant_id,user_id,NULL,'team_source_catalog_seeded',jsonb_build_object('projectId',project_id,'source','migration-011') FROM added;
INSERT INTO schema_migrations(version) VALUES('011') ON CONFLICT(version) DO NOTHING;
COMMIT;
