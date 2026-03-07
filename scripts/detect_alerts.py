"""
ORAIA Alert Detection — v2.0
Basado en el proceso estandarizado de 3 llamadas en 15 días hábiles.

Tipos de alerta:
  cancelacion  — cliente quiere salirse del contrato
  reembolso    — solicitud de devolución (redirigir a Jennifer)
  pago         — tema comercial/facturación (redirigir a Jennifer)
  enojo        — frustración del cliente con el servicio técnico
  entrega      — preocupaciones de tiempo/demora de entrega
  urgente      — falla técnica crítica (agente caído, GHL roto, etc.)
  silencio     — proyecto sin actividad según su fase
  otro         — señales de riesgo general

En riesgo si:
  - tiene alerta tipo cancelacion o reembolso
  - tiene alerta enojo nivel alto o critico
  - silencio > 7 días (proyecto activo)
  - 3+ alertas sin resolver
  - urgente nivel critico
"""

import os, re
from datetime import datetime, timezone, timedelta
from supabase import create_client

SUPABASE_URL = "https://nhsxwgrekdmkxemdoqqx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3h3Z3Jla2Rta3hlbWRvcXF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyODE2NywiZXhwIjoyMDg4NDA0MTY3fQ.5rbxlYG2Z5wY5GoacHbr-rOruvY4nsPu_yHEfEP0kMM"

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── TEAM MEMBERS (para es_del_cliente) ──────────────────────────────────────
TEAM_KEYWORDS = {
    "jennifer ora", "jennifer",           # Client Success Manager (comercial)
    "javi ora", "javier",
    "ora ia", "oraia",
    "hector ora", "hector ramirez", "héctor ramirez", "héctor",
    "trina gomez", "trina gómez",
    "jorge salamanca", "jorge",
    "enzo ora", "enzo",
    "kevin ora", "kevin",
    "luca fonzo", "lucas fonzo", "lucas", "luca",
    "guillermo",
    "victor ramires", "victor",
}

# ─── ALERT KEYWORD RULES ─────────────────────────────────────────────────────
# (pattern, tipo, nivel_base, descripcion_template)
ALERT_RULES = [

    # ── CANCELACIÓN — cliente quiere irse ──────────────────────────────────
    (r'\b(cancel(ar|ación|acion)|me\s+voy\s+(a\s+)?ir|no\s+quiero\s+continuar|terminar\s+(el\s+)?(contrato|servicio)|darme\s+de\s+baja|ya\s+no\s+quiero)\b',
     'cancelacion', 'critico', 'Cliente expresa intención de cancelar el servicio'),

    # ── REEMBOLSO — tema comercial → Jennifer ──────────────────────────────
    (r'\b(reembols(o|ar)|devoluc(ión|ion)|devolver\s+(el\s+)?dinero|regresar?\s+(el\s+)?dinero|quiero\s+(mi\s+)?dinero\s+(de\s+)?vuelta)\b',
     'reembolso', 'alto', 'Cliente solicita reembolso → redirigir a Jennifer'),

    # ── PAGO — tema comercial → Jennifer ───────────────────────────────────
    (r'\b(no\s+(he\s+)?(podido\s+)?pag(ar|o)|problem(a|as)\s+(con\s+)?(el\s+)?pago|factur(a|ación|acion)|cobr(o|aron|aste|aste)\s+(de\s+)?más|precio|cobro\s+incorrecto|cargo\s+indebido)\b',
     'pago', 'medio', 'Tema de pago o facturación → redirigir a Jennifer'),

    # ── ENOJO — frustración técnica del cliente ────────────────────────────
    (r'\b(esto\s+(no\s+)?funciona|no\s+sirve|qué\s+mal|pesim(o|a)|horrible|inaceptable|harto|hasta\s+(la\s+)?coronilla|ya\s+no\s+aguanto|muy\s+molest(o|a)|frustrad(o|a)|decepcionad(o|a)|esto\s+es\s+una\s+basura|mentira|nos\s+(están\s+)?engañando|pésimo\s+servicio|mal\s+servicio)\b',
     'enojo', 'alto', 'Cliente expresa frustración o enojo con el servicio'),

    (r'\b(no\s+me\s+gusta|no\s+estoy\s+conforme|no\s+me\s+convence|esperaba\s+más|no\s+es\s+lo\s+que\s+acordamos|esto\s+no\s+era\s+lo\s+que|no\s+cumplieron)\b',
     'enojo', 'medio', 'Cliente insatisfecho con el resultado entregado'),

    # ── URGENTE — fallas técnicas críticas ────────────────────────────────
    (r'\b(agente\s+(no\s+)?(está\s+)?(contestando|funciona|responde|anda)|bot\s+(caído|roto|no\s+funciona)|no\s+contesta\s+nadie|sistema\s+(caído|abajo)|conexión\s+(rota|perdida)|gohighlevel\s+(no|está\s+caído)|ghl\s+(no|caído|roto)|webhook\s+(roto|no\s+funciona)|api\s+(caída|no\s+responde)|pérdida\s+de\s+datos|perdimos\s+datos)\b',
     'urgente', 'critico', 'Falla técnica crítica detectada — sistema/agente caído o con errores graves'),

    (r'\b(error\s+en\s+el\s+agente|bug\s+crítico|bug\s+grave|no\s+(está\s+)?funcionando\s+(bien|correctamente)|está\s+fallando|sigue\s+sin\s+funcionar|todavía\s+(no\s+)?funciona|no\s+ha\s+funcionado)\b',
     'urgente', 'alto', 'Error técnico significativo reportado por el cliente'),

    (r'\b(pequeño\s+error|ajuste\s+menor|detalle\s+a\s+corregir|falla\s+menor|algo\s+que\s+ajustar)\b',
     'urgente', 'bajo', 'Ajuste técnico menor solicitado por el cliente'),

    # ── ENTREGA — tiempos y demoras ────────────────────────────────────────
    (r'\b(cuándo\s+(estará|me|van|nos|entregan|queda)|para\s+cuándo|cuánto\s+(tiempo|falta|más|tardan|tarda)|tardando\s+mucho|llevan\s+(mucho|días|semanas)|siguen\s+tardando|no\s+han\s+(terminado|entregado)|demora(ndo)?|atraso|se\s+está\s+tardando|más\s+de\s+(una\s+)?(semana|2\s+semanas))\b',
     'entrega', 'medio', 'Cliente pregunta o se queja sobre tiempos de entrega'),

    (r'\b(necesito\s+(esto\s+)?(para\s+)?(hoy|mañana|ya|urgente|lo\s+antes\s+posible|cuanto\s+antes)|lo\s+necesito\s+ya|es\s+urgente|para\s+ayer)\b',
     'entrega', 'alto', 'Cliente expresa urgencia en la entrega'),

    # ── FUERA DE ALCANCE → Jennifer (registrado como 'otro') ──────────────
    (r'\b(soporte\s+de\s+twilio|twilio\s+(no|caído|error)|número\s+de\s+twilio|renovar\s+(el\s+)?contrato|renovación|upgrade|cambiar\s+(de\s+)?plan|plan\s+(más|mayor)|descuento|oferta\s+especial)\b',
     'otro', 'bajo', 'Tema fuera de alcance técnico → redirigir a Jennifer (Twilio/renovación/plan)'),
]

# Compilar todos los patrones
COMPILED_RULES = [
    (re.compile(pat, re.IGNORECASE | re.UNICODE), tipo, nivel, desc)
    for pat, tipo, nivel, desc in ALERT_RULES
]

# ─── NIVEL ORDINAL ────────────────────────────────────────────────────────────
NIVEL_ORDER = {'bajo': 0, 'medio': 1, 'alto': 2, 'critico': 3}


def analyze_message(contenido: str) -> list[dict]:
    """Retorna lista de {tipo, nivel, descripcion} para un mensaje."""
    hits = {}
    for pattern, tipo, nivel, desc in COMPILED_RULES:
        if pattern.search(contenido):
            # Solo guardar el más severo por tipo
            if tipo not in hits or NIVEL_ORDER[nivel] > NIVEL_ORDER[hits[tipo]['nivel']]:
                hits[tipo] = {'tipo': tipo, 'nivel': nivel, 'descripcion': desc}
    return list(hits.values())


def dias_sin_actividad(ultima_actividad_str: str | None) -> int:
    if not ultima_actividad_str:
        return 999
    try:
        dt = datetime.fromisoformat(ultima_actividad_str.replace('Z', '+00:00'))
        return (datetime.now(timezone.utc) - dt).days
    except Exception:
        return 0


def should_be_en_riesgo(project_alerts: list[dict], dias_silencio: int, estado_actual: str) -> bool:
    """Determina si un proyecto debe marcarse como en_riesgo."""
    tipos = {a['tipo'] for a in project_alerts}
    niveles = {a['nivel'] for a in project_alerts}

    if 'cancelacion' in tipos:
        return True
    if 'reembolso' in tipos:
        return True
    if 'enojo' in tipos and ('alto' in niveles or 'critico' in niveles):
        return True
    if 'urgente' in tipos and 'critico' in niveles:
        return True
    if len(project_alerts) >= 3:
        return True
    if dias_silencio >= 7 and estado_actual == 'activo':
        return True

    return False


def run():
    print("🔍 ORAIA Alert Detection v2.0")
    print("=" * 50)

    # Limpiar alertas existentes
    sb.table('alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("🗑️  Alertas anteriores eliminadas")

    # Cargar proyectos
    projects = sb.table('projects').select('id,nombre,estado,ultima_actividad').execute().data
    print(f"📁 {len(projects)} proyectos")

    # Cargar mensajes de clientes (los del equipo ya los conocemos)
    messages = sb.table('messages').select('id,project_id,contenido,sender,es_del_cliente,timestamp').execute().data

    # Agrupar mensajes por proyecto
    msgs_by_project: dict[str, list] = {}
    for m in messages:
        msgs_by_project.setdefault(m['project_id'], []).append(m)

    all_alerts = []
    project_alert_counts = {}
    projects_to_en_riesgo = []

    for project in projects:
        pid = project['id']
        nombre = project['nombre']
        estado = project['estado']
        msgs = msgs_by_project.get(pid, [])

        # Solo analizar mensajes de clientes para alertas
        client_msgs = [m for m in msgs if m.get('es_del_cliente')]

        # Detectar alertas por keywords
        project_alerts = []
        seen_types = {}  # tipo → alerta más severa

        for msg in client_msgs:
            hits = analyze_message(msg.get('contenido', ''))
            for hit in hits:
                t = hit['tipo']
                if t not in seen_types or NIVEL_ORDER[hit['nivel']] > NIVEL_ORDER[seen_types[t]['nivel']]:
                    seen_types[t] = {
                        **hit,
                        'project_id': pid,
                        'message_id': msg['id'],
                    }

        # Detectar silencio
        dias_silencio = dias_sin_actividad(project.get('ultima_actividad'))
        if dias_silencio >= 14 and estado in ('activo', 'en_riesgo'):
            seen_types['silencio'] = {
                'tipo': 'silencio',
                'nivel': 'critico',
                'descripcion': f'Proyecto sin actividad por {dias_silencio} días — situación crítica',
                'project_id': pid,
                'message_id': None,
            }
        elif dias_silencio >= 7 and estado in ('activo', 'en_riesgo'):
            seen_types['silencio'] = {
                'tipo': 'silencio',
                'nivel': 'alto',
                'descripcion': f'Proyecto sin actividad por {dias_silencio} días',
                'project_id': pid,
                'message_id': None,
            }
        elif dias_silencio >= 4 and estado == 'activo':
            seen_types['silencio'] = {
                'tipo': 'silencio',
                'nivel': 'medio',
                'descripcion': f'Proyecto sin actividad por {dias_silencio} días',
                'project_id': pid,
                'message_id': None,
            }

        project_alerts = list(seen_types.values())

        if project_alerts:
            all_alerts.extend(project_alerts)
            project_alert_counts[pid] = len(project_alerts)
            count_display = len(project_alerts)

            # Determinar si debe ser en_riesgo
            if should_be_en_riesgo(project_alerts, dias_silencio, estado):
                projects_to_en_riesgo.append(pid)

            tipos_str = ', '.join(set(a['tipo'] for a in project_alerts))
            print(f"  ⚠️  {nombre}: {count_display} alerta(s) [{tipos_str}]")

    # Insertar alertas
    if all_alerts:
        insert_rows = []
        for a in all_alerts:
            row = {
                'project_id': a['project_id'],
                'tipo': a['tipo'],
                'nivel': a['nivel'],
                'descripcion': a['descripcion'],
                'resuelta': False,
            }
            if a.get('message_id'):
                row['message_id'] = a['message_id']
            insert_rows.append(row)

        for i in range(0, len(insert_rows), 100):
            sb.table('alerts').insert(insert_rows[i:i+100]).execute()

        print(f"\n✅ {len(all_alerts)} alertas insertadas en {len(project_alert_counts)} proyectos")

    # Actualizar alertas_count en proyectos
    for pid, count in project_alert_counts.items():
        sb.table('projects').update({'alertas_count': count}).eq('id', pid).execute()

    # Reset alertas_count a 0 para proyectos sin alertas
    pids_with_alerts = list(project_alert_counts.keys())
    all_pids = [p['id'] for p in projects]
    for pid in all_pids:
        if pid not in pids_with_alerts:
            sb.table('projects').update({'alertas_count': 0}).eq('id', pid).execute()

    # Marcar en_riesgo
    if projects_to_en_riesgo:
        for pid in projects_to_en_riesgo:
            current = next((p['estado'] for p in projects if p['id'] == pid), None)
            if current not in ('pausado', 'completado'):
                sb.table('projects').update({'estado': 'en_riesgo'}).eq('id', pid).execute()
        print(f"🔴 {len(projects_to_en_riesgo)} proyectos marcados como en_riesgo")

    # Reactivar proyectos que ya no cumplen criterios de riesgo
    currently_at_risk = [p for p in projects if p['estado'] == 'en_riesgo' and p['id'] not in projects_to_en_riesgo]
    for p in currently_at_risk:
        sb.table('projects').update({'estado': 'activo'}).eq('id', p['id']).execute()
    if currently_at_risk:
        print(f"🟢 {len(currently_at_risk)} proyectos reactivados (ya no en riesgo)")

    print("\n🏁 Detección completa")


if __name__ == '__main__':
    run()
