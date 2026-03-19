# ORAIA Webapp — Backlog de Features

> Capturado 2026-03-19. Actualizado misma fecha.

---

## 🔵 Héctor
- [x] **H1** — Canal Dedicado por proyecto *(onboarding crea canal Slack automático — falta scope `groups:write` en Slack app)*
- [x] **H2** — Standarizar nombres *(onboarding usa nombre exacto de WA como nombre del proyecto)*
- [x] **H3** — Link de la reunión grabada *(recording_url en meeting briefs + botón ▶ en panel)*
- [ ] **H4** — Estado total del proyecto (score con tareas + delivery + Twilio + FAQs + cliente difícil) — *complejo, próxima sesión*
- [ ] **H5** — Cantidad de servicios contratados — *pendiente*
- [ ] **H6** — Todos los de ORA = ops admins — *Guillermo lo hará manual (WhatsApp)*

---

## 🟠 Enzo
- [x] **E1** — Tareas generadas automáticamente en onboarding (10 voz / 10 WA / 20 ambos)
- [ ] **E2** — Notificaciones de asignación — *pendiente*
- [ ] **E3** — Agente analiza cada msg/reunión → alerta + Slack por canal — *necesita groups:write primero*
- [ ] **E4** — Tickets para solicitudes / desbloqueo de tareas — *pendiente*
- [x] **E5** — Onboarding Wizard *(3 pasos: proyecto → equipo → resultado)*

---

## 🟢 Luca
- [ ] **L1** — Filtrado de proyectos por dev asignado — *pendiente*
- [ ] **L2** — Tareas: filtrar pendientes/completadas — *tab Tareas existe, filtros pendientes*
- [ ] **L3** — Responsive cel/tablet — *pendiente*
- [x] **L4** — Descripción empresa + objetivo + KPIs extraídos por Gemini desde llamada de bienvenida

---

## Pendiente técnico
- Agregar scope `groups:write` en Slack app → habilita H1 completo y E3
- GEMINI_API_KEY y SLACK_BOT_TOKEN en Vercel env vars

---

## 📋 Task Templates

### Voz
1. Recolección de requerimientos
2. Configuración número telefónico (Twilio)
3. Redacción y grabación de voces (o TTS)
4. Diseño flujo de llamadas (IVR)
5. Integración sistemas externos
6. Pruebas internas (QA)
7. Pruebas con cliente
8. Ajustes finales
9. Go Live
10. Monitoreo y soporte inicial

### WhatsApp/Texto
1. Recolección de requerimientos
2. Conexión número WhatsApp/SMS
3. Configuración agente/chatbot
4. Integración CRM o sistemas externos
5. Configuración AppLevel/permisos
6. Pruebas internas (QA)
7. Pruebas con cliente
8. Ajustes finales
9. Go Live
10. Monitoreo y soporte inicial
