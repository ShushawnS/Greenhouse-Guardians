import { useEffect, useState, useMemo } from 'react'
import { getAllData } from '../api/index.js'
import { C } from '../tokens'

const RESULT_BASE = 'http://localhost:8003'
function imgSrc(path) { return `${RESULT_BASE}${path}` }

/* ── tiny badge ──────────────────────────────────────────────── */
function Badge({ label, value, color, dimColor }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      background: dimColor, color,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}: <span className="num">{value}</span>
    </span>
  )
}

/* ── mini composition bar ────────────────────────────────────── */
function MiniBar({ ripe = 0, half = 0, unripe = 0 }) {
  const total = ripe + half + unripe
  if (total === 0) return null
  const segs = [
    { v: ripe,   color: C.ripe },
    { v: half,   color: C.halfRipe },
    { v: unripe, color: C.unripe },
  ]
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1, width: 64, flexShrink: 0 }}>
      {segs.map((s, i) => s.v > 0 && (
        <div key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  )
}

/* ── stat row for a run ──────────────────────────────────────── */
function TomatoStats({ cls }) {
  if (!cls) return <span style={{ fontSize: 12, color: C.t3, fontStyle: 'italic' }}>No tomato data</span>
  const { by_class = {}, total = 0 } = cls.summary ?? {}
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: C.t2, fontWeight: 500 }}>Tomatoes ({total}):</span>
      <Badge label="Ripe"   value={by_class.Ripe     ?? 0} color={C.ripe}     dimColor={C.ripeDim} />
      <Badge label="Half"   value={by_class.Half_Ripe ?? 0} color={C.halfRipe} dimColor={C.halfRipeDim} />
      <Badge label="Unripe" value={by_class.Unripe    ?? 0} color={C.unripe}   dimColor={C.unripeDim} />
    </div>
  )
}

function FlowerStats({ cls }) {
  if (!cls) return <span style={{ fontSize: 12, color: C.t3, fontStyle: 'italic' }}>No flower data</span>
  const { stage_counts = {}, total_flowers = 0 } = cls
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: C.t2, fontWeight: 500 }}>Flowers ({total_flowers}):</span>
      <Badge label="Bud"           value={stage_counts['0'] ?? 0} color={C.flower0} dimColor={C.flower0Dim} />
      <Badge label="Anthesis"      value={stage_counts['1'] ?? 0} color={C.flower1} dimColor={C.flower1Dim} />
      <Badge label="Post-Anthesis" value={stage_counts['2'] ?? 0} color={C.flower2} dimColor={C.flower2Dim} />
    </div>
  )
}

/* ── individual run card ─────────────────────────────────────── */
function RunCard({ run, index }) {
  const [open, setOpen] = useState(index === 0)
  const hasImages = run.images.original.length > 0 || run.images.tomato_annotated.length > 0 || run.images.flower_annotated.length > 0

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg1, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background 0.12s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = C.bg2}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#fff', background: C.green,
            borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{index + 1}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{run.timestamp}</span>
          {!run.tomato_classification && !run.flower_classification && (
            <span style={{ fontSize: 11, color: C.amber, fontStyle: 'italic' }}>classification pending</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: C.t3 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '12px 0' }}>
            <TomatoStats cls={run.tomato_classification} />
            <FlowerStats cls={run.flower_classification} />
          </div>

          {hasImages ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {run.images.original.length > 0
                ? run.images.original.map((origPath, i) => (
                  <div key={i} style={{ background: C.bg2, borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Image {i + 1}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                      {[
                        { src: origPath,                           label: 'Original',         border: C.border },
                        { src: run.images.tomato_annotated[i],     label: 'Tomato Detection', border: C.ripe + '44' },
                        { src: run.images.flower_annotated[i],     label: 'Flower Detection', border: C.flower1 + '44' },
                      ].filter(x => x.src).map(({ src, label, border }) => (
                        <div key={label}>
                          <p style={{ fontSize: 11, color: C.t3, marginBottom: 4 }}>{label}</p>
                          <img src={imgSrc(src)} alt={label}
                            style={{ height: 160, width: 'auto', borderRadius: 8, border: `1px solid ${border}`, objectFit: 'cover' }}
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
                : (
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
                      { paths: run.images.tomato_annotated, label: 'Tomato Annotated', border: C.ripe + '44' },
                      { paths: run.images.flower_annotated, label: 'Flower Annotated', border: C.flower1 + '44' },
                    ].filter(x => x.paths?.length).map(({ paths, label, border }) => (
                      <div key={label}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {paths.map((p, i) => (
                            <img key={i} src={imgSrc(p)} alt={`${label} ${i + 1}`}
                              style={{ height: 144, width: 'auto', borderRadius: 8, border: `1px solid ${border}`, objectFit: 'cover' }}
                              onError={e => { e.target.style.display = 'none' }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          ) : (
            <p style={{ fontSize: 12, color: C.t3, fontStyle: 'italic' }}>No images stored for this run</p>
          )}

          {/* Raw detections */}
          {[
            { data: run.tomato_classification?.detections, label: 'tomato', render: (d, i) => `[${i}] ${d.label} (${(d.confidence * 100).toFixed(1)}%) — bbox: ${JSON.stringify(d.bbox)}` },
            { data: run.flower_classification?.flowers,    label: 'flower', render: (f, i) => `[${i}] Stage ${f.stage} (${(f.confidence * 100).toFixed(1)}%) — bbox: [${f.bounding_box?.join(', ')}]` },
          ].filter(x => x.data?.length).map(({ data, label, render }) => (
            <details key={label} style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 12, color: C.t2, fontWeight: 500, cursor: 'pointer' }}>
                Raw {label} detections ({data.length})
              </summary>
              <div style={{ marginTop: 6, maxHeight: 140, overflowY: 'auto', background: C.bg2, borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: C.t2 }}>
                {data.map((d, i) => <div key={i}>{render(d, i)}</div>)}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── location card ───────────────────────────────────────────── */
function LocationCard({ doc, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  // aggregate tomato counts across all runs for the mini bar
  const tomatoTotals = useMemo(() => {
    let ripe = 0, half = 0, unripe = 0
    doc.runs.forEach(r => {
      ripe   += r.tomato_classification?.summary?.by_class?.Ripe      ?? 0
      half   += r.tomato_classification?.summary?.by_class?.Half_Ripe ?? 0
      unripe += r.tomato_classification?.summary?.by_class?.Unripe    ?? 0
    })
    return { ripe, half, unripe }
  }, [doc.runs])

  const totalTomatoes = tomatoTotals.ripe + tomatoTotals.half + tomatoTotals.unripe
  const totalFlowers  = doc.runs.reduce((s, r) => s + (r.flower_classification?.total_flowers ?? 0), 0)

  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: C.bg2, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        borderBottom: open ? `1px solid ${C.border}` : 'none', transition: 'background 0.12s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = C.bg3}
        onMouseLeave={e => e.currentTarget.style.background = C.bg2}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Row {doc.greenhouse_row}</span>
          <span style={{ color: C.border2 }}>·</span>
          <span style={{ fontSize: 13, color: C.t2 }} className="num">{doc.distanceFromRowStart} m</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.greenDim, padding: '2px 8px', borderRadius: 99 }}>
            {doc.runs.length} run{doc.runs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Right side: quick stats + mini bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {totalTomatoes > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: C.t3 }} className="num">{totalTomatoes} 🍅</span>
              <MiniBar {...tomatoTotals} />
            </div>
          )}
          {totalFlowers > 0 && (
            <span style={{ fontSize: 11, color: C.t3 }} className="num">{totalFlowers} 🌸</span>
          )}
          <span style={{ fontSize: 11, color: C.t3 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {doc.runs.length === 0
            ? <p style={{ fontSize: 13, color: C.t3, fontStyle: 'italic' }}>No runs recorded yet.</p>
            : doc.runs.map((run, i) => <RunCard key={run.timestamp} run={run} index={i} />)
          }
        </div>
      )}
    </div>
  )
}

/* ── summary stat chip ───────────────────────────────────────── */
function SummaryChip({ label, value, color }) {
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: color || C.t1, letterSpacing: '-0.5px' }} className="num">{value.toLocaleString()}</span>
    </div>
  )
}

/* ── main page ───────────────────────────────────────────────── */
export default function AyushTesting() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState('row')   // 'row' | 'distance' | 'recent'
  const [allOpen, setAllOpen] = useState(true)
  const [openKey, setOpenKey] = useState(0) // bump to reset open state

  const load = async () => {
    setLoading(true); setError(null)
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

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.filter(doc => {
      if (!filter) return true
      const q = filter.toLowerCase()
      return String(doc.greenhouse_row).includes(q) || String(doc.distanceFromRowStart).includes(q)
    })
    if (sort === 'row')      list = [...list].sort((a, b) => a.greenhouse_row - b.greenhouse_row || a.distanceFromRowStart - b.distanceFromRowStart)
    if (sort === 'distance') list = [...list].sort((a, b) => a.distanceFromRowStart - b.distanceFromRowStart)
    if (sort === 'recent')   list = [...list].sort((a, b) => {
      const latestA = a.runs[0]?.timestamp ?? ''
      const latestB = b.runs[0]?.timestamp ?? ''
      return latestB.localeCompare(latestA)
    })
    return list
  }, [data, filter, sort])

  // aggregate summary stats
  const stats = useMemo(() => {
    if (!data) return null
    let locations = data.length
    let runs = 0, tomatoes = 0, flowers = 0
    data.forEach(doc => {
      runs += doc.runs.length
      doc.runs.forEach(r => {
        tomatoes += r.tomato_classification?.summary?.total ?? 0
        flowers  += r.flower_classification?.total_flowers  ?? 0
      })
    })
    return { locations, runs, tomatoes, flowers }
  }, [data])

  const toggleAll = () => {
    setAllOpen(o => !o)
    setOpenKey(k => k + 1)
  }

  return (
    <div className="page-in" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, letterSpacing: '-0.4px', margin: 0 }}>Raw Data</h1>
          <p style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Every location and run — with images and ML results</p>
        </div>
        <button onClick={load} disabled={loading} style={{
          padding: '7px 16px', background: C.green, color: '#fff',
          fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          fontFamily: 'inherit', transition: 'opacity 0.15s',
        }}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Summary chips */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <SummaryChip label="Locations"  value={stats.locations} />
          <SummaryChip label="Total Runs" value={stats.runs} />
          <SummaryChip label="Tomatoes Detected" value={stats.tomatoes} color={C.ripe} />
          <SummaryChip label="Flowers Detected"  value={stats.flowers}  color={C.flower1} />
        </div>
      )}

      {/* Toolbar: filter + sort + expand/collapse */}
      {data && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Filter input */}
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <input
              type="text"
              placeholder="Filter by row or distance…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                padding: '7px 12px', paddingRight: filter ? 28 : 12,
                fontSize: 13, color: C.t1, background: C.bg1,
                border: `1px solid ${C.border}`, borderRadius: 8,
                outline: 'none', width: 240, fontFamily: 'inherit', transition: 'border-color 0.14s',
              }}
              onFocus={e => e.target.style.borderColor = C.green}
              onBlur={e => e.target.style.borderColor = C.border}
            />
            {filter && (
              <button onClick={() => setFilter('')} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: C.t3,
                fontSize: 14, lineHeight: 1, padding: 0, fontFamily: 'inherit',
              }}>×</button>
            )}
          </div>

          <span style={{ fontSize: 12, color: C.t3 }}>
            {filtered.length} of {data.length} location{data.length !== 1 ? 's' : ''}
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Sort control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
            <div style={{ display: 'flex', gap: 2, background: C.bg3, borderRadius: 7, padding: 2 }}>
              {[['row', 'By Row'], ['distance', 'Distance'], ['recent', 'Recent']].map(([val, lbl]) => (
                <button key={val} onClick={() => setSort(val)} style={{
                  padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  background: sort === val ? C.bg1 : 'transparent',
                  color: sort === val ? C.t1 : C.t3,
                  boxShadow: sort === val ? '0 1px 3px rgba(28,25,23,0.08)' : 'none',
                  transition: 'all 0.12s',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Expand / collapse all */}
          <button onClick={toggleAll} style={{
            padding: '5px 12px', background: C.bg1, border: `1px solid ${C.border}`,
            borderRadius: 7, fontSize: 12, fontWeight: 500, color: C.t2,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = C.bg2}
            onMouseLeave={e => e.currentTarget.style.background = C.bg1}
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 192, gap: 12 }}>
          <svg style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: C.green }} fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span style={{ fontSize: 13, color: C.t2 }}>Fetching database…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: C.redDim, border: `1px solid ${C.unripe}44`, borderRadius: 10, padding: '14px 16px', color: C.unripe, fontSize: 13 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: C.t2, margin: 0 }}>No data found</p>
          <p style={{ fontSize: 13, color: C.t3, marginTop: 6 }}>
            {filter ? 'Try clearing the filter.' : 'Upload some images to see records here.'}
          </p>
        </div>
      )}

      {/* Records */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(doc => (
            <LocationCard
              key={`${openKey}-${doc.greenhouse_row}-${doc.distanceFromRowStart}`}
              doc={doc}
              defaultOpen={allOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}
