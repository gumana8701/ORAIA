'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

const RANGES = [
  { value: '1d',  label: 'Hoy',       icon: '☀️' },
  { value: '7d',  label: '7 días',    icon: '📅' },
  { value: '14d', label: '14 días',   icon: '📆' },
  { value: '30d', label: '30 días',   icon: '🗓️' },
  { value: '90d', label: '3 meses',   icon: '📊' },
]

export default function InsightDateFilter() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const range    = params.get('range') ?? '7d'

  const setRange = useCallback((val: string) => {
    const sp = new URLSearchParams(params.toString())
    sp.set('range', val)
    router.replace(`${pathname}?${sp.toString()}`)
  }, [params, pathname, router])

  return (
    <div style={{
      display: 'inline-flex', gap: '4px', alignItems: 'center',
      background: 'rgba(17,24,39,0.8)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px', padding: '4px',
    }}>
      {RANGES.map(r => {
        const active = range === r.value
        return (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 13px', borderRadius: '7px',
              fontSize: '12px', fontWeight: active ? 700 : 400,
              cursor: 'pointer', border: 'none',
              background: active
                ? 'linear-gradient(135deg, rgba(232,121,47,0.25), rgba(232,121,47,0.12))'
                : 'transparent',
              color: active ? '#E8792F' : '#475569',
              boxShadow: active ? '0 0 10px rgba(232,121,47,0.15)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <span>{r.icon}</span>
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
