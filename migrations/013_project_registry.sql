-- Project registry (slice 1): profiles, proposed-only channels, empty domain mappings, append-only events.
-- Domain labels are reporting labels, not tenant/BU/legal entity. No data rows are inserted here.
BEGIN;
CREATE TABLE IF NOT EXISTS project_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  objective text NOT NULL DEFAULT '', owner_bu text NOT NULL DEFAULT '', pm_label text NOT NULL DEFAULT '',
  vault_pointer text, repo_url text, status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','active','paused','closed')),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0), updated_by uuid NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  UNIQUE(tenant_id,project_id)
);
CREATE TABLE IF NOT EXISTS project_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  chat_id text NOT NULL CHECK(chat_id ~ '^-[1-9][0-9]*$'), topic_id text NOT NULL DEFAULT '',
  mode text NOT NULL CHECK(mode IN ('command_reply','active')),
  state text NOT NULL DEFAULT 'proposed' CHECK(state IN ('proposed','active','disabled')),
  enabled_from timestamptz, approver_id uuid, policy_version text NOT NULL, proposed_by uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  UNIQUE(tenant_id,project_id,chat_id,topic_id)
);
CREATE TABLE IF NOT EXISTS project_domain_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  domain_code text NOT NULL CHECK(domain_code IN ('LIBERICO_BU','XECA','IBS_HI')),
  confirmed_by uuid NOT NULL, source text NOT NULL CHECK(length(source) >= 5),
  mapping_version integer NOT NULL CHECK(mapping_version > 0),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  UNIQUE(tenant_id,project_id,mapping_version)
);
CREATE TABLE IF NOT EXISTS registry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  entity_type text NOT NULL CHECK(entity_type IN ('project_profile','project_channel','domain_mapping','document','document_revision')),
  entity_id uuid NOT NULL, actor_id uuid NOT NULL, kind text NOT NULL, command_key text NOT NULL, payload jsonb NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_project_profiles_scope_created ON project_profiles(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_channels_scope_created ON project_channels(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_domain_mappings_scope_created ON project_domain_mappings(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registry_events_scope_created ON registry_events(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registry_events_entity ON registry_events(entity_type,entity_id,created_at);
ALTER TABLE project_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_select ON project_profiles;
CREATE POLICY scope_select ON project_profiles FOR SELECT
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_insert ON project_profiles;
CREATE POLICY scope_insert ON project_profiles FOR INSERT
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND status = 'proposed' AND version = 1);
ALTER TABLE project_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_channels FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_select ON project_channels;
CREATE POLICY scope_select ON project_channels FOR SELECT
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_insert ON project_channels;
CREATE POLICY scope_insert ON project_channels FOR INSERT
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND state = 'proposed' AND approver_id IS NULL AND enabled_from IS NULL);
ALTER TABLE project_domain_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_domain_mappings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_select ON project_domain_mappings;
CREATE POLICY scope_select ON project_domain_mappings FOR SELECT
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_insert ON project_domain_mappings;
CREATE POLICY scope_insert ON project_domain_mappings FOR INSERT
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
ALTER TABLE registry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_select ON registry_events;
CREATE POLICY scope_select ON registry_events FOR SELECT
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_insert ON registry_events;
CREATE POLICY scope_insert ON registry_events FOR INSERT
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_update ON project_profiles;
CREATE POLICY scope_update ON project_profiles FOR UPDATE
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP TRIGGER IF EXISTS project_domain_mappings_immutable ON project_domain_mappings;
CREATE TRIGGER project_domain_mappings_immutable BEFORE UPDATE OR DELETE ON project_domain_mappings FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS registry_events_immutable ON registry_events;
CREATE TRIGGER registry_events_immutable BEFORE UPDATE OR DELETE ON registry_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
GRANT SELECT ON project_profiles, project_channels, project_domain_mappings, registry_events TO libetech_runtime;
-- Column-level INSERT (pattern 007): id, timestamps, version and the approval columns come from defaults; runtime cannot set them.
REVOKE INSERT ON project_profiles, project_channels, registry_events FROM libetech_runtime;
GRANT INSERT(tenant_id,project_id,objective,owner_bu,pm_label,vault_pointer,repo_url,status,updated_by) ON project_profiles TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,chat_id,topic_id,mode,policy_version,proposed_by) ON project_channels TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,entity_type,entity_id,actor_id,kind,command_key,payload) ON registry_events TO libetech_runtime;
GRANT UPDATE(objective,owner_bu,pm_label,vault_pointer,repo_url,status,version,updated_by,updated_at) ON project_profiles TO libetech_runtime;
INSERT INTO schema_migrations(version) VALUES('013') ON CONFLICT(version) DO NOTHING;
COMMIT;
