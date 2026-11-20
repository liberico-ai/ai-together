-- The count that is made BEFORE migration 023 is applied to a database that serves (N3 of docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md; docs/RUNBOOK-PRE-023-N1-N3.md).
-- It answers what 023 itself would answer, without applying anything: each of the four refusals of 023 as a code, and the counts behind them. Run it as the login that will apply 023, in the
-- settings that will apply it (PGOPTIONS="-c libetech.thread_order_max_rows=<n>" if a raised cap is part of the approved plan), and again right before the application:
--   psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -d <database> -f deploy/pre-023-check.sql
-- Run it with psql -f (or stdin), never with psql -c, and over a DIRECT connection: through a pooler in transaction mode its three statements can land on different sessions (PRE-023-97 says
-- so when the second notices it; the last statement answers only for the session that did the work). It says READY only if the last line it prints is {"pre_023" : "ready", ...};
-- "blocked" lists the reasons; no line at all is a failure.
-- It writes no data and changes no object. It takes only the ACCESS SHARE locks of ordinary reads (the catalog, and a count over the revision, draft and decision tables) under its own
-- lock_timeout of 3 seconds (a queued ACCESS EXCLUSIVE ahead of it ends the wait with PRE-023-99 / 55P03 instead of a hang). It sets two session settings for its answer (libetech.pre_023_nonce
-- and libetech.pre_023_done; counts-only text, no data). A READY answer is not a promise: an AI login can connect, or a draft can be written, a moment later, and 023 checks all of it again
-- under its own locks. What the answer cannot say is how long 023 holds its locks: that is a measurement on a copy of the data (the runbook, 3.2).
-- Reasons (023 refuses, or cannot run, for each):
--   PRE-023-01  the login is not a superuser (023 is applied by one; nothing else is read, because a login that cannot apply 023 reads only what it was given)
--   PRE-023-02  more revisions without a thread number than libetech.thread_order_max_rows (empty = 250 000)
--   PRE-023-03  an AI draft of an intake candidate that no person has decided, while revisions without a number exist
--   PRE-023-04  a login that can act as libetech_ai (not a superuser) is connected to this database
--   PRE-023-98  something 023 works on is missing: a table (source_event_revisions, source_events, projects, ai_drafts, draft_decisions), the function reject_history_mutation(), or the roles
--               libetech_ai and libetech_runtime (the migrations before it have not been applied)
--   PRE-023-99  anything else, with its SQLSTATE, never a message (a message of PostgreSQL can quote a row); a bad libetech.thread_order_max_rows (22P02) ends here
--   PRE-023-97  the statements of this file did not run in one session (see above); nothing was read
-- Warning (does not block): PRE-023-W1  another client session of this database holds a lock on public.source_event_revisions, intelligence.ai_drafts, public.draft_decisions or public.projects
-- in a mode that conflicts with SHARE ROW EXCLUSIVE (ROW EXCLUSIVE, SHARE, SHARE UPDATE EXCLUSIVE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE): a writer is in flight. 023 takes its locks one
-- after the other (source_event_revisions first, then ai_drafts, on a second run draft_decisions, and public.projects on a first application); each wait ends at lock_timeout (5 s) with 55P03 and
-- nothing changed. A wait at the first lock holds nothing yet; a wait at a later one happens while 023 already holds the earlier ones, so every intake queues behind it. A session that is only
-- idle in a transaction and holds no such lock is not counted: it cannot make 023 wait.
-- The answer also reports the statement_timeout, lock_timeout and idle_in_transaction_session_timeout (milliseconds, 0 = none) of THIS session: 023 sets none of the first and third, so the
-- statement_timeout of the session that applies it (a role or database default) applies to each of its statements (the 6.65-10.16 s numbering statement of the database review is one of them).
-- The answer holds counts, booleans and fixed codes: never an id, a chat, a thread key, a name or a value of the data.
-- Pure SQL, no psql meta-command and no transaction control, so that the tests can run it in PGlite and through a pool as well as through psql.
DO $pre_023_nonce$
BEGIN
  PERFORM pg_catalog.set_config('libetech.pre_023_nonce', pg_catalog.gen_random_uuid()::text, false);
  PERFORM pg_catalog.set_config('libetech.pre_023_done', '', false);
END
$pre_023_nonce$;
DO $pre_023$
DECLARE
  old_path text;
  nonce text;
  su boolean;
  cap bigint; revisions bigint; unnumbered bigint; undecided bigint; ai_logins bigint; lockers bigint;
  has_all boolean; has_positions boolean; has023 boolean;
  stmt_ms bigint; lock_ms bigint; idle_ms bigint;
  reasons text[] := ARRAY[]::text[]; warnings text[] := ARRAY[]::text[]; migrations_max text;
BEGIN
  nonce := pg_catalog.current_setting('libetech.pre_023_nonce', true);
  IF nonce IS NULL OR nonce = '' THEN
    RAISE EXCEPTION 'PRE-023-97 the statements of this file did not run in one session (a connection pooler in transaction mode?); connect directly and run it again';
  END IF;
  old_path := pg_catalog.current_setting('search_path');
  SELECT s.setting::bigint INTO stmt_ms FROM pg_catalog.pg_settings s WHERE s.name = 'statement_timeout';
  SELECT s.setting::bigint INTO lock_ms FROM pg_catalog.pg_settings s WHERE s.name = 'lock_timeout';
  SELECT s.setting::bigint INTO idle_ms FROM pg_catalog.pg_settings s WHERE s.name = 'idle_in_transaction_session_timeout';
  PERFORM pg_catalog.set_config('search_path', 'pg_catalog, pg_temp', true);
  PERFORM pg_catalog.set_config('lock_timeout', '3s', true);
  BEGIN
    SELECT r.rolsuper INTO su FROM pg_catalog.pg_roles r WHERE r.rolname = current_user;
    IF NOT coalesce(su, false) THEN
      reasons := pg_catalog.array_append(reasons, 'PRE-023-01');
    ELSE
      has_all := pg_catalog.to_regclass('public.source_event_revisions') IS NOT NULL AND pg_catalog.to_regclass('public.source_events') IS NOT NULL
             AND pg_catalog.to_regclass('public.projects') IS NOT NULL AND pg_catalog.to_regclass('intelligence.ai_drafts') IS NOT NULL
             AND pg_catalog.to_regclass('public.draft_decisions') IS NOT NULL AND pg_catalog.to_regprocedure('public.reject_history_mutation()') IS NOT NULL
             AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname = 'libetech_ai')
             AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname = 'libetech_runtime');
      has_positions := pg_catalog.to_regclass('public.source_revision_positions') IS NOT NULL;
      has023 := pg_catalog.to_regclass('public.intake_thread_heads') IS NOT NULL;
      IF NOT has_all THEN
        reasons := pg_catalog.array_append(reasons, 'PRE-023-98');
      ELSE
        cap := coalesce(nullif(pg_catalog.current_setting('libetech.thread_order_max_rows', true), ''), '250000')::bigint;
        EXECUTE 'SELECT count(*) FROM public.source_event_revisions' INTO revisions;
        IF has_positions THEN
          EXECUTE 'SELECT count(*) FROM public.source_event_revisions r WHERE NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = r.id)' INTO unnumbered;
        ELSE
          unnumbered := revisions;
        END IF;
        EXECUTE 'SELECT count(*) FROM intelligence.ai_drafts d WHERE d.entity_type = ''intake_candidate'' AND NOT EXISTS (SELECT 1 FROM public.draft_decisions x WHERE x.draft_id = d.id)' INTO undecided;
        SELECT count(*) INTO ai_logins FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_roles r ON r.oid = a.usesysid
         WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.datname = pg_catalog.current_database() AND NOT r.rolsuper AND pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER');
        IF unnumbered > cap THEN reasons := pg_catalog.array_append(reasons, 'PRE-023-02'); END IF;
        IF unnumbered > 0 AND undecided > 0 THEN reasons := pg_catalog.array_append(reasons, 'PRE-023-03'); END IF;
        IF ai_logins > 0 THEN reasons := pg_catalog.array_append(reasons, 'PRE-023-04'); END IF;
        SELECT count(DISTINCT l.pid) INTO lockers FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_stat_activity a ON a.pid = l.pid
         WHERE l.pid <> pg_catalog.pg_backend_pid() AND a.datname = pg_catalog.current_database() AND a.backend_type = 'client backend'
           AND l.locktype = 'relation' AND l.granted
           AND l.mode IN ('RowExclusiveLock', 'ShareUpdateExclusiveLock', 'ShareLock', 'ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock')
           AND l.relation IN (pg_catalog.to_regclass('public.source_event_revisions'), pg_catalog.to_regclass('intelligence.ai_drafts'),
                              pg_catalog.to_regclass('public.draft_decisions'), pg_catalog.to_regclass('public.projects'));
        IF lockers > 0 THEN warnings := pg_catalog.array_append(warnings, 'PRE-023-W1'); END IF;
        IF pg_catalog.to_regclass('public.schema_migrations') IS NOT NULL THEN
          EXECUTE 'SELECT max(version) FROM public.schema_migrations' INTO migrations_max;
        END IF;
      END IF;
    END IF;
  EXCEPTION
    WHEN query_canceled THEN
      RAISE EXCEPTION 'PRE-023-99 unexpected error (SQLSTATE %)', SQLSTATE;
    WHEN OTHERS THEN
      -- Whatever is not one of ours: a code and a SQLSTATE, never the message.
      RAISE EXCEPTION 'PRE-023-99 unexpected error (SQLSTATE %)', SQLSTATE;
  END;

  PERFORM pg_catalog.set_config('search_path', old_path, true);
  PERFORM pg_catalog.set_config('libetech.pre_023_answer', pg_catalog.json_build_object(
    'pre_023', CASE WHEN pg_catalog.cardinality(reasons) = 0 THEN 'ready' ELSE 'blocked' END,
    'reasons', reasons, 'warnings', warnings,
    'revisions', revisions, 'revisions_without_number', unnumbered, 'cap', cap,
    'undecided_candidate_drafts', undecided, 'ai_logins_connected', ai_logins, 'sessions_with_conflicting_locks', lockers,
    'statement_timeout_ms', stmt_ms, 'lock_timeout_ms', lock_ms, 'idle_in_transaction_timeout_ms', idle_ms,
    'has_023', has023, 'migrations_max', migrations_max)::text, false);
  PERFORM pg_catalog.set_config('libetech.pre_023_done', nonce, false);
END
$pre_023$;
SELECT pg_catalog.current_setting('libetech.pre_023_answer', true) AS result
 WHERE pg_catalog.current_setting('libetech.pre_023_nonce', true) <> ''
   AND pg_catalog.current_setting('libetech.pre_023_done', true) = pg_catalog.current_setting('libetech.pre_023_nonce', true);
