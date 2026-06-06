'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const SPECIES = ['koala', 'kangaroo', 'dingo', 'cassowary', 'wombat', 'platypus', 'echidna', 'quokka'];

const FEATURES = [
  {
    title: 'Automated identification',
    body: 'A two-stage computer-vision pipeline detects animals and classifies the species in every image and video you contribute.',
  },
  {
    title: 'A searchable catalogue',
    body: 'Every observation becomes a structured record — searchable by species, by tag, or by a sample file you already have.',
  },
  {
    title: 'Built for collaboration',
    body: 'Researchers, rangers and citizen scientists work from one shared, organised record of wildlife across the continent.',
  },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  return (
    <div className="lp">
      {/* Top navbar */}
      <nav className="lp-nav">
        <Link href="/" className="lp-brand" aria-label="Aussie EcoLens — home">
          <span className="lp-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" strokeLinecap="round"/></svg>
          </span>
          <span>
            <span className="lp-brand-name">Aussie EcoLens</span>
            <span className="lp-brand-sub">Wildlife Observatory</span>
          </span>
        </Link>
        <div className="lp-nav-actions">
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">Request access</Link>
        </div>
      </nav>

      {/* Full-bleed hero */}
      <header className="lp-hero">
        <div className="lp-hero-bg" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-wallaby.jpg" alt="" className="lp-hero-img" />
          <div className="lp-hero-scrim" />
        </div>
        <div className="lp-hero-copy">
          <div className="lp-eyebrow">Australian Wildlife Observatory</div>
          <h1 className="lp-title">Wildlife observation, organised.</h1>
          <p className="lp-lede">
            A computer-vision platform for identifying and cataloguing Australian fauna at scale —
            turning field imagery into structured, searchable ecological records.
          </p>
          <div className="lp-hero-actions">
            <Link href="/signup" className="btn btn-primary btn-lg">Request field access</Link>
            <Link href="/login" className="btn btn-ghost btn-lg">Sign in</Link>
          </div>
        </div>
      </header>

      {/* Feature sections */}
      <section className="lp-features">
        {FEATURES.map((f, i) => (
          <div key={i} className="lp-feature card">
            <div className="lp-feature-num">{String(i + 1).padStart(2, '0')}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </section>

      {/* Species strip */}
      <section className="lp-species">
        <div className="lp-eyebrow" style={{ textAlign: 'center' }}>Trained on native species</div>
        <div className="lp-species-grid">
          {SPECIES.map((s) => (
            <div key={s} className="lp-species-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/wildlife/${s}.jpg`} alt={s} />
              <span>{s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="lp-cta">
        <h2>Start cataloguing the field.</h2>
        <p>Create an account to upload, identify and search your wildlife observations.</p>
        <Link href="/signup" className="btn btn-primary btn-lg">Request field access</Link>
      </section>

      <footer className="lp-foot">
        <div className="lp-foot-row">
          <span>Aussie EcoLens — FIT5225 Wildlife Observatory</span>
          <nav className="lp-foot-links">
            <Link href="/policy">Privacy</Link>
            <Link href="/policy">Legal</Link>
          </nav>
        </div>
        <p className="lp-foot-credit">
          Hero photo by{' '}
          <a href="https://www.pexels.com/photo/close-up-of-small-wallaby-18562264/" target="_blank" rel="noopener noreferrer">Yanming Guo</a>
          {' '}on Pexels.
        </p>
      </footer>
    </div>
  );
}
