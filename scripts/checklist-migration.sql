-- ── task_checklist_items ─────────────────────────────────────────────────────
-- Checklist items per task (or subtask). Linked to project_tasks.
-- Run this on Supabase SQL editor.

CREATE TABLE IF NOT EXISTS task_checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by  TEXT,
  completed_at  TIMESTAMPTZ,
  order_index   INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_checklist_items_task_id_idx ON task_checklist_items(task_id);
CREATE INDEX IF NOT EXISTS task_checklist_items_project_id_idx ON task_checklist_items(project_id);

-- RLS: allow service_role full access (app uses service_role key)
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON task_checklist_items
  FOR ALL USING (true) WITH CHECK (true);

-- notes field on project_tasks if not already present (for task description)
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS description TEXT;
