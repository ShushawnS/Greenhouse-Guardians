import { useRef, useState, useCallback, useEffect } from 'react'

export const BBOX_COLORS = {
  Ripe:           '#22c55e',
  Half_Ripe:      '#eab308',
  Unripe:         '#ef4444',
  Bud:            '#3b82f6',
  Anthesis:       '#a855f7',
  'Post-Anthesis':'#f97316',
}

/**
 * Renders an image with scaled bounding box overlays.
 * Props:
 *   src          – image URL
 *   alt          – alt text
 *   detections   – [{ bbox: {x1,y1,x2,y2}, label, confidence }]
 *   imgStyle     – style on the <img>
 *   imgClassName – className on the <img>
 */
export default function AnnotatedImage({ src, alt = '', detections = [], imgStyle, imgClassName }) {
  const imgRef = useRef(null)
  const [dims, setDims] = useState(null)

  const updateDims = useCallback(() => {
    const img = imgRef.current
    if (!img || !img.naturalWidth) return
    setDims({
      scaleX: img.clientWidth  / img.naturalWidth,
      scaleY: img.clientHeight / img.naturalHeight,
    })
  }, [])

  useEffect(() => {
    window.addEventListener('resize', updateDims)
    return () => window.removeEventListener('resize', updateDims)
  }, [updateDims])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        style={imgStyle}
        className={imgClassName}
        onLoad={updateDims}
      />
      {dims && detections.map((det, i) => {
        const { x1, y1, x2, y2 } = det.bbox
        return (
          <div
            key={i}
            style={{
              position:  'absolute',
              left:      x1 * dims.scaleX,
              top:       y1 * dims.scaleY,
              width:     (x2 - x1) * dims.scaleX,
              height:    (y2 - y1) * dims.scaleY,
              border:    `2px solid ${BBOX_COLORS[det.label] || '#ffffff'}`,
              borderRadius: 2,
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
          />
        )
      })}
    </div>
  )
}
