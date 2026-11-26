-- Rollback of 029 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Gives the held IBS HI notes back to analytics.tech_source_tasks, then drops what 029 made. Refuses while a later migration is recorded, and whenever giving
-- the notes back would lose text: a held note whose source row is gone, a row that now holds another text, or a row with two held texts. It runs again once
-- 029 is gone.
-- No CASCADE.
BEGIN;
-- A login that row level security binds would see 0 held rows and drop them: with row_security off it errors instead.
SET LOCAL row_security = off;
DO $$ DECLARE n bigint; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '029') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 029.';
  END IF;
  IF to_regclass('analytics.tech_source_notes_held') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) FROM analytics.tech_source_notes_held k WHERE NOT EXISTS (SELECT 1 FROM analytics.tech_source_tasks t
      WHERE t.tenant_id=k.tenant_id AND t.project_id=k.project_id AND t.source_id=k.source_id AND t.source_row=k.source_row AND t.source_note IN ('',k.source_note))
     OR EXISTS (SELECT 1 FROM analytics.tech_source_notes_held o WHERE o.tenant_id=k.tenant_id AND o.source_id=k.source_id AND o.source_row=k.source_row AND o.id<>k.id)$q$ INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Rolling back 029 would lose % held note(s): their source row is gone or holds another text, or the row has two held texts. Reconcile them as the operator first.', n; END IF;
  END IF;
END $$;

-- the guards go first: giving the notes back writes IBS HI text again
DROP TRIGGER IF EXISTS tech_source_tasks_guard ON analytics.tech_source_tasks;
DROP TRIGGER IF EXISTS tech_source_hold_on_mapping ON public.project_domain_mappings;
DROP TRIGGER IF EXISTS tech_source_hold_on_project ON public.projects;
DROP FUNCTION IF EXISTS public.tech_source_hold_on_project();
DROP FUNCTION IF EXISTS public.tech_source_tasks_guard();
DROP FUNCTION IF EXISTS public.tech_source_hold_on_mapping();
DROP FUNCTION IF EXISTS public.tech_source_hold_notes(uuid,uuid);
DROP FUNCTION IF EXISTS public.tech_source_project_is_ibs(uuid,uuid);

DO $$ BEGIN
  IF to_regclass('analytics.tech_source_notes_held') IS NOT NULL THEN
    EXECUTE $q$UPDATE analytics.tech_source_tasks t SET source_note=k.source_note, updated_at=now() FROM analytics.tech_source_notes_held k
      WHERE t.tenant_id=k.tenant_id AND t.project_id=k.project_id AND t.source_id=k.source_id AND t.source_row=k.source_row$q$;
  END IF;
END $$;
DROP TABLE IF EXISTS analytics.tech_source_notes_held;

DELETE FROM schema_migrations WHERE version='029';
COMMIT;
