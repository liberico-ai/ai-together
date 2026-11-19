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
--    It also keeps one invariant of the database (Codex gate, round 1, P1): no revision of the thread of the candidate lacks a row in source_revision_positions. last_seq counts what
--    the numbering trigger counted; a revision that a session stored without firing that trigger (a restore, session_replication_role = replica, the trigger switched off and on again
--    in one transaction, the trigger absent: W9, L7) does not move it, so the comparison alone passes a position that is stale. The check is made after the lock and the comparison,
--    in the thread of the candidate (tenant, project, chat_id, thread_key, as the counter row), over three existing indexes and no new one: about 4 ms on a thread of 3 000 messages,
--    which a confirmation holds the counter row for on top of the rest (measured: codex-fix1-explain.txt). It gives LTZ03 and the same sentence. It is that invariant only: the rules
--    about what the draft read (the revision of each message, the mark) stay in the service. The invariant clears when this file numbers the revision again (a re-application).
--    What it does not close, the limit of the check (test N22): a revision without a number that commits AFTER the check and BEFORE the commit of the decision. Its writer takes no lock
--    that the confirmation holds, because the numbering trigger, which would take the counter row, is the one that did not fire; a lock that would make it wait (SHARE ROW EXCLUSIVE on
--    the revision table, held by every confirmation) would make every intake wait for every confirmation, and is not taken. The path exists only for a session that bypasses the
--    numbering trigger (a superuser, a restore); the window is the time from the check to the commit of the decision. It is stated, not closed (L7).
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
-- Lock window, from step 1 to the commit (reviews R-DB-1, R-DB-7, R-S-3). Right after the check of the superuser the file takes SHARE ROW EXCLUSIVE on
-- public.source_event_revisions (inserts wait, reads do not) and on intelligence.ai_drafts (no draft is written), in that order, and every check that follows is made
-- under those two locks: a revision that is being taken in when the file begins is waited for (the wait ends at lock_timeout with 55P03 and nothing changes), and nothing
-- new commits into either table until this transaction does. What pg_locks shows after step 9 (measured): SHARE ROW EXCLUSIVE on the two tables from step 1; SHARE ROW
-- EXCLUSIVE on public.projects from step 2 on (the foreign keys of the new tables; an INSERT, UPDATE or DELETE of a project row waits for it, the row locks of the foreign keys
-- and of 022 do not); ACCESS EXCLUSIVE on public.draft_decisions from step 10 on. A second run asks for the same locks on the revision table and the draft table and for no
-- stronger one there (the trigger of step 9 is replaced in place, CREATE OR REPLACE TRIGGER, not dropped and created). It also asks for ACCESS EXCLUSIVE on the two new tables,
-- from steps 2 and 3, which drop and create their triggers and policies again: a reader of those two tables waits for the length of a second run (A12; review R-DB-12; the choice
-- was to say so, not to guard steps 2 to 6 with a catalog check, for a window in which there is nothing to number). Ordering the first version got wrong: it checked the logins at
-- step 1, before the first wait, and asked for the lock of the revision table at step 8, after steps 2 and 3 had already waited for it; a login that connected during the wait was
-- not seen. The order of the two locks, revision table and then draft table, is deliberate: no path of the service writes both, so no order of the two can deadlock with the
-- service (a raw transaction that takes them the other way round can: the file is then the victim and changes nothing). The price is on the intake path, which waits for the first
-- lock: while an AI draft is being written at the moment the file is applied, an intake can wait behind the file, up to lock_timeout (5 s), for that draft (review R-S-10).
-- Four refusals, each with a fixed message and nothing created or changed (the whole file is one transaction):
-- 1. The migration login is not a superuser (P2): the function is owned by it, runs with row_security = off and must not be bound by the FORCE
--    row-level security of the tables it writes; with an owner that is bound, every intake statement would fail. Checked before any lock.
-- 2. A session of a login that is not a superuser and can act as libetech_ai is connected (P6 (ii)), checked twice, both times under the two locks: right after them (step 1),
--    and again right before the record of the migration (step 12), after every step that can wait (the step that adds the column waits for the readers of the decision table: a
--    login that connects while the file waits there is seen by the second check, test A14; review R-S-8). A pipeline run that is still open may have
--    read a context before the old rows were numbered. pg_stat_activity shows the login, not a role taken with SET ROLE or SET SESSION AUTHORIZATION (measured
--    on PostgreSQL 16, measurements 9b and 9c), so this check sees a login that is a member of the AI role and nothing else; and it must leave
--    superusers out, because pg_has_role is true for every role when asked about a superuser (9a). No such login exists today (9e), so the check lets the file through
--    until one does. What it does not see, and the plan states as condition N10: a run that read its context and then disconnected; and a login that connects after the
--    second check, in the time of the two statements that remain (a login that connects after this transaction has committed reads the numbered state, which is the one every
--    later revision follows). The branch that refuses is a behaviour case with the name of the AI role replaced by the name of a role that a login of the test harness is a
--    member of (tests A10, A11, A14); under the true name it has none until a login of that role exists (N14).
-- 3. public.source_event_revisions holds more revisions without a number than libetech.thread_order_max_rows (a setting of the session, empty = 250 000; P12). Revisions that
--    already have a number do not count: the second run of this file, which puts the trigger back (W9, L7, N12), is not stopped by the size of the table. The numbering of
--    step 8 runs under the lock above, 13 to 20 microseconds a revision at 500 000 revisions (the two timings below; the Database review of the plan measured 0.52 s for 60 000). The review of the code timed the
--    actual statement on PostgreSQL 16 under load: 6.65 s for 500 000 revisions in 70 000 threads and 10.16 s for 500 000 threads of one revision each (the worst shape), the
--    second at the 10 s statement_timeout of the pool; hence 250 000, and N3: time it on a copy of the production data before applying. Above the cap: stop, ask for a plan
--    in batches; raise the setting only with an approved plan, for that run only.
-- 4. Some revision carries no number yet and some AI draft of an intake candidate has no decision of a person (P6 (i)), checked under the same locks: a draft written
--    before the numbering cannot be judged against a number that was not there.
-- Also to know (reviews R-DB-10, R-S-6, R-S-7):
-- a. The old revisions are numbered per thread in the order of created_at, revision_no, id: not the order of commit, and it can give revision 2 of a message a smaller number
--    than revision 1. Nothing in the service reads the order of two numbers of old rows (it uses the largest number of a thread and the revision numbers of a message);
--    that is safe because of refusal 4.
-- b. Each rollback followed by a new application leaves one dropped column in public.draft_decisions (its privileges are gone: the rollback revokes them first).
-- c. LTZ03 has one fixed sentence for every cause. The CONTEXT line that PostgreSQL adds (function name and line of the RAISE) differs by cause and reaches only a caller that
--    reads raw errors; the HTTP layer does not pass database text on.
-- d. libetech_runtime holds SELECT on the two new tables, as on every table it reads, so it can keep LOCK TABLE ... IN ACCESS SHARE MODE in an open transaction: that blocks
--    the next ALTER or DROP of them (the rollback file, a later migration) until its lock_timeout, and nothing else. Look at pg_locks before applying or rolling back;
--    idle_in_transaction_session_timeout of the web login (condition N1) bounds it.
-- e. The two definer functions are owned by the migration login, a superuser, as in 022. That is safe because every name in them is schema-qualified and search_path is
--    pinned; a later edit that drops one prefix would run code with the rights of a superuser.
-- Apply as the migration login (a superuser), like 019-022. Nothing here switches anything on: no login, no password, no key, no membership, no grant
-- beyond SELECT of the runtime role on the two new tables and INSERT of the runtime role on the new column, no model. No data rows except the numbers of the
-- revisions that exist and schema_migrations.
-- Rollback: migrations/rollback/023_thread_order.sql (refuses while a later migration is recorded, and while a decision row carries a thread position: from the first
-- confirmation of a candidate draft on, this file only goes forward).
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Step 1: refusal 1, before any lock; then the two locks that open the lock window; then refusal 2, under them.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname = current_user AND r.rolsuper) THEN
    RAISE EXCEPTION 'Migration 023 must be applied by a superuser: its trigger function is owned by the migration login, which row-level security must not bind.';
  END IF;
END $$;
LOCK TABLE public.source_event_revisions IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE intelligence.ai_drafts IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
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

-- Step 8: number the revisions that exist. The lock of step 1 keeps an intake out of the revision table up to the commit (SHARE ROW EXCLUSIVE: inserts wait, reads do not);
-- the trigger of step 9 is created under it, so an insert that waited is numbered by the trigger after this transaction commits. The cap counts the revisions that have no
-- number: those are the ones the numbering below writes a row for.
DO $$ DECLARE cap bigint; total bigint; BEGIN
  cap := coalesce(nullif(pg_catalog.current_setting('libetech.thread_order_max_rows', true), ''), '250000')::bigint;
  SELECT count(*) INTO total FROM public.source_event_revisions r WHERE NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = r.id);
  IF total > cap THEN
    RAISE EXCEPTION 'Migration 023 stops: public.source_event_revisions holds more revisions without a thread number than libetech.thread_order_max_rows allows for one numbering pass. Ask for a plan in batches; raise the setting for one run only with an approved plan.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.source_event_revisions r WHERE NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = r.id))
     AND EXISTS (SELECT 1 FROM intelligence.ai_drafts d WHERE d.entity_type = 'intake_candidate'
                  AND NOT EXISTS (SELECT 1 FROM public.draft_decisions x WHERE x.draft_id = d.id)) THEN
    RAISE EXCEPTION 'Migration 023 stops: an AI draft of an intake candidate that no person has decided exists while revisions still carry no thread number. Decide or reject the draft, then apply again.';
  END IF;
END $$;
-- Only revisions without a number are numbered: a second run finds none. A thread whose counter row exists (a revision stored while the trigger was off) goes on
-- from it. One statement, one snapshot; the counter row of a thread is raised to the highest number written (always above its old value: the numbers written start after it).
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
  DO UPDATE SET last_seq = EXCLUDED.last_seq, updated_at = pg_catalog.clock_timestamp();

-- Step 9: from here every stored revision is numbered by the database. Replaced in place (a drop would take ACCESS EXCLUSIVE on the revision table; the replacement takes
-- SHARE ROW EXCLUSIVE, which this transaction already holds), and replaced enabled: a second run turns a trigger that was switched off back on (A7b).
CREATE OR REPLACE TRIGGER source_event_revisions_thread_position AFTER INSERT ON public.source_event_revisions
  FOR EACH ROW EXECUTE FUNCTION public.source_event_revisions_thread_position();
-- Statistics for the new tables, which have none until autovacuum runs: before the step that holds ACCESS EXCLUSIVE on the decision table, not under it.
ANALYZE public.source_revision_positions, public.intake_thread_heads;

-- Step 10: the position a confirmation carries. Last in the file but for the record of the migration: this statement holds ACCESS EXCLUSIVE on public.draft_decisions to the end of
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
  -- The counter row says only what the numbering trigger counted (Codex gate, round 1, P1). A revision that a session wrote without firing that trigger (a restore, session_replication_role =
  -- replica, the trigger switched off and on again) does not move last_seq, so the position that the service read still equals it. The invariant of rule 4 of the service, every revision of the
  -- thread has a number, is checked here as well, after the lock and the comparison, in the thread of the candidate: the same tenant, project, chat and thread key as the counter row. Only that
  -- invariant: the rules about what the draft read (the revision of each message, the mark) stay in the service. The answer is the same code and the same sentence as for every other cause.
  IF EXISTS (SELECT 1 FROM public.source_events ev
               JOIN public.source_event_revisions rv ON rv.source_event_id = ev.id AND rv.tenant_id = ev.tenant_id AND rv.project_id = ev.project_id
              WHERE ev.tenant_id = NEW.tenant_id AND ev.project_id = NEW.project_id AND ev.chat_id = c.chat_id AND ev.thread_key = c.thread_key
                AND NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = rv.id)) THEN
    RAISE EXCEPTION 'The thread of the candidate moved on' USING ERRCODE = 'LTZ03';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.draft_decisions_subject_order_guard() FROM PUBLIC;
DROP TRIGGER IF EXISTS draft_decisions_subject_order_guard ON public.draft_decisions;
CREATE TRIGGER draft_decisions_subject_order_guard AFTER INSERT ON public.draft_decisions
  FOR EACH ROW EXECUTE FUNCTION public.draft_decisions_subject_order_guard();

-- Step 12: refusal 2 once more, under the same two locks, now that every step that can wait has been passed (review R-S-8): a login that connected while the file waited at a
-- later step is seen here. PostgreSQL keeps the first reading of pg_stat_activity for the rest of the transaction, so the cached reading of the first check is thrown away
-- first (without that the second check sees what the first saw: found by test A14). Then the record of the migration.
DO $$ BEGIN
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_roles r ON r.oid = a.usesysid
              WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.datname = pg_catalog.current_database() AND NOT r.rolsuper
                AND pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER')) THEN
    RAISE EXCEPTION 'Migration 023 refuses to run while a login that can act as libetech_ai is connected: close the AI pipeline connections and apply again.';
  END IF;
END $$;
INSERT INTO schema_migrations(version) VALUES('023') ON CONFLICT(version) DO NOTHING;
COMMIT;
