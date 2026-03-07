'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

interface Props {
  data: { hour: string; mensajes: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px' }}>
        <p style={{ color: '#A0AEC0', fontSize: '12px', margin: '0 0 4px' }}>{label}</p>
        <p style={{ color: '#E8792F', fontWeight: 600, fontSize: '13px', margin: 0 }}>{payload[0].value} mensajes</p>
      </div>
    )
  }
  return null
}

export default function HourlyLineChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#E8792F" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#E8792F" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="hour" tick={{ fill: '#A0AEC0', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#A0AEC0', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="mensajes"
          stroke="#E8792F"
          strokeWidth={2}
          fill="url(#msgGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#E8792F' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
