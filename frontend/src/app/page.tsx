'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const worldRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const curtainLRef = useRef<HTMLDivElement>(null);
  const curtainRRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const scene2Ref = useRef<HTMLDivElement>(null);
  const scene2veilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));
    const MAG = { world: 6, portal: 7, curtainL: 14, curtainR: 14 };

    let target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let entranceStart: number | null = null;
    let raf: number;

    const mouseMoveHandler = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', mouseMoveHandler, { passive: true });

    setTimeout(() => { entranceStart = performance.now(); }, 100);
    setTimeout(() => { document.body.classList.add('landing-ready'); }, 600);

    function scrollProgress() {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      return h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
    }

    function render() {
      cur.x = lerp(cur.x, target.x, 0.07);
      cur.y = lerp(cur.y, target.y, 0.07);
      const rx = cur.x, ry = cur.y;
      const sp = scrollProgress();
      const e = easeInOut(sp);

      if (worldRef.current) {
        const s = lerp(1, 1.18, sp);
        worldRef.current.style.transform = `scale(${s}) translate3d(${rx * MAG.world}px,${ry * MAG.world}px,0)`;
      }
      if (portalRef.current) {
        // Uluru starts tiny/far and zooms in to a standard size as you scroll.
        const s = lerp(0.18, 1, e);
        portalRef.current.style.transform = `scale(${s}) translate3d(${rx * MAG.portal}px,${ry * MAG.portal}px,0)`;
        portalRef.current.style.opacity = String(clamp(sp / 0.12, 0, 1));
      }
      if (curtainLRef.current && curtainRRef.current) {
        let openAmt = 0;
        if (entranceStart !== null) openAmt = clamp((performance.now() - entranceStart) / 1400, 0, 1);
        openAmt = easeInOut(openAmt);
        const shift = openAmt * 62 + e * (150 - 62);
        const cs = lerp(1, 1.3, e);
        curtainLRef.current.style.transform = `translateX(calc(-${shift}% + ${rx * MAG.curtainL}px)) translateY(${ry * MAG.curtainL * 0.3}px) scale(${cs}) translateZ(0)`;
        curtainRRef.current.style.transform = `translateX(calc(${shift}% + ${rx * MAG.curtainR}px)) translateY(${ry * MAG.curtainR * 0.3}px) scale(${cs}) translateZ(0)`;
      }
      if (heroRef.current) {
        heroRef.current.style.opacity = String(clamp(1 - sp / 0.22, 0, 1));
        heroRef.current.style.pointerEvents = sp < 0.2 ? 'auto' : 'none';
      }
      if (scene2Ref.current) {
        const s2 = clamp((sp - 0.68) / 0.16, 0, 1);
        scene2Ref.current.style.opacity = String(s2);
        scene2Ref.current.style.pointerEvents = s2 > 0.5 ? 'auto' : 'none';
        scene2Ref.current.classList.toggle('in', s2 > 0.35);
        if (scene2veilRef.current) scene2veilRef.current.style.opacity = String(s2);
      }
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', mouseMoveHandler);
      document.body.classList.remove('landing-ready');
    };
  }, []);

  const navTo = (href: string) => {
    const el = document.getElementById('page-exit');
    if (el) { el.style.opacity = '1'; el.style.pointerEvents = 'all'; }
    setTimeout(() => router.push(href), 500);
  };

  if (isLoading) return null;

  return (
    <>
      <style>{`
        .landing-ready .hero-inner { opacity: 1 !important; transform: translateY(0) !important; transition: opacity .9s ease .3s, transform .9s ease .3s; }
        .landing-ready nav { opacity: 1 !important; }
        nav { opacity: 0; transition: opacity .9s ease .6s; }
        .hero-inner { opacity: 0; transform: translateY(20px); }
        @keyframes bobUp { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
        @keyframes ctaPulse { 0%,100%{box-shadow:0 6px 24px oklch(0.55 0.13 46 / 0.4),0 0 0 0 oklch(0.69 0.135 56 / 0.5);} 50%{box-shadow:0 6px 24px oklch(0.55 0.13 46 / 0.4),0 0 0 10px oklch(0.69 0.135 56 / 0);} }
        @keyframes s2Rise { from{opacity:0;transform:translateY(26px);} to{opacity:1;transform:translateY(0);} }
        .scene2.in .s2-eyebrow { animation: s2Rise .7s cubic-bezier(.2,.8,.2,1) both .05s; }
        .scene2.in h2 { animation: s2Rise .8s cubic-bezier(.2,.8,.2,1) both .15s; }
        .scene2.in p { animation: s2Rise .8s cubic-bezier(.2,.8,.2,1) both .28s; }
        .scene2.in .s2-btn-1 { animation: s2Rise .7s cubic-bezier(.2,.8,.2,1) both .42s; }
        .scene2.in .s2-btn-2 { animation: s2Rise .7s cubic-bezier(.2,.8,.2,1) both .52s; }
        .cta-primary { animation: ctaPulse 2.6s ease-out infinite; }
        .cta-primary:hover { animation-play-state: paused; }
        .hero-cta { position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:10px;font-family:var(--font-body);font-size:12.5px;letter-spacing:0.12em;text-transform:uppercase;background:var(--ochre);color:#fff;border:none;padding:14px 26px;border-radius:999px;cursor:pointer;box-shadow:0 6px 24px oklch(0.55 0.13 46 / 0.4);transition:background .25s,transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .25s; }
        .hero-cta:hover { background:var(--ochre-deep);transform:translateY(-2px);box-shadow:0 12px 34px oklch(0.55 0.13 46 / 0.5); }
        .hero-cta::before { content:'';position:absolute;top:0;left:-130%;width:55%;height:100%;background:linear-gradient(100deg,transparent,oklch(1 0 0 / 0.45),transparent);transform:skewX(-18deg);transition:left .6s cubic-bezier(.2,.8,.2,1); }
        .hero-cta:hover::before { left:150%; }
        #page-exit { position:fixed;inset:0;z-index:300;background:#0a0608;opacity:0;pointer-events:none;transition:opacity .5s ease; }
      `}</style>

      <div style={{ height: '480vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', width: '100%', overflow: 'hidden', background: '#0a0608' }}>

          {/* World layer — static outback panorama */}
          <div ref={worldRef} style={{ position: 'absolute', inset: 0, willChange: 'transform', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: 1, transformOrigin: 'center center', backgroundImage: `url('/outback-scroll/background.png'), radial-gradient(130% 100% at 50% 18%, oklch(0.34 0.055 62) 0%, oklch(0.15 0.03 52) 46%, oklch(0.075 0.018 48) 78%)` }} />

          {/* Portal layer — Uluru cutout */}
          <div ref={portalRef} style={{ position: 'absolute', inset: 0, willChange: 'transform,opacity', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: 2, transformOrigin: '50% 62%', backgroundImage: `url('/outback-scroll/uluru-cutout.png')` }} />

          {/* Left curtain — eucalyptus tree */}
          <div ref={curtainLRef} style={{ position: 'absolute', top: '-6%', bottom: '-6%', width: '52%', left: '-6%', zIndex: 3, willChange: 'transform', transformOrigin: 'left center', backgroundSize: 'contain', backgroundPosition: 'left bottom', backgroundRepeat: 'no-repeat', backgroundImage: `url('/outback-scroll/euc-left.webp')` }} />

          {/* Right curtain — eucalyptus tree */}
          <div ref={curtainRRef} style={{ position: 'absolute', top: '-6%', bottom: '-6%', width: '52%', right: '-6%', zIndex: 3, willChange: 'transform', transformOrigin: 'right center', backgroundSize: 'contain', backgroundPosition: 'right bottom', backgroundRepeat: 'no-repeat', backgroundImage: `url('/outback-scroll/euc-right.webp')` }} />

          {/* Vignette */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', background: 'radial-gradient(120% 100% at 50% 42%, transparent 52%, oklch(0.04 0.02 50 / 0.55) 100%), linear-gradient(180deg, oklch(0.05 0.02 50 / 0.45) 0%, transparent 22%, transparent 70%, oklch(0.045 0.02 50 / 0.7) 100%)' }} />

          {/* Nav */}
          <nav style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 48px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid oklch(1 0 0 / 0.35)', display: 'grid', placeItems: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.4"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" strokeLinecap="round"/></svg>
            </div>
          </nav>

          {/* Hero */}
          <div ref={heroRef} style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            <div className="hero-inner" style={{ position: 'absolute', inset: 0 }}>
              <div style={{ position: 'absolute', top: '46%', left: '60px', transform: 'translateY(-50%)', maxWidth: '440px' }}>
                <div style={{ fontSize: '11px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'oklch(0.810 0.118 84)' }}>AI Wildlife Observatory</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(46px,6vw,86px)', lineHeight: 0.98, letterSpacing: '0.01em', margin: '18px 0 0', textShadow: '0 4px 40px oklch(0.05 0.02 50 / 0.6)', color: '#fff' }}>
                  STEP<span style={{ color: 'var(--ochre)', padding: '0 .12em' }}>›</span>INTO THE WILD
                </h1>
                <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'oklch(0.94 0.01 80 / 0.82)', marginTop: '20px', maxWidth: '400px' }}>
                  AI eyes on the Australian bush. MegaDetector finds every creature; SpeciesNet names it. Scroll to cross the threshold.
                </p>
              </div>

              {/* Scroll cue */}
              <div style={{ position: 'absolute', bottom: '36px', left: '50%', transform: 'translateX(-50%)', zIndex: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'oklch(1 0 0 / 0.6)' }}>Descend</span>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid oklch(1 0 0 / 0.35)', display: 'grid', placeItems: 'center', animation: 'bobUp 1.8s ease-in-out infinite' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Scene 2 veil */}
          <div ref={scene2veilRef} style={{ position: 'absolute', inset: 0, zIndex: 45, opacity: 0, pointerEvents: 'none', background: 'radial-gradient(120% 100% at 50% 45%, oklch(0.05 0.02 50 / 0.30) 0%, oklch(0.05 0.02 50 / 0.62) 70%, oklch(0.04 0.02 50 / 0.82) 100%), linear-gradient(180deg, oklch(0.04 0.02 50 / 0.55) 0%, transparent 30%, transparent 64%, oklch(0.04 0.02 50 / 0.7) 100%)' }} />

          {/* Scene 2 */}
          <div ref={scene2Ref} className="scene2" style={{ position: 'absolute', inset: 0, zIndex: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0, pointerEvents: 'none', padding: '0 24px' }}>
            <div className="s2-eyebrow" style={{ fontSize: '11px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'oklch(0.810 0.118 84)' }}>Continental-scale intelligence</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(38px,5.4vw,78px)', color: '#fff', letterSpacing: '0.03em', lineHeight: 1.05, margin: '16px 0 0', textShadow: '0 2px 20px oklch(0 0 0 / 0.4)' }}>INTO THE WILD UNSEEN</h2>
            <p style={{ fontSize: '20px', maxWidth: '480px', lineHeight: 1.6, color: 'oklch(1 0 0 / 0.82)', margin: '20px 0 0' }}>
              Singular eyes on astonishing creatures, built for the rangers, researchers and citizen scientists who watch over the world&apos;s strangest fauna.
            </p>
            <div style={{ display: 'flex', gap: '14px', marginTop: '30px' }}>
              <button className="hero-cta cta-primary s2-btn-1" onClick={() => navTo('/signup')}>
                Request field access
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M5 12h14m0 0l-5-5m5 5l-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="hero-cta s2-btn-2" style={{ background: 'transparent', border: '1px solid oklch(1 0 0 / 0.4)', boxShadow: 'none' }} onClick={() => navTo('/login')}>
                Sign in
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M5 12h14m0 0l-5-5m5 5l-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="page-exit" />
    </>
  );
}
