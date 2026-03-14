import { useEffect, useRef, useState, useCallback } from 'react'

const BBOX_COLORS = {
  Ripe:           '#22c55e',
  Half_Ripe:      '#eab308',
  Unripe:         '#ef4444',
  Bud:            '#3b82f6',
  Anthesis:       '#a855f7',
  'Post-Anthesis':'#f97316',
}

export default function ImageModal({ image, onClose }) {
  const imgRef = useRef(null)
  const [dims, setDims] = useState(null)   // { scaleX, scaleY }
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const updateDims = useCallback(() => {
    const img = imgRef.current
    if (!img || !img.naturalWidth) return
    setDims({
      scaleX: img.clientWidth  / img.naturalWidth,
      scaleY: img.clientHeight / img.naturalHeight,
    })
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', updateDims)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', updateDims)
    }
  }, [onClose, updateDims])

  const detections = image.detections || []

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close (Esc)
        </button>

        {/* Image + bbox overlays */}
        <div className="relative inline-block">
          <img
            ref={imgRef}
            src={image.src}
            alt={image.label}
            onLoad={updateDims}
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain select-none"
          />

          {dims && detections.map((det, i) => {
            const { x1, y1, x2, y2 } = det.bbox
            const left   = x1 * dims.scaleX
            const top    = y1 * dims.scaleY
            const width  = (x2 - x1) * dims.scaleX
            const height = (y2 - y1) * dims.scaleY
            const color  = BBOX_COLORS[det.label] || '#ffffff'
            const isHovered = hoveredIdx === i

            // flip tooltip above/below based on available space (rough check)
            const tipBelow = top < 40

            return (
              <div
                key={i}
                style={{ left, top, width, height, borderColor: color, position: 'absolute' }}
                className={`border-2 rounded cursor-pointer transition-colors ${isHovered ? 'bg-white/10' : 'bg-transparent'}`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {isHovered && (
                  <div
                    className={`absolute left-0 z-10 pointer-events-none bg-black/90 text-white text-xs rounded px-2 py-1 whitespace-nowrap ${
                      tipBelow ? 'top-full mt-1' : 'bottom-full mb-1'
                    }`}
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <span className="font-semibold">{det.label}</span>
                    <span className="text-white/60 ml-2">{(det.confidence * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Caption */}
        {image.label && (
          <p className="text-white/60 text-sm mt-3">{image.label}</p>
        )}
        {detections.length > 0 && (
          <p className="text-white/30 text-xs mt-1">Hover over bounding boxes for details</p>
        )}
      </div>
    </div>
  )
}
