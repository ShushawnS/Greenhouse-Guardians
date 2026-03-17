import { C } from '../tokens'

/* Clean tooltip — borrowed from profound-dashboard's style */
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.bg1,
      border: `1px solid ${C.border2}`,
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 4px 16px rgba(28,25,23,0.10)',
    }}>
      {label && (
        <p style={{ color: C.t2, marginBottom: 6, fontWeight: 500 }}>{label}</p>
      )}
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.fill || p.color, flexShrink: 0 }} />
          <span style={{ color: C.t2 }}>{p.name || p.dataKey}</span>
          <span style={{ color: C.t1, fontWeight: 500, marginLeft: 'auto', paddingLeft: 12 }} className="num">
            {p.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ChartCard({ title, subtitle, value, children }) {
  return (
    <div style={{
      background: C.bg1,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '20px 22px',
    }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>{subtitle}</div>
          )}
        </div>
        {value !== undefined && (
          <div style={{ fontSize: 26, fontWeight: 600, color: C.t1, letterSpacing: '-0.5px', lineHeight: 1 }} className="num">
            {value}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
