'use client';

import { useState } from 'react';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { AUSTRALIAN_SPECIES, slugToLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import FloatingLeaves from '@/components/FloatingLeaves';

/* Animal emoji per species (rough mapping — defaults to 🐾) */
const SPECIES_EMOJI: Record<string, string> = {
  koala: '🐨', kangaroo: '🦘', wombat: '🦡', echidna: '🦔',
  quokka: '🦘', platypus: '🦆', possum: '🐿️', wallaby: '🦘',
  emu: '🦤', kookaburra: '🐦', dingo: '🐺', cassowary: '🦤',
  cockatoo: '🦜', 'flying-fox': '🦇', bilby: '🐇', numbat: '🦡',
  tasmanian_devil: '😈', quoll: '🐾', bandicoot: '🐭', glider: '🦅',
};
const getEmoji = (slug: string) => {
  const key = Object.keys(SPECIES_EMOJI).find((k) => slug.includes(k));
  return key ? SPECIES_EMOJI[key] : '🐾';
};

export default function NotificationsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [subscribed, setSubscribed]   = useState<Set<string>>(new Set());

  const handleSubscribe = async (species: string) => {
    setSubscribing(species);
    try {
      await api.subscribe({ tag: species });
      setSubscribed((prev) => new Set(prev).add(species));
      toast.success(`Subscribed to ${slugToLabel(species)} alerts! Check your email to confirm.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setSubscribing(null);
    }
  };

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)' }}>
      <FloatingLeaves />

      <div className="relative z-10 px-6 lg:px-10 py-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 page-enter">
          <h1 className="text-4xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            Species Alerts 🔔
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Subscribe to receive email notifications via AWS SNS when new sightings are catalogued.
          </p>
        </div>

        {/* Info card */}
        <div
          className="mb-8 rounded-2xl p-5 page-enter-1"
          style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl mt-0.5"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold font-display mb-1" style={{ color: 'var(--text)' }}>
                How alerts work 🦘
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                Each species has a dedicated AWS SNS topic. Click &ldquo;Subscribe&rdquo; and{' '}
                <strong style={{ color: 'var(--text)' }}>{user?.email}</strong> will be added.
                AWS SNS sends a confirmation email — you must confirm it. After that, you&apos;ll receive
                an alert whenever a new file tagged with that species is processed.
              </p>
            </div>
          </div>
        </div>

        {/* Species grid */}
        <div>
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-5 flex items-center gap-2"
            style={{ color: 'var(--muted)' }}
          >
            🦎 Australian Species ({AUSTRALIAN_SPECIES.length})
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {AUSTRALIAN_SPECIES.map((species) => {
              const isSub    = subscribed.has(species);
              const isLoading = subscribing === species;
              const emoji    = getEmoji(species);

              return (
                <div
                  key={species}
                  className={`rounded-2xl p-3 transition-all duration-200 ${isSub ? 'subscribed-glow' : ''}`}
                  style={{
                    background:  isSub ? 'var(--nav-active-bg)' : 'var(--card)',
                    border:      isSub ? '1.5px solid var(--primary-light)' : '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xl">{emoji}</span>
                    <p className="text-sm font-semibold leading-tight flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>
                      {slugToLabel(species)}
                    </p>
                    {isSub && <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />}
                  </div>

                  <button
                    onClick={() => !isSub && handleSubscribe(species)}
                    disabled={isSub || isLoading}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                    style={isSub
                      ? { background: 'rgba(82,183,136,0.15)', color: 'var(--primary)', cursor: 'default' }
                      : isLoading
                      ? { background: 'var(--border)', color: 'var(--muted)', cursor: 'wait' }
                      : { background: 'var(--input-bg)', color: 'var(--muted)', border: '1px solid var(--border)' }
                    }
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isSub ? (
                      <><CheckCircle2 className="h-3 w-3" /> Subscribed</>
                    ) : (
                      <><Bell className="h-3 w-3" /> Subscribe</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Your subscriptions ("herd") */}
        {subscribed.size > 0 && (
          <div
            className="mt-10 rounded-2xl p-6"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <h3
              className="text-sm font-bold font-display mb-4 flex items-center gap-2"
              style={{ color: 'var(--text)' }}
            >
              🦘 Your herd ({subscribed.size})
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {Array.from(subscribed).map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: 'var(--nav-active-bg)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                >
                  {getEmoji(s)} {slugToLabel(s)}
                </span>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)', opacity: 0.7 }}>
              Remember to confirm each subscription via the email sent by AWS SNS.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
