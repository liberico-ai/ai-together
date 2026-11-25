-- Rollback of 024 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Refuses while a later migration is recorded, and while any work request or roster row exists: those rows are history (who filed what, who approved
-- it, who was on Team Tech) and this file does not delete history. Work items created by an approval stay; only the request rows would point at them.
-- No CASCADE.
BEGIN;
-- The row counts are read with EXECUTE: the file must also run when the tables are already gone (a second run), and a static query on a missing table fails at planning.
DO $$ DECLARE n bigint; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '024') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 024.';
  END IF;
  IF to_regclass('public.work_requests') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.work_requests' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'work_requests holds rows: 024 only goes forward once a request was filed.'; END IF;
  END IF;
  IF to_regclass('identity.tech_roster') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM identity.tech_roster' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'identity.tech_roster holds rows: remove them with deploy/tech-roster.sql first (each removal is recorded).'; END IF;
  END IF;
END $$;
DROP TRIGGER IF EXISTS work_requests_guard ON work_requests;
DROP TRIGGER IF EXISTS work_requests_no_delete ON work_requests;
DROP FUNCTION IF EXISTS public.work_requests_guard();
DROP TABLE IF EXISTS work_request_events, work_requests;
DROP FUNCTION IF EXISTS public.tech_project_catalog();
DROP FUNCTION IF EXISTS public.work_request_seat(uuid);
DROP FUNCTION IF EXISTS public.work_request_filer(uuid);
DROP FUNCTION IF EXISTS public.app_actor_is_tech_member();
DROP POLICY IF EXISTS identity_seat_check ON public.bom_scopes;
REVOKE SELECT ON public.bom_scopes FROM libetech_identity;
REVOKE SELECT (bu) ON projects FROM libetech_identity;
DROP TRIGGER IF EXISTS tech_roster_event ON identity.tech_roster;
DROP FUNCTION IF EXISTS identity.tech_roster_record_event();
DROP TABLE IF EXISTS identity.tech_roster;
DELETE FROM schema_migrations WHERE version='024';
COMMIT;
