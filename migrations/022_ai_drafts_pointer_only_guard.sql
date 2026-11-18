-- OQ-45 point 3 (b), decided by the Chairman on 18/11/2026: an AI draft of a project whose latest domain mapping is IBS_HI is refused when it is
-- written (AGENTS.md:16). Three BEFORE INSERT row triggers and no grant:
-- 1. ai_drafts_declared_scope_guard (SECURITY INVOKER; fires first: triggers of one event fire in name order). For a role that row-level security
--    binds on intelligence.ai_drafts, a row that the insert policy ai_insert (021) would refuse is refused here, with the policy's own answer (42501),
--    before any mapping is read: such a role cannot tell an IBS_HI project outside the scope it declared from any other project. The scope is the one
--    the role declared (app.*); what a holder of the role may declare is the business of the AI login design, not of this file.
-- 2. ai_drafts_pointer_only_guard (SECURITY DEFINER, owned by the migration login). It refuses a transaction that is not READ COMMITTED (LTZ02), locks
--    the project row of the draft FOR NO KEY UPDATE, refuses a row whose project row it cannot see (23503, the answer of the foreign key), then reads
--    the mapping row with the highest mapping_version of the row's own tenant and project (the rule of isIbsHiSql in src/server/source-text.ts) and
--    refuses IBS_HI (LTZ01). Unmapped and other labels decide nothing. row_security = off makes it fail closed: an owner that row-level security would
--    filter gets an error, never an empty read. It binds every writer, the operational login included.
-- 3. project_domain_mappings_draft_lock on public.project_domain_mappings (SECURITY DEFINER, same owner, same settings). A mapping insert locks the
--    same project row FOR NO KEY UPDATE and refuses when it cannot see it, so a draft insert and a mapping insert of one project take turns: the guard
--    reads a mapping that is committed, or the mapping waits for the draft and the draft was stored first. The mapping table is append-only (013):
--    INSERT is its only write.
-- The lock is a row lock on public.projects: the row that the foreign keys of both tables already lock (FOR KEY SHARE) on every insert, here at a
-- higher strength; no column changes. Only a role that may write public.projects can take it by itself, and no runtime role may (SELECT only: 001,
-- 010, 016). FOR NO KEY UPDATE does not wait for, and is not waited for by, an insert into any other table that references the project.
-- Both sides take the same strength on purpose: waiters then queue in order of arrival. With FOR SHARE in the guard, draft inserts that keep
-- overlapping starve a mapping insert without any bound (measured on PostgreSQL 16:
-- docs/reviews/oq-45-46-evidence-20261118/measurements-pg16-rowlock.txt). The price: draft inserts of one project run one at a time while their
-- transactions are open, and an open one makes an UPDATE of that project row wait.
-- Functions 2 and 3 wait under a lock_timeout of their own (5s, set in the function definition, whatever the session says): a wait that long ends in
-- 55P03 and the statement writes nothing.
-- libetech_ai is granted nothing and can call none of the three functions. Apply as the migration login (a superuser), like 019–021.
-- Nothing here switches anything on: no login, no password, no key, no membership, no grant, no model. No data rows except schema_migrations.
-- Rollback: migrations/rollback/022_ai_drafts_pointer_only_guard.sql (refuses while a later migration is recorded).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION intelligence.ai_drafts_declared_scope_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  -- Judged only for a role that row-level security binds on this table: the operational login is not bound and goes on to the pointer-only guard.
  -- The outer IF stands alone, so a role that is not bound never evaluates the app.* settings below.
  IF pg_catalog.row_security_active(TG_RELID) THEN
    -- The condition is the WITH CHECK of the policy ai_insert (021), word for word, on the new row. The answer is the one the policy itself gives.
    IF (
         NEW.tenant_id = nullif(pg_catalog.current_setting('app.tenant_id', true), '')::uuid
         AND NEW.project_id = ANY(pg_catalog.string_to_array(coalesce(pg_catalog.current_setting('app.project_ids', true), ''), ',')::uuid[])
         AND NEW.ai_principal_id = nullif(pg_catalog.current_setting('app.ai_principal_id', true), '')::uuid
       ) IS NOT TRUE THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "%"', TG_TABLE_NAME USING ERRCODE = '42501',
        HINT = 'Raised by the trigger ai_drafts_declared_scope_guard (migration 022), which mirrors the WITH CHECK of the policy ai_insert. If the policy would let this row through, the two have drifted apart: correct the trigger; do not relax row-level security.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.ai_drafts_declared_scope_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION intelligence.ai_drafts_pointer_only_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE latest text;
BEGIN
  -- The mapping is read under the snapshot of the calling transaction. Only READ COMMITTED gives this statement a fresh one: a REPEATABLE READ or
  -- SERIALIZABLE transaction opened before an IBS_HI mapping was committed would not see it and the draft would be stored (measured on PostgreSQL 16).
  -- Any other isolation level is refused, whatever the project.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'An AI draft is written in a READ COMMITTED transaction' USING ERRCODE = 'LTZ02';
  END IF;
  -- A row without a tenant or a project is answered by the table (23502).
  IF NEW.tenant_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    -- The project row is locked to the end of this transaction, in conflict with the same lock of a mapping insert of the project
    -- (project_domain_mappings_draft_lock) and of another draft insert of the project. It is a statement of its own, before the read: the read below
    -- then takes its snapshot after the wait and sees a mapping that was committed meanwhile. The wait is capped by the lock_timeout of this
    -- function: past it the insert fails with 55P03 and no draft is stored.
    PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      -- A project row this statement cannot see cannot be locked, so a mapping written with it could commit unseen: refused, with the answer the
      -- foreign key of the table gives for a pair that does not exist.
      RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "ai_drafts_project_id_tenant_id_fkey"', TG_TABLE_NAME
        USING ERRCODE = '23503', SCHEMA = TG_TABLE_SCHEMA, TABLE = TG_TABLE_NAME, CONSTRAINT = 'ai_drafts_project_id_tenant_id_fkey',
        HINT = 'Raised by the trigger ai_drafts_pointer_only_guard (migration 022): no project row of this tenant is visible to this statement.';
    END IF;
  END IF;
  SELECT m.domain_code INTO latest FROM public.project_domain_mappings m
   WHERE m.tenant_id = NEW.tenant_id AND m.project_id = NEW.project_id
   ORDER BY m.mapping_version DESC LIMIT 1;
  IF latest = 'IBS_HI' THEN
    RAISE EXCEPTION 'An AI draft is not stored for a pointer-only project' USING ERRCODE = 'LTZ01';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.ai_drafts_pointer_only_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION intelligence.project_domain_mappings_draft_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
BEGIN
  -- A row without a tenant or a project is answered by the table (23502).
  IF NEW.tenant_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    -- Held to the end of the transaction that writes the mapping: a draft insert of this project waits for it, and it waits for draft inserts in
    -- flight. An insert into any other table that references the project is not held up (FOR KEY SHARE). The wait is capped by the lock_timeout of
    -- this function: past it the insert fails with 55P03 and no mapping is written.
    PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "project_domain_mappings_project_id_tenant_id_fkey"', TG_TABLE_NAME
        USING ERRCODE = '23503', SCHEMA = TG_TABLE_SCHEMA, TABLE = TG_TABLE_NAME, CONSTRAINT = 'project_domain_mappings_project_id_tenant_id_fkey',
        HINT = 'Raised by the trigger project_domain_mappings_draft_lock (migration 022): no project row of this tenant is visible to this statement.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.project_domain_mappings_draft_lock() FROM PUBLIC;

DROP TRIGGER IF EXISTS ai_drafts_declared_scope_guard ON intelligence.ai_drafts;
CREATE TRIGGER ai_drafts_declared_scope_guard BEFORE INSERT ON intelligence.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION intelligence.ai_drafts_declared_scope_guard();
DROP TRIGGER IF EXISTS ai_drafts_pointer_only_guard ON intelligence.ai_drafts;
CREATE TRIGGER ai_drafts_pointer_only_guard BEFORE INSERT ON intelligence.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION intelligence.ai_drafts_pointer_only_guard();
DROP TRIGGER IF EXISTS project_domain_mappings_draft_lock ON public.project_domain_mappings;
CREATE TRIGGER project_domain_mappings_draft_lock BEFORE INSERT ON public.project_domain_mappings
  FOR EACH ROW EXECUTE FUNCTION intelligence.project_domain_mappings_draft_lock();

INSERT INTO schema_migrations(version) VALUES('022') ON CONFLICT(version) DO NOTHING;
COMMIT;
