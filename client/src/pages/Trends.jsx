import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import ChartCard, { ChartTooltip } from '../components/ChartCard'
import { C, TOMATO_COLORS, FLOWER_COLORS } from '../tokens'

const PLACEHOLDER = [
  { t: 'Week 1' }, { t: 'Week 2' }, { t: 'Week 3' },
  { t: 'Week 4' }, { t: 'Week 5' }, { t: 'Week 6' },
]

export default function Trends() {
  return (
    <div className="page-in" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }}>Trends</h1>
        <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Track flowers and tomatoes over time</p>
      </div>

      {/* Info banner */}
      <div style={{
        background: C.greenDim,
        border: `1px solid ${C.green}33`,
        borderRadius: 10, padding: '14px 18px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: C.green + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="13" height="13" fill="none" stroke={C.green} strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.green }}>Trends coming soon</p>
          <p style={{ fontSize: 12, color: C.t2, marginTop: 3 }}>
            Track flowers and tomatoes over time — upload data regularly to enable trend analysis.
          </p>
        </div>
      </div>

      {/* Placeholder charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ChartCard title="Flowers over time" subtitle="Detections per session">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={PLACEHOLDER} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="0" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: C.t3 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.t3 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="flowers" stroke={FLOWER_COLORS['0']} strokeWidth={1.5} dot={false} strokeDasharray="5 4" />
            </LineChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 11, color: C.t3, textAlign: 'center', marginTop: 8 }}>
            No data yet — upload images over multiple sessions to see trends
          </p>
        </ChartCard>

        <ChartCard title="Tomatoes over time" subtitle="Detections per session">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={PLACEHOLDER} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="0" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: C.t3 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.t3 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="tomatoes" stroke={TOMATO_COLORS.Ripe} strokeWidth={1.5} dot={false} strokeDasharray="5 4" />
            </LineChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 11, color: C.t3, textAlign: 'center', marginTop: 8 }}>
            No data yet — upload images over multiple sessions to see trends
          </p>
        </ChartCard>
      </div>
    </div>
  )
}
