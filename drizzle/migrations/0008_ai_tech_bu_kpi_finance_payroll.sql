-- 0008 — AI Tech: Business Units + Task nâng cao + KPI + Finance + Payroll
-- Bản này đã được LÀM SẠCH & IDEMPOTENT thủ công (chỉ additive, KHÔNG DROP).
-- Lý do: bản drizzle-kit generate ban đầu gộp nhầm các thay đổi của 0007/0008-manual
--        (do thiếu meta/0007_snapshot.json), gồm cả lệnh DROP phá huỷ. Đã loại bỏ.
-- LƯU Ý PostgreSQL: 2 lệnh ALTER TYPE ... ADD VALUE ở đầu file phải được COMMIT
-- trước khi giá trị mới được DÙNG. Ở đây các giá trị 'bom'/'blocked' KHÔNG dùng trong
-- bất kỳ lệnh DDL nào phía dưới, nên an toàn; vẫn nên chạy tách nếu migrate trên PG < 12.
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'bom' BEFORE 'user';--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'blocked' BEFORE 'in_review';--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."bu_charge_model" AS ENUM('revenue_share', 'subscription', 'build_24m'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."work_type" AS ENUM('build', 'change_request', 'integration', 'report', 'maintenance', 'ops'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_units" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"lead_user_id" text,
	"jira_project_key" text,
	"charge_model" "bu_charge_model" DEFAULT 'subscription' NOT NULL,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_assignees" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"contribution_weight" real DEFAULT 1 NOT NULL,
	"added_by" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_task_assignee" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"active_flag" boolean DEFAULT true NOT NULL,
	"accepted_suggestions" integer DEFAULT 0 NOT NULL,
	"ai_credits_used" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_usage_user_day" UNIQUE("user_id","day")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kpi_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"quarter" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_periods_quarter_unique" UNIQUE("quarter")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kpi_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_id" text NOT NULL,
	"tempo_score" real NOT NULL,
	"completion_score" real NOT NULL,
	"quality_score" real NOT NULL,
	"ai_score" real NOT NULL,
	"composite_score" real NOT NULL,
	"reviewer_id" text,
	"note" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_kpi_score_user_period" UNIQUE("user_id","period_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kpi_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_id" text NOT NULL,
	"tempo_target" real NOT NULL,
	"completion_target" real DEFAULT 0.9 NOT NULL,
	"quality_target" real DEFAULT 1 NOT NULL,
	"ai_target" real DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_kpi_target_user_period" UNIQUE("user_id","period_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quality_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_id" text,
	"type" text NOT NULL,
	"ref_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bu_revenues" (
	"id" text PRIMARY KEY NOT NULL,
	"bu_id" text NOT NULL,
	"month" text NOT NULL,
	"mechanism" text NOT NULL,
	"amount_vnd" bigint NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_bu_revenue_month_mechanism" UNIQUE("bu_id","month","mechanism")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_items" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"vendor" text,
	"amount_vnd" bigint NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ivp_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"bu_id" text NOT NULL,
	"total_ivp" real DEFAULT 0 NOT NULL,
	"ivp_price" bigint DEFAULT 2000000 NOT NULL,
	"charge_multiplier" real DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ivp_ledger_bu" UNIQUE("bu_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"composite_score" real NOT NULL,
	"floor_salary" real NOT NULL,
	"perf_salary" real NOT NULL,
	"bonus" real DEFAULT 0 NOT NULL,
	"total" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_payroll_line_run_user" UNIQUE("run_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"base_salary" real NOT NULL,
	"floor_pct" real DEFAULT 0.7 NOT NULL,
	"perf_pct" real DEFAULT 0.3 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_salary_config_user" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "bu_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "work_type" "work_type" DEFAULT 'build' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "ivp" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "progress_pct" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_by" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_since" timestamp;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "business_units" ADD CONSTRAINT "business_units_lead_user_id_users_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kpi_scores" ADD CONSTRAINT "kpi_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kpi_scores" ADD CONSTRAINT "kpi_scores_period_id_kpi_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."kpi_periods"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kpi_scores" ADD CONSTRAINT "kpi_scores_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_period_id_kpi_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."kpi_periods"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quality_events" ADD CONSTRAINT "quality_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quality_events" ADD CONSTRAINT "quality_events_period_id_kpi_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."kpi_periods"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bu_revenues" ADD CONSTRAINT "bu_revenues_bu_id_business_units_id_fk" FOREIGN KEY ("bu_id") REFERENCES "public"."business_units"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ivp_ledger" ADD CONSTRAINT "ivp_ledger_bu_id_business_units_id_fk" FOREIGN KEY ("bu_id") REFERENCES "public"."business_units"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_period_id_kpi_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."kpi_periods"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "salary_configs" ADD CONSTRAINT "salary_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_bu_id_business_units_id_fk" FOREIGN KEY ("bu_id") REFERENCES "public"."business_units"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bu_lead" ON "business_units" USING btree ("lead_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_assignees_user" ON "task_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_assignees_task" ON "task_assignees" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quality_events_user" ON "quality_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bu_revenues_bu" ON "bu_revenues" USING btree ("bu_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_bu" ON "tasks" USING btree ("bu_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_parent" ON "tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" USING btree ("status");--> statement-breakpoint
INSERT INTO "task_assignees" ("id","task_id","user_id","contribution_weight","added_at")
SELECT gen_random_uuid()::text, "id", "assignee_id", 1, now()
FROM "tasks" WHERE "assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- ═══ Gộp từ 0008_add_task_category_domain.sql (mồ côi, đã áp) — idempotent ═══
DO $$ BEGIN CREATE TYPE "public"."task_category" AS ENUM('project', 'operations'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "category" "task_category" DEFAULT 'project' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "domain" text;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_category" ON "tasks" USING btree ("category");--> statement-breakpoint
-- ═══ Gộp từ 0003_add_indexes_triggers.sql (mồ côi, đã áp) — idempotent ═══
-- (BỎ idx_modules_assignee: 0007 đã DROP cột modules.assignee_id → tạo index sẽ lỗi trên fresh-install)
CREATE INDEX IF NOT EXISTS "idx_score_events_user_created" ON "score_events" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_github_commits_project_committed" ON "github_commits" ("project_id","committed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comments_target" ON "comments" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications" ("user_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_modules_project" ON "modules" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_module" ON "tasks" ("module_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_assignee" ON "tasks" ("assignee_id");--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_score_user_event_ref') THEN ALTER TABLE "score_events" ADD CONSTRAINT "uq_score_user_event_ref" UNIQUE ("user_id","event_type","ref_id"); END IF; END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', tbl, tbl);
  END LOOP;
END;
$$;
