import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { createTrip } from '../lib/api';

export default function CreateTrip() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ slug: string; secret: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const trip = await createTrip(name.trim());
      setResult({ slug: trip.public_slug, secret: trip.secret_code, name: trip.name });
    } catch {
      setError('Failed to create trip. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTracking = () => {
    if (!result) return;
    localStorage.setItem(`trip-secret-${result.slug}`, result.secret);
    navigate(`/${result.slug}/checkin`);
  };

  const shareUrl = result ? `${window.location.origin}/${result.slug}` : '';

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950">
      {/* Decorative grain overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg"
      >
        {!result ? (
          <>
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-center mb-10"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-6">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Journey Tracker
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
                Start your
                <span className="block text-brand-400">adventure</span>
              </h1>
              <p className="text-slate-400 text-lg">
                Track your road trip in real-time with GPS check-ins, photos, and a live shareable map.
              </p>
            </motion.div>

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8"
            >
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Trip name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Pacific Coast Highway 2026"
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40 transition text-lg"
                autoFocus
              />
              {error && (
                <p className="mt-3 text-red-400 text-sm">{error}</p>
              )}
              <button
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                className="mt-5 w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-surface-950 font-semibold rounded-xl transition-all duration-200 text-lg active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : 'Create Trip'}
              </button>
            </motion.div>
          </>
        ) : (
          /* Success state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 text-center"
          >
            <div className="w-16 h-16 bg-brand-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="font-display text-2xl font-bold text-white mb-1">
              {result.name}
            </h2>
            <p className="text-slate-400 mb-6">Your trip is ready!</p>

            {/* Secret code */}
            <div className="bg-surface-950/60 border border-white/[0.06] rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">Secret Code — save this!</p>
              <div className="flex items-center justify-center gap-3">
                <code className="text-brand-400 font-mono text-xl tracking-widest">{result.secret}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(result.secret)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition"
                  title="Copy"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Share link */}
            <div className="bg-surface-950/60 border border-white/[0.06] rounded-xl p-4 mb-6">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">Share Link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-slate-300 text-sm truncate outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="shrink-0 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg text-xs text-slate-300 transition"
                >
                  Copy
                </button>
              </div>
            </div>

            <button
              onClick={handleStartTracking}
              className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-surface-950 font-semibold rounded-xl transition-all duration-200 text-lg active:scale-[0.98]"
            >
              Start Tracking →
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
