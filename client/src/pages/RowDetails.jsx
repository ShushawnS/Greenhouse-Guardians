import { useState, useEffect } from 'react'
import { getDetailedRowData } from '../api'
import RowVisualizer from '../components/RowVisualizer'
import ImageGallery from '../components/ImageGallery'
import LoadingSpinner from '../components/LoadingSpinner'

const ROW_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

const FLOWER_STAGE_LABELS = { '0': 'Bud', '1': 'Anthesis', '2': 'Post-Anthesis' }

function formatTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Normalize tomato detections for bbox overlay
function toTomatoDetections(classification) {
  return (classification?.detections || []).map(d => ({
    bbox: d.bbox,
    label: d.label,
    confidence: d.confidence,
  }))
}

// Normalize flower detections for bbox overlay
function toFlowerDetections(classification) {
  return (classification?.flowers || []).map(f => ({
    bbox: { x1: f.bounding_box[0], y1: f.bounding_box[1], x2: f.bounding_box[2], y2: f.bounding_box[3] },
    label: FLOWER_STAGE_LABELS[String(f.stage)] ?? `Stage ${f.stage}`,
    confidence: f.confidence,
  }))
}

function toImgList(urls, labelPrefix, detections = []) {
  return (urls || []).map((url, i) => ({
    src: url.startsWith('http') ? url : `http://localhost:8003${url}`,
    label: `${labelPrefix} ${i + 1}`,
    detections,
  }))
}

export default function RowDetails() {
  const [selectedRow, setSelectedRow] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    setData(null); setSelectedIdx(0); setError(null); setLoading(true)
    getDetailedRowData(selectedRow)
      .then(res => setData(res.data))
      .catch(err => {
        if (err.response?.status === 404) setError(`No data found for Row ${selectedRow}.`)
        else setError(err.response?.data?.detail || err.message)
      })
      .finally(() => setLoading(false))
  }, [selectedRow])

  const distances = data?.distances || []
  const selected = distances[selectedIdx] ?? null

  // Row-level aggregate stats
  const rowTotals = distances.reduce((acc, d) => {
    const bc = d.tomato_classification?.summary?.by_class || {}
    acc.Ripe      += bc.Ripe      || 0
    acc.Half_Ripe += bc.Half_Ripe || 0
    acc.Unripe    += bc.Unripe    || 0
    acc.flowers   += d.flower_classification?.total_flowers || 0
    return acc
  }, { Ripe: 0, Half_Ripe: 0, Unripe: 0, flowers: 0 })

  // Build image lists with detection data for bbox overlay in modal
  const tomatoDetections = toTomatoDetections(selected?.tomato_classification)
  const flowerDetections  = toFlowerDetections(selected?.flower_classification)

  const originalImages        = selected ? toImgList(selected.images?.original,        'Original',  [])               : []
  const tomatoAnnotatedImages = selected ? toImgList(selected.images?.tomato_annotated, 'Annotated', tomatoDetections) : []
  const flowerAnnotatedImages = selected ? toImgList(selected.images?.flower_annotated, 'Annotated', flowerDetections) : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header + row selector */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-green-800">Row Details</h1>
          <p className="text-sm text-gray-500 mt-1">Inspect classification results at each position along a row</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">Greenhouse Row</label>
          <select
            value={selectedRow}
            onChange={e => setSelectedRow(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            {ROW_OPTIONS.map(r => (
              <option key={r} value={r}>Row {r}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <LoadingSpinner message={`Loading row ${selectedRow} data\u2026`} />}

      {error && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Row summary stats — at the top */}
          {distances.length > 0 && (
            <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-green-700 mb-4">Row {selectedRow} Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[
                  { label: 'Ripe',      value: rowTotals.Ripe,      color: 'text-green-600' },
                  { label: 'Half Ripe', value: rowTotals.Half_Ripe,  color: 'text-yellow-600' },
                  { label: 'Unripe',    value: rowTotals.Unripe,    color: 'text-red-500' },
                  { label: 'Flowers',   value: rowTotals.flowers,   color: 'text-blue-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row visualizer */}
          <RowVisualizer
            distances={distances}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
          />

          {/* Detail panel for selected point */}
          {selected && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Classification breakdown */}
              <div className="space-y-4">
                <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
                  <h3 className="text-base font-semibold text-green-700 mb-1">
                    Position: {selected.distanceFromRowStart}m
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">{formatTs(selected.latest_timestamp)}</p>

                  {selected.tomato_classification ? (
                    <>
                      <p className="text-sm font-medium text-gray-500 mb-2">Tomatoes</p>
                      <div className="space-y-2 mb-4">
                        {[
                          { label: 'Ripe',      color: '#22c55e', count: selected.tomato_classification.summary?.by_class?.Ripe      || 0 },
                          { label: 'Half Ripe', color: '#eab308', count: selected.tomato_classification.summary?.by_class?.Half_Ripe  || 0 },
                          { label: 'Unripe',    color: '#ef4444', count: selected.tomato_classification.summary?.by_class?.Unripe     || 0 },
                        ].map(({ label, color, count }) => (
                          <div key={label} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-gray-600">{label}</span>
                            </div>
                            <span className="font-semibold text-gray-800">{count}</span>
                          </div>
                        ))}
                      </div>

                      <p className="text-sm font-medium text-gray-500 mb-2">Flowers</p>
                      <div className="space-y-2">
                        {[
                          { label: 'Bud',           color: '#3b82f6', count: selected.flower_classification?.stage_counts?.['0'] || 0 },
                          { label: 'Anthesis',       color: '#a855f7', count: selected.flower_classification?.stage_counts?.['1'] || 0 },
                          { label: 'Post-Anthesis',  color: '#f97316', count: selected.flower_classification?.stage_counts?.['2'] || 0 },
                        ].map(({ label, color, count }) => (
                          <div key={label} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-gray-600">{label}</span>
                            </div>
                            <span className="font-semibold text-gray-800">{count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Not yet classified</p>
                  )}
                </div>
              </div>

              {/* Image boxes */}
              <div className="lg:col-span-2 space-y-4">
                {/* Tomatoes */}
                <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
                  <h3 className="text-base font-semibold text-green-700 mb-4">Tomatoes</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Original</p>
                      <ImageGallery images={originalImages} emptyMessage="No images" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Annotated</p>
                      <ImageGallery images={tomatoAnnotatedImages} emptyMessage="No annotated images" />
                    </div>
                  </div>
                </div>

                {/* Flowers */}
                <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
                  <h3 className="text-base font-semibold text-green-700 mb-4">Flowers</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Original</p>
                      <ImageGallery images={originalImages} emptyMessage="No images" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Annotated</p>
                      <ImageGallery images={flowerAnnotatedImages} emptyMessage="No annotated images" />
                    </div>
                  </div>
                </div>

                {/* Depth */}
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-400 mb-4">
                    Depth <span className="text-xs font-normal text-gray-300">(coming soon)</span>
                  </h3>
                  <p className="text-sm text-gray-300 text-center py-4">Depth analysis not yet available</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
