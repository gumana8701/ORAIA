#!/usr/bin/env python3
"""
ORAIA WhatsApp Chat Parser
Parses all WhatsApp chat exports and extracts KPIs for Supabase
"""

import os
import re
import json
from datetime import datetime, timedelta

CHAT_DIR = "/root/.openclaw/workspace/ORAIA/chats/extracted"
OUTPUT_FILE = "/root/.openclaw/workspace/ORAIA/scripts/parsed_projects.json"

# Team members (ORA IA side)
TEAM_KEYWORDS = ["Jennifer Ora Ia", "Javi Ora", "ORA IA", "Hector ORA", "Trina Gomez ORA"]

# Red alert keywords in Spanish
RED_ALERT_KEYWORDS = [
    "cancelar", "cancelación", "cancelo", "me voy", "no quiero continuar",
    "decepcionado", "decepcionada", "decepción", "molesto", "molesta",
    "no funciona", "no sirve", "terrible", "pésimo", "pésima",
    "no volvere", "no volvería", "muy mal", "mal servicio",
    "quiero salir", "quiero retirarme", "no me interesa",
    "estoy insatisfecho", "insatisfecha", "frustrado", "frustrada",
    "devolver", "reembolso", "reembolsar"
]

# Color status from filename
def get_status_from_filename(filename):
    if "🔴" in filename:
        return "en_riesgo"
    elif "🟡" in filename:
        return "en_progreso"
    elif "🟢" in filename:
        return "activo"
    elif "🟣" in filename:
        return "poc"
    else:
        return "activo"

def get_priority_from_status(status):
    return {"en_riesgo": "alta", "en_progreso": "media", "activo": "baja", "poc": "media"}.get(status, "media")

def parse_line(line):
    """Parse a WhatsApp message line"""
    # Format: DD/MM/YYYY, HH:MM a./p. m. - Sender: Message
    pattern = r'^(\d{1,2}/\d{1,2}/\d{4}),\s+(\d{1,2}:\d{2}(?:\s*[ap]\.\s*m\.)?)\s+-\s+([^:]+):\s+(.+)$'
    match = re.match(pattern, line.strip())
    if match:
        date_str, time_str, sender, message = match.groups()
        try:
            time_clean = time_str.strip().replace('\u202f', ' ').replace('\xa0', ' ')
            time_clean = re.sub(r'\s*a\.\s*m\.', ' AM', time_clean)
            time_clean = re.sub(r'\s*p\.\s*m\.', ' PM', time_clean)
            dt = datetime.strptime(f"{date_str} {time_clean}", "%d/%m/%Y %I:%M %p")
        except:
            try:
                dt = datetime.strptime(f"{date_str} {time_str[:5]}", "%d/%m/%Y %H:%M")
            except:
                dt = None
        return {"datetime": dt, "sender": sender.strip(), "message": message.strip()}
    return None

def is_team(sender):
    for kw in TEAM_KEYWORDS:
        if kw.lower() in sender.lower():
            return True
    return False

def has_red_alert(message):
    msg_lower = message.lower()
    for kw in RED_ALERT_KEYWORDS:
        if kw in msg_lower:
            return True
    return False

def parse_chat_file(filepath, filename):
    messages = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except:
        with open(filepath, 'r', encoding='latin-1') as f:
            lines = f.readlines()

    current_msg = None
    for line in lines:
        parsed = parse_line(line)
        if parsed:
            if current_msg:
                messages.append(current_msg)
            current_msg = parsed
        elif current_msg and line.strip():
            current_msg["message"] += " " + line.strip()

    if current_msg:
        messages.append(current_msg)

    if not messages:
        return None

    # Extract project name from filename
    name = filename.replace("Chat de WhatsApp con ", "").replace(".txt", "")
    name = re.sub(r'^[🔴🟡🟢🟣]\s*', '', name).strip()
    name = re.sub(r'^DFY\s*[-–]?\s*', '', name).strip()
    name = re.sub(r'\s*x\s*ORA\s*IA.*$', '', name, flags=re.IGNORECASE).strip()
    name = re.sub(r'\s*X\s*ORA\s*IA.*$', '', name).strip()
    name = name.replace(" ORA IA", "").replace(" - ORA IA", "").strip()

    # Status from emoji
    status = get_status_from_filename(filename)

    # First and last message dates
    valid_msgs = [m for m in messages if m["datetime"]]
    if not valid_msgs:
        return None

    first_date = min(m["datetime"] for m in valid_msgs)
    last_date = max(m["datetime"] for m in valid_msgs)

    # Get senders (all unique non-team senders = client names)
    senders = set(m["sender"] for m in messages)
    client_senders = [s for s in senders if not is_team(s) and not s.startswith("+") or len(s) > 15]
    team_senders = [s for s in senders if is_team(s)]

    # Red alerts
    alerts = []
    for m in messages:
        if not is_team(m["sender"]) and has_red_alert(m["message"]):
            alerts.append({
                "sender": m["sender"],
                "message": m["message"][:200],
                "datetime": m["datetime"].isoformat() if m["datetime"] else None
            })

    # Calculate avg response time (team response to client message)
    response_times = []
    sorted_msgs = [m for m in valid_msgs]
    sorted_msgs.sort(key=lambda x: x["datetime"])

    for i in range(len(sorted_msgs) - 1):
        curr = sorted_msgs[i]
        next_msg = sorted_msgs[i + 1]
        if not is_team(curr["sender"]) and is_team(next_msg["sender"]):
            diff = (next_msg["datetime"] - curr["datetime"]).total_seconds()
            if 0 < diff < 86400:  # Max 24h
                response_times.append(diff)

    avg_response_seconds = sum(response_times) / len(response_times) if response_times else None
    if avg_response_seconds:
        hrs = int(avg_response_seconds // 3600)
        mins = int((avg_response_seconds % 3600) // 60)
        avg_response_str = f"{hrs:02d}:{mins:02d}"
    else:
        avg_response_str = None

    # Total messages
    total_messages = len(messages)
    client_messages = len([m for m in messages if not is_team(m["sender"])])
    team_messages = len([m for m in messages if is_team(m["sender"])])

    # Last message
    last_msg = sorted_msgs[-1]

    return {
        "nombre": name,
        "filename": filename,
        "estado": status,
        "prioridad": get_priority_from_status(status),
        "fecha_inicio": first_date.isoformat(),
        "ultima_actividad": last_date.isoformat(),
        "ultimo_mensaje": last_msg["message"][:300],
        "ultimo_remitente": last_msg["sender"],
        "total_mensajes": total_messages,
        "mensajes_cliente": client_messages,
        "mensajes_equipo": team_messages,
        "tiempo_respuesta_promedio": avg_response_str,
        "alertas_rojas": alerts,
        "tiene_alerta": len(alerts) > 0,
        "participantes_cliente": list(senders - set(team_senders)),
        "participantes_equipo": team_senders,
    }

# Process all chat files
results = []
chat_files = [f for f in os.listdir(CHAT_DIR) if f.startswith("Chat de WhatsApp") and f.endswith(".txt")]
print(f"Found {len(chat_files)} chat files to process...")

for fname in sorted(chat_files):
    fpath = os.path.join(CHAT_DIR, fname)
    print(f"Processing: {fname[:60]}...")
    result = parse_chat_file(fpath, fname)
    if result:
        results.append(result)
        print(f"  ✓ {result['nombre']} | {result['estado']} | {result['total_mensajes']} msgs | respuesta: {result['tiempo_respuesta_promedio']} | alertas: {len(result['alertas_rojas'])}")
    else:
        print(f"  ✗ Could not parse")

# Save results
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2, default=str)

print(f"\n✅ Done! Parsed {len(results)} projects → {OUTPUT_FILE}")
