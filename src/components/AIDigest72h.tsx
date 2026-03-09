// AIDigest72h.tsx — Server Component
// Renders an AI-style digest of the last 72 hours.
// Returns null if no messages/alerts were found in that window.

import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// El Salvador = UTC-6
function toSV(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - 6 * 60 * 60 * 1000)
}

function relativeLabel(iso: string): string {
  const nowSV  = new Date(Date.now() - 6 * 60 * 60 * 1000)
  const thenSV = toSV(iso)
  const diffH  = (nowSV.getTime() - thenSV.getTime()) / 3600000
  if (diffH < 1)  return 'hace menos de 1 hora'
  if (diffH < 24) return `hace ~${Math.round(diffH)}h`
  return `hace ~${Math.round(diffH / 24)}d`
}

// ─── Build a human-readable digest without an LLM ────────────────────────────
function buildDigest(data: {
  proyectosActivos: { nombre: string; msgs: number; ultimoMsg: string; ultimoTimestamp: string; enRiesgo: boolean }[]
  alertasNuevas: { tipo: string; nivel: string; descripcion: string; proyecto: string }[]
  totalMsgs: number
  ventanaHoras: number
}): string {
  const { proyectosActivos, alertasNuevas, totalMsgs } = data

  const lines: string[] = []

  // Opening line
  if (totalMsgs === 0 && alertasNuevas.length === 0) return ''

  lines.push(
    `En las últimas 72 horas hubo **${totalMsgs} mensaje${totalMsgs !== 1 ? 's'  : ''}** en **${proyectosActivos.length} proyecto${proyectosActivos.length !== 1 ? 's' : ''}**.`
  )

  // Per-project bullets — top 5 by message count
  if (proyectosActivos.length > 0) {
    lines.push('')
    for (const p of proyectosActivos.slice(0, 5)) {
      const badge = p.enRiesgo ? ' 🔴' : ''
      const when  = relativeLabel(p.ultimoTimestamp)
      const snip  = p.ultimoMsg
        ? `— último mensaje: "${p.ultimoMsg.slice(0, 70)}${p.ultimoMsg.length > 70 ? '…' : ''}"`
        : ''
      lines.push(`• **${p.nombre}**${badge} · ${p.msgs} msg${p.msgs !== 1 ? 's' : ''} · ${when} ${snip}`)
    }
    if (proyectosActivos.length > 5) {
      lines.push(`• ...y ${proyectosActivos.length - 5} proyecto${proyectosActivos.length - 5 > 1 ? 's' : ''} más`)
    }
  }

  // Alerts block
  if (alertasNuevas.length > 0) {
    lines.push('')
    const criticas = alertasNuevas.filter(a => a.nivel === 'critico' || a.nivel === 'alto')
    if (criticas.length > 0) {
      lines.push(`⚠️ **${criticas.length} alerta${criticas.length > 1 ? 's' : ''} de nivel alto/crítico** sin resolver:`)
      for (const a of criticas.slice(0, 3)) {
        lines.push(`  · [${a.proyecto}] ${a.descripcion.slice(0, 80)}${a.descripcion.length > 80 ? '…' : ''}`)
      }
    } else {
      lines.push(`${alertasNuevas.length} alerta${alertasNuevas.length > 1 ? 's' : ''} abiertas (nivel bajo/medio).`)
    }
  }

  return lines.join('\n')
}

// ─── Component ───────────────────────────────────────────────────────────────
export default async function AIDigest72h() {
  const client = sb()
  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  // Parallel fetch: messages + alerts in last 72h
  const [msgRes, alertRes, projRes] = await Promise.all([
    client
      .from('messages')
      .select('project_id, contenido, timestamp')
      .gte('timestamp', since72h)
      .order('timestamp', { ascending: false }),
    client
      .from('alerts')
      .select('tipo, nivel, descripcion, project_id, created_at')
      .eq('resuelta', false)
      .gte('created_at', since72h),
    client
      .from('projects')
      .select('id, nombre, estado'),
  ])

  const messages  = msgRes.data   ?? []
  const alerts    = alertRes.data ?? []
  const projects  = projRes.data  ?? []

  // Return nothing if no activity
  if (messages.length === 0 && alerts.length === 0) return null

  const projMap: Record<string, { nombre: string; estado: string }> = {}
  for (const p of projects) projMap[p.id] = { nombre: p.nombre, estado: p.estado }

  // Group messages by project
  const byProject: Record<string, { msgs: number; ultimoMsg: string; ultimoTimestamp: string }> = {}
  for (const m of messages) {
    if (!byProject[m.project_id]) {
      byProject[m.project_id] = { msgs: 0, ultimoMsg: m.contenido ?? '', ultimoTimestamp: m.timestamp }
    }
    byProject[m.project_id].msgs++
    if (m.timestamp > byProject[m.project_id].ultimoTimestamp) {
      byProject[m.project_id].ultimoMsg       = m.contenido ?? ''
      byProject[m.project_id].ultimoTimestamp = m.timestamp
    }
  }

  const proyectosActivos = Object.entries(byProject)
    .map(([pid, d]) => ({
      nombre: projMap[pid]?.nombre ?? pid,
      enRiesgo: projMap[pid]?.estado === 'en_riesgo',
      ...d,
    }))
    .sort((a, b) => b.msgs - a.msgs)

  const alertasNuevas = alerts.map(a => ({
    tipo:        a.tipo,
    nivel:       a.nivel,
    descripcion: a.descripcion ?? '',
    proyecto:    projMap[a.project_id]?.nombre ?? '—',
  }))

  const digestText = buildDigest({
    proyectosActivos,
    alertasNuevas,
    totalMsgs: messages.length,
    ventanaHoras: 72,
  })

  if (!digestText) return null

  // Split into lines and render markdown-ish bold
  const renderLine = (line: string, i: number) => {
    // Replace **text** with <strong>
    const parts = line.split(/\*\*(.+?)\*\*/g)
    const nodes = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)

    const isBullet = line.startsWith('•') || line.startsWith('  ·')
    const isEmpty  = line === ''

    if (isEmpty) return <div key={i} style={{ height: '6px' }} />
    if (isBullet) return (
      <div key={i} style={{
        fontSize: '12px', color: '#94a3b8', lineHeight: 1.6,
        paddingLeft: isBullet && line.startsWith('  ·') ? '20px' : '4px',
      }}>
        {nodes}
      </div>
    )
    return (
      <div key={i} style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6 }}>
        {nodes}
      </div>
    )
  }

  const lines = digestText.split('\n')

  return (
    <div style={{
      position: 'relative', zIndex: 1,
      marginBottom: '20px',
      background: 'linear-gradient(135deg, rgba(232,121,47,0.04) 0%, rgba(17,24,39,0.6) 60%)',
      border: '1px solid rgba(232,121,47,0.14)',
      borderRadius: '12px',
      padding: '16px 18px',
      backdropFilter: 'blur(8px)',
      overflow: 'hidden',
    }}>
      {/* Glow accent top-left */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '180px', height: '60px',
        background: 'radial-gradient(ellipse, rgba(232,121,47,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '12px',
      }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: 'linear-gradient(135deg, #E8792F 0%, #c45c1a 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', flexShrink: 0,
        }}>
          🤖
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: '#E8792F',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Resumen IA · Últimas 72h
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: '10px', color: '#334155', fontWeight: 500,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '4px', padding: '2px 7px',
        }}>
          auto
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(232,121,47,0.10)', marginBottom: '12px' }} />

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {lines.map((line, i) => renderLine(line, i))}
      </div>
    </div>
  )
}
