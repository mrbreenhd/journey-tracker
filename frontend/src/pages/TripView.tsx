import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { getTrip, getTripStats } from '../lib/api';
import type { TripData, TripStats, CheckinData } from '../lib/api';
import MapView from '../components/MapView';
import StatsBar from '../components/StatsBar';
import Timeline from '../components/Timeline';
import PhotoLightbox from '../components/PhotoLightbox';

export default function TripView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<TripData | null>(null);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMiles, setUseMiles] = useState(() => localStorage.getItem('units') === 'miles');
  const [highlightedCheckin, setHighlightedCheckin] = useState<string | null>(null);

  // Lightbox state
  const [lightboxCheckinId, setLightboxCheckinId] = useState<string | null>(null);
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState(0);

  const hasSecret = slug ? !!localStorage.getItem(`trip-secret-${slug}`) : false;

  const fetchData = useCallback(async () => {
    if (!slug) return;
    try {
      const [tripData, statsData] = await Promise.all([
        getTrip(slug),
        getTripStats(slug),
      ]);
      setTrip(tripData);
      setStats(statsData);
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const toggleUnits = () => {
    setUseMiles(prev => {
      const next = !prev;
      localStorage.setItem('units', next ? 'miles' : 'km');
      return next;
    });
  };

  const handleMarkerClick = (id: string) => {
    setHighlightedCheckin(prev => prev === id ? null : id);
  };

  const handlePhotoClick = (checkinId: string, photoIndex: number) => {
    setLightboxCheckinId(checkinId);
    setLightboxPhotoIndex(photoIndex);
  };

  if (loading || !trip) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-950">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-slate-400 flex flex-col items-center gap-3"
        >
          <svg className="animate-spin w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading your journey...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row bg-surface-950 overflow-hidden">
      {/* Lightbox */}
      {lightboxCheckinId && (
        <PhotoLightbox
          checkins={trip.checkins}
          checkinId={lightboxCheckinId}
          photoIndex={lightboxPhotoIndex}
          onClose={() => setLightboxCheckinId(null)}
          onNavigate={(cid, pi) => { setLightboxCheckinId(cid); setLightboxPhotoIndex(pi); }}
        />
      )}

      {/* Map section */}
      <div className="relative h-[45vh] lg:h-full lg:flex-1">
        <MapView
          checkins={trip.checkins}
          onMarkerClick={handleMarkerClick}
          highlightedId={highlightedCheckin}
        />

        {/* Stats overlay */}
        <div className="absolute top-3 left-3 right-3 z-10">
          <StatsBar stats={stats} useMiles={useMiles} onToggleUnits={toggleUnits} />
        </div>

        {/* Trip name + actions */}
        <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-surface-950/70 backdrop-blur-xl border border-white/[0.06] rounded-xl px-4 py-2.5"
          >
            <h1 className="font-display text-lg font-bold text-white leading-tight">{trip.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {trip.checkins.length} check-in{trip.checkins.length !== 1 ? 's' : ''}
              {trip.started_at && ` · Started ${new Date(trip.started_at).toLocaleDateString()}`}
            </p>
          </motion.div>

          {hasSecret && (
            <Link
              to={`/${slug}/checkin`}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-surface-950 font-semibold rounded-xl transition active:scale-[0.97] text-sm shadow-lg shadow-brand-500/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Check In
            </Link>
          )}
        </div>
      </div>

      {/* Timeline section */}
      <div className="flex-1 lg:w-96 lg:flex-none lg:border-l border-white/[0.06] overflow-hidden flex flex-col min-h-0">
        <Timeline
          checkins={trip.checkins}
          highlightedId={highlightedCheckin}
          onCheckinClick={handleMarkerClick}
          onPhotoClick={handlePhotoClick}
          useMiles={useMiles}
        />
      </div>
    </div>
  );
}
