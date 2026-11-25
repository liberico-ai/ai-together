-- 026 — The receipt of a pool item (GIAO VIỆC 5, hạng mục B; Chairman 25/11/2026: the IN code comes with a receipt).
-- A pool item has no project until it is triaged, so its receipt is a group row of outbox_messages with no project, tied to the pool item (pool_item_id)
-- and sent with its own template, intake.pool_received. Nothing else about the outbox changes: the same state trigger, the same receipts, the same pull.
-- Additive and idempotent. Rollback: migrations/rollback/026_outbox_pool_receipt.sql (refuses while a pool receipt exists).
--
-- What it does:
-- 1. outbox_messages.pool_item_id (FK to intake_pool_items) and its index.
-- 2. The template CHECK gains intake.pool_received; the target-shape CHECK allows a group row with no project exactly when it has a pool item and the
--    pool template. Both are added NOT VALID and validated straight after in the same transaction. That is a convention here, not a shortening of any lock:
--    outbox_messages is small and this runs once; a large table would validate in a separate transaction (Quality Gate M-06).
-- 3. outbox_messages_bind_target also binds a pool row: chat, topic and message must be those of the pool item.
-- 4. The intake policies of outbox_messages and delivery_receipts gain the pool branch; the runtime role may read pool rows and their receipts, for Team Tech only.
BEGIN;

ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS pool_item_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname='outbox_messages_pool_item_fk' AND conrelid='public.outbox_messages'::regclass) THEN
    ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_pool_item_fk FOREIGN KEY (pool_item_id,tenant_id) REFERENCES intake_pool_items(id,tenant_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_outbox_messages_pool_item_fk ON outbox_messages(pool_item_id,tenant_id);

-- The two CHECKs of 017 carry no name of their own; they are found by what they say, dropped, and added again under names (a second run does the same).
DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_catalog.pg_constraint WHERE conrelid='public.outbox_messages'::regclass AND contype='c'
    AND (pg_get_constraintdef(oid) LIKE '%intake.attachment_failed%' OR (pg_get_constraintdef(oid) LIKE '%audience%' AND pg_get_constraintdef(oid) LIKE '%project_id IS NOT NULL%')) LOOP
    EXECUTE format('ALTER TABLE public.outbox_messages DROP CONSTRAINT %I',c);
  END LOOP;
END $$;
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_template_check
  CHECK (template IN ('intake.received','intake.recovered','intake.attachment_failed','account_approval.pending','intake.pool_received')) NOT VALID;
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_target_shape
  CHECK ((audience='group' AND project_id IS NOT NULL AND pool_item_id IS NULL AND recipient_user_id IS NULL)
     OR (audience='group' AND project_id IS NULL AND pool_item_id IS NOT NULL AND template='intake.pool_received' AND recipient_user_id IS NULL
         AND source_event_id IS NULL AND candidate_id IS NULL)
     OR (audience='dm' AND project_id IS NULL AND pool_item_id IS NULL AND recipient_user_id IS NOT NULL AND source_event_id IS NULL AND candidate_id IS NULL)) NOT VALID;
ALTER TABLE outbox_messages VALIDATE CONSTRAINT outbox_messages_template_check;
ALTER TABLE outbox_messages VALIDATE CONSTRAINT outbox_messages_target_shape;

-- Target binding (the caller's RLS applies): a pool row may only reply in the chat, topic and message of its own pool item.
CREATE OR REPLACE FUNCTION outbox_messages_bind_target() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; tg text;
BEGIN
  IF NEW.audience = 'group' THEN
    IF NEW.pool_item_id IS NOT NULL THEN
      SELECT i.chat_id, i.topic_id, i.message_id INTO s FROM public.intake_pool_items i
        WHERE i.id = NEW.pool_item_id AND i.tenant_id = NEW.tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Outbox target: pool item is not visible'; END IF;
      IF NEW.target_chat_id <> s.chat_id OR NEW.target_topic_id <> s.topic_id
         OR (NEW.reply_to_message_id IS NOT NULL AND NEW.reply_to_message_id <> s.message_id) THEN
        RAISE EXCEPTION 'Outbox target: chat, topic or message differ from the pool item';
      END IF;
    ELSE
      IF NEW.source_event_id IS NULL THEN RAISE EXCEPTION 'Outbox target: a group row needs a source event'; END IF;
      SELECT e.chat_id, e.topic_id, e.message_id INTO s FROM public.source_events e
        WHERE e.id = NEW.source_event_id AND e.tenant_id = NEW.tenant_id AND e.project_id = NEW.project_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Outbox target: source event is not visible'; END IF;
      IF NEW.target_chat_id <> s.chat_id OR NEW.target_topic_id <> s.topic_id
         OR (NEW.reply_to_message_id IS NOT NULL AND NEW.reply_to_message_id <> s.message_id) THEN
        RAISE EXCEPTION 'Outbox target: chat, topic or message differ from the source event';
      END IF;
    END IF;
  ELSE
    SELECT l.telegram_id INTO tg FROM identity.telegram_links l WHERE l.user_id = NEW.recipient_user_id AND l.tenant_id = NEW.tenant_id;
    IF tg IS NULL OR tg <> NEW.target_chat_id THEN RAISE EXCEPTION 'Outbox target: chat differs from the recipient telegram link'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- The tables are already under row level security since 017; stated again so that this file stands on its own.
ALTER TABLE outbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts FORCE ROW LEVEL SECURITY;

-- Intake: project group rows in scope, the tenant's DM rows, and now the pool receipts of the tenant.
DROP POLICY IF EXISTS intake_select ON outbox_messages;
CREATE POLICY intake_select ON outbox_messages FOR SELECT TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
      OR (project_id IS NULL AND audience='dm')
      OR (project_id IS NULL AND pool_item_id IS NOT NULL)));
DROP POLICY IF EXISTS intake_insert ON outbox_messages;
CREATE POLICY intake_insert ON outbox_messages FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
      OR (project_id IS NULL AND audience='dm')
      OR (project_id IS NULL AND pool_item_id IS NOT NULL))
    AND state='pending' AND attempt_no=0 AND delivered_at IS NULL AND acknowledged_at IS NULL AND audience='group');
DROP POLICY IF EXISTS intake_update ON outbox_messages;
CREATE POLICY intake_update ON outbox_messages FOR UPDATE TO libetech_intake
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
      OR (project_id IS NULL AND audience='dm')
      OR (project_id IS NULL AND pool_item_id IS NOT NULL)))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
      OR (project_id IS NULL AND audience='dm')
      OR (project_id IS NULL AND pool_item_id IS NOT NULL)));
-- Runtime: the Team Tech roster reads the pool receipts (to show whether the receipt was sent); nobody else does.
DROP POLICY IF EXISTS runtime_pool_select ON outbox_messages;
CREATE POLICY runtime_pool_select ON outbox_messages FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id IS NULL AND pool_item_id IS NOT NULL AND public.app_actor_is_tech_member());

DROP POLICY IF EXISTS intake_insert ON delivery_receipts;
CREATE POLICY intake_insert ON delivery_receipts FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND ((project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
        AND EXISTS (SELECT 1 FROM outbox_messages o WHERE o.id = outbox_id AND o.tenant_id = delivery_receipts.tenant_id AND o.project_id = delivery_receipts.project_id))
      OR (project_id IS NULL
        AND EXISTS (SELECT 1 FROM outbox_messages o WHERE o.id = outbox_id AND o.tenant_id = delivery_receipts.tenant_id AND o.project_id IS NULL AND o.audience='dm'))
      OR (project_id IS NULL
        AND EXISTS (SELECT 1 FROM outbox_messages o WHERE o.id = outbox_id AND o.tenant_id = delivery_receipts.tenant_id AND o.project_id IS NULL AND o.pool_item_id IS NOT NULL))));
DROP POLICY IF EXISTS runtime_pool_select ON delivery_receipts;
CREATE POLICY runtime_pool_select ON delivery_receipts FOR SELECT TO libetech_runtime
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND project_id IS NULL AND public.app_actor_is_tech_member()
    AND EXISTS (SELECT 1 FROM outbox_messages o WHERE o.id = outbox_id AND o.tenant_id = delivery_receipts.tenant_id AND o.pool_item_id IS NOT NULL));

GRANT INSERT(pool_item_id) ON outbox_messages TO libetech_intake;

INSERT INTO schema_migrations(version) VALUES ('026') ON CONFLICT(version) DO NOTHING;
COMMIT;
