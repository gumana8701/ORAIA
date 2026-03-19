-- Run this in Supabase SQL Editor

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS slack_channel_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS services_count INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'pendiente',
  completed BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  assignee TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT,
  drive_link TEXT,
  call_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
