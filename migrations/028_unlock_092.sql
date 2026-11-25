-- 028 — bản 0.9.2 «MỞ KHOÁ» (GIAO VIỆC 7). Chairman 25/11/2026 17:48: «Mục tiêu là cả team dùng được sau go live, nên em tự ra quyết định. Đừng Go live xong
-- không làm được gì. lỗi có thể sửa . Đừng khoá chặt , team Tech cũng cần học và trải nghiệm». The decisions this migration carries are those of the coordination
-- session (Cowork) under that delegation; the Chairman can change them (docs/OPEN-QUESTIONS.md).
-- Additive and idempotent. Rollback: migrations/rollback/028_unlock_092.sql (never on a serving database without Chairman approval).
--
-- What it adds (all Z1):
-- 1. identity.tech_bom: the three BoM Tech of a tenant. Only the operator writes it (deploy/tech-bom.sql); every add and every removal writes an identity.events row.
--    One of them, other than the requester, may decide a work request in any project of the tenant, with or without a Telegram link (M5).
-- 2. public.work_request_seat(project) is redefined: a BoM Tech (any project of the tenant), or a BoM seat of the project who is an active, activated member of it.
--    The Telegram link is no longer required to decide a request on the web. The 3/3 ballot (bom.ts) keeps its own seat conditions, Telegram included.
--    The request policies (read, decide) ask that function alone. A BoM Tech's scope is not widened: the decision adds the one project it writes in, nothing else.
--    Linking a message to existing work (intake_link_allowed) keeps the 025 rule: being a BoM Tech adds nothing there.
--    Filing a request (work_request_filer): a BoM Tech counts as a member of Team Tech, on the roster or not (M6).
-- 3. public.work_access_grants: append-only. When a Team Tech member (roster or BoM Tech) who holds no membership in the project is given work — by the approval of
--    a request, by an applied 3/3 ballot, or by a new revision — one row records who granted it and from which source. While the member still holds that work, the
--    sign-in adds the project to their scope as 'viewer'; the work service lets the assignee do the performer's steps (M2). Nobody off the roster gets a row, and
--    nobody grants themselves one (the guard asks the database again).
-- 4. public.bom_sources: the runtime may write the one source row of a work item it created from an approved request ('work_request:<id>', the request hash, valid
--    for ever), so the 3/3 ballot can reassign that work (M4). Such a row never changes or goes away. Work approved under 0.9.1 gets its row here (backfill).
--    The prefix is reserved from here on: an operator source that already carries it and that no approved request derives stops 028 before anything is written.
-- 5. work_import_batches.file_name: the name of the file the PM chose at preview (OQ-62 câu 6), next to the hash and the time already recorded.
BEGIN;
-- a login that row level security binds would see no request and backfill nothing: with row_security off it errors instead
SET LOCAL row_security = off;
-- Before 028 the prefix 'work_request:' was the operator's like any other. A source row that carries it and that no approved request derives (the request id, the
-- same work, the request hash, valid for ever) is not taken over: 028 stops here and changes nothing. Once 028 stands, the guard below writes no such row, so on
-- a second run every row with the prefix is derived and this passes.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.bom_sources s WHERE starts_with(s.source_ref,'work_request:') AND NOT EXISTS (SELECT 1 FROM public.work_requests r
    WHERE r.work_id=s.work_id AND r.tenant_id=s.tenant_id AND r.project_id=s.project_id AND r.state='approved'
     AND s.source_ref='work_request:'||r.id::text AND r.request_hash=s.fingerprint AND s.valid_until='infinity'::timestamptz)) THEN
  RAISE EXCEPTION 'bom_sources holds an operator source named work_request:… that no approved request derives. Rename that source (another prefix) as the operator, then apply 028.';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS identity.tech_bom (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
 seat smallint NOT NULL CHECK (seat BETWEEN 1 AND 3),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,user_id),
 UNIQUE (tenant_id,seat),
 FOREIGN KEY (user_id,tenant_id) REFERENCES identity.users(id,tenant_id)
);
CREATE INDEX IF NOT EXISTS tech_bom_created_idx ON identity.tech_bom(created_at);
ALTER TABLE identity.tech_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.tech_bom FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON identity.tech_bom;
CREATE POLICY tenant_scope ON identity.tech_bom TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT ON identity.tech_bom TO libetech_identity;
-- PostgreSQL requires an update privilege for the share lock a decision takes on the row (the BoM Tech row, and the roster row of a performer)
GRANT UPDATE (updated_at) ON identity.tech_bom, identity.tech_roster TO libetech_identity;

-- Every change of the three BoM Tech leaves an identity event (E-DB-13). The operator names the source in libetech.tech_bom_source.
CREATE OR REPLACE FUNCTION identity.tech_bom_record_event() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,identity AS $$
DECLARE r identity.tech_bom;
BEGIN
 r := CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 IF TG_OP='UPDATE' AND (NEW.tenant_id<>OLD.tenant_id OR NEW.user_id<>OLD.user_id OR NEW.seat<>OLD.seat) THEN
  RAISE EXCEPTION 'A BoM Tech row is removed and added again, never moved to another person or seat.';
 END IF;
 IF TG_OP<>'UPDATE' THEN
  INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail)
  VALUES (r.tenant_id,r.user_id,NULL,CASE WHEN TG_OP='INSERT' THEN 'tech_bom_added' ELSE 'tech_bom_removed' END,
   jsonb_build_object('source',coalesce(nullif(current_setting('libetech.tech_bom_source',true),''),'unstated'),'seat',r.seat,'db_role',session_user));
 END IF;
 RETURN r;
END $$;
DROP TRIGGER IF EXISTS tech_bom_event ON identity.tech_bom;
CREATE TRIGGER tech_bom_event AFTER INSERT OR UPDATE OR DELETE ON identity.tech_bom
 FOR EACH ROW EXECUTE FUNCTION identity.tech_bom_record_event();

-- The actor of the transaction is one of the three BoM Tech: listed, active and activated.
CREATE OR REPLACE FUNCTION public.app_actor_is_tech_bom() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM identity.tech_bom b JOIN identity.users u ON u.id=b.user_id AND u.tenant_id=b.tenant_id
  WHERE b.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
   AND b.user_id=nullif(current_setting('app.person_id',true),'')::uuid
   AND u.active AND u.password_hash IS NOT NULL)
$$;
-- The same answer read under share locks (the BoM Tech row, then the account): removing a BoM Tech waits for the decision that relied on them.
CREATE OR REPLACE FUNCTION public.tech_bom_standing(lock_rows boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF lock_rows THEN
  PERFORM b.id FROM identity.tech_bom b JOIN identity.users u ON u.id=b.user_id AND u.tenant_id=b.tenant_id
   WHERE b.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND b.user_id=nullif(current_setting('app.person_id',true),'')::uuid
   FOR SHARE OF b,u;
 END IF;
 RETURN public.app_actor_is_tech_bom();
END $$;
-- Who of the candidates may perform work in any project of the tenant: an active, activated Team Tech member (roster) or BoM Tech. The id and the account name only.
CREATE OR REPLACE FUNCTION public.tech_performers_among(candidates uuid[], lock_rows boolean DEFAULT false) RETURNS TABLE(user_id uuid, name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF lock_rows THEN
  PERFORM u.id FROM identity.users u WHERE u.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND u.id=ANY(candidates) ORDER BY u.id FOR SHARE OF u;
  PERFORM r.id FROM identity.tech_roster r WHERE r.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND r.user_id=ANY(candidates) ORDER BY r.id FOR SHARE OF r;
  PERFORM b.id FROM identity.tech_bom b WHERE b.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND b.user_id=ANY(candidates) ORDER BY b.id FOR SHARE OF b;
 END IF;
 RETURN QUERY
 SELECT u.id,u.name FROM identity.users u
 WHERE u.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND u.id=ANY(candidates)
  AND u.active AND u.password_hash IS NOT NULL
  AND (EXISTS (SELECT 1 FROM identity.tech_roster r WHERE r.tenant_id=u.tenant_id AND r.user_id=u.id)
   OR EXISTS (SELECT 1 FROM identity.tech_bom b WHERE b.tenant_id=u.tenant_id AND b.user_id=u.id))
 ORDER BY u.name,u.id;
END $$;
-- The same people found by their exact account name (the import maps the owner cell of a sheet row to a person).
CREATE OR REPLACE FUNCTION public.tech_performers_named(texts text[]) RETURNS TABLE(user_id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id,u.name FROM identity.users u
 WHERE u.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND u.name=ANY(texts)
  AND u.active AND u.password_hash IS NOT NULL
  AND (EXISTS (SELECT 1 FROM identity.tech_roster r WHERE r.tenant_id=u.tenant_id AND r.user_id=u.id)
   OR EXISTS (SELECT 1 FROM identity.tech_bom b WHERE b.tenant_id=u.tenant_id AND b.user_id=u.id))
 ORDER BY u.name,u.id
$$;
-- The project list (id, name, BU) for a Team Tech member or a BoM Tech: every project of the tenant. Empty for anybody else.
CREATE OR REPLACE FUNCTION public.tech_project_catalog() RETURNS TABLE(id uuid, name text, bu text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p.id,p.name,p.bu FROM public.projects p
 WHERE p.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND (public.app_actor_is_tech_member() OR public.app_actor_is_tech_bom())
 ORDER BY p.name,p.id
$$;
-- The actor is one of the three seats of an enabled scope of the project, an active, activated member of it who holds it in scope. No Telegram link is asked for:
-- the web decision does not need one (M5). The 3/3 ballot (bom.ts) keeps its own seat conditions, Telegram included.
CREATE OR REPLACE FUNCTION public.work_request_project_seat(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM public.bom_scopes s
   JOIN identity.memberships m ON m.tenant_id=s.tenant_id AND m.project_id=s.project_id
   JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
  WHERE s.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND s.project_id=target_project AND s.enabled
   AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
   AND u.id=nullif(current_setting('app.person_id',true),'')::uuid AND u.id=ANY(s.seat_ids)
   AND u.active AND u.password_hash IS NOT NULL)
$$;
-- The actor may decide a request of the project: a BoM Tech (any project of the tenant), or a seat of the project as above. This answers for the request only: the
-- scope of a BoM Tech is not widened by it (their other reads stay those of their memberships; the decision itself adds the one project it writes in).
CREATE OR REPLACE FUNCTION public.work_request_seat(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=target_project AND p.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  AND (public.app_actor_is_tech_bom() OR public.work_request_project_seat(target_project))
$$;
-- Linking a message to existing work stays where it was (025): a member other than viewer, or a seat of the project. Being a BoM Tech adds nothing here.
CREATE OR REPLACE FUNCTION public.intake_link_allowed(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
   WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND m.project_id=target_project
    AND m.user_id=nullif(current_setting('app.person_id',true),'')::uuid AND m.project_role<>'viewer' AND u.active AND u.password_hash IS NOT NULL)
  OR public.work_request_project_seat(target_project)
$$;
-- The actor may file a request in the project (024), where a BoM Tech now counts as a member of Team Tech: one who is not on the roster files too (M6). The
-- manager branch is the 024 one, unchanged.
CREATE OR REPLACE FUNCTION public.work_request_filer(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=target_project AND p.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  AND (public.app_actor_is_tech_member() OR public.app_actor_is_tech_bom()
   OR EXISTS (SELECT 1 FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
    WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND m.project_id=target_project
     AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
     AND u.id=nullif(current_setting('app.person_id',true),'')::uuid
     AND u.active AND u.password_hash IS NOT NULL AND coalesce(m.project_role,u.role)='manager'))
$$;
DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['public.app_actor_is_tech_bom()','public.tech_bom_standing(boolean)','public.tech_performers_among(uuid[],boolean)',
   'public.tech_performers_named(text[])','public.tech_project_catalog()','public.work_request_project_seat(uuid)','public.work_request_seat(uuid)',
   'public.intake_link_allowed(uuid)','public.work_request_filer(uuid)'] LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO libetech_identity',f);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO libetech_runtime',f);
 END LOOP;
END $$;
-- A request is read and decided where work_request_seat answers yes: the seat branch already asks for the project in scope, the BoM Tech branch is the tenant.
-- (024 also asked for the project in scope outside the function, which a BoM Tech holding no membership would never meet.)
ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_read ON work_requests;
CREATE POLICY request_read ON work_requests FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND (requester_id=nullif(current_setting('app.person_id',true),'')::uuid
   OR decided_by=nullif(current_setting('app.person_id',true),'')::uuid
   OR public.work_request_seat(project_id)));
DROP POLICY IF EXISTS request_decide ON work_requests;
CREATE POLICY request_decide ON work_requests FOR UPDATE TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.work_request_seat(project_id))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.work_request_seat(project_id));

CREATE TABLE IF NOT EXISTS work_access_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL, work_id uuid NOT NULL,
 user_id uuid NOT NULL,
 source_kind text NOT NULL CHECK (source_kind IN ('work_request','bom_allocation','revise')),
 source_id uuid NOT NULL,
 granted_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (work_id,tenant_id,project_id) REFERENCES work_items(id,tenant_id,project_id),
 FOREIGN KEY (user_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 UNIQUE (work_id,user_id,source_kind,source_id)
);
CREATE INDEX IF NOT EXISTS work_access_grants_user_idx ON work_access_grants(tenant_id,user_id,project_id);
CREATE INDEX IF NOT EXISTS work_access_grants_work_idx ON work_access_grants(work_id);
CREATE INDEX IF NOT EXISTS work_access_grants_created_idx ON work_access_grants(created_at);
DROP TRIGGER IF EXISTS immutable_history ON work_access_grants;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON work_access_grants
 FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
-- A grant is written by the person who gave the work, in the transaction that gave it (the decision, receipt or revision carries this transaction's now()), to a
-- Team Tech member who now holds it, never to the granter:
-- · work_request: the approved request created this work, its decider is the granter, and the member is the assignee;
-- · bom_allocation: the 3/3 receipt of this proposal exists, the granter voted on it, and the member is the lead or a part owner it names;
-- · revise: the granter opened this revision of this work (audit row), and the member is the assignee.
CREATE OR REPLACE FUNCTION public.work_access_grants_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.granted_by IS DISTINCT FROM nullif(current_setting('app.person_id',true),'')::uuid THEN
  RAISE EXCEPTION 'A work access grant is written by the person who gives the work.';
 END IF;
 IF NEW.user_id=NEW.granted_by THEN
  RAISE EXCEPTION 'Nobody grants themselves access to a project.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.tech_performers_among(ARRAY[NEW.user_id]) t) THEN
  RAISE EXCEPTION 'A work access grant goes to a Team Tech member only.';
 END IF;
 IF NOT (
  (NEW.source_kind='work_request' AND EXISTS (SELECT 1 FROM public.work_requests r JOIN public.work_items w ON w.id=r.work_id
    WHERE r.id=NEW.source_id AND r.work_id=NEW.work_id AND r.tenant_id=NEW.tenant_id AND r.project_id=NEW.project_id AND r.state='approved'
     AND r.decided_by=NEW.granted_by AND r.decided_at=now() AND w.assignee_id=NEW.user_id))
  OR (NEW.source_kind='bom_allocation' AND EXISTS (SELECT 1 FROM public.bom_proposals b JOIN public.bom_receipts rc ON rc.proposal_id=b.id
    WHERE b.id=NEW.source_id AND b.work_id=NEW.work_id AND b.tenant_id=NEW.tenant_id AND b.project_id=NEW.project_id AND rc.created_at=now()
     AND EXISTS (SELECT 1 FROM public.bom_votes v WHERE v.proposal_id=b.id AND v.voter_id=NEW.granted_by)
     AND (b.proposed_assignment->>'lead_id'=NEW.user_id::text
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(b.proposed_assignment->'parts','[]'::jsonb)) part WHERE part->>'owner_id'=NEW.user_id::text))))
  OR (NEW.source_kind='revise' AND EXISTS (SELECT 1 FROM public.audit_events a JOIN public.work_items w ON w.id=a.work_id
    WHERE a.id=NEW.source_id AND a.work_id=NEW.work_id AND a.tenant_id=NEW.tenant_id AND a.project_id=NEW.project_id AND a.kind='revise'
     AND a.actor_id=NEW.granted_by AND a.created_at=now() AND w.assignee_id=NEW.user_id))
 ) THEN
  RAISE EXCEPTION 'A work access grant points at the decision that gave this work to this member.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS work_access_grants_guard ON work_access_grants;
CREATE TRIGGER work_access_grants_guard BEFORE INSERT ON work_access_grants FOR EACH ROW EXECUTE FUNCTION public.work_access_grants_guard();
-- Read: the projects in the actor's scope, and the member's own rows. Write: only as the granter, in a project of the actor's scope. The sign-in (libetech_identity)
-- reads the project and the member of each row of the tenant. No context, no rows.
ALTER TABLE work_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_access_grants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS grant_read ON work_access_grants;
CREATE POLICY grant_read ON work_access_grants FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND (project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
   OR user_id=nullif(current_setting('app.person_id',true),'')::uuid));
DROP POLICY IF EXISTS grant_write ON work_access_grants;
CREATE POLICY grant_write ON work_access_grants FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
  AND granted_by=nullif(current_setting('app.person_id',true),'')::uuid);
DROP POLICY IF EXISTS identity_grant_read ON work_access_grants;
CREATE POLICY identity_grant_read ON work_access_grants FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT, INSERT ON work_access_grants TO libetech_runtime;
GRANT SELECT (tenant_id,project_id,work_id,user_id) ON work_access_grants TO libetech_identity;
-- A grant counts at sign-in only while its member still holds the work: the assignee, or a part owner of the latest applied 3/3 receipt (the parts the work
-- service lets act). The sign-in reads those few columns, of work items that carry a grant, and nothing else of them.
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items FORCE ROW LEVEL SECURITY;
ALTER TABLE bom_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE bom_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_proposals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS identity_live_grant ON work_items;
CREATE POLICY identity_live_grant ON work_items FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND EXISTS (SELECT 1 FROM work_access_grants g WHERE g.work_id=work_items.id));
DROP POLICY IF EXISTS identity_live_grant ON bom_receipts;
CREATE POLICY identity_live_grant ON bom_receipts FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND EXISTS (SELECT 1 FROM work_access_grants g WHERE g.work_id=bom_receipts.work_id));
DROP POLICY IF EXISTS identity_live_grant ON bom_proposals;
CREATE POLICY identity_live_grant ON bom_proposals FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND EXISTS (SELECT 1 FROM work_access_grants g WHERE g.work_id=bom_proposals.work_id));
GRANT SELECT (id,tenant_id,assignee_id) ON work_items TO libetech_identity;
GRANT SELECT (tenant_id,proposal_id,work_id,work_version) ON bom_receipts TO libetech_identity;
GRANT SELECT (id,tenant_id,work_id,proposed_assignment) ON bom_proposals TO libetech_identity;

-- The source row of work created from an approved request: written by the runtime in the approving transaction (or by the backfill below), it names that request
-- and its hash and never expires. It never changes or goes away. The runtime writes no other source row: those stay the operator's importer's.
CREATE OR REPLACE FUNCTION public.bom_sources_request_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF starts_with(NEW.source_ref,'work_request:') THEN
   IF NEW.valid_until<>'infinity'::timestamptz OR NOT EXISTS (SELECT 1 FROM public.work_requests r
     WHERE r.work_id=NEW.work_id AND r.tenant_id=NEW.tenant_id AND r.project_id=NEW.project_id AND r.state='approved'
      AND NEW.source_ref='work_request:'||r.id::text AND r.request_hash=NEW.fingerprint) THEN
    RAISE EXCEPTION 'A source row of a work request names that approved request and its hash.';
   END IF;
  -- the runtime role, or any login that holds its privileges without SET ROLE; the operator (a superuser) is not one of them
  ELSIF pg_has_role(current_user,'libetech_runtime','USAGE') AND NOT (SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname=current_user) THEN
   RAISE EXCEPTION 'The runtime writes only the source row of an approved work request.';
  END IF;
  RETURN NEW;
 END IF;
 IF starts_with(OLD.source_ref,'work_request:') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'The source row of a work request does not go away.'; END IF;
  IF (NEW.work_id,NEW.tenant_id,NEW.project_id,NEW.source_ref,NEW.fingerprint,NEW.checked_at,NEW.valid_until)
     IS DISTINCT FROM (OLD.work_id,OLD.tenant_id,OLD.project_id,OLD.source_ref,OLD.fingerprint,OLD.checked_at,OLD.valid_until) THEN
   RAISE EXCEPTION 'The source row of a work request does not change.';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS bom_sources_request_guard ON bom_sources;
CREATE TRIGGER bom_sources_request_guard BEFORE INSERT OR UPDATE OR DELETE ON bom_sources FOR EACH ROW EXECUTE FUNCTION public.bom_sources_request_guard();
GRANT INSERT ON bom_sources TO libetech_runtime;
-- work approved under 0.9.1 gets its source row now (the trigger above checks each one)
INSERT INTO bom_sources(work_id,tenant_id,project_id,source_ref,fingerprint,checked_at,valid_until)
SELECT r.work_id,r.tenant_id,r.project_id,'work_request:'||r.id::text,r.request_hash,least(r.decided_at,now()),'infinity'
FROM work_requests r WHERE r.state='approved' AND r.work_id IS NOT NULL
ON CONFLICT (work_id) DO NOTHING;

-- OQ-62 câu 6: the file the PM chose at preview, by name, next to the hash (file_hash) and the time (created_at) already recorded
ALTER TABLE work_import_batches ADD COLUMN IF NOT EXISTS file_name text CHECK (file_name IS NULL OR length(file_name) BETWEEN 1 AND 255);

INSERT INTO schema_migrations(version) VALUES ('028') ON CONFLICT(version) DO NOTHING;
COMMIT;
