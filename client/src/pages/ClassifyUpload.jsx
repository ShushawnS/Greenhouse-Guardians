import { useState, useRef, useCallback } from 'react'
import { demoClassify, uploadClassify, getImageUrl } from '../api'
import LoadingSpinner from '../components/LoadingSpinner'
import ImageGallery from '../components/ImageGallery'

const FLOWER_STAGE_LABELS = { '0': 'Bud', '1': 'Anthesis', '2': 'Post-Anthesis' }

function normalizeTomatoDetections(detections = []) {
  return detections.map(d => ({ bbox: d.bbox, label: d.label, confidence: d.confidence }))
}

function normalizeFlowerDetections(flowers = []) {
  return flowers.map(f => ({
    bbox: { x1: f.bounding_box[0], y1: f.bounding_box[1], x2: f.bounding_box[2], y2: f.bounding_box[3] },
    label: FLOWER_STAGE_LABELS[String(f.stage)] ?? `Stage ${f.stage}`,
    confidence: f.confidence,
  }))
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function now() {
  return new Date().toISOString().slice(0, 26)
}

export default function ClassifyUpload() {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [row, setRow] = useState('')
  const [distance, setDistance] = useState('')
  const [timestamp, setTimestamp] = useState(now)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)

  const addFiles = useCallback((incoming) => {
    const imgs = Array.from(incoming).filter(f => f.type.startsWith('image/'))
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      const fresh = imgs.filter(f => !existing.has(f.name + f.size))
      return [...prev, ...fresh]
    })
  }, [])

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!files.length) { setError('Please select at least one image.'); return }
    if (!demoMode && (!row || !distance)) { setError('Greenhouse Row and Distance are required.'); return }

    setError(null); setResults(null); setLoading(true)

    try {
      const fd = new FormData()
      files.forEach(f => fd.append('images', f))

      let res
      if (demoMode) {
        res = await demoClassify(fd)
      } else {
        fd.append('greenhouse_row', row)
        fd.append('distanceFromRowStart', distance)
        fd.append('timestamp', timestamp)
        res = await uploadClassify(fd)
      }
      setResults({ mode: demoMode ? 'demo' : 'upload', data: res.data })
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Classification failed.')
    } finally {
      setLoading(false)
    }
  }

  // Build image galleries from results (with detections for bbox overlay in modal)
  let originalImages = [], tomatoImages = [], flowerImages = []
  if (results) {
    const { mode, data } = results
    const tDets = normalizeTomatoDetections(data.tomato_classification?.detections)
    const fDets = normalizeFlowerDetections(data.flower_classification?.flowers)
    if (mode === 'demo') {
      tomatoImages = (data.annotated_images?.tomato || []).map((b64, i) => ({
        src: `data:image/jpeg;base64,${b64}`, label: `Image ${i + 1}`, detections: tDets,
      }))
      flowerImages = (data.annotated_images?.flower || []).map((b64, i) => ({
        src: `data:image/jpeg;base64,${b64}`, label: `Image ${i + 1}`, detections: fDets,
      }))
    } else {
      originalImages = (data.original_image_ids || []).map((id, i) => ({
        src: getImageUrl(id), label: `Image ${i + 1}`, detections: [],
      }))
      tomatoImages = (data.tomato_annotated_ids || []).map((id, i) => ({
        src: getImageUrl(id), label: `Image ${i + 1}`, detections: tDets,
      }))
      flowerImages = (data.flower_annotated_ids || []).map((id, i) => ({
        src: getImageUrl(id), label: `Image ${i + 1}`, detections: fDets,
      }))
    }
  }

  const tomatoSummary = results?.data?.tomato_classification?.summary
  const flowerSummary = results?.data?.flower_classification

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-800">Classify &amp; Upload</h1>
        <p className="text-sm text-gray-500 mt-1">Upload greenhouse images for YOLOv8 tomato and flower classification</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Demo mode toggle */}
        <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-700">Demo Mode</p>
              <p className="text-sm text-gray-400 mt-0.5">Classify without saving to the database</p>
            </div>
            <button
              type="button"
              onClick={() => setDemoMode(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                demoMode ? 'bg-green-500' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                demoMode ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Row / Distance / Timestamp — hidden in demo mode */}
        {!demoMode && (
          <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-green-700">Location &amp; Time</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Greenhouse Row</label>
                <input
                  type="number" min="1" value={row} onChange={e => setRow(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Distance from Row Start (m)</label>
                <input
                  type="number" min="0" step="0.1" value={distance} onChange={e => setDistance(e.target.value)}
                  placeholder="e.g. 10.5"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Timestamp</label>
                <input
                  type="text" value={timestamp} onChange={e => setTimestamp(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Dropzone */}
        <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-green-700">Images</h3>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
            }`}
          >
            <svg className="w-10 h-10 text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-600">Drop images here or <span className="text-green-600 underline">browse</span></p>
            <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG, WEBP</p>
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
          </div>

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H6a2 2 0 00-2 2v1zm2 0v1h6V3H6zm10 4v8H4V5h6v2a2 2 0 002 2h2V7z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate">{f.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(f.size)}</span>
                  </div>
                  <button type="button" onClick={() => removeFile(i)} className="ml-3 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit" disabled={loading || !files.length}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? 'Classifying\u2026' : demoMode ? 'Run Demo Classification' : 'Classify & Save'}
        </button>
      </form>

      {/* Loading spinner */}
      {loading && <LoadingSpinner message="Running YOLOv8 inference\u2026 this may take up to 30 seconds." />}

      {/* Results */}
      {results && !loading && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-green-700">Classification Results</h2>
          </div>

          {/* Summary cards */}
          {tomatoSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
                <p className="text-sm font-medium text-gray-500 mb-3">Tomato Summary</p>
                <p className="text-3xl font-bold text-green-800 mb-4">{tomatoSummary.total} detected</p>
                <div className="space-y-2">
                  {[
                    { label: 'Ripe',      color: '#22c55e', count: tomatoSummary.by_class?.Ripe || 0 },
                    { label: 'Half Ripe', color: '#eab308', count: tomatoSummary.by_class?.Half_Ripe || 0 },
                    { label: 'Unripe',    color: '#ef4444', count: tomatoSummary.by_class?.Unripe || 0 },
                  ].map(({ label, color, count }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-gray-600">{label}</span>
                      </div>
                      <span className="font-semibold text-gray-800">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
                <p className="text-sm font-medium text-gray-500 mb-3">Flower Summary</p>
                <p className="text-3xl font-bold text-green-800 mb-4">{flowerSummary?.total_flowers || 0} detected</p>
                <div className="space-y-2">
                  {[
                    { label: FLOWER_STAGE_LABELS['0'], color: '#3b82f6', count: flowerSummary?.stage_counts?.['0'] || 0 },
                    { label: FLOWER_STAGE_LABELS['1'], color: '#a855f7', count: flowerSummary?.stage_counts?.['1'] || 0 },
                    { label: FLOWER_STAGE_LABELS['2'], color: '#f97316', count: flowerSummary?.stage_counts?.['2'] || 0 },
                  ].map(({ label, color, count }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-gray-600">{label}</span>
                      </div>
                      <span className="font-semibold text-gray-800">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Image boxes */}
          <div className="space-y-4">
            {/* Tomatoes */}
            <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-green-700 mb-4">Tomatoes</h3>
              <div className="grid grid-cols-2 gap-6">
                {originalImages.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Original</p>
                    <ImageGallery images={originalImages} emptyMessage="No images" />
                  </div>
                )}
                <div className={originalImages.length > 0 ? '' : 'col-span-2'}>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Annotated</p>
                  <ImageGallery images={tomatoImages} emptyMessage="No annotated images" />
                </div>
              </div>
            </div>

            {/* Flowers */}
            <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-green-700 mb-4">Flowers</h3>
              <div className="grid grid-cols-2 gap-6">
                {originalImages.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Original</p>
                    <ImageGallery images={originalImages} emptyMessage="No images" />
                  </div>
                )}
                <div className={originalImages.length > 0 ? '' : 'col-span-2'}>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Annotated</p>
                  <ImageGallery images={flowerImages} emptyMessage="No annotated images" />
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
    </div>
  )
}
