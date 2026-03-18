import { motion } from 'motion/react';
import type { CheckinData } from '../lib/api';
import { timeAgo, formatDateTime, formatDistance } from '../lib/format';
import { distanceKm } from '../lib/geo';

interface TimelineProps {
  checkins: CheckinData[];
  highlightedId: string | null;
  onCheckinClick: (id: string) => void;
  onPhotoClick: (checkinId: string, photoIndex: number) => void;
  useMiles: boolean;
}

export default function Timeline({ checkins, highlightedId, onCheckinClick, onPhotoClick, useMiles }: TimelineProps) {
  // Reverse for newest-first display
  const reversed = [...checkins].reverse();

  if (reversed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-slate-400 font-medium">No check-ins yet</p>
        <p className="text-slate-500 text-sm mt-1">Start your journey to see it here</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-4 space-y-1">
      <h3 className="font-display text-lg font-semibold text-white mb-4 px-1">Journey Log</h3>

      {reversed.map((checkin, displayIdx) => {
        const originalIdx = checkins.length - 1 - displayIdx;
        const prevCheckin = originalIdx > 0 ? checkins[originalIdx - 1] : null;
        const dist = prevCheckin
          ? distanceKm(prevCheckin.latitude, prevCheckin.longitude, checkin.latitude, checkin.longitude)
          : 0;
        const isHighlighted = checkin.id === highlightedId;
        const isLatest = displayIdx === 0;

        return (
          <motion.div
            key={checkin.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: Math.min(displayIdx * 0.05, 0.5) }}
            onClick={() => onCheckinClick(checkin.id)}
            className={`
              relative rounded-xl p-4 cursor-pointer transition-all duration-200
              ${isHighlighted
                ? 'bg-brand-500/10 border border-brand-500/30'
                : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]'
              }
            `}
          >
            {/* Timeline connector */}
            <div className="flex gap-3">
              {/* Dot + line */}
              <div className="flex flex-col items-center pt-1">
                <div className={`
                  w-3 h-3 rounded-full shrink-0
                  ${isLatest ? 'bg-brand-400 shadow-[0_0_8px_rgba(247,160,30,0.5)]' : 'bg-slate-600'}
                `} />
                {displayIdx < reversed.length - 1 && (
                  <div className="w-px flex-1 bg-gradient-to-b from-slate-600/50 to-transparent mt-2 min-h-[20px]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <span className="text-[11px] font-medium text-brand-400 mr-2">
                      #{checkins.length - displayIdx}
                    </span>
                    {checkin.location_name ? (
                      <span className="text-sm font-semibold text-white">
                        {checkin.location_name}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">
                        {checkin.latitude.toFixed(4)}, {checkin.longitude.toFixed(4)}
                      </span>
                    )}
                  </div>
                  {dist > 0.05 && (
                    <span className="text-[10px] font-medium text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full whitespace-nowrap">
                      +{formatDistance(dist, useMiles)}
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <span>{timeAgo(checkin.checked_in_at)}</span>
                  <span>·</span>
                  <span>{formatDateTime(checkin.checked_in_at)}</span>
                  {checkin.accuracy && (
                    <>
                      <span>·</span>
                      <span>±{Math.round(checkin.accuracy)}m</span>
                    </>
                  )}
                </div>

                {/* Note */}
                {checkin.note && (
                  <p className="text-sm text-slate-300 leading-relaxed mb-2">
                    {checkin.note}
                  </p>
                )}

                {/* Photos */}
                {checkin.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {checkin.photos.map((photo, photoIdx) => (
                      <button
                        key={photo.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPhotoClick(checkin.id, photoIdx);
                        }}
                        className="shrink-0 rounded-lg overflow-hidden border border-white/[0.06] hover:border-brand-500/40 transition w-20 h-20 sm:w-24 sm:h-24"
                      >
                        <img
                          src={photo.url}
                          alt={photo.original_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
