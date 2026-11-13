-- Outbox and delivery receipts (slice 2): outbox rows are written in the same transaction as the business change (E-INT-06);
-- receipts are immutable and reported by the Telegram gateway. Rows carry template names, ids and a small payload, never chat message bodies.
-- project_id is nullable by design: DM rows for account approval belong to the tenant, not to a project (audience='dm').
-- Roles libetech_intake, libetech_runtime and libetech_identity already exist (002, 003, 016). No data rows are inserted here except schema_migrations.
-- libetech_outbox_audit (NOLOGIN, granted to no role) is the only role that may insert outbox_state_events; it acts only through the
-- SECURITY DEFINER state trigger it owns. Roles are cluster-wide, so the rollback keeps it (OQ-20).
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='libetech_outbox_audit') THEN
    CREATE ROLE libetech_outbox_audit NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='libetech_outbox_audit' AND (rolcanlogin OR rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'libetech_outbox_audit must be NOLOGIN, NOSUPERUSER and NOBYPASSRLS';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS outbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL, event_type text NOT NULL, event_version text NOT NULL DEFAULT 'v1' CHECK(event_version = 'v1'),
  source text NOT NULL DEFAULT 'libetech-ai-os' CHECK(source = 'libetech-ai-os'),
  trace_id uuid NOT NULL, correlation_id uuid NOT NULL, causation_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  audience text NOT NULL CHECK(audience IN ('group','dm')),
  target_chat_id text NOT NULL, target_topic_id text NOT NULL DEFAULT '', reply_to_message_id text,
  recipient_user_id uuid,
  template text NOT NULL CHECK(template IN ('intake.received','intake.recovered','intake.attachment_failed','account_approval.pending')),
  payload jsonb NOT NULL DEFAULT '{}' CHECK(octet_length(payload::text)<=2048),
  dedupe_key text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','delivered','uncertain','dead','abandoned')),
  attempt_no integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid, lease_expires_at timestamptz,
  delivered_at timestamptz, telegram_message_id text, acknowledged_at timestamptz,
  last_error_code text CHECK(last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,64}$'), failure_owner_id uuid,
  source_event_id uuid, candidate_id uuid,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(source_event_id,tenant_id,project_id) REFERENCES source_events(id,tenant_id,project_id),
  FOREIGN KEY(candidate_id,tenant_id,project_id) REFERENCES intake_candidates(id,tenant_id,project_id),
  FOREIGN KEY(recipient_user_id,tenant_id) REFERENCES identity.users(id,tenant_id),
  UNIQUE(event_id), UNIQUE(tenant_id,dedupe_key), UNIQUE(id,tenant_id),
  CHECK((audience='group' AND project_id IS NOT NULL AND recipient_user_id IS NULL)
     OR (audience='dm' AND project_id IS NULL AND recipient_user_id IS NOT NULL AND source_event_id IS NULL AND candidate_id IS NULL)),
  CHECK(state<>'delivered' OR delivered_at IS NOT NULL),
  CHECK((audience='group' AND target_chat_id ~ '^-[1-9][0-9]*$') OR (audience='dm' AND target_chat_id ~ '^[1-9][0-9]{0,19}$'))
);
CREATE TABLE IF NOT EXISTS delivery_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  outbox_id uuid NOT NULL, attempt_no integer NOT NULL CHECK(attempt_no>0),
  phase text NOT NULL CHECK(phase IN ('send','reconcile')),
  outcome text NOT NULL CHECK(outcome IN ('delivered','failed_retryable','failed_permanent','uncertain','not_sent')),
  telegram_message_id text, error_code text CHECK(error_code IS NULL OR error_code ~ '^[A-Z0-9_]{1,64}$'), reported_at timestamptz NOT NULL,
  source_id text NOT NULL, source_type text NOT NULL CHECK(source_type='telegram_gateway'),
  ingested_at timestamptz NOT NULL DEFAULT now(), quality_score smallint NOT NULL CHECK(quality_score BETWEEN 0 AND 100),
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(outbox_id,tenant_id) REFERENCES outbox_messages(id,tenant_id),
  UNIQUE(outbox_id,attempt_no,phase)
);
-- Append-only history of every outbox state change, group and DM alike (intake_events needs a project; DM rows have none).
CREATE TABLE IF NOT EXISTS outbox_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  outbox_id uuid NOT NULL,
  from_state text NOT NULL CHECK(from_state IN ('pending','leased','delivered','uncertain','dead','abandoned')),
  to_state text NOT NULL CHECK(to_state IN ('pending','leased','delivered','uncertain','dead','abandoned')),
  signal text NOT NULL CHECK(signal IN ('lease','delivered','failed_retryable','failed_permanent','uncertain','lease_expired','reconciled_delivered','reconciled_not_sent','requeue','abandon')),
  attempt_no integer NOT NULL, outbox_version integer NOT NULL,
  actor_kind text NOT NULL CHECK(actor_kind IN ('intake_service','user')),
  actor_id uuid NOT NULL, request_id uuid NOT NULL, trace_id uuid,
  FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id),
  FOREIGN KEY(outbox_id,tenant_id) REFERENCES outbox_messages(id,tenant_id),
  UNIQUE(outbox_id,outbox_version)
);

CREATE INDEX IF NOT EXISTS idx_outbox_messages_due ON outbox_messages(tenant_id,state,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_messages_scope_created ON outbox_messages(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_messages_created ON outbox_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_messages_project_fk ON outbox_messages(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbox_messages_source_event_fk ON outbox_messages(source_event_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_outbox_messages_candidate_fk ON outbox_messages(candidate_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_outbox_messages_recipient_fk ON outbox_messages(recipient_user_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_outbox_created ON delivery_receipts(outbox_id,created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_scope_created ON delivery_receipts(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_created ON delivery_receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_project_fk ON delivery_receipts(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_outbox_fk ON delivery_receipts(outbox_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbox_state_events_outbox_created ON outbox_state_events(outbox_id,created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_state_events_scope_created ON outbox_state_events(tenant_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_state_events_created ON outbox_state_events(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_state_events_project_fk ON outbox_state_events(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbox_state_events_outbox_fk ON outbox_state_events(outbox_id,tenant_id);

ALTER TABLE outbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts FORCE ROW LEVEL SECURITY;

-- Scope on every policy comes from the transaction context (set_config(...,true)); no context means no rows.
-- intake: project group rows in scope plus tenant DM rows (project_id IS NULL AND audience='dm').
DROP POLICY IF EXISTS intake_select ON outbox_messages;
CREATE POLICY intake_select ON outbox_messages FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
      OR (project_id IS NULL AND audience='dm')));
DROP POLICY IF EXISTS intake_insert ON outbox_messages;
CREATE POLICY intake_insert ON outbox_messages FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
      OR (project_id IS NULL AND audience='dm'))
    AND state='pending' AND attempt_no=0 AND delivered_at IS NULL AND acknowledged_at IS NULL AND audience='group');
DROP POLICY IF EXISTS intake_update ON outbox_messages;
CREATE POLICY intake_update ON outbox_messages FOR UPDATE TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
      OR (project_id IS NULL AND audience='dm')))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
      OR (project_id IS NULL AND audience='dm')));
DROP POLICY IF EXISTS runtime_select ON outbox_messages;
CREATE POLICY runtime_select ON outbox_messages FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_update ON outbox_messages;
CREATE POLICY runtime_update ON outbox_messages FOR UPDATE TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS identity_select ON outbox_messages;
CREATE POLICY identity_select ON outbox_messages FOR SELECT TO libetech_identity
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id IS NULL AND audience='dm');
DROP POLICY IF EXISTS identity_insert ON outbox_messages;
CREATE POLICY identity_insert ON outbox_messages FOR INSERT TO libetech_identity
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id IS NULL AND audience='dm'
    AND state='pending' AND attempt_no=0 AND delivered_at IS NULL AND acknowledged_at IS NULL);
DROP POLICY IF EXISTS identity_update ON outbox_messages;
CREATE POLICY identity_update ON outbox_messages FOR UPDATE TO libetech_identity
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id IS NULL AND audience='dm')
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id IS NULL AND audience='dm');

DROP POLICY IF EXISTS intake_select ON delivery_receipts;
CREATE POLICY intake_select ON delivery_receipts FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) OR project_id IS NULL));
DROP POLICY IF EXISTS intake_insert ON delivery_receipts;
CREATE POLICY intake_insert ON delivery_receipts FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND ((project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
        AND EXISTS (SELECT 1 FROM outbox_messages o WHERE o.id = outbox_id AND o.tenant_id = delivery_receipts.tenant_id AND o.project_id = delivery_receipts.project_id))
      OR (project_id IS NULL
        AND EXISTS (SELECT 1 FROM outbox_messages o WHERE o.id = outbox_id AND o.tenant_id = delivery_receipts.tenant_id AND o.project_id IS NULL AND o.audience='dm'))));
DROP POLICY IF EXISTS runtime_select ON delivery_receipts;
CREATE POLICY runtime_select ON delivery_receipts FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS identity_select ON delivery_receipts;
CREATE POLICY identity_select ON delivery_receipts FOR SELECT TO libetech_identity
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id IS NULL);

-- outbox_state_events: intake, runtime and identity read their rows; only libetech_outbox_audit inserts (through the state trigger),
-- inside the tenant and project scope of the transaction. No app role holds INSERT on this table (grants at the end).
ALTER TABLE outbox_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_state_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intake_select ON outbox_state_events;
CREATE POLICY intake_select ON outbox_state_events FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) OR project_id IS NULL));
DROP POLICY IF EXISTS runtime_select ON outbox_state_events;
CREATE POLICY runtime_select ON outbox_state_events FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS identity_select ON outbox_state_events;
CREATE POLICY identity_select ON outbox_state_events FOR SELECT TO libetech_identity
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id IS NULL);
DROP POLICY IF EXISTS audit_insert ON outbox_state_events;
CREATE POLICY audit_insert ON outbox_state_events FOR INSERT TO libetech_outbox_audit
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id IS NULL OR project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])));

-- A receipt's project is derived from its outbox row, not trusted from the caller. Not SECURITY DEFINER: RLS on outbox_messages
-- applies to the inserting role, so an invisible outbox row raises. A NULL derived project cannot reach the DM branch of the policy.
-- Every trigger function pins search_path and schema-qualifies its tables so a TEMP shadow table cannot take their place.
CREATE OR REPLACE FUNCTION delivery_receipts_derive_project() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE found boolean; derived uuid;
BEGIN
  SELECT true, o.project_id INTO found, derived FROM public.outbox_messages o WHERE o.id = NEW.outbox_id AND o.tenant_id = NEW.tenant_id;
  IF found IS NOT TRUE THEN RAISE EXCEPTION 'Receipt outbox row is not visible'; END IF;
  IF NEW.project_id IS DISTINCT FROM derived THEN RAISE EXCEPTION 'Receipt project must equal the outbox row project'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS delivery_receipts_derive_project ON delivery_receipts;
CREATE TRIGGER delivery_receipts_derive_project BEFORE INSERT ON delivery_receipts FOR EACH ROW EXECUTE FUNCTION delivery_receipts_derive_project();
-- Target binding (not SECURITY DEFINER; the caller's RLS applies). project_channels grants no authority in this slice (OQ-09), so it is not read.
-- A group row may only reply in the chat, topic and message of its own visible source event; a DM row only to the recipient's linked telegram id.
CREATE OR REPLACE FUNCTION outbox_messages_bind_target() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; tg text;
BEGIN
  IF NEW.audience = 'group' THEN
    IF NEW.source_event_id IS NULL THEN RAISE EXCEPTION 'Outbox target: a group row needs a source event'; END IF;
    SELECT e.chat_id, e.topic_id, e.message_id INTO s FROM public.source_events e
      WHERE e.id = NEW.source_event_id AND e.tenant_id = NEW.tenant_id AND e.project_id = NEW.project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Outbox target: source event is not visible'; END IF;
    IF NEW.target_chat_id <> s.chat_id OR NEW.target_topic_id <> s.topic_id
       OR (NEW.reply_to_message_id IS NOT NULL AND NEW.reply_to_message_id <> s.message_id) THEN
      RAISE EXCEPTION 'Outbox target: chat, topic or message differ from the source event';
    END IF;
  ELSE
    SELECT l.telegram_id INTO tg FROM identity.telegram_links l WHERE l.user_id = NEW.recipient_user_id AND l.tenant_id = NEW.tenant_id;
    IF tg IS NULL OR tg <> NEW.target_chat_id THEN RAISE EXCEPTION 'Outbox target: chat differs from the recipient telegram link'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS outbox_messages_bind_target ON outbox_messages;
CREATE TRIGGER outbox_messages_bind_target BEFORE INSERT ON outbox_messages FOR EACH ROW EXECUTE FUNCTION outbox_messages_bind_target();

-- State moves mirror outboxTransition (src/server/outbox.ts). delivered and abandoned are terminal.
-- libetech_runtime may only requeue dead rows (attempt_no reset to 0) or abandon dead/uncertain rows, and otherwise touches
-- failure_owner_id, last_error_code, version and updated_at only.
-- delivered_at and telegram_message_id move only with a move to delivered; delivered and abandoned rows are frozen except
-- acknowledged_at, updated_at and version; acknowledged_at is set once, from NULL to a value, in any state, and is never changed or
-- cleared afterwards. Recipient-acknowledged is its own state, separate from delivered: a vote never sets delivered_at, and only
-- libetech_identity on DM rows may set acknowledged_at (grants and RLS below).
-- Runs with the caller's rights on every row update, so it also records current_user (the invoking role) for the state trigger below,
-- which runs as its owner and must not take the caller's word for who it is.
CREATE OR REPLACE FUNCTION outbox_messages_guard_state() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM pg_catalog.set_config('app.outbox_invoker', current_user::text, true);
  -- version never decreases; a state change raises it by exactly 1; a same-state update keeps it or raises it by 1 (terminal rows too).
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN RAISE EXCEPTION 'Outbox state change must raise version by exactly 1'; END IF;
  ELSIF NEW.version < OLD.version OR NEW.version > OLD.version + 1 THEN
    RAISE EXCEPTION 'Outbox version may only stay or rise by 1';
  END IF;
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF NOT ((OLD.state = 'pending' AND NEW.state = 'leased')
         OR (OLD.state = 'leased' AND NEW.state IN ('delivered','pending','dead','uncertain'))
         OR (OLD.state = 'uncertain' AND NEW.state IN ('delivered','pending','dead','abandoned'))
         OR (OLD.state = 'dead' AND NEW.state IN ('pending','abandoned'))) THEN
      RAISE EXCEPTION 'Outbox state move % to % is not allowed', OLD.state, NEW.state;
    END IF;
    IF current_user = 'libetech_runtime' THEN
      IF NOT ((OLD.state = 'dead' AND NEW.state = 'pending' AND NEW.attempt_no = 0)
           OR (OLD.state IN ('dead','uncertain') AND NEW.state = 'abandoned')) THEN
        RAISE EXCEPTION 'Outbox state move % to % is not allowed for the runtime role', OLD.state, NEW.state;
      END IF;
      IF NEW.attempt_no IS DISTINCT FROM OLD.attempt_no AND NOT (NEW.state = 'pending' AND NEW.attempt_no = 0) THEN
        RAISE EXCEPTION 'Runtime role may not change attempt_no here';
      END IF;
    END IF;
    IF NEW.state <> 'delivered' AND (NEW.delivered_at IS DISTINCT FROM OLD.delivered_at OR NEW.telegram_message_id IS DISTINCT FROM OLD.telegram_message_id) THEN
      RAISE EXCEPTION 'Outbox delivered_at and telegram_message_id change only on a move to delivered';
    END IF;
  ELSE
    IF OLD.state IN ('delivered','abandoned') AND (
         NEW.attempt_no IS DISTINCT FROM OLD.attempt_no OR NEW.next_attempt_at IS DISTINCT FROM OLD.next_attempt_at
      OR NEW.lease_token IS DISTINCT FROM OLD.lease_token OR NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at
      OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at OR NEW.telegram_message_id IS DISTINCT FROM OLD.telegram_message_id
      OR NEW.last_error_code IS DISTINCT FROM OLD.last_error_code OR NEW.failure_owner_id IS DISTINCT FROM OLD.failure_owner_id) THEN
      RAISE EXCEPTION 'Outbox terminal row (%) is frozen', OLD.state;
    END IF;
    IF NEW.delivered_at IS DISTINCT FROM OLD.delivered_at OR NEW.telegram_message_id IS DISTINCT FROM OLD.telegram_message_id THEN
      RAISE EXCEPTION 'Outbox delivered_at and telegram_message_id change only on a move to delivered';
    END IF;
    IF current_user = 'libetech_runtime'
       AND (NEW.attempt_no IS DISTINCT FROM OLD.attempt_no OR NEW.next_attempt_at IS DISTINCT FROM OLD.next_attempt_at) THEN
      RAISE EXCEPTION 'Runtime role may only change failure_owner_id and last_error_code while the state stays';
    END IF;
  END IF;
  IF NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at
     AND NOT (OLD.acknowledged_at IS NULL AND NEW.acknowledged_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Outbox acknowledged_at is set once, from NULL, and is never changed or cleared';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS outbox_messages_guard_state ON outbox_messages;
CREATE TRIGGER outbox_messages_guard_state BEFORE UPDATE ON outbox_messages FOR EACH ROW EXECUTE FUNCTION outbox_messages_guard_state();

-- Proof by privilege: only libetech_outbox_audit holds INSERT on outbox_state_events, and the only code that runs as it is the state
-- trigger below, which builds every column of the row from OLD/NEW of the outbox row it fires on. The row therefore needs no lookup of
-- the live outbox row (tenant, project, to_state, attempt_no and version are NEW's). This check keeps the closed signal/move table and the
-- runtime limit. Not SECURITY DEFINER: as an invoker trigger it sees the inserting role as current_user.
CREATE OR REPLACE FUNCTION outbox_state_events_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF current_user <> 'libetech_outbox_audit' THEN RAISE EXCEPTION 'State events are written only by the outbox state trigger'; END IF;
  IF NOT ((NEW.from_state = 'pending' AND NEW.to_state = 'leased')
       OR (NEW.from_state = 'leased' AND NEW.to_state IN ('delivered','pending','dead','uncertain'))
       OR (NEW.from_state = 'uncertain' AND NEW.to_state IN ('delivered','pending','dead','abandoned'))
       OR (NEW.from_state = 'dead' AND NEW.to_state IN ('pending','abandoned'))) THEN
    RAISE EXCEPTION 'State event move % to % is not an allowed move', NEW.from_state, NEW.to_state;
  END IF;
  IF NOT ((NEW.signal = 'lease' AND NEW.from_state = 'pending' AND NEW.to_state = 'leased')
       OR (NEW.signal = 'delivered' AND NEW.from_state = 'leased' AND NEW.to_state = 'delivered')
       OR (NEW.signal = 'failed_retryable' AND NEW.from_state = 'leased' AND NEW.to_state IN ('pending','dead'))
       OR (NEW.signal = 'failed_permanent' AND NEW.from_state = 'leased' AND NEW.to_state = 'dead')
       OR (NEW.signal IN ('uncertain','lease_expired') AND NEW.from_state = 'leased' AND NEW.to_state = 'uncertain')
       OR (NEW.signal = 'reconciled_delivered' AND NEW.from_state = 'uncertain' AND NEW.to_state = 'delivered')
       OR (NEW.signal = 'reconciled_not_sent' AND NEW.from_state = 'uncertain' AND NEW.to_state IN ('pending','dead'))
       OR (NEW.signal = 'requeue' AND NEW.from_state = 'dead' AND NEW.to_state = 'pending')
       OR (NEW.signal = 'abandon' AND NEW.from_state IN ('dead','uncertain') AND NEW.to_state = 'abandoned')) THEN
    RAISE EXCEPTION 'State event signal % does not belong to the move % to %', NEW.signal, NEW.from_state, NEW.to_state;
  END IF;
  -- a person (runtime) may only requeue dead rows or abandon dead/uncertain rows; actor_kind is set by the state trigger from the invoking role
  IF NEW.actor_kind = 'user' AND NOT ((NEW.signal = 'requeue' AND NEW.from_state = 'dead' AND NEW.to_state = 'pending')
       OR (NEW.signal = 'abandon' AND NEW.from_state IN ('dead','uncertain') AND NEW.to_state = 'abandoned')) THEN
    RAISE EXCEPTION 'State event signal % is not allowed for the runtime role', NEW.signal;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS outbox_state_events_validate ON outbox_state_events;
CREATE TRIGGER outbox_state_events_validate BEFORE INSERT ON outbox_state_events FOR EACH ROW EXECUTE FUNCTION outbox_state_events_validate();
-- The database writes the state event: every state change inserts exactly one outbox_state_events row, from the signal and request id the
-- caller set in this transaction (fail-closed when missing) and the actor of the invoking role. The signal is consumed each time.
-- SECURITY DEFINER, owned by libetech_outbox_audit: the INSERT runs with that role's privilege, which no app role holds. It is a trigger
-- function (not callable directly) and EXECUTE is revoked from PUBLIC, so no app role can attach it to a table of its own.
-- Inside, current_user is the owner. The invoking role is the 'role' setting (changed only by SET ROLE, and only to a role the session
-- belongs to; a security-definer function cannot change it), and must equal the current_user that the guard trigger recorded with the
-- caller's rights for this update. Any other role, or a disagreement, raises.
CREATE OR REPLACE FUNCTION public.outbox_messages_record_state_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE sig text; req text; invoker text; recorded text; kind text; who uuid;
BEGIN
  sig := nullif(pg_catalog.current_setting('app.outbox_signal', true), '');
  req := nullif(pg_catalog.current_setting('app.request_id', true), '');
  IF sig IS NULL OR req IS NULL THEN RAISE EXCEPTION 'Outbox state change needs app.outbox_signal and app.request_id'; END IF;
  invoker := pg_catalog.current_setting('role');
  recorded := nullif(pg_catalog.current_setting('app.outbox_invoker', true), '');
  IF invoker = 'libetech_runtime' THEN
    kind := 'user'; who := nullif(pg_catalog.current_setting('app.person_id', true), '')::uuid;
  ELSIF invoker = 'libetech_intake' THEN
    kind := 'intake_service'; who := nullif(pg_catalog.current_setting('app.intake_principal_id', true), '')::uuid;
  ELSE
    RAISE EXCEPTION 'Role % may not change an outbox state', coalesce(recorded, invoker);
  END IF;
  IF recorded IS DISTINCT FROM invoker THEN RAISE EXCEPTION 'Outbox state change: the invoking role could not be established'; END IF;
  IF who IS NULL THEN RAISE EXCEPTION 'Outbox state change needs an actor id in the transaction context'; END IF;
  INSERT INTO public.outbox_state_events(tenant_id,project_id,outbox_id,from_state,to_state,signal,attempt_no,outbox_version,actor_kind,actor_id,request_id,trace_id)
    VALUES(NEW.tenant_id,NEW.project_id,NEW.id,OLD.state,NEW.state,sig,NEW.attempt_no,NEW.version,kind,who,req::uuid,NEW.trace_id);
  PERFORM pg_catalog.set_config('app.outbox_signal', '', true);
  RETURN NULL;
END $$;
ALTER FUNCTION public.outbox_messages_record_state_event() OWNER TO libetech_outbox_audit;
REVOKE ALL ON FUNCTION public.outbox_messages_record_state_event() FROM PUBLIC;
DROP TRIGGER IF EXISTS outbox_messages_record_state_event ON outbox_messages;
CREATE TRIGGER outbox_messages_record_state_event AFTER UPDATE ON outbox_messages FOR EACH ROW WHEN (OLD.state IS DISTINCT FROM NEW.state) EXECUTE FUNCTION public.outbox_messages_record_state_event();
DROP TRIGGER IF EXISTS outbox_state_events_immutable ON outbox_state_events;
CREATE TRIGGER outbox_state_events_immutable BEFORE UPDATE OR DELETE ON outbox_state_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

DROP TRIGGER IF EXISTS delivery_receipts_immutable ON delivery_receipts;
CREATE TRIGGER delivery_receipts_immutable BEFORE UPDATE OR DELETE ON delivery_receipts FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
DROP TRIGGER IF EXISTS outbox_messages_no_delete ON outbox_messages;
CREATE TRIGGER outbox_messages_no_delete BEFORE DELETE ON outbox_messages FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

GRANT USAGE ON SCHEMA public TO libetech_intake, libetech_runtime, libetech_identity, libetech_outbox_audit;
GRANT SELECT ON outbox_messages, delivery_receipts, outbox_state_events TO libetech_intake, libetech_runtime, libetech_identity;
-- State events: no app role and not PUBLIC may insert, at table or column level. Only the state trigger inserts, as libetech_outbox_audit,
-- which holds nothing else here (no SELECT, no UPDATE, no other table).
REVOKE INSERT ON outbox_state_events FROM PUBLIC, libetech_intake, libetech_runtime, libetech_identity;
REVOKE INSERT(id,tenant_id,project_id,created_at,updated_at,outbox_id,from_state,to_state,signal,attempt_no,outbox_version,actor_kind,actor_id,request_id,trace_id)
  ON outbox_state_events FROM PUBLIC, libetech_intake, libetech_runtime, libetech_identity;
GRANT INSERT(tenant_id,project_id,outbox_id,from_state,to_state,signal,attempt_no,outbox_version,actor_kind,actor_id,request_id,trace_id) ON outbox_state_events TO libetech_outbox_audit;
-- Column-level INSERT (pattern 013/014/016): defaults own id, created_at/updated_at, ingested_at, state, attempt_no, next_attempt_at, lease_*,
-- delivered_at, telegram_message_id, acknowledged_at, last_error_code, failure_owner_id and version.
REVOKE INSERT ON outbox_messages, delivery_receipts FROM libetech_intake, libetech_runtime, libetech_identity;
GRANT INSERT(tenant_id,project_id,event_id,event_type,event_version,source,trace_id,correlation_id,causation_id,occurred_at,audience,target_chat_id,target_topic_id,reply_to_message_id,recipient_user_id,template,payload,dedupe_key,source_event_id,candidate_id) ON outbox_messages TO libetech_intake;
GRANT INSERT(tenant_id,project_id,outbox_id,attempt_no,phase,outcome,telegram_message_id,error_code,reported_at,source_id,source_type,quality_score) ON delivery_receipts TO libetech_intake;
GRANT INSERT(tenant_id,event_id,event_type,trace_id,correlation_id,causation_id,audience,target_chat_id,recipient_user_id,template,payload,dedupe_key) ON outbox_messages TO libetech_identity;
GRANT UPDATE(state,attempt_no,next_attempt_at,lease_token,lease_expires_at,delivered_at,telegram_message_id,last_error_code,version,updated_at) ON outbox_messages TO libetech_intake;
GRANT UPDATE(state,next_attempt_at,attempt_no,failure_owner_id,last_error_code,version,updated_at) ON outbox_messages TO libetech_runtime;
GRANT UPDATE(acknowledged_at,updated_at) ON outbox_messages TO libetech_identity;
INSERT INTO schema_migrations(version) VALUES('017') ON CONFLICT(version) DO NOTHING;
COMMIT;
