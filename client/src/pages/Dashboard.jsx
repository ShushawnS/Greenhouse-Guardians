import { useEffect, useState } from 'react'
import { getSummaryResults } from '../api'
import StatCard from '../components/StatCard'
import ChartCard from '../components/ChartCard'
import DonutChart from '../components/DonutChart'
import LoadingSpinner from '../components/LoadingSpinner'
import { C, TOMATO_COLORS, FLOWER_COLORS, FLOWER_LABELS } from '../tokens'
import GreenhouseHeatmap from '../components/GreenhouseHeatmap'
import { getGreenhouseConfig } from '../hooks/useGreenhouseConfig'

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

  const ghConfig = getGreenhouseConfig()
  const { total_tomatoes = {}, total_flowers = {}, total_tomato_count = 0, total_flower_count = 0, rows = [] } = data
  const { Ripe = 0, Half_Ripe = 0, Unripe = 0 } = total_tomatoes
  const AVG_TOMATO_KG = 0.15
  const estimatedYieldKg = ((Ripe + Half_Ripe * 0.8 + Unripe * 0.5) * AVG_TOMATO_KG).toFixed(1)
  const harvestReadyPct = total_tomato_count > 0 ? Math.round((Ripe / total_tomato_count) * 100) : 0

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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Overview of your greenhouse — latest data from all rows</p>
        </div>
        {ghConfig && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: C.greenDim, border: `1px solid ${C.green}33`,
            borderRadius: 20, padding: '4px 12px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: C.green }}>
              Monitoring {ghConfig.numRows} {ghConfig.numRows === 1 ? 'row' : 'rows'}
            </span>
          </div>
        )}
      </div>

      {/* Combined chart + stat cards */}
      <div className="rg-3" style={{ gap: 12 }}>
        <ChartCard title="Tomato Ripeness" subtitle="Distribution across all rows" value={total_tomato_count.toLocaleString()}>
          <DonutChart data={tomatoData} total={total_tomato_count} />
        </ChartCard>

        <ChartCard title="Flower Pollination Stages" subtitle="Distribution across all rows" value={total_flower_count.toLocaleString()}>
          <DonutChart data={flowerData} total={total_flower_count} />
        </ChartCard>

        <StatCard
          title="Estimated Yield"
          icon="🍅"
          value={`${estimatedYieldKg} kg`}
          subtitle="~150g per tomato · weighted by ripeness"
          badge={harvestReadyPct > 0 ? {
            label: `${harvestReadyPct}% harvest-ready`,
            color: harvestReadyPct >= 60 ? C.green : harvestReadyPct >= 30 ? C.halfRipe : C.t3,
            bg: harvestReadyPct >= 60 ? C.greenDim : harvestReadyPct >= 30 ? C.halfRipeDim : C.bg3,
          } : undefined}
          breakdown={[
            { label: 'Ripe (×1.0)',      count: Math.round(Ripe * AVG_TOMATO_KG * 10) / 10,      color: TOMATO_COLORS.Ripe },
            { label: 'Half Ripe (×0.8)', count: Math.round(Half_Ripe * 0.8 * AVG_TOMATO_KG * 10) / 10, color: TOMATO_COLORS.Half_Ripe },
            { label: 'Unripe (×0.5)',    count: Math.round(Unripe * 0.5 * AVG_TOMATO_KG * 10) / 10,    color: TOMATO_COLORS.Unripe },
          ]}
        />
      </div>

      {/* Greenhouse heatmap */}
      <GreenhouseHeatmap rows={rows} />
    </div>
  )
}
