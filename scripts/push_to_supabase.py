#!/usr/bin/env python3
"""
ORAIA WhatsApp Chat Parser + Supabase Pusher
Parses all .txt chat exports (text-only, skips media/audio/stickers)
and upserts into Supabase: projects + messages tables.
"""

import os
import re
import sys
from datetime import datetime
from supabase import create_client, Client

# ── Config ──────────────────────────────────────────────────────────────────
CHAT_DIR = "/root/.openclaw/workspace/ORAIA/chats/extracted"
SUPABASE_URL = "https://nhsxwgrekdmkxemdoqqx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3h3Z3Jla2Rta3hlbWRvcXF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyODE2NywiZXhwIjoyMDg4NDA0MTY3fQ.5rbxlYG2Z5wY5GoacHbr-rOruvY4nsPu_yHEfEP0kMM"

# ── Team detection ───────────────────────────────────────────────────────────
TEAM_KEYWORDS = [
    "jennifer ora", "javi ora", "ora ia", "hector ora", "hector ramirez- ora",
    "trina gomez", "jorge salamanca", "enzo ora", "kevin ora", "luca fonzo",
    "guillermo"
]

# ── Media / system lines to skip (text-only policy) ─────────────────────────
SKIP_PATTERNS = [
    r'^\s*$',                                           # empty
    r'.*\(archivo adjunto\)\s*$',                       # any file attachment
    r'.*\.(jpg|jpeg|png|gif|mp4|mp3|ogg|opus|aac|wav|webp|pdf|xlsx|docx|zip|rar)\b.*',  # media filenames
    r'.*<(imagen|audio|video|sticker|gif|documento) omitido>.*',  # omitted media (Spanish)
    r'.*<(image|audio|video|sticker|gif|document) omitted>.*',    # omitted media (English)
    r'.*Los mensajes y las llamadas están cifrados.*',  # system encryption notice
    r'.*creó el grupo.*',                               # group created system msg
    r'.*te añadió.*',                                   # added to group
    r'.*añadió a.*',                                    # added member
    r'.*salió.*',                                       # left group
    r'.*cambió el (icono|asunto|descripción).*',        # group changes
    r'.*fijó un mensaje.*',                             # pinned message
    r'.*eliminó este mensaje.*',                        # deleted message
    r'.*Este mensaje fue eliminado.*',                  # deleted message
    r'.*llamada de (voz|video).*',                      # call logs
    r'.*Llamada de (voz|video).*',
    r'.*Missed voice call.*',
    r'.*Missed video call.*',
]
SKIP_RE = [re.compile(p, re.IGNORECASE) for p in SKIP_PATTERNS]

# ── Date parsing ─────────────────────────────────────────────────────────────
MSG_RE = re.compile(
    r'^(\d{1,2}/\d{1,2}/\d{4}),\s+(\d{1,2}:\d{2}(?:[\s\u202f\xa0]*[ap]\.?\s*m\.?)?)\s+-\s+([^:]+):\s+(.+)$',
    re.DOTALL
)

def parse_datetime(date_str: str, time_str: str) -> datetime | None:
    t = time_str.strip()
    t = t.replace('\u202f', ' ').replace('\xa0', ' ')
    t = re.sub(r'\s*a\.\s*?m\.?', ' AM', t, flags=re.IGNORECASE)
    t = re.sub(r'\s*p\.\s*?m\.?', ' PM', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+', ' ', t).strip()
    for fmt in ('%d/%m/%Y %I:%M %p', '%d/%m/%Y %H:%M'):
        try:
            return datetime.strptime(f'{date_str} {t}', fmt)
        except ValueError:
            pass
    return None

# ── Helpers ───────────────────────────────────────────────────────────────────
def is_team(sender: str) -> bool:
    sl = sender.lower()
    return any(kw in sl for kw in TEAM_KEYWORDS)

def should_skip(text: str) -> bool:
    for r in SKIP_RE:
        if r.search(text):
            return True
    return False

def status_from_filename(fn: str) -> str:
    # Schema allows: 'activo', 'pausado', 'completado', 'en_riesgo'
    # 🟡 (en progreso) and 🟣 (poc) map to 'activo'; color is preserved in whatsapp_chat_id
    if '🔴' in fn: return 'en_riesgo'
    if '🟡' in fn: return 'activo'   # in progress → active
    if '🟢' in fn: return 'activo'
    if '🟣' in fn: return 'activo'   # poc → active
    return 'activo'

def emoji_tag(fn: str) -> str:
    if '🔴' in fn: return '🔴'
    if '🟡' in fn: return '🟡'
    if '🟢' in fn: return '🟢'
    if '🟣' in fn: return '🟣'
    return ''

def priority_from_status(s: str) -> str:
    return {'en_riesgo': 'alta', 'activo': 'media'}.get(s, 'media')

def project_name(filename: str) -> str:
    n = filename.replace('Chat de WhatsApp con ', '').replace('.txt', '')
    n = re.sub(r'^[🔴🟡🟢🟣]\s*', '', n).strip()
    n = re.sub(r'^DFY\s*[-–]?\s*', '', n).strip()
    n = re.sub(r'\s*[xX]\s*ORA\s*IA.*$', '', n, flags=re.IGNORECASE).strip()
    n = re.sub(r'\s*[-–]\s*ORA\s*IA.*$', '', n, flags=re.IGNORECASE).strip()
    n = n.replace(' ORA IA', '').strip()
    return n or filename

# ── Parse one file ────────────────────────────────────────────────────────────
def parse_file(filepath: str, filename: str) -> tuple[dict, list[dict]] | None:
    try:
        raw = open(filepath, encoding='utf-8').read()
    except UnicodeDecodeError:
        raw = open(filepath, encoding='latin-1').read()

    messages = []
    current = None
    for line in raw.splitlines():
        m = MSG_RE.match(line)
        if m:
            if current:
                messages.append(current)
            date_s, time_s, sender, body = m.groups()
            current = {
                'dt': parse_datetime(date_s, time_s),
                'sender': sender.strip(),
                'body': body.strip(),
            }
        elif current and line.strip():
            current['body'] += ' ' + line.strip()

    if current:
        messages.append(current)

    # Filter: text-only, valid datetime
    messages = [msg for msg in messages
                if msg['dt'] is not None and not should_skip(msg['body'])]

    if not messages:
        return None

    status = status_from_filename(filename)
    name = project_name(filename)
    chat_id = filename.replace('.txt', '')

    first = min(m['dt'] for m in messages)
    last = max(m['dt'] for m in messages)
    last_msg = sorted(messages, key=lambda x: x['dt'])[-1]

    tag = emoji_tag(filename)
    sorted_msgs = sorted(messages, key=lambda x: x['dt'])
    last_msg_obj = sorted_msgs[-1]
    last_body = last_msg_obj['body'][:300]

    rows = []
    for msg in messages:
        rows.append({
            'fuente': 'whatsapp',
            'sender': msg['sender'],
            'contenido': msg['body'][:2000],
            'timestamp': msg['dt'].isoformat(),
            'es_del_cliente': not is_team(msg['sender']),
            'metadata': {},
        })

    project = {
        'nombre': name,
        'cliente': name,
        'estado': status,
        'prioridad': priority_from_status(status),
        'responsable': None,
        'progreso': 0,
        'whatsapp_chat_id': chat_id,
        'color_emoji': tag,
        'ultimo_mensaje': last_body,
        'ultima_actividad': last_msg_obj['dt'].isoformat(),
        'total_mensajes': len(rows),
    }

    print(f"  ✓ {name[:50]:<50} | {status:<12} | {len(rows):>4} msgs | {first.strftime('%Y-%m-%d')} → {last.strftime('%Y-%m-%d')}")
    return project, rows


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("🔌 Connecting to Supabase...")
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── Wipe existing data (fresh start) ────────────────────────────────────
    print("🗑️  Clearing existing data (fresh start)...")
    sb.table('followups').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    sb.table('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    sb.table('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("  ✓ Cleared.\n")

    txt_files = sorted([f for f in os.listdir(CHAT_DIR) if f.endswith('.txt')])
    print(f"📂 Found {len(txt_files)} .txt files to process...\n")

    total_projects = 0
    total_messages = 0

    for fname in txt_files:
        fpath = os.path.join(CHAT_DIR, fname)
        result = parse_file(fpath, fname)
        if not result:
            print(f"  ✗ {fname[:60]} — could not parse or no text messages")
            continue

        project_data, msg_rows = result

        # Insert project
        proj_res = sb.table('projects').insert(project_data).execute()
        if not proj_res.data:
            print(f"    ⚠ Failed to insert project: {project_data['nombre']}")
            continue

        project_id = proj_res.data[0]['id']

        # Attach project_id to messages and bulk-insert in chunks of 500
        for i in range(0, len(msg_rows), 500):
            chunk = msg_rows[i:i+500]
            for row in chunk:
                row['project_id'] = project_id
            sb.table('messages').insert(chunk).execute()

        total_projects += 1
        total_messages += len(msg_rows)

    print(f"\n✅ Done! Inserted {total_projects} projects and {total_messages} messages into Supabase.")


if __name__ == '__main__':
    main()
