import { C } from '../tokens'

export default function StatCard({ title, value, subtitle, breakdown, icon, imgSrc, badge }) {
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
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.t2, letterSpacing: '0.02em' }}>
          {title}
        </div>
        {badge && (
          <div style={{
            fontSize: 10, fontWeight: 600, color: badge.color ?? C.green,
            background: badge.bg ?? C.greenDim,
            borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap',
          }}>
            {badge.label}
          </div>
        )}
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
        <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          {(imgSrc || icon) ? (
            /* Image / icon left layout — mirrors the donut + legend layout */
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                flexShrink: 0, width: 140, height: 140,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {imgSrc
                  ? <img src={imgSrc} alt="" style={{ width: 130, height: 130, objectFit: 'contain' }} />
                  : <span style={{ fontSize: 88, lineHeight: 1 }}>{icon}</span>
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1, minWidth: 0 }}>
                {breakdown.map(({ label, count, color }) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: C.t2 }}>{label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }} className="num">{count} kg</span>
                          <span style={{ fontSize: 10, color: C.t3 }} className="num">{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: C.bg3, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: color, borderRadius: 2,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Default stacked layout */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
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
      )}
    </div>
  )
}
