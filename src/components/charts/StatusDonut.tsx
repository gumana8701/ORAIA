'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props {
  data: { name: string; value: number; color: string }[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px' }}>
        <p style={{ color: payload[0].payload.color, fontWeight: 600, fontSize: '13px', margin: 0 }}>
          {payload[0].name}: {payload[0].value}
        </p>
      </div>
    )
  }
  return null
}

export default function StatusDonut({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span style={{ color: '#A0AEC0', fontSize: '12px' }}>{value}</span>}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
