-- Telegram intake inbox (slice 2): intake role, immutable source events, revisions, attachment pointers, candidates, events.
-- Attachments are locator + hash + type + size only; no file bytes. No data rows are inserted here except schema_migrations.
-- libetech_intake / libetech_intake_svc carry no password here; operations sets one at deployment. Never granted to libetech_web.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='libetech_intake') THEN
  CREATE ROLE libetech_intake NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='libetech_intake_svc') THEN
  CREATE ROLE libetech_intake_svc LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;
GRANT libetech_intake TO libetech_intake_svc;

CREATE TABLE IF NOT EXISTS source_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  source_id text NOT NULL, source_type text NOT NULL CHECK(source_type='telegram_gateway'),
  ingested_at timestamptz NOT NULL DEFAULT now(), quality_score smallint NOT NULL CHECK(quality_score BETWEEN 0 AND 100),
  chat_id text NOT NULL CHECK(chat_id ~ '^-[1-9][0-9]*$'), topic_id text NOT NULL DEFAULT '',
  message_id text NOT NULL CHECK(message_id ~ '^[1-9][0-9]*$'),
  reply_to_message_id text, media_group_id text, thread_key text NOT NULL,
  source_actor text NOT NULL, source_actor_label text NOT NULL DEFAULT '',
  observed_at timestamptz NOT NULL, locator text NOT NULL DEFAULT '',
  forwarded boolean NOT NULL, addressed boolean NOT NULL, spooled boolean NOT NULL DEFAULT false,
  content_mode text NOT NULL CHECK(content_mode IN ('excerpt','pointer_only')),
  trace_id uuid NOT NULL, correlation_id uuid NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  UNIQUE(tenant_id,source_type,chat_id,message_id),
  UNIQUE(id,tenant_id,project_id)
);
CREATE TABLE IF NOT EXISTS source_event_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid NOT NULL, revision_no integer NOT NULL CHECK(revision_no>0),
  revision_key text NOT NULL CHECK(revision_key ~ '^[a-f0-9]{64}$'), edited_at timestamptz,
  content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
  text_excerpt text CHECK(text_excerpt IS NULL OR length(text_excerpt)<=4096),
  text_truncated boolean NOT NULL DEFAULT false,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(source_event_id,tenant_id,project_id) REFERENCES source_events(id,tenant_id,project_id),
  UNIQUE(source_event_id,revision_key), UNIQUE(source_event_id,revision_no), UNIQUE(id,tenant_id,project_id),
  UNIQUE(id,source_event_id,tenant_id,project_id)
);
CREATE TABLE IF NOT EXISTS intake_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid NOT NULL, revision_id uuid NOT NULL,
  state text NOT NULL CHECK(state IN ('stored','failed','too_large','unsupported_type')),
  locator text, sha256 text CHECK(sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  hash_verification text NOT NULL DEFAULT 'gateway_declared' CHECK(hash_verification IN ('gateway_declared','verified')),
  mime_type text NOT NULL DEFAULT '', size_bytes bigint, file_name text NOT NULL DEFAULT '', reason_code text,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(source_event_id,tenant_id,project_id) REFERENCES source_events(id,tenant_id,project_id),
  FOREIGN KEY(revision_id,source_event_id,tenant_id,project_id) REFERENCES source_event_revisions(id,source_event_id,tenant_id,project_id),
  UNIQUE(revision_id),
  CHECK(state<>'stored' OR (locator IS NOT NULL AND sha256 IS NOT NULL AND size_bytes BETWEEN 1 AND 20971520)),
  CHECK(state='stored' OR locator IS NULL)
);
CREATE TABLE IF NOT EXISTS intake_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  chat_id text NOT NULL, thread_key text NOT NULL, root_source_event_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'new' CHECK(state IN ('new','needs_info','confirmed','duplicate','dismissed')),
  classification text CHECK(classification IS NULL OR classification IN ('incident','request','document')),
  duplicate_of uuid, missing_fields jsonb NOT NULL DEFAULT '[]', note text NOT NULL DEFAULT '',
  ticket_ref text, decided_by uuid, version integer NOT NULL DEFAULT 1 CHECK(version>0),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(root_source_event_id,tenant_id,project_id) REFERENCES source_events(id,tenant_id,project_id),
  UNIQUE(tenant_id,project_id,chat_id,thread_key),
  UNIQUE(id,tenant_id,project_id),
  FOREIGN KEY(duplicate_of,tenant_id,project_id) REFERENCES intake_candidates(id,tenant_id,project_id)
);
CREATE TABLE IF NOT EXISTS intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  entity_type text NOT NULL CHECK(entity_type IN ('source_event','intake_candidate','outbox_message')),
  entity_id uuid NOT NULL, actor_id uuid NOT NULL,
  actor_kind text NOT NULL CHECK(actor_kind IN ('user','intake_service')),
  kind text NOT NULL, request_id uuid NOT NULL, trace_id uuid NOT NULL, payload jsonb NOT NULL,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_source_events_scope_created ON source_events(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_events_thread ON source_events(tenant_id,chat_id,thread_key);
CREATE INDEX IF NOT EXISTS idx_source_events_project_fk ON source_events(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_source_event_revisions_scope_created ON source_event_revisions(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_event_revisions_project_fk ON source_event_revisions(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_source_event_revisions_event_fk ON source_event_revisions(source_event_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_intake_attachments_scope_created ON intake_attachments(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_attachments_project_fk ON intake_attachments(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_intake_attachments_event_fk ON intake_attachments(source_event_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_intake_attachments_revision_fk ON intake_attachments(revision_id,source_event_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_intake_candidates_scope_created ON intake_candidates(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_candidates_scope_state ON intake_candidates(tenant_id,project_id,state,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_candidates_project_fk ON intake_candidates(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_intake_candidates_root_fk ON intake_candidates(root_source_event_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_intake_candidates_duplicate_fk ON intake_candidates(duplicate_of,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_intake_events_scope_created ON intake_events(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_events_entity ON intake_events(entity_type,entity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_intake_events_project_fk ON intake_events(project_id,tenant_id);

ALTER TABLE source_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_events FORCE ROW LEVEL SECURITY;
ALTER TABLE source_event_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_event_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_events FORCE ROW LEVEL SECURITY;

-- Scope condition on every policy: tenant and project from the transaction context (set_config(...,true)), never from the row's caller.
DROP POLICY IF EXISTS intake_select ON source_events;
CREATE POLICY intake_select ON source_events FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS intake_insert ON source_events;
CREATE POLICY intake_insert ON source_events FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_select ON source_events;
CREATE POLICY runtime_select ON source_events FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));

DROP POLICY IF EXISTS intake_select ON source_event_revisions;
CREATE POLICY intake_select ON source_event_revisions FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS intake_insert ON source_event_revisions;
CREATE POLICY intake_insert ON source_event_revisions FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_select ON source_event_revisions;
CREATE POLICY runtime_select ON source_event_revisions FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));

DROP POLICY IF EXISTS intake_select ON intake_attachments;
CREATE POLICY intake_select ON intake_attachments FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS intake_insert ON intake_attachments;
CREATE POLICY intake_insert ON intake_attachments FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND hash_verification = 'gateway_declared');
DROP POLICY IF EXISTS runtime_select ON intake_attachments;
CREATE POLICY runtime_select ON intake_attachments FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));

DROP POLICY IF EXISTS intake_select ON intake_candidates;
CREATE POLICY intake_select ON intake_candidates FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS intake_insert ON intake_candidates;
CREATE POLICY intake_insert ON intake_candidates FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND state = 'new' AND classification IS NULL AND decided_by IS NULL AND duplicate_of IS NULL AND ticket_ref IS NULL);
DROP POLICY IF EXISTS runtime_select ON intake_candidates;
CREATE POLICY runtime_select ON intake_candidates FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_update ON intake_candidates;
CREATE POLICY runtime_update ON intake_candidates FOR UPDATE TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));

DROP POLICY IF EXISTS intake_select ON intake_events;
CREATE POLICY intake_select ON intake_events FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS intake_insert ON intake_events;
CREATE POLICY intake_insert ON intake_events FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND actor_kind = 'intake_service');
DROP POLICY IF EXISTS runtime_select ON intake_events;
CREATE POLICY runtime_select ON intake_events FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_insert ON intake_events;
CREATE POLICY runtime_insert ON intake_events FOR INSERT TO libetech_runtime
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND actor_kind = 'user');

DROP TRIGGER IF EXISTS source_events_immutable ON source_events;
CREATE TRIGGER source_events_immutable BEFORE UPDATE OR DELETE ON source_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS source_event_revisions_immutable ON source_event_revisions;
CREATE TRIGGER source_event_revisions_immutable BEFORE UPDATE OR DELETE ON source_event_revisions FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS intake_attachments_immutable ON intake_attachments;
CREATE TRIGGER intake_attachments_immutable BEFORE UPDATE OR DELETE ON intake_attachments FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS intake_events_immutable ON intake_events;
CREATE TRIGGER intake_events_immutable BEFORE UPDATE OR DELETE ON intake_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS intake_candidates_no_delete ON intake_candidates;
CREATE TRIGGER intake_candidates_no_delete BEFORE DELETE ON intake_candidates FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

GRANT USAGE ON SCHEMA public TO libetech_intake;
GRANT SELECT, INSERT ON source_events, source_event_revisions, intake_attachments, intake_candidates, intake_events TO libetech_intake;
GRANT SELECT(id,tenant_id) ON projects TO libetech_intake;
GRANT SELECT ON project_domain_mappings TO libetech_intake;
GRANT SELECT ON source_events, source_event_revisions, intake_attachments, intake_candidates, intake_events TO libetech_runtime;
GRANT UPDATE(state,classification,duplicate_of,missing_fields,note,ticket_ref,decided_by,version,updated_at) ON intake_candidates TO libetech_runtime;
GRANT INSERT ON intake_events TO libetech_runtime;
INSERT INTO schema_migrations(version) VALUES('016') ON CONFLICT(version) DO NOTHING;
COMMIT;
