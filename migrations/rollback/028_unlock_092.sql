-- Rollback of 028 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Refuses while a later migration is recorded, while a BoM Tech row or a work access grant exists, while a batch carries a file name, and while a 3/3 ballot names
-- the source row of a request: those rows are history (who was BoM Tech, who was given which work by whom, which file was imported, which ballot relied on which
-- source) and this file does not delete history. The source rows of approved requests are pointers the forward file derives again from work_requests; they go,
-- and only they: a row with the same prefix that no approved request derives refuses the file, and stays.
-- It restores the 024 bodies of work_request_seat, tech_project_catalog and work_request_filer, the 024 request policies and the 025 body of intake_link_allowed.
-- No CASCADE.
-- It runs again once 028 is gone (a second run), and after 024, 025 or 027 is gone.
BEGIN;
-- A login that row level security binds would count 0 rows and drop history: with row_security off it errors instead.
SET LOCAL row_security = off;
DO $$ DECLARE n bigint; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '028') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 028.';
  END IF;
  IF to_regclass('identity.tech_bom') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM identity.tech_bom' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'identity.tech_bom holds rows: remove them as the operator first (each removal is recorded).'; END IF;
  END IF;
  IF to_regclass('public.work_access_grants') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.work_access_grants' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'work_access_grants holds rows: 028 only goes forward once work was given with a grant.'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_import_batches' AND column_name='file_name') THEN
    EXECUTE 'SELECT count(*) FROM public.work_import_batches WHERE file_name IS NOT NULL' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'work_import_batches holds a file name: 028 only goes forward once a named file was imported.'; END IF;
  END IF;
  IF to_regclass('public.bom_proposals') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) FROM public.bom_proposals WHERE starts_with(source_ref,'work_request:')$q$ INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'bom_proposals names the source row of a work request: 028 only goes forward once such a ballot exists.'; END IF;
  END IF;
  -- a source row with the prefix that no approved request derives is not this file's to delete (one loaded with the triggers off, say by a restore)
  IF to_regclass('public.bom_sources') IS NOT NULL THEN
    IF to_regclass('public.work_requests') IS NOT NULL THEN
      EXECUTE $q$SELECT count(*) FROM public.bom_sources s WHERE starts_with(s.source_ref,'work_request:') AND NOT EXISTS (SELECT 1 FROM public.work_requests r
        WHERE r.work_id=s.work_id AND r.tenant_id=s.tenant_id AND r.project_id=s.project_id AND r.state='approved'
         AND s.source_ref='work_request:'||r.id::text AND r.request_hash=s.fingerprint AND s.valid_until='infinity'::timestamptz)$q$ INTO n;
    ELSE
      EXECUTE $q$SELECT count(*) FROM public.bom_sources WHERE starts_with(source_ref,'work_request:')$q$ INTO n;
    END IF;
    IF n > 0 THEN RAISE EXCEPTION 'bom_sources holds a source named work_request:… that no approved request derives: this file deletes only the rows it can derive again. Rename or remove that row as the operator first.'; END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS bom_sources_request_guard ON bom_sources;
-- only the rows derived from an approved request (the check above refused any other row with the prefix)
DO $$ BEGIN
  IF to_regclass('public.work_requests') IS NOT NULL THEN
    EXECUTE $q$DELETE FROM public.bom_sources s USING public.work_requests r
      WHERE starts_with(s.source_ref,'work_request:') AND r.work_id=s.work_id AND r.tenant_id=s.tenant_id AND r.project_id=s.project_id AND r.state='approved'
       AND s.source_ref='work_request:'||r.id::text AND r.request_hash=s.fingerprint AND s.valid_until='infinity'::timestamptz$q$;
  END IF;
END $$;
REVOKE INSERT ON bom_sources FROM libetech_runtime;
DROP FUNCTION IF EXISTS public.bom_sources_request_guard();

-- the sign-in's read of live grants goes first: these policies name work_access_grants
DROP POLICY IF EXISTS identity_live_grant ON work_items;
DROP POLICY IF EXISTS identity_live_grant ON bom_receipts;
DROP POLICY IF EXISTS identity_live_grant ON bom_proposals;
REVOKE SELECT (id,tenant_id,assignee_id) ON work_items FROM libetech_identity;
REVOKE SELECT (tenant_id,proposal_id,work_id,work_version) ON bom_receipts FROM libetech_identity;
REVOKE SELECT (id,tenant_id,work_id,proposed_assignment) ON bom_proposals FROM libetech_identity;
DROP TABLE IF EXISTS work_access_grants;
DROP FUNCTION IF EXISTS public.work_access_grants_guard();

-- the 024 and 025 bodies, only where that migration still stands (CREATE OR REPLACE keeps the owner and the grants)
DO $$ BEGIN
  IF to_regprocedure('public.work_request_seat(uuid)') IS NOT NULL THEN
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.work_request_seat(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT EXISTS (SELECT 1 FROM public.bom_scopes s
   JOIN identity.memberships m ON m.tenant_id=s.tenant_id AND m.project_id=s.project_id
   JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
   JOIN identity.telegram_links l ON l.tenant_id=u.tenant_id AND l.user_id=u.id
  WHERE s.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND s.project_id=target_project AND s.enabled
   AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
   AND u.id=nullif(current_setting('app.person_id',true),'')::uuid AND u.id=ANY(s.seat_ids)
   AND u.active AND u.password_hash IS NOT NULL)
$b$ $f$;
  END IF;
  IF to_regprocedure('public.tech_project_catalog()') IS NOT NULL THEN
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.tech_project_catalog() RETURNS TABLE(id uuid, name text, bu text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT p.id,p.name,p.bu FROM public.projects p
 WHERE p.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.app_actor_is_tech_member()
 ORDER BY p.name,p.id
$b$ $f$;
  END IF;
  IF to_regprocedure('public.work_request_filer(uuid)') IS NOT NULL THEN
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.work_request_filer(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=target_project AND p.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  AND (public.app_actor_is_tech_member()
   OR EXISTS (SELECT 1 FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
    WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND m.project_id=target_project
     AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
     AND u.id=nullif(current_setting('app.person_id',true),'')::uuid
     AND u.active AND u.password_hash IS NOT NULL AND coalesce(m.project_role,u.role)='manager'))
$b$ $f$;
  END IF;
  IF to_regprocedure('public.intake_link_allowed(uuid)') IS NOT NULL THEN
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.intake_link_allowed(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT EXISTS (SELECT 1 FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
   WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND m.project_id=target_project
    AND m.user_id=nullif(current_setting('app.person_id',true),'')::uuid AND m.project_role<>'viewer' AND u.active AND u.password_hash IS NOT NULL)
  OR public.work_request_seat(target_project)
$b$ $f$;
  END IF;
  -- the 024 request policies: a seat decides only a project of the actor's scope, asked outside the function too
  IF to_regclass('public.work_requests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE work_requests FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS request_read ON work_requests';
    EXECUTE $p$CREATE POLICY request_read ON work_requests FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND (requester_id=nullif(current_setting('app.person_id',true),'')::uuid
   OR decided_by=nullif(current_setting('app.person_id',true),'')::uuid
   OR (project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
    AND public.work_request_seat(project_id))))$p$;
    EXECUTE 'DROP POLICY IF EXISTS request_decide ON work_requests';
    EXECUTE $p$CREATE POLICY request_decide ON work_requests FOR UPDATE TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
  AND public.work_request_seat(project_id))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
  AND public.work_request_seat(project_id))$p$;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.work_request_project_seat(uuid);
DROP FUNCTION IF EXISTS public.tech_performers_named(text[]);
DROP FUNCTION IF EXISTS public.tech_performers_among(uuid[], boolean);
DROP FUNCTION IF EXISTS public.tech_bom_standing(boolean);
DROP FUNCTION IF EXISTS public.app_actor_is_tech_bom();

DROP TABLE IF EXISTS identity.tech_bom;
DROP FUNCTION IF EXISTS identity.tech_bom_record_event();
DO $$ BEGIN
  IF to_regclass('identity.tech_roster') IS NOT NULL THEN EXECUTE 'REVOKE UPDATE (updated_at) ON identity.tech_roster FROM libetech_identity'; END IF;
END $$;

ALTER TABLE IF EXISTS work_import_batches DROP COLUMN IF EXISTS file_name;

DELETE FROM schema_migrations WHERE version='028';
COMMIT;
