'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const STATS = [
  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/></svg>, icoStyle: { background: 'var(--ochre-tint)', color: 'var(--ochre-deep)' }, val: '8,412', label: 'Detections this week', trend: '▲ 12.4% vs last week', trendUp: true },
  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3c4 4 6 7 6 10a6 6 0 01-12 0c0-3 2-6 6-10z"/></svg>, icoStyle: { background: 'var(--euc-tint)', color: 'var(--euc-deep)' }, val: '147', label: 'Distinct species', trend: '▲ 6 new this month', trendUp: true },
  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>, icoStyle: { background: 'var(--gold-soft)', color: 'var(--gold)' }, val: '38', label: 'Awaiting review', trend: 'low-confidence tags', trendUp: false },
  { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6l3 14h12l3-14"/><path d="M3 6h18M8 6V4h8v2"/></svg>, icoStyle: { background: 'var(--clay-soft)', color: 'var(--clay)' }, val: '21', label: 'Invasive sightings', trend: '▲ foxes near Wilsons Prom', trendUp: false },
];

const BARS = [
  { day: 'Wed', h: '46%', peak: false },
  { day: 'Thu', h: '62%', peak: false },
  { day: 'Fri', h: '54%', peak: false },
  { day: 'Sat', h: '78%', peak: false },
  { day: 'Sun', h: '100%', peak: true },
  { day: 'Mon', h: '71%', peak: false },
  { day: 'Tue', h: '58%', peak: false },
];

const TOP_SPECIES = [
  { badge: 'Native', badgeCls: 'badge-euc', dotColor: 'var(--euc)', name: 'Eastern Grey Kangaroo', pct: '100%', barColor: 'var(--ochre)', count: '1,284' },
  { badge: 'Native', badgeCls: 'badge-euc', dotColor: 'var(--euc)', name: 'Laughing Kookaburra', pct: '74%', barColor: 'var(--ochre)', count: '948' },
  { badge: 'Vuln.', badgeCls: 'badge-gold', dotColor: 'var(--gold)', name: 'Koala', pct: '51%', barColor: 'var(--ochre)', count: '662' },
  { badge: 'Native', badgeCls: 'badge-euc', dotColor: 'var(--euc)', name: 'Short-beaked Echidna', pct: '40%', barColor: 'var(--ochre)', count: '517' },
  { badge: 'Invasive', badgeCls: 'badge-clay', dotColor: 'var(--clay)', name: 'Red Fox', pct: '21%', barColor: 'var(--clay)', count: '271' },
];

const FEED = [
  { sp: 'Southern Cassowary', conf: '98%', confCls: 'badge-gold', meta: 'CT-114 · Daintree NP', time: '2m ago' },
  { sp: 'Common Wombat', conf: '96%', confCls: 'badge-euc', meta: 'CT-038 · Cradle Mtn', time: '14m ago' },
  { sp: 'Feral Cat', conf: 'invasive', confCls: 'badge-clay', meta: 'CT-091 · Kakadu', time: '31m ago' },
  { sp: 'Quokka', conf: '99%', confCls: 'badge-euc', meta: 'CT-007 · Rottnest Is.', time: '48m ago' },
];

export default function DashboardPage() {
  const { user } = useAuth();
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
        {/* Stats */}
        <div className="stat-grid">
          {STATS.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat-ico" style={s.icoStyle}>{s.icon}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
              <div className={`stat-trend ${s.trendUp ? 'trend-up' : 'trend-down'}`}>{s.trend}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '20px', marginTop: '22px' }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Chart */}
            <div className="panel">
              <div className="panel-head">
                <h3>Detection activity</h3>
                <div style={{ display: 'flex', gap: '18px', marginLeft: 'auto' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--ink-soft)' }}><i style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--euc)', display: 'inline-block' }}></i>Native</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--ink-soft)' }}><i style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--ochre)', display: 'inline-block' }}></i>Peak day</span>
                </div>
              </div>
              <div className="panel-body">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '200px', padding: '8px 4px 0' }}>
                  {BARS.map((b) => (
                    <div key={b.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', maxWidth: '34px', borderRadius: '7px 7px 3px 3px', height: b.h, background: b.peak ? 'linear-gradient(180deg, var(--ochre) 0%, var(--ochre-deep) 100%)' : 'linear-gradient(180deg, var(--euc) 0%, var(--euc-deep) 100%)' }} />
                      <span style={{ fontSize: '11.5px', color: 'var(--ink-faint)', fontWeight: 500 }}>{b.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top species */}
            <div className="panel">
              <div className="panel-head"><h3>Top species this week</h3><Link href="/search" className="panel-link">View all →</Link></div>
              <div className="panel-body" style={{ paddingTop: '6px', paddingBottom: '8px' }}>
                {TOP_SPECIES.map((s) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '13px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <span className={`badge ${s.badgeCls}`}><span className="dot" style={{ background: s.dotColor }} />{s.badge}</span>
                    <span style={{ flexShrink: 0, width: '170px', fontWeight: 700, fontSize: '14px' }}>{s.name}</span>
                    <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--sand-200)', overflow: 'hidden' }}>
                      <div style={{ width: s.pct, height: '100%', borderRadius: '999px', background: s.barColor }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-soft)', width: '48px', textAlign: 'right' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Recent feed */}
            <div className="panel">
              <div className="panel-head"><h3>Recent detections</h3><Link href="/manage" className="panel-link">Manage →</Link></div>
              <div className="panel-body" style={{ paddingTop: '6px', paddingBottom: '10px' }}>
                {FEED.map((f) => (
                  <div key={f.sp + f.time} style={{ display: 'flex', gap: '13px', padding: '13px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: 'var(--sand-200)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{f.sp}</span>
                        <span className={`badge ${f.confCls}`}>{f.conf}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--ink-faint)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>{f.meta}</div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--ink-ghost)', whiteSpace: 'nowrap' }}>{f.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts */}
            <div className="panel">
              <div className="panel-head"><h3>Active alerts</h3><Link href="/notifications" className="panel-link">Configure →</Link></div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: 'var(--clay-soft)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clay)" strokeWidth="1.8"><path d="M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Red Fox in protected zone</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>SNS email sent · 3 recipients</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--ink-ghost)' }}>31m</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: 'var(--euc-tint)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--euc-deep)" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.4 2.4 4.6-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Cassowary watch · Daintree</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>Target species spotted</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--ink-ghost)' }}>2m</span>
                </div>
              </div>
            </div>
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
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--euc)', boxShadow: '0 0 0 4px oklch(0.56 0.07 156 / 0.25)' }} />
            Replication healthy · last sync 12s ago
          </div>
        </div>
      </div>
    </>
  );
}
