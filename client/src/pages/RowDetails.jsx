import { useState, useEffect } from 'react'
import { getDetailedRowData, API_BASE } from '../api'
import RowVisualizer from '../components/RowVisualizer'
import ImageGallery from '../components/ImageGallery'
import LoadingSpinner from '../components/LoadingSpinner'
import { C, TOMATO_COLORS, FLOWER_COLORS, FLOWER_LABELS } from '../tokens'

const ROW_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)
const FLOWER_STAGE_LABELS = FLOWER_LABELS

function formatTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function toTomatoDetections(classification) {
  return (classification?.detections || []).map(d => ({
    bbox: d.bbox, label: d.label, confidence: d.confidence,
  }))
}

function toFlowerDetections(classification) {
  return (classification?.flowers || []).map(f => ({
    bbox: { x1: f.bounding_box[0], y1: f.bounding_box[1], x2: f.bounding_box[2], y2: f.bounding_box[3] },
    label: FLOWER_STAGE_LABELS[String(f.stage)] ?? `Stage ${f.stage}`,
    confidence: f.confidence,
  }))
}

function toImgList(urls, labelPrefix, detections = []) {
  return (urls || []).map((url, i) => ({
    src: url.startsWith('http') ? url : `${API_BASE}/api/results${url}`,
    label: `${labelPrefix} ${i + 1}`,
    detections,
  }))
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        Row
      </span>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {ROW_OPTIONS.map(r => {
          const active = value === r
          return (
            <button
              key={r}
              onClick={() => onChange(r)}
              style={{
                width: 30, height: 30,
                borderRadius: 7,
                background: active ? C.green : C.bg3,
                color: active ? '#fff' : C.t2,
                border: active ? `1px solid ${C.green}` : `1px solid ${C.border}`,
                fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.12s, color 0.12s',
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
  const [imageTab, setImageTab] = useState('tomatoes') // 'tomatoes' | 'flowers'

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

  /* Selected point: images */
  const tomatoDetections = toTomatoDetections(selected?.tomato_classification)
  const flowerDetections  = toFlowerDetections(selected?.flower_classification)
  const originalImages        = selected ? toImgList(selected.images?.original,        'Original',  [])               : []
  const tomatoAnnotatedImages = selected ? toImgList(selected.images?.tomato_annotated, 'Annotated', tomatoDetections) : []
  const flowerAnnotatedImages = selected ? toImgList(selected.images?.flower_annotated, 'Annotated', flowerDetections) : []

  /* Selected point: counts */
  const selTomato = selected?.tomato_classification?.summary?.by_class || {}
  const selTotalT = (selTomato.Ripe || 0) + (selTomato.Half_Ripe || 0) + (selTomato.Unripe || 0)
  const selFlower = selected?.flower_classification?.stage_counts || {}
  const selTotalF = Object.values(selFlower).reduce((s, v) => s + (v || 0), 0)

  const card = { background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10 }

  return (
    <div className="page-in page-pad" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }}>Row Details</h1>
          <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Inspect classification results at each position along a row</p>
        </div>
        <RowSelector value={selectedRow} onChange={setSelectedRow} />
      </div>

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
            onSelect={(i) => { setSelectedIdx(i); setImageTab('tomatoes') }}
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
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 6, paddingLeft: 0 }}>{formatTs(selected.latest_timestamp)}</div>
                </div>

                {selected.tomato_classification ? (
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
                  <p style={{ fontSize: 12, color: C.t3 }}>Not yet classified</p>
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
                      <ImageGallery
                        images={imageTab === 'tomatoes' ? tomatoAnnotatedImages : flowerAnnotatedImages}
                        emptyMessage="No annotated images"
                      />
                    </div>
                  </div>
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
