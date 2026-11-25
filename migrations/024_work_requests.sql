-- 024 — Team Tech roster and work requests that wait for a BoM approval (GIAO VIỆC 5, hạng mục A; Chairman 25/11/2026:
-- «Tất cả thành viên Team Tech được tạo việc ở tất cả các dự án» · «Việc mới ghi ở trạng thái chờ BoM xác nhận hoặc phê duyệt»).
-- Additive and idempotent. Rollback: migrations/rollback/024_work_requests.sql (never on a serving database without Chairman approval).
--
-- What it adds:
-- 1. identity.tech_roster: who belongs to Team Tech. Only the operator writes it (deploy/tech-roster.sql); every add and every removal writes an
--    identity.events row. The roster is not a project grant: it lets a member see the list of projects (id, name, BU) and file a work request in any
--    project. It does not let anyone read work, evidence or counts of a project they hold no grant in.
-- 2. public.work_requests (Z1): a new work item as filed, pending until one BoM seat of that project other than the requester approves or rejects it.
--    Approval creates the work_items row in the same transaction. A decided request never changes again.
-- 3. public.work_request_events: append-only history of a request (submitted / approved / rejected), readable by whoever can read the request.
-- 4. Four SECURITY DEFINER functions, owned by libetech_identity, that the runtime role may call: app_actor_is_tech_member(), tech_project_catalog(),
--    work_request_seat(project) and work_request_filer(project). They read the actor from app.person_id, which the work-request service sets from the authenticated session (the convention of inbox.ts run()).
BEGIN;

CREATE TABLE IF NOT EXISTS identity.tech_roster (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,user_id),
 FOREIGN KEY (user_id,tenant_id) REFERENCES identity.users(id,tenant_id)
);
CREATE INDEX IF NOT EXISTS tech_roster_created_idx ON identity.tech_roster(created_at);
ALTER TABLE identity.tech_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.tech_roster FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON identity.tech_roster;
CREATE POLICY tenant_scope ON identity.tech_roster TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT ON identity.tech_roster TO libetech_identity;

-- Every change of the roster leaves an identity event (E-DB-13). The operator names the source of the list in libetech.roster_source.
CREATE OR REPLACE FUNCTION identity.tech_roster_record_event() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,identity AS $$
DECLARE r identity.tech_roster;
BEGIN
 r := CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 IF TG_OP='UPDATE' AND (NEW.tenant_id<>OLD.tenant_id OR NEW.user_id<>OLD.user_id) THEN
  RAISE EXCEPTION 'A roster row is removed and added again, never moved to another person.';
 END IF;
 IF TG_OP<>'UPDATE' THEN
  INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail)
  VALUES (r.tenant_id,r.user_id,NULL,CASE WHEN TG_OP='INSERT' THEN 'tech_roster_added' ELSE 'tech_roster_removed' END,
   jsonb_build_object('source',coalesce(nullif(current_setting('libetech.roster_source',true),''),'unstated'),'db_role',session_user));
 END IF;
 RETURN r;
END $$;
DROP TRIGGER IF EXISTS tech_roster_event ON identity.tech_roster;
CREATE TRIGGER tech_roster_event AFTER INSERT OR UPDATE OR DELETE ON identity.tech_roster
 FOR EACH ROW EXECUTE FUNCTION identity.tech_roster_record_event();

CREATE TABLE IF NOT EXISTS work_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 requester_id uuid NOT NULL, requester_name text NOT NULL CHECK (length(requester_name) BETWEEN 1 AND 200),
 origin text NOT NULL DEFAULT 'form' CHECK (origin IN ('form','intake','import')),
 source_ref text CHECK (source_ref IS NULL OR length(source_ref) BETWEEN 1 AND 500),
 request_key uuid NOT NULL, request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
 code text CHECK (code IS NULL OR code ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
 title text NOT NULL CHECK (length(title) BETWEEN 5 AND 200),
 priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high')),
 due_at timestamptz, criteria text NOT NULL DEFAULT '' CHECK (length(criteria)<=3000),
 spec_url text CHECK (spec_url IS NULL OR length(spec_url)<=1000),
 assignee_id uuid, technical_id uuid, business_id uuid,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
 decided_by uuid, decider_name text CHECK (decider_name IS NULL OR length(decider_name) BETWEEN 1 AND 200),
 decided_at timestamptz, decision_note text CHECK (decision_note IS NULL OR length(decision_note) BETWEEN 5 AND 2000),
 work_id uuid,
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id),
 FOREIGN KEY (work_id,tenant_id,project_id) REFERENCES work_items(id,tenant_id,project_id),
 UNIQUE (id,tenant_id,project_id),
 UNIQUE (tenant_id,requester_id,request_key),
 UNIQUE (work_id),
 -- integrity of the record, not business rules: a decision carries who and when; only an approval points at a work item; nobody decides their own request
 CHECK ((state='pending')=(decided_by IS NULL AND decided_at IS NULL AND decider_name IS NULL)),
 CHECK ((state='approved')=(work_id IS NOT NULL)),
 CHECK (decided_by IS NULL OR decided_by<>requester_id),
 CHECK (assignee_id IS NULL OR technical_id IS NULL OR assignee_id<>technical_id),
 CHECK (assignee_id IS NULL OR business_id IS NULL OR assignee_id<>business_id)
);
CREATE INDEX IF NOT EXISTS work_requests_project_idx ON work_requests(tenant_id,project_id,state,created_at DESC);
CREATE INDEX IF NOT EXISTS work_requests_requester_idx ON work_requests(tenant_id,requester_id,created_at DESC);
CREATE INDEX IF NOT EXISTS work_requests_created_idx ON work_requests(created_at);

CREATE TABLE IF NOT EXISTS work_request_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 request_id uuid NOT NULL, requester_id uuid NOT NULL, actor_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('submitted','approved','rejected')),
 payload jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (request_id,tenant_id,project_id) REFERENCES work_requests(id,tenant_id,project_id)
);
CREATE INDEX IF NOT EXISTS work_request_events_request_idx ON work_request_events(request_id,created_at);
CREATE INDEX IF NOT EXISTS work_request_events_created_idx ON work_request_events(created_at);
DROP TRIGGER IF EXISTS immutable_history ON work_request_events;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON work_request_events
 FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

-- The actor of the transaction is a Team Tech member: on the roster, active and activated.
CREATE OR REPLACE FUNCTION public.app_actor_is_tech_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM identity.tech_roster r JOIN identity.users u ON u.id=r.user_id AND u.tenant_id=r.tenant_id
  WHERE r.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
   AND r.user_id=nullif(current_setting('app.person_id',true),'')::uuid
   AND u.active AND u.password_hash IS NOT NULL)
$$;
-- The project list a Team Tech member may file work in: every project of the tenant, id, name and BU only. Empty for anybody else.
GRANT SELECT (bu) ON projects TO libetech_identity;
CREATE OR REPLACE FUNCTION public.tech_project_catalog() RETURNS TABLE(id uuid, name text, bu text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p.id,p.name,p.bu FROM public.projects p
 WHERE p.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.app_actor_is_tech_member()
 ORDER BY p.name,p.id
$$;
-- The actor holds a BoM seat of the project that can decide a request: the scope is enabled, the actor is one of its three seats, and the actor is an
-- active, activated member of the project with Telegram linked (the same standing a 3/3 vote needs, bom.ts).
CREATE OR REPLACE FUNCTION public.work_request_seat(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM public.bom_scopes s
   JOIN identity.memberships m ON m.tenant_id=s.tenant_id AND m.project_id=s.project_id
   JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
   JOIN identity.telegram_links l ON l.tenant_id=u.tenant_id AND l.user_id=u.id
  WHERE s.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND s.project_id=target_project AND s.enabled
   AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
   AND u.id=nullif(current_setting('app.person_id',true),'')::uuid AND u.id=ANY(s.seat_ids)
   AND u.active AND u.password_hash IS NOT NULL)
$$;
GRANT SELECT ON public.bom_scopes TO libetech_identity;
DROP POLICY IF EXISTS identity_seat_check ON public.bom_scopes;
CREATE POLICY identity_seat_check ON public.bom_scopes FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
-- The actor may file a request in the project: the project belongs to the tenant, and the actor is a Team Tech member (any project of the tenant) or an
-- active, activated manager of that project holding it in scope (effective role = project role first, as bom_eligible_members in 006). A bot, a viewer,
-- an engineer, a technical or business acceptor, or a person with no account row gets false, whatever project grant the context carries.
CREATE OR REPLACE FUNCTION public.work_request_filer(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=target_project AND p.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  AND (public.app_actor_is_tech_member()
   OR EXISTS (SELECT 1 FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
    WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND m.project_id=target_project
     AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
     AND u.id=nullif(current_setting('app.person_id',true),'')::uuid
     AND u.active AND u.password_hash IS NOT NULL AND coalesce(m.project_role,u.role)='manager'))
$$;
DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['public.app_actor_is_tech_member()','public.tech_project_catalog()','public.work_request_seat(uuid)','public.work_request_filer(uuid)'] LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO libetech_identity',f);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO libetech_runtime',f);
 END LOOP;
END $$;

-- Row level security, as narrow as the product rule. Read: the requester, the person who decided it, and a BoM seat of the project (a member without a
-- seat gets no row, so a request id they guess answers like an id that does not exist). File: only as yourself, pending, and only as a Team Tech member
-- (any project of the tenant) or a manager of the project (work_request_filer): a project grant alone, as a bot or a viewer holds, files nothing. Decide: a BoM seat of a project in the actor's scope (the trigger below also bars the requester).
-- No context, no rows.
ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE work_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_request_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_read ON work_requests;
CREATE POLICY request_read ON work_requests FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND (requester_id=nullif(current_setting('app.person_id',true),'')::uuid
   OR decided_by=nullif(current_setting('app.person_id',true),'')::uuid
   OR (project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND public.work_request_seat(project_id))));
DROP POLICY IF EXISTS request_file ON work_requests;
CREATE POLICY request_file ON work_requests FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND requester_id=nullif(current_setting('app.person_id',true),'')::uuid AND state='pending'
  AND public.work_request_filer(project_id));
DROP POLICY IF EXISTS request_decide ON work_requests;
CREATE POLICY request_decide ON work_requests FOR UPDATE TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
  AND public.work_request_seat(project_id))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
  AND public.work_request_seat(project_id));
-- history is readable exactly where the request is (both tables had ENABLE ROW LEVEL SECURITY and FORCE above)
DROP POLICY IF EXISTS event_read ON work_request_events;
CREATE POLICY event_read ON work_request_events FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS (SELECT 1 FROM work_requests r WHERE r.id=work_request_events.request_id));
-- History cannot be forged: a submitted event is the requester's own, on a request still pending; an approved or rejected event matches the state and
-- the decider recorded on the request. Names are qualified: r is the request, work_request_events the row being written.
DROP POLICY IF EXISTS event_write ON work_request_events;
CREATE POLICY event_write ON work_request_events FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND actor_id=nullif(current_setting('app.person_id',true),'')::uuid
  AND EXISTS (SELECT 1 FROM work_requests r WHERE r.id=work_request_events.request_id AND r.tenant_id=work_request_events.tenant_id
   AND r.project_id=work_request_events.project_id AND r.requester_id=work_request_events.requester_id
   AND ((work_request_events.kind='submitted' AND work_request_events.actor_id=r.requester_id AND r.state='pending')
    OR (work_request_events.kind IN ('approved','rejected') AND r.state=work_request_events.kind AND r.decided_by=work_request_events.actor_id))));
-- one submission and one decision per request
CREATE UNIQUE INDEX IF NOT EXISTS work_request_events_kind_uq ON work_request_events(request_id,kind);

-- A request is filed once and decided once. The decision is recorded by a BoM seat of the project who is not the requester, as the actor of the
-- transaction; after that the row does not change. Content columns are not updatable at all (column grants below).
CREATE OR REPLACE FUNCTION public.work_requests_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.state<>'pending' THEN RAISE EXCEPTION 'A decided work request does not change.'; END IF;
 IF NEW.state='pending' THEN RAISE EXCEPTION 'A work request changes only by a decision.'; END IF;
 IF NEW.decided_by IS DISTINCT FROM nullif(current_setting('app.person_id',true),'')::uuid
  OR NOT public.work_request_seat(NEW.project_id) THEN
  RAISE EXCEPTION 'Only a BoM seat of the project decides a work request.';
 END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'A decision moves the version by one.'; END IF;
 -- an approval points at the work item this very request created: the service appends the audit row 'created' (carrying the request id) before it updates the request
 IF NEW.state='approved' AND NOT EXISTS (SELECT 1 FROM public.audit_events a WHERE a.work_id=NEW.work_id AND a.kind='created' AND a.payload->>'requestId'=NEW.id::text) THEN
  RAISE EXCEPTION 'An approval points at the work item created for this request.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS work_requests_guard ON work_requests;
CREATE TRIGGER work_requests_guard BEFORE UPDATE ON work_requests FOR EACH ROW EXECUTE FUNCTION public.work_requests_guard();
DROP TRIGGER IF EXISTS work_requests_no_delete ON work_requests;
CREATE TRIGGER work_requests_no_delete BEFORE DELETE ON work_requests FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

GRANT SELECT ON work_requests TO libetech_runtime;
GRANT SELECT, INSERT ON work_request_events TO libetech_runtime;
-- INSERT by column: a request is filed pending, with no decision columns, version or timestamps of the caller's choosing. The id is listed because a
-- service that files a request and a row pointing at it in one transaction (the sheet import) chooses the id itself; the API never takes it from JSON.
GRANT INSERT (id,tenant_id,project_id,requester_id,requester_name,origin,source_ref,request_key,request_hash,code,title,priority,due_at,criteria,spec_url,assignee_id,technical_id,business_id)
 ON work_requests TO libetech_runtime;
GRANT UPDATE (state,decided_by,decider_name,decided_at,decision_note,work_id,version,updated_at) ON work_requests TO libetech_runtime;

INSERT INTO schema_migrations(version) VALUES ('024') ON CONFLICT(version) DO NOTHING;
COMMIT;
