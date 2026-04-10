-- Add category enum and domain field to tasks
-- Make projectId nullable (operations tasks don't belong to a project)

CREATE TYPE "public"."task_category" AS ENUM('project', 'operations');

-- Add new columns
ALTER TABLE "tasks" ADD COLUMN "category" "task_category" DEFAULT 'project' NOT NULL;
ALTER TABLE "tasks" ADD COLUMN "domain" text;

-- Make project_id nullable (drop NOT NULL if it exists)
ALTER TABLE "tasks" ALTER COLUMN "project_id" DROP NOT NULL;

-- Set existing tasks to 'project' category
UPDATE "tasks" SET "category" = 'project' WHERE "category" IS NULL;

-- Add index for category filtering
CREATE INDEX IF NOT EXISTS "idx_tasks_category" ON "tasks" USING btree ("category");
