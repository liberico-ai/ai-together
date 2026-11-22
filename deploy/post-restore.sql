-- The step that follows EVERY restore of an AI OS database (N4 and N12 of docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md; docs/RUNBOOK-RESTORE-AFTER-023.md).
-- Run it as a superuser, after the data is loaded (and, for an archive from before 023, after migration 023 has been applied again), before the web service and the gateway start, and NOT at the
-- same time as an application of 023: the checks hold ACCESS SHARE locks on what they read until the end of the block (no table is locked against writes while it only reads: a revision and
-- its number commit together, so each check sees whole rows), the write of step 10 asks for ROW EXCLUSIVE on the revision table first (the first lock of 023) and is undone, and a repair
-- (step 2) asks for SHARE ROW EXCLUSIVE on that table under lock_timeout 1 s, so that it never holds up an intake for long.
--   psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -d <database> -c "SET libetech.archive_kind = '<kind>'" -f - < deploy/post-restore.sql
-- <kind> is the word that deploy/restore-plan.py printed for the archive at step 3 of the runbook: post-023 or pre-023. It is REQUIRED (POST-RESTORE-01 without it, or with another word): the file cannot
-- tell from the data an archive of before 023 that was not numbered from a source that held threads (OQ-59 (b) (1)), so it is told, and for pre-023 a revision without a number is a refusal (05).
-- Run it with psql -f (or stdin), never with psql -1, and never with its text in -c (-c is for the SET of the kind only). It succeeded only if the exit code is 0 AND the last line it prints is {"post_restore" : "pass", ...}. Without ON_ERROR_STOP an
-- error does not change the exit code; the missing line is what says it failed.
-- Pure SQL, no psql meta-command and no transaction control, so that the tests can run it in PGlite and through a pool as well as through psql. The work is ONE DO block: whatever runs it,
-- the block is atomic, so a refusal undoes the repair of step 2 with it; the block leaves search_path and lock_timeout as it found them, and ANALYZE and the answer follow it. A refusal has a
-- fixed code, POST-RESTORE-nn, and a count at most: never an id, a chat, a thread key or a value of the data, and an error of PostgreSQL's own (which can quote a row) is turned into
-- POST-RESTORE-98 (a lock) or -99 with its SQLSTATE and nothing else. The installers print the codes and nothing else of what psql says.
-- What it does: (1) says who may run it, and in what kind of session; (2) puts back the one thing a restore is known to break; (3) reads the catalog: every trigger of the application schemas
-- is enabled as it should be; (4) the numbers of migration 023 agree with the revisions, the events and the decisions, and the revisions that have no number are COUNTED PER PROJECT for an archive of after 023 (a report, not a refusal: OQ-59 (b) (1)) and REFUSED for one of before 023 (step 05); (5) no row points at a row that is not there; (6) a
-- write that is undone shows that a revision stored now is numbered, by an ordinary session and by one in replica mode; (7) ANALYZE, then the answer. A database that has no 023 (a backup of
-- before 023 rehearsed into schema 022) skips what is of 023 and says so.
-- The repair of step 2 is DDL outside a migration (E-DB-04): a deliberate exception, because it restores a state that a restore took away and changes no schema.
SET libetech.post_restore_done = 'off';
DO $post_restore$
DECLARE
  -- Triggers that must be enabled for EVERY session role (A). All others must be O. A migration that gives another trigger ENABLE ALWAYS adds its name here: the test of this file reads
  -- the catalog of a database that has every migration and fails when the two differ (test P13).
  always_on CONSTANT text[] := ARRAY['public.source_event_revisions.source_event_revisions_thread_position'];
  has023 boolean; old_path text; old_lock_timeout text;
  was "char";
  n bigint; skewed bigint; f record; broken integer := 0; fks integer := 0; revisions bigint; threads bigint;
  -- step 05: what the source held, per project. held_projects is NULL where it is not looked at (a database that has no 023), so that the answer never says "none" for a check that did not run.
  unnumbered boolean; held_projects pg_catalog.json;
  -- what the archive was, as the caller says (the plan's word): post-023 or pre-023
  kind text;
  tenant uuid := pg_catalog.gen_random_uuid(); proj uuid := pg_catalog.gen_random_uuid(); ev uuid := pg_catalog.gen_random_uuid();
  thread text := 'post-restore-probe-' || pg_catalog.gen_random_uuid()::text; rev uuid; got bigint; head bigint;
BEGIN
  old_path := pg_catalog.current_setting('search_path');
  old_lock_timeout := pg_catalog.current_setting('lock_timeout');
  -- Every name below is schema-qualified or in pg_catalog; the path is pinned for this transaction anyway (a schema that a role can write must not stand before pg_catalog for a superuser).
  PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
  PERFORM pg_catalog.set_config('lock_timeout', '1s', true);
  BEGIN
    -- 01: a restore that disabled triggers needed a superuser; this file reads every row and writes its probe under row-level security. The session is an ordinary one (origin: not
    -- replica, in which the triggers of 023 would not be what is tested), and no default of the database or of a role says otherwise.
    IF pg_catalog.current_setting('is_superuser') <> 'on' THEN
      RAISE EXCEPTION 'POST-RESTORE-01 run this file as a superuser';
    END IF;
    IF pg_catalog.current_setting('session_replication_role') <> 'origin' OR EXISTS (SELECT 1 FROM pg_catalog.pg_db_role_setting d
         WHERE d.setdatabase IN (0, (SELECT oid FROM pg_catalog.pg_database WHERE datname = pg_catalog.current_database()))
           AND pg_catalog.array_to_string(d.setconfig, ',') LIKE '%session_replication_role%') THEN
      RAISE EXCEPTION 'POST-RESTORE-01 run this file in a session with session_replication_role = origin, and with no default of the database or of a role that says otherwise';
    END IF;

    -- The kind of the archive is a parameter, read from a setting of this session that the installers (or the person) set first. Not a secret and not an authorization: a word that decides whether a revision
    -- without a number is a refusal (pre-023) or a count (post-023). Missing, or any other word, is a refusal before anything is read or repaired.
    -- A default (ALTER DATABASE / ALTER ROLE ... SET) that applies to THIS session would be read by current_setting as if the caller had said it: nobody told the file about this archive. Refused. Only the
    -- defaults that apply to the session are looked at (the database or none, the role that connected or none; Codex gate, run 3): another role's default is not this run's business. pg_settings has no row
    -- for a placeholder, so the catalog of defaults is read, and only the setting of that exact name counts (Codex gate, run 4: a substring match refused another setting whose name merely contains it).
    -- PGOPTIONS is the caller telling it; postgresql.conf is not covered.
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_db_role_setting d
         WHERE d.setdatabase IN (0, (SELECT oid FROM pg_catalog.pg_database WHERE datname = pg_catalog.current_database()))
           AND d.setrole IN (0, (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = session_user))
           AND EXISTS (SELECT 1 FROM pg_catalog.unnest(d.setconfig) AS c(setting) WHERE pg_catalog.lower(pg_catalog.split_part(c.setting, '=', 1)) = 'libetech.archive_kind')) THEN
      RAISE EXCEPTION 'POST-RESTORE-01 a default of the database or of the role that runs this file gives the kind of the archive; remove it: the kind is told for each run, with SET libetech.archive_kind';
    END IF;
    kind := pg_catalog.current_setting('libetech.archive_kind', true);
    IF kind IS NULL OR kind NOT IN ('post-023', 'pre-023') THEN
      RAISE EXCEPTION 'POST-RESTORE-01 give the kind of the archive first: SET libetech.archive_kind = ''post-023'' or ''pre-023'', the word that deploy/restore-plan.py printed for it';
    END IF;

    has023 := pg_catalog.to_regclass('public.intake_thread_heads') IS NOT NULL;
    IF has023 <> (pg_catalog.to_regclass('public.source_revision_positions') IS NOT NULL) THEN
      RAISE EXCEPTION 'POST-RESTORE-02 migration 023 is half applied: one of its two tables is missing';
    END IF;

    IF has023 THEN
      -- 02: the numbering trigger is the trigger that 023 creates: AFTER INSERT ... FOR EACH ROW (tgtype 5), no WHEN condition, the function that is named. Its state is not read here (step 2 fixes it).
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid = 'public.source_event_revisions'::pg_catalog.regclass
                      AND g.tgname = 'source_event_revisions_thread_position' AND NOT g.tgisinternal AND g.tgtype = 5 AND g.tgqual IS NULL
                      AND g.tgfoid = pg_catalog.to_regprocedure('public.source_event_revisions_thread_position()')) THEN
        RAISE EXCEPTION 'POST-RESTORE-02 the numbering trigger of migration 023 is missing or is not the trigger that the migration creates; apply migration 023 again';
      END IF;
      -- The repair. pg_restore --disable-triggers ends with ENABLE TRIGGER ALL, which sets that trigger from A (it also fires under session_replication_role = replica) back to O.
      SELECT g.tgenabled INTO was FROM pg_catalog.pg_trigger g
       WHERE g.tgrelid = 'public.source_event_revisions'::pg_catalog.regclass AND g.tgname = 'source_event_revisions_thread_position' AND NOT g.tgisinternal;
      IF was <> 'A' THEN
        ALTER TABLE public.source_event_revisions ENABLE ALWAYS TRIGGER source_event_revisions_thread_position;
        -- a notice, not a refusal: it has no code, and it is undone with the block if a later check refuses
        RAISE NOTICE 'the numbering trigger stood at % and is put back to A (kept only if every check that follows passes)', was;
        IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid = 'public.source_event_revisions'::pg_catalog.regclass
                        AND g.tgname = 'source_event_revisions_thread_position' AND g.tgenabled = 'A') THEN
          RAISE EXCEPTION 'POST-RESTORE-03 the numbering trigger could not be put back to A';
        END IF;
      END IF;
    END IF;

    -- 04 (N12): every trigger of the application schemas (every schema that is not the catalog's), the triggers of the foreign keys included: O, or A for the names in always_on. None off (D), none replica-only (R).
    SELECT count(*) INTO n FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid JOIN pg_catalog.pg_namespace s ON s.oid = c.relnamespace
     WHERE s.nspname NOT LIKE 'pg\_%' AND s.nspname <> 'information_schema'
       AND t.tgenabled <> (CASE WHEN pg_catalog.format('%s.%s', t.tgrelid::pg_catalog.regclass, t.tgname) = ANY (always_on) THEN 'A' ELSE 'O' END)::"char";
    IF n > 0 THEN
      RAISE EXCEPTION 'POST-RESTORE-04 % trigger(s) of the application schemas are not enabled as they should be (O; A for the numbering trigger)', n;
    END IF;
    IF has023 AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid = 'public.draft_decisions'::pg_catalog.regclass
                               AND g.tgname = 'draft_decisions_subject_order_guard' AND NOT g.tgisinternal AND g.tgenabled = 'O' AND g.tgtype = 5 AND g.tgqual IS NULL
                               AND g.tgfoid = pg_catalog.to_regprocedure('public.draft_decisions_subject_order_guard()')) THEN
      RAISE EXCEPTION 'POST-RESTORE-04 the confirmation trigger of migration 023 is missing or is not the trigger that the migration creates';
    END IF;

    IF has023 THEN
      -- 05 (N4, N15; OQ-59 (b) (1), the Chairman's answer of 22/11/2026): for an archive of AFTER 023 a revision that has no number is REPORTED, not refused. One that has none holds its whole thread (rule 4 of
      -- the service, the guard of 023), and it did at the source: a restore keeps the source as it was, does not make a number up (that is the numbering of 023, applied again with the Chairman's approval,
      -- OQ-59 (a)), and does not hide the revision either: the count goes into the answer PER PROJECT (an ordinal in the order of the project ids, as docs/RUNBOOK-RESTORE-AFTER-023.md section 7 numbers
      -- them), counts only. No TOTAL of these revisions over the projects is given (Codex gate, run 3; AGENTS.md: reports never aggregate across reporting domains, and a project belongs to one): not in the answer, not in a message.
      -- (The older whole-database figures `revisions`, `threads` and `foreign_keys` of the answer are from N4 and count rows of the database, not revisions without a number.)
      -- project_no ranks only the projects that have such a revision (the WHERE runs first): it names a project within THIS run, and is not comparable with the ordinal of another run; the runbook section 7 query numbers them the same way.
      -- Every check that follows still refuses. For an archive of BEFORE 023 the same revisions are a refusal (below): the kind is told to this file, not guessed from the data.
      -- `threads` of a project counts every thread (chat and key) that has such a revision, with or without a candidate: where there is no candidate there is no draft to hold, so it is an upper bound.
      SELECT coalesce(pg_catalog.json_agg(pg_catalog.json_build_object('project_no', g.project_no, 'revisions', g.revisions, 'threads', g.threads) ORDER BY g.project_no), '[]'::pg_catalog.json)
        INTO held_projects
        FROM (SELECT pg_catalog.dense_rank() OVER (ORDER BY r.project_id) AS project_no, count(*) AS revisions, count(DISTINCT (e.chat_id, e.thread_key)) AS threads
                FROM public.source_event_revisions r
                LEFT JOIN public.source_events e ON e.id = r.source_event_id AND e.tenant_id = r.tenant_id AND e.project_id = r.project_id
               WHERE NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = r.id)
               GROUP BY r.project_id) g;
      unnumbered := pg_catalog.json_array_length(held_projects) > 0;
      IF unnumbered AND kind = 'pre-023' THEN
        -- An archive of before 023 has no number at all until 023 has been applied again, and that numbers every revision: one left without a number is a numbering that did not run or did not finish
        -- (runbook step 6), not a thread that a source held. The refusal that N4 had, kept for exactly this kind, with no count (a count over every project is not given).
        RAISE EXCEPTION 'POST-RESTORE-05 revisions have no thread number although the archive is of before 023: apply migration 023 again (docs/RUNBOOK-RESTORE-AFTER-023.md section 3, step 6) before this check';
      END IF;
      IF unnumbered THEN
        -- a notice, as for the trigger above: it has no code (an installer that shows the codes it finds must not show one for a check that did not refuse), and no value of the data
        RAISE NOTICE 'revisions have no thread number (the counts, per project, are held_by_project in the answer); a thread with such a revision is held and nothing here numbers it (OQ-59 (b) (1); docs/RUNBOOK-RESTORE-AFTER-023.md section 7)';
      END IF;
      -- 06: the counter row of a thread says how many numbers it has and which is the last; no number belongs to a thread without a counter row.
      SELECT count(*) INTO skewed FROM public.intake_thread_heads h
        LEFT JOIN LATERAL (SELECT count(*) AS cnt, max(p.thread_seq) AS top FROM public.source_revision_positions p
                            WHERE p.tenant_id = h.tenant_id AND p.project_id = h.project_id AND p.chat_id = h.chat_id AND p.thread_key = h.thread_key) s ON true
       WHERE h.last_seq <> s.cnt OR h.last_seq <> coalesce(s.top, 0);
      SELECT count(*) INTO n FROM public.source_revision_positions p
       WHERE NOT EXISTS (SELECT 1 FROM public.intake_thread_heads h WHERE h.tenant_id = p.tenant_id AND h.project_id = p.project_id AND h.chat_id = p.chat_id AND h.thread_key = p.thread_key);
      IF skewed + n > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE-06 % counter row(s) disagree with the numbers of their thread, and % number(s) have no counter row', skewed, n;
      END IF;
      -- 07: the chat and the thread of a number are those of its source event.
      SELECT count(*) INTO n FROM public.source_revision_positions p
        JOIN public.source_events e ON e.id = p.source_event_id AND e.tenant_id = p.tenant_id AND e.project_id = p.project_id
       WHERE e.chat_id <> p.chat_id OR e.thread_key <> p.thread_key;
      IF n > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE-07 % number(s) belong to another thread than the one of their source event', n;
      END IF;
      -- 08: a decision that carries a position is a confirmation of a draft of an intake candidate, and the position is not beyond the last number of the thread of that candidate
      -- (the trigger of 023 made the position equal to the last number when it was written; the last number only grows).
      SELECT count(*) INTO n FROM public.draft_decisions x
       WHERE x.subject_thread_seq IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM intelligence.ai_drafts d
           JOIN public.intake_candidates c ON c.id = d.entity_id AND c.tenant_id = d.tenant_id AND c.project_id = d.project_id
           JOIN public.intake_thread_heads h ON h.tenant_id = c.tenant_id AND h.project_id = c.project_id AND h.chat_id = c.chat_id AND h.thread_key = c.thread_key
          WHERE d.id = x.draft_id AND d.entity_type = 'intake_candidate' AND x.result = 'confirmed' AND x.subject_thread_seq <= h.last_seq);
      IF n > 0 THEN
        RAISE EXCEPTION 'POST-RESTORE-08 % decision(s) carry a thread position that no confirmation of a candidate draft can have', n;
      END IF;
    END IF;

    -- 09: the foreign keys. pg_restore --disable-triggers loads without checking them (the data has cycles, so no order of loading can satisfy them); the archive came from one snapshot and
    -- satisfies them, but nothing has said so here. One query for each foreign key of the application schemas: a row whose key columns are all set and that has no row to point at.
    -- (PostgreSQL's own MATCH SIMPLE; another match type is refused: this file does not know its rule.)
    FOR f IN
      SELECT c.conname, c.confmatchtype, c.conrelid::pg_catalog.regclass AS child, c.confrelid::pg_catalog.regclass AS parent,
        (SELECT pg_catalog.string_agg(pg_catalog.format('c.%I IS NOT NULL', a.attname), ' AND ' ORDER BY k.ord)
           FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord) JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS present,
        (SELECT pg_catalog.string_agg(pg_catalog.format('p.%I = c.%I', pa.attname, ca.attname), ' AND ' ORDER BY k.ord)
           FROM unnest(c.confkey, c.conkey) WITH ORDINALITY k(pk, ck, ord)
           JOIN pg_catalog.pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = k.pk
           JOIN pg_catalog.pg_attribute ca ON ca.attrelid = c.conrelid AND ca.attnum = k.ck) AS matches
        FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class r ON r.oid = c.conrelid JOIN pg_catalog.pg_namespace s ON s.oid = r.relnamespace
       WHERE c.contype = 'f' AND s.nspname NOT LIKE 'pg\_%' AND s.nspname <> 'information_schema'
    LOOP
      fks := fks + 1;
      IF f.confmatchtype <> 's' THEN
        RAISE EXCEPTION 'POST-RESTORE-09 a foreign key has a match type that this file does not check';
      END IF;
      EXECUTE pg_catalog.format('SELECT count(*) FROM %s c WHERE %s AND NOT EXISTS (SELECT 1 FROM %s p WHERE %s)', f.child, f.present, f.parent, f.matches) INTO n;
      IF n > 0 THEN
        broken := broken + 1;
        RAISE WARNING 'POST-RESTORE-09 foreign key % of % has % row(s) without a row to point at', f.conname, f.child, n;
      END IF;
    END LOOP;
    IF broken > 0 THEN
      RAISE EXCEPTION 'POST-RESTORE-09 % foreign key(s) have rows without a row to point at', broken;
    END IF;

    -- 10: a write, undone. A revision stored now is numbered by the database: once by a session of the origin role, and once by a session with session_replication_role = replica (what a
    -- loader of its own has). The inner block ends in an exception that undoes everything it wrote: not the project, the event, the revisions, nor the counter row stays. Any other
    -- error in it is POST-RESTORE-10 too (it is the write that failed, whatever PostgreSQL says about it).
    IF has023 THEN
      BEGIN
        -- The first lock is the first that migration 023 asks for (the revision table, then the project table): the probe waits behind a first application of 023 and does not deadlock with it.
        LOCK TABLE public.source_event_revisions IN ROW EXCLUSIVE MODE;
        INSERT INTO public.projects(id, tenant_id, name, bu) VALUES (proj, tenant, 'post-restore probe', 'probe');
        INSERT INTO public.source_events(id, tenant_id, project_id, source_id, source_type, quality_score, chat_id, message_id, thread_key, source_actor, observed_at, forwarded, addressed, trace_id, correlation_id)
          VALUES (ev, tenant, proj, 'post-restore-probe', 'telegram_gateway', 80, '-1', '1', thread, 'probe', pg_catalog.now(), false, false, pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid());
        FOR i IN 1..2 LOOP
          IF i = 2 THEN SET LOCAL session_replication_role = replica; END IF;
          INSERT INTO public.source_event_revisions(tenant_id, project_id, source_event_id, revision_no, revision_key, content_hash, content_mode)
            VALUES (tenant, proj, ev, i, pg_catalog.repeat(i::text, 64), pg_catalog.repeat('a', 64), 'pointer_only') RETURNING id INTO rev;
          SELECT p.thread_seq INTO got FROM public.source_revision_positions p WHERE p.revision_id = rev;
          SELECT h.last_seq INTO head FROM public.intake_thread_heads h WHERE h.tenant_id = tenant AND h.project_id = proj AND h.thread_key = thread;
          IF got IS DISTINCT FROM i OR head IS DISTINCT FROM i THEN
            RAISE EXCEPTION 'POST-RESTORE-10 a revision stored now was not given the next number of its thread (write %)', i;
          END IF;
        END LOOP;
        RAISE EXCEPTION 'POST-RESTORE-00 the write that is undone has finished' USING ERRCODE = 'LTZ90';
      EXCEPTION
        WHEN SQLSTATE 'LTZ90' THEN NULL;
        WHEN SQLSTATE '55P03' OR SQLSTATE '40P01' THEN
          RAISE EXCEPTION 'POST-RESTORE-98 a lock that this file needs is held by another session; stop whatever writes to the database and run it again';
        WHEN OTHERS THEN
          -- our own refusal keeps its text (which write failed); whatever else is a code and a SQLSTATE
          IF SQLERRM LIKE 'POST-RESTORE-%' THEN RAISE; END IF;
          RAISE EXCEPTION 'POST-RESTORE-10 the write that is undone failed (SQLSTATE %)', SQLSTATE;
      END;
      -- the replica mode of the probe ended with it
      IF pg_catalog.current_setting('session_replication_role') <> 'origin' THEN
        RAISE EXCEPTION 'POST-RESTORE-10 the session was left in replica mode by the write that is undone';
      END IF;
    END IF;

    SELECT count(*) INTO revisions FROM public.source_event_revisions;
    IF has023 THEN SELECT count(*) INTO threads FROM public.intake_thread_heads; END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Whatever is not one of ours: a code and a SQLSTATE, never the message (a message of PostgreSQL can quote a row).
    IF SQLERRM LIKE 'POST-RESTORE-%' THEN
      RAISE;
    ELSIF SQLSTATE IN ('55P03', '40P01') THEN
      RAISE EXCEPTION 'POST-RESTORE-98 a lock that this file needs is held by another session; stop whatever writes to the database and run it again';
    ELSE
      RAISE EXCEPTION 'POST-RESTORE-99 unexpected error (SQLSTATE %)', SQLSTATE;
    END IF;
  END;

  -- The session is left as it was found: when a pool or psql -1 runs the whole text as one transaction, the statement that follows (ANALYZE) must not run under a pinned path and a 1 s lock timeout.
  PERFORM pg_catalog.set_config('search_path', old_path, true);
  PERFORM pg_catalog.set_config('lock_timeout', old_lock_timeout, true);
  PERFORM pg_catalog.set_config('libetech.post_restore_answer', pg_catalog.json_build_object('post_restore', 'pass', 'numbering_trigger_was', nullif(was::text, ''),
    'archive_kind', kind, 'thread_order', CASE WHEN has023 THEN 'checked' ELSE '023 not applied' END, 'revisions', revisions, 'threads', threads, 'foreign_keys', fks,
    'held_by_project', held_projects)::text, false);
  PERFORM pg_catalog.set_config('libetech.post_restore_done', 'on', false);
END
$post_restore$;
-- A restore leaves the tables without statistics (N7 of DELIVERY-016: the query of rule 4 of the service chose a bad plan on tables that had just been loaded, 3 to 4 s, until ANALYZE).
-- Before the answer: a failure here is a failed run with no answer line, whatever runs the text, and never a pass that a rollback takes back.
ANALYZE;
-- The answer: one row, only when the block above has finished, and only if the catalog agrees that the numbering trigger stands at A (a second gate that does not rest on a value that
-- this session set). Nothing here reads a table of 023, which a database from before it does not have.
SELECT pg_catalog.current_setting('libetech.post_restore_answer', true) AS result
 WHERE pg_catalog.current_setting('libetech.post_restore_done', true) = 'on'
   AND (pg_catalog.to_regclass('public.intake_thread_heads') IS NULL
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid = pg_catalog.to_regclass('public.source_event_revisions')
                    AND g.tgname = 'source_event_revisions_thread_position' AND g.tgenabled = 'A'));
