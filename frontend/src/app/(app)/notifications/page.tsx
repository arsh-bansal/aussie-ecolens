'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { SPECIES_OPTIONS } from '@/lib/species';
import { useToast } from '@/contexts/ToastContext';

// The `tag` MUST be the exact canonical species name the Tagger stores and the
// Notifier publishes — SNS filter policies match it by case-sensitive exact
// string. Only species in the model's taxonomy can ever fire an alert.
const PRESET_TAGS = new Set([
  'Southern Cassowary', 'Red Fox', 'Domestic Cat', 'Dingo',
  'Eastern Grey Kangaroo', 'Common Wombat',
]);

const PRESET_SPECIES = [
  { name: 'Southern Cassowary', tag: 'Southern Cassowary', icoStyle: { background: 'var(--gold-soft)', color: 'var(--gold)' } },
  { name: 'Red Fox (invasive)', tag: 'Red Fox', icoStyle: { background: 'var(--clay-soft)', color: 'var(--clay)' } },
  { name: 'Domestic Cat (invasive)', tag: 'Domestic Cat', icoStyle: { background: 'var(--clay-soft)', color: 'var(--clay)' } },
  { name: 'Dingo', tag: 'Dingo', icoStyle: { background: 'var(--ochre-tint)', color: 'var(--ochre)' } },
  { name: 'Eastern Grey Kangaroo', tag: 'Eastern Grey Kangaroo', icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc)' } },
  { name: 'Common Wombat', tag: 'Common Wombat', icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc)' } },
];

export default function NotificationsPage() {
  const toast = useToast();
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [customTag, setCustomTag] = useState('');

  const loadSubscriptions = useCallback(async () => {
    setPageLoading(true);
    try {
      const res = await api.listSubscriptions();
      setSubscribed(new Set(res.tags));
      setPendingConfirm(res.status === 'pending_confirmation');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadSubscriptions(); }, [loadSubscriptions]);

  const subscribe = async (tag: string) => {
    setLoading(tag);
    try {
      const res = await api.subscribe({ tag });
      if (res.status === 'pending_confirmation') {
        setPendingConfirm(true);
        toast.success(`Check your email (${res.email}) to confirm SNS alerts.`);
      } else {
        setSubscribed(prev => new Set([...prev, res.tag]));
        setPendingConfirm(false);
        toast.success(`Subscribed to "${res.tag}" alerts via SNS.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('404') || msg.includes('Not Found')) {
        toast.warning('SNS subscribe endpoint not yet deployed — coming soon.');
      } else {
        toast.error(msg || 'Subscription failed');
      }
    } finally {
      setLoading(null);
    }
  };

  const unsubscribe = async (tag: string) => {
    setLoading(tag);
    try {
      const res = await api.unsubscribe({ tag });
      setSubscribed(prev => {
        const next = new Set(prev);
        next.delete(tag);
        return next;
      });
      if (res.status === 'unsubscribed_all') {
        setSubscribed(new Set());
        toast.success(res.message ?? 'All SNS alerts cancelled.');
      } else {
        toast.success(`Unsubscribed from "${tag}" alerts.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unsubscribe failed');
    } finally {
      setLoading(null);
    }
  };

  const unsubscribeAll = async () => {
    setLoading('__all__');
    try {
      const res = await api.unsubscribe({ all: true });
      setSubscribed(new Set());
      setPendingConfirm(false);
      toast.success(res.message ?? 'All SNS email alerts cancelled.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unsubscribe failed');
    } finally {
      setLoading(null);
    }
  };

  const extraSubscribed = [...subscribed].filter(t => !PRESET_TAGS.has(t));

  const handleCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTag.trim()) return;
    await subscribe(customTag.trim());
    setCustomTag('');
  };

  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-sub">SNS email notifications when target species are spotted</div>
        </div>
      </header>

      <div className="page">
        {pendingConfirm && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--gold-soft)', color: 'var(--gold)', fontSize: '14px', marginBottom: '16px' }}>
            Confirm the AWS SNS subscription email in your inbox, then refresh this page. Until confirmed, new species cannot be added to your filter.
          </div>
        )}

        {pageLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--line)', borderTopColor: 'var(--ochre)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
        <>
        <div className="stat-grid" style={{ gridTemplateColumns: '200px' }}>
          {[
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/></svg>, icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc)' }, val: String(subscribed.size), label: 'Active subscriptions' },
          ].map(s => (
            <div key={s.label} className="stat">
              <div className="stat-ico" style={s.icoStyle}>{s.icon}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '20px', marginTop: '22px' }}>
          {/* Subscribe to preset species */}
          <div className="panel" style={{ alignSelf: 'start' }}>
            <div className="panel-head"><h3>Alert rules</h3><span className="badge badge-mute" style={{ marginLeft: 'auto' }}>via AWS SNS</span></div>
            {PRESET_SPECIES.map(({ name, tag, icoStyle }) => {
              const isOn = subscribed.has(tag);
              const isLoading = loading === tag;
              return (
                <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '17px 20px', borderBottom: '1px solid var(--line-soft)' }}>
                  <span style={{ width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0, display: 'grid', placeItems: 'center', ...icoStyle }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3c4 4 6 7 6 10a6 6 0 01-12 0c0-3 2-6 6-10z"/></svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14.5px' }}>{name}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>tag: {tag}</div>
                  </div>
                  {isOn ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => unsubscribe(tag)}
                      disabled={isLoading}
                      style={{ flexShrink: 0, color: 'var(--clay)', borderColor: 'var(--clay-soft)' }}
                    >
                      {isLoading ? 'Removing…' : 'Unsubscribe'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => subscribe(tag)}
                      disabled={isLoading}
                      style={{ flexShrink: 0 }}
                    >
                      {isLoading ? 'Subscribing…' : 'Subscribe'}
                    </button>
                  )}
                </div>
              );
            })}

            {extraSubscribed.length > 0 && (
              <div style={{ padding: '8px 20px 0', borderTop: '1px solid var(--line-soft)' }}>
                <p style={{ fontSize: '12px', color: 'var(--ink-faint)', marginBottom: '10px' }}>Other active subscriptions</p>
                {extraSubscribed.map(tag => (
                  <div key={tag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{tag}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => unsubscribe(tag)}
                      disabled={loading === tag}
                      style={{ color: 'var(--clay)', borderColor: 'var(--clay-soft)' }}
                    >
                      {loading === tag ? 'Removing…' : 'Unsubscribe'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {subscribed.size > 0 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line-soft)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={unsubscribeAll}
                  disabled={loading === '__all__'}
                  style={{ color: 'var(--clay)', borderColor: 'var(--clay-soft)' }}
                >
                  {loading === '__all__' ? 'Cancelling…' : 'Unsubscribe from all alerts'}
                </button>
                <p style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '8px' }}>
                  Cancels your AWS SNS email subscription (same as the unsubscribe link in alert emails).
                </p>
              </div>
            )}

            {/* Custom tag */}
            <div style={{ padding: '18px 20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--ink-faint)', marginBottom: '12px' }}>
                Subscribe to any other species — pick from the list or type a custom tag:
              </p>
              <form onSubmit={handleCustom} style={{ display: 'flex', gap: '10px' }}>
                <input
                  className="input"
                  placeholder="Start typing a species name…"
                  value={customTag}
                  onChange={e => setCustomTag(e.target.value)}
                  list="species-options-alerts"
                  style={{ flex: 1, padding: '10px 13px', fontSize: '14px' }}
                />
                <datalist id="species-options-alerts">
                  {SPECIES_OPTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
                <button className="btn btn-primary" type="submit" disabled={!customTag.trim() || !!loading}>
                  {loading === customTag.trim() ? '…' : 'Subscribe'}
                </button>
              </form>
            </div>
          </div>

          {/* Info panel */}
          <div className="panel" style={{ alignSelf: 'start' }}>
            <div className="panel-head"><h3>How alerts work</h3></div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: '📤', title: 'Upload media', desc: 'A camera trap image or video is uploaded and processed by MegaDetector + SpeciesNet.' },
                { icon: '🔍', title: 'Species detected', desc: 'When the ML pipeline detects a species matching your subscription tag and stores it on the file, an event is triggered.' },
                { icon: '📧', title: 'SNS email sent', desc: 'AWS SNS sends an email to your registered address with the detection details and thumbnail.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: '14px', padding: '14px', borderRadius: 'var(--r-md)', background: 'var(--sand-50)' }}>
                  <span style={{ fontSize: '22px', flexShrink: 0, lineHeight: 1.2 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--ochre-tint)', border: '1px solid var(--ochre-soft)', fontSize: '13px', color: 'var(--ink-soft)' }}>
                Emails are sent to the address on your Cognito account. Make sure it is verified.
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--clay-soft)', border: '1px solid var(--clay-soft)', fontSize: '13px', color: 'var(--ink-soft)' }}>
                <strong style={{ color: 'var(--clay)' }}>Heads up:</strong> some email clients (Gmail, Outlook, corporate mail) auto-scan links in incoming mail, which can silently click AWS&apos;s unsubscribe link and cancel your alerts. If you stop getting emails, just resubscribe here — your tag preferences stay in the app.
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </>
  );
}
