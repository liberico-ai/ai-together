-- The base schedule of a BoM meeting of one project (migration 031). RUN ONLY BY THE OPERATOR. Weekday 1 = Monday … 7 = Sunday, time in Vietnam local time.
-- One series per project and title; running it again with the same values changes nothing. A change of the base schedule moves the version (the web form then
-- asks to reload) and writes one reminder_config_events row with the source. Changes of single sessions, and changes agreed in a meeting, are recorded on the
-- web page «Lịch họp BoM» by a BoM seat or a BoM Tech, not here.
-- expected_version: the version the operator read from the last run (0 for a series that does not exist yet). A change is refused when the series moved since,
-- including a change recorded on the web.
--
--   psql -X -v ON_ERROR_STOP=1 -d <database> -v tenant_id=<tenant uuid> -v project_id=<project uuid> -v title='Họp BoM' \
--     -v weekday=4 -v start_time=09:00 -v enabled=true|false -v source='<where the schedule comes from>' -v expected_version=<n> -f deploy/meeting-series.sql
BEGIN;
SELECT CASE WHEN length(:'source') BETWEEN 3 AND 300 THEN 1 ELSE 1/0 END AS source_ok;
SELECT set_config('libetech.reminder_source', :'source', true) IS NOT NULL AS source_set;
SELECT set_config('libetech.request_id', gen_random_uuid()::text, true) IS NOT NULL AS request_named;
SELECT 1 / (CASE WHEN :'expected_version'::int = 0 OR EXISTS (SELECT 1 FROM meeting_series
  WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid AND title = :'title') THEN 1 ELSE 0 END) AS series_known;
INSERT INTO meeting_series AS s(tenant_id, project_id, title, weekday, start_time, enabled)
 VALUES (:'tenant_id'::uuid, :'project_id'::uuid, :'title', :'weekday'::smallint, :'start_time'::time, :'enabled'::boolean)
 ON CONFLICT (tenant_id, project_id, title) DO UPDATE SET weekday = EXCLUDED.weekday, start_time = EXCLUDED.start_time, enabled = EXCLUDED.enabled,
  base_revision = s.base_revision + 1, version = s.version + 1, updated_at = now()
 WHERE (s.weekday, s.start_time, s.enabled) IS DISTINCT FROM (EXCLUDED.weekday, EXCLUDED.start_time, EXCLUDED.enabled) AND s.version = :'expected_version'::int;
SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM meeting_series WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid AND title = :'title'
  AND (weekday, start_time, enabled) IS NOT DISTINCT FROM (:'weekday'::smallint, :'start_time'::time, :'enabled'::boolean)) THEN 1 ELSE 0 END) AS written;
SELECT title, weekday, to_char(start_time, 'HH24:MI') AS start_time, enabled, version FROM meeting_series
 WHERE tenant_id = :'tenant_id'::uuid AND project_id = :'project_id'::uuid ORDER BY title;
COMMIT;
