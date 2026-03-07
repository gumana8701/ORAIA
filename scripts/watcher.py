#!/usr/bin/env python3
"""
ORAIA WhatsApp Chat Watcher
Watches chats/extracted/ for new or updated .txt files.
Incrementally pushes only NEW messages to Supabase, re-runs alert detection,
and updates project stats (ultimo_mensaje, ultima_actividad, total_mensajes, alertas_count).
"""

import os
import re
import time
import logging
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from supabase import create_client, Client

# ── Config ───────────────────────────────────────────────────────────────────
CHAT_DIR   = "/root/.openclaw/workspace/ORAIA/chats/extracted"
SUPABASE_URL = "https://nhsxwgrekdmkxemdoqqx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3h3Z3Jla2Rta3hlbWRvcXF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyODE2NywiZXhwIjoyMDg4NDA0MTY3fQ.5rbxlYG2Z5wY5GoacHbr-rOruvY4nsPu_yHEfEP0kMM"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("oraia-watcher")

# ── Team detection ────────────────────────────────────────────────────────────
TEAM_KEYWORDS = [
    "jennifer ora", "jennifer",
    "javi ora", "javier",
    "ora ia", "oraia",
    "hector ora", "hector ramirez", "héctor ramirez", "héctor",
    "trina gomez", "trina gómez",
    "jorge salamanca", "jorge",
    "enzo ora", "enzo",
    "kevin ora", "kevin",
    "luca fonzo", "lucas fonzo", "lucas", "luca",
    "victor ramires", "victor",
    "guillermo",
]

# ── Skip patterns (media/system lines) ───────────────────────────────────────
SKIP_PATTERNS = [
    r'^\s*$',
    r'.*\(archivo adjunto\)\s*$',
    r'.*\.(jpg|jpeg|png|gif|mp4|mp3|ogg|opus|aac|wav|webp|pdf|xlsx|docx|zip|rar)\b.*',
    r'.*<(imagen|audio|video|sticker|gif|documento) omitido>.*',
    r'.*<(image|audio|video|sticker|gif|document) omitted>.*',
    r'.*Los mensajes y las llamadas están cifrados.*',
    r'.*creó el grupo.*',
    r'.*te añadió.*',
    r'.*añadió a.*',
    r'.*salió.*',
    r'.*cambió el (icono|asunto|descripción).*',
    r'.*fijó un mensaje.*',
    r'.*eliminó este mensaje.*',
    r'.*Este mensaje fue eliminado.*',
    r'.*llamada de (voz|video).*',
    r'.*Llamada de (voz|video).*',
    r'.*Missed (voice|video) call.*',
]
SKIP_RE = [re.compile(p, re.IGNORECASE) for p in SKIP_PATTERNS]

MSG_RE = re.compile(
    r'^(\d{1,2}/\d{1,2}/\d{4}),\s+(\d{1,2}:\d{2}(?:[\s\u202f\xa0]*[ap]\.?\s*m\.?)?)\s+-\s+([^:]+):\s+(.+)$',
    re.DOTALL
)

# ── Alert rules v2 (alineadas con la operación real de ORAIA) ────────────────
import re as _re

_ALERT_PATTERNS = [
    (_re.compile(r'\b(cancel(ar|ación|acion)|me\s+voy\s+(a\s+)?ir|no\s+quiero\s+continuar|terminar\s+(el\s+)?(contrato|servicio)|darme\s+de\s+baja|ya\s+no\s+quiero)\b', _re.I|_re.U),
     "cancelacion","critico","Cliente expresa intención de cancelar el servicio"),
    (_re.compile(r'\b(reembols(o|ar)|devoluc(ión|ion)|devolver\s+(el\s+)?dinero|regresar?\s+(el\s+)?dinero|quiero\s+(mi\s+)?dinero\s+(de\s+)?vuelta)\b', _re.I|_re.U),
     "reembolso","alto","Cliente solicita reembolso → redirigir a Jennifer"),
    (_re.compile(r'\b(no\s+(he\s+)?(podido\s+)?pag(ar|o)|problem(a|as)\s+(con\s+)?(el\s+)?pago|factur(a|ación|acion)|cobr(o|aron)\s+(de\s+)?más|cargo\s+indebido)\b', _re.I|_re.U),
     "pago","medio","Tema de pago o facturación → redirigir a Jennifer"),
    (_re.compile(r'\b(esto\s+(no\s+)?funciona|no\s+sirve|qué\s+mal|pesim(o|a)|horrible|inaceptable|harto|muy\s+molest(o|a)|frustrad(o|a)|decepcionad(o|a)|esto\s+es\s+una\s+basura|pésimo\s+servicio|mal\s+servicio)\b', _re.I|_re.U),
     "enojo","alto","Cliente expresa frustración o enojo con el servicio"),
    (_re.compile(r'\b(no\s+me\s+gusta|no\s+estoy\s+conforme|no\s+cumplieron|esto\s+no\s+era\s+lo\s+que|no\s+es\s+lo\s+que\s+acordamos)\b', _re.I|_re.U),
     "enojo","medio","Cliente insatisfecho con el resultado entregado"),
    (_re.compile(r'\b(agente\s+(no\s+)?(está\s+)?(contestando|funciona|responde|anda)|bot\s+(caído|roto|no\s+funciona)|sistema\s+(caído|abajo)|gohighlevel\s+no|ghl\s+(caído|roto|no)|webhook\s+roto|api\s+(caída|no\s+responde)|pérdida\s+de\s+datos)\b', _re.I|_re.U),
     "urgente","critico","Falla técnica crítica — agente/sistema caído"),
    (_re.compile(r'\b(error\s+en\s+el\s+agente|bug\s+(crítico|grave)|no\s+(está\s+)?funcionando|sigue\s+sin\s+funcionar|todavía\s+(no\s+)?funciona)\b', _re.I|_re.U),
     "urgente","alto","Error técnico significativo reportado"),
    (_re.compile(r'\b(cuándo\s+(estará|entregan|queda|van)|para\s+cuándo|cuánto\s+(tiempo|falta|más|tardan)|tardando\s+mucho|más\s+de\s+(una\s+)?(semana|2\s+semanas)|atraso|demoran)\b', _re.I|_re.U),
     "entrega","medio","Cliente pregunta o se queja sobre tiempos de entrega"),
    (_re.compile(r'\b(necesito\s+(esto\s+)?(para\s+)?(hoy|mañana|ya|urgente|lo\s+antes\s+posible)|lo\s+necesito\s+ya|es\s+urgente|para\s+ayer)\b', _re.I|_re.U),
     "entrega","alto","Cliente expresa urgencia en la entrega"),
    (_re.compile(r'\b(soporte\s+de\s+twilio|twilio\s+(no|caído)|renovar\s+(el\s+)?contrato|renovación|upgrade|cambiar\s+(de\s+)?plan|descuento)\b', _re.I|_re.U),
     "otro","bajo","Tema fuera de alcance → redirigir a Jennifer"),
]

_NIVEL_ORDER = {'bajo':0,'medio':1,'alto':2,'critico':3}

def detect_alerts_for_message(msg_id, project_id, text):
    hits = {}
    for pattern, tipo, nivel, desc in _ALERT_PATTERNS:
        if pattern.search(text):
            if tipo not in hits or _NIVEL_ORDER[nivel] > _NIVEL_ORDER[hits[tipo]['nivel']]:
                hits[tipo] = {
                    'project_id': project_id, 'message_id': msg_id,
                    'tipo': tipo, 'nivel': nivel,
                    'descripcion': f'{desc} — "{text[:120]}"',
                    'resuelta': False,
                }
    return list(hits.values())

def parse_datetime(date_str, time_str):
    t = time_str.strip().replace('\u202f',' ').replace('\xa0',' ')
    t = re.sub(r'\s*a\.\s*?m\.?',' AM', t, flags=re.IGNORECASE)
    t = re.sub(r'\s*p\.\s*?m\.?',' PM', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+',' ', t).strip()
    for fmt in ('%d/%m/%Y %I:%M %p','%d/%m/%Y %H:%M'):
        try: return datetime.strptime(f'{date_str} {t}', fmt)
        except: pass
    return None

def should_skip(text):
    return any(r.search(text) for r in SKIP_RE)

def is_team(sender):
    sl = sender.lower()
    return any(kw in sl for kw in TEAM_KEYWORDS)

def emoji_tag(fn):
    for e in ['🔴','🟡','🟢','🟣']:
        if e in fn: return e
    return ''

def status_from_filename(fn):
    if '🔴' in fn: return 'en_riesgo'
    return 'activo'

def project_name(filename):
    n = filename.replace('Chat de WhatsApp con ','').replace('.txt','')
    n = re.sub(r'^[🔴🟡🟢🟣]\s*','',n).strip()
    n = re.sub(r'^DFY\s*[-–]?\s*','',n).strip()
    n = re.sub(r'\s*[xX]\s*ORA\s*IA.*$','',n,flags=re.IGNORECASE).strip()
    n = re.sub(r'\s*[-–]\s*ORA\s*IA.*$','',n,flags=re.IGNORECASE).strip()
    return n.replace(' ORA IA','').strip() or filename

def parse_file_messages(filepath):
    try:    raw = open(filepath, encoding='utf-8').read()
    except: raw = open(filepath, encoding='latin-1').read()

    messages, current = [], None
    for line in raw.splitlines():
        m = MSG_RE.match(line)
        if m:
            if current: messages.append(current)
            ds, ts, sender, body = m.groups()
            current = {'dt': parse_datetime(ds, ts), 'sender': sender.strip(), 'body': body.strip()}
        elif current and line.strip():
            current['body'] += ' ' + line.strip()
    if current: messages.append(current)

    return [msg for msg in messages if msg['dt'] and not should_skip(msg['body'])]

# detect_alerts_for_message defined above with _ALERT_PATTERNS


# ── Core sync function ────────────────────────────────────────────────────────
def sync_file(sb: Client, filepath: str, filename: str):
    log.info(f"Syncing: {filename}")
    messages = parse_file_messages(filepath)
    if not messages:
        log.info("  No parseable messages.")
        return

    chat_id = filename.replace('.txt','')

    # Find existing project
    res = sb.table('projects').select('id, total_mensajes').eq('whatsapp_chat_id', chat_id).execute()

    if res.data:
        project_id = res.data[0]['id']

        # Get latest message timestamp for this project
        latest_res = sb.table('messages').select('timestamp') \
            .eq('project_id', project_id) \
            .order('timestamp', desc=True).limit(1).execute()

        if latest_res.data:
            latest_ts = datetime.fromisoformat(
                latest_res.data[0]['timestamp'].replace('Z', '+00:00')
            ).replace(tzinfo=None)   # strip tz → naive for comparison
            new_msgs = [m for m in messages if m['dt'] > latest_ts]
        else:
            new_msgs = messages

        log.info(f"  Found project {project_id[:8]}... — {len(new_msgs)} new messages")

    else:
        # New project — create it
        name = project_name(filename)
        proj_data = {
            'nombre': name, 'cliente': name,
            'estado': status_from_filename(filename),
            'prioridad': 'alta' if '🔴' in filename else 'media',
            'responsable': None, 'progreso': 0,
            'whatsapp_chat_id': chat_id,
            'color_emoji': emoji_tag(filename),
        }
        proj_res = sb.table('projects').insert(proj_data).execute()
        project_id = proj_res.data[0]['id']
        new_msgs = messages
        log.info(f"  Created new project {project_id[:8]}... — {len(new_msgs)} messages")

    if not new_msgs:
        log.info("  Already up to date.")
        return

    # Insert new messages in chunks
    inserted_ids = []
    rows = [{
        'project_id': project_id,
        'fuente': 'whatsapp',
        'sender': m['sender'],
        'contenido': m['body'][:2000],
        'timestamp': m['dt'].isoformat(),
        'es_del_cliente': not is_team(m['sender']),
        'metadata': {},
    } for m in new_msgs]

    for i in range(0, len(rows), 500):
        chunk = rows[i:i+500]
        ins = sb.table('messages').insert(chunk).execute()
        inserted_ids.extend([r['id'] for r in (ins.data or [])])

    log.info(f"  ✓ Inserted {len(inserted_ids)} messages")

    # Run alert detection on new messages only
    new_alerts = []
    msg_data = sb.table('messages').select('id, contenido') \
        .in_('id', inserted_ids).eq('es_del_cliente', True).execute()
    for msg in (msg_data.data or []):
        new_alerts.extend(detect_alerts_for_message(msg['id'], project_id, msg['contenido']))

    if new_alerts:
        for i in range(0, len(new_alerts), 500):
            sb.table('alerts').insert(new_alerts[i:i+500]).execute()
        log.info(f"  ✓ Detected {len(new_alerts)} new alerts")

    # Update project stats
    sorted_msgs = sorted(messages, key=lambda x: x['dt'])
    last = sorted_msgs[-1]
    total_alerts_res = sb.table('alerts').select('id', count='exact') \
        .eq('project_id', project_id).eq('resuelta', False).execute()

    sb.table('projects').update({
        'ultimo_mensaje':   last['body'][:300],
        'ultima_actividad': last['dt'].isoformat(),
        'total_mensajes':   len(messages),
        'alertas_count':    total_alerts_res.count or 0,
    }).eq('id', project_id).execute()

    log.info(f"  ✓ Project stats updated")


# ── Watchdog handler ──────────────────────────────────────────────────────────
class ChatHandler(FileSystemEventHandler):
    def __init__(self, sb):
        self.sb = sb
        self._cooldown = {}   # debounce: filepath → last processed time

    def _should_process(self, path):
        now = time.time()
        last = self._cooldown.get(path, 0)
        if now - last < 3:   # 3s debounce
            return False
        self._cooldown[path] = now
        return True

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.txt'):
            if self._should_process(event.src_path):
                fname = os.path.basename(event.src_path)
                try:
                    sync_file(self.sb, event.src_path, fname)
                except Exception as e:
                    log.error(f"Error syncing {fname}: {e}")

    def on_created(self, event):
        self.on_modified(event)  # treat new file same as modified


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    log.info("🔌 Connecting to Supabase...")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    log.info(f"👁  Watching: {CHAT_DIR}")
    handler  = ChatHandler(sb)
    observer = Observer()
    observer.schedule(handler, CHAT_DIR, recursive=False)
    observer.start()
    log.info("✅ Watcher running. Drop or update any .txt file to sync.\n")

    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        log.info("Stopping watcher...")
        observer.stop()
    observer.join()


if __name__ == '__main__':
    main()
