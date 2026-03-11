-- Project KPIs table
-- KPIs are extracted from "Sesión de Bienvenida" meeting briefs

CREATE TABLE IF NOT EXISTS project_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kpi_text TEXT NOT NULL,
  categoria TEXT DEFAULT 'general',  -- e.g. 'ventas', 'satisfaccion', 'tiempo', 'general'
  meta TEXT,                          -- target value e.g. "20% incremento", "NPS > 8"
  source_brief_id UUID REFERENCES meeting_briefs(id) ON DELETE SET NULL,
  confirmado BOOLEAN DEFAULT false,   -- confirmed by client success
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_kpis_project ON project_kpis(project_id);

ALTER TABLE project_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON project_kpis
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated read" ON project_kpis
  FOR SELECT USING (auth.role() = 'authenticated');
