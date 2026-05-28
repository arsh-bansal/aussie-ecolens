'use client';

import { useState } from 'react';
import { Bell, BellOff, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { AUSTRALIAN_SPECIES, slugToLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function NotificationsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());

  const handleSubscribe = async (species: string) => {
    setSubscribing(species);
    try {
      await api.subscribe({ tag: species });
      setSubscribed((prev) => new Set(prev).add(species));
      toast.success(`Subscribed to ${slugToLabel(species)} alerts. Check your email to confirm.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setSubscribing(null);
    }
  };

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-50">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Subscribe to receive email alerts via AWS SNS when new files containing a species are uploaded.
        </p>
      </div>

      {/* Info card */}
      <div className="mb-8 rounded-xl border border-forest-500/20 bg-forest-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Bell className="h-5 w-5 text-forest-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-forest-300 mb-1">How notifications work</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Each species has a dedicated AWS SNS topic. When you click &quot;Subscribe&quot;, your email
              address (<strong className="text-gray-300">{user?.email}</strong>) is added to that topic.
              AWS SNS will send a confirmation email — you must confirm it to start receiving alerts.
              You&apos;ll receive a notification whenever a new file tagged with that species is processed.
            </p>
          </div>
        </div>
      </div>

      {/* Species grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4">
          Australian Species ({AUSTRALIAN_SPECIES.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {AUSTRALIAN_SPECIES.map((species) => {
            const isSubscribed = subscribed.has(species);
            const isLoading = subscribing === species;
            return (
              <div
                key={species}
                className={`group rounded-xl border p-3 transition-all duration-200 ${
                  isSubscribed
                    ? 'border-forest-500/30 bg-forest-500/8'
                    : 'border-dark-50 bg-dark-200/40 hover:border-forest-500/20 hover:bg-forest-500/4'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-300 leading-snug">
                    {slugToLabel(species)}
                  </p>
                  {isSubscribed ? (
                    <CheckCircle2 className="h-4 w-4 text-forest-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <BellOff className="h-4 w-4 text-gray-700 flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <button
                  onClick={() => !isSubscribed && handleSubscribe(species)}
                  disabled={isSubscribed || isLoading}
                  className={`mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSubscribed
                      ? 'bg-forest-500/15 text-forest-400 cursor-default'
                      : isLoading
                      ? 'bg-dark-100 text-gray-500 cursor-wait'
                      : 'bg-dark-100 text-gray-500 hover:bg-forest-500/15 hover:text-forest-300 border border-dark-50 hover:border-forest-500/25'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isSubscribed ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Subscribed
                    </>
                  ) : (
                    <>
                      <Bell className="h-3 w-3" />
                      Subscribe
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {subscribed.size > 0 && (
        <div className="mt-8 rounded-xl border border-dark-50 bg-dark-200/30 p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Your subscriptions ({subscribed.size})
          </h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(subscribed).map((s) => (
              <span
                key={s}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-500/15 border border-forest-500/25 text-forest-300 text-xs"
              >
                <Bell className="h-3 w-3" />
                {slugToLabel(s)}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-700">
            Remember to confirm each subscription via the email sent by AWS SNS.
          </p>
        </div>
      )}
    </div>
  );
}
