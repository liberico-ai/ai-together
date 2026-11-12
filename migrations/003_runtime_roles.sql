-- Runtime accounts may assume only their respective narrowly scoped roles.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='libetech_web') THEN
  CREATE ROLE libetech_web LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='libetech_auth') THEN
  CREATE ROLE libetech_auth LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;
GRANT libetech_runtime TO libetech_web;
GRANT libetech_identity TO libetech_auth;
GRANT SELECT ON schema_migrations TO libetech_web;
INSERT INTO schema_migrations(version) VALUES('003') ON CONFLICT(version) DO NOTHING;
COMMIT;
