-- ORAIA Project Hub - Schema
-- Run this in Supabase SQL Editor

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cliente TEXT NOT NULL,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'pausado', 'completado', 'en_riesgo')),
  prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  responsable TEXT,
  progreso INTEGER DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  whatsapp_chat_id TEXT UNIQUE,
  slack_channel_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project phases (onboarding → dev → staging → production)
CREATE TABLE IF NOT EXISTS phases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL CHECK (nombre IN ('onboarding', 'desarrollo', 'staging', 'produccion', 'soporte')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notas TEXT,
  created_by TEXT
);

-- Messages from WhatsApp and Slack
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  fuente TEXT NOT NULL CHECK (fuente IN ('whatsapp', 'slack', 'manual')),
  sender TEXT,
  contenido TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  es_del_cliente BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'
);

-- Follow-up tracking (response time windows)
CREATE TABLE IF NOT EXISTS followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  mensaje_id UUID REFERENCES messages(id),
  triggered_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  tiempo_respuesta_min INTEGER GENERATED ALWAYS AS (
    CASE WHEN responded_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (responded_at - triggered_at)) / 60
    ELSE NULL END
  ) STORED,
  notas TEXT
);

-- Auto-update updated_at on projects
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;

-- Allow full access via service role (used by our backend)
CREATE POLICY "service_role_all" ON projects FOR ALL USING (true);
CREATE POLICY "service_role_all" ON phases FOR ALL USING (true);
CREATE POLICY "service_role_all" ON messages FOR ALL USING (true);
CREATE POLICY "service_role_all" ON followups FOR ALL USING (true);

-- Sample project data
INSERT INTO projects (nombre, cliente, estado, prioridad, responsable, progreso)
VALUES 
  ('Plataforma E-commerce', 'Cliente A', 'activo', 'alta', 'Guillermo', 65),
  ('App Móvil iOS', 'Cliente B', 'en_riesgo', 'alta', 'Dev Team', 40),
  ('Rediseño Web Corporativa', 'Cliente C', 'pausado', 'media', 'Guillermo', 30),
  ('Sistema CRM Interno', 'Interno', 'completado', 'baja', 'Dev Team', 100);
