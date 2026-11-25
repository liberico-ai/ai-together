-- 027 — Import of the PM's team work list: batch receipts and the import key rows (GIAO VIỆC 5, hạng mục C; Chairman 25/11/2026).
-- Additive and idempotent; it needs 024 (work_requests, app_actor_is_tech_member) and nothing from 025/026. Rollback: migrations/rollback/027_work_imports.sql
-- (never on a serving database without Chairman approval).
--
-- What it adds:
-- 1. public.work_import_batches (Z1): one row per committed import — who imported, which source, which file hash, the counts per sheet BU label (no key that
--    sums across labels), the label→project mapping and the per-row result (row number, STT, result, reason codes: never cell text). Append-only.
-- 2. public.work_import_rows (Z1): one row per imported sheet row, three UNIQUE keys — the STT over (tenant, source, sheet), the work code and the content hash over
--    (tenant, source, sheet, importer) — so a second import of the same file writes nothing new (INSERT … ON CONFLICT DO NOTHING), and an insert can only meet the STT
--    key of another importer (the declared disclosure below) or a key of its own. Carries the four source fields of AR-05 (source_id, ingested_at, source_type,
--    quality_score), the cells as written and the flags. Append-only.
-- 3. Two SECURITY DEFINER readers, owned by libetech_identity, callable by the runtime role and returning no person:
--    work_import_project_facts(project): the project's BU and latest reporting-domain code, for a project the actor holds a grant in or, as a Team Tech member, any project;
--    work_import_key_conflicts(...): for the submitted STT / code / hashes of one source and sheet, ONLY a conflict class per row. Against a key row the caller can read
--    (row_read: they imported it, or they hold a BoM seat of its project): DUPLICATE, CONTENT_UNDER_OTHER_STT, SOURCE_CHANGED, CODE_UNDER_OTHER_ROW. Against any other key
--    row: STT_IMPORTED for the same STT, whether the content matches or not, and nothing for a code or a content. It declares one disclosure: «this STT was already
--    imported in this source», whoever imported it. It returns no person, project, request or content (tests/sheet-import.test.ts; Codex gate round 1, P0).
-- 4. A trigger that refuses a note text on an IBS HI import row. It follows migration 022: owned by the migration login, row_security off, READ COMMITTED only, and the
--    project row is locked (FOR NO KEY UPDATE, the lock the mapping insert of 022 takes) before the latest mapping is read, so a mapping committing meanwhile is seen or waited for.
-- Every imported row is also an ordinary work_requests row (origin 'import', state 'pending') written by the import service in the same transaction.
BEGIN;

CREATE TABLE IF NOT EXISTS work_import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 importer_id uuid NOT NULL, importer_name text NOT NULL CHECK (length(importer_name) BETWEEN 1 AND 200),
 request_key uuid NOT NULL, preview_digest text NOT NULL CHECK (preview_digest ~ '^[a-f0-9]{64}$'), file_hash text NOT NULL CHECK (file_hash ~ '^[a-f0-9]{64}$'),
 source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 300), source_url text NOT NULL CHECK (length(source_url) BETWEEN 1 AND 1000),
 sheet text NOT NULL CHECK (length(sheet) BETWEEN 1 AND 100), source_type text NOT NULL DEFAULT 'google_sheet' CHECK (source_type='google_sheet'),
 ingested_at timestamptz NOT NULL DEFAULT now(),
 counts jsonb NOT NULL, mapping jsonb NOT NULL, mapping_hash text NOT NULL CHECK (mapping_hash ~ '^[a-f0-9]{64}$'), results jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,importer_id,request_key),
 UNIQUE (id,tenant_id,importer_id)
);
CREATE INDEX IF NOT EXISTS work_import_batches_importer_idx ON work_import_batches(tenant_id,importer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS work_import_batches_created_idx ON work_import_batches(created_at);

CREATE TABLE IF NOT EXISTS work_import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 importer_id uuid NOT NULL, batch_id uuid NOT NULL, request_id uuid NOT NULL,
 source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 300), sheet text NOT NULL CHECK (length(sheet) BETWEEN 1 AND 100),
 source_row integer NOT NULL CHECK (source_row>1), stt text NOT NULL CHECK (stt ~ '^[A-Za-z0-9._-]{1,40}$'),
 source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 500),
 code text CHECK (code IS NULL OR code ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
 fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'), content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
 bu_label text NOT NULL CHECK (length(bu_label) BETWEEN 1 AND 100),
 owner_raw text NOT NULL DEFAULT '' CHECK (length(owner_raw)<=2000), collaborators_raw text NOT NULL DEFAULT '' CHECK (length(collaborators_raw)<=2000),
 source_status text NOT NULL DEFAULT '' CHECK (length(source_status)<=2000), due_raw text NOT NULL DEFAULT '' CHECK (length(due_raw)<=2000),
 source_note text NOT NULL DEFAULT '' CHECK (length(source_note)<=2000),
 source_type text NOT NULL DEFAULT 'google_sheet' CHECK (source_type='google_sheet'), ingested_at timestamptz NOT NULL DEFAULT now(),
 flags text[] NOT NULL DEFAULT '{}', quality_score integer NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id),
 -- deferred: the key row is written before its request and its batch inside one transaction
 FOREIGN KEY (batch_id,tenant_id,importer_id) REFERENCES work_import_batches(id,tenant_id,importer_id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY (request_id,tenant_id,project_id) REFERENCES work_requests(id,tenant_id,project_id) DEFERRABLE INITIALLY DEFERRED,
 UNIQUE (request_id),
 CONSTRAINT work_import_key_stt UNIQUE (tenant_id,source_id,sheet,stt),
 -- per importer: a key another importer holds in a project the caller cannot read must not make an insert fail, or the insert would tell its code or content
 CONSTRAINT work_import_key_code UNIQUE (tenant_id,source_id,sheet,importer_id,code),
 CONSTRAINT work_import_key_content UNIQUE (tenant_id,source_id,sheet,importer_id,content_hash)
);
CREATE INDEX IF NOT EXISTS work_import_rows_project_idx ON work_import_rows(project_id,tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS work_import_rows_batch_idx ON work_import_rows(batch_id,tenant_id,importer_id);
CREATE INDEX IF NOT EXISTS work_import_rows_importer_idx ON work_import_rows(tenant_id,importer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS work_import_rows_created_idx ON work_import_rows(created_at);

DROP TRIGGER IF EXISTS immutable_history ON work_import_batches;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON work_import_batches FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_history ON work_import_rows;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON work_import_rows FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

-- The IBS HI test reads the project's BU and its latest reporting-domain mapping. libetech_identity reads them through two tenant-scoped policies.
GRANT SELECT (tenant_id,project_id,domain_code,mapping_version) ON project_domain_mappings TO libetech_identity;
DROP POLICY IF EXISTS identity_ibs_check ON project_domain_mappings;
CREATE POLICY identity_ibs_check ON project_domain_mappings FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

-- The IBS test of a text (a sheet BU label or a project BU): fail-closed, anything that contains «ibs» once normalised (NFKC, lower case, only letters and digits kept).
CREATE OR REPLACE FUNCTION public.work_import_is_ibs_text(label text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT position('ibs' in lower(regexp_replace(normalize(coalesce(label,''),NFKC),'[^[:alnum:]]','','g')))>0
$$;
-- What the service needs to name the reporting domain of a target project and to treat it as IBS HI: the BU and the latest confirmed domain code. Nothing else.
CREATE OR REPLACE FUNCTION public.work_import_project_facts(target_project uuid) RETURNS TABLE(bu text, domain_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p.bu,(SELECT m.domain_code FROM public.project_domain_mappings m WHERE m.tenant_id=p.tenant_id AND m.project_id=p.id ORDER BY m.mapping_version DESC LIMIT 1)
 FROM public.projects p
 WHERE p.id=target_project AND p.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND (public.app_actor_is_tech_member()
   OR target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
$$;
-- The conflict class of each submitted row against the keys held for one source and sheet of the tenant. The only answer is the class by row position; the order of
-- the checks is the order of the classes below. A key row is «readable» exactly when row_read below would show it to the caller (they imported it, or they hold a BoM
-- seat of its project): only a readable key row is compared by fingerprint, content or code. Any other key row answers STT_IMPORTED for its STT and nothing else.
GRANT SELECT (tenant_id,project_id,importer_id,source_id,sheet,stt,code,content_hash,fingerprint) ON work_import_rows TO libetech_identity;
DROP POLICY IF EXISTS identity_key_check ON work_import_rows;
CREATE POLICY identity_key_check ON work_import_rows FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE OR REPLACE FUNCTION public.work_import_key_conflicts(p_source text, p_sheet text, p_stt text[], p_code text[], p_content text[], p_fingerprint text[])
RETURNS TABLE(idx integer, class text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH t AS (SELECT nullif(current_setting('app.tenant_id',true),'')::uuid AS id, nullif(current_setting('app.person_id',true),'')::uuid AS person
   WHERE nullif(current_setting('app.person_id',true),'') IS NOT NULL),
  held AS (SELECT r.stt,r.code,r.content_hash,r.fingerprint,(r.importer_id=t.person OR public.work_request_seat(r.project_id)) AS readable
   FROM public.work_import_rows r JOIN t ON r.tenant_id=t.id WHERE r.source_id=p_source AND r.sheet=p_sheet)
 SELECT i.n::integer,
  CASE
   WHEN EXISTS (SELECT 1 FROM held h WHERE h.readable AND h.stt=i.stt AND h.fingerprint=i.fp) THEN 'DUPLICATE'
   WHEN EXISTS (SELECT 1 FROM held h WHERE h.readable AND h.content_hash=i.content) THEN 'CONTENT_UNDER_OTHER_STT'
   WHEN EXISTS (SELECT 1 FROM held h WHERE h.readable AND h.stt=i.stt) THEN 'SOURCE_CHANGED'
   WHEN EXISTS (SELECT 1 FROM held h WHERE NOT h.readable AND h.stt=i.stt) THEN 'STT_IMPORTED'
   WHEN i.code IS NOT NULL AND EXISTS (SELECT 1 FROM held h WHERE h.readable AND h.code=i.code) THEN 'CODE_UNDER_OTHER_ROW'
  END
 FROM t, unnest(p_stt,p_code,p_content,p_fingerprint) WITH ORDINALITY AS i(stt,code,content,fp,n)
 WHERE cardinality(p_stt)<=1000 AND nullif(i.stt,'') IS NOT NULL
$$;

-- AGENTS.md: IBS HI keeps pointers, hashes and Tech work metadata only. The free-text note of an IBS HI row is not stored (Chairman holding default 25/11/2026).
-- Mirrors migration 022 (ai_drafts_pointer_only_guard): owned by the migration login, row_security off, READ COMMITTED only, the project row locked before the latest
-- mapping is read, and no fail-open: a project row the statement cannot see refuses a row that carries a note.
CREATE OR REPLACE FUNCTION public.work_import_rows_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET row_security=off SET lock_timeout='5s' AS $$
DECLARE project_bu text; latest text;
BEGIN
 IF pg_catalog.current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'An import row is written in a READ COMMITTED transaction' USING ERRCODE='LTZ02';
 END IF;
 IF NEW.source_note<>'' THEN
  IF public.work_import_is_ibs_text(NEW.bu_label) THEN
   RAISE EXCEPTION 'An IBS HI import row holds no note text.' USING ERRCODE='LTZ01';
  END IF;
  -- a statement of its own, before the read: the read below then takes its snapshot after the wait and sees a mapping committed meanwhile
  PERFORM 1 FROM public.projects p WHERE p.id=NEW.project_id AND p.tenant_id=NEW.tenant_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'An import row with a note needs a project row this statement can see.' USING ERRCODE='23503';
  END IF;
  SELECT p.bu INTO project_bu FROM public.projects p WHERE p.id=NEW.project_id AND p.tenant_id=NEW.tenant_id;
  SELECT m.domain_code INTO latest FROM public.project_domain_mappings m WHERE m.tenant_id=NEW.tenant_id AND m.project_id=NEW.project_id ORDER BY m.mapping_version DESC LIMIT 1;
  IF public.work_import_is_ibs_text(project_bu) OR latest='IBS_HI' THEN
   RAISE EXCEPTION 'An IBS HI import row holds no note text.' USING ERRCODE='LTZ01';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS work_import_rows_guard ON work_import_rows;
CREATE TRIGGER work_import_rows_guard BEFORE INSERT ON work_import_rows FOR EACH ROW EXECUTE FUNCTION public.work_import_rows_guard();

DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['public.work_import_project_facts(uuid)','public.work_import_key_conflicts(text,text,text[],text[],text[],text[])'] LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO libetech_identity',f);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO libetech_runtime',f);
 END LOOP;
 REVOKE ALL ON FUNCTION public.work_import_rows_guard() FROM PUBLIC;
END $$;

-- Row level security. A batch is the importer's own, written only by somebody who may import (Team Tech, or a filer of some project in scope). A row is readable by its importer and by a BoM seat of its project (the same narrowing as the request it points at;
-- a seat sees «Trạng thái theo bảng nguồn» beside the request); it is written only by its importer, into a project work_request_filer allows (a Team Tech member: any project; a manager: that project), into one of their own batches
-- (the composite foreign key carries the importer). No context, no rows.
ALTER TABLE work_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_import_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE work_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_import_rows FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS batch_read ON work_import_batches;
CREATE POLICY batch_read ON work_import_batches FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND importer_id=nullif(current_setting('app.person_id',true),'')::uuid);
DROP POLICY IF EXISTS batch_write ON work_import_batches;
CREATE POLICY batch_write ON work_import_batches FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND importer_id=nullif(current_setting('app.person_id',true),'')::uuid
  -- only somebody who may import: a Team Tech member, or a person who may file into some project of their scope (work_request_filer). The bot, a viewer, an engineer: no
  -- batch, even when the statement runs straight under the runtime role (Codex gate round 1, P1)
  AND (public.app_actor_is_tech_member()
   OR EXISTS (SELECT 1 FROM unnest(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) AS g(project_id) WHERE public.work_request_filer(g.project_id))));
DROP POLICY IF EXISTS row_read ON work_import_rows;
CREATE POLICY row_read ON work_import_rows FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND (importer_id=nullif(current_setting('app.person_id',true),'')::uuid
   OR public.work_request_seat(project_id)));
DROP POLICY IF EXISTS row_write ON work_import_rows;
CREATE POLICY row_write ON work_import_rows FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND importer_id=nullif(current_setting('app.person_id',true),'')::uuid
  AND public.work_request_filer(project_id));

GRANT SELECT, INSERT ON work_import_batches TO libetech_runtime;
-- The runtime role reads every column of a key row EXCEPT source_note: the free-text note is written for LBRC / XECA rows and read by nobody here. A future reader of the note
-- must gate it at read time with public.work_import_is_ibs_text(bu_label) and the project's BU and latest mapping, and be granted the column by its own migration.
GRANT INSERT ON work_import_rows TO libetech_runtime;
GRANT SELECT (id,tenant_id,project_id,importer_id,batch_id,request_id,source_id,sheet,source_row,stt,source_ref,code,fingerprint,content_hash,bu_label,owner_raw,collaborators_raw,
 source_status,due_raw,source_type,ingested_at,flags,quality_score,created_at,updated_at) ON work_import_rows TO libetech_runtime;

INSERT INTO schema_migrations(version) VALUES ('027') ON CONFLICT(version) DO NOTHING;
COMMIT;
