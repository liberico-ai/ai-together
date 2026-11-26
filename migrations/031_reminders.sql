-- 031 — Lịch nhắc có ngữ cảnh (GIAO VIỆC 5, hạng mục F). Chairman 26/11/2026 «Yes, build F», on the recommended choices of docs/plans/gv5-f-reminders.md:
-- Q-F1 open a send path of the bot's own, only to targets the operator writes; Q-F2 the configured group, names only; Q-F3 no IBS HI target in v1;
-- Q-F4 GO LIVE 08:30 on weekdays, a meeting one day before.
-- Additive and idempotent. Rollback: migrations/rollback/031_reminders.sql (refuses while a reminder, a meeting change or a configuration record exists).
--
-- What it adds:
-- 1. Role libetech_reminder (NOLOGIN) and the scheduler login libetech_reminder_svc (no password here: operations sets one). The role queues reminder.* rows
--    only, and reads only what a reminder says.
-- 2. public.reminder_targets (Z1): where the reminder of one project and kind goes. Written by the operator only (deploy/reminder-targets.sql). An enabled
--    target needs a project with a confirmed domain that is not IBS HI.
-- 3. outbox_messages.reminder_target_id: a reminder row names its target, and the database binds chat, topic and template to that enabled target. Every other
--    group row still answers a stored message (017, 026).
-- 4. public.meeting_series (the operator writes the base schedule) and public.meeting_changes (append-only; a BoM seat of the project or a BoM Tech, with a
--    stored message of that project as the source).
-- 5. public.reminder_config_events: every change of a target or a series, with its source (E-DB-13).
-- 6. analytics.golive_member_status (Z2), written only by the GO LIVE projector (operator login, OQ-22).
BEGIN;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='libetech_reminder') THEN
  CREATE ROLE libetech_reminder NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='libetech_reminder_svc') THEN
  CREATE ROLE libetech_reminder_svc LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;
GRANT libetech_reminder TO libetech_reminder_svc;
-- guard:reminder-role begin
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='libetech_reminder' AND (rolcanlogin OR rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'libetech_reminder must be NOLOGIN, NOSUPERUSER and NOBYPASSRLS';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='libetech_reminder_svc' AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN
  RAISE EXCEPTION 'libetech_reminder_svc must be NOSUPERUSER, NOBYPASSRLS, NOCREATEDB and NOCREATEROLE';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
   JOIN pg_catalog.pg_roles a ON a.rolname='libetech_reminder'
   JOIN pg_catalog.pg_roles b ON b.rolname IN ('libetech_runtime','libetech_intake','libetech_identity','libetech_projector')
   WHERE NOT r.rolsuper AND pg_catalog.pg_has_role(r.oid,a.oid,'MEMBER') AND pg_catalog.pg_has_role(r.oid,b.oid,'MEMBER')) THEN
  RAISE EXCEPTION 'A role can act both as libetech_reminder and as another application role; separate the logins before applying this migration';
 END IF;
END $$;
-- guard:reminder-role end

-- A project may receive reminders: its latest confirmed domain is a Liberico BU or Xeca, and nothing names it IBS HI (the 029 test). Q-F3.
CREATE OR REPLACE FUNCTION public.reminder_project_allowed(target_tenant uuid, target_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog SET row_security=off AS $$
 SELECT coalesce((SELECT m.domain_code IN ('LIBERICO_BU','XECA') FROM public.project_domain_mappings m
    WHERE m.tenant_id=target_tenant AND m.project_id=target_project ORDER BY m.mapping_version DESC LIMIT 1),false)
  AND NOT public.tech_source_project_is_ibs(target_tenant,target_project)
$$;

CREATE TABLE IF NOT EXISTS reminder_targets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 kind text NOT NULL CHECK (kind IN ('golive_status','bom_meeting')),
 chat_id text NOT NULL CHECK (chat_id ~ '^-[1-9][0-9]*$'),
 topic_id text NOT NULL DEFAULT '' CHECK (topic_id='' OR topic_id ~ '^[1-9][0-9]*$'),
 send_time time NOT NULL DEFAULT '08:30',
 lead_days smallint NOT NULL DEFAULT 1 CHECK (lead_days BETWEEN 0 AND 7),
 enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id),
 UNIQUE (tenant_id,project_id,kind), UNIQUE (id,tenant_id,project_id)
);
CREATE INDEX IF NOT EXISTS idx_reminder_targets_project_fk ON reminder_targets(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_reminder_targets_created ON reminder_targets(created_at);

CREATE OR REPLACE FUNCTION public.reminder_targets_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.enabled AND NOT public.reminder_project_allowed(NEW.tenant_id,NEW.project_id) THEN
  RAISE EXCEPTION 'A reminder target is enabled only for a project with a confirmed domain other than IBS HI.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reminder_targets_guard ON reminder_targets;
CREATE TRIGGER reminder_targets_guard BEFORE INSERT OR UPDATE ON reminder_targets FOR EACH ROW EXECUTE FUNCTION public.reminder_targets_guard();

CREATE TABLE IF NOT EXISTS meeting_series (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
 weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
 start_time time NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id),
 UNIQUE (tenant_id,project_id,title), UNIQUE (id,tenant_id,project_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_series_project_fk ON meeting_series(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_meeting_series_created ON meeting_series(created_at);

-- seq orders changes recorded within one millisecond. The shape checks are integrity of the record: a one-off names its session, a recurring change the date it
-- starts, and only an unclear one may lack a time. An unclear change answers nothing.
CREATE TABLE IF NOT EXISTS meeting_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 series_id uuid NOT NULL, seq bigint GENERATED ALWAYS AS IDENTITY,
 kind text NOT NULL CHECK (kind IN ('one_off','recurring','unclear')),
 session_date date, effective_from date, new_time time,
 source_candidate_id uuid, source_pool_item_id uuid, resolves_change_id uuid,
 recorded_by uuid NOT NULL, recorder_name text NOT NULL CHECK (length(recorder_name) BETWEEN 1 AND 200),
 request_key uuid NOT NULL, request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
 FOREIGN KEY (series_id,tenant_id,project_id) REFERENCES meeting_series(id,tenant_id,project_id),
 FOREIGN KEY (source_candidate_id,tenant_id,project_id) REFERENCES intake_candidates(id,tenant_id,project_id),
 FOREIGN KEY (source_pool_item_id,tenant_id) REFERENCES intake_pool_items(id,tenant_id),
 UNIQUE (id,series_id), UNIQUE (tenant_id,recorded_by,request_key), UNIQUE (resolves_change_id),
 FOREIGN KEY (resolves_change_id,series_id) REFERENCES meeting_changes(id,series_id),
 CHECK (num_nonnulls(source_candidate_id,source_pool_item_id)=1),
 CHECK ((kind='one_off')=(session_date IS NOT NULL)),
 CHECK ((kind='recurring')=(effective_from IS NOT NULL)),
 CHECK (kind='unclear' OR new_time IS NOT NULL),
 CHECK (kind<>'unclear' OR resolves_change_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_meeting_changes_series ON meeting_changes(series_id,tenant_id,project_id,seq);
CREATE INDEX IF NOT EXISTS idx_meeting_changes_source_candidate_fk ON meeting_changes(source_candidate_id,tenant_id,project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_changes_source_pool_fk ON meeting_changes(source_pool_item_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_meeting_changes_created ON meeting_changes(created_at);
DROP TRIGGER IF EXISTS immutable_history ON meeting_changes;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON meeting_changes FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
-- Owned by the migration superuser, so row level security does not hide the rows it checks.
CREATE OR REPLACE FUNCTION public.meeting_changes_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.resolves_change_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.meeting_changes c
   WHERE c.id=NEW.resolves_change_id AND c.series_id=NEW.series_id AND c.tenant_id=NEW.tenant_id AND c.kind='unclear') THEN
  RAISE EXCEPTION 'Only an unclear change of the same series is answered.';
 END IF;
 IF NEW.source_pool_item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.intake_pool_items i
   WHERE i.id=NEW.source_pool_item_id AND i.tenant_id=NEW.tenant_id AND i.state='assigned' AND i.project_id=NEW.project_id) THEN
  RAISE EXCEPTION 'The source message is not a message of this project.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS meeting_changes_guard ON meeting_changes;
CREATE TRIGGER meeting_changes_guard BEFORE INSERT ON meeting_changes FOR EACH ROW EXECUTE FUNCTION public.meeting_changes_guard();

-- The stored message an IN code names, in one project, for someone who may record a change there: a candidate of the project, or a shared-group message
-- assigned to it. No row for anybody else. No text, no chat, only the id.
CREATE OR REPLACE FUNCTION public.meeting_source(target_project uuid, ref text) RETURNS TABLE(candidate_id uuid, pool_item_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT c.id, NULL::uuid FROM public.intake_candidates c
  WHERE public.work_request_seat(target_project) AND c.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND c.project_id=target_project
   AND 'IN-'||upper(left(c.id::text,8))=ref
 UNION ALL
 SELECT NULL::uuid, i.id FROM public.intake_pool_items i
  WHERE public.work_request_seat(target_project) AND i.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND i.project_id=target_project
   AND i.state='assigned' AND 'IN-'||upper(left(i.id::text,8))=ref
$$;

CREATE TABLE IF NOT EXISTS reminder_config_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 seq bigint GENERATED ALWAYS AS IDENTITY,
 entity text NOT NULL CHECK (entity IN ('reminder_target','meeting_series')), entity_id uuid NOT NULL,
 op text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')), old_value jsonb, new_value jsonb,
 source text NOT NULL, db_role text NOT NULL,
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_reminder_config_events_entity ON reminder_config_events(entity,entity_id,seq);
CREATE INDEX IF NOT EXISTS idx_reminder_config_events_created ON reminder_config_events(created_at);
DROP TRIGGER IF EXISTS immutable_history ON reminder_config_events;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON reminder_config_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
-- A version bump (a recorded meeting change) is not a configuration change. The operator names the source in libetech.reminder_source.
CREATE OR REPLACE FUNCTION public.reminder_config_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o jsonb; n jsonb; r jsonb;
BEGIN
 o := CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) - ARRAY['version','updated_at'] END;
 n := CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) - ARRAY['version','updated_at'] END;
 IF TG_OP='UPDATE' AND o=n THEN RETURN NULL; END IF;
 r := coalesce(n,o);
 INSERT INTO public.reminder_config_events(tenant_id,project_id,entity,entity_id,op,old_value,new_value,source,db_role)
 VALUES ((r->>'tenant_id')::uuid,(r->>'project_id')::uuid,TG_ARGV[0],(r->>'id')::uuid,TG_OP,o,n,
  coalesce(nullif(current_setting('libetech.reminder_source',true),''),'unstated'),session_user);
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS reminder_config_record ON reminder_targets;
CREATE TRIGGER reminder_config_record AFTER INSERT OR UPDATE OR DELETE ON reminder_targets FOR EACH ROW EXECUTE FUNCTION public.reminder_config_record('reminder_target');
DROP TRIGGER IF EXISTS reminder_config_record ON meeting_series;
CREATE TRIGGER reminder_config_record AFTER INSERT OR UPDATE OR DELETE ON meeting_series FOR EACH ROW EXECUTE FUNCTION public.reminder_config_record('meeting_series');

CREATE TABLE IF NOT EXISTS analytics.golive_member_status (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, project_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 member_id uuid NOT NULL, member_name text NOT NULL CHECK (length(member_name) BETWEEN 1 AND 200),
 requests_filed integer NOT NULL CHECK (requests_filed>=0),
 open_work integer NOT NULL CHECK (open_work>=0),
 open_without_evidence integer NOT NULL CHECK (open_without_evidence>=0),
 projected_at timestamptz NOT NULL,
 FOREIGN KEY (project_id,tenant_id) REFERENCES projects(id,tenant_id),
 UNIQUE (tenant_id,project_id,member_id)
);
CREATE INDEX IF NOT EXISTS idx_golive_member_status_project_fk ON analytics.golive_member_status(project_id,tenant_id);
CREATE INDEX IF NOT EXISTS idx_golive_member_status_created ON analytics.golive_member_status(created_at);

-- Team Tech members who are active and activated: id and name, for the projector only.
CREATE OR REPLACE FUNCTION public.tech_roster_members() RETURNS TABLE(user_id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id,u.name FROM identity.tech_roster r JOIN identity.users u ON u.id=r.user_id AND u.tenant_id=r.tenant_id
  WHERE r.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND u.active AND u.password_hash IS NOT NULL
$$;
ALTER FUNCTION public.tech_roster_members() OWNER TO libetech_identity;

-- Row level security: no context, no rows.
ALTER TABLE reminder_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_targets FORCE ROW LEVEL SECURITY;
ALTER TABLE meeting_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_series FORCE ROW LEVEL SECURITY;
ALTER TABLE meeting_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_changes FORCE ROW LEVEL SECURITY;
ALTER TABLE reminder_config_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_config_events FORCE ROW LEVEL SECURITY;
ALTER TABLE analytics.golive_member_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.golive_member_status FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reminder_read ON reminder_targets;
CREATE POLICY reminder_read ON reminder_targets FOR SELECT TO libetech_reminder
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

DROP POLICY IF EXISTS reminder_read ON meeting_series;
CREATE POLICY reminder_read ON meeting_series FOR SELECT TO libetech_reminder
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_read ON meeting_series;
CREATE POLICY runtime_read ON meeting_series FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.work_request_seat(project_id));
DROP POLICY IF EXISTS runtime_version ON meeting_series;
CREATE POLICY runtime_version ON meeting_series FOR UPDATE TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) AND public.work_request_seat(project_id))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]) AND public.work_request_seat(project_id));

DROP POLICY IF EXISTS reminder_read ON meeting_changes;
CREATE POLICY reminder_read ON meeting_changes FOR SELECT TO libetech_reminder
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS runtime_read ON meeting_changes;
CREATE POLICY runtime_read ON meeting_changes FOR SELECT TO libetech_runtime
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND public.work_request_seat(project_id));
DROP POLICY IF EXISTS runtime_insert ON meeting_changes;
CREATE POLICY runtime_insert ON meeting_changes FOR INSERT TO libetech_runtime
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
  AND recorded_by=nullif(current_setting('app.person_id',true),'')::uuid AND public.work_request_seat(project_id));

-- The configuration history is the operator's: no application role reads or writes it.
DROP POLICY IF EXISTS no_app_access ON reminder_config_events;
CREATE POLICY no_app_access ON reminder_config_events FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS golive_projection ON analytics.golive_member_status;
CREATE POLICY golive_projection ON analytics.golive_member_status FOR ALL TO libetech_projector
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS reminder_read ON analytics.golive_member_status;
CREATE POLICY reminder_read ON analytics.golive_member_status FOR SELECT TO libetech_reminder
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
-- The projector reads requests of the one project it projects (work_items and evidence are already scoped for every role by 001).
DROP POLICY IF EXISTS golive_projection_read ON work_requests;
CREATE POLICY golive_projection_read ON work_requests FOR SELECT TO libetech_projector
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));

-- The outbox: a reminder row, the only group row that answers no message (Q-F1).
ALTER TABLE outbox_messages ADD COLUMN IF NOT EXISTS reminder_target_id uuid;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname='outbox_messages_reminder_target_fk' AND conrelid='public.outbox_messages'::regclass) THEN
  ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_reminder_target_fk
   FOREIGN KEY (reminder_target_id,tenant_id,project_id) REFERENCES reminder_targets(id,tenant_id,project_id);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_outbox_messages_reminder_target_fk ON outbox_messages(reminder_target_id,tenant_id,project_id);
-- The two CHECKs of 026 are found by what they say, dropped, and added again under the same names (a second run does the same).
DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_catalog.pg_constraint WHERE conrelid='public.outbox_messages'::regclass AND contype='c'
    AND (pg_get_constraintdef(oid) LIKE '%intake.attachment_failed%' OR (pg_get_constraintdef(oid) LIKE '%audience%' AND pg_get_constraintdef(oid) LIKE '%project_id IS NOT NULL%')) LOOP
    EXECUTE format('ALTER TABLE public.outbox_messages DROP CONSTRAINT %I',c);
  END LOOP;
END $$;
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_template_check
  CHECK (template IN ('intake.received','intake.recovered','intake.attachment_failed','account_approval.pending','intake.pool_received',
    'reminder.golive_status','reminder.bom_meeting','reminder.bom_meeting_question')) NOT VALID;
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_target_shape
  CHECK ((audience='group' AND project_id IS NOT NULL AND pool_item_id IS NULL AND recipient_user_id IS NULL AND reminder_target_id IS NULL AND left(template,9)<>'reminder.')
     OR (audience='group' AND project_id IS NULL AND pool_item_id IS NOT NULL AND template='intake.pool_received' AND recipient_user_id IS NULL
         AND source_event_id IS NULL AND candidate_id IS NULL AND reminder_target_id IS NULL)
     OR (audience='dm' AND project_id IS NULL AND pool_item_id IS NULL AND recipient_user_id IS NOT NULL AND source_event_id IS NULL AND candidate_id IS NULL
         AND reminder_target_id IS NULL AND left(template,9)<>'reminder.')
     OR (audience='group' AND project_id IS NOT NULL AND reminder_target_id IS NOT NULL AND left(template,9)='reminder.' AND pool_item_id IS NULL
         AND recipient_user_id IS NULL AND source_event_id IS NULL AND candidate_id IS NULL AND reply_to_message_id IS NULL)) NOT VALID;
ALTER TABLE outbox_messages VALIDATE CONSTRAINT outbox_messages_template_check;
ALTER TABLE outbox_messages VALIDATE CONSTRAINT outbox_messages_target_shape;

-- Target binding (the caller's RLS applies). A reminder row goes to the enabled target of its project, with that target's chat, topic and kind.
CREATE OR REPLACE FUNCTION outbox_messages_bind_target() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; tg text;
BEGIN
  IF NEW.audience = 'group' THEN
    IF NEW.reminder_target_id IS NOT NULL THEN
      SELECT t.chat_id, t.topic_id, t.kind INTO s FROM public.reminder_targets t
        WHERE t.id = NEW.reminder_target_id AND t.tenant_id = NEW.tenant_id AND t.project_id = NEW.project_id AND t.enabled;
      IF NOT FOUND THEN RAISE EXCEPTION 'Outbox target: no enabled reminder target of this project'; END IF;
      IF NEW.target_chat_id <> s.chat_id OR NEW.target_topic_id <> s.topic_id OR NEW.reply_to_message_id IS NOT NULL THEN
        RAISE EXCEPTION 'Outbox target: chat or topic differ from the reminder target, or the row answers a message';
      END IF;
      IF NOT ((s.kind = 'golive_status' AND NEW.template = 'reminder.golive_status')
           OR (s.kind = 'bom_meeting' AND NEW.template IN ('reminder.bom_meeting','reminder.bom_meeting_question'))) THEN
        RAISE EXCEPTION 'Outbox target: this reminder target does not take that message';
      END IF;
      IF NOT public.reminder_project_allowed(NEW.tenant_id, NEW.project_id) THEN
        RAISE EXCEPTION 'Outbox target: reminders are not sent for this project';
      END IF;
    ELSIF NEW.pool_item_id IS NOT NULL THEN
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

-- What the gateway's pull checks again before a reminder goes out: the target as it is now, whether the project may still get reminders, and for a meeting
-- message the series and its changes. Ids, times and IN codes only; no chat id comes back. Only rows of the caller's tenant and project scope.
CREATE OR REPLACE FUNCTION public.reminder_delivery_facts(target_row uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
  'now', now(),
  'targetOk', EXISTS (SELECT 1 FROM public.reminder_targets t WHERE t.id=o.reminder_target_id AND t.tenant_id=o.tenant_id AND t.project_id=o.project_id
    AND t.enabled AND t.chat_id=o.target_chat_id AND t.topic_id=o.target_topic_id),
  'projectAllowed', public.reminder_project_allowed(o.tenant_id,o.project_id),
  'params', o.payload->'params',
  'reminder', o.payload->'reminder',
  'series', (SELECT jsonb_build_object('weekday',s.weekday,'startTime',to_char(s.start_time,'HH24:MI'),'enabled',s.enabled) FROM public.meeting_series s
    WHERE s.tenant_id=o.tenant_id AND s.project_id=o.project_id AND s.id::text=o.payload->'reminder'->>'seriesId'),
  'changes', coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'seq',c.seq,'kind',c.kind,'sessionDate',to_char(c.session_date,'YYYY-MM-DD'),
     'effectiveFrom',to_char(c.effective_from,'YYYY-MM-DD'),'newTime',to_char(c.new_time,'HH24:MI'),'resolvesChangeId',c.resolves_change_id,
     'sourceRef','IN-'||upper(left(coalesce(c.source_candidate_id,c.source_pool_item_id)::text,8))) ORDER BY c.seq)
    FROM public.meeting_changes c WHERE c.tenant_id=o.tenant_id AND c.project_id=o.project_id AND c.series_id::text=o.payload->'reminder'->>'seriesId'),'[]'::jsonb))
 FROM public.outbox_messages o
 WHERE o.id=target_row AND o.reminder_target_id IS NOT NULL AND o.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND o.project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
$$;

-- The scheduler: its own reminder rows, inside the transaction's project scope.
DROP POLICY IF EXISTS reminder_select ON outbox_messages;
CREATE POLICY reminder_select ON outbox_messages FOR SELECT TO libetech_reminder
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND reminder_target_id IS NOT NULL
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[]));
DROP POLICY IF EXISTS reminder_insert ON outbox_messages;
CREATE POLICY reminder_insert ON outbox_messages FOR INSERT TO libetech_reminder
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND reminder_target_id IS NOT NULL AND audience='group'
  AND project_id=ANY(string_to_array(coalesce(current_setting('app.project_ids',true),''),',')::uuid[])
  AND state='pending' AND attempt_no=0 AND delivered_at IS NULL AND acknowledged_at IS NULL);

DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['public.reminder_project_allowed(uuid,uuid)','public.reminder_targets_guard()','public.meeting_changes_guard()',
   'public.meeting_source(uuid,text)','public.reminder_config_record()','public.tech_roster_members()','public.reminder_delivery_facts(uuid)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.reminder_project_allowed(uuid,uuid) TO libetech_reminder, libetech_projector;
GRANT EXECUTE ON FUNCTION public.meeting_source(uuid,text) TO libetech_runtime;
GRANT EXECUTE ON FUNCTION public.tech_roster_members() TO libetech_projector;
GRANT EXECUTE ON FUNCTION public.reminder_delivery_facts(uuid) TO libetech_intake;

GRANT USAGE ON SCHEMA public, analytics TO libetech_reminder;
GRANT SELECT ON reminder_targets, meeting_series, meeting_changes, analytics.golive_member_status TO libetech_reminder;
GRANT SELECT(id,tenant_id,name) ON projects TO libetech_reminder;
GRANT SELECT(id,tenant_id,project_id,reminder_target_id,template,state,dedupe_key,created_at) ON outbox_messages TO libetech_reminder;
GRANT INSERT(tenant_id,project_id,reminder_target_id,event_id,event_type,trace_id,correlation_id,audience,target_chat_id,target_topic_id,reply_to_message_id,template,payload,dedupe_key)
 ON outbox_messages TO libetech_reminder;
GRANT SELECT ON meeting_series, meeting_changes TO libetech_runtime;
GRANT UPDATE(version,updated_at) ON meeting_series TO libetech_runtime;
GRANT INSERT(tenant_id,project_id,series_id,kind,session_date,effective_from,new_time,source_candidate_id,source_pool_item_id,resolves_change_id,recorded_by,recorder_name,request_key,request_hash)
 ON meeting_changes TO libetech_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON analytics.golive_member_status TO libetech_projector;
GRANT SELECT(id,tenant_id,project_id,requester_id) ON work_requests TO libetech_projector;
GRANT SELECT(id,tenant_id,project_id,assignee_id,state,revision) ON work_items TO libetech_projector;
GRANT SELECT(tenant_id,project_id,work_id,revision) ON evidence TO libetech_projector;

INSERT INTO schema_migrations(version) VALUES('031') ON CONFLICT(version) DO NOTHING;
COMMIT;
