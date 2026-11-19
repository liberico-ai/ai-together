-- OQ-53 point 3 (b), decided by the Chairman on 19/11/2026: a number per thread, given by the database when a revision of a message is stored and
-- readable after commit, and a confirmation of a draft that is compared with that number at the moment it is written. Two tables, two triggers, one column:
-- 1. public.intake_thread_heads: one counter row per thread (tenant, project, chat_id, thread_key); last_seq is the number of the last revision stored in it.
-- 2. public.source_revision_positions: one row per stored revision (UNIQUE(revision_id)), the number thread_seq of that revision in its thread.
-- 3. source_event_revisions_thread_position on public.source_event_revisions: AFTER INSERT ... FOR EACH ROW (SECURITY DEFINER, owned by the migration
--    login). It raises the counter of the thread of the new revision (INSERT ... ON CONFLICT ... DO UPDATE SET last_seq = last_seq + 1) and stores that
--    number. The row lock on the counter row is held to the end of the transaction that stores the revision, so the numbers of one thread follow the
--    order of commit and a snapshot that sees the revision numbered n sees every revision numbered less than n. AFTER, not BEFORE: a row that
--    ON CONFLICT DO NOTHING skips (a replayed revision) fires no trigger, so a replay takes no lock and burns no number; and row-level security answers
--    (WITH CHECK of intake_insert, 016) before the trigger runs, so a role outside the scope it declared never waits for the lock of a thread it may
--    not write. Neither table has a column or a policy that a writing role could use: no role writes them, only the function does.
-- 4. public.draft_decisions.subject_thread_seq (step 10): the number of the last revision of the thread of a candidate, as the service read it, which a person's
--    confirmation of a candidate draft carries. The check constraint draft_decisions_thread_seq_only_confirmed lets only a confirmation carry one, and a positive one.
--    The runtime role may insert the column (column-level INSERT, like the other columns of 021); no other role holds anything on it.
-- 5. draft_decisions_subject_order_guard on public.draft_decisions (step 11): AFTER INSERT ... FOR EACH ROW, SECURITY DEFINER with the settings of function 3. For a
--    confirmation of a candidate draft it locks the counter row of the thread of the candidate FOR NO KEY UPDATE, reads last_seq again and refuses (LTZ03) when it
--    differs from the position the row carries, or when the row carries none. A message that is being taken in when the confirmation is written holds that row until
--    it commits: the confirmation waits for it, reads the new number and is refused. A confirmation that holds the row first makes the intake wait for it. A
--    decision that is not a confirmation of a candidate draft carries no position (LTZ03 when it does). One code and one fixed sentence for every cause (the thread
--    moved on, no position, no such candidate, a position where none belongs): the answer names no id and no number and tells a caller nothing about a candidate it
--    cannot see. FOR NO KEY UPDATE, the strength of the counter update: FOR KEY SHARE does not conflict with it and closes neither direction; FOR SHARE lets
--    confirmations that overlap starve the intake (measurements 4 and 7). The trigger fires after the BEFORE triggers of 021 (draft_decisions_guard) and 022
--    (draft_decisions_pointer_only_guard) and after the WITH CHECK of runtime_insert (021): a decision about a draft outside the scope of the caller, or in the name
--    of another person, is refused before any lock on a thread is asked for. Lock order of a confirmation: project row (022), then the thread (here).
-- What the column proves, and what it does not (S-6; the same sentence is the comment of the column):
-- subject_thread_seq IS NOT NULL chỉ chứng minh rằng không bản nào được nhận vào luồng giữa lúc số được đọc và lúc quyết định được ghi; nó không chứng minh nháp đã qua phép kiểm nào của dịch vụ.
-- (A raw session of the runtime role can read last_seq and hand it back: the column is the number the service handed, not a proof that its rules ran. Nothing that reads the column may conclude more.)
-- Steps 10 and 11 come last in the file, after the numbering: ALTER TABLE ... ADD COLUMN holds ACCESS EXCLUSIVE on public.draft_decisions to the end of the
-- transaction, which blocks even SELECT there; nothing before it should wait on that lock, and it is held for the least time.
-- The revisions that exist when this file is applied are numbered here (step 8): per thread, in the order of created_at, revision_no, id. That
-- order is deterministic and is not the order of commit, which the database no longer knows for old rows; it is safe only while no draft that was
-- written before the numbering can be confirmed against it. Hence refusal 4 below.
-- Exception to E-DB-12 (optimistic locking), recorded here as the Database review asked: E-DB-12 không áp: bảng chỉ được ghi bởi
-- `source_event_revisions_thread_position()`, dưới khoá dòng giữ tới commit, bằng tăng nguyên tử; `last_seq` chính là phiên bản.
-- Four refusals, each with a fixed message and nothing created or changed (the whole file is one transaction):
-- 1. The migration login is not a superuser (P2): the function is owned by it, runs with row_security = off and must not be bound by the FORCE
--    row-level security of the tables it writes; with an owner that is bound, every intake statement would fail.
-- 2. A session of a login that is not a superuser and can act as libetech_ai is connected (P6 (ii)): a pipeline run that is still open may have read a
--    context before the old rows were numbered. pg_stat_activity shows the login, not a role taken with SET ROLE or SET SESSION AUTHORIZATION (measured
--    on PostgreSQL 16, measurements 9b and 9c), so this check sees a login that is a member of the AI role and nothing else; and it must leave
--    superusers out, because pg_has_role is true for every role when asked about a superuser (9a). No such login exists today (9e), so the check lets
--    the file through until one does; the branch that refuses has no behaviour case in this PR (condition N14).
-- 3. public.source_event_revisions holds more rows than libetech.thread_order_max_rows (a setting of the session, empty = 500 000; P12): the numbering
--    runs under SHARE ROW EXCLUSIVE on the revision table (inserts wait, reads do not), about 11 microseconds a row (Database review: 0.52 s for 60 000
--    rows, 3.3 s for 300 000). Above the cap: stop, ask for a plan in batches; raise the setting only with an approved plan, for that run only.
-- 4. Some revision carries no number yet and some AI draft of an intake candidate has no decision of a person (P6 (i)): a draft written before the
--    numbering cannot be judged against a number that was not there.
-- Apply as the migration login (a superuser), like 019-022. Nothing here switches anything on: no login, no password, no key, no membership, no grant
-- beyond SELECT of the runtime role on the two new tables and INSERT of the runtime role on the new column, no model. No data rows except the numbers of the
-- revisions that exist and schema_migrations.
-- Rollback: migrations/rollback/023_thread_order.sql (refuses while a later migration is recorded, and while a decision row carries a thread position: from the first
-- confirmation of a candidate draft on, this file only goes forward).
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Step 1: refusals 1 and 2.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname = current_user AND r.rolsuper) THEN
    RAISE EXCEPTION 'Migration 023 must be applied by a superuser: its trigger function is owned by the migration login, which row-level security must not bind.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_roles r ON r.oid = a.usesysid
              WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.datname = pg_catalog.current_database() AND NOT r.rolsuper
                AND pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER')) THEN
    RAISE EXCEPTION 'Migration 023 refuses to run while a login that can act as libetech_ai is connected: close the AI pipeline connections and apply again.';
  END IF;
END $$;

-- Step 2: the counter row of a thread.
CREATE TABLE IF NOT EXISTS public.intake_thread_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  chat_id text NOT NULL, thread_key text NOT NULL,
  last_seq bigint NOT NULL CHECK(last_seq > 0),
  FOREIGN KEY(project_id,tenant_id) REFERENCES public.projects(id,tenant_id),
  UNIQUE(tenant_id,project_id,chat_id,thread_key)
);
DROP TRIGGER IF EXISTS intake_thread_heads_no_delete ON public.intake_thread_heads;
CREATE TRIGGER intake_thread_heads_no_delete BEFORE DELETE ON public.intake_thread_heads FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

-- Step 3: the number of a stored revision.
CREATE TABLE IF NOT EXISTS public.source_revision_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid NOT NULL, revision_id uuid NOT NULL,
  chat_id text NOT NULL, thread_key text NOT NULL,
  thread_seq bigint NOT NULL CHECK(thread_seq > 0),
  FOREIGN KEY(project_id,tenant_id) REFERENCES public.projects(id,tenant_id),
  FOREIGN KEY(revision_id,source_event_id,tenant_id,project_id) REFERENCES public.source_event_revisions(id,source_event_id,tenant_id,project_id),
  UNIQUE(revision_id),
  UNIQUE(tenant_id,project_id,chat_id,thread_key,thread_seq)
);
DROP TRIGGER IF EXISTS source_revision_positions_immutable ON public.source_revision_positions;
CREATE TRIGGER source_revision_positions_immutable BEFORE UPDATE OR DELETE ON public.source_revision_positions FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
COMMENT ON TABLE public.intake_thread_heads IS 'One row per thread: last_seq is the number of the last revision stored in it. Written only by source_event_revisions_thread_position() (migration 023).';
COMMENT ON TABLE public.source_revision_positions IS 'The number of a stored revision in its thread. Written only by source_event_revisions_thread_position() and by the numbering of migration 023.';

-- Step 4: indexes of the same migration (E-DB-08). The foreign key to the revision table is served by UNIQUE(revision_id), which leads with it (016:130).
CREATE INDEX IF NOT EXISTS idx_intake_thread_heads_scope_created ON public.intake_thread_heads(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_thread_heads_project_fk ON public.intake_thread_heads(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_source_revision_positions_scope_created ON public.source_revision_positions(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_revision_positions_project_fk ON public.source_revision_positions(project_id,tenant_id);

-- Step 5: row-level security. One policy per table, SELECT for the runtime role, the condition of 016 word for word. No write policy: no role writes these tables
-- (the two definer functions do, as the owner, which is not bound), so there is no WITH CHECK to state.
ALTER TABLE public.intake_thread_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_thread_heads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.source_revision_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_revision_positions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS runtime_select ON public.intake_thread_heads;
CREATE POLICY runtime_select ON public.intake_thread_heads FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_select ON public.source_revision_positions;
CREATE POLICY runtime_select ON public.source_revision_positions FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));

-- Step 6: privileges. SELECT for the runtime role and nothing else for anyone: not the intake role, not the AI role, not the identity, projector,
-- outbox-audit or web roles. In particular no role may SELECT ... FOR UPDATE or FOR SHARE a counter row (those need UPDATE as well).
REVOKE ALL ON public.intake_thread_heads, public.source_revision_positions FROM PUBLIC;
GRANT SELECT ON public.intake_thread_heads, public.source_revision_positions TO libetech_runtime;

-- Step 7: the trigger function. Runs as its owner (a superuser, step 1), with row_security = off so that it fails closed instead of reading less, with a
-- search_path that names no schema a caller can write to, and with a lock_timeout of its own: past 5 seconds a wait for the counter row ends in 55P03 and the
-- statement stores nothing, whatever the session says.
CREATE OR REPLACE FUNCTION public.source_event_revisions_thread_position() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE k record; n bigint;
BEGIN
  -- The thread of a revision is the thread of its source event. The event is looked up under the tenant and project of the revision: an event of another project
  -- is refused here, and the answer names neither an id nor a number (the foreign key's own answer would carry both).
  SELECT e.chat_id, e.thread_key INTO k FROM public.source_events e
   WHERE e.id = NEW.source_event_id AND e.tenant_id = NEW.tenant_id AND e.project_id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The source event of a revision is not visible' USING ERRCODE = '23503';
  END IF;
  -- The first revision of a thread creates its counter row; the others raise it. Either way the row lock is held to the end of this transaction, and a second
  -- writer of the thread waits here, then reads the number the first one left. FOR UPDATE is not asked for: this statement takes the row lock itself.
  INSERT INTO public.intake_thread_heads AS h(tenant_id, project_id, chat_id, thread_key, last_seq)
    VALUES (NEW.tenant_id, NEW.project_id, k.chat_id, k.thread_key, 1)
  ON CONFLICT (tenant_id, project_id, chat_id, thread_key)
    DO UPDATE SET last_seq = h.last_seq + 1, updated_at = pg_catalog.clock_timestamp()
  RETURNING h.last_seq INTO n;
  INSERT INTO public.source_revision_positions(tenant_id, project_id, source_event_id, revision_id, chat_id, thread_key, thread_seq)
    VALUES (NEW.tenant_id, NEW.project_id, NEW.source_event_id, NEW.id, k.chat_id, k.thread_key, n);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.source_event_revisions_thread_position() FROM PUBLIC;

-- Step 8: number the revisions that exist. The lock keeps an intake out of the revision table from here to commit (SHARE ROW EXCLUSIVE: inserts wait, reads
-- do not); the trigger of step 9 is created under it, so an insert that waited is numbered by the trigger after this transaction commits.
LOCK TABLE public.source_event_revisions IN SHARE ROW EXCLUSIVE MODE;
DO $$ DECLARE cap bigint; total bigint; BEGIN
  cap := coalesce(nullif(pg_catalog.current_setting('libetech.thread_order_max_rows', true), ''), '500000')::bigint;
  SELECT count(*) INTO total FROM public.source_event_revisions;
  IF total > cap THEN
    RAISE EXCEPTION 'Migration 023 stops: public.source_event_revisions holds more rows than libetech.thread_order_max_rows allows for one numbering pass. Ask for a plan in batches; raise the setting for one run only with an approved plan.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.source_event_revisions r WHERE NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = r.id))
     AND EXISTS (SELECT 1 FROM intelligence.ai_drafts d WHERE d.entity_type = 'intake_candidate'
                  AND NOT EXISTS (SELECT 1 FROM public.draft_decisions x WHERE x.draft_id = d.id)) THEN
    RAISE EXCEPTION 'Migration 023 stops: an AI draft of an intake candidate that no person has decided exists while revisions still carry no thread number. Decide or reject the draft, then apply again.';
  END IF;
END $$;
-- Only revisions without a number are numbered: a second run finds none. A thread whose counter row exists (a revision stored while the trigger was off) goes on
-- from it. One statement, one snapshot; the counter rows are raised to the highest number written and never lowered.
WITH numbered AS (
  SELECT r.tenant_id, r.project_id, r.source_event_id, r.id AS revision_id, e.chat_id, e.thread_key,
         row_number() OVER (PARTITION BY r.tenant_id, r.project_id, e.chat_id, e.thread_key ORDER BY r.created_at, r.revision_no, r.id) AS rn
    FROM public.source_event_revisions r
    JOIN public.source_events e ON e.id = r.source_event_id AND e.tenant_id = r.tenant_id AND e.project_id = r.project_id
   WHERE NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = r.id)
), written AS (
  INSERT INTO public.source_revision_positions(tenant_id, project_id, source_event_id, revision_id, chat_id, thread_key, thread_seq)
  SELECT n.tenant_id, n.project_id, n.source_event_id, n.revision_id, n.chat_id, n.thread_key, coalesce(h.last_seq, 0) + n.rn
    FROM numbered n
    LEFT JOIN public.intake_thread_heads h
      ON h.tenant_id = n.tenant_id AND h.project_id = n.project_id AND h.chat_id = n.chat_id AND h.thread_key = n.thread_key
  RETURNING tenant_id, project_id, chat_id, thread_key, thread_seq
)
INSERT INTO public.intake_thread_heads AS h(tenant_id, project_id, chat_id, thread_key, last_seq)
SELECT w.tenant_id, w.project_id, w.chat_id, w.thread_key, max(w.thread_seq) FROM written w GROUP BY w.tenant_id, w.project_id, w.chat_id, w.thread_key
ON CONFLICT (tenant_id, project_id, chat_id, thread_key)
  DO UPDATE SET last_seq = EXCLUDED.last_seq, updated_at = pg_catalog.clock_timestamp() WHERE h.last_seq < EXCLUDED.last_seq;

-- Step 9: from here every stored revision is numbered by the database.
DROP TRIGGER IF EXISTS source_event_revisions_thread_position ON public.source_event_revisions;
CREATE TRIGGER source_event_revisions_thread_position AFTER INSERT ON public.source_event_revisions
  FOR EACH ROW EXECUTE FUNCTION public.source_event_revisions_thread_position();

-- Step 10: the position a confirmation carries. Last in the file but for the statistics: this statement holds ACCESS EXCLUSIVE on public.draft_decisions to the end of
-- the transaction (it blocks reads there too, 507 ms measured by the Database review), so nothing that can wait is done before it. No default: no table rewrite.
ALTER TABLE public.draft_decisions ADD COLUMN IF NOT EXISTS subject_thread_seq bigint;
COMMENT ON COLUMN public.draft_decisions.subject_thread_seq IS
  'The number of the last revision of the thread of a candidate, as the service read it before it confirmed a draft of that candidate; set only on a confirmation of a candidate draft (migration 023). subject_thread_seq IS NOT NULL chỉ chứng minh rằng không bản nào được nhận vào luồng giữa lúc số được đọc và lúc quyết định được ghi; nó không chứng minh nháp đã qua phép kiểm nào của dịch vụ.';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conname = 'draft_decisions_thread_seq_only_confirmed' AND c.conrelid = 'public.draft_decisions'::regclass) THEN
    ALTER TABLE public.draft_decisions ADD CONSTRAINT draft_decisions_thread_seq_only_confirmed
      CHECK (subject_thread_seq IS NULL OR (result = 'confirmed' AND subject_thread_seq > 0));
  END IF;
END $$;
GRANT INSERT(subject_thread_seq) ON public.draft_decisions TO libetech_runtime;

-- Step 11: the comparison, under the lock of the thread. AFTER INSERT: it runs after the BEFORE triggers of 021 and 022 and after the WITH CHECK of runtime_insert, so a
-- caller outside the scope it declared never waits for a thread it may not see. Definer, as the function of step 7 and for the same reasons (the runtime role holds no
-- privilege on the counter table that would let it lock a row, and row-level security must not filter what the comparison reads).
CREATE OR REPLACE FUNCTION public.draft_decisions_subject_order_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE d record; c record; cur bigint;
BEGIN
  -- 021 has already refused a decision whose draft the caller cannot see; this is the same refusal, in case that trigger is ever off.
  SELECT t.entity_type, t.entity_id INTO d FROM intelligence.ai_drafts t
   WHERE t.id = NEW.draft_id AND t.tenant_id = NEW.tenant_id AND t.project_id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A decision names a draft of its own project';
  END IF;
  -- Only a confirmation of a candidate draft carries the position of a thread. Anything else that carries one is refused; anything else that carries none is not judged.
  IF NEW.result IS DISTINCT FROM 'confirmed' OR d.entity_type IS DISTINCT FROM 'intake_candidate' THEN
    IF NEW.subject_thread_seq IS NOT NULL THEN
      RAISE EXCEPTION 'The thread of the candidate moved on' USING ERRCODE = 'LTZ03';
    END IF;
    RETURN NULL;
  END IF;
  -- The counter row is read under a lock that the next statement takes; only READ COMMITTED gives that statement a fresh snapshot after the wait (as in 022).
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'A candidate draft is confirmed in a READ COMMITTED transaction' USING ERRCODE = 'LTZ02';
  END IF;
  IF NEW.subject_thread_seq IS NULL THEN
    RAISE EXCEPTION 'The thread of the candidate moved on' USING ERRCODE = 'LTZ03';
  END IF;
  SELECT x.chat_id, x.thread_key INTO c FROM public.intake_candidates x
   WHERE x.id = d.entity_id AND x.tenant_id = NEW.tenant_id AND x.project_id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The thread of the candidate moved on' USING ERRCODE = 'LTZ03';
  END IF;
  -- The lock is the strength of the counter update (FOR NO KEY UPDATE) and is held to the end of the transaction that writes the decision: an intake of the thread that
  -- is in flight holds it until it commits, and the statement then reads the row it left; an intake that arrives later waits for this transaction.
  SELECT h.last_seq INTO cur FROM public.intake_thread_heads h
   WHERE h.tenant_id = NEW.tenant_id AND h.project_id = NEW.project_id AND h.chat_id = c.chat_id AND h.thread_key = c.thread_key
   FOR NO KEY UPDATE;
  IF NOT FOUND OR cur <> NEW.subject_thread_seq THEN
    RAISE EXCEPTION 'The thread of the candidate moved on' USING ERRCODE = 'LTZ03';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.draft_decisions_subject_order_guard() FROM PUBLIC;
DROP TRIGGER IF EXISTS draft_decisions_subject_order_guard ON public.draft_decisions;
CREATE TRIGGER draft_decisions_subject_order_guard AFTER INSERT ON public.draft_decisions
  FOR EACH ROW EXECUTE FUNCTION public.draft_decisions_subject_order_guard();

-- Step 12: statistics for the new tables, which have none until autovacuum runs.
ANALYZE public.source_revision_positions, public.intake_thread_heads;
INSERT INTO schema_migrations(version) VALUES('023') ON CONFLICT(version) DO NOTHING;
COMMIT;
