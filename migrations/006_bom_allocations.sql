BEGIN;

CREATE TABLE IF NOT EXISTS bom_scopes (
 tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 seat_ids uuid[] NOT NULL CHECK (cardinality(seat_ids)=3 AND array_lower(seat_ids,1)=1
  AND array_position(seat_ids,NULL) IS NULL
  AND seat_ids[1]<>seat_ids[2] AND seat_ids[1]<>seat_ids[3] AND seat_ids[2]<>seat_ids[3]),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,project_id),
 FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id)
);

-- The approved source importer owns this table. Store a pointer and fingerprint only.
CREATE TABLE IF NOT EXISTS bom_sources (
 work_id uuid PRIMARY KEY, tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 source_ref text NOT NULL, fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
 checked_at timestamptz NOT NULL, valid_until timestamptz NOT NULL CHECK (valid_until>checked_at),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(work_id,tenant_id,project_id) REFERENCES work_items(id,tenant_id,project_id)
);

CREATE TABLE IF NOT EXISTS bom_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL, project_id uuid NOT NULL, work_id uuid NOT NULL,
 prior_id uuid UNIQUE, proposer_id uuid NOT NULL,
 work_version integer NOT NULL, scope_version integer NOT NULL, seat_ids uuid[] NOT NULL,
 source_ref text NOT NULL, source_fingerprint text NOT NULL,
 before_assignment jsonb NOT NULL, proposed_assignment jsonb NOT NULL, reason text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','applied','rejected','revise','cancelled','expired','reconcile')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 FOREIGN KEY(work_id,tenant_id,project_id) REFERENCES work_items(id,tenant_id,project_id),
 FOREIGN KEY(tenant_id,project_id) REFERENCES bom_scopes(tenant_id,project_id),
 UNIQUE(id,tenant_id,project_id),
 FOREIGN KEY(prior_id,tenant_id,project_id) REFERENCES bom_proposals(id,tenant_id,project_id)
);

CREATE TABLE IF NOT EXISTS bom_votes (
 proposal_id uuid NOT NULL, tenant_id uuid NOT NULL, project_id uuid NOT NULL, voter_id uuid NOT NULL,
 choice text NOT NULL CHECK (choice IN ('agree','reject','revise')),
 note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(proposal_id,voter_id),
 FOREIGN KEY(proposal_id,tenant_id,project_id) REFERENCES bom_proposals(id,tenant_id,project_id)
);

CREATE TABLE IF NOT EXISTS bom_receipts (
 proposal_id uuid PRIMARY KEY, tenant_id uuid NOT NULL, project_id uuid NOT NULL, work_id uuid NOT NULL,
 work_version integer NOT NULL, source_checked_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(proposal_id,tenant_id,project_id) REFERENCES bom_proposals(id,tenant_id,project_id),
 FOREIGN KEY(work_id,tenant_id,project_id) REFERENCES work_items(id,tenant_id,project_id),
 UNIQUE(work_id,work_version)
);

CREATE INDEX IF NOT EXISTS bom_proposals_work ON bom_proposals(work_id,created_at DESC);
CREATE INDEX IF NOT EXISTS bom_receipts_work ON bom_receipts(work_id,work_version DESC);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['bom_scopes','bom_sources','bom_proposals','bom_votes','bom_receipts'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('DROP POLICY IF EXISTS scope_policy ON %I',tab);
  EXECUTE format('CREATE POLICY scope_policy ON %I TO libetech_runtime USING
   (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND
    project_id=ANY(string_to_array(coalesce(current_setting(''app.project_ids'',true),''''),'','')::uuid[]))
   WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND
    project_id=ANY(string_to_array(coalesce(current_setting(''app.project_ids'',true),''''),'','')::uuid[]))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['bom_votes','bom_receipts'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS immutable_history ON %I',tab);
  EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON %I
   FOR EACH ROW EXECUTE FUNCTION reject_history_mutation()',tab);
 END LOOP;
END $$;
GRANT SELECT ON bom_scopes,bom_sources,bom_proposals,bom_votes,bom_receipts TO libetech_runtime;
GRANT INSERT ON bom_proposals,bom_votes,bom_receipts TO libetech_runtime;
GRANT UPDATE (state,finished_at,updated_at) ON bom_proposals TO libetech_runtime;
-- PostgreSQL requires an update privilege for row locks. Policy fields remain operator-only.
GRANT UPDATE (updated_at) ON bom_scopes,bom_sources TO libetech_runtime;
GRANT UPDATE (updated_at) ON identity.memberships,identity.telegram_links TO libetech_identity;

-- Runtime receives eligibility for requested IDs in the current project, never credential material.
CREATE OR REPLACE FUNCTION public.bom_eligible_members(target_project uuid, candidates uuid[], lock_rows boolean DEFAULT false)
RETURNS TABLE(user_id uuid, project_role text, linked boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF lock_rows THEN
  PERFORM u.id FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
   WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND m.project_id=target_project
    AND u.id=ANY(candidates)
    AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
   ORDER BY u.id FOR SHARE OF u,m;
  PERFORM l.user_id FROM identity.telegram_links l
   WHERE l.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND l.user_id=ANY(candidates)
    AND EXISTS(SELECT 1 FROM identity.memberships m WHERE m.tenant_id=l.tenant_id AND m.user_id=l.user_id
      AND m.project_id=target_project)
    AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
   ORDER BY l.user_id FOR SHARE OF l;
 END IF;
 RETURN QUERY
 SELECT u.id,coalesce(m.project_role,u.role),
  EXISTS(SELECT 1 FROM identity.telegram_links l WHERE l.tenant_id=u.tenant_id AND l.user_id=u.id)
 FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
 WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
   AND m.project_id=target_project AND u.id=ANY(candidates)
   AND target_project=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
   AND u.active AND u.password_hash IS NOT NULL;
END;
$$;
ALTER FUNCTION public.bom_eligible_members(uuid,uuid[],boolean) OWNER TO libetech_identity;
REVOKE ALL ON FUNCTION public.bom_eligible_members(uuid,uuid[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bom_eligible_members(uuid,uuid[],boolean) TO libetech_runtime;

CREATE OR REPLACE FUNCTION public.bom_guard_assignment() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id
  AND EXISTS(SELECT 1 FROM public.bom_scopes s
    WHERE s.tenant_id=OLD.tenant_id AND s.project_id=OLD.project_id AND s.enabled)
  AND NOT EXISTS(
    SELECT 1 FROM public.bom_receipts r JOIN public.bom_proposals b ON b.id=r.proposal_id
    WHERE r.work_id=OLD.id AND r.work_version=OLD.version+1 AND NEW.version=r.work_version
      AND b.work_version=OLD.version AND b.proposed_assignment->>'lead_id'=NEW.assignee_id::text
      AND (SELECT count(*) FROM public.bom_votes v
        WHERE v.proposal_id=b.id AND v.choice='agree' AND v.voter_id=ANY(b.seat_ids))=3
  ) THEN
   RAISE EXCEPTION 'BoM receipt with 3/3 votes required for allocation';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bom_assignment_required ON work_items;
CREATE TRIGGER bom_assignment_required BEFORE UPDATE OF assignee_id ON work_items
 FOR EACH ROW EXECUTE FUNCTION public.bom_guard_assignment();

INSERT INTO schema_migrations(version) VALUES('006') ON CONFLICT(version) DO NOTHING;
COMMIT;
