-- 029 · OQ-62 câu 4 (b), «che ghi chú IBS HI ở Z2» (phiên điều phối, uỷ quyền Chairman 25/11/2026 17:48; Chairman có thể đổi).
-- 1. The free-text note of an IBS HI row of analytics.tech_source_tasks (Z2, written by 0.7.0) is moved to analytics.tech_source_notes_held and the column
--    is emptied. «Che», not «xoá»: the text stays in the database for the operator. The held table has row level security with no policy and no grant:
--    no application role reads it, the web login, the projector and the identity role included.
-- 2. A row is IBS HI when its project's BU matches work_import_is_ibs_text (027) or its latest confirmed domain is IBS_HI. The same rule as the 027 guard.
-- 3. From now on such a row takes no note (LTZ01), and confirming a project as IBS_HI moves the notes it already has, in the same transaction.
--    Other columns (title, owner, collaborators, status, due) are Tech work metadata and stay (câu 4 (1)).
-- Rollback: migrations/rollback/029_mask_ibs_hi_source_notes.sql gives the text back; it refuses when giving it back would lose text.
BEGIN;
-- A login that row level security binds would move 0 rows and report success: with row_security off it errors instead.
SET LOCAL row_security = off;

CREATE TABLE IF NOT EXISTS analytics.tech_source_notes_held (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 source_id text NOT NULL, source_row integer NOT NULL, source_note text NOT NULL CHECK(source_note <> ''),
 held_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (project_id,tenant_id) REFERENCES public.projects(id,tenant_id),
 UNIQUE (tenant_id,source_id,source_row)
);
CREATE INDEX IF NOT EXISTS tech_source_notes_held_project_idx ON analytics.tech_source_notes_held(tenant_id,project_id,created_at);
ALTER TABLE analytics.tech_source_notes_held ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.tech_source_notes_held FORCE ROW LEVEL SECURITY;
-- No row for any role that row level security binds, even if one is granted the table later: only the operator's superuser login (and the definer below) reads it.
DROP POLICY IF EXISTS no_application_access ON analytics.tech_source_notes_held;
CREATE POLICY no_application_access ON analytics.tech_source_notes_held FOR ALL USING (false) WITH CHECK (false);
DO $$ DECLARE r text; BEGIN
 REVOKE ALL ON analytics.tech_source_notes_held FROM PUBLIC;
 FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname LIKE 'libetech\_%' LOOP
  EXECUTE format('REVOKE ALL ON analytics.tech_source_notes_held FROM %I', r);
 END LOOP;
END $$;

-- Whether a project is pointer-only for source text: the 027 rule.
CREATE OR REPLACE FUNCTION public.tech_source_project_is_ibs(target_tenant uuid, target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog SET row_security=off AS $$
 SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=target_project AND p.tenant_id=target_tenant
  AND (public.work_import_is_ibs_text(p.bu)
   OR (SELECT m.domain_code FROM public.project_domain_mappings m WHERE m.tenant_id=p.tenant_id AND m.project_id=p.id ORDER BY m.mapping_version DESC LIMIT 1)='IBS_HI'))
$$;

-- Moves the notes of one pointer-only project. A row whose key is already held with another text keeps its note: the caller decides what that means.
CREATE OR REPLACE FUNCTION public.tech_source_hold_notes(target_tenant uuid, target_project uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET row_security=off AS $$
BEGIN
 IF NOT public.tech_source_project_is_ibs(target_tenant,target_project) THEN RETURN; END IF;
 INSERT INTO analytics.tech_source_notes_held(tenant_id,project_id,source_id,source_row,source_note)
  SELECT t.tenant_id,t.project_id,t.source_id,t.source_row,t.source_note FROM analytics.tech_source_tasks t
  WHERE t.tenant_id=target_tenant AND t.project_id=target_project AND t.source_note<>''
  ON CONFLICT(tenant_id,source_id,source_row) DO NOTHING;
 UPDATE analytics.tech_source_tasks t SET source_note='', updated_at=now() FROM analytics.tech_source_notes_held k
  WHERE t.tenant_id=target_tenant AND t.project_id=target_project AND t.source_note<>''
   AND k.tenant_id=t.tenant_id AND k.source_id=t.source_id AND k.source_row=t.source_row AND k.source_note=t.source_note;
END $$;

DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT DISTINCT tenant_id,project_id FROM analytics.tech_source_tasks WHERE source_note<>'' LOOP
  PERFORM public.tech_source_hold_notes(r.tenant_id,r.project_id);
 END LOOP;
 -- fail closed: nothing of 029 is kept if one pointer-only row still shows its note
 IF EXISTS (SELECT 1 FROM analytics.tech_source_tasks t WHERE t.source_note<>'' AND public.tech_source_project_is_ibs(t.tenant_id,t.project_id)) THEN
  RAISE EXCEPTION 'An IBS HI row still holds a note: its key is held with another text. Compare the two as the operator, then apply 029.';
 END IF;
END $$;

-- Mirrors the 027 guard (and 022): READ COMMITTED only, the project row locked before the latest mapping is read, no fail-open for a row it cannot see.
CREATE OR REPLACE FUNCTION public.tech_source_tasks_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET row_security=off SET lock_timeout='5s' AS $$
BEGIN
 IF NEW.source_note<>'' THEN
  IF pg_catalog.current_setting('transaction_isolation')<>'read committed' THEN
   RAISE EXCEPTION 'A source row with a note is written in a READ COMMITTED transaction' USING ERRCODE='LTZ02';
  END IF;
  PERFORM 1 FROM public.projects p WHERE p.id=NEW.project_id AND p.tenant_id=NEW.tenant_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'A source row with a note needs a project row this statement can see.' USING ERRCODE='23503';
  END IF;
  IF public.tech_source_project_is_ibs(NEW.tenant_id,NEW.project_id) THEN
   RAISE EXCEPTION 'An IBS HI source row holds no note text.' USING ERRCODE='LTZ01';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tech_source_tasks_guard ON analytics.tech_source_tasks;
CREATE TRIGGER tech_source_tasks_guard BEFORE INSERT OR UPDATE ON analytics.tech_source_tasks
 FOR EACH ROW EXECUTE FUNCTION public.tech_source_tasks_guard();

-- AFTER the mapping row: the 022 BEFORE trigger already holds the project row lock, the same order as the guard above.
CREATE OR REPLACE FUNCTION public.tech_source_hold_on_mapping() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF NEW.domain_code='IBS_HI' THEN
  PERFORM public.tech_source_hold_notes(NEW.tenant_id,NEW.project_id);
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tech_source_hold_on_mapping ON public.project_domain_mappings;
CREATE TRIGGER tech_source_hold_on_mapping AFTER INSERT ON public.project_domain_mappings
 FOR EACH ROW EXECUTE FUNCTION public.tech_source_hold_on_mapping();

-- only the triggers and the migration call these
REVOKE ALL ON FUNCTION public.tech_source_project_is_ibs(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tech_source_hold_notes(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tech_source_tasks_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tech_source_hold_on_mapping() FROM PUBLIC;

INSERT INTO schema_migrations(version) VALUES('029') ON CONFLICT(version) DO NOTHING;
COMMIT;
