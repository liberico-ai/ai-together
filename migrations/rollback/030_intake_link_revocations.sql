-- Rollback of 030 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Refuses while a later migration is recorded, and while a link revocation or its pool event exists: those rows are history and this file does not delete it.
-- It restores the 025 body of intake_pool_links_outside and the 025 kinds of intake_pool_events, then drops the table. It runs again once 030 is gone. No CASCADE.
BEGIN;
-- A login that row level security binds would count 0 rows and drop history: with row_security off it errors instead.
SET LOCAL row_security = off;
DO $$ DECLARE n bigint; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '030') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 030.';
  END IF;
  IF to_regclass('public.intake_link_revocations') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.intake_link_revocations' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'intake_link_revocations holds revocations: 030 only goes forward once a link was revoked.'; END IF;
  END IF;
  IF to_regclass('public.intake_pool_events') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) FROM public.intake_pool_events WHERE kind='pool.link_revoked'$q$ INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'intake_pool_events records a revocation: 030 only goes forward once a link was revoked.'; END IF;
  END IF;
END $$;

DO $$ DECLARE c text; BEGIN
  IF to_regprocedure('public.intake_pool_links_outside(uuid,uuid,uuid[])') IS NOT NULL THEN
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.intake_pool_links_outside(item uuid, target_project uuid, readable uuid[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $b$
 SELECT CASE WHEN public.app_actor_is_tech_member() THEN
  EXISTS (SELECT 1 FROM public.intake_work_links l
   WHERE l.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND l.pool_item_id=item AND l.project_id=target_project
    AND NOT coalesce(l.work_request_id = ANY(readable), false))
 END
$b$ $f$;
  END IF;
  IF to_regclass('public.intake_pool_events') IS NOT NULL THEN
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.intake_pool_events'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%pool.reopened%' LOOP
      EXECUTE format('ALTER TABLE public.intake_pool_events DROP CONSTRAINT %I',c);
    END LOOP;
    EXECUTE $q$ALTER TABLE public.intake_pool_events ADD CONSTRAINT intake_pool_events_kind_check
      CHECK (kind IN ('pool.received','pool.revised','pool.triaged','pool.request_filed','pool.work_linked','pool.dismissed','pool.reopened'))$q$;
  END IF;
  -- the column grant 030 added (the 025 grant lists the other columns)
  IF to_regclass('public.intake_work_links') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT (id) ON public.intake_work_links FROM libetech_identity';
  END IF;
END $$;
DROP TABLE IF EXISTS intake_link_revocations;

DELETE FROM schema_migrations WHERE version='030';
COMMIT;
