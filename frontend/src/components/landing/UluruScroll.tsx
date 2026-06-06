'use client';

import { useEffect, useRef } from 'react';

/**
 * Scroll-driven Uluru landing scene. React port of the vanilla demo
 * (new/outback_uluru_scroll_landing_v3): a sticky scene that scales forward as
 * you scroll, trees drift outward, the foreground eases down, and a headline +
 * CTAs reveal once the view opens onto the monolith.
 *
 * Drives two CSS custom properties on the host element: --progress (0..1 over
 * the whole scroll) and --reveal (0..1 ramp for the late text reveal). The
 * caller passes the CTA handlers so navigation/transition wiring stays in the
 * page.
 */
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function UluruScroll({
  onPrimary,
  onSecondary,
}: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    let raf = 0;
    const update = () => {
      const rect = hero.getBoundingClientRect();
      const total = Math.max(hero.offsetHeight - window.innerHeight, 1);
      const scrolled = clamp(-rect.top, 0, total);
      const progress = clamp(scrolled / total, 0, 1);
      const reveal = clamp((progress - 0.4) / 0.22, 0, 1);
      hero.style.setProperty('--progress', progress.toFixed(4));
      hero.style.setProperty('--reveal', reveal.toFixed(4));
    };
    const onScroll = () => { raf = requestAnimationFrame(update); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <section className="uluru-hero" data-scroll-hero ref={heroRef}>
      <div className="uluru-hero__sticky">
        <div className="uluru-scene">
          {/* eslint-disable @next/next/no-img-element */}
          <img className="uluru-layer uluru-base" src="/outback-scroll/backplate.webp" alt="" />
          <img className="uluru-sprite uluru-midplain" src="/outback-scroll/layer-midplain.webp" alt=""
            style={{ '--x': '0%', '--y': '60.9116%', '--w': '100%', '--h': '26.9337%' } as React.CSSProperties} />
          <img className="uluru-sprite uluru-uluru" src="/outback-scroll/layer-uluru.webp" alt=""
            style={{ '--x': '34.6225%', '--y': '46.4088%', '--w': '37.6611%', '--h': '27.9006%' } as React.CSSProperties} />
          <img className="uluru-sprite uluru-lefttrees" src="/outback-scroll/layer-left-trees.webp" alt=""
            style={{ '--x': '0%', '--y': '0%', '--w': '32.6427%', '--h': '95.9945%' } as React.CSSProperties} />
          <img className="uluru-sprite uluru-righttrees" src="/outback-scroll/layer-right-trees.webp" alt=""
            style={{ '--x': '73.9411%', '--y': '7.8729%', '--w': '26.0589%', '--h': '82.5967%' } as React.CSSProperties} />
          <img className="uluru-sprite uluru-foreground" src="/outback-scroll/layer-foreground.webp" alt=""
            style={{ '--x': '0%', '--y': '75%', '--w': '100%', '--h': '25%' } as React.CSSProperties} />
          {/* eslint-enable @next/next/no-img-element */}
          <div className="uluru-vignette" />
        </div>

        <div className="uluru-copy uluru-copy--intro">
          <p className="uluru-eyebrow">AI Wildlife Observatory</p>
          <h1>Step into the wild.</h1>
        </div>

        <div className="uluru-copy uluru-copy--reveal">
          <p className="uluru-eyebrow">Continental-scale intelligence</p>
          <h2>Into the wild unseen.</h2>
          <p className="uluru-lede">
            AI eyes on the Australian bush. MegaDetector finds every creature; SpeciesNet names it.
            Built for the rangers, researchers and citizen scientists who watch over the world&apos;s strangest fauna.
          </p>
          <div className="uluru-actions">
            <button type="button" className="uluru-btn" onClick={onPrimary}>Request field access</button>
            <button type="button" className="uluru-btn uluru-btn--ghost" onClick={onSecondary}>Sign in</button>
          </div>
        </div>

        <div className="uluru-cue">
          <span>Descend</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
    </section>
  );
}
