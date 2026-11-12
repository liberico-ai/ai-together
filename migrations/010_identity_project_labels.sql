-- Identity-bound account approvers may see project names for frozen grants.
-- Other project data stays under the runtime role.
BEGIN;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
GRANT SELECT (id,tenant_id,name) ON projects TO libetech_identity;
DROP POLICY IF EXISTS identity_catalog_names ON projects;
CREATE POLICY identity_catalog_names ON projects FOR SELECT TO libetech_identity
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
INSERT INTO schema_migrations(version) VALUES('010') ON CONFLICT(version) DO NOTHING;
COMMIT;
