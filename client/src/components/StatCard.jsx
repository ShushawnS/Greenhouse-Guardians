import { C } from '../tokens'

export default function StatCard({ title, value, subtitle, breakdown }) {
  // Total for percentage calculation
  const total = breakdown ? breakdown.reduce((s, b) => s + (b.count || 0), 0) : 0

  return (
    <div style={{
      background: C.bg1,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Title */}
      <div style={{ fontSize: 11, fontWeight: 500, color: C.t2, letterSpacing: '0.02em' }}>
        {title}
      </div>

      {/* Value */}
      <div>
        <div style={{ fontSize: 26, fontWeight: 600, color: C.t1, letterSpacing: '-0.5px', lineHeight: 1 }} className="num">
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{subtitle}</div>
        )}
      </div>

      {/* Breakdown */}
      {breakdown && (
        <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Stacked composition bar */}
          {total > 0 && (
            <div style={{
              display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden',
              gap: 1.5, marginBottom: 12,
            }}>
              {breakdown.map(({ label, count, color }) => (
                <div
                  key={label}
                  style={{
                    height: '100%',
                    width: `${(count / total) * 100}%`,
                    background: color,
                    minWidth: count > 0 ? 3 : 0,
                    transition: 'width 0.4s ease',
                  }}
                />
              ))}
            </div>
          )}

          {/* Rows: dot · label · pct · count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {breakdown.map(({ label, count, color }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.t2 }}>{label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 10, color: C.t3 }} className="num">{pct}%</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.t1, minWidth: 24, textAlign: 'right' }} className="num">{count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
