# ORAIA Webapp — Backlog de Features

> Capturado 2026-03-19. Trabajar una a una, con contexto de Guillermo antes de implementar.

---

## 🔵 Héctor
- [ ] **H1** — Canal Dedicado por proyecto
- [ ] **H2** — Standarizar nombres (proyectos)
- [ ] **H3** — Agregar el documento con el link de la reunión *(ya hay recording_url — revisar si es esto)*
- [ ] **H4** — Estado total del proyecto: status en base a tareas + reuniones + delivery + estado Twilio + FAQs + si cliente es complicado/problemático → colocarlo dentro del agente
- [ ] **H5** — Cantidad de servicios contratados
- [ ] **H6** — Todos los de ORA son ops administradores (permisos)

---

## 🟠 Enzo
- [ ] **E1** — Tareas y Sub Tareas
- [ ] **E2** — Notificaciones de asignación
- [ ] **E3** — Cada nuevo mensaje/reunión → agente analiza riesgo → envía alerta + mensaje Slack por canal del proyecto
- [ ] **E4** — Tickets para solicitudes (ej: desbloqueo de tareas por pendientes dentro de las tareas)
- [ ] **E5** — On Boarding

---

## 🟢 Luca
- [ ] **L1** — Filtrado de proyectos de acuerdo a asignación
- [ ] **L2** — Tareas: filtrar por pendientes y completadas
- [ ] **L3** — Arreglar visual en cel/tablet (responsive)
- [ ] **L4** — Descripción de empresa + objetivo del proyecto (campo principal)

---

---

## 📋 Task Templates (para onboarding)

### Voz (IVR, Callbot, Agente de Voz)
1. Recolección de requerimientos (objetivos y casos de uso)
2. Configuración de número telefónico (Twilio u otro proveedor)
3. Redacción y grabación de voces (o configuración de TTS)
4. Diseño y configuración del flujo de llamadas (IVR, menú, transferencias)
5. Integración con sistemas externos (CRM, bases de datos, APIs)
6. Pruebas internas (QA)
7. Pruebas con cliente
8. Ajustes finales
9. Go Live / Puesta en producción
10. Monitoreo y soporte inicial

### WhatsApp/Texto (Chatbot, Agente de Texto)
1. Recolección de requerimientos (objetivos y casos de uso)
2. Conexión del número de WhatsApp/SMS (configuración y verificación)
3. Configuración del agente/chatbot (flujos conversacionales y respuestas automáticas)
4. Integración con CRM o sistemas externos
5. Configuración de AppLevel/permisos y accesos
6. Pruebas internas (QA)
7. Pruebas con cliente
8. Ajustes finales
9. Go Live / Puesta en producción
10. Monitoreo y soporte inicial

---

## 🚀 Onboarding Wizard — Diseño

### Flujo:
1. Nombre exacto del grupo WhatsApp (required, copy-paste → vincula monitoreo)
2. Tipo de proyecto: Voz | WhatsApp/Texto
3. Notion project (dropdown de proyectos existentes)
4. Developer(s) asignados (multi-select)
5. Nombre canal Slack (auto-sugerido del nombre WA, editable)
6. Click "Onboard" →
   - Crea/actualiza proyecto en Supabase
   - Crea canal Slack privado (Jennifer + Trina + Guille + Enzo + devs seleccionados)
   - Genera tasks default según tipo
   - Busca Welcome Call en Drive → extrae KPIs si encuentra
   - Si no encuentra → agrega a "Llamadas Pendientes" (solo Enzo y Guillermo ven)

### Solo pueden hacer onboarding: Enzo y Guillermo

### Slack - falta scope `groups:write` (pendiente de agregar)

### DB changes needed:
- `project_tasks` table: id, project_id, title, status, completed, order, category
- `pending_calls` table: id, project_id, title, drive_link, created_at
- `projects` table: add `project_type` (voice/whatsapp), `slack_channel_id`

---

## Estado
- Total: 15 features
- Completadas: 0
- En progreso: 0
- **Prioridad 1:** Onboarding Wizard (resuelve H1, H2, E1, E5, L4, parte de H4)
