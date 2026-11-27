-- Rollback of 032 only. Throwaway test copy use; never run against a serving database without Chairman approval: it restores the earlier search paths.
-- Refuses while a later migration is recorded. Safe to run twice.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '032') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 032.';
  END IF;
END $$;

ALTER FUNCTION public.app_actor_is_tech_bom() SET search_path = pg_catalog;
ALTER FUNCTION public.app_actor_is_tech_member() SET search_path = pg_catalog;
ALTER FUNCTION public.bom_eligible_members(uuid, uuid[], boolean) SET search_path = pg_catalog;
ALTER FUNCTION public.intake_link_allowed(uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.intake_pool_links_outside(uuid, uuid, uuid[]) SET search_path = pg_catalog;
ALTER FUNCTION public.intake_pool_sender(text) SET search_path = pg_catalog;
ALTER FUNCTION public.tech_bom_standing(boolean) SET search_path = pg_catalog;
ALTER FUNCTION public.tech_performers_among(uuid[], boolean) SET search_path = pg_catalog;
ALTER FUNCTION public.tech_performers_named(text[]) SET search_path = pg_catalog;
ALTER FUNCTION public.tech_project_catalog() SET search_path = pg_catalog;
ALTER FUNCTION public.tech_roster_names() SET search_path = pg_catalog;
ALTER FUNCTION public.tech_source_project_is_ibs(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.work_import_key_conflicts(text, text, text[], text[], text[], text[]) SET search_path = pg_catalog;
ALTER FUNCTION public.work_import_project_facts(uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.work_request_filer(uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.work_request_project_seat(uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.work_request_seat(uuid) SET search_path = pg_catalog;

DELETE FROM schema_migrations WHERE version='032';
COMMIT;
