-- ============================================================
-- 0006 — AI Tech: Business Units + Task management nâng cao
-- ============================================================
-- LƯU Ý: File này là BẢN THAM CHIẾU (đọc để hiểu thay đổi).
-- Cách chuẩn để áp: chạy `npx drizzle-kit generate` để drizzle tự sinh
-- migration + cập nhật journal, rồi `npx drizzle-kit migrate` (hoặc migrate-prod.ts).
-- Nếu áp tay, chạy từng lệnh (ADD VALUE cho enum phải commit trước khi dùng).

-- 1) Role: thêm 'bom' (BOM lead)
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'bom' BEFORE 'user';

-- 2) Task status: thêm 'blocked' (vướng mắc)
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'blocked' AFTER 'in_progress';

-- 3) Enum mới
CREATE TYPE "public"."bu_charge_model" AS ENUM('revenue_share', 'subscription', 'build_24m');
CREATE TYPE "public"."work_type" AS ENUM('build', 'change_request', 'integration', 'report', 'maintenance', 'ops');

-- 4) Bảng business_units
CREATE TABLE IF NOT EXISTS "business_units" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "lead_user_id" text REFERENCES "users"("id"),
  "jira_project_key" text,
  "charge_model" "bu_charge_model" DEFAULT 'subscription' NOT NULL,
  "is_active" text DEFAULT 'true' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_bu_lead" ON "business_units" USING btree ("lead_user_id");

-- 5) Tasks: cột mới
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "bu_id" text REFERENCES "business_units"("id") ON DELETE set null;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "work_type" "work_type" DEFAULT 'build' NOT NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "ivp" real DEFAULT 1 NOT NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "progress_pct" integer DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_reason" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_by" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_since" timestamp;

-- self-FK cho việc con (xoá cha → xoá con)
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_fk"
  FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE cascade;

CREATE INDEX IF NOT EXISTS "idx_tasks_bu" ON "tasks" USING btree ("bu_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_parent" ON "tasks" USING btree ("parent_task_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" USING btree ("status");

-- 6) Bảng task_assignees (giao 1 việc cho nhiều người)
CREATE TABLE IF NOT EXISTS "task_assignees" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "tasks"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "contribution_weight" real DEFAULT 1 NOT NULL,
  "added_by" text REFERENCES "users"("id"),
  "added_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_task_assignee" UNIQUE("task_id","user_id")
);
CREATE INDEX IF NOT EXISTS "idx_task_assignees_user" ON "task_assignees" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_task_assignees_task" ON "task_assignees" USING btree ("task_id");

-- 7) Backfill: người nhận cũ (assignee_id) → task_assignees
INSERT INTO "task_assignees" ("id","task_id","user_id","contribution_weight","added_at")
SELECT gen_random_uuid()::text, "id", "assignee_id", 1, now()
FROM "tasks" WHERE "assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;
