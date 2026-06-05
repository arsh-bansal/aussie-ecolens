'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { SearchResult } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    api.searchByTags({ tags: {} }).then(r => {
      setResults(r.results);
      setLoadedAt(new Date());
    }).catch(() => setResults([]));
  }, []);

  const h = new Date().getHours();
  const name = user?.given_name ?? user?.email?.split('@')[0] ?? 'Researcher';
  const greeting = h >= 5 && h < 12
    ? `Good morning, ${name}. The bush is waking up.`
    : h >= 12 && h < 18
    ? `G'day, ${name}. Perfect arvo for a discovery.`
    : `Evening, ${name}. The nocturnal crew is out.`;

  // Derive stats from real results
  const total = results?.length ?? 0;
  const imageCount = results?.filter(r => r.file_type === 'image').length ?? 0;
  const videoCount = results?.filter(r => r.file_type === 'video').length ?? 0;

  // Aggregate species counts across all results
  const speciesCounts: Record<string, number> = {};
  results?.forEach(r => {
    Object.entries(r.tags ?? {}).forEach(([sp, conf]) => {
      speciesCounts[sp] = (speciesCounts[sp] ?? 0) + (conf as number);
    });
  });
  const topSpecies = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCount = topSpecies[0]?.[1] ?? 1;
  const distinctSpecies = Object.keys(speciesCounts).length;

  const INVASIVE = new Set(['Red Fox', 'Domestic Cat', 'Feral Cat', 'Wild Pig', 'European Rabbit', 'European Hare', 'Black Rat', 'House Mouse', 'Fallow Deer', 'Goat', 'Cattle']);
  const invasiveCount = topSpecies.filter(([sp]) => INVASIVE.has(sp)).reduce((s, [, c]) => s + c, 0);

  const recentFeed = results?.slice(0, 4) ?? [];

  const STATS = [
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/></svg>,
      icoStyle: { background: 'var(--ochre-tint)', color: 'var(--ochre-deep)' },
      val: results === null ? '—' : total.toLocaleString(),
      label: 'Total detections',
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3c4 4 6 7 6 10a6 6 0 01-12 0c0-3 2-6 6-10z"/></svg>,
      icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc-deep)' },
      val: results === null ? '—' : distinctSpecies.toString(),
      label: 'Distinct species',
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-4 4 3 3-3 6 5"/></svg>,
      icoStyle: { background: 'var(--gold-soft)', color: 'var(--gold)' },
      val: results === null ? '—' : imageCount.toLocaleString(),
      label: 'Images',
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
      icoStyle: { background: 'var(--clay-soft)', color: 'var(--clay)' },
      val: results === null ? '—' : videoCount.toLocaleString(),
      label: 'Videos',
    },
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title">Field overview</div>
          <div className="page-sub">Live detections across AWS &amp; Azure</div>
        </div>
        <Link href="/notifications" className="icon-btn" title="Alerts">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round"/></svg>
          <span className="ping" />
        </Link>
        <Link href="/upload" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          New upload
        </Link>
      </header>

      {/* Video hero banner */}
      <div style={{ position: 'relative', height: '240px', overflow: 'hidden', flexShrink: 0 }}>
        <video autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}>
          <source src="/dashboard-bg.mp4" type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, oklch(0.08 0.02 50 / 0.55) 0%, oklch(0.06 0.02 50 / 0.75) 60%, oklch(0.088 0.010 42) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 34px 28px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '10px' }}>AI Wildlife Observatory · Live</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(24px, 3vw, 38px)', color: '#fff', lineHeight: 1.05, textShadow: '0 2px 20px oklch(0 0 0 / 0.5)' }}>{greeting}</div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <Link href="/upload" className="btn btn-primary btn-sm">New upload</Link>
            <Link href="/search" className="btn btn-sm" style={{ background: 'oklch(1 0 0 / 0.12)', color: '#fff', border: '1px solid oklch(1 0 0 / 0.25)', backdropFilter: 'blur(6px)' }}>Search detections</Link>
          </div>
        </div>
      </div>

      <div className="page">
        {/* Stats */}
        <div className="stat-grid">
          {STATS.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat-ico" style={s.icoStyle}>{s.icon}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '20px', marginTop: '22px' }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top species */}
            <div className="panel">
              <div className="panel-head"><h3>Top species</h3><Link href="/search" className="panel-link">Search all →</Link></div>
              <div className="panel-body" style={{ paddingTop: '6px', paddingBottom: '8px' }}>
                {results === null ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '13.5px' }}>Loading…</div>
                ) : topSpecies.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '13.5px' }}>No detections yet — upload some media to get started.</div>
                ) : topSpecies.map(([sp, count]) => {
                  const isInvasive = INVASIVE.has(sp);
                  return (
                    <div key={sp} style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '13px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <span className={`badge ${isInvasive ? 'badge-clay' : 'badge-euc'}`}>
                        <span className="dot" style={{ background: isInvasive ? 'var(--clay)' : 'var(--euc)' }} />
                        {isInvasive ? 'Invasive' : 'Native'}
                      </span>
                      <span style={{ flexShrink: 0, width: '170px', fontWeight: 700, fontSize: '14px' }}>{sp}</span>
                      <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--sand-200)', overflow: 'hidden' }}>
                        <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', borderRadius: '999px', background: isInvasive ? 'var(--clay)' : 'var(--ochre)' }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-soft)', width: '48px', textAlign: 'right' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Recent feed */}
            <div className="panel">
              <div className="panel-head"><h3>Recent detections</h3><Link href="/manage" className="panel-link">Manage →</Link></div>
              <div className="panel-body" style={{ paddingTop: '6px', paddingBottom: '10px' }}>
                {results === null ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '13.5px' }}>Loading…</div>
                ) : recentFeed.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '13.5px' }}>No detections yet.</div>
                ) : recentFeed.map((r) => {
                  const topTag = Object.entries(r.tags ?? {}).sort((a, b) => b[1] - a[1])[0];
                  const sp = topTag?.[0] ?? 'Unknown';
                  const conf = topTag?.[1] ?? 0;
                  return (
                    <div key={r.file_id} style={{ display: 'flex', gap: '13px', padding: '13px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: 'var(--sand-200)', flexShrink: 0, overflow: 'hidden' }}>
                        {r.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.thumbnail_url} alt={sp} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp}</span>
                          <span className="badge badge-mute" style={{ flexShrink: 0 }}>{conf}×</span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--ink-faint)', marginTop: '3px', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file_id}</div>
                      </div>
                      <span className={`badge ${r.file_type === 'video' ? 'badge-sky' : 'badge-mute'}`} style={{ flexShrink: 0 }}>{r.file_type}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            {results !== null && results.length > 0 && (
              <div className="panel">
                <div className="panel-head"><h3>Summary</h3></div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Total files</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Distinct species</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{distinctSpecies}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Invasive detections</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: invasiveCount > 0 ? 'var(--clay)' : undefined }}>{invasiveCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Images / Videos</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{imageCount} / {videoCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sync strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px', padding: '16px 22px', marginTop: '20px', background: 'linear-gradient(100deg, var(--bark-900), var(--bark-850))', borderRadius: 'var(--r-lg)', color: 'var(--cream)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'oklch(0.40 0.02 153)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.7"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/></svg>
            </span>
            <div><div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>DynamoDB</div><div style={{ fontSize: '11.5px', color: 'var(--cream-soft)', fontFamily: 'var(--font-mono)' }}>AWS · ap-southeast-2</div></div>
          </div>
          <svg width="26" height="16" viewBox="0 0 26 16" fill="none" stroke="var(--gold)" strokeWidth="1.8"><path d="M1 8h22m0 0l-5-5m5 5l-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'oklch(0.40 0.02 153)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sky)" strokeWidth="1.7"><path d="M6 18a4 4 0 01-.5-7.97A6 6 0 0117.7 9.2 3.5 3.5 0 0118 16"/></svg>
            </span>
            <div><div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>Cosmos DB</div><div style={{ fontSize: '11.5px', color: 'var(--cream-soft)', fontFamily: 'var(--font-mono)' }}>Azure · Australia East</div></div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--cream)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: results !== null ? 'var(--euc)' : 'var(--ochre)', boxShadow: results !== null ? '0 0 0 4px oklch(0.56 0.07 156 / 0.25)' : undefined }} />
            {results === null ? 'Connecting…' : `${total} records · loaded ${loadedAt?.toLocaleTimeString()}`}
          </div>
        </div>
      </div>
    </>
  );
}
