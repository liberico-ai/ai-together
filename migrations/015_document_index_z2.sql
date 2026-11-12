-- Z2 document index (slice 1): metadata projection written only by the named projector role.
-- No canonical_uri column: opening a source always goes through the domain service. Not wired to the web path (OQ-22).
BEGIN;
CREATE TABLE IF NOT EXISTS analytics.document_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  document_id uuid NOT NULL, ref_code text NOT NULL, doc_type text NOT NULL, title text NOT NULL,
  owner_label text NOT NULL, source_type text NOT NULL,
  latest_revision_no integer, approved_revision_no integer, hash_verification text,
  source_state text NOT NULL, freeze_state text NOT NULL, missing_count integer NOT NULL DEFAULT 0,
  review_due_at timestamptz, record_version integer NOT NULL, record_updated_at timestamptz NOT NULL,
  projected_at timestamptz NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(document_id,tenant_id,project_id) REFERENCES document_records(id,tenant_id,project_id),
  UNIQUE(tenant_id,project_id,document_id)
);
CREATE INDEX IF NOT EXISTS idx_document_index_scope_created ON analytics.document_index(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_index_scope_ref ON analytics.document_index(tenant_id,project_id,ref_code);
CREATE INDEX IF NOT EXISTS idx_document_index_document ON analytics.document_index(document_id);
ALTER TABLE analytics.document_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.document_index FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS index_projection ON analytics.document_index;
CREATE POLICY index_projection ON analytics.document_index FOR ALL TO libetech_projector
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS index_read ON analytics.document_index;
CREATE POLICY index_read ON analytics.document_index FOR SELECT TO libetech_runtime
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
GRANT USAGE ON SCHEMA analytics TO libetech_projector;
GRANT SELECT ON analytics.document_index TO libetech_runtime;
GRANT SELECT,INSERT,UPDATE ON analytics.document_index TO libetech_projector;
GRANT SELECT ON document_records, document_revisions TO libetech_projector;
-- DOC-18: the projector reads the Z2 source rows (RLS scope_policy of 011 applies with the projector's tenant/project context) to mark a lost source as stale.
GRANT SELECT ON analytics.tech_source_tasks TO libetech_projector;
INSERT INTO schema_migrations(version) VALUES('015') ON CONFLICT(version) DO NOTHING;
COMMIT;
