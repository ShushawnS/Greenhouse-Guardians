export default function ImageGallery({ images = [], emptyMessage = 'No images available' }) {
  if (!images.length) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    )
  }
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {images.map(({ src, label }, i) => (
        <div key={i} className="flex-shrink-0 text-center">
          <img
            src={src}
            alt={label || `Image ${i + 1}`}
            className="h-48 w-auto rounded-lg border border-gray-200 object-cover shadow-sm"
          />
          {label && <p className="text-xs text-gray-500 mt-1.5">{label}</p>}
        </div>
      ))}
    </div>
  )
}
