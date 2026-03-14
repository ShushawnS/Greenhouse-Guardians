import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getSummaryResults } from '../api'
import StatCard from '../components/StatCard'
import ChartCard from '../components/ChartCard'
import LoadingSpinner from '../components/LoadingSpinner'

const TOMATO_COLORS = { Ripe: '#22c55e', Half_Ripe: '#eab308', Unripe: '#ef4444' }
const FLOWER_COLORS  = { '0': '#3b82f6', '1': '#a855f7', '2': '#f97316' }
const FLOWER_LABELS  = { '0': 'Bud', '1': 'Anthesis', '2': 'Post-Anthesis' }

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

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><LoadingSpinner message="Loading greenhouse data\u2026" /></div>
  if (error) return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-semibold">Failed to load data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    </div>
  )
  if (!data) return null

  const { total_tomatoes = {}, total_flowers = {}, total_tomato_count = 0, total_flower_count = 0, rows = [] } = data
  const { Ripe = 0, Half_Ripe = 0, Unripe = 0 } = total_tomatoes
  const estimatedYield = Math.round(Ripe + Half_Ripe * 0.8 + Unripe * 0.5)

  const tomatoChartData = [
    { name: 'Ripe',      count: Ripe,      fill: TOMATO_COLORS.Ripe },
    { name: 'Half Ripe', count: Half_Ripe, fill: TOMATO_COLORS.Half_Ripe },
    { name: 'Unripe',    count: Unripe,    fill: TOMATO_COLORS.Unripe },
  ]
  const flowerChartData = [
    { name: FLOWER_LABELS['0'], count: total_flowers['0'] || 0, fill: FLOWER_COLORS['0'] },
    { name: FLOWER_LABELS['1'], count: total_flowers['1'] || 0, fill: FLOWER_COLORS['1'] },
    { name: FLOWER_LABELS['2'], count: total_flowers['2'] || 0, fill: FLOWER_COLORS['2'] },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your greenhouse latest data from all rows</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
          subtitle="Weighted estimate in coming weeks"
          breakdown={[
            { label: 'Ripe (\u00d71.0)',      count: Ripe,                        color: TOMATO_COLORS.Ripe },
            { label: 'Half Ripe (\u00d70.8)', count: Math.round(Half_Ripe * 0.8), color: TOMATO_COLORS.Half_Ripe },
            { label: 'Unripe (\u00d70.5)',    count: Math.round(Unripe * 0.5),    color: TOMATO_COLORS.Unripe },
          ]}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Tomato Ripeness Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tomatoChartData} barSize={48} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #d1fae5', fontSize: 12 }}
                cursor={{ fill: '#f0fdf4' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {tomatoChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Flower Pollination Stage Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={flowerChartData} barSize={48} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #d1fae5', fontSize: 12 }}
                cursor={{ fill: '#f0fdf4' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {flowerChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Per-row summary table */}
      <div className="bg-white border border-green-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-green-50">
          <h3 className="text-lg font-semibold text-green-700">Per-Row Breakdown</h3>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No classified data available yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map(row => (
              <details key={row.greenhouse_row} className="group">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-green-50 transition-colors list-none">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                      {row.greenhouse_row}
                    </span>
                    <span className="font-medium text-gray-700">Row {row.greenhouse_row}</span>
                    <span className="text-xs text-gray-400">{row.distances.length} location{row.distances.length !== 1 ? 's' : ''}</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                        <th className="pb-2 pr-4">Distance</th>
                        <th className="pb-2 pr-4">Timestamp</th>
                        <th className="pb-2 pr-4">Ripe</th>
                        <th className="pb-2 pr-4">Half Ripe</th>
                        <th className="pb-2 pr-4">Unripe</th>
                        <th className="pb-2">Flowers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {row.distances.map((d, i) => {
                        const bc = d.tomato_summary?.by_class || {}
                        return (
                          <tr key={i} className="text-gray-600">
                            <td className="py-2 pr-4 font-medium">{d.distanceFromRowStart}m</td>
                            <td className="py-2 pr-4 text-gray-400 text-xs">{new Date(d.latest_timestamp).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="py-2 pr-4"><span className="text-green-600 font-medium">{bc.Ripe || 0}</span></td>
                            <td className="py-2 pr-4"><span className="text-yellow-600 font-medium">{bc.Half_Ripe || 0}</span></td>
                            <td className="py-2 pr-4"><span className="text-red-500 font-medium">{bc.Unripe || 0}</span></td>
                            <td className="py-2"><span className="text-blue-500 font-medium">{d.flower_summary?.total_flowers || 0}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
