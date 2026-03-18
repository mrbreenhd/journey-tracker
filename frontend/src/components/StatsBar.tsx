import { motion } from 'motion/react';
import type { TripStats } from '../lib/api';
import { formatDistance, formatDuration, formatSpeed } from '../lib/format';

interface StatsBarProps {
  stats: TripStats | null;
  useMiles: boolean;
  onToggleUnits: () => void;
}

export default function StatsBar({ stats, useMiles, onToggleUnits }: StatsBarProps) {
  if (!stats) return null;

  const items = [
    {
      label: 'Distance',
      value: formatDistance(stats.total_distance_km, useMiles),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: 'Duration',
      value: formatDuration(stats.total_duration_seconds),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Avg Speed',
      value: formatSpeed(stats.average_speed_kmh, useMiles),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: 'Check-ins',
      value: String(stats.checkin_count),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-surface-950/70 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col items-center min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-brand-400 mb-1">
              {item.icon}
              <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">{item.label}</span>
            </div>
            <span className="text-base sm:text-xl font-bold text-white font-display tabular-nums truncate">
              {item.value}
            </span>
          </div>
        ))}

        {/* Unit toggle */}
        <button
          onClick={onToggleUnits}
          className="shrink-0 p-2 rounded-lg hover:bg-white/[0.06] transition text-xs text-slate-400 font-medium"
          title="Toggle km/miles"
        >
          {useMiles ? 'mi' : 'km'}
        </button>
      </div>
    </motion.div>
  );
}
