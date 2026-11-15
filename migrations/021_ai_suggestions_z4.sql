-- Slice 3: the Z4 zone for AI drafts (ADR-002, AR-03, E-AI-04) and the database role of the AI pipeline.
-- intelligence.ai_drafts is immutable and written only by libetech_ai; draft_decisions is Z1 and written only by a person (runtime role): the AI
-- role holds no privilege on it. A confirmed draft is what later writes Z1 (a person's act, never the AI role's). Nothing here switches anything on:
-- no login, no password, no key, no membership of libetech_ai is created, and no model is called.
-- libetech_ai is cluster-wide (NOLOGIN, granted to no role); the rollback keeps it (OQ-20). No data rows are inserted except schema_migrations.
-- Guards run as the writing role and are not SECURITY DEFINER; the operational login (a superuser) is still stopped by draft_decisions_guard.
-- Rollback: migrations/rollback/021_ai_suggestions_z4.sql (refuses while a later migration is recorded; keeps the role).
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='libetech_ai') THEN
    CREATE ROLE libetech_ai NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
-- A role that existed before this migration is checked, not trusted: nobody may act as the AI role (a member could SET ROLE to it and write Z4),
-- and it may act as no other role. Migrations run as a superuser, which needs no membership.
-- guard:ai-role begin
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='libetech_ai' AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN
  RAISE EXCEPTION 'libetech_ai must be NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB and NOCREATEROLE';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles a ON a.rolname='libetech_ai'
   WHERE m.roleid=a.oid OR m.member=a.oid) THEN
  RAISE EXCEPTION 'libetech_ai must have no members and be a member of no role';
 END IF;
END $$;
-- guard:ai-role end

CREATE SCHEMA IF NOT EXISTS intelligence;
REVOKE ALL ON SCHEMA intelligence FROM PUBLIC;

CREATE TABLE IF NOT EXISTS intelligence.ai_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  entity_type text NOT NULL CHECK(entity_type IN ('intake_candidate','document')),
  entity_id uuid NOT NULL,
  signal_type text NOT NULL CHECK(signal_type IN ('intake_analyst','ba_elicitation','pm_planning','technical_writer','doc_reviewer','release_librarian')),
  skill_version text NOT NULL,
  manifest_hash text NOT NULL CHECK(manifest_hash ~ '^[a-f0-9]{64}$'),
  model_version text NOT NULL,
  -- backstop only: the 32 768-byte limit is measured by the application before the database is touched; the jsonb text form is wider than the JSON text (S42)
  value jsonb NOT NULL CONSTRAINT ai_drafts_value_size CHECK(octet_length(value::text) <= 49152),
  value_hash text NOT NULL CHECK(value_hash ~ '^[a-f0-9]{64}$'),
  sources jsonb NOT NULL DEFAULT '[]' CONSTRAINT ai_drafts_sources_array CHECK(jsonb_typeof(sources) = 'array'),
  questions jsonb NOT NULL DEFAULT '[]' CONSTRAINT ai_drafts_questions_array CHECK(jsonb_typeof(questions) = 'array'),
  confidence smallint NOT NULL CHECK(confidence BETWEEN 0 AND 100),
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  ai_principal_id uuid NOT NULL, trace_id uuid NOT NULL,
  dedupe_key text NOT NULL CHECK(dedupe_key ~ '^[A-Za-z0-9_-]{8,100}$'),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  UNIQUE(tenant_id,dedupe_key), UNIQUE(id,tenant_id,project_id)
);
CREATE TABLE IF NOT EXISTS draft_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  draft_id uuid NOT NULL, draft_value_hash text NOT NULL,
  result text NOT NULL CHECK(result IN ('confirmed','rejected')),
  reason text NOT NULL DEFAULT '' CHECK(length(reason) <= 1000),
  document_revision_id uuid,
  decided_by uuid NOT NULL,
  command_key text NOT NULL, request_id uuid NOT NULL, trace_id uuid NOT NULL,
  CONSTRAINT draft_decisions_revision_only_confirmed CHECK(result = 'confirmed' OR document_revision_id IS NULL),
  CONSTRAINT draft_decisions_rejection_reason CHECK(result <> 'rejected' OR length(btrim(reason)) >= 5),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(draft_id,tenant_id,project_id) REFERENCES intelligence.ai_drafts(id,tenant_id,project_id),
  FOREIGN KEY(document_revision_id,tenant_id,project_id) REFERENCES document_revisions(id,tenant_id,project_id),
  UNIQUE(draft_id)
);

-- Foreign keys led by UNIQUE(draft_id) or UNIQUE(tenant_id,dedupe_key) are served by those indexes (pattern of 016); the rest are listed.
CREATE INDEX IF NOT EXISTS idx_ai_drafts_scope_created ON intelligence.ai_drafts(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_created ON intelligence.ai_drafts(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_project_fk ON intelligence.ai_drafts(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_entity ON intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_draft_decisions_scope_created ON draft_decisions(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_draft_decisions_created ON draft_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_draft_decisions_project_fk ON draft_decisions(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_draft_decisions_revision_fk ON draft_decisions(document_revision_id,tenant_id,project_id);

ALTER TABLE intelligence.ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.ai_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE draft_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_decisions FORCE ROW LEVEL SECURITY;

-- Scope on every policy comes from the transaction context (set_config(...,true)); no context means no rows.
DROP POLICY IF EXISTS ai_select ON intelligence.ai_drafts;
CREATE POLICY ai_select ON intelligence.ai_drafts FOR SELECT TO libetech_ai
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
-- The pipeline writes as itself: ai_principal_id is the id the service sets in its own transaction, never a value from a request.
DROP POLICY IF EXISTS ai_insert ON intelligence.ai_drafts;
CREATE POLICY ai_insert ON intelligence.ai_drafts FOR INSERT TO libetech_ai
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND ai_principal_id = nullif(current_setting('app.ai_principal_id',true),'')::uuid);
DROP POLICY IF EXISTS runtime_select ON intelligence.ai_drafts;
CREATE POLICY runtime_select ON intelligence.ai_drafts FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_select ON draft_decisions;
CREATE POLICY runtime_select ON draft_decisions FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_insert ON draft_decisions;
CREATE POLICY runtime_insert ON draft_decisions FOR INSERT TO libetech_runtime
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND decided_by = nullif(current_setting('app.person_id',true),'')::uuid);

-- Decision guard (DOC-05 at the database): the hash a person confirms or rejects is the hash of the stored draft, and a draft that names no source
-- is never confirmed. Not SECURITY DEFINER: the draft is read under the caller's own scope, so a draft outside it is not found. A person's
-- authority over the document is the service's business (Task 12); this guard only binds the decision to an existing draft of its own project.
-- The count of sources is evaluated in CASE form so that jsonb_array_length never sees a non-array.
CREATE OR REPLACE FUNCTION public.draft_decisions_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE d record;
BEGIN
  SELECT t.value_hash,
         CASE WHEN pg_catalog.jsonb_typeof(t.sources) = 'array' THEN pg_catalog.jsonb_array_length(t.sources) ELSE 0 END AS source_count
    INTO d FROM intelligence.ai_drafts t
   WHERE t.id = NEW.draft_id AND t.tenant_id = NEW.tenant_id AND t.project_id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A decision names a draft of its own project';
  END IF;
  IF NEW.draft_value_hash IS DISTINCT FROM d.value_hash THEN
    RAISE EXCEPTION 'A decision carries the value hash of the draft it answers';
  END IF;
  IF NEW.result = 'confirmed' AND d.source_count = 0 THEN
    RAISE EXCEPTION 'A draft that names no source cannot be confirmed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS draft_decisions_guard ON draft_decisions;
CREATE TRIGGER draft_decisions_guard BEFORE INSERT ON draft_decisions
  FOR EACH ROW EXECUTE FUNCTION public.draft_decisions_guard();

DROP TRIGGER IF EXISTS ai_drafts_immutable ON intelligence.ai_drafts;
CREATE TRIGGER ai_drafts_immutable BEFORE UPDATE OR DELETE ON intelligence.ai_drafts FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS draft_decisions_immutable ON draft_decisions;
CREATE TRIGGER draft_decisions_immutable BEFORE UPDATE OR DELETE ON draft_decisions FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

-- Grants. Nothing is granted to PUBLIC, libetech_intake, libetech_identity or libetech_web (web reaches the runtime role). The AI role holds
-- SELECT and column-level INSERT on the draft table and no privilege on anything else in any schema; id and timestamps come from defaults.
-- UPDATE and DELETE are granted to nobody.
REVOKE ALL ON intelligence.ai_drafts, draft_decisions FROM PUBLIC;
GRANT USAGE ON SCHEMA intelligence TO libetech_ai, libetech_runtime;
GRANT SELECT ON intelligence.ai_drafts TO libetech_ai, libetech_runtime;
GRANT INSERT(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,sources,questions,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
  ON intelligence.ai_drafts TO libetech_ai;
GRANT SELECT ON draft_decisions TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,draft_id,draft_value_hash,result,reason,document_revision_id,decided_by,command_key,request_id,trace_id) ON draft_decisions TO libetech_runtime;

INSERT INTO schema_migrations(version) VALUES('021') ON CONFLICT(version) DO NOTHING;
COMMIT;
