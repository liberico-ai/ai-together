-- The three BoM Tech of a tenant (migration 028). RUN ONLY BY THE OPERATOR; who they are is data from outside the repository, never written here.
-- Sets exactly the three accounts given, in seat order 1, 2, 3. Every change writes one identity.events row (tech_bom_added / tech_bom_removed) through the
-- trigger of migration 028, carrying the source named below. Idempotent: running it again with the same list changes nothing and records nothing.
--
--   psql -X -v ON_ERROR_STOP=1 -d <database> \
--     -v tenant_id=<tenant uuid> -v user_ids=<uuid>,<uuid>,<uuid> -v source='<where the decision comes from>' \
--     -f deploy/tech-bom.sql
--
-- A BoM Tech, other than the requester, may approve or reject a work request in every project of the tenant, on the web, without a Telegram link. It is not a seat
-- of the 3/3 ballot of any project: those seats stay in bom_scopes (deploy/bom-seats.sql). Each account must exist and be active.
BEGIN;
-- a list that is not three distinct ids, a short source, or an account that is missing or disabled fails the file here (division by zero) before anything is
-- written. Where the test reads a table, the divisor is the CASE itself: a constant 1/0 in a branch would be folded by the planner even when not taken.
SELECT 1 / CASE WHEN cardinality(string_to_array(:'user_ids', ',')::uuid[]) = 3
  AND (SELECT count(DISTINCT u) FROM unnest(string_to_array(:'user_ids', ',')::uuid[]) AS u) = 3 THEN 1 ELSE 0 END AS three_ok;
SELECT CASE WHEN length(:'source') BETWEEN 3 AND 300 THEN 1 ELSE 1/0 END AS source_ok;
SELECT 1 / CASE WHEN (SELECT count(*) FROM identity.users WHERE tenant_id = :'tenant_id'::uuid AND active
  AND id = ANY (string_to_array(:'user_ids', ',')::uuid[])) = 3 THEN 1 ELSE 0 END AS accounts_ok;
SELECT set_config('libetech.tech_bom_source', :'source', true);
-- a row that is not the given person in the given seat goes first, so the seats and the people stay unique while the list changes
DELETE FROM identity.tech_bom b
 WHERE b.tenant_id = :'tenant_id'::uuid
  AND NOT EXISTS (SELECT 1 FROM unnest(string_to_array(:'user_ids', ',')::uuid[]) WITH ORDINALITY AS g(user_id, seat)
   WHERE g.user_id = b.user_id AND g.seat = b.seat);
INSERT INTO identity.tech_bom(tenant_id, user_id, seat)
 SELECT :'tenant_id'::uuid, g.user_id, g.seat FROM unnest(string_to_array(:'user_ids', ',')::uuid[]) WITH ORDINALITY AS g(user_id, seat)
 ON CONFLICT DO NOTHING;
SELECT count(*) AS tech_bom_size FROM identity.tech_bom WHERE tenant_id = :'tenant_id'::uuid;
COMMIT;
