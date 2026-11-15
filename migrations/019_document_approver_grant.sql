-- Slice 3, OQ-31 (b): the right to approve a document's canonical revision, per document type, is carried by the existing report_permissions
-- list of a project membership as eight codes doc_approve:<type>. It is granted only through the existing access-change ballot of 018
-- (OQ-29: one BoM agreeing). No new ballot kind, no new voting rule, no table, no data row: this file only widens the value set of one
-- column (expand), adds a trigger that stops a code entering a membership without a ballot that names it, and adds one read function.
-- Rollback: migrations/rollback/019_document_approver_grant.sql (refuses while a membership or a ballot carries a doc_approve code).
-- Lock (Database review M-1): ALTER TABLE takes ACCESS EXCLUSIVE on identity.memberships. After 5 s the whole file (one transaction) fails
-- and is retried; nothing is applied in part.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1. The new permission set is added first, every other CHECK on report_permissions is dropped after, so the column is never unchecked.
DO $$
DECLARE old_check record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname='memberships_grant_permissions_check' AND conrelid='identity.memberships'::regclass) THEN
    ALTER TABLE identity.memberships ADD CONSTRAINT memberships_grant_permissions_check CHECK (
      report_permissions <@ ARRAY['people_read','quality_review','report_approve',
        'doc_approve:project_index','doc_approve:change_brief','doc_approve:requirements','doc_approve:design',
        'doc_approve:plan','doc_approve:verification','doc_approve:guide','doc_approve:other']::text[]);
  END IF;
  -- found by definition, not by name: 004 declared the old CHECK inline on the column
  FOR old_check IN SELECT c.conname FROM pg_catalog.pg_constraint c
    WHERE c.conrelid='identity.memberships'::regclass AND c.contype='c' AND c.conname<>'memberships_grant_permissions_check'
      AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%report_permissions%'
  LOOP
    EXECUTE pg_catalog.format('ALTER TABLE identity.memberships DROP CONSTRAINT %I',old_check.conname);
  END LOOP;
END $$;

-- 2. A doc_approve code enters a row only if an approved or issued access-change ballot of the same tenant, for this person, names this project
-- and this exact code. Runs as the writing role, for every role including the operational login; not SECURITY DEFINER.
CREATE OR REPLACE FUNCTION identity.memberships_doc_approve_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE code text;
BEGIN
  FOR code IN SELECT c FROM pg_catalog.unnest(NEW.report_permissions) AS c WHERE pg_catalog.strpos(c,'doc_approve:')=1 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM identity.account_approvals a
      WHERE a.tenant_id=NEW.tenant_id AND a.kind='access_change' AND a.subject_user_id=NEW.user_id AND a.state IN ('approved','issued')
        AND EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(a.grants) g
          WHERE pg_catalog.lower(g->>'projectId')=pg_catalog.format('%s',NEW.project_id)
            AND pg_catalog.jsonb_typeof(g->'reportPermissions')='array'
            AND pg_catalog.jsonb_exists(g->'reportPermissions',code))
    ) THEN
      RAISE EXCEPTION 'Document approval needs an approved access-change ballot that names it';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS memberships_doc_approve_guard ON identity.memberships;
CREATE TRIGGER memberships_doc_approve_guard BEFORE INSERT OR UPDATE OF report_permissions, project_id, user_id, tenant_id ON identity.memberships
  FOR EACH ROW EXECUTE FUNCTION identity.memberships_doc_approve_guard();

-- 3. Read for the runtime role: who may approve which document types in the project in scope. The runtime role cannot read memberships
-- or users; this function returns only rows of the tenant in app.tenant_id, only when the project is in app.project_ids, only active
-- activated accounts, and never a viewer or bot (effective role = project role first, as bom_eligible_members in 006).
CREATE OR REPLACE FUNCTION public.document_approvers(target_project uuid)
RETURNS TABLE(user_id uuid, doc_types text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT m.user_id, pg_catalog.array_agg(DISTINCT pg_catalog.substr(c,13) ORDER BY pg_catalog.substr(c,13)) AS doc_types
  FROM identity.memberships m
  JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
  CROSS JOIN LATERAL pg_catalog.unnest(m.report_permissions) AS c
  WHERE m.tenant_id=nullif(pg_catalog.current_setting('app.tenant_id',true),'')::uuid
    AND m.project_id=target_project
    AND target_project=ANY(pg_catalog.string_to_array(coalesce(pg_catalog.current_setting('app.project_ids',true),''),',')::uuid[])
    AND u.active AND u.password_hash IS NOT NULL
    AND coalesce(m.project_role,u.role) IN ('manager','engineer','technical','business')
    AND pg_catalog.strpos(c,'doc_approve:')=1
  GROUP BY m.user_id
$$;
ALTER FUNCTION public.document_approvers(uuid) OWNER TO libetech_identity;
REVOKE ALL ON FUNCTION public.document_approvers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.document_approvers(uuid) TO libetech_runtime;

INSERT INTO schema_migrations(version) VALUES('019') ON CONFLICT(version) DO NOTHING;
COMMIT;
