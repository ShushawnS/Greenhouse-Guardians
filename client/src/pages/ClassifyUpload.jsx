import { useState, useRef, useCallback } from 'react'
import { demoClassify, uploadClassify, getImageUrl } from '../api'
import LoadingSpinner from '../components/LoadingSpinner'
import ImageGallery from '../components/ImageGallery'
import { C, TOMATO_COLORS, FLOWER_COLORS, FLOWER_LABELS } from '../tokens'
import { useSettings } from '../context/SettingsContext'
import { getGreenhouseConfig } from '../hooks/useGreenhouseConfig'

const FLOWER_STAGE_LABELS = FLOWER_LABELS

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

function perImageTomatoDetections(classification, imageIndex) {
  const imgData = classification?.images?.[imageIndex]
  return normalizeTomatoDetections(imgData?.detections ?? [])
}

function perImageFlowerDetections(classification, imageIndex) {
  const imgData = classification?.images?.[imageIndex]
  return normalizeFlowerDetections(imgData?.flowers ?? [])
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function now() {
  return new Date().toISOString().slice(0, 26)
}

/* ── Reusable label + input ── */
function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: C.t2, letterSpacing: '0.02em' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${C.border2}`,
  borderRadius: 7, padding: '8px 12px',
  fontSize: 13, color: C.t1,
  background: C.bg1,
  outline: 'none',
  fontFamily: 'inherit',
}

/* ── Row selector — uses configured rows from onboarding (falls back to 1–10) ── */
function RowSelector({ value, onChange }) {
  const cfg = getGreenhouseConfig()
  const numRows = cfg?.numRows ?? 5
  const rows = Array.from({ length: numRows }, (_, i) => i + 1)

  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {rows.map(r => {
        const active = String(value) === String(r)
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(String(r))}
            className="btn-press"
            style={{
              flex: 1, height: 40, borderRadius: 7,
              border: `1px solid ${active ? C.green : C.border2}`,
              background: active ? C.green : C.bg1,
              color: active ? '#fff' : C.t2,
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.13s ease, color 0.13s ease, border-color 0.13s ease',
            }}
          >
            {r}
          </button>
        )
      })}
    </div>
  )
}

/* ── Distance selector — fixed options 0, 5, 10, 15, 20 m ── */
function DistanceInput({ distance, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[0, 5, 10, 15, 20].map(d => {
        const active = Number(distance) === d && distance !== ''
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(String(d))}
            className="btn-press"
            style={{
              flex: 1, height: 40, borderRadius: 7,
              border: `1px solid ${active ? C.green : C.border2}`,
              background: active ? C.green : C.bg1,
              color: active ? '#fff' : C.t2,
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.13s ease, color 0.13s ease, border-color 0.13s ease',
            }}
          >
            {d}m
          </button>
        )
      })}
    </div>
  )
}

export default function ClassifyUpload() {
  const { settings } = useSettings()
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

  // Depth sensor state
  const [depthFile, setDepthFile] = useState(null)
  const [fx, setFx] = useState('')
  const [fy, setFy] = useState('')
  const [depthScale, setDepthScale] = useState('0.001')
  const depthFileInput = useRef(null)

  const [depthDropdownOpen, setDepthDropdownOpen] = useState(false)

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
      fd.append('confidence_threshold', settings.confidenceThreshold)
      fd.append('tomato_track', settings.tomatoTrack ?? 'remote')
      fd.append('flower_track', settings.flowerTrack ?? 'remote')

      if (depthFile) {
        fd.append('depth_image', depthFile)
        if (fx) fd.append('fx', fx)
        if (fy) fd.append('fy', fy)
        if (depthScale) fd.append('depth_scale', depthScale)
      }

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

  let originalImages = [], tomatoImages = [], flowerImages = []

  if (results) {
    const { mode, data } = results
    const count = mode === 'demo'
      ? (data.original_images_b64 || []).length
      : (data.original_image_ids || []).length
    const toSrc = (i) => mode === 'demo'
      ? `data:image/jpeg;base64,${(data.original_images_b64 || [])[i]}`
      : getImageUrl((data.original_image_ids || [])[i])

    originalImages = Array.from({ length: count }, (_, i) => ({
      src: toSrc(i), label: `Image ${i + 1}`, detections: [],
    }))
    tomatoImages = Array.from({ length: count }, (_, i) => ({
      src: toSrc(i), label: `Image ${i + 1}`,
      detections: perImageTomatoDetections(data.tomato_classification, i),
    }))
    flowerImages = Array.from({ length: count }, (_, i) => ({
      src: toSrc(i), label: `Image ${i + 1}`,
      detections: perImageFlowerDetections(data.flower_classification, i),
    }))
  }

  const tomatoSummary = results?.data?.tomato_classification?.summary
  const flowerSummary = results?.data?.flower_classification
  const tracks = results?.data?.tracks
  const depthAnalysis = results?.data?.depth_analysis

  const card = {
    background: C.bg1, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '20px 22px',
  }

  return (
    <div className="page-in page-pad" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }}>Classify &amp; Upload</h1>
        <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Upload greenhouse images for YOLOv8 tomato and flower classification</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Demo mode toggle */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Demo Mode</p>
            <p style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Classify without saving to the database</p>
          </div>
          <button
            type="button"
            onClick={() => setDemoMode(v => !v)}
            style={{
              position: 'relative', width: 38, height: 22, borderRadius: 11,
              background: demoMode ? C.green : C.bg4,
              border: 'none', cursor: 'pointer', flexShrink: 0,
              transition: 'background 0.2s ease',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: 3, width: 16, height: 16,
              borderRadius: '50%', background: C.bg1,
              transform: demoMode ? 'translateX(16px)' : 'translateX(0)',
              transition: 'transform 0.2s ease',
              willChange: 'transform',
            }} />
          </button>
        </div>

        {/* Location + time — hidden in demo mode */}
        {!demoMode && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.t2, marginBottom: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Location &amp; Time
            </div>
            <div className="rg-3" style={{ gap: 12 }}>
              <Field label="Greenhouse Row">
                <RowSelector value={row} onChange={setRow} />
              </Field>
              <Field label="Distance from Row Start (m)">
                <DistanceInput distance={distance} onChange={setDistance} />
              </Field>
              <Field label="Timestamp">
                <input type="text" value={timestamp} onChange={e => setTimestamp(e.target.value)}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} />
              </Field>
            </div>
          </div>
        )}

        {/* Dropzone */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.t2, marginBottom: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Images
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            style={{
              border: `2px dashed ${dragging ? C.green : C.border2}`,
              borderRadius: 8,
              padding: '36px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: dragging ? C.greenDim : 'transparent',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <svg width="28" height="28" fill="none" stroke={C.t3} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 10 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p style={{ fontSize: 13, color: C.t2 }}>
              Drop images here or{' '}
              <span style={{ color: C.green, textDecoration: 'underline' }}>browse</span>
            </p>
            <p style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Supports JPG, PNG, WEBP</p>
            <input ref={fileInput} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
          </div>

          {files.length > 0 && (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {files.map((f, i) => (
                <li key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: C.bg2, borderRadius: 7, padding: '8px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <svg width="14" height="14" fill={C.green} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H6a2 2 0 00-2 2v1zm2 0v1h6V3H6zm10 4v8H4V5h6v2a2 2 0 002 2h2V7z" clipRule="evenodd" />
                    </svg>
                    <span style={{ fontSize: 12, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: C.t3, flexShrink: 0 }}>{formatBytes(f.size)}</span>
                  </div>
                  <button type="button" onClick={() => removeFile(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.t3, padding: 0, marginLeft: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                  }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Depth Sensor (optional) */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.t2, marginBottom: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Depth Sensor{' '}
            <span style={{ fontSize: 10, background: C.bg3, borderRadius: 4, padding: '2px 7px', color: C.t3, textTransform: 'none', letterSpacing: 0 }}>optional</span>
          </div>

          <Field label="Depth Map (.npy — uint16 RealSense depth array)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => depthFileInput.current?.click()}
                className="btn-press"
                style={{
                  ...inputStyle, cursor: 'pointer', textAlign: 'left',
                  color: depthFile ? C.t1 : C.t3, width: 'auto',
                }}
              >
                {depthFile ? depthFile.name : 'Choose .npy file…'}
              </button>
              {depthFile && (
                <button
                  type="button"
                  onClick={() => setDepthFile(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <input
                ref={depthFileInput} type="file" accept=".npy" style={{ display: 'none' }}
                onChange={e => { setDepthFile(e.target.files[0] || null); e.target.value = '' }}
              />
            </div>
          </Field>

          {depthFile && (
            <div style={{ marginTop: 14 }}>
              <div className="rg-3" style={{ gap: 12 }}>
                <Field label="Focal Length fx (px)">
                  <input
                    type="number" step="any" value={fx}
                    onChange={e => setFx(e.target.value)}
                    placeholder="e.g. 618.39"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Focal Length fy (px)">
                  <input
                    type="number" step="any" value={fy}
                    onChange={e => setFy(e.target.value)}
                    placeholder="e.g. 618.52"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Depth Scale (m / unit)">
                  <input
                    type="number" step="any" value={depthScale}
                    onChange={e => setDepthScale(e.target.value)}
                    placeholder="0.001"
                    style={inputStyle}
                  />
                </Field>
              </div>
              <p style={{ fontSize: 11, color: C.t3, marginTop: 10 }}>
                fx / fy come from your camera calibration. Depth scale is typically 0.001 for RealSense (1 unit = 1 mm).
                If intrinsics are omitted, only segmentation polygons are returned — no volume.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div style={{
            background: C.redDim, border: `1px solid ${C.red}44`,
            borderRadius: 8, padding: '12px 16px',
            fontSize: 12, color: C.red,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !files.length}
          className="btn-press"
          style={{
            width: '100%',
            background: loading || !files.length ? C.bg3 : C.green,
            color: loading || !files.length ? C.t3 : '#fff',
            border: 'none', borderRadius: 8, padding: '12px 0',
            fontSize: 13, fontWeight: 500, cursor: loading || !files.length ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', letterSpacing: '0.01em',
            transition: 'background 0.15s ease',
          }}
        >
          {loading ? 'Classifying…' : demoMode ? 'Run Demo Classification' : 'Classify & Save'}
        </button>
      </form>

      {loading && <LoadingSpinner message="Running YOLOv8 inference… this may take up to 30 seconds." />}

      {/* Results */}
      {results && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Success header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="11" height="11" fill="none" stroke={C.green} strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Classification Results</span>
          </div>

          {/* ── Unified results (demo + upload) ── */}
          <>
            {tracks && (
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Tomato', track: tracks.tomato },
                  { label: 'Flower', track: tracks.flower },
                ].map(({ label, track }) => (
                  <span key={label} style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 6,
                    background: C.bg3, color: C.t2, border: `1px solid ${C.border}`,
                  }}>
                    {label}: <span style={{ color: C.t1, fontWeight: 500 }}>{track}</span>
                  </span>
                ))}
              </div>
            )}

            {tomatoSummary && (
                <div className="rg-2" style={{ gap: 12 }}>
                  <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
                    <div style={{ fontSize: 11, color: C.t2, marginBottom: 8 }}>Tomato Summary</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: C.t1, letterSpacing: '-0.4px', marginBottom: 12 }} className="num">
                      {tomatoSummary.total} detected
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                      {[
                        { label: 'Ripe',      color: TOMATO_COLORS.Ripe,      count: tomatoSummary.by_class?.Ripe || 0 },
                        { label: 'Half Ripe', color: TOMATO_COLORS.Half_Ripe, count: tomatoSummary.by_class?.Half_Ripe || 0 },
                        { label: 'Unripe',    color: TOMATO_COLORS.Unripe,    count: tomatoSummary.by_class?.Unripe || 0 },
                      ].map(({ label, color, count }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: C.t2 }}>{label}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }} className="num">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
                    <div style={{ fontSize: 11, color: C.t2, marginBottom: 8 }}>Flower Summary</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: C.t1, letterSpacing: '-0.4px', marginBottom: 12 }} className="num">
                      {flowerSummary?.total_flowers || 0} detected
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                      {[
                        { label: FLOWER_STAGE_LABELS['0'], color: FLOWER_COLORS['0'], count: flowerSummary?.stage_counts?.['0'] || 0 },
                        { label: FLOWER_STAGE_LABELS['1'], color: FLOWER_COLORS['1'], count: flowerSummary?.stage_counts?.['1'] || 0 },
                        { label: FLOWER_STAGE_LABELS['2'], color: FLOWER_COLORS['2'], count: flowerSummary?.stage_counts?.['2'] || 0 },
                      ].map(({ label, color, count }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: C.t2 }}>{label}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }} className="num">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tomatoes card */}
              <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, marginBottom: 14 }}>Tomatoes</div>
                <div className={originalImages.length > 0 ? 'rg-2' : ''} style={{ gap: 20 }}>
                  {originalImages.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Original</div>
                      <ImageGallery images={originalImages} emptyMessage="No images" />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Annotated</div>
                    <ImageGallery images={tomatoImages} emptyMessage="No annotated images" />
                  </div>
                </div>

                {/* Depth dropdown — only shown when depth analysis ran */}
                {depthAnalysis && (
                  <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}` }}>
                    <button
                      type="button"
                      onClick={() => setDepthDropdownOpen(v => !v)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 0',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>
                          Volume &amp; Weight
                        </span>
                        <span style={{ fontSize: 11, color: C.t3 }}>
                          {depthAnalysis.depth_enabled
                            ? `${depthAnalysis.total} tomato${depthAnalysis.total !== 1 ? 's' : ''} · ${(depthAnalysis.tomatoes.reduce((s, t) => s + (t.weight_g || 0), 0)).toFixed(2)} g total`
                            : 'segmentation only'}
                        </span>
                      </div>
                      <svg
                        width="14" height="14" fill="none" stroke={C.t3} strokeWidth="2" viewBox="0 0 24 24"
                        style={{ flexShrink: 0, transition: 'transform 0.18s ease', transform: depthDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {depthDropdownOpen && (
                      <div style={{ paddingTop: 10 }}>
                        {/* Column headers */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 60px 70px 70px 70px 70px',
                          gap: 4, padding: '4px 8px',
                          fontSize: 10, fontWeight: 500, color: C.t3,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          <span>Label</span>
                          <span style={{ textAlign: 'right' }}>Conf</span>
                          <span style={{ textAlign: 'right' }}>Depth</span>
                          <span style={{ textAlign: 'right' }}>Radius</span>
                          <span style={{ textAlign: 'right' }}>Volume</span>
                          <span style={{ textAlign: 'right' }}>Weight</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                          {depthAnalysis.tomatoes.map(t => (
                            <div key={t.id} style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 60px 70px 70px 70px 70px',
                              gap: 4, padding: '6px 8px', borderRadius: 7,
                              background: C.bg2, alignItems: 'center',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: TOMATO_COLORS[t.label] || C.t3, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: C.t1 }}>#{t.id} {t.label}</span>
                              </div>
                              <span style={{ fontSize: 11, color: C.t2, textAlign: 'right' }} className="num">{(t.confidence * 100).toFixed(0)}%</span>
                              <span style={{ fontSize: 11, color: C.t2, textAlign: 'right' }} className="num">{t.depth_mm != null ? `${t.depth_mm} mm` : '—'}</span>
                              <span style={{ fontSize: 11, color: C.t2, textAlign: 'right' }} className="num">{t.radius_cm != null ? `${t.radius_cm} cm` : `${t.radius_px.toFixed(1)} px`}</span>
                              <span style={{ fontSize: 11, color: C.t2, textAlign: 'right' }} className="num">{t.volume_cm3 != null ? `${t.volume_cm3} cm³` : '—'}</span>
                              <span style={{ fontSize: 12, fontWeight: 500, color: C.t1, textAlign: 'right' }} className="num">{t.weight_g != null ? `${t.weight_g} g` : '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Flowers card */}
              <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, marginBottom: 14 }}>Flowers</div>
                <div className={originalImages.length > 0 ? 'rg-2' : ''} style={{ gap: 20 }}>
                  {originalImages.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Original</div>
                      <ImageGallery images={originalImages} emptyMessage="No images" />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Annotated</div>
                    <ImageGallery images={flowerImages} emptyMessage="No annotated images" />
                  </div>
                </div>
              </div>
          </>
        </div>
      )}
    </div>
  )
}
