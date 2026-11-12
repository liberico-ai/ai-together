-- Provide every approved Tech member a safe internal project for platform feedback.
-- Existing BU projects, work items, memberships and evidence remain unchanged.
BEGIN;
WITH tenants AS (
  SELECT DISTINCT tenant_id FROM identity.users
  WHERE username='chairman' AND active AND password_hash IS NOT NULL
)
INSERT INTO projects(tenant_id,name,bu)
SELECT tenant_id,'LibeTech AI OS · Nội bộ','LibeTech' FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM projects p WHERE p.tenant_id=t.tenant_id
  AND p.name='LibeTech AI OS · Nội bộ' AND p.bu='LibeTech'
);

WITH added AS (
  INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role,report_permissions)
  SELECT u.tenant_id,u.id,p.id,
    CASE WHEN u.username='chairman' THEN 'manager' ELSE 'viewer' END,
    ARRAY[]::text[]
  FROM identity.users u JOIN projects p ON p.tenant_id=u.tenant_id
  AND p.name='LibeTech AI OS · Nội bộ' AND p.bu='LibeTech'
  WHERE u.username IN ('chairman','quan','phuong') AND u.active AND u.password_hash IS NOT NULL
  ON CONFLICT(tenant_id,user_id,project_id) DO NOTHING
  RETURNING tenant_id,user_id,project_id
)
INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail)
SELECT tenant_id,user_id,NULL,'platform_workspace_seeded',
  jsonb_build_object('projectId',project_id,'source','migration-008') FROM added;

INSERT INTO schema_migrations(version) VALUES('008') ON CONFLICT(version) DO NOTHING;
COMMIT;
