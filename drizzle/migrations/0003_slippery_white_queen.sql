ALTER TABLE "modules" ADD COLUMN "output" text;--> statement-breakpoint
CREATE INDEX "idx_modules_project" ON "modules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_modules_assignee" ON "modules" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_module" ON "tasks" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_comments_target" ON "comments" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_score_events_user_created" ON "score_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_github_commits_project_committed" ON "github_commits" USING btree ("project_id","committed_at");--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "uq_score_user_event_ref" UNIQUE("user_id","event_type","ref_id");