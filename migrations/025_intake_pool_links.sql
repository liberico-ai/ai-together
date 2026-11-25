-- 025 — Intake pool and links from a message to work (GIAO VIỆC 5, hạng mục B; Chairman 25/11/2026: a Telegram message becomes intake with an IN code
-- and a receipt, then triage, then a work request or a link to existing work, then BoM approval; each step its own event).
-- Additive and idempotent. Rollback: migrations/rollback/025_intake_pool_links.sql (never on a serving database without Chairman approval).
--
-- What it adds:
-- 1. public.intake_pool_items (Z1, tenant level): one row per message of a shared group that the operator listed as a pool group. A pool item has no
--    project until a Team Tech member triages it. It stores pointers, a hash and a few counters, and has NO column for message text, file names or
--    sender labels, for any domain (AGENTS.md: IBS HI = pointers, hashes and Tech work metadata only; the domain is known only after triage, so no
--    text is ever kept for a pool item).
-- 2. public.intake_pool_events: append-only history of a pool item, payload limited to ids, states and versions.
-- 3. public.intake_work_links (Z1, project level, append-only): the link from a pool item or an intake candidate to a work request filed from it or to
--    an existing work item.
-- 4. Four SECURITY DEFINER functions owned by libetech_identity (search_path=pg_catalog, closed to PUBLIC): intake_pool_sender, intake_link_allowed,
--    tech_roster_names and intake_pool_links_outside. The actor is read from app.person_id, set by the service from the session (the convention of 024).
BEGIN;

CREATE TABLE IF NOT EXISTS intake_pool_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 source_id text NOT NULL, source_type text NOT NULL CHECK (source_type='telegram_gateway'),
 ingested_at timestamptz NOT NULL DEFAULT now(), quality_score smallint NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
 chat_id text NOT NULL CHECK (chat_id ~ '^-[1-9][0-9]*$'), topic_id text NOT NULL DEFAULT '',
 message_id text NOT NULL CHECK (message_id ~ '^[1-9][0-9]{0,19}$'), reply_to_message_id text, locator text NOT NULL DEFAULT '',
 sender_id uuid NOT NULL, observed_at timestamptz NOT NULL, edited_at timestamptz,
 content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'), revision_count integer NOT NULL DEFAULT 0 CHECK (revision_count>=0),
 forwarded boolean NOT NULL DEFAULT false, attachment_mime text CHECK (attachment_mime IS NULL OR length(attachment_mime)<=100),
 attachment_size bigint CHECK (attachment_size IS NULL OR attachment_size>=0),
 state text NOT NULL DEFAULT 'unassigned' CHECK (state IN ('unassigned','assigned','dismissed')),
 classification text CHECK (classification IS NULL OR classification IN ('incident','request','document')),
 dismiss_code text CHECK (dismiss_code IS NULL OR dismiss_code IN ('not_work','duplicate','wrong_group')),
 project_id uuid, triaged_by uuid, triaged_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK (version>0), trace_id uuid NOT NULL, correlation_id uuid NOT NULL,
 FOREIGN KEY (sender_id,tenant_id) REFERENCES identity.users(id,tenant_id),
 FOREIGN KEY (triaged_by,tenant_id) REFERENCES identity.users(id,tenant_id),
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id),
 UNIQUE (id,tenant_id), UNIQUE (tenant_id,source_type,chat_id,message_id),
 -- integrity of the record: a project only with the assigned state, a code only with the dismissed state, a triager once somebody triaged
 CHECK ((state='assigned')=(project_id IS NOT NULL)),
 CHECK ((state='assigned')=(classification IS NOT NULL)),
 CHECK ((state='dismissed')=(dismiss_code IS NOT NULL)),
 CHECK ((state='unassigned')=(triaged_by IS NULL AND triaged_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_intake_pool_items_created ON intake_pool_items(created_at);
CREATE INDEX IF NOT EXISTS idx_intake_pool_items_scope_state ON intake_pool_items(tenant_id,state,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_pool_items_sender_fk ON intake_pool_items(sender_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_intake_pool_items_triager_fk ON intake_pool_items(triaged_by,tenant_id);
CREATE INDEX IF NOT EXISTS idx_intake_pool_items_project_fk ON intake_pool_items(project_id,tenant_id);

CREATE TABLE IF NOT EXISTS intake_pool_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, pool_item_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 -- events written in one transaction share its clock; seq is the order they were written in
 seq bigint GENERATED ALWAYS AS IDENTITY,
 actor_id uuid NOT NULL, actor_kind text NOT NULL CHECK (actor_kind IN ('user','intake_service')),
 kind text NOT NULL CHECK (kind IN ('pool.received','pool.revised','pool.triaged','pool.request_filed','pool.work_linked','pool.dismissed','pool.reopened')),
 request_id uuid NOT NULL, trace_id uuid NOT NULL,
 -- the keys AND their values are closed: states and codes from their lists, numbers, a project id. No key can carry text (Codex, PR B).
 payload jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text)<=2048
  AND payload - ARRAY['state_before','state_after','version_before','version_after','project_id','classification','revision_no','dismiss_code']::text[] = '{}'::jsonb
  AND coalesce(jsonb_typeof(payload->'state_before'),'string')='string' AND coalesce(payload->>'state_before','unassigned') IN ('unassigned','assigned','dismissed')
  AND coalesce(jsonb_typeof(payload->'state_after'),'string')='string' AND coalesce(payload->>'state_after','unassigned') IN ('unassigned','assigned','dismissed')
  AND coalesce(jsonb_typeof(payload->'version_before'),'number')='number' AND coalesce(jsonb_typeof(payload->'version_after'),'number')='number'
  AND coalesce(jsonb_typeof(payload->'revision_no'),'number')='number'
  AND coalesce(jsonb_typeof(payload->'project_id'),'string') IN ('string','null')
  AND coalesce(payload->>'project_id','00000000-0000-4000-8000-000000000000') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND coalesce(jsonb_typeof(payload->'classification'),'string') IN ('string','null') AND coalesce(payload->>'classification','request') IN ('incident','request','document')
  AND coalesce(jsonb_typeof(payload->'dismiss_code'),'string')='string' AND coalesce(payload->>'dismiss_code','not_work') IN ('not_work','duplicate','wrong_group')),
 FOREIGN KEY (pool_item_id,tenant_id) REFERENCES intake_pool_items(id,tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_intake_pool_events_item ON intake_pool_events(pool_item_id,tenant_id,created_at);
CREATE INDEX IF NOT EXISTS idx_intake_pool_events_created ON intake_pool_events(created_at);

CREATE TABLE IF NOT EXISTS intake_work_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 candidate_id uuid, pool_item_id uuid, work_request_id uuid, work_id uuid,
 created_by uuid NOT NULL, created_by_name text NOT NULL CHECK (length(created_by_name) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 source_key text GENERATED ALWAYS AS (coalesce(candidate_id,pool_item_id)::text) STORED,
 target_key text GENERATED ALWAYS AS (coalesce(work_request_id,work_id)::text) STORED,
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id),
 FOREIGN KEY (candidate_id,tenant_id,project_id) REFERENCES intake_candidates(id,tenant_id,project_id),
 FOREIGN KEY (pool_item_id,tenant_id) REFERENCES intake_pool_items(id,tenant_id),
 FOREIGN KEY (work_request_id,tenant_id,project_id) REFERENCES work_requests(id,tenant_id,project_id),
 FOREIGN KEY (work_id,tenant_id,project_id) REFERENCES work_items(id,tenant_id,project_id),
 FOREIGN KEY (created_by,tenant_id) REFERENCES identity.users(id,tenant_id),
 CHECK ((candidate_id IS NULL)<>(pool_item_id IS NULL)),
 CHECK ((work_request_id IS NULL)<>(work_id IS NULL)),
 -- linking the same pair again is ON CONFLICT DO NOTHING; a request is filed from exactly one source
 UNIQUE (tenant_id,source_key,target_key), UNIQUE (work_request_id)
);
CREATE INDEX IF NOT EXISTS idx_intake_work_links_created ON intake_work_links(created_at);
CREATE INDEX IF NOT EXISTS idx_intake_work_links_project_fk ON intake_work_links(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_intake_work_links_candidate_fk ON intake_work_links(candidate_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_intake_work_links_pool_fk ON intake_work_links(pool_item_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_intake_work_links_work_fk ON intake_work_links(work_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_intake_work_links_creator_fk ON intake_work_links(created_by,tenant_id);

-- The actor of the transaction is the sender of a message of a pool group: linked to Telegram, active, activated and on the roster of the tenant in
-- app.tenant_id. Anybody else (and any other tenant) gives NULL. EXECUTE only for the intake role.
CREATE OR REPLACE FUNCTION public.intake_pool_sender(telegram text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT l.user_id FROM identity.telegram_links l
  JOIN identity.tech_roster r ON r.tenant_id=l.tenant_id AND r.user_id=l.user_id
  JOIN identity.users u ON u.id=l.user_id AND u.tenant_id=l.tenant_id
 WHERE l.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND l.telegram_id=telegram AND u.active AND u.password_hash IS NOT NULL
 LIMIT 1
$$;
-- The actor may link a message to existing work in a project: a member with a project role other than viewer, or a BoM seat of the project.
CREATE OR REPLACE FUNCTION public.intake_link_allowed(target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (SELECT 1 FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
   WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND m.project_id=target_project
    AND m.user_id=nullif(current_setting('app.person_id',true),'')::uuid AND m.project_role<>'viewer' AND u.active AND u.password_hash IS NOT NULL)
  OR public.work_request_seat(target_project)
$$;
-- The names of the Team Tech roster, for a Team Tech member only (to show who sent and who triaged a pool item). Empty for anybody else.
CREATE OR REPLACE FUNCTION public.tech_roster_names() RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id,u.name FROM identity.tech_roster r JOIN identity.users u ON u.id=r.user_id AND u.tenant_id=r.tenant_id
 WHERE r.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.app_actor_is_tech_member()
 ORDER BY u.name,u.id
$$;
-- Whether the pool item holds, in a project, any link other than to the requests the caller names: one bit, never a number. The service names the rejected
-- requests the caller reads under its own row level security, so reopening answers the same whatever a BoM seat decided. A caller who reads nothing of the project
-- learns nothing: request ids are random and shown only to their readers, and an item that was ever assigned to a project holds a link there (its triage wrote one,
-- and its events, which every roster member reads, name the project). A NULL in the list matches nothing. NULL for anybody who is not Team Tech.
-- (Codex, PR B: the earlier intake_pool_link_count returned the number of links to any roster member.)
GRANT SELECT (tenant_id,pool_item_id,project_id,work_request_id) ON intake_work_links TO libetech_identity;
CREATE OR REPLACE FUNCTION public.intake_pool_links_outside(item uuid, target_project uuid, readable uuid[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN public.app_actor_is_tech_member() THEN
  EXISTS (SELECT 1 FROM public.intake_work_links l
   WHERE l.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND l.pool_item_id=item AND l.project_id=target_project
    AND NOT coalesce(l.work_request_id = ANY(readable), false))
 END
$$;

ALTER TABLE intake_pool_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_pool_items FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_pool_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_pool_events FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_work_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_work_links FORCE ROW LEVEL SECURITY;

-- The runtime policy functions below are created before the functions above are handed to their owner; the owner change and grants come after the policies.
DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['public.intake_pool_sender(text)','public.intake_link_allowed(uuid)','public.tech_roster_names()','public.intake_pool_links_outside(uuid,uuid,uuid[])'] LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO libetech_identity',f);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
 END LOOP;
 GRANT EXECUTE ON FUNCTION public.intake_pool_sender(text) TO libetech_intake;
 GRANT EXECUTE ON FUNCTION public.intake_link_allowed(uuid), public.tech_roster_names(), public.intake_pool_links_outside(uuid,uuid,uuid[]) TO libetech_runtime;
END $$;

-- Pool items and events: the Team Tech roster reads and triages them (runtime role); the intake service writes them on arrival (intake role).
-- No context, no rows.
DROP POLICY IF EXISTS runtime_select ON intake_pool_items;
CREATE POLICY runtime_select ON intake_pool_items FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.app_actor_is_tech_member());
DROP POLICY IF EXISTS runtime_update ON intake_pool_items;
CREATE POLICY runtime_update ON intake_pool_items FOR UPDATE TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.app_actor_is_tech_member())
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.app_actor_is_tech_member());
DROP POLICY IF EXISTS intake_select ON intake_pool_items;
CREATE POLICY intake_select ON intake_pool_items FOR SELECT TO libetech_intake
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS intake_insert ON intake_pool_items;
CREATE POLICY intake_insert ON intake_pool_items FOR INSERT TO libetech_intake
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND state='unassigned' AND project_id IS NULL AND version=1);
DROP POLICY IF EXISTS intake_update ON intake_pool_items;
CREATE POLICY intake_update ON intake_pool_items FOR UPDATE TO libetech_intake
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 -- the check is the tenant only: an edit of a message that was triaged or dismissed is still a revision. What the intake role may touch is the column grant
 -- (hash, edit time, counters) and the guard trigger (it moves neither state nor project).
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

DROP POLICY IF EXISTS runtime_select ON intake_pool_events;
CREATE POLICY runtime_select ON intake_pool_events FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.app_actor_is_tech_member());
DROP POLICY IF EXISTS runtime_insert ON intake_pool_events;
CREATE POLICY runtime_insert ON intake_pool_events FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.app_actor_is_tech_member()
  AND actor_kind='user' AND actor_id=nullif(current_setting('app.person_id',true),'')::uuid);
DROP POLICY IF EXISTS intake_select ON intake_pool_events;
CREATE POLICY intake_select ON intake_pool_events FOR SELECT TO libetech_intake
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS intake_insert ON intake_pool_events;
CREATE POLICY intake_insert ON intake_pool_events FOR INSERT TO libetech_intake
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND actor_kind='intake_service'
  AND actor_id=nullif(current_setting('app.intake_principal_id',true),'')::uuid);

-- Links: read by the person who made them; a link to existing work by members of its project; a link to a request by whoever can read that request (the EXISTS
-- runs under the caller's own row level security on work_requests, so it follows whatever reader set that table has). Inserted only as yourself, for a request you
-- filed yourself or, for existing work, where the person may link (a member other than viewer, or a BoM seat); a candidate only if the caller can read it.
-- The identity role reads three columns of the links, only to count them.
DROP POLICY IF EXISTS runtime_select ON intake_work_links;
CREATE POLICY runtime_select ON intake_work_links FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND (created_by=nullif(current_setting('app.person_id',true),'')::uuid
   OR (work_id IS NOT NULL AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
   OR (work_request_id IS NOT NULL AND EXISTS (SELECT 1 FROM work_requests r WHERE r.id=intake_work_links.work_request_id))));
DROP POLICY IF EXISTS runtime_insert ON intake_work_links;
CREATE POLICY runtime_insert ON intake_work_links FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=nullif(current_setting('app.person_id',true),'')::uuid
  AND ((work_request_id IS NOT NULL AND EXISTS (SELECT 1 FROM work_requests r WHERE r.id=work_request_id AND r.tenant_id=intake_work_links.tenant_id
     AND r.project_id=intake_work_links.project_id AND r.requester_id=nullif(current_setting('app.person_id',true),'')::uuid))
   OR (work_id IS NOT NULL AND public.intake_link_allowed(project_id)))
  AND (candidate_id IS NULL OR EXISTS (SELECT 1 FROM intake_candidates c WHERE c.id=intake_work_links.candidate_id)));
DROP POLICY IF EXISTS identity_blockers ON intake_work_links;
CREATE POLICY identity_blockers ON intake_work_links FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

-- History is never changed. A pool item keeps its identity columns, moves only along unassigned -> assigned | dismissed and back to unassigned, raises the
-- version by exactly one on every change, and keeps the project it was given: a wrong project means opening the item again (project cleared), never swapping.
CREATE OR REPLACE FUNCTION public.intake_pool_items_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.tenant_id<>OLD.tenant_id OR NEW.chat_id<>OLD.chat_id OR NEW.message_id<>OLD.message_id OR NEW.sender_id<>OLD.sender_id OR NEW.source_id<>OLD.source_id THEN
  RAISE EXCEPTION 'A pool item keeps its identity.';
 END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'A pool item change moves the version by one.'; END IF;
 IF NEW.state<>OLD.state AND NOT ((OLD.state='unassigned' AND NEW.state IN ('assigned','dismissed')) OR (OLD.state IN ('assigned','dismissed') AND NEW.state='unassigned')) THEN
  RAISE EXCEPTION 'A pool item cannot move from % to %.',OLD.state,NEW.state;
 END IF;
 IF OLD.project_id IS NOT NULL AND NEW.project_id IS NOT NULL AND NEW.project_id<>OLD.project_id THEN
  RAISE EXCEPTION 'An assigned pool item keeps its project; open it again first.';
 END IF;
 IF NEW.triaged_by IS DISTINCT FROM OLD.triaged_by AND NEW.triaged_by IS NOT NULL
  AND NEW.triaged_by IS DISTINCT FROM nullif(current_setting('app.person_id',true),'')::uuid THEN
  RAISE EXCEPTION 'A pool item is triaged by the actor of the transaction.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS intake_pool_items_guard ON intake_pool_items;
CREATE TRIGGER intake_pool_items_guard BEFORE UPDATE ON intake_pool_items FOR EACH ROW EXECUTE FUNCTION public.intake_pool_items_guard();
DROP TRIGGER IF EXISTS intake_pool_items_no_delete ON intake_pool_items;
CREATE TRIGGER intake_pool_items_no_delete BEFORE DELETE ON intake_pool_items FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_history ON intake_pool_events;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON intake_pool_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_history ON intake_work_links;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON intake_work_links FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
-- A link of a pool item carries the project the item was assigned to (the caller's rights apply: only Team Tech sees pool items).
CREATE OR REPLACE FUNCTION public.intake_work_links_bind() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE p uuid; s text;
BEGIN
 IF NEW.pool_item_id IS NOT NULL THEN
  SELECT i.project_id,i.state INTO p,s FROM public.intake_pool_items i WHERE i.id=NEW.pool_item_id AND i.tenant_id=NEW.tenant_id;
  IF NOT FOUND OR s<>'assigned' OR p IS DISTINCT FROM NEW.project_id THEN RAISE EXCEPTION 'A link of a pool item names the project of the item.'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS intake_work_links_bind ON intake_work_links;
CREATE TRIGGER intake_work_links_bind BEFORE INSERT ON intake_work_links FOR EACH ROW EXECUTE FUNCTION public.intake_work_links_bind();

GRANT SELECT ON intake_pool_items, intake_pool_events, intake_work_links TO libetech_runtime;
GRANT SELECT ON intake_pool_items, intake_pool_events TO libetech_intake;
GRANT INSERT (tenant_id,source_id,source_type,quality_score,chat_id,topic_id,message_id,reply_to_message_id,locator,sender_id,observed_at,edited_at,content_hash,forwarded,
 attachment_mime,attachment_size,trace_id,correlation_id) ON intake_pool_items TO libetech_intake;
GRANT UPDATE (content_hash,edited_at,revision_count,version,updated_at) ON intake_pool_items TO libetech_intake;
GRANT UPDATE (state,classification,dismiss_code,project_id,triaged_by,triaged_at,version,updated_at) ON intake_pool_items TO libetech_runtime;
GRANT INSERT (tenant_id,pool_item_id,actor_id,actor_kind,kind,request_id,trace_id,payload) ON intake_pool_events TO libetech_runtime, libetech_intake;
GRANT INSERT (tenant_id,project_id,candidate_id,pool_item_id,work_request_id,work_id,created_by,created_by_name) ON intake_work_links TO libetech_runtime;

INSERT INTO schema_migrations(version) VALUES ('025') ON CONFLICT(version) DO NOTHING;
COMMIT;
