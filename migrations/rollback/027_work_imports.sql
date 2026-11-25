-- Rollback of 027 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Refuses while a later migration is recorded, and while either table holds rows: a batch and its key rows are history (who imported which file, which sheet row
-- became which request) and this file does not delete history. The work requests an import filed are not touched. No CASCADE.
-- It needs nothing from 025/026 and must also run when 027 is already gone (a second run): the row counts are read with EXECUTE because a static query on a missing
-- table fails at planning.
BEGIN;
-- A login that row level security binds would count 0 rows and drop history: with row_security off it errors instead.
SET LOCAL row_security = off;
DO $$ DECLARE n bigint; t text; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '027') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 027.';
  END IF;
  FOREACH t IN ARRAY ARRAY['public.work_import_rows','public.work_import_batches'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM ' || t INTO n;
      IF n > 0 THEN RAISE EXCEPTION '% holds rows: 027 only goes forward once an import was committed.', t; END IF;
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS work_import_rows_guard ON work_import_rows;
DROP TABLE IF EXISTS work_import_rows, work_import_batches;
DROP FUNCTION IF EXISTS public.work_import_rows_guard();
DROP FUNCTION IF EXISTS public.work_import_key_conflicts(text, text, text[], text[], text[], text[]);
DROP FUNCTION IF EXISTS public.work_import_project_facts(uuid);
DROP FUNCTION IF EXISTS public.work_import_is_ibs_text(text);
DROP POLICY IF EXISTS identity_ibs_check ON project_domain_mappings;
REVOKE SELECT (tenant_id,project_id,domain_code,mapping_version) ON project_domain_mappings FROM libetech_identity;
DELETE FROM schema_migrations WHERE version='027';
COMMIT;
