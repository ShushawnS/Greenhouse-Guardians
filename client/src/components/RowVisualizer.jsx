import { C } from '../tokens'

function getMarkerColor(d) {
  const tc = d.tomato_classification
  if (!tc) return C.t3
  const { Ripe = 0, Half_Ripe = 0, Unripe = 0 } = tc.summary?.by_class || {}
  const total = Ripe + Half_Ripe + Unripe
  if (!total) return C.t3
  if (Ripe / total >= 0.5)      return C.ripe
  if (Half_Ripe / total >= 0.5) return C.halfRipe
  return C.unripe
}

export default function RowVisualizer({ distances = [], selectedIdx, onSelect }) {
  if (!distances.length) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 72, background: C.bg2,
        border: `1px solid ${C.border}`, borderRadius: 10,
      }}>
        <p style={{ fontSize: 12, color: C.t3 }}>No data points for this row</p>
      </div>
    )
  }

  const maxD  = Math.max(...distances.map(d => d.distanceFromRowStart)) || 1
  const sel   = distances[selectedIdx]

  return (
    <div style={{
      background: C.bg1, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '18px 28px 30px',
    }}>
      {/* Header row: title on left, selected position on right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Positions along row
        </div>
        {sel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: getMarkerColor(sel), flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: C.t1, fontWeight: 500 }} className="num">
              {sel.distanceFromRowStart}m
            </span>
            <span style={{ fontSize: 11, color: C.t3 }}>selected</span>
          </div>
        )}
      </div>

      {/* Track */}
      <div style={{ position: 'relative', height: 4, background: C.bg3, borderRadius: 2, margin: '0 10px' }}>
        {/* Filled portion up to selected point */}
        {sel && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${(sel.distanceFromRowStart / maxD) * 100}%`,
            background: C.green + '55',
            borderRadius: 2,
            transition: 'width 0.25s ease',
          }} />
        )}

        {distances.map((d, i) => {
          const pct        = (d.distanceFromRowStart / maxD) * 100
          const isSelected = selectedIdx === i
          const color      = getMarkerColor(d)

          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              title={`${d.distanceFromRowStart}m`}
              style={{
                position: 'absolute', left: `${pct}%`, top: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                zIndex: isSelected ? 2 : 1,
              }}
            >
              {/* Outer ring — only on selected */}
              {isSelected && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 24, height: 24, borderRadius: '50%',
                  background: color + '22',
                  border: `1.5px solid ${color}55`,
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }} />
              )}
              {/* Dot */}
              <div style={{
                width:  isSelected ? 14 : 11,
                height: isSelected ? 14 : 11,
                borderRadius: '50%',
                background: color,
                border: `2px solid ${C.bg1}`,
                boxShadow: isSelected
                  ? `0 0 0 2px ${color}88`
                  : '0 1px 3px rgba(28,25,23,0.15)',
                transition: 'width 0.18s ease, height 0.18s ease, box-shadow 0.18s ease',
                position: 'relative', zIndex: 1,
              }} />

              {/* Distance label below */}
              <span style={{
                position: 'absolute',
                top: isSelected ? 18 : 16,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 10,
                color: isSelected ? C.t1 : C.t3,
                fontWeight: isSelected ? 500 : 400,
                whiteSpace: 'nowrap',
                transition: 'color 0.18s, font-weight 0.18s',
              }} className="num">
                {d.distanceFromRowStart}m
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
