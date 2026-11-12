BEGIN;
CREATE TABLE IF NOT EXISTS identity.registration_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 username text NOT NULL CHECK(username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 project_interest text NOT NULL CHECK(length(project_interest) BETWEEN 2 AND 200),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
 reviewed_by uuid, reviewed_at timestamptz, user_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(reviewed_by,tenant_id) REFERENCES identity.users(id,tenant_id),
 FOREIGN KEY(user_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 UNIQUE(id,tenant_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS registration_pending_username
 ON identity.registration_requests(tenant_id,username) WHERE state='pending';
CREATE INDEX IF NOT EXISTS registration_pending_recent
 ON identity.registration_requests(tenant_id,state,created_at DESC);
ALTER TABLE identity.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.registration_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON identity.registration_requests;
CREATE POLICY tenant_scope ON identity.registration_requests TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT ON identity.registration_requests TO libetech_identity;
GRANT INSERT (tenant_id,username,name,project_interest,note) ON identity.registration_requests TO libetech_identity;
GRANT UPDATE (state,reviewed_by,reviewed_at,user_id,updated_at) ON identity.registration_requests TO libetech_identity;

CREATE TABLE IF NOT EXISTS feedback_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 reporter_id uuid NOT NULL, request_key uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('bug','idea')),
 title text NOT NULL CHECK(length(title) BETWEEN 5 AND 140),
 description text NOT NULL CHECK(length(description) BETWEEN 20 AND 4000),
 page_path text NOT NULL CHECK(length(page_path) BETWEEN 1 AND 300),
 expected text NOT NULL DEFAULT '' CHECK(length(expected)<=2000),
 actual text NOT NULL DEFAULT '' CHECK(length(actual)<=2000),
 state text NOT NULL DEFAULT 'new' CHECK(state IN ('new','reviewing','closed')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
 FOREIGN KEY(reporter_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 UNIQUE(id,tenant_id,project_id), UNIQUE(tenant_id,reporter_id,request_key)
);
CREATE INDEX IF NOT EXISTS feedback_project_recent ON feedback_reports(tenant_id,project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS feedback_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 report_id uuid NOT NULL, actor_id uuid NOT NULL,
 request_key uuid NOT NULL, prior_version integer NOT NULL, next_state text NOT NULL
 CHECK(next_state IN ('reviewing','closed')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(report_id,tenant_id,project_id) REFERENCES feedback_reports(id,tenant_id,project_id),
 FOREIGN KEY(actor_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 UNIQUE(tenant_id,actor_id,request_key)
);
CREATE INDEX IF NOT EXISTS feedback_actions_report ON feedback_actions(tenant_id,report_id,created_at);
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE feedback_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_actions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_policy ON feedback_reports;
CREATE POLICY scope_policy ON feedback_reports TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND
 project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND
 project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS scope_policy ON feedback_actions;
CREATE POLICY scope_policy ON feedback_actions TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND
 project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND
 project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
GRANT SELECT,INSERT ON feedback_reports TO libetech_runtime;
GRANT UPDATE (state,version,updated_at) ON feedback_reports TO libetech_runtime;
GRANT SELECT,INSERT ON feedback_actions TO libetech_runtime;
DROP TRIGGER IF EXISTS feedback_actions_immutable ON feedback_actions;
CREATE TRIGGER feedback_actions_immutable BEFORE UPDATE OR DELETE ON feedback_actions
 FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
INSERT INTO schema_migrations(version) VALUES('007') ON CONFLICT(version) DO NOTHING;
COMMIT;
