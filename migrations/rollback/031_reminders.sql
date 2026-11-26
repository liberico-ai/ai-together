-- Rollback of 031 only. Throwaway test copy use; never run against a serving database without Chairman approval.
-- Refuses while a later migration is recorded, while any reminder was queued, and while any reminder configuration or meeting change is recorded: those are the
-- record of what the bot was set up to send and who changed a meeting, and this file does not delete history. Restores the 026 outbox shape. No CASCADE.
-- The roles libetech_reminder and libetech_reminder_svc are cluster-wide and stay, without any grant.
BEGIN;
-- Counts are read with EXECUTE: the file must also run when 031 is already gone (a second run), and a static query on a missing table fails at planning.
DO $$ DECLARE n bigint; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '031') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 031.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outbox_messages' AND column_name='reminder_target_id') THEN
    EXECUTE 'SELECT count(*) FROM public.outbox_messages WHERE reminder_target_id IS NOT NULL' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'outbox_messages holds reminders: 031 only goes forward once a reminder was queued.'; END IF;
  END IF;
  IF to_regclass('public.reminder_config_events') IS NOT NULL THEN
    EXECUTE 'SELECT (SELECT count(*) FROM public.reminder_config_events)+(SELECT count(*) FROM public.meeting_changes)' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Reminder configuration or meeting changes are recorded: 031 only goes forward once a reminder was set up.'; END IF;
  END IF;
END $$;

ALTER TABLE outbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reminder_select ON outbox_messages;
DROP POLICY IF EXISTS reminder_insert ON outbox_messages;

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

DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_catalog.pg_constraint WHERE conrelid='public.outbox_messages'::regclass AND contype='c'
    AND (pg_get_constraintdef(oid) LIKE '%intake.attachment_failed%' OR (pg_get_constraintdef(oid) LIKE '%audience%' AND pg_get_constraintdef(oid) LIKE '%project_id IS NOT NULL%')) LOOP
    EXECUTE format('ALTER TABLE public.outbox_messages DROP CONSTRAINT %I',c);
  END LOOP;
END $$;
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_template_check
  CHECK (template IN ('intake.received','intake.recovered','intake.attachment_failed','account_approval.pending','intake.pool_received'));
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_target_shape
  CHECK ((audience='group' AND project_id IS NOT NULL AND pool_item_id IS NULL AND recipient_user_id IS NULL)
     OR (audience='group' AND project_id IS NULL AND pool_item_id IS NOT NULL AND template='intake.pool_received' AND recipient_user_id IS NULL
         AND source_event_id IS NULL AND candidate_id IS NULL)
     OR (audience='dm' AND project_id IS NULL AND pool_item_id IS NULL AND recipient_user_id IS NOT NULL AND source_event_id IS NULL AND candidate_id IS NULL));
DROP INDEX IF EXISTS idx_outbox_messages_reminder_target_fk;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname='outbox_messages_reminder_target_fk' AND conrelid='public.outbox_messages'::regclass) THEN
    ALTER TABLE public.outbox_messages DROP CONSTRAINT outbox_messages_reminder_target_fk;
  END IF;
END $$;
ALTER TABLE outbox_messages DROP COLUMN IF EXISTS reminder_target_id;

DROP POLICY IF EXISTS golive_projection_read ON work_requests;
REVOKE SELECT(id,tenant_id,project_id,requester_id) ON work_requests FROM libetech_projector;
REVOKE SELECT(id,tenant_id,project_id,assignee_id,state,revision) ON work_items FROM libetech_projector;
REVOKE SELECT(tenant_id,project_id,work_id,revision) ON evidence FROM libetech_projector;

DROP TABLE IF EXISTS analytics.golive_member_status;
DROP TABLE IF EXISTS meeting_changes;
DROP TABLE IF EXISTS meeting_series;
DROP TABLE IF EXISTS reminder_config_events;
DROP TABLE IF EXISTS reminder_targets;
DROP FUNCTION IF EXISTS public.meeting_source(uuid,text);
DROP FUNCTION IF EXISTS public.meeting_changes_guard();
DROP FUNCTION IF EXISTS public.reminder_config_record();
DROP FUNCTION IF EXISTS public.reminder_targets_guard();
DROP FUNCTION IF EXISTS public.reminder_project_allowed(uuid,uuid);
DROP FUNCTION IF EXISTS public.tech_roster_members();

-- a table-level revoke also takes the column grants away
REVOKE ALL ON projects FROM libetech_reminder;
REVOKE ALL ON outbox_messages FROM libetech_reminder;
REVOKE USAGE ON SCHEMA analytics FROM libetech_reminder;

DELETE FROM schema_migrations WHERE version='031';
COMMIT;
