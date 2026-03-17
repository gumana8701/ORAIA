-- PM Board Migration
-- Run this in Supabase SQL Editor

-- Add timestamps to notion_projects
ALTER TABLE notion_projects 
  ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_time TIMESTAMPTZ;

-- Add timestamps to notion_tasks
ALTER TABLE notion_tasks 
  ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_time TIMESTAMPTZ;

-- Status history table (tracks every etapa/estado change from now on)
CREATE TABLE IF NOT EXISTS project_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  notion_project_id TEXT,
  field TEXT NOT NULL CHECK (field IN ('etapa', 'estado')),
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psh_project_id ON project_status_history(project_id);
CREATE INDEX IF NOT EXISTS idx_psh_notion_id ON project_status_history(notion_project_id);
CREATE INDEX IF NOT EXISTS idx_psh_changed_at ON project_status_history(changed_at DESC);

-- Project 72h recap cache
CREATE TABLE IF NOT EXISTS project_recaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  recap_text TEXT NOT NULL,
  msg_count_72h INTEGER DEFAULT 0,
  meeting_count_72h INTEGER DEFAULT 0,
  alert_count_72h INTEGER DEFAULT 0,
  last_client_msg TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);
CREATE INDEX IF NOT EXISTS idx_project_recaps_pid ON project_recaps(project_id);
