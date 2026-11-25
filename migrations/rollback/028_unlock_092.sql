-- Rollback of 028 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Refuses while a later migration is recorded, while a BoM Tech row or a work access grant exists, while a batch carries a file name, and while a 3/3 ballot names
-- the source row of a request: those rows are history (who was BoM Tech, who was given which work by whom, which file was imported, which ballot relied on which
-- source) and this file does not delete history. The source rows of approved requests are pointers the forward file derives again from work_requests; they go.
-- It restores the 024 bodies of work_request_seat and tech_project_catalog. No CASCADE. It runs again once 028 is gone (a second run), and after 024 or 027 is gone.
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
    EXECUTE $q$SELECT count(*) FROM public.bom_proposals WHERE source_ref LIKE 'work_request:%'$q$ INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'bom_proposals names the source row of a work request: 028 only goes forward once such a ballot exists.'; END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS bom_sources_request_guard ON bom_sources;
DELETE FROM bom_sources WHERE source_ref LIKE 'work_request:%';
REVOKE INSERT ON bom_sources FROM libetech_runtime;
DROP FUNCTION IF EXISTS public.bom_sources_request_guard();

DROP TABLE IF EXISTS work_access_grants;
DROP FUNCTION IF EXISTS public.work_access_grants_guard();

-- the 024 bodies, only where 024 still stands (CREATE OR REPLACE keeps the owner and the grants)
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
END $$;
DROP FUNCTION IF EXISTS public.tech_performers_named(text[]);
DROP FUNCTION IF EXISTS public.tech_performers_among(uuid[], boolean);
DROP FUNCTION IF EXISTS public.tech_bom_projects();
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
