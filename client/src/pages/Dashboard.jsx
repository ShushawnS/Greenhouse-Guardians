import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { getSummaryResults } from '../api'
import StatCard from '../components/StatCard'
import ChartCard, { ChartTooltip } from '../components/ChartCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { C, TOMATO_COLORS, FLOWER_COLORS, FLOWER_LABELS } from '../tokens'

/* ── Donut chart with a centre label and a right-hand legend ── */
function DonutChart({ data, total }) {
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
              {/* Progress bar */}
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

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSummaryResults()
      .then(res => setData(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
      <LoadingSpinner message="Loading greenhouse data…" />
    </div>
  )

  if (error) return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 10, padding: '16px 20px' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.red }}>Failed to load data</p>
        <p style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>{error}</p>
      </div>
    </div>
  )

  if (!data) return null

  const { total_tomatoes = {}, total_flowers = {}, total_tomato_count = 0, total_flower_count = 0, rows = [] } = data
  const { Ripe = 0, Half_Ripe = 0, Unripe = 0 } = total_tomatoes
  const estimatedYield = Math.round(Ripe + Half_Ripe * 0.8 + Unripe * 0.5)

  const tomatoData = [
    { name: 'Ripe',      count: Ripe,      fill: TOMATO_COLORS.Ripe },
    { name: 'Half Ripe', count: Half_Ripe, fill: TOMATO_COLORS.Half_Ripe },
    { name: 'Unripe',    count: Unripe,    fill: TOMATO_COLORS.Unripe },
  ]
  const flowerData = [
    { name: FLOWER_LABELS['0'], count: total_flowers['0'] || 0, fill: FLOWER_COLORS['0'] },
    { name: FLOWER_LABELS['1'], count: total_flowers['1'] || 0, fill: FLOWER_COLORS['1'] },
    { name: FLOWER_LABELS['2'], count: total_flowers['2'] || 0, fill: FLOWER_COLORS['2'] },
  ]

  return (
    <div className="page-in page-pad" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }}>Dashboard</h1>
        <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Overview of your greenhouse — latest data from all rows</p>
      </div>

      {/* KPI stat cards */}
      <div className="rg-3" style={{ gap: 12 }}>
        <StatCard
          title="Total Tomatoes"
          value={total_tomato_count.toLocaleString()}
          breakdown={[
            { label: 'Ripe',      count: Ripe,      color: TOMATO_COLORS.Ripe },
            { label: 'Half Ripe', count: Half_Ripe, color: TOMATO_COLORS.Half_Ripe },
            { label: 'Unripe',    count: Unripe,    color: TOMATO_COLORS.Unripe },
          ]}
        />
        <StatCard
          title="Total Flowers"
          value={total_flower_count.toLocaleString()}
          breakdown={[
            { label: FLOWER_LABELS['0'], count: total_flowers['0'] || 0, color: FLOWER_COLORS['0'] },
            { label: FLOWER_LABELS['1'], count: total_flowers['1'] || 0, color: FLOWER_COLORS['1'] },
            { label: FLOWER_LABELS['2'], count: total_flowers['2'] || 0, color: FLOWER_COLORS['2'] },
          ]}
        />
        <StatCard
          title="Estimated Yield"
          value={estimatedYield.toLocaleString()}
          subtitle="Weighted estimate — coming weeks"
          breakdown={[
            { label: 'Ripe (×1.0)',      count: Ripe,                        color: TOMATO_COLORS.Ripe },
            { label: 'Half Ripe (×0.8)', count: Math.round(Half_Ripe * 0.8), color: TOMATO_COLORS.Half_Ripe },
            { label: 'Unripe (×0.5)',    count: Math.round(Unripe * 0.5),    color: TOMATO_COLORS.Unripe },
          ]}
        />
      </div>

      {/* Donut charts */}
      <div className="rg-2" style={{ gap: 12 }}>
        <ChartCard title="Tomato Ripeness" subtitle="Distribution across all rows">
          <DonutChart data={tomatoData} total={total_tomato_count} />
        </ChartCard>

        <ChartCard title="Flower Pollination Stages" subtitle="Distribution across all rows">
          <DonutChart data={flowerData} total={total_flower_count} />
        </ChartCard>
      </div>

      {/* Per-row breakdown */}
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Per-Row Breakdown</div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Latest classification data per location</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.t3 }}>No classified data available yet.</p>
          </div>
        ) : (
          <div>
            {rows.map(row => (
              <details key={row.greenhouse_row}>
                <summary
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 22px', cursor: 'pointer', listStyle: 'none',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg2}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: '50%',
                      background: C.greenDim, color: C.green,
                      fontSize: 11, fontWeight: 600,
                    }}>
                      {row.greenhouse_row}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Row {row.greenhouse_row}</span>
                    <span style={{ fontSize: 10, color: C.t3, background: C.bg3, borderRadius: 4, padding: '2px 7px' }}>
                      {row.distances.length} location{row.distances.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>

                <div style={{ padding: '12px 22px 16px' }}>
                  <div className="tbl-scroll">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 480 }}>
                    <thead>
                      <tr>
                        {['Distance', 'Timestamp', 'Ripe', 'Half Ripe', 'Unripe', 'Flowers'].map(h => (
                          <th key={h} style={{
                            padding: '0 12px 8px 0', textAlign: 'left',
                            fontSize: 10, fontWeight: 500, color: C.t3,
                            letterSpacing: '0.05em', textTransform: 'uppercase',
                            borderBottom: `1px solid ${C.border}`,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {row.distances.map((d, i) => {
                        const bc = d.tomato_summary?.by_class || {}
                        return (
                          <tr key={i} className="row-hover">
                            <td style={{ padding: '9px 12px 9px 0', color: C.t1, fontWeight: 500, borderBottom: `1px solid ${C.border}` }} className="num">{d.distanceFromRowStart}m</td>
                            <td style={{ padding: '9px 12px 9px 0', color: C.t3, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                              {new Date(d.latest_timestamp).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ padding: '9px 12px 9px 0', borderBottom: `1px solid ${C.border}` }}>
                              <span style={{ color: TOMATO_COLORS.Ripe, fontWeight: 500 }} className="num">{bc.Ripe || 0}</span>
                            </td>
                            <td style={{ padding: '9px 12px 9px 0', borderBottom: `1px solid ${C.border}` }}>
                              <span style={{ color: TOMATO_COLORS.Half_Ripe, fontWeight: 500 }} className="num">{bc.Half_Ripe || 0}</span>
                            </td>
                            <td style={{ padding: '9px 12px 9px 0', borderBottom: `1px solid ${C.border}` }}>
                              <span style={{ color: TOMATO_COLORS.Unripe, fontWeight: 500 }} className="num">{bc.Unripe || 0}</span>
                            </td>
                            <td style={{ padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                              <span style={{ color: FLOWER_COLORS['0'], fontWeight: 500 }} className="num">{d.flower_summary?.total_flowers || 0}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
