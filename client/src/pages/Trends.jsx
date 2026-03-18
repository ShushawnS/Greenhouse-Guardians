import { useState, useEffect } from 'react'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { C, TOMATO_COLORS, FLOWER_COLORS } from '../tokens'
import { ChartTooltip } from '../components/ChartCard'
import { getTrends, recomputeTrends } from '../api'

/* ─────────────────────────────────────────────
   MOCK DATA — used when daily_trends is empty.
   Simulates 10 scan sessions over ~5 weeks.
───────────────────────────────────────────── */
const AVG_TOMATO_KG = 0.15

const RAW_MOCK = [
  { date: 'Mar 1',  ripe:  2, half_ripe:  8, unripe: 42, stage_0: 38, stage_1: 12, stage_2:  4 },
  { date: 'Mar 4',  ripe:  4, half_ripe: 12, unripe: 38, stage_0: 34, stage_1: 16, stage_2:  7 },
  { date: 'Mar 8',  ripe:  8, half_ripe: 18, unripe: 32, stage_0: 28, stage_1: 20, stage_2: 10 },
  { date: 'Mar 11', ripe: 14, half_ripe: 22, unripe: 26, stage_0: 22, stage_1: 22, stage_2: 14 },
  { date: 'Mar 15', ripe: 22, half_ripe: 24, unripe: 20, stage_0: 17, stage_1: 19, stage_2: 18 },
  { date: 'Mar 18', ripe: 31, half_ripe: 20, unripe: 15, stage_0: 12, stage_1: 15, stage_2: 20 },
  { date: 'Mar 22', ripe: 40, half_ripe: 18, unripe: 10, stage_0:  9, stage_1: 12, stage_2: 22 },
  { date: 'Mar 25', ripe: 50, half_ripe: 14, unripe:  7, stage_0:  7, stage_1:  9, stage_2: 24 },
  { date: 'Mar 29', ripe: 58, half_ripe: 10, unripe:  5, stage_0:  5, stage_1:  7, stage_2: 26 },
  { date: 'Apr 1',  ripe: 64, half_ripe:  8, unripe:  3, stage_0:  4, stage_1:  6, stage_2: 27 },
]

function deriveMock(raw) {
  return raw.map(d => ({
    ...d,
    yield:          parseFloat(((d.ripe * 1.0 + d.half_ripe * 0.8 + d.unripe * 0.5) * AVG_TOMATO_KG).toFixed(2)),
    total_tomatoes: d.ripe + d.half_ripe + d.unripe,
    total_flowers:  d.stage_0 + d.stage_1 + d.stage_2,
  }))
}

function deriveReal(docs) {
  return docs.map(d => ({
    date:           d.date,
    ripe:           d.tomatoes?.ripe      ?? 0,
    half_ripe:      d.tomatoes?.half_ripe ?? 0,
    unripe:         d.tomatoes?.unripe    ?? 0,
    stage_0:        d.flowers?.stage_0    ?? 0,
    stage_1:        d.flowers?.stage_1    ?? 0,
    stage_2:        d.flowers?.stage_2    ?? 0,
    yield:          d.estimated_yield_kg  ?? 0,
    total_tomatoes: d.tomatoes?.total     ?? 0,
    total_flowers:  d.flowers?.total      ?? 0,
    scan_count:     d.scan_count          ?? 0,
    location_count: d.location_count      ?? 0,
  }))
}

/* ── shared chart config ── */
const axisStyle = { fontSize: 11, fill: C.t3 }
const gridProps = { stroke: C.border, strokeDasharray: '0', vertical: false }

/* ── legend dot ── */
function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: C.t2 }}>{label}</span>
    </div>
  )
}

/* ── summary chip ── */
function Chip({ label, value, color }) {
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 18px' }}>
      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || C.t1, letterSpacing: '-0.4px' }} className="num">{value}</div>
    </div>
  )
}

/* ── chart card ── */
function Card({ title, subtitle, badge, children }) {
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>{subtitle}</div>}
        </div>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: C.t3,
            background: C.bg3, border: `1px solid ${C.border}`,
            padding: '3px 9px', borderRadius: 99,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export default function Trends() {
  const [chartData, setChartData] = useState(null)
  const [isMock,    setIsMock]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [error,     setError]     = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await getTrends()
      const docs = res.data?.data ?? []
      if (docs.length === 0) {
        setChartData(deriveMock(RAW_MOCK))
        setIsMock(true)
      } else {
        setChartData(deriveReal(docs))
        setIsMock(false)
      }
    } catch (e) {
      setError(e.message)
      setChartData(deriveMock(RAW_MOCK))
      setIsMock(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleRecompute() {
    setRecomputing(true)
    try {
      await recomputeTrends()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setRecomputing(false)
    }
  }

  useEffect(() => { load() }, [])

  const latest   = chartData?.[chartData.length - 1]
  const earliest = chartData?.[0]
  const yieldGain = latest && earliest
    ? (latest.yield - earliest.yield).toFixed(2)
    : '—'
  const ripeGain = latest && earliest
    ? latest.ripe - earliest.ripe
    : '—'

  return (
    <div
      className="page-in page-pad"
      style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px', margin: 0 }}>Trends</h1>
          <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
            {isMock
              ? 'No trend data yet — showing mock data'
              : `${chartData?.length ?? 0} day${chartData?.length !== 1 ? 's' : ''} of data from daily_trends`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isMock && (
            <span style={{
              fontSize: 11, color: C.amber, background: C.amberDim,
              border: `1px solid ${C.amber}44`, borderRadius: 99,
              padding: '4px 12px', fontWeight: 500,
            }}>
              Mock data
            </span>
          )}
          <button
            onClick={handleRecompute}
            disabled={recomputing || loading}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 500,
              borderRadius: 7, border: `1px solid ${C.border}`,
              background: C.bg1, color: C.t2,
              cursor: recomputing || loading ? 'not-allowed' : 'pointer',
              opacity: recomputing || loading ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {recomputing ? 'Recomputing…' : 'Recompute from DB'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 500,
              borderRadius: 7, border: 'none',
              background: C.green, color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: C.redDim, border: `1px solid ${C.unripe}44`, borderRadius: 8, padding: '12px 16px', fontSize: 12, color: C.unripe }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
          <svg style={{ width: 22, height: 22, animation: 'spin 1s linear infinite', color: C.green }} fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span style={{ fontSize: 13, color: C.t2 }}>Loading trend data…</span>
        </div>
      )}

      {!loading && chartData && (
        <>
          {/* Summary chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <Chip label="Days tracked"    value={chartData.length} />
            <Chip label="Latest yield"    value={`${latest?.yield ?? 0} kg`}   color={C.green} />
            <Chip label="Yield gain"      value={`+${yieldGain} kg`}           color={C.green} />
            <Chip label="Ripe tomatoes ↑" value={typeof ripeGain === 'number' ? `+${ripeGain}` : ripeGain} color={C.ripe} />
          </div>

          {/* Yield chart */}
          <Card
            title="Estimated Yield over Time"
            subtitle="kg · weighted: ripe ×1.0, half ×0.8, unripe ×0.5, avg 150g/tomato"
            badge={isMock ? 'Mock data' : undefined}
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.green} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} unit=" kg" width={52} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="yield" name="Yield (kg)"
                  stroke={C.green} strokeWidth={2}
                  fill="url(#yieldGrad)"
                  dot={{ r: 3, fill: C.green, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Ripeness + flower stages */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title="Tomato Ripeness over Time" subtitle="Detections per day" badge={isMock ? 'Mock data' : undefined}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                <LegendDot color={TOMATO_COLORS.Ripe}      label="Ripe" />
                <LegendDot color={TOMATO_COLORS.Half_Ripe} label="Half Ripe" />
                <LegendDot color={TOMATO_COLORS.Unripe}    label="Unripe" />
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ripeGrad"   x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={TOMATO_COLORS.Ripe}      stopOpacity={0.2} /><stop offset="95%" stopColor={TOMATO_COLORS.Ripe}      stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="halfGrad"   x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={TOMATO_COLORS.Half_Ripe} stopOpacity={0.2} /><stop offset="95%" stopColor={TOMATO_COLORS.Half_Ripe} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="unripeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={TOMATO_COLORS.Unripe}    stopOpacity={0.2} /><stop offset="95%" stopColor={TOMATO_COLORS.Unripe}    stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="ripe"      name="Ripe"      stroke={TOMATO_COLORS.Ripe}      strokeWidth={2} fill="url(#ripeGrad)"   dot={false} />
                  <Area type="monotone" dataKey="half_ripe" name="Half Ripe" stroke={TOMATO_COLORS.Half_Ripe} strokeWidth={2} fill="url(#halfGrad)"   dot={false} />
                  <Area type="monotone" dataKey="unripe"    name="Unripe"    stroke={TOMATO_COLORS.Unripe}    strokeWidth={2} fill="url(#unripeGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Flower Pollination Stages over Time" subtitle="Detections per day" badge={isMock ? 'Mock data' : undefined}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                <LegendDot color={FLOWER_COLORS['0']} label="Bud" />
                <LegendDot color={FLOWER_COLORS['1']} label="Anthesis" />
                <LegendDot color={FLOWER_COLORS['2']} label="Post-Anthesis" />
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="stage_0" name="Bud"           stroke={FLOWER_COLORS['0']} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="stage_1" name="Anthesis"      stroke={FLOWER_COLORS['1']} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="stage_2" name="Post-Anthesis" stroke={FLOWER_COLORS['2']} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Total counts */}
          <Card title="Total Detections over Time" subtitle="Tomatoes and flowers per day" badge={isMock ? 'Mock data' : undefined}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <LegendDot color={TOMATO_COLORS.Ripe} label="Total Tomatoes" />
              <LegendDot color={FLOWER_COLORS['1']} label="Total Flowers" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="total_tomatoes" name="Total Tomatoes" stroke={TOMATO_COLORS.Ripe} strokeWidth={2} dot={{ r: 3, fill: TOMATO_COLORS.Ripe, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="total_flowers"  name="Total Flowers"  stroke={FLOWER_COLORS['1']} strokeWidth={2} dot={{ r: 3, fill: FLOWER_COLORS['1'], strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  )
}
