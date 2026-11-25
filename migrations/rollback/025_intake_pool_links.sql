-- Rollback of 025 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Refuses while a later migration is recorded, and while any pool item, pool event or link exists: those rows are history (what arrived, who triaged it,
-- what it was linked to) and this file does not delete history. No CASCADE.
BEGIN;
-- The row counts are read with EXECUTE: the file must also run when the tables are already gone (a second run), and a static query on a missing table fails at planning.
DO $$ DECLARE n bigint; t text; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '025') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 025.';
  END IF;
  FOREACH t IN ARRAY ARRAY['public.intake_work_links','public.intake_pool_events','public.intake_pool_items'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM ' || t INTO n;
      IF n > 0 THEN RAISE EXCEPTION '% holds rows: 025 only goes forward once a pool item or a link was written.', t; END IF;
    END IF;
  END LOOP;
END $$;
DROP TABLE IF EXISTS intake_work_links, intake_pool_events, intake_pool_items;
DROP FUNCTION IF EXISTS public.intake_work_links_bind();
DROP FUNCTION IF EXISTS public.intake_pool_items_guard();
DROP FUNCTION IF EXISTS public.intake_pool_sender(text);
DROP FUNCTION IF EXISTS public.intake_link_allowed(uuid);
DROP FUNCTION IF EXISTS public.tech_roster_names();
DROP FUNCTION IF EXISTS public.intake_pool_links_outside(uuid,uuid,uuid[]);
-- the counting function of an earlier build of 025, if a test copy still holds it
DROP FUNCTION IF EXISTS public.intake_pool_link_count(uuid,uuid);
DELETE FROM schema_migrations WHERE version='025';
COMMIT;
