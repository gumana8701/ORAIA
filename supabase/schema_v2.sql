-- ORAIA Schema v2 - Participants, Alerts, Response Times
-- Run this in Supabase SQL Editor (after schema.sql)

-- Participants table (team members + clients)
CREATE TABLE IF NOT EXISTS participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('team', 'client', 'unknown')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Link participants to projects
CREATE TABLE IF NOT EXISTS project_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  rol TEXT DEFAULT 'miembro',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, participant_id)
);

-- Alerts table (auto-generated flags)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('reembolso', 'pago', 'enojo', 'silencio', 'entrega', 'cancelacion', 'urgente', 'otro')),
  descripcion TEXT,
  nivel TEXT DEFAULT 'medio' CHECK (nivel IN ('bajo', 'medio', 'alto', 'critico')),
  resuelta BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Response time tracking (per message thread)
CREATE TABLE IF NOT EXISTS response_times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  mensaje_cliente_id UUID REFERENCES messages(id),
  mensaje_respuesta_id UUID REFERENCES messages(id),
  respondido_por UUID REFERENCES participants(id),
  tiempo_minutos INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON participants FOR ALL USING (true);
CREATE POLICY "service_role_all" ON project_participants FOR ALL USING (true);
CREATE POLICY "service_role_all" ON alerts FOR ALL USING (true);
CREATE POLICY "service_role_all" ON response_times FOR ALL USING (true);

-- Seed ORA IA team members
INSERT INTO participants (nombre, telefono, tipo) VALUES
  ('Jennifer Ora IA',  '+5212284761249', 'team'),
  ('Jorge Salamanca',  '+573232234915',  'team'),
  ('Hector Ramirez',   '+50377021771',   'team'),
  ('Trina Gomez',      '+584221110843',  'team'),
  ('Enzo ORA IA',      '+5492494206082', 'team'),
  ('Kevin Ora IA',     '+573046566853',  'team'),
  ('Javier Ora',       '+5215646624682', 'team'),
  ('Luca Fonzo',       '+5492494628103', 'team')
ON CONFLICT (telefono) DO NOTHING;

-- Useful view: project summary with last message and alert count
CREATE OR REPLACE VIEW project_summary AS
SELECT 
  p.id,
  p.nombre,
  p.cliente,
  p.estado,
  p.prioridad,
  p.responsable,
  p.progreso,
  p.whatsapp_chat_id,
  p.updated_at,
  (SELECT COUNT(*) FROM alerts a WHERE a.project_id = p.id AND a.resuelta = false) AS alertas_abiertas,
  (SELECT contenido FROM messages m WHERE m.project_id = p.id ORDER BY m.timestamp DESC LIMIT 1) AS ultimo_mensaje,
  (SELECT timestamp FROM messages m WHERE m.project_id = p.id ORDER BY m.timestamp DESC LIMIT 1) AS ultima_actividad,
  (SELECT AVG(rt.tiempo_minutos) FROM response_times rt WHERE rt.project_id = p.id) AS tiempo_respuesta_promedio_min
FROM projects p;
