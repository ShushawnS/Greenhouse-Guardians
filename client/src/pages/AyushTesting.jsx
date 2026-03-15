import { useEffect, useState } from 'react'
import { getAllData, getImageUrl } from '../api/index.js'

const RESULT_BASE = 'http://localhost:8003'

function imgSrc(path) {
  // path is like /getImage/<id>
  return `${RESULT_BASE}${path}`
}

function StatBadge({ label, value, color }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}
    >
      {label}: {value}
    </span>
  )
}

function TomatoStats({ cls }) {
  if (!cls) return <p className="text-xs text-gray-400 italic">No tomato data</p>
  const { by_class = {}, total = 0 } = cls.summary ?? {}
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-xs text-gray-500 font-medium">Tomatoes ({total}):</span>
      <StatBadge label="Ripe" value={by_class.Ripe ?? 0} color="bg-green-100 text-green-800" />
      <StatBadge label="Half" value={by_class.Half_Ripe ?? 0} color="bg-yellow-100 text-yellow-800" />
      <StatBadge label="Unripe" value={by_class.Unripe ?? 0} color="bg-red-100 text-red-800" />
    </div>
  )
}

function FlowerStats({ cls }) {
  if (!cls) return <p className="text-xs text-gray-400 italic">No flower data</p>
  const { stage_counts = {}, total_flowers = 0 } = cls
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-xs text-gray-500 font-medium">Flowers ({total_flowers}):</span>
      <StatBadge label="S0" value={stage_counts['0'] ?? 0} color="bg-blue-100 text-blue-800" />
      <StatBadge label="S1" value={stage_counts['1'] ?? 0} color="bg-purple-100 text-purple-800" />
      <StatBadge label="S2" value={stage_counts['2'] ?? 0} color="bg-pink-100 text-pink-800" />
    </div>
  )
}

function ImageStrip({ label, paths, emptyMsg }) {
  if (!paths || paths.length === 0)
    return (
      <div className="text-xs text-gray-400 italic">{emptyMsg}</div>
    )
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {paths.map((p, i) => (
          <img
            key={i}
            src={imgSrc(p)}
            alt={`${label} ${i + 1}`}
            className="h-36 w-auto rounded-lg border border-gray-200 object-cover shadow-sm"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ))}
      </div>
    </div>
  )
}

function RunCard({ run, index }) {
  const [open, setOpen] = useState(index === 0)
  const hasImages =
    run.images.original.length > 0 ||
    run.images.tomato_annotated.length > 0 ||
    run.images.flower_annotated.length > 0

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white bg-green-600 rounded-full w-6 h-6 flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-700">{run.timestamp}</span>
          {!run.tomato_classification && !run.flower_classification && (
            <span className="text-xs text-orange-500 italic">classification pending</span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* Stats row */}
          <div className="flex flex-wrap gap-4 pt-3">
            <TomatoStats cls={run.tomato_classification} />
            <FlowerStats cls={run.flower_classification} />
          </div>

          {/* Images */}
          {hasImages ? (
            <div className="space-y-3">
              {/* Original + annotated side-by-side per image index */}
              {run.images.original.length > 0 ? (
                run.images.original.map((origPath, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                      Image {i + 1}
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Original</p>
                        <img
                          src={imgSrc(origPath)}
                          alt={`Original ${i + 1}`}
                          className="h-40 w-auto rounded-lg border border-gray-200 object-cover shadow-sm"
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                      {run.images.tomato_annotated[i] && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Tomato Detection</p>
                          <img
                            src={imgSrc(run.images.tomato_annotated[i])}
                            alt={`Tomato annotated ${i + 1}`}
                            className="h-40 w-auto rounded-lg border border-green-200 object-cover shadow-sm"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        </div>
                      )}
                      {run.images.flower_annotated[i] && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Flower Detection</p>
                          <img
                            src={imgSrc(run.images.flower_annotated[i])}
                            alt={`Flower annotated ${i + 1}`}
                            className="h-40 w-auto rounded-lg border border-purple-200 object-cover shadow-sm"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex gap-4">
                  <ImageStrip label="Tomato Annotated" paths={run.images.tomato_annotated} emptyMsg="No tomato annotated images" />
                  <ImageStrip label="Flower Annotated" paths={run.images.flower_annotated} emptyMsg="No flower annotated images" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No images stored for this run</p>
          )}

          {/* Raw detection counts */}
          {run.tomato_classification?.detections?.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
                Raw tomato detections ({run.tomato_classification.detections.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 rounded p-2 font-mono text-xs">
                {run.tomato_classification.detections.map((d, i) => (
                  <div key={i}>
                    [{i}] {d.label} ({(d.confidence * 100).toFixed(1)}%) — bbox: {JSON.stringify(d.bbox)}
                  </div>
                ))}
              </div>
            </details>
          )}
          {run.flower_classification?.flowers?.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
                Raw flower detections ({run.flower_classification.flowers.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 rounded p-2 font-mono text-xs">
                {run.flower_classification.flowers.map((f, i) => (
                  <div key={i}>
                    [{i}] Stage {f.stage} ({(f.confidence * 100).toFixed(1)}%) — bbox: [{f.bounding_box?.join(', ')}]
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function LocationCard({ doc }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white border border-green-100 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-green-50 hover:bg-green-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-green-800">Row {doc.greenhouse_row}</span>
          <span className="text-gray-400">·</span>
          <span className="text-sm text-gray-600">{doc.distanceFromRowStart} m from start</span>
          <span className="text-xs bg-green-200 text-green-800 font-semibold px-2 py-0.5 rounded-full">
            {doc.runs.length} run{doc.runs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-green-700">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-4 space-y-3">
          {doc.runs.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No runs recorded yet.</p>
          ) : (
            doc.runs.map((run, i) => <RunCard key={run.timestamp} run={run} index={i} />)
          )}
        </div>
      )}
    </div>
  )
}

export default function AyushTesting() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAllData()
      setData(res.data.documents)
    } catch (e) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = data
    ? data.filter((doc) => {
        if (!filter) return true
        const q = filter.toLowerCase()
        return (
          String(doc.greenhouse_row).includes(q) ||
          String(doc.distanceFromRowStart).includes(q)
        )
      })
    : []

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-800">Ayush Testing</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All raw database records — every location and every run with images and ML results
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Filter */}
      {data && (
        <div className="mb-5">
          <input
            type="text"
            placeholder="Filter by row number or distance…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <span className="ml-3 text-xs text-gray-400">
            {filtered.length} of {data.length} location{data.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center h-48 text-green-600">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="ml-3 text-sm font-medium">Fetching database…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No data found</p>
          <p className="text-sm mt-1">Upload some images to see records here.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-5">
          {filtered.map((doc, i) => (
            <LocationCard key={`${doc.greenhouse_row}-${doc.distanceFromRowStart}`} doc={doc} />
          ))}
        </div>
      )}
    </div>
  )
}
