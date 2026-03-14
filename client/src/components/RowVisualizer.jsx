export default function RowVisualizer({ distances = [], selectedIdx, onSelect }) {
  if (!distances.length) {
    return (
      <div className="flex items-center justify-center h-24 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm text-gray-400">No data points for this row</p>
      </div>
    )
  }

  const dists = distances.map(d => d.distanceFromRowStart)
  const minD = 0
  const maxD = Math.max(...dists)
  const range = maxD - minD || 1

  const getMarkerColor = (d) => {
    const tc = d.tomato_classification
    if (!tc) return '#9ca3af'
    const { Ripe = 0, Half_Ripe = 0, Unripe = 0 } = tc.summary?.by_class || {}
    const total = Ripe + Half_Ripe + Unripe
    if (!total) return '#9ca3af'
    if (Ripe / total >= 0.5) return '#22c55e'
    if (Half_Ripe / total >= 0.5) return '#eab308'
    return '#ef4444'
  }

  return (
    <div className="relative px-8 py-6 bg-white border border-green-100 rounded-xl shadow-sm">
      <p className="text-xs text-gray-400 mb-6 text-center">
        Click a marker to view details &middot; Distance from row start (meters)
      </p>
      {/* Track line */}
      <div className="relative h-2 bg-green-100 rounded-full mx-4">
        <div className="absolute inset-0 bg-gradient-to-r from-green-200 to-green-400 rounded-full opacity-60" />
        {distances.map((d, i) => {
          const pct = range === 0 ? 50 : ((d.distanceFromRowStart - minD) / range) * 100
          const isSelected = selectedIdx === i
          const color = getMarkerColor(d)
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              style={{ left: `${pct}%` }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 focus:outline-none group"
              title={`${d.distanceFromRowStart}m`}
            >
              <div
                className={`rounded-full border-2 border-white shadow-md transition-all duration-150 ${
                  isSelected ? 'w-7 h-7 ring-2 ring-offset-1 ring-green-500' : 'w-5 h-5 group-hover:w-6 group-hover:h-6'
                }`}
                style={{ backgroundColor: color }}
              />
              <span className={`absolute top-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap font-medium ${
                isSelected ? 'text-green-700' : 'text-gray-500'
              }`}>
                {d.distanceFromRowStart}m
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-8" />
    </div>
  )
}
