-- Document registry (slice 1): template index, document records, immutable revisions.
-- Pointers and hashes only: no content, no snapshot. Hash is self-declared; nothing is approved (P1.0 gates enforced here).
BEGIN;
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  code text NOT NULL, template_version text NOT NULL, doc_type text NOT NULL, title text NOT NULL, path text NOT NULL,
  content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
  UNIQUE(tenant_id,code,template_version), UNIQUE(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS document_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  ref_code text NOT NULL DEFAULT '', doc_type text NOT NULL, title text NOT NULL, template_id uuid,
  source_type text NOT NULL CHECK(source_type IN ('drive','git','vault')),
  canonical_uri text NOT NULL, owner_label text NOT NULL DEFAULT '', classification text NOT NULL DEFAULT 'unclassified',
  metadata jsonb NOT NULL DEFAULT '{}', source_links jsonb NOT NULL DEFAULT '[]',
  source_state text NOT NULL DEFAULT 'not-configured' CHECK(source_state IN ('fresh','stale','unavailable','denied','not-configured','partially-received')),
  source_checked_at timestamptz, review_due_at timestamptz,
  freeze_state text NOT NULL DEFAULT 'SOURCE_NOT_FROZEN',
  latest_revision_id uuid, approved_revision_id uuid, registered_by uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(template_id,tenant_id) REFERENCES document_templates(id,tenant_id),
  UNIQUE(id,tenant_id,project_id), UNIQUE(tenant_id,project_id,canonical_uri)
);
CREATE TABLE IF NOT EXISTS document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  document_id uuid NOT NULL, revision_no integer NOT NULL CHECK(revision_no > 0), based_on_revision_id uuid,
  source_id text NOT NULL, source_type text NOT NULL, ingested_at timestamptz NOT NULL DEFAULT now(),
  quality_score numeric(3,2) NOT NULL DEFAULT 0 CHECK(quality_score BETWEEN 0 AND 1),
  source_revision text, source_hash text CHECK(source_hash IS NULL OR source_hash ~ '^[a-f0-9]{64}$'),
  hash_verification text NOT NULL DEFAULT 'self_declared' CHECK(hash_verification IN ('self_declared','verified')),
  source_modified_at timestamptz, snapshot_ref text,
  changes jsonb NOT NULL DEFAULT '{}', source_refs jsonb NOT NULL DEFAULT '[]', proposed_by uuid NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(document_id,tenant_id,project_id) REFERENCES document_records(id,tenant_id,project_id),
  UNIQUE(id,document_id), UNIQUE(document_id,revision_no), UNIQUE(id,tenant_id,project_id)
);
-- Pointer foreign keys need both tables; guarded so the file can run twice.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_document_records_latest_revision') THEN
    ALTER TABLE document_records ADD CONSTRAINT fk_document_records_latest_revision
      FOREIGN KEY(latest_revision_id,id) REFERENCES document_revisions(id,document_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_document_records_approved_revision') THEN
    ALTER TABLE document_records ADD CONSTRAINT fk_document_records_approved_revision
      FOREIGN KEY(approved_revision_id,id) REFERENCES document_revisions(id,document_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_document_revisions_based_on') THEN
    ALTER TABLE document_revisions ADD CONSTRAINT fk_document_revisions_based_on
      FOREIGN KEY(based_on_revision_id,document_id) REFERENCES document_revisions(id,document_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_document_templates_tenant_created ON document_templates(tenant_id,created_at);
CREATE INDEX IF NOT EXISTS idx_document_records_scope_created ON document_records(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_records_template ON document_records(template_id);
CREATE INDEX IF NOT EXISTS idx_document_records_latest_revision ON document_records(latest_revision_id);
CREATE INDEX IF NOT EXISTS idx_document_records_approved_revision ON document_records(approved_revision_id);
CREATE INDEX IF NOT EXISTS idx_document_revisions_document_scope_created ON document_revisions(document_id,tenant_id,project_id,created_at);
CREATE INDEX IF NOT EXISTS idx_document_revisions_based_on ON document_revisions(based_on_revision_id);
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE document_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_records FORCE ROW LEVEL SECURITY;
ALTER TABLE document_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_revisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy ON document_templates;
CREATE POLICY tenant_policy ON document_templates
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS scope_select ON document_records;
CREATE POLICY scope_select ON document_records FOR SELECT
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_insert ON document_records;
CREATE POLICY scope_insert ON document_records FOR INSERT
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND approved_revision_id IS NULL AND freeze_state = 'SOURCE_NOT_FROZEN');
DROP POLICY IF EXISTS scope_update ON document_records;
CREATE POLICY scope_update ON document_records FOR UPDATE
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_select ON document_revisions;
CREATE POLICY scope_select ON document_revisions FOR SELECT
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_insert ON document_revisions;
CREATE POLICY scope_insert ON document_revisions FOR INSERT
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND hash_verification = 'self_declared' AND snapshot_ref IS NULL);
DROP TRIGGER IF EXISTS document_templates_immutable ON document_templates;
CREATE TRIGGER document_templates_immutable BEFORE UPDATE OR DELETE ON document_templates FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS document_revisions_immutable ON document_revisions;
CREATE TRIGGER document_revisions_immutable BEFORE UPDATE OR DELETE ON document_revisions FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS document_records_no_delete ON document_records;
CREATE TRIGGER document_records_no_delete BEFORE DELETE ON document_records FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
GRANT SELECT ON document_templates, document_records, document_revisions TO libetech_runtime;
GRANT INSERT ON document_records, document_revisions TO libetech_runtime;
GRANT UPDATE(latest_revision_id,version,updated_at) ON document_records TO libetech_runtime;
INSERT INTO schema_migrations(version) VALUES('014') ON CONFLICT(version) DO NOTHING;
COMMIT;
