-- Migration: Add composite indexes, unique constraints, and updatedAt trigger
-- Applied as part of Audit Sprint 1-3 fixes
-- Date: 2026-03-20

-- ============================================================
-- D-01: Composite indexes for query performance (CRITICAL)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_score_events_user_created ON score_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_github_commits_project_committed ON github_commits(project_id, committed_at);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_modules_project ON modules(project_id);
CREATE INDEX IF NOT EXISTS idx_modules_assignee ON modules(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_module ON tasks(module_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

-- ============================================================
-- NEW-05 / FIX-ISSUE-01: Unique constraint for de-duplicating score events
-- Required for onConflictDoNothing() to work in Drizzle ORM
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_score_user_event_ref'
  ) THEN
    ALTER TABLE score_events ADD CONSTRAINT uq_score_user_event_ref UNIQUE (user_id, event_type, ref_id);
  END IF;
END $$;

-- ============================================================
-- D-03: Auto-update updatedAt trigger
-- Applied to ALL tables with updated_at column
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;
