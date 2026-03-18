import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { C } from '../tokens'
import { ChartTooltip } from './ChartCard'

/**
 * Reusable donut chart with a centre total label and a right-hand legend.
 * data: [{ name, count, fill }]
 */
export default function DonutChart({ data, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {/* Donut */}
      <div style={{ position: 'relative', flexShrink: 0, width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={52} outerRadius={74}
              paddingAngle={3}
              dataKey="count"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} wrapperStyle={{ zIndex: 100 }} />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.5px', lineHeight: 1 }} className="num">
            {total.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>total</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {data.map(({ name, count, fill }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: fill, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.t2 }}>{name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }} className="num">{count.toLocaleString()}</span>
                  <span style={{ fontSize: 10, color: C.t3 }} className="num">{pct}%</span>
                </div>
              </div>
              <div style={{ height: 4, background: C.bg3, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: fill, borderRadius: 2,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
