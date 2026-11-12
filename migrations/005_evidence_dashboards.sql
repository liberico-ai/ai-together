BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='libetech_projector') THEN
  CREATE ROLE libetech_projector NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS analytics.evidence_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 period_start timestamptz NOT NULL, period_end timestamptz NOT NULL, as_of timestamptz NOT NULL,
 policy_version text NOT NULL, input_digest text NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
 input jsonb NOT NULL, summary jsonb NOT NULL, synthetic boolean NOT NULL, policy_approved boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(period_start < period_end AND period_start <= as_of),
 FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
 UNIQUE(id,tenant_id,project_id), UNIQUE(tenant_id,project_id,input_digest)
);
CREATE TABLE IF NOT EXISTS analytics.evidence_people (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 run_id uuid NOT NULL, user_id uuid NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(run_id,tenant_id,project_id) REFERENCES analytics.evidence_runs(id,tenant_id,project_id),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id), UNIQUE(run_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.report_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 run_id uuid NOT NULL, user_id uuid NOT NULL, actor_id uuid NOT NULL,
 request_key uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('correction','quality_review','approval')),
 detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(run_id,tenant_id,project_id) REFERENCES analytics.evidence_runs(id,tenant_id,project_id),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 FOREIGN KEY(actor_id,tenant_id) REFERENCES identity.users(id,tenant_id), UNIQUE(tenant_id,actor_id,request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS report_approval_once ON public.report_actions(run_id,user_id) WHERE kind='approval';
CREATE INDEX IF NOT EXISTS evidence_period_index ON analytics.evidence_runs(tenant_id,project_id,period_start,created_at DESC);
CREATE INDEX IF NOT EXISTS report_actions_run_index ON public.report_actions(run_id,user_id,created_at);
DO $$ DECLARE tbl regclass; BEGIN
 FOREACH tbl IN ARRAY ARRAY['analytics.evidence_runs'::regclass,'analytics.evidence_people'::regclass,'public.report_actions'::regclass] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('DROP TRIGGER IF EXISTS history_immutable ON %s',tbl);
  EXECUTE format('CREATE TRIGGER history_immutable BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION reject_history_mutation()',tbl);
  EXECUTE format('DROP POLICY IF EXISTS project_projection ON %s',tbl);
  EXECUTE format('CREATE POLICY project_projection ON %s TO libetech_projector USING
    (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND
     project_id=ANY(string_to_array(coalesce(current_setting(''app.project_ids'',true),''''),'','')::uuid[]))',tbl);
 END LOOP;
END $$;
DROP POLICY IF EXISTS report_scope ON analytics.evidence_runs;
CREATE POLICY report_scope ON analytics.evidence_runs FOR SELECT TO libetech_runtime USING (
 tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND
 project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
);
DROP POLICY IF EXISTS person_scope ON analytics.evidence_people;
CREATE POLICY person_scope ON analytics.evidence_people FOR SELECT TO libetech_runtime USING (
 tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND
 project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) AND
 (user_id=nullif(current_setting('app.person_id',true),'')::uuid OR
  project_id=ANY(string_to_array(coalesce(current_setting('app.people_projects',true),''),',')::uuid[]))
);
DROP POLICY IF EXISTS report_action_read ON public.report_actions;
CREATE POLICY report_action_read ON public.report_actions FOR SELECT TO libetech_runtime USING (
 tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND
 project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) AND
 (user_id=nullif(current_setting('app.person_id',true),'')::uuid OR
  project_id=ANY(string_to_array(coalesce(current_setting('app.people_projects',true),''),',')::uuid[]))
);
DROP POLICY IF EXISTS report_action_write ON public.report_actions;
CREATE POLICY report_action_write ON public.report_actions FOR INSERT TO libetech_runtime WITH CHECK (
 tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND
 project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) AND
 actor_id=nullif(current_setting('app.person_id',true),'')::uuid AND (
  (kind='correction' AND user_id=actor_id) OR
  (kind='quality_review' AND user_id<>actor_id AND project_id=ANY(string_to_array(coalesce(current_setting('app.review_projects',true),''),',')::uuid[])) OR
  (kind='approval' AND user_id<>actor_id AND project_id=ANY(string_to_array(coalesce(current_setting('app.approve_projects',true),''),',')::uuid[]))
 )
);
GRANT USAGE ON SCHEMA analytics TO libetech_projector;
GRANT SELECT,INSERT ON analytics.evidence_runs,analytics.evidence_people TO libetech_projector;
GRANT SELECT ON public.report_actions TO libetech_projector;
GRANT SELECT (id,tenant_id,project_id,period_start,period_end,as_of,policy_version,summary,synthetic,policy_approved,created_at)
 ON analytics.evidence_runs TO libetech_runtime;
GRANT SELECT ON analytics.evidence_people TO libetech_runtime;
GRANT SELECT,INSERT ON public.report_actions TO libetech_runtime;
INSERT INTO schema_migrations(version) VALUES('005') ON CONFLICT(version) DO NOTHING;
COMMIT;
