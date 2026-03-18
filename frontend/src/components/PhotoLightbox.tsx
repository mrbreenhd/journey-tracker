import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { CheckinData } from '../lib/api';

interface PhotoLightboxProps {
  checkins: CheckinData[];
  checkinId: string | null;
  photoIndex: number;
  onClose: () => void;
  onNavigate: (checkinId: string, photoIndex: number) => void;
}

export default function PhotoLightbox({ checkins, checkinId, photoIndex, onClose, onNavigate }: PhotoLightboxProps) {
  const checkin = checkins.find(c => c.id === checkinId);
  const photo = checkin?.photos[photoIndex];

  // Build flat list of all photos for prev/next navigation
  const allPhotos = checkins.flatMap(c =>
    c.photos.map((p, idx) => ({ checkinId: c.id, photoIndex: idx, photo: p, location: c.location_name }))
  );
  const currentFlatIndex = allPhotos.findIndex(p => p.checkinId === checkinId && p.photoIndex === photoIndex);

  const goPrev = useCallback(() => {
    if (currentFlatIndex > 0) {
      const prev = allPhotos[currentFlatIndex - 1];
      onNavigate(prev.checkinId, prev.photoIndex);
    }
  }, [currentFlatIndex, allPhotos, onNavigate]);

  const goNext = useCallback(() => {
    if (currentFlatIndex < allPhotos.length - 1) {
      const next = allPhotos[currentFlatIndex + 1];
      onNavigate(next.checkinId, next.photoIndex);
    }
  }, [currentFlatIndex, allPhotos, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  // Touch swipe support
  useEffect(() => {
    let startX = 0;
    const handleTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const handleTouchEnd = (e: TouchEvent) => {
      const diff = e.changedTouches[0].clientX - startX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) goPrev();
        else goNext();
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [goPrev, goNext]);

  if (!photo || !checkinId) return null;

  const flatEntry = allPhotos[currentFlatIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
        onClick={onClose}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between p-4" onClick={e => e.stopPropagation()}>
          <div className="text-sm text-slate-300">
            {flatEntry?.location && <span className="font-medium">{flatEntry.location}</span>}
            <span className="text-slate-500 ml-2">
              {currentFlatIndex + 1} / {allPhotos.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center p-4 relative" onClick={e => e.stopPropagation()}>
          {currentFlatIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-2 sm:left-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition z-10"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <motion.img
            key={photo.url}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            src={photo.url}
            alt={photo.original_name}
            className="max-h-full max-w-full object-contain rounded-lg"
          />

          {currentFlatIndex < allPhotos.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-2 sm:right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition z-10"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
