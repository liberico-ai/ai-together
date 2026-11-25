-- Team Tech roster: add or remove people. RUN ONLY BY THE OPERATOR; the list of people is data from outside the repository, never written here.
-- Every real change writes one identity.events row (tech_roster_added / tech_roster_removed) through the trigger of migration 024, carrying the source named below.
-- Idempotent: adding someone already on the roster, or removing someone who is not on it, changes nothing and records nothing.
--
--   psql -X -v ON_ERROR_STOP=1 -d <database> \
--     -v tenant_id=<tenant uuid> -v user_ids=<uuid>,<uuid> -v action=add|remove -v source='<where the list comes from>' \
--     -f deploy/tech-roster.sql
--
-- Being on the roster is not a grant on any project: it lets a person see the project list (id, name, BU) and file a work request in any project.
BEGIN;
-- a wrong action fails the file here (division by zero) before anything is written
SELECT CASE WHEN :'action' IN ('add','remove') THEN 1 ELSE 1/0 END AS action_ok;
SELECT CASE WHEN length(:'source') BETWEEN 3 AND 300 THEN 1 ELSE 1/0 END AS source_ok;
SELECT set_config('libetech.roster_source', :'source', true);
INSERT INTO identity.tech_roster(tenant_id, user_id)
 SELECT :'tenant_id'::uuid, u::uuid FROM unnest(string_to_array(:'user_ids', ',')) AS u WHERE :'action' = 'add'
 ON CONFLICT (tenant_id, user_id) DO NOTHING;
DELETE FROM identity.tech_roster
 WHERE :'action' = 'remove' AND tenant_id = :'tenant_id'::uuid AND user_id = ANY (string_to_array(:'user_ids', ',')::uuid[]);
SELECT count(*) AS roster_size FROM identity.tech_roster WHERE tenant_id = :'tenant_id'::uuid;
COMMIT;
