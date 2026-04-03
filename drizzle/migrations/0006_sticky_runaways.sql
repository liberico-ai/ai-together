CREATE TYPE "public"."operation_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "user_jira_map" (
	"user_id" text NOT NULL,
	"jira_account_id" text NOT NULL,
	"linked_at" timestamp DEFAULT now(),
	CONSTRAINT "user_jira_map_jira_account_id_unique" UNIQUE("jira_account_id")
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" text PRIMARY KEY NOT NULL,
	"jira_issue_key" text,
	"title" text NOT NULL,
	"description" text,
	"status" "operation_status" DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "jira_project_key" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "jira_issue_key" text;--> statement-breakpoint
ALTER TABLE "user_jira_map" ADD CONSTRAINT "user_jira_map_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;