-- 030 · OQ-61 B6 (2): a wrong message–work link is taken back by its own event (GIAO VIỆC 7 moved B6 to D–F). Zone Z1.
-- 1. intake_link_revocations: one append-only row per revoked link (UNIQUE(tenant_id, link_id)): who, when and a fixed reason code. No free text, so a link of an
--    IBS HI project gains no business text. The link row itself is never changed (025). Written only in the actor's own name, by the link's creator or a BoM seat
--    of the link's project; read by whoever reads the link.
-- 2. intake_pool_events gains the kind pool.link_revoked, and its closed payload gains link_id (a UUID) and reason_code (the four codes), nothing else.
-- 3. intake_pool_links_outside (025) no longer counts a revoked link, so an item whose links were revoked can be opened again.
-- Rollback: migrations/rollback/030_intake_link_revocations.sql; it refuses while a revocation or its event exists.
BEGIN;

CREATE TABLE IF NOT EXISTS intake_link_revocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 link_id uuid NOT NULL REFERENCES intake_work_links(id),
 revoked_by uuid NOT NULL, revoked_by_name text NOT NULL CHECK (length(revoked_by_name) BETWEEN 1 AND 200),
 reason_code text NOT NULL CHECK (reason_code IN ('wrong_work','wrong_message','wrong_project','mistake')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id),
 FOREIGN KEY (revoked_by,tenant_id) REFERENCES identity.users(id,tenant_id),
 -- a link is revoked once; a second revoke of it is ON CONFLICT DO NOTHING
 UNIQUE (tenant_id,link_id)
);
CREATE INDEX IF NOT EXISTS idx_intake_link_revocations_created ON intake_link_revocations(created_at);
CREATE INDEX IF NOT EXISTS idx_intake_link_revocations_link_fk ON intake_link_revocations(link_id);
CREATE INDEX IF NOT EXISTS idx_intake_link_revocations_project_fk ON intake_link_revocations(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_intake_link_revocations_actor_fk ON intake_link_revocations(revoked_by,tenant_id);

ALTER TABLE intake_link_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_link_revocations FORCE ROW LEVEL SECURITY;
-- read by whoever reads the link: the subquery runs under the caller's own row level security on intake_work_links
DROP POLICY IF EXISTS runtime_select ON intake_link_revocations;
CREATE POLICY runtime_select ON intake_link_revocations FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS (SELECT 1 FROM intake_work_links l WHERE l.id=intake_link_revocations.link_id));
DROP POLICY IF EXISTS runtime_insert ON intake_link_revocations;
CREATE POLICY runtime_insert ON intake_link_revocations FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND revoked_by=nullif(current_setting('app.person_id',true),'')::uuid
  AND EXISTS (SELECT 1 FROM intake_work_links l WHERE l.id=intake_link_revocations.link_id AND l.tenant_id=intake_link_revocations.tenant_id
    AND l.project_id=intake_link_revocations.project_id
    AND (l.created_by=nullif(current_setting('app.person_id',true),'')::uuid OR public.work_request_seat(l.project_id))));
DROP POLICY IF EXISTS identity_blockers ON intake_link_revocations;
CREATE POLICY identity_blockers ON intake_link_revocations FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

DROP TRIGGER IF EXISTS immutable_history ON intake_link_revocations;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON intake_link_revocations FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

GRANT SELECT ON intake_link_revocations TO libetech_runtime;
GRANT INSERT (tenant_id,project_id,link_id,revoked_by,revoked_by_name,reason_code) ON intake_link_revocations TO libetech_runtime;
GRANT SELECT (tenant_id,link_id) ON intake_link_revocations TO libetech_identity;
GRANT SELECT (id) ON intake_work_links TO libetech_identity;

DO $$ DECLARE c text; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.intake_pool_events'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%pool.reopened%' LOOP
  EXECUTE format('ALTER TABLE public.intake_pool_events DROP CONSTRAINT %I',c);
 END LOOP;
END $$;
ALTER TABLE intake_pool_events ADD CONSTRAINT intake_pool_events_kind_check
 CHECK (kind IN ('pool.received','pool.revised','pool.triaged','pool.request_filed','pool.work_linked','pool.dismissed','pool.reopened','pool.link_revoked'));

-- the 025 payload rule (keys and values closed) with link_id and reason_code
DO $$ DECLARE c text; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.intake_pool_events'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%dismiss_code%' LOOP
  EXECUTE format('ALTER TABLE public.intake_pool_events DROP CONSTRAINT %I',c);
 END LOOP;
END $$;
ALTER TABLE intake_pool_events ADD CONSTRAINT intake_pool_events_payload_check CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text)<=2048
  AND payload - ARRAY['state_before','state_after','version_before','version_after','project_id','classification','revision_no','dismiss_code','link_id','reason_code']::text[] = '{}'::jsonb
  AND coalesce(jsonb_typeof(payload->'state_before'),'string')='string' AND coalesce(payload->>'state_before','unassigned') IN ('unassigned','assigned','dismissed')
  AND coalesce(jsonb_typeof(payload->'state_after'),'string')='string' AND coalesce(payload->>'state_after','unassigned') IN ('unassigned','assigned','dismissed')
  AND coalesce(jsonb_typeof(payload->'version_before'),'number')='number' AND coalesce(jsonb_typeof(payload->'version_after'),'number')='number'
  AND coalesce(jsonb_typeof(payload->'revision_no'),'number')='number'
  AND coalesce(jsonb_typeof(payload->'project_id'),'string') IN ('string','null')
  AND coalesce(payload->>'project_id','00000000-0000-4000-8000-000000000000') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND coalesce(jsonb_typeof(payload->'classification'),'string') IN ('string','null') AND coalesce(payload->>'classification','request') IN ('incident','request','document')
  AND coalesce(jsonb_typeof(payload->'dismiss_code'),'string')='string' AND coalesce(payload->>'dismiss_code','not_work') IN ('not_work','duplicate','wrong_group')
  AND coalesce(jsonb_typeof(payload->'link_id'),'string')='string' AND coalesce(payload->>'link_id','00000000-0000-4000-8000-000000000000') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND coalesce(jsonb_typeof(payload->'reason_code'),'string')='string' AND coalesce(payload->>'reason_code','mistake') IN ('wrong_work','wrong_message','wrong_project','mistake'));

-- the 025 body, with revoked links left out (CREATE OR REPLACE keeps the owner and the grants)
CREATE OR REPLACE FUNCTION public.intake_pool_links_outside(item uuid, target_project uuid, readable uuid[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN public.app_actor_is_tech_member() THEN
  EXISTS (SELECT 1 FROM public.intake_work_links l
   WHERE l.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND l.pool_item_id=item AND l.project_id=target_project
    AND NOT EXISTS (SELECT 1 FROM public.intake_link_revocations v WHERE v.tenant_id=l.tenant_id AND v.link_id=l.id)
    AND NOT coalesce(l.work_request_id = ANY(readable), false))
 END
$$;

INSERT INTO schema_migrations(version) VALUES('030') ON CONFLICT(version) DO NOTHING;
COMMIT;
