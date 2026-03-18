import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, TOMATO_COLORS, FLOWER_COLORS, FLOWER_LABELS } from '../tokens'

const ROW_NUMBERS = [1, 2, 3, 4, 5]

/* ── colour helpers ── */

// Returns a CSS colour interpolated between unripe (red), half-ripe (amber) and ripe (green)
function ripenessHue(ripe, half_ripe, unripe) {
  const total = ripe + half_ripe + unripe
  if (!total) return null
  // Weighted hue: 0° = full unripe (red), 40° = full half-ripe (amber), 115° = full ripe (green)
  const hue = Math.round((ripe / total) * 115 + (half_ripe / total) * 40)
  return `hsl(${hue}, 65%, 45%)`
}

function pointColour(d) {
  const bc = d.tomato_summary?.by_class || {}
  return ripenessHue(bc.Ripe || 0, bc.Half_Ripe || 0, bc.Unripe || 0) || C.t3
}

// Build a CSS linear-gradient for the row band
function buildGradient(points, maxDist) {
  if (!points.length) return C.bg3

  const sorted = [...points]
    .sort((a, b) => a.distanceFromRowStart - b.distanceFromRowStart)
    .filter(d => pointColour(d) !== C.t3)  // skip no-data points

  if (!sorted.length) return C.bg3  // all points have no data → neutral band

  const stops = []

  sorted.forEach((d, i) => {
    const pct = maxDist > 0 ? ((d.distanceFromRowStart / maxDist) * 100).toFixed(1) : 50
    const hue = (() => {
      const bc = d.tomato_summary?.by_class || {}
      const r = bc.Ripe || 0, h = bc.Half_Ripe || 0, u = bc.Unripe || 0
      const total = r + h + u
      return Math.round((r / total) * 115 + (h / total) * 40)
    })()

    // Fade in from transparent before the first point
    if (i === 0 && parseFloat(pct) > 3) {
      stops.push(`hsla(${hue},65%,45%,0.08) 0%`)
    }
    stops.push(`hsla(${hue},65%,45%,0.80) ${pct}%`)
    // Fade out to transparent after the last point
    if (i === sorted.length - 1 && parseFloat(pct) < 97) {
      stops.push(`hsla(${hue},65%,45%,0.08) 100%`)
    }
  })

  return `linear-gradient(to right, ${stops.join(', ')})`
}

/* ── detail panel ── */
function DetailPanel({ point, rowNum, onClose }) {
  if (!point) return null
  const tc = point.tomato_summary
  const fc = point.flower_summary
  const bc = tc?.by_class || {}
  const sc = fc?.stage_counts || {}
  const totalT = tc?.total || 0
  const totalF = fc?.total_flowers || 0

  const tomatoItems = [
    { label: 'Ripe',      count: bc.Ripe      || 0, color: TOMATO_COLORS.Ripe },
    { label: 'Half Ripe', count: bc.Half_Ripe || 0, color: TOMATO_COLORS.Half_Ripe },
    { label: 'Unripe',    count: bc.Unripe    || 0, color: TOMATO_COLORS.Unripe },
  ].filter(r => r.count > 0)

  const flowerItems = [
    { label: 'Bud',          count: sc['0'] || 0, color: FLOWER_COLORS['0'] },
    { label: 'Anthesis',     count: sc['1'] || 0, color: FLOWER_COLORS['1'] },
    { label: 'Post-Anthesis', count: sc['2'] || 0, color: FLOWER_COLORS['2'] },
  ].filter(r => r.count > 0)

  return (
    <div style={{ background: C.bg1, position: 'relative' }}>
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 0, right: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.t3, fontSize: 16, lineHeight: 1, padding: 4,
        }}
        aria-label="Close"
      >×</button>

      {/* Location + timestamp */}
      <div style={{ marginBottom: 14, paddingRight: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
          Row {rowNum} · <span className="num">{point.distanceFromRowStart}m</span>
        </div>
        <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
          {point.latest_timestamp
            ? new Date(point.latest_timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'No data'}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {totalT > 0 && (
          <div>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>
              Tomatoes · <span style={{ fontWeight: 600, color: C.t1 }} className="num">{totalT}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              {tomatoItems.map(({ label, count, color }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.t2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: C.t1 }} className="num">{count}</span>
                  <span style={{ fontSize: 11 }}>{label}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {totalF > 0 && (
          <div>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>
              Flowers · <span style={{ fontWeight: 600, color: C.t1 }} className="num">{totalF}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              {flowerItems.map(({ label, count, color }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.t2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: C.t1 }} className="num">{count}</span>
                  <span style={{ fontSize: 11 }}>{label}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {totalT === 0 && totalF === 0 && (
          <span style={{ fontSize: 12, color: C.t3, fontStyle: 'italic' }}>No classification data</span>
        )}
      </div>
    </div>
  )
}

/* ── main component ── */
export default function GreenhouseHeatmap({ rows = [] }) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null) // { rowNum, pointIdx }

  // Build lookup: rowNum → sorted distances array
  const rowMap = {}
  rows.forEach(r => {
    rowMap[r.greenhouse_row] = [...(r.distances || [])].sort(
      (a, b) => a.distanceFromRowStart - b.distanceFromRowStart
    )
  })

  // Fixed X scale: 0–20m
  const maxDist = 20

  const selectedPoint = selected
    ? rowMap[selected.rowNum]?.[selected.pointIdx]
    : null

  function handleDotClick(rowNum, idx) {
    setSelected(prev =>
      prev?.rowNum === rowNum && prev?.pointIdx === idx ? null : { rowNum, pointIdx: idx }
    )
  }

  // X-axis tick marks
  const tickCount = 6
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / (tickCount - 1)) * maxDist)
  )

  return (
    <div style={{
      background: C.bg1,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 22px 14px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Greenhouse Layout</div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>
            Click a dot to inspect a location · Click a row label to view full details
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {[
            { label: 'Unripe',    color: 'hsl(0,65%,45%)' },
            { label: 'Half Ripe', color: 'hsl(40,65%,45%)' },
            { label: 'Ripe',      color: 'hsl(115,65%,45%)' },
            { label: 'No data',   color: C.bg3 },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: C.t3 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap grid + detail panel side by side */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>

      {/* Heatmap grid */}
      <div style={{ padding: '16px 22px 8px', flex: 1, minWidth: 0 }}>
        {ROW_NUMBERS.map(rowNum => {
          const points = rowMap[rowNum] || []
          const hasData = points.length > 0
          const gradient = C.bg1

          return (
            <div key={rowNum} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              {/* Row label — clickable */}
              <button
                onClick={() => navigate(`/rows?row=${rowNum}`)}
                style={{
                  flexShrink: 0, width: 52,
                  background: 'none', border: 'none', cursor: hasData ? 'pointer' : 'default',
                  padding: 0, textAlign: 'right',
                }}
                title={hasData ? `View Row ${rowNum} details` : `Row ${rowNum} — no data`}
              >
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  color: hasData ? C.green : C.t3,
                  textDecoration: hasData ? 'underline' : 'none',
                  textDecorationColor: C.green + '88',
                  textUnderlineOffset: 2,
                }}>
                  Row {rowNum}
                </span>
              </button>

              {/* Band + dots */}
              <div style={{ flex: 1, position: 'relative', height: 48 }}>
                {/* Coloured band */}
                <div style={{
                  position: 'absolute',
                  top: '50%', transform: 'translateY(-50%)',
                  left: 0, right: 0,
                  height: 20,
                  background: gradient,
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                }} />

                {/* No-data label */}
                {!hasData && (
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: 11, color: C.t3, pointerEvents: 'none',
                  }}>
                    No data
                  </div>
                )}

                {/* Dots */}
                {points.map((pt, idx) => {
                  const pct = (pt.distanceFromRowStart / maxDist) * 100
                  const isSelected = selected?.rowNum === rowNum && selected?.pointIdx === idx
                  const col = pointColour(pt)

                  return (
                    <button
                      key={idx}
                      onClick={() => handleDotClick(rowNum, idx)}
                      title={`Row ${rowNum} · ${pt.distanceFromRowStart}m`}
                      style={{
                        position: 'absolute',
                        left: `${pct}%`, top: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', padding: 0, zIndex: isSelected ? 3 : 2,
                      }}
                    >
                      {isSelected && (
                        <div style={{
                          position: 'absolute', top: '50%', left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 26, height: 26, borderRadius: '50%',
                          background: col + '28',
                          border: `1.5px solid ${col}77`,
                        }} />
                      )}
                      <div style={{
                        width:  isSelected ? 14 : 11,
                        height: isSelected ? 14 : 11,
                        borderRadius: '50%',
                        background: col,
                        border: `2px solid ${C.bg1}`,
                        boxShadow: isSelected
                          ? `0 0 0 2px ${col}88`
                          : '0 1px 4px rgba(28,25,23,0.18)',
                        position: 'relative', zIndex: 1,
                        transition: 'width 0.15s ease, height 0.15s ease, box-shadow 0.15s ease',
                      }} />
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* X-axis tick marks */}
        <div style={{ display: 'flex', marginLeft: 64, marginTop: 4, marginBottom: 8 }}>
          {ticks.map((val, i) => (
            <div
              key={i}
              style={{
                flex: i === ticks.length - 1 ? 0 : 1,
                fontSize: 10, color: C.t3, textAlign: i === ticks.length - 1 ? 'right' : 'left',
              }}
              className="num"
            >
              {val}m
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel — right side */}
      {selectedPoint && (
        <div style={{
          width: 320,
          flexShrink: 0,
          padding: '16px 16px 16px 0',
          borderLeft: `1px solid ${C.border}`,
          marginLeft: 0,
          paddingLeft: 16,
        }}>
          <DetailPanel
            point={selectedPoint}
            rowNum={selected.rowNum}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      </div>
    </div>
  )
}
