-- 032 — Every SECURITY DEFINER function of the application schemas names the temporary schema last in its search path, so that every name such a function
-- uses resolves in the schemas it trusts first. 031 already does this for its own functions; this file does it for the ones created before it.
-- Only the search path changes: bodies, owners, grants and every other setting (row_security) stay.
-- Idempotent. Rollback: migrations/rollback/032_definer_search_path.sql (never on a serving database without Chairman approval).
-- A new SECURITY DEFINER function must end its search path with pg_temp: tests/definer-search-path.test.ts checks every one.
BEGIN;

ALTER FUNCTION public.app_actor_is_tech_bom() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.app_actor_is_tech_member() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.bom_eligible_members(uuid, uuid[], boolean) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.intake_link_allowed(uuid) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.intake_pool_links_outside(uuid, uuid, uuid[]) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.intake_pool_sender(text) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.tech_bom_standing(boolean) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.tech_performers_among(uuid[], boolean) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.tech_performers_named(text[]) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.tech_project_catalog() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.tech_roster_names() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.tech_source_project_is_ibs(uuid, uuid) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.work_import_key_conflicts(text, text, text[], text[], text[], text[]) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.work_import_project_facts(uuid) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.work_request_filer(uuid) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.work_request_project_seat(uuid) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.work_request_seat(uuid) SET search_path = pg_catalog, pg_temp;

-- Nothing may be left over, including a function made outside the migrations: this file stops, changing nothing, and names it. Pinned means the temporary
-- schema is named once, last: named earlier as well, it is searched at its first place. Only plain, unquoted, lower-case names are accepted, because a quoted
-- name keeps its case and may be an ordinary schema ("PG_TEMP" is not the temporary one): any other way of writing the path counts as not pinned.
DO $$ DECLARE left_open text; BEGIN
 SELECT string_agg(n.nspname||'.'||p.proname, ', ' ORDER BY n.nspname, p.proname) INTO left_open
   FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prosecdef AND n.nspname IN ('public','identity','analytics','intelligence')
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
    AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c
      WHERE c ~ '^search_path=([a-z_][a-z0-9_]* *, *)*pg_temp$' AND c !~ '(=|, *)pg_temp[a-z0-9_]* *,');
 IF left_open IS NOT NULL THEN
  RAISE EXCEPTION '032: privileged functions without the temporary schema last in their search path: %. Pin or remove them, then run 032 again.', left_open;
 END IF;
END $$;

INSERT INTO schema_migrations(version) VALUES('032') ON CONFLICT(version) DO NOTHING;
COMMIT;
