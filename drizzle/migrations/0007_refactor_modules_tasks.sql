-- Migration: Refactor Module & Task system
-- Module: display-only (remove assignee, status, priority, output, deadline)
-- Task: belongs to Project directly (add project_id), optional module link, add estimate_days

-- ============================================================
-- STEP 1: Add project_id to tasks (nullable first for backfill)
-- ============================================================
ALTER TABLE "tasks" ADD COLUMN "project_id" text;

-- ============================================================
-- STEP 2: Add estimate_days to tasks
-- ============================================================
ALTER TABLE "tasks" ADD COLUMN "estimate_days" integer;

-- ============================================================
-- STEP 3: Backfill project_id from modules.project_id
-- ============================================================
UPDATE "tasks" t
SET "project_id" = m."project_id"
FROM "modules" m
WHERE t."module_id" = m."id";

-- ============================================================
-- STEP 4: Set project_id NOT NULL (after backfill)
-- ============================================================
ALTER TABLE "tasks" ALTER COLUMN "project_id" SET NOT NULL;

-- ============================================================
-- STEP 5: Add FK constraint for project_id
-- ============================================================
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;

-- ============================================================
-- STEP 6: Change module_id from NOT NULL to nullable
-- Drop old FK (cascade) and re-add as SET NULL
-- ============================================================
ALTER TABLE "tasks" ALTER COLUMN "module_id" DROP NOT NULL;

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_module_id_modules_id_fk";

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_module_id_modules_id_fk"
  FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL;

-- ============================================================
-- STEP 7: Add index on tasks.project_id
-- ============================================================
CREATE INDEX "idx_tasks_project" ON "tasks" ("project_id");

-- ============================================================
-- STEP 8: Drop module columns no longer needed
-- ============================================================
DROP INDEX IF EXISTS "idx_modules_assignee";

ALTER TABLE "modules" DROP COLUMN IF EXISTS "assignee_id";
ALTER TABLE "modules" DROP COLUMN IF EXISTS "status";
ALTER TABLE "modules" DROP COLUMN IF EXISTS "priority";
ALTER TABLE "modules" DROP COLUMN IF EXISTS "output";
ALTER TABLE "modules" DROP COLUMN IF EXISTS "deadline";
