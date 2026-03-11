-- Run this in Supabase SQL Editor
-- Creates the meeting_briefs table for Google Meet Gemini briefs

CREATE TABLE IF NOT EXISTS meeting_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ,
  drive_link TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  summary TEXT,
  decisions JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  participants JSONB DEFAULT '[]',
  ai_confidence FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_meeting_briefs_project ON meeting_briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_briefs_date ON meeting_briefs(meeting_date DESC);

-- RLS (same pattern as other tables)
ALTER TABLE meeting_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON meeting_briefs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read" ON meeting_briefs
  FOR SELECT USING (auth.role() = 'authenticated');
