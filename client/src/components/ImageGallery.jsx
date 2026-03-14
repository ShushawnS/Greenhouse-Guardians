import { useState } from 'react'
import ImageModal from './ImageModal'

export default function ImageGallery({ images = [], emptyMessage = 'No images available' }) {
  const [modalImage, setModalImage] = useState(null)

  if (!images.length) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {images.map((img, i) => (
          <div
            key={i}
            className="flex-shrink-0 text-center cursor-pointer group"
            onClick={() => setModalImage(img)}
          >
            <div className="relative">
              <img
                src={img.src}
                alt={img.label || `Image ${i + 1}`}
                className="h-48 w-auto rounded-lg border border-gray-200 object-cover shadow-sm group-hover:shadow-md group-hover:border-green-300 transition-all"
              />
              {/* Click hint overlay */}
              <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
            {img.label && <p className="text-xs text-gray-500 mt-1.5">{img.label}</p>}
          </div>
        ))}
      </div>

      {modalImage && (
        <ImageModal image={modalImage} onClose={() => setModalImage(null)} />
      )}
    </>
  )
}
