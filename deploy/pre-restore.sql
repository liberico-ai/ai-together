-- The step that comes BEFORE every restore of an AI OS database (N4 of docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md; docs/RUNBOOK-RESTORE-AFTER-023.md): the target
-- is a database that has the migrations of the bundle and no data. A restore with triggers off loads rows beside whatever is there without a guard to say so (a repeated run after a
-- load that stopped halfway, a database that is already serving): this file stops that before anything is loaded.
--   psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -d <database> -f deploy/pre-restore.sql
-- Exit 0 means every table of the application schemas is empty (public.schema_migrations aside: the migrations record themselves there). Pure SQL, one DO block, no lock, nothing is
-- written. A refusal has a fixed code and a count: PRE-RESTORE-01 (not a superuser: the load needs one), PRE-RESTORE-02 (tables that hold rows), PRE-RESTORE-99 (anything else).
DO $pre_restore$
DECLARE t record; filled integer := 0; any_row boolean;
BEGIN
  PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
  BEGIN
    IF pg_catalog.current_setting('is_superuser') <> 'on' THEN
      RAISE EXCEPTION 'PRE-RESTORE-01 the load disables triggers and needs a superuser; run this file as one';
    END IF;
    FOR t IN
      SELECT s.nspname AS schema_name, c.relname AS table_name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace s ON s.oid = c.relnamespace
       WHERE c.relkind IN ('r','p') AND NOT c.relispartition AND s.nspname NOT LIKE 'pg\_%' AND s.nspname <> 'information_schema'
         AND NOT (s.nspname = 'public' AND c.relname = 'schema_migrations')
    LOOP
      EXECUTE pg_catalog.format('SELECT EXISTS (SELECT 1 FROM %I.%I)', t.schema_name, t.table_name) INTO any_row;
      IF any_row THEN filled := filled + 1; END IF;
    END LOOP;
    IF filled > 0 THEN
      RAISE EXCEPTION 'PRE-RESTORE-02 % table(s) of the target already hold rows; load into a database that is new and has only the migrations applied', filled;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'PRE-RESTORE-%' THEN
      RAISE;
    ELSE
      RAISE EXCEPTION 'PRE-RESTORE-99 unexpected error (SQLSTATE %)', SQLSTATE;
    END IF;
  END;
END
$pre_restore$;
