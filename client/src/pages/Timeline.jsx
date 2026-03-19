import { useState, useEffect, useRef, useCallback } from 'react'
import { getAllData, API_BASE } from '../api/index.js'
import { C, TOMATO_COLORS, FLOWER_COLORS } from '../tokens'
import ImageModal from '../components/ImageModal'
import AnnotatedImage from '../components/AnnotatedImage'
import StatCard from '../components/StatCard'
import { useSettings } from '../context/SettingsContext'

const POLL_MS          = 20_000
const NEW_HIGHLIGHT_MS = 5_000
const AVG_TOMATO_KG    = 0.15

const FLOWER_LABELS = { '0': 'Bud', '1': 'Anthesis', '2': 'Post-Anthesis' }

function imgSrc(path) {
  return `${API_BASE}/api/results${path}`
}

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function flattenEntries(documents) {
  const entries = []
  for (const doc of documents) {
    for (const run of (doc.runs || [])) {
      entries.push({
        id: `${doc.greenhouse_row}__${doc.distanceFromRowStart}__${run.timestamp}`,
        greenhouse_row: doc.greenhouse_row,
        distanceFromRowStart: doc.distanceFromRowStart,
        timestamp: run.timestamp,
        tomato_classification: run.tomato_classification,
        flower_classification: run.flower_classification,
        images: run.images,
      })
    }
  }
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/* ── segmented composition bar ── */
function SegBar({ segments, total }) {
  if (!total) return (
    <div style={{ height: 6, borderRadius: 3, background: C.bg3 }} />
  )
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1.5 }}>
      {segments.map(({ color, value }) =>
        value > 0 ? (
          <div
            key={color}
            style={{ width: `${(value / total) * 100}%`, background: color, minWidth: 3, transition: 'width 0.3s ease' }}
          />
        ) : null
      )}
    </div>
  )
}

/* ── one labelled row for a stat breakdown ── */
function StatRow({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: C.t2 }}>{label}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.t1 }} className="num">{count}</span>
          <span style={{ fontSize: 10, color: C.t3 }} className="num">{pct}%</span>
        </div>
      </div>
      <div style={{ height: 3, background: C.bg3, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.35s ease' }} />
      </div>
    </div>
  )
}

/* ── clickable image thumbnail ── */
function Thumb({ src, label, onClick, detections = [] }) {
  const [hovered, setHovered] = useState(false)
  const imgStyle = {
    height: 110, width: 'auto', borderRadius: 7,
    border: `1.5px solid ${hovered ? C.green : C.border}`,
    objectFit: 'cover', display: 'block',
    transition: 'border-color 0.15s',
    boxShadow: hovered ? `0 2px 12px ${C.green}33` : 'none',
  }
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ flexShrink: 0, cursor: 'pointer' }}
    >
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <AnnotatedImage
          src={imgSrc(src)}
          alt={label}
          detections={detections}
          imgStyle={imgStyle}
        />
        {/* hover overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 7,
          background: hovered ? 'rgba(0,0,0,0.18)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
          pointerEvents: 'none',
        }}>
          {hovered && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          )}
        </div>
      </div>
      <p style={{ fontSize: 10, color: C.t3, marginTop: 4, textAlign: 'center' }}>{label}</p>
    </div>
  )
}

/* ── single timeline entry card ── */
function TimelineEntry({ entry, isNew }) {
  const [showImages, setShowImages] = useState(false)
  const [modalImage, setModalImage]  = useState(null)

  const tc = entry.tomato_classification
  const fc = entry.flower_classification
  const bc = tc?.summary?.by_class ?? {}
  const sc = fc?.stage_counts ?? {}
  const tomatoTotal = tc?.summary?.total ?? 0
  const flowerTotal = fc?.total_flowers ?? 0

  /* Estimated yield */
  const estimatedYield = (
    (bc.Ripe || 0) * AVG_TOMATO_KG +
    (bc.Half_Ripe || 0) * 0.8 * AVG_TOMATO_KG +
    (bc.Unripe || 0) * 0.5 * AVG_TOMATO_KG
  ).toFixed(2)

  /* Build per-image detection lists for the modal */
  function tomatoDetectionsForImage(i) {
    return (tc?.images?.[i]?.detections || []).map(d => ({
      bbox: d.bbox, label: d.label, confidence: d.confidence,
    }))
  }

  function flowerDetectionsForImage(i) {
    return (fc?.images?.[i]?.flowers || []).map(f => ({
      bbox: { x1: f.bounding_box[0], y1: f.bounding_box[1], x2: f.bounding_box[2], y2: f.bounding_box[3] },
      label: FLOWER_LABELS[String(f.stage)] ?? `Stage ${f.stage}`,
      confidence: f.confidence,
    }))
  }

  const imgCount = entry.images?.original?.length ?? 0
  const hasImages = imgCount > 0

  function openModal(src, label, detections) {
    setModalImage({ src: imgSrc(src), label, detections })
  }

  return (
    <>
      {modalImage && (
        <ImageModal image={modalImage} onClose={() => setModalImage(null)} />
      )}

      <div style={{ position: 'relative', marginBottom: 14 }}>
        {/* Spine dot */}
        <div style={{
          position: 'absolute', left: -28, top: 17,
          width: 12, height: 12, borderRadius: '50%',
          background: isNew ? C.green : C.bg4,
          border: `2px solid ${isNew ? C.green : C.border2}`,
          boxShadow: isNew ? `0 0 0 4px ${C.greenDim}` : 'none',
          zIndex: 1, transition: 'background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease',
        }} />

        <div style={{
          background: C.bg1,
          border: `1px solid ${isNew ? C.green + '55' : C.border}`,
          borderRadius: 10, overflow: 'hidden',
          transition: 'border-color 0.4s ease',
        }}>

          {/* ── Header ── */}
          <div style={{
            padding: '12px 16px 10px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {isNew && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: C.green, background: C.greenDim, padding: '2px 7px', borderRadius: 99,
                }}>New</span>
              )}
              <span style={{
                fontSize: 11, fontWeight: 600, color: C.green,
                background: C.greenDim, padding: '2px 9px', borderRadius: 99,
              }}>
                Row {entry.greenhouse_row}
              </span>
              <span style={{ fontSize: 11, color: C.t3 }} className="num">
                {entry.distanceFromRowStart}m from start
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>{formatTs(entry.timestamp)}</span>
              <span style={{ fontSize: 11, color: C.t3 }}>· {timeAgo(entry.timestamp)}</span>
            </div>
          </div>

          {/* ── Stats body ── */}
          {(tc || fc) ? (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tc && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.t3, flexShrink: 0, minWidth: 70 }}>
                    Tomatoes · <span style={{ fontWeight: 600, color: C.t1 }} className="num">{tomatoTotal}</span>
                  </span>
                  <div style={{ flex: 1 }}>
                    <SegBar
                      total={tomatoTotal}
                      segments={[
                        { color: C.ripe,     value: bc.Ripe      || 0 },
                        { color: C.halfRipe, value: bc.Half_Ripe || 0 },
                        { color: C.unripe,   value: bc.Unripe    || 0 },
                      ]}
                    />
                  </div>
                </div>
              )}
              {fc && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.t3, flexShrink: 0, minWidth: 70 }}>
                    Flowers · <span style={{ fontWeight: 600, color: C.t1 }} className="num">{flowerTotal}</span>
                  </span>
                  <div style={{ flex: 1 }}>
                    <SegBar
                      total={flowerTotal}
                      segments={[
                        { color: C.flower0, value: sc['0'] || 0 },
                        { color: C.flower1, value: sc['1'] || 0 },
                        { color: C.flower2, value: sc['2'] || 0 },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '12px 16px' }}>
              <span style={{ fontSize: 12, color: C.t3, fontStyle: 'italic' }}>Classification pending</span>
            </div>
          )}

          {/* ── Images section ── */}
          {hasImages && (
            <>
              <button
                onClick={() => setShowImages(s => !s)}
                style={{
                  width: '100%', padding: '8px 16px',
                  background: C.bg2, border: 'none', borderTop: `1px solid ${C.border}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 11, color: C.t3, fontWeight: 500,
                }}
              >
                <span>
                  {showImages ? 'Hide images' : `Show images · ${imgCount} set${imgCount !== 1 ? 's' : ''}`}
                </span>
                <span style={{ fontSize: 10 }}>{showImages ? '▲' : '▼'}</span>
              </button>

              {showImages && (
                <div className="img-reveal" style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Array.from({ length: imgCount }, (_, i) => {
                    const origPath = entry.images.original?.[i]
                    if (!origPath) return null

                    return (
                      <div key={i}>
                        {imgCount > 1 && (
                          <p style={{
                            fontSize: 10, fontWeight: 700, color: C.t2,
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
                          }}>Image {i + 1}</p>
                        )}
                        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                          <Thumb
                            src={origPath}
                            label="Tomato Detection"
                            detections={tomatoDetectionsForImage(i)}
                            onClick={() => openModal(origPath, `Tomato · Row ${entry.greenhouse_row} · ${entry.distanceFromRowStart}m`, tomatoDetectionsForImage(i))}
                          />
                          <Thumb
                            src={origPath}
                            label="Flower Detection"
                            detections={flowerDetectionsForImage(i)}
                            onClick={() => openModal(origPath, `Flower · Row ${entry.greenhouse_row} · ${entry.distanceFromRowStart}m`, flowerDetectionsForImage(i))}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

/* ── main page ── */
export default function Timeline() {
  const { settings } = useSettings()
  const [entries, setEntries] = useState([])
  const [pending, setPending] = useState([])
  const [newIds,  setNewIds]  = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const seenIdsRef    = useRef(new Set())
  const highlightTimer = useRef(null)

  const fetchAll = useCallback(async ({ initial = false } = {}) => {
    try {
      const res   = await getAllData()
      const fresh = flattenEntries(res.data.documents)

      if (initial) {
        seenIdsRef.current = new Set(fresh.map(e => e.id))
        setEntries(fresh)
        setPending([])
        setError(null)
        setLoading(false)
      } else {
        const unseen = fresh.filter(e => !seenIdsRef.current.has(e.id))
        if (unseen.length > 0) setPending(unseen)
      }
    } catch (e) {
      if (initial) {
        setError(e.message || 'Failed to load data')
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => { fetchAll({ initial: true }) }, [fetchAll])

  useEffect(() => {
    if (!settings.autoRefresh) return
    const t = setInterval(() => fetchAll({ initial: false }), POLL_MS)
    return () => clearInterval(t)
  }, [fetchAll, settings.autoRefresh])

  function showPending() {
    const ids = new Set(pending.map(e => e.id))
    pending.forEach(e => seenIdsRef.current.add(e.id))
    setEntries(prev => [...pending, ...prev])
    setPending([])
    setNewIds(ids)
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setNewIds(new Set()), NEW_HIGHLIGHT_MS)
  }

  const totalTomatoes   = entries.reduce((s, e) => s + (e.tomato_classification?.summary?.total        ?? 0), 0)
  const totalFlowers    = entries.reduce((s, e) => s + (e.flower_classification?.total_flowers         ?? 0), 0)
  const totalYield      = entries.reduce((s, e) => {
    const bc = e.tomato_classification?.summary?.by_class ?? {}
    return s + ((bc.Ripe || 0) + (bc.Half_Ripe || 0) * 0.8 + (bc.Unripe || 0) * 0.5) * AVG_TOMATO_KG
  }, 0)
  const totalRipe       = entries.reduce((s, e) => s + (e.tomato_classification?.summary?.by_class?.Ripe      ?? 0), 0)
  const totalHalfRipe   = entries.reduce((s, e) => s + (e.tomato_classification?.summary?.by_class?.Half_Ripe ?? 0), 0)
  const totalUnripe     = entries.reduce((s, e) => s + (e.tomato_classification?.summary?.by_class?.Unripe    ?? 0), 0)
  const totalStage0     = entries.reduce((s, e) => s + (e.flower_classification?.stage_counts?.['0'] ?? 0), 0)
  const totalStage1     = entries.reduce((s, e) => s + (e.flower_classification?.stage_counts?.['1'] ?? 0), 0)
  const totalStage2     = entries.reduce((s, e) => s + (e.flower_classification?.stage_counts?.['2'] ?? 0), 0)
  const uniqueRows      = new Set(entries.map(e => e.greenhouse_row)).size
  const harvestReadyPct = totalTomatoes > 0 ? Math.round((totalRipe / totalTomatoes) * 100) : 0

  return (
    <div
      className="page-in page-pad"
      style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px', margin: 0 }}>Timeline</h1>
          <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
            All classification events · most recent first
            {settings.autoRefresh ? ' · auto-refreshes every 20s' : ' · auto-refresh off'}
          </p>
        </div>
        <button
          onClick={() => fetchAll({ initial: true })}
          disabled={loading}
          style={{
            padding: '7px 14px', background: C.green, color: '#fff',
            fontSize: 12, fontWeight: 500, borderRadius: 7, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* KPI chips */}
      {!loading && entries.length > 0 && (
        <div className="rg-4" style={{ gap: 10 }}>
          {/* Events */}
          <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>Events</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: C.t1, letterSpacing: '-0.4px', lineHeight: 1 }} className="num">{entries.length}</div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 5 }}>across {uniqueRows} row{uniqueRows !== 1 ? 's' : ''}</div>
          </div>

          {/* Tomatoes */}
          <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>Tomatoes</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: C.t1, letterSpacing: '-0.4px', lineHeight: 1 }} className="num">{totalTomatoes.toLocaleString()}</div>
            {totalTomatoes > 0 && (
              <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1, marginTop: 10 }}>
                {[{ c: TOMATO_COLORS.Ripe, v: totalRipe }, { c: TOMATO_COLORS.Half_Ripe, v: totalHalfRipe }, { c: TOMATO_COLORS.Unripe, v: totalUnripe }].map(({ c, v }) =>
                  v > 0 ? <div key={c} style={{ width: `${(v / totalTomatoes) * 100}%`, background: c, minWidth: 3 }} /> : null
                )}
              </div>
            )}
          </div>

          {/* Flowers */}
          <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>Flowers</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: C.t1, letterSpacing: '-0.4px', lineHeight: 1 }} className="num">{totalFlowers.toLocaleString()}</div>
            {totalFlowers > 0 && (
              <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1, marginTop: 10 }}>
                {[{ c: FLOWER_COLORS['0'], v: totalStage0 }, { c: FLOWER_COLORS['1'], v: totalStage1 }, { c: FLOWER_COLORS['2'], v: totalStage2 }].map(({ c, v }) =>
                  v > 0 ? <div key={c} style={{ width: `${(v / totalFlowers) * 100}%`, background: c, minWidth: 3 }} /> : null
                )}
              </div>
            )}
          </div>

          {/* Yield */}
          <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>Est. Yield</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: C.green, letterSpacing: '-0.4px', lineHeight: 1 }} className="num">{totalYield.toFixed(1)} kg</div>
            {harvestReadyPct > 0 && (
              <div style={{ fontSize: 11, color: C.t3, marginTop: 5 }}>
                <span style={{ fontWeight: 600, color: C.green }} className="num">{harvestReadyPct}%</span> harvest-ready
              </div>
            )}
          </div>
        </div>
      )}

      {/* New-entry banner */}
      {pending.length > 0 && (
        <button
          onClick={showPending}
          style={{
            width: '100%', padding: '11px 18px',
            background: C.green, color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>↑</span>
          <span>{pending.length} new {pending.length === 1 ? 'entry' : 'entries'} · click to show</span>
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, gap: 10 }}>
          <svg style={{ width: 22, height: 22, animation: 'spin 1s linear infinite', color: C.green }} fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span style={{ fontSize: 13, color: C.t2 }}>Loading timeline…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: C.redDim, border: `1px solid ${C.unripe}44`, borderRadius: 10, padding: '14px 16px', color: C.unripe, fontSize: 13 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          <div style={{ fontSize: 28, opacity: 0.25, marginBottom: 12 }}>🌱</div>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.t2, margin: 0 }}>No events yet</p>
          <p style={{ fontSize: 12, color: C.t3, marginTop: 6 }}>Upload and classify images to see the timeline here.</p>
        </div>
      )}

      {/* Timeline feed */}
      {!loading && !error && entries.length > 0 && (
        <div style={{ position: 'relative', paddingLeft: 40 }}>
          {/* Vertical spine */}
          <div style={{
            position: 'absolute', left: 19, top: 0, bottom: 0,
            width: 2, background: C.border, borderRadius: 1,
          }} />

          {entries.map(entry => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isNew={newIds.has(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
