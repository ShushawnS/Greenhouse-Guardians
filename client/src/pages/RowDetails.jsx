import { useState, useEffect } from 'react'
import { getDetailedRowData, deleteData, API_BASE } from '../api'
import RowVisualizer from '../components/RowVisualizer'
import ImageGallery from '../components/ImageGallery'
import LoadingSpinner from '../components/LoadingSpinner'
import { C, TOMATO_COLORS, FLOWER_COLORS, FLOWER_LABELS } from '../tokens'
import { getConfiguredRows } from '../hooks/useGreenhouseConfig'

const FLOWER_STAGE_LABELS = FLOWER_LABELS

function formatTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function toTomatoDetections(imageData) {
  return (imageData?.detections || []).map(d => ({
    bbox: d.bbox, label: d.label, confidence: d.confidence,
  }))
}

function toFlowerDetections(imageData) {
  return (imageData?.flowers || []).map(f => ({
    bbox: { x1: f.bounding_box[0], y1: f.bounding_box[1], x2: f.bounding_box[2], y2: f.bounding_box[3] },
    label: FLOWER_STAGE_LABELS[String(f.stage)] ?? `Stage ${f.stage}`,
    confidence: f.confidence,
  }))
}

function toImgList(urls, labelPrefix, classification, detectionsFn) {
  return (urls || []).map((url, i) => ({
    src: url.startsWith('http') ? url : `${API_BASE}/api/results${url}`,
    label: `${labelPrefix} ${i + 1}`,
    detections: detectionsFn ? detectionsFn(classification?.images?.[i]) : [],
  }))
}

/* ── Delete confirm modal ── */
function DeleteModal({ mode, rowNum, onConfirm, onCancel, loading }) {
  const [input, setInput] = useState('')
  const isAllRows = mode === 'all'
  const label = isAllRows ? 'all rows' : `Row ${rowNum}`
  const ready = input.trim().toLowerCase() === 'confirm'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="page-in" style={{
        background: C.bg1,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '28px 28px 24px',
        width: 380, maxWidth: '90vw',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            🗑️
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.t1 }}>
            Delete {isAllRows ? 'All Data' : `Row ${rowNum} Data`}
          </div>
        </div>

        <p style={{ fontSize: 13, color: C.t2, marginBottom: 18, lineHeight: 1.6 }}>
          This will permanently delete all documents and images for{' '}
          <strong style={{ color: C.t1 }}>{label}</strong>.
          This action cannot be undone.
        </p>

        <label style={{ display: 'block', fontSize: 12, color: C.t2, marginBottom: 6 }}>
          Type <strong style={{ color: C.t1 }}>confirm</strong> to continue
        </label>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ready && !loading && onConfirm()}
          placeholder="confirm"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '9px 12px', borderRadius: 7,
            border: `1px solid ${input && !ready ? '#fca5a5' : C.border}`,
            fontSize: 13, fontFamily: 'inherit', color: C.t1,
            background: C.bg2, outline: 'none',
            marginBottom: 20,
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-press"
            style={{
              padding: '8px 18px', borderRadius: 7, fontSize: 13,
              border: `1px solid ${C.border}`, background: C.bg2,
              color: C.t2, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready || loading}
            className="btn-press"
            style={{
              padding: '8px 18px', borderRadius: 7, fontSize: 13,
              border: 'none', fontFamily: 'inherit',
              background: ready && !loading ? '#ef4444' : '#fca5a5',
              color: '#fff',
              cursor: ready && !loading ? 'pointer' : 'not-allowed',
              transition: 'background 0.12s ease',
            }}
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Thin horizontal progress bar with label ── */
function BreakdownBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: C.t2 }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }} className="num">{count}</span>
          <span style={{ fontSize: 10, color: C.t3 }} className="num">{pct}%</span>
        </div>
      </div>
      <div style={{ height: 4, background: C.bg3, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.35s ease' }} />
      </div>
    </div>
  )
}

/* ── Segmented row selector ── */
function RowSelector({ value, onChange }) {
  const rowOptions = getConfiguredRows()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        Row
      </span>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {rowOptions.map(r => {
          const active = value === r
          return (
            <button
              key={r}
              onClick={() => onChange(r)}
              className="btn-press"
              style={{
                width: 40, height: 40,
                borderRadius: 7,
                background: active ? C.green : C.bg3,
                color: active ? '#fff' : C.t2,
                border: active ? `1px solid ${C.green}` : `1px solid ${C.border}`,
                fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {r}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function RowDetails() {
  const [selectedRow, setSelectedRow] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [selectedTsIdx, setSelectedTsIdx] = useState(0)
  const [imageTab, setImageTab] = useState('tomatoes') // 'tomatoes' | 'flowers'
  const [depthDropdownOpen, setDepthDropdownOpen] = useState(false)

  // Delete modal state: null | 'row' | 'all'
  const [deleteMode, setDeleteMode] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      const row = deleteMode === 'row' ? selectedRow : undefined
      const res = await deleteData(row)
      setDeleteResult(res.data)
      setDeleteMode(null)
      // Reload row data after deletion
      setData(null); setSelectedIdx(0); setError(null); setLoading(true)
      getDetailedRowData(selectedRow)
        .then(r => setData(r.data))
        .catch(err => {
          if (err.response?.status === 404) setError(`No data found for Row ${selectedRow}.`)
          else setError(err.response?.data?.detail || err.message)
        })
        .finally(() => setLoading(false))
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
      setDeleteMode(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  useEffect(() => {
    setData(null); setSelectedIdx(0); setError(null); setLoading(true)
    setImageTab('tomatoes')
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

  // Active timestamp entry — falls back to top-level (latest) if all_timestamps absent
  const allTs = selected?.all_timestamps ?? []
  const activeTs = allTs[selectedTsIdx] ?? null
  const activeData = activeTs ?? selected

  /* Row-level aggregate totals */
  const rowTotals = distances.reduce((acc, d) => {
    const bc = d.tomato_classification?.summary?.by_class || {}
    acc.Ripe      += bc.Ripe      || 0
    acc.Half_Ripe += bc.Half_Ripe || 0
    acc.Unripe    += bc.Unripe    || 0
    acc.flowers   += d.flower_classification?.total_flowers || 0
    return acc
  }, { Ripe: 0, Half_Ripe: 0, Unripe: 0, flowers: 0 })

  const totalTomatoes = rowTotals.Ripe + rowTotals.Half_Ripe + rowTotals.Unripe

  /* Selected point: images — original plain + original with detections for active tab */
  const originalImages  = activeData ? toImgList(activeData.images?.original, 'Original', null, null) : []
  const activeClassification = imageTab === 'tomatoes' ? activeData?.tomato_classification : activeData?.flower_classification
  const activeDetectionsFn   = imageTab === 'tomatoes' ? toTomatoDetections : toFlowerDetections
  const annotatedImages = activeData ? toImgList(activeData.images?.original, 'Annotated', activeClassification, activeDetectionsFn) : []

  const depthAnalysis = activeData?.depth_analysis ?? null

  /* Selected point: counts — from the active timestamp */
  const selTomato = activeData?.tomato_classification?.summary?.by_class || {}
  const selTotalT = (selTomato.Ripe || 0) + (selTomato.Half_Ripe || 0) + (selTomato.Unripe || 0)
  const selFlower = activeData?.flower_classification?.stage_counts || {}
  const selTotalF = Object.values(selFlower).reduce((s, v) => s + (v || 0), 0)

  const card = { background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10 }

  return (
    <div className="page-in page-pad" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Delete confirm modal */}
      {deleteMode && (
        <DeleteModal
          mode={deleteMode}
          rowNum={selectedRow}
          onConfirm={handleDelete}
          onCancel={() => setDeleteMode(null)}
          loading={deleteLoading}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }}>Row Details</h1>
          <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Inspect classification results at each position along a row</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <RowSelector value={selectedRow} onChange={setSelectedRow} />
          {/* Delete buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setDeleteResult(null); setDeleteMode('row') }}
              className="btn-press"
              style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                border: `1px solid ${C.red}44`, background: C.redDim,
                color: C.red, cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', transition: 'background 0.12s ease, border-color 0.12s ease',
              }}
            >
              Delete Row {selectedRow}
            </button>
            <button
              onClick={() => { setDeleteResult(null); setDeleteMode('all') }}
              className="btn-press"
              style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                border: `1px solid ${C.red}44`, background: C.redDim,
                color: C.red, cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', transition: 'background 0.12s ease, border-color 0.12s ease',
              }}
            >
              Delete All
            </button>
          </div>
        </div>
      </div>

      {/* Delete success banner */}
      {deleteResult && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 8, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: '#15803d',
        }}>
          <span>
            Deleted {deleteResult.deleted_documents} document{deleteResult.deleted_documents !== 1 ? 's' : ''} and{' '}
            {deleteResult.deleted_images} image{deleteResult.deleted_images !== 1 ? 's' : ''} from {deleteResult.scope}.
          </span>
          <button onClick={() => setDeleteResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {loading && <LoadingSpinner message={`Loading row ${selectedRow} data…`} />}

      {error && !loading && (
        <div style={{
          background: C.amberDim, border: `1px solid ${C.amber}44`,
          borderRadius: 8, padding: '14px 18px', fontSize: 12, color: C.amber,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && distances.length > 0 && (
        <>
          {/* ── Row summary card ── */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Row {selectedRow} — Health Overview</div>
              <div style={{ fontSize: 11, color: C.t3 }}>
                {distances.length} location{distances.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Stacked ripeness composition bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>
                Ripeness Composition
              </div>
              {totalTomatoes > 0 ? (
                <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 1.5 }}>
                  <div style={{ width: `${(rowTotals.Ripe / totalTomatoes) * 100}%`, background: TOMATO_COLORS.Ripe, transition: 'width 0.4s ease', minWidth: rowTotals.Ripe > 0 ? 3 : 0 }} />
                  <div style={{ width: `${(rowTotals.Half_Ripe / totalTomatoes) * 100}%`, background: TOMATO_COLORS.Half_Ripe, transition: 'width 0.4s ease', minWidth: rowTotals.Half_Ripe > 0 ? 3 : 0 }} />
                  <div style={{ width: `${(rowTotals.Unripe / totalTomatoes) * 100}%`, background: TOMATO_COLORS.Unripe, transition: 'width 0.4s ease', minWidth: rowTotals.Unripe > 0 ? 3 : 0 }} />
                </div>
              ) : (
                <div style={{ height: 8, borderRadius: 4, background: C.bg3 }} />
              )}
              {/* Legend */}
              <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                {[
                  { label: 'Ripe',      color: TOMATO_COLORS.Ripe,      pct: totalTomatoes > 0 ? Math.round((rowTotals.Ripe / totalTomatoes) * 100) : 0 },
                  { label: 'Half Ripe', color: TOMATO_COLORS.Half_Ripe, pct: totalTomatoes > 0 ? Math.round((rowTotals.Half_Ripe / totalTomatoes) * 100) : 0 },
                  { label: 'Unripe',    color: TOMATO_COLORS.Unripe,    pct: totalTomatoes > 0 ? Math.round((rowTotals.Unripe / totalTomatoes) * 100) : 0 },
                ].map(({ label, color, pct }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.t2 }}>{label}</span>
                    <span style={{ fontSize: 11, color: C.t3, fontWeight: 500 }} className="num">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 stat numbers */}
            <div className="rg-4" style={{ gap: 1, background: C.border, borderRadius: 8, overflow: 'hidden', marginTop: 4 }}>
              {[
                { label: 'Ripe',      value: rowTotals.Ripe,      color: TOMATO_COLORS.Ripe },
                { label: 'Half Ripe', value: rowTotals.Half_Ripe,  color: TOMATO_COLORS.Half_Ripe },
                { label: 'Unripe',    value: rowTotals.Unripe,    color: TOMATO_COLORS.Unripe },
                { label: 'Flowers',   value: rowTotals.flowers,   color: FLOWER_COLORS['0'] },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.bg2, padding: '12px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color, letterSpacing: '-0.4px', lineHeight: 1 }} className="num">{value}</div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 5 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Row visualizer ── */}
          <RowVisualizer
            distances={distances}
            selectedIdx={selectedIdx}
            onSelect={(i) => { setSelectedIdx(i); setSelectedTsIdx(0); setImageTab('tomatoes'); setDepthDropdownOpen(false) }}
          />

          {/* ── Detail panel for selected point ── */}
          {selected && (
            <div className="rg-sidebar" style={{ gap: 12 }}>

              {/* Classification sidebar */}
              <div style={{ ...card, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Location badge */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: C.greenDim, color: C.green,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                    }}>
                      {selectedIdx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }} className="num">
                        {selected.distanceFromRowStart}m
                      </div>
                      <div style={{ fontSize: 10, color: C.t3 }}>from row start</div>
                    </div>
                  </div>
                  {/* Timestamp selector */}
                  {allTs.length > 1 ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                        Captured
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {allTs.map((entry, i) => {
                          const active = i === selectedTsIdx
                          return (
                            <button
                              key={entry.timestamp}
                              onClick={() => { setSelectedTsIdx(i); setDepthDropdownOpen(false) }}
                              className="btn-press"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 10px', borderRadius: 6, fontSize: 11,
                                background: active ? C.greenDim : 'transparent',
                                border: `1px solid ${active ? C.green + '44' : C.border}`,
                                color: active ? C.green : C.t2,
                                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                transition: 'background 0.1s ease, border-color 0.1s ease, color 0.1s ease',
                              }}
                            >
                              <span className="num">{formatTs(entry.timestamp)}</span>
                              {i === 0 && (
                                <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, marginLeft: 6, flexShrink: 0 }}>LATEST</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 6 }}>{formatTs(selected.latest_timestamp)}</div>
                  )}
                </div>

                {activeData?.tomato_classification ? (
                  <>
                    {/* Tomatoes */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                        Tomatoes
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.t1, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }} className="num">
                          {selTotalT}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'Ripe',      color: TOMATO_COLORS.Ripe,      count: selTomato.Ripe      || 0 },
                          { label: 'Half Ripe', color: TOMATO_COLORS.Half_Ripe, count: selTomato.Half_Ripe  || 0 },
                          { label: 'Unripe',    color: TOMATO_COLORS.Unripe,    count: selTomato.Unripe     || 0 },
                        ].map(p => <BreakdownBar key={p.label} {...p} total={selTotalT} />)}
                      </div>
                    </div>

                    {/* Flowers */}
                    <div style={{ paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                        Flowers
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.t1, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }} className="num">
                          {selTotalF}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'Bud',          color: FLOWER_COLORS['0'], count: selFlower['0'] || 0 },
                          { label: 'Anthesis',      color: FLOWER_COLORS['1'], count: selFlower['1'] || 0 },
                          { label: 'Post-Anthesis', color: FLOWER_COLORS['2'], count: selFlower['2'] || 0 },
                        ].map(p => <BreakdownBar key={p.label} {...p} total={selTotalF} />)}
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: C.t3 }}>No classification data for this timestamp</p>
                )}
              </div>

              {/* Images panel */}
              <div style={{ ...card, overflow: 'hidden' }}>
                {/* Tab strip */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
                  {[
                    { id: 'tomatoes', label: 'Tomatoes' },
                    { id: 'flowers',  label: 'Flowers' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setImageTab(tab.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'inherit', padding: '11px 18px',
                        fontSize: 13, fontWeight: imageTab === tab.id ? 500 : 400,
                        color: imageTab === tab.id ? C.t1 : C.t2,
                        borderBottom: imageTab === tab.id ? `2px solid ${C.green}` : '2px solid transparent',
                        marginBottom: -1,
                        transition: 'color 0.12s',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Image content */}
                <div style={{ padding: '18px 20px' }}>
                  <div className={originalImages.length > 0 ? 'rg-2' : ''} style={{ gap: 20 }}>
                    {originalImages.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Original</div>
                        <ImageGallery images={originalImages} emptyMessage="No images" />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Annotated</div>
                      {activeClassification
                        ? <ImageGallery images={annotatedImages} emptyMessage="No annotated images" />
                        : (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: 192, borderRadius: 8,
                            border: `1px dashed ${C.border2}`,
                            background: C.bg2,
                          }}>
                            <span style={{ fontSize: 12, color: C.t3, fontStyle: 'italic' }}>Classification on-going…</span>
                          </div>
                        )
                      }
                    </div>
                  </div>

                  {/* Volume & Weight dropdown — only for tomato tab with depth data */}
                  {imageTab === 'tomatoes' && depthAnalysis && (
                    <div style={{ marginTop: 16, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      <button
                        onClick={() => setDepthDropdownOpen(o => !o)}
                        className="btn-press"
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', background: C.bg2, border: 'none', cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Volume & Weight</span>
                          <span style={{
                            fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 10,
                            background: depthAnalysis.depth_enabled ? C.greenDim : C.bg3,
                            color: depthAnalysis.depth_enabled ? C.green : C.t3,
                            border: `1px solid ${depthAnalysis.depth_enabled ? C.green + '33' : C.border}`,
                          }}>
                            {depthAnalysis.depth_enabled ? 'depth enabled' : 'segmentation only'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {depthAnalysis.depth_enabled && (() => {
                            const totalG = depthAnalysis.tomatoes?.reduce((s, t) => s + (t.weight_g ?? 0), 0) ?? 0
                            return (
                              <span style={{ fontSize: 11, color: C.t2 }} className="num">
                                {depthAnalysis.total} tomato{depthAnalysis.total !== 1 ? 's' : ''} · {totalG.toFixed(1)}g total
                              </span>
                            )
                          })()}
                          <span style={{
                            fontSize: 14, color: C.t3, lineHeight: 1,
                            transform: depthDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            display: 'inline-block',
                          }}>▾</span>
                        </div>
                      </button>

                      {depthDropdownOpen && (
                        <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}` }}>
                          {!depthAnalysis.depth_enabled && (
                            <p style={{ fontSize: 11, color: C.t3, marginBottom: 10 }}>
                              Segmentation only — no depth intrinsics provided. Upload with fx, fy, and depth_scale for volume estimates.
                            </p>
                          )}
                          {/* Header row */}
                          <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 54px 64px 64px 70px 64px',
                            gap: 4, marginBottom: 6, padding: '0 6px',
                          }}>
                            {['Label', 'Conf', 'Depth', 'Radius', 'Volume', 'Weight'].map(h => (
                              <span key={h} style={{ fontSize: 10, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {(depthAnalysis.tomatoes || []).map((t, i) => (
                              <div key={i} style={{
                                display: 'grid', gridTemplateColumns: '1fr 54px 64px 64px 70px 64px',
                                gap: 4, padding: '5px 6px', borderRadius: 6,
                                background: i % 2 === 0 ? C.bg2 : 'transparent',
                                alignItems: 'center',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: TOMATO_COLORS[t.label] ?? C.t3, flexShrink: 0 }} />
                                  <span style={{ fontSize: 11, color: C.t1, fontWeight: 500 }}>{t.label}</span>
                                </div>
                                <span style={{ fontSize: 11, color: C.t2 }} className="num">{Math.round((t.confidence ?? 0) * 100)}%</span>
                                <span style={{ fontSize: 11, color: C.t2 }} className="num">
                                  {t.depth_mm != null ? `${Math.round(t.depth_mm)}mm` : '—'}
                                </span>
                                <span style={{ fontSize: 11, color: C.t2 }} className="num">
                                  {t.radius_cm != null ? `${t.radius_cm.toFixed(2)}cm` : t.radius_px != null ? `${Math.round(t.radius_px)}px` : '—'}
                                </span>
                                <span style={{ fontSize: 11, color: C.t2 }} className="num">
                                  {t.volume_cm3 != null ? `${t.volume_cm3.toFixed(2)}cm³` : '—'}
                                </span>
                                <span style={{ fontSize: 11, color: C.t2 }} className="num">
                                  {t.weight_g != null ? `${t.weight_g.toFixed(2)}g` : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !error && distances.length === 0 && !error && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 24px', background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          <div style={{ fontSize: 24, marginBottom: 12, opacity: 0.3 }}>🌱</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.t2, marginBottom: 6 }}>No data for Row {selectedRow}</div>
          <div style={{ fontSize: 12, color: C.t3 }}>Upload and classify images for this row to see details here.</div>
        </div>
      )}
    </div>
  )
}
