-- OQ-45 point 3 (b), decided by the Chairman on 18/11/2026: an AI draft of a project whose latest domain mapping is IBS_HI is refused when it is
-- written (AGENTS.md:16). A BEFORE INSERT guard on intelligence.ai_drafts reads the one fact it needs: the mapping row with the highest
-- mapping_version of the row's own tenant and project (the rule of isIbsHiSql in src/server/source-text.ts). Unmapped and other labels decide nothing.
-- The function is SECURITY DEFINER and is a trigger function: libetech_ai is granted nothing, cannot call it, and reads no mapping row. What the AI
-- role can tell from an insert attempt is one bit for the (tenant, project) the row names, whatever context it set: BEFORE ROW triggers fire before
-- the WITH CHECK of row-level security. row_security = off makes the function fail closed: an owner that row-level security would filter gets an
-- error, never an empty read. Apply as the migration login (a superuser), like 019–021. The guard binds every writer, the operational login included.
-- The guard also refuses a write from a transaction that is not READ COMMITTED (LTZ02): only that level reads the latest mapping.
-- Nothing here switches anything on: no login, no password, no key, no membership, no grant, no model. No data rows except schema_migrations.
-- Rollback: migrations/rollback/022_ai_drafts_pointer_only_guard.sql (refuses while a later migration is recorded).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION intelligence.ai_drafts_pointer_only_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
DECLARE latest text;
BEGIN
  -- The mapping is read under the snapshot of the calling transaction. Only READ COMMITTED gives this statement a fresh one: a REPEATABLE READ or
  -- SERIALIZABLE transaction opened before an IBS_HI mapping was committed would not see it and the draft would be stored (measured on PostgreSQL 16).
  -- Any other isolation level is refused, whatever the project.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'An AI draft is written in a READ COMMITTED transaction' USING ERRCODE = 'LTZ02';
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

DROP TRIGGER IF EXISTS ai_drafts_pointer_only_guard ON intelligence.ai_drafts;
CREATE TRIGGER ai_drafts_pointer_only_guard BEFORE INSERT ON intelligence.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION intelligence.ai_drafts_pointer_only_guard();

INSERT INTO schema_migrations(version) VALUES('022') ON CONFLICT(version) DO NOTHING;
COMMIT;
