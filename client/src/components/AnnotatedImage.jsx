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
        const color = BBOX_COLORS[det.label] || '#ffffff'
        const hasDepth = det.depth_mm != null || det.weight_g != null
        const depthParts = []
        if (det.depth_mm != null) depthParts.push(`${det.depth_mm}mm`)
        if (det.weight_g != null) depthParts.push(`~${det.weight_g}g`)

        return (
          <div
            key={i}
            style={{
              position:  'absolute',
              left:      x1 * dims.scaleX,
              top:       y1 * dims.scaleY,
              width:     (x2 - x1) * dims.scaleX,
              height:    (y2 - y1) * dims.scaleY,
              border:    `2px solid ${color}`,
              borderRadius: 2,
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
          >
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: -2,
              background: color,
              color: '#fff',
              fontSize: 8,
              fontWeight: 600,
              lineHeight: 1.4,
              padding: '1px 3px',
              borderRadius: '2px 2px 0 0',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}>
              {det.label} {Math.round((det.confidence || 0) * 100)}%
              {hasDepth && <><br />{depthParts.join(' · ')}</>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
