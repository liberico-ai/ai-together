ALTER TABLE "documents" ADD COLUMN "s3_key" text;--> statement-breakpoint
ALTER TABLE "github_commits" ADD COLUMN "ci_status" text;--> statement-breakpoint
ALTER TABLE "github_commits" ADD COLUMN "ci_url" text;--> statement-breakpoint
ALTER TABLE "github_commits" ADD COLUMN "ci_updated_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_documents_target" ON "documents" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_activity_log_user" ON "user_activity_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_target" ON "reviews" USING btree ("target_type","target_id");