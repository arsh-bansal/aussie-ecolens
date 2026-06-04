'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const PRESET_SPECIES = [
  { name: 'Southern Cassowary', tag: 'cassowary', icoStyle: { background: 'var(--gold-soft)', color: 'var(--gold)' } },
  { name: 'Koala', tag: 'koala', icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc)' } },
  { name: 'Red Fox (invasive)', tag: 'fox', icoStyle: { background: 'var(--clay-soft)', color: 'var(--clay)' } },
  { name: 'Feral Cat (invasive)', tag: 'cat', icoStyle: { background: 'var(--clay-soft)', color: 'var(--clay)' } },
  { name: 'Quokka', tag: 'quokka', icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc)' } },
  { name: 'Low-confidence digest', tag: 'low-confidence', icoStyle: { background: 'oklch(0.20 0.012 48)', color: 'var(--ink-faint)' } },
];

export default function NotificationsPage() {
  const toast = useToast();
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState('');

  const subscribe = async (tag: string) => {
    setLoading(tag);
    try {
      await api.subscribe({ tag });
      setSubscribed(prev => new Set([...prev, tag]));
      toast.success(`Subscribed to "${tag}" alerts via SNS.`);
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

  const handleCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTag.trim()) return;
    await subscribe(customTag.trim().toLowerCase());
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
        {/* Stats */}
        <div className="stat-grid" style={{ gridTemplateColumns: '200px' }}>
          {[
            { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/></svg>, icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc)' }, val: String(subscribed.size), label: 'Active this session' },
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
                    <span className="badge badge-euc"><span className="dot" style={{ background: 'var(--euc)' }} />Subscribed</span>
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

            {/* Custom tag */}
            <div style={{ padding: '18px 20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--ink-faint)', marginBottom: '12px' }}>Subscribe to a custom species or tag:</p>
              <form onSubmit={handleCustom} style={{ display: 'flex', gap: '10px' }}>
                <input
                  className="input"
                  placeholder="e.g. echidna, wombat…"
                  value={customTag}
                  onChange={e => setCustomTag(e.target.value)}
                  style={{ flex: 1, padding: '10px 13px', fontSize: '14px' }}
                />
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
                { icon: '🔍', title: 'Species detected', desc: 'When a species matching your subscription tag is detected with ≥ 80% confidence, an event is triggered.' },
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
