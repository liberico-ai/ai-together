-- Rollback of 026 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Refuses while a later migration is recorded and while any outbox row carries a pool item (a pool receipt): those rows are the record of what the
-- bot was asked to say about a message, and this file does not delete history. Rolls the 017 shape back: the two CHECKs, the target binding function and the
-- policies as 017 wrote them. No CASCADE.
BEGIN;
-- The count is read with EXECUTE: the file must also run when the column is already gone (a second run), and a static query on a missing column fails at planning.
DO $$ DECLARE n bigint; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '026') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 026.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outbox_messages' AND column_name='pool_item_id') THEN
    EXECUTE 'SELECT count(*) FROM public.outbox_messages WHERE pool_item_id IS NOT NULL' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'outbox_messages holds pool receipts: 026 only goes forward once a pool receipt was queued.'; END IF;
  END IF;
END $$;

-- Row level security stays on, as 017 left it; stated again so that this file stands on its own.
ALTER TABLE outbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_pool_select ON outbox_messages;
DROP POLICY IF EXISTS runtime_pool_select ON delivery_receipts;
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
DROP POLICY IF EXISTS intake_insert ON delivery_receipts;
CREATE POLICY intake_insert ON delivery_receipts FOR INSERT TO libetech_intake
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
    AND ((project_id = ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
        AND EXISTS (SELECT 1 FROM outbox_messages o WHERE o.id = outbox_id AND o.tenant_id = delivery_receipts.tenant_id AND o.project_id = delivery_receipts.project_id))
      OR (project_id IS NULL
        AND EXISTS (SELECT 1 FROM outbox_messages o WHERE o.id = outbox_id AND o.tenant_id = delivery_receipts.tenant_id AND o.project_id IS NULL AND o.audience='dm'))));

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

DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_catalog.pg_constraint WHERE conrelid='public.outbox_messages'::regclass AND contype='c'
    AND (pg_get_constraintdef(oid) LIKE '%intake.attachment_failed%' OR (pg_get_constraintdef(oid) LIKE '%audience%' AND pg_get_constraintdef(oid) LIKE '%project_id IS NOT NULL%')) LOOP
    EXECUTE format('ALTER TABLE public.outbox_messages DROP CONSTRAINT %I',c);
  END LOOP;
END $$;
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_template_check
  CHECK (template IN ('intake.received','intake.recovered','intake.attachment_failed','account_approval.pending'));
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_check
  CHECK ((audience='group' AND project_id IS NOT NULL AND recipient_user_id IS NULL)
     OR (audience='dm' AND project_id IS NULL AND recipient_user_id IS NOT NULL AND source_event_id IS NULL AND candidate_id IS NULL));
DROP INDEX IF EXISTS idx_outbox_messages_pool_item_fk;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname='outbox_messages_pool_item_fk' AND conrelid='public.outbox_messages'::regclass) THEN
    ALTER TABLE public.outbox_messages DROP CONSTRAINT outbox_messages_pool_item_fk;
  END IF;
END $$;
ALTER TABLE outbox_messages DROP COLUMN IF EXISTS pool_item_id;
DELETE FROM schema_migrations WHERE version='026';
COMMIT;
