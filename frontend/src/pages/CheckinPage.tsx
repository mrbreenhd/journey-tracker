import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { getTrip, submitCheckin } from '../lib/api';
import type { TripData, CheckinData } from '../lib/api';
import { getCurrentPosition, distanceKm } from '../lib/geo';
import PhotoUpload from '../components/PhotoUpload';
import { useToast } from '../components/Toast';

const INTERVALS = [
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

export default function CheckinPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [trip, setTrip] = useState<TripData | null>(null);
  const [secret, setSecret] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [needsSecret, setNeedsSecret] = useState(false);

  const [autoEnabled, setAutoEnabled] = useState(true);
  const [intervalSec, setIntervalSec] = useState(300);
  const [countdown, setCountdown] = useState(300);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [lastCheckin, setLastCheckin] = useState<CheckinData | null>(null);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'success' | 'error'>('idle');
  const [gpsError, setGpsError] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastPositionRef = useRef<{ lat: number; lon: number } | null>(null);
  const doCheckinRef = useRef<((isAuto: boolean) => Promise<void>) | undefined>(undefined);

  // Load trip and check for stored secret
  useEffect(() => {
    if (!slug) return;
    const stored = localStorage.getItem(`trip-secret-${slug}`);
    const urlSecret = new URLSearchParams(window.location.search).get('secret');
    const resolved = stored || urlSecret || '';
    if (resolved) {
      setSecret(resolved);
      if (urlSecret) localStorage.setItem(`trip-secret-${slug}`, urlSecret);
    } else {
      setNeedsSecret(true);
    }
    getTrip(slug).then(t => {
      setTrip(t);
      setTotalCheckins(t.checkins.length);
      if (t.checkins.length > 0) {
        const latest = t.checkins[t.checkins.length - 1];
        setLastCheckin(latest);
        lastPositionRef.current = { lat: latest.latitude, lon: latest.longitude };
      }
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  const doCheckin = useCallback(async (isAuto: boolean) => {
    if (!slug || !secret || checking) return;
    setChecking(true);
    setGpsStatus('acquiring');
    setGpsError('');

    try {
      const pos = await getCurrentPosition();

      // Skip if auto and haven't moved > 50m
      if (isAuto && lastPositionRef.current) {
        const dist = distanceKm(
          lastPositionRef.current.lat, lastPositionRef.current.lon,
          pos.latitude, pos.longitude,
        );
        if (dist < 0.05) {
          setGpsStatus('idle');
          setChecking(false);
          return;
        }
      }

      setGpsStatus('success');

      const checkinData = await submitCheckin(slug, secret, {
        latitude: pos.latitude,
        longitude: pos.longitude,
        altitude: pos.altitude,
        accuracy: pos.accuracy,
        note: isAuto ? undefined : note || undefined,
      }, isAuto ? undefined : photos.length > 0 ? photos : undefined);

      setLastCheckin(checkinData);
      setTotalCheckins(prev => prev + 1);
      lastPositionRef.current = { lat: pos.latitude, lon: pos.longitude };

      const locationStr = checkinData.location_name || `${pos.latitude.toFixed(3)}, ${pos.longitude.toFixed(3)}`;
      addToast(
        isAuto ? `Auto check-in: ${locationStr}` : `Checked in at ${locationStr}`,
        'success'
      );

      if (!isAuto) {
        setNote('');
        setPhotos([]);
      }
    } catch (err: any) {
      setGpsStatus('error');
      setGpsError(err.message);
      if (err.message === 'Invalid secret code') {
        localStorage.removeItem(`trip-secret-${slug}`);
        setSecret('');
        setNeedsSecret(true);
      }
      addToast(err.message, 'error');
    } finally {
      setChecking(false);
    }
  }, [slug, secret, checking, note, photos, addToast]);

  // Keep ref in sync so the interval always calls the latest version
  useEffect(() => {
    doCheckinRef.current = doCheckin;
  }, [doCheckin]);

  // Auto check-in interval
  useEffect(() => {
    if (!autoEnabled || !secret) {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
      return;
    }

    setCountdown(intervalSec);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return intervalSec;
        return prev - 1;
      });
    }, 1000);

    intervalRef.current = setInterval(() => {
      doCheckinRef.current?.(true);
      setCountdown(intervalSec);
    }, intervalSec * 1000);

    // Do an initial check-in right away
    doCheckinRef.current?.(true);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [autoEnabled, intervalSec, secret]);

  const handleSecretSubmit = () => {
    if (!secretInput.trim() || !slug) return;
    localStorage.setItem(`trip-secret-${slug}`, secretInput.trim());
    setSecret(secretInput.trim());
    setNeedsSecret(false);
  };

  if (!trip) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-950">
        <div className="animate-pulse text-slate-400">Loading trip...</div>
      </div>
    );
  }

  // Secret entry screen
  if (needsSecret) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8"
        >
          <h2 className="font-display text-2xl font-bold text-white mb-2">Enter Trip Code</h2>
          <p className="text-slate-400 text-sm mb-6">You need the secret code to check in to <strong className="text-white">{trip.name}</strong></p>
          <input
            type="text"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSecretSubmit()}
            placeholder="XXXX-XXXX-XXXX"
            className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-center font-mono text-lg tracking-widest"
            autoFocus
          />
          <button
            onClick={handleSecretSubmit}
            disabled={!secretInput.trim()}
            className="mt-4 w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-surface-950 font-semibold rounded-xl transition active:scale-[0.98]"
          >
            Continue
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950 overflow-y-auto">
      <div className="max-w-lg mx-auto p-5 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="font-display text-xl font-bold text-white">{trip.name}</h1>
            <p className="text-slate-400 text-sm">{totalCheckins} check-in{totalCheckins !== 1 ? 's' : ''}</p>
          </div>
          <Link
            to={`/${slug}`}
            className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-sm text-slate-300 transition"
          >
            View Map
          </Link>
        </motion.div>

        {/* Auto check-in controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-sm font-medium text-white">Auto Check-in</span>
            </div>
            <button
              onClick={() => setAutoEnabled(!autoEnabled)}
              className={`
                relative w-11 h-6 rounded-full transition-colors duration-200
                ${autoEnabled ? 'bg-brand-500' : 'bg-slate-700'}
              `}
            >
              <div className={`
                absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                ${autoEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}
              `} />
            </button>
          </div>

          {autoEnabled && (
            <>
              {/* Interval selector */}
              <div className="flex gap-2 mb-4">
                {INTERVALS.map(iv => (
                  <button
                    key={iv.value}
                    onClick={() => { setIntervalSec(iv.value); setCountdown(iv.value); }}
                    className={`
                      flex-1 py-2 rounded-lg text-xs font-medium transition
                      ${intervalSec === iv.value
                        ? 'bg-brand-500/20 border border-brand-500/40 text-brand-300'
                        : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-white'
                      }
                    `}
                  >
                    {iv.label}
                  </button>
                ))}
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Next check-in in</span>
                <span className="font-mono text-brand-400 font-medium">
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </span>
              </div>
            </>
          )}
        </motion.div>

        {/* Last check-in info */}
        {lastCheckin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-5"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Last Check-in</p>
            <p className="text-white font-medium">
              {lastCheckin.location_name || `${lastCheckin.latitude.toFixed(4)}, ${lastCheckin.longitude.toFixed(4)}`}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {new Date(lastCheckin.checked_in_at).toLocaleString()}
              {lastCheckin.accuracy && <span className="text-slate-500"> · ±{Math.round(lastCheckin.accuracy)}m</span>}
            </p>
          </motion.div>
        )}

        {/* GPS status */}
        {gpsStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm mb-5 ${
              gpsStatus === 'acquiring' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' :
              gpsStatus === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' :
              'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}
          >
            {gpsStatus === 'acquiring' && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {gpsStatus === 'acquiring' && 'Acquiring GPS...'}
            {gpsStatus === 'success' && 'GPS position acquired'}
            {gpsStatus === 'error' && (gpsError || 'GPS error')}
          </motion.div>
        )}

        {/* Manual check-in section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-5"
        >
          <h3 className="text-sm font-medium text-white mb-3">Manual Check-in</h3>

          {/* Note field */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's happening on the road? Add a note..."
            rows={3}
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none text-sm mb-3"
          />

          {/* Photo upload */}
          <div className="mb-4">
            <PhotoUpload photos={photos} onPhotosChange={setPhotos} />
          </div>

          {/* Check in button */}
          <button
            onClick={() => doCheckin(false)}
            disabled={checking}
            className="w-full py-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-surface-950 font-bold rounded-xl transition-all duration-200 text-lg active:scale-[0.97] flex items-center justify-center gap-2"
          >
            {checking ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Check In Now
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
