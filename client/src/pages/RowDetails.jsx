import { useState, useEffect } from 'react'
import { getDetailedRowData, getImageUrl } from '../api'
import RowVisualizer from '../components/RowVisualizer'
import ImageGallery from '../components/ImageGallery'
import LoadingSpinner from '../components/LoadingSpinner'

const ROW_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

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
    acc.Ripe += bc.Ripe || 0
    acc.Half_Ripe += bc.Half_Ripe || 0
    acc.Unripe += bc.Unripe || 0
    acc.flowers += d.flower_classification?.total_flowers || 0
    return acc
  }, { Ripe: 0, Half_Ripe: 0, Unripe: 0, flowers: 0 })

  const selectedImages = selected ? [
    ...(selected.images?.original || []).map((url, i) => ({
      src: url.startsWith('http') ? url : `http://localhost:8003${url}`, label: `Original ${i + 1}`
    })),
    ...(selected.images?.tomato_annotated || []).map((url, i) => ({
      src: url.startsWith('http') ? url : `http://localhost:8003${url}`, label: `Tomato Annotated ${i + 1}`
    })),
    ...(selected.images?.flower_annotated || []).map((url, i) => ({
      src: url.startsWith('http') ? url : `http://localhost:8003${url}`, label: `Flower Annotated ${i + 1}`
    })),
  ] : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
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
                  <p className="text-xs text-gray-400 mb-4">
                    {selected.latest_timestamp ? new Date(selected.latest_timestamp).toLocaleString() : '\u2014'}
                  </p>
                  {selected.tomato_classification ? (
                    <>
                      <p className="text-sm font-medium text-gray-500 mb-2">Tomatoes</p>
                      <div className="space-y-2 mb-4">
                        {[
                          { label: 'Ripe',      color: '#22c55e', count: selected.tomato_classification.summary?.by_class?.Ripe || 0 },
                          { label: 'Half Ripe', color: '#eab308', count: selected.tomato_classification.summary?.by_class?.Half_Ripe || 0 },
                          { label: 'Unripe',    color: '#ef4444', count: selected.tomato_classification.summary?.by_class?.Unripe || 0 },
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
                          { label: 'Stage 0', color: '#3b82f6', count: selected.flower_classification?.stage_counts?.['0'] || 0 },
                          { label: 'Stage 1', color: '#a855f7', count: selected.flower_classification?.stage_counts?.['1'] || 0 },
                          { label: 'Stage 2', color: '#f97316', count: selected.flower_classification?.stage_counts?.['2'] || 0 },
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

              {/* Image gallery */}
              <div className="lg:col-span-2 bg-white border border-green-100 rounded-xl shadow-sm p-6 space-y-3">
                <h3 className="text-base font-semibold text-green-700">Images</h3>
                <ImageGallery images={selectedImages} emptyMessage="No images for this location" />
              </div>
            </div>
          )}

          {/* Row summary stats */}
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
        </>
      )}
    </div>
  )
}
