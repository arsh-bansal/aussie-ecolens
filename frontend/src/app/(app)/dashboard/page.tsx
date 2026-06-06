'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { SearchResult } from '@/types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function topTag(record: SearchResult): [string, number] {
  const entries = Object.entries(record.tags ?? {});
  if (!entries.length) return ['Unknown species', 0];
  return entries.sort((a, b) => b[1] - a[1])[0];
}

function aggregateSpecies(records: SearchResult[]) {
  const counts: Record<string, number> = {};
  for (const r of records) {
    for (const [tag, n] of Object.entries(r.tags ?? {})) {
      counts[tag] = (counts[tag] ?? 0) + n;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function uploadsLast7Days(records: SearchResult[]) {
  const buckets = Array.from({ length: 7 }, () => 0);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  for (const r of records) {
    if (!r.uploaded_at) continue;
    const d = new Date(r.uploaded_at);
    if (Number.isNaN(d.getTime()) || d < start) continue;
    const dayIndex = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
    if (dayIndex >= 0 && dayIndex < 7) buckets[dayIndex]++;
  }
  const max = Math.max(...buckets, 1);
  return buckets.map((count, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      day: DAY_LABELS[date.getDay()],
      count,
      h: `${Math.round((count / max) * 100)}%`,
      peak: count === max && count > 0,
    };
  });
}

function timeAgo(iso?: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '—';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.listFiles();
        if (!cancelled) setRecords(res.results);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load observatory data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const speciesCounts = useMemo(() => aggregateSpecies(records), [records]);
  const distinctSpecies = speciesCounts.length;
  const imageCount = records.filter(r => r.file_type === 'image').length;
  const videoCount = records.filter(r => r.file_type === 'video').length;
  const bars = useMemo(() => uploadsLast7Days(records), [records]);
  const recent = useMemo(
    () =>
      [...records]
        .sort((a, b) => {
          const ta = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
          const tb = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 5),
    [records],
  );

  const topSpecies = speciesCounts.slice(0, 5);
  const topMax = topSpecies[0]?.[1] ?? 1;

  const stats = [
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/></svg>,
      icoStyle: { background: 'var(--ochre-tint)', color: 'var(--ochre-deep)' },
      val: loading ? '…' : String(records.length),
      label: 'Total detections',
      trend: loading ? '' : `${imageCount} images · ${videoCount} videos`,
      trendUp: true,
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3c4 4 6 7 6 10a6 6 0 01-12 0c0-3 2-6 6-10z"/></svg>,
      icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc-deep)' },
      val: loading ? '…' : String(distinctSpecies),
      label: 'Distinct species',
      trend: 'from live ML tags',
      trendUp: true,
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-4 4 3 3-3 6 5"/></svg>,
      icoStyle: { background: 'var(--gold-soft)', color: 'var(--gold)' },
      val: loading ? '…' : String(imageCount),
      label: 'Images',
      trend: 'in observatory',
      trendUp: true,
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7l2 10h12l2-10"/><path d="M8 7V5h8v2"/></svg>,
      icoStyle: { background: 'var(--clay-soft)', color: 'var(--clay)' },
      val: loading ? '…' : String(videoCount),
      label: 'Videos',
      trend: 'frame-tagged media',
      trendUp: false,
    },
  ];

  const h = new Date().getHours();
  const name = user?.given_name ?? user?.email?.split('@')[0] ?? 'Researcher';
  const greeting = h >= 5 && h < 12
    ? `Good morning, ${name}. The bush is waking up.`
    : h >= 12 && h < 18
    ? `G'day, ${name}. Perfect arvo for a discovery.`
    : `Evening, ${name}. The nocturnal crew is out.`;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title">Field overview</div>
          <div className="page-sub">{greeting}</div>
        </div>
        <div className="topbar-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" strokeLinecap="round"/></svg>
          <input placeholder="Search species, stations, uploads…" />
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

      <div className="page">
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--clay-soft)', color: 'var(--clay)', fontSize: '14px', marginBottom: '16px' }}>{error}</div>
        )}

        <div className="stat-grid">
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat-ico" style={s.icoStyle}>{s.icon}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
              {s.trend && <div className={`stat-trend ${s.trendUp ? 'trend-up' : 'trend-down'}`}>{s.trend}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '20px', marginTop: '22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel">
              <div className="panel-head">
                <h3>Upload activity</h3>
                <span style={{ fontSize: '12.5px', color: 'var(--ink-faint)' }}>Last 7 days</span>
              </div>
              <div className="panel-body">
                {loading ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading…</div>
                ) : records.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>
                    No uploads yet. <Link href="/upload" style={{ color: 'var(--ochre)' }}>Upload wildlife media →</Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '200px', padding: '8px 4px 0' }}>
                    {bars.map((b) => (
                      <div key={b.day + b.count} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ width: '100%', maxWidth: '34px', borderRadius: '7px 7px 3px 3px', height: b.h, minHeight: b.count > 0 ? '8px' : '4px', background: b.peak ? 'linear-gradient(180deg, var(--ochre) 0%, var(--ochre-deep) 100%)' : 'linear-gradient(180deg, var(--euc) 0%, var(--euc-deep) 100%)' }} />
                        <span style={{ fontSize: '11.5px', color: 'var(--ink-faint)', fontWeight: 500 }}>{b.day}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h3>Top species</h3><Link href="/search" className="panel-link">Search →</Link></div>
              <div className="panel-body" style={{ paddingTop: '6px', paddingBottom: '8px' }}>
                {loading ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading…</div>
                ) : topSpecies.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>No species tagged yet</div>
                ) : (
                  topSpecies.map(([name, count]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '13px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <span style={{ flexShrink: 0, width: '170px', fontWeight: 700, fontSize: '14px' }}>{name}</span>
                      <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--sand-200)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((count / topMax) * 100)}%`, height: '100%', borderRadius: '999px', background: 'var(--ochre)' }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-soft)', width: '48px', textAlign: 'right' }}>{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel">
              <div className="panel-head"><h3>Recent detections</h3><Link href="/manage" className="panel-link">Manage →</Link></div>
              <div className="panel-body" style={{ paddingTop: '6px', paddingBottom: '10px' }}>
                {loading ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading…</div>
                ) : recent.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>No detections yet</div>
                ) : (
                  recent.map((r) => {
                    const [species, conf] = topTag(r);
                    return (
                      <div key={r.file_id} style={{ display: 'flex', gap: '13px', padding: '13px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
                        <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: 'var(--sand-200)', flexShrink: 0, overflow: 'hidden' }}>
                          {r.thumbnail_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={r.thumbnail_url} alt={species} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px' }}>{species}</span>
                            <span className="badge badge-euc">{conf}×</span>
                            <span className={`badge ${r.file_type === 'video' ? 'badge-sky' : 'badge-mute'}`}>{r.file_type}</span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--ink-faint)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                            {r.file_id.slice(0, 18)}…
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--ink-ghost)', whiteSpace: 'nowrap' }}>{timeAgo(r.uploaded_at)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h3>Quick actions</h3></div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link href="/upload" className="btn btn-primary" style={{ justifyContent: 'center' }}>Upload new media</Link>
                <Link href="/search" className="btn btn-ghost" style={{ justifyContent: 'center' }}>Search observatory</Link>
                <Link href="/notifications" className="btn btn-ghost" style={{ justifyContent: 'center' }}>Configure tag alerts</Link>
              </div>
            </div>
          </div>
        </div>

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
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--euc)', boxShadow: '0 0 0 4px oklch(0.56 0.07 156 / 0.25)' }} />
            {loading ? 'Loading observatory…' : `${records.length} records in shared catalogue`}
          </div>
        </div>
      </div>
    </>
  );
}
