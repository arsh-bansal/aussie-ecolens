'use client';

import { useEffect, useRef } from 'react';

/**
 * Interactive outback parallax background for the auth screens.
 * React port of the vanilla demo (new/outback_js_background_v4): layered webp
 * sprites drift with pointer movement, scroll, and a slow auto sine-sway.
 * The rAF loop + listeners are torn down on unmount.
 *
 * Replaces the previous AuthVideo background.
 */

type LayerDef = {
  cls: string;
  src: string;
  x: number; y: number;
  scrollX: number; scrollY: number;
  drift: number;
};

const LAYERS: LayerDef[] = [
  { cls: 'ob-base',       src: '/outback-bg/backplate.webp',        x: -0.22, y: -0.05, scrollX: 0.22,  scrollY: 0.05,  drift: -0.8 },
  { cls: 'ob-mountains',  src: '/outback-bg/layer-mountains.webp',  x: 0.75,  y: 0.10,  scrollX: -0.45, scrollY: -0.05, drift: 1.2 },
  { cls: 'ob-water',      src: '/outback-bg/layer-water.webp',      x: 1.2,   y: 0.16,  scrollX: -0.65, scrollY: -0.08, drift: 1.7 },
  { cls: 'ob-lefttrees',  src: '/outback-bg/layer-left-trees.webp', x: 2.0,   y: 0.30,  scrollX: -1.15, scrollY: -0.15, drift: 2.8 },
  { cls: 'ob-righttrees', src: '/outback-bg/layer-right-trees.webp',x: 1.9,   y: 0.28,  scrollX: -1.05, scrollY: -0.14, drift: 2.7 },
  { cls: 'ob-foreground', src: '/outback-bg/layer-foreground.webp', x: 3.8,   y: 0.72,  scrollX: -2.2,  scrollY: -0.36, drift: 4.3 },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function OutbackBackground({
  pointerStrength = 1,
  scrollStrength = 0.8,
  autoStrength = 1,
}: {
  pointerStrength?: number;
  scrollStrength?: number;
  autoStrength?: number;
}) {
  const layerRefs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const EASING = 0.07;
    const AUTO_DURATION = 52000;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let scroll = 0;
    let raf = 0;

    const onPointerMove = (e: PointerEvent) => {
      const w = Math.max(window.innerWidth, 1);
      const h = Math.max(window.innerHeight, 1);
      target.x = clamp((e.clientX / w - 0.5) * 2, -1, 1);
      target.y = clamp((e.clientY / h - 0.5) * 2, -1, 1);
    };
    const onScroll = () => {
      const vp = Math.max(window.innerHeight, 1);
      scroll = clamp((window.scrollY || 0) / vp, 0, 1.15);
    };

    const tick = (time: number) => {
      const reduced = reducedMotion.matches;
      current.x += (target.x - current.x) * EASING;
      current.y += (target.y - current.y) * EASING;

      const auto = reduced ? 0 : Math.sin((time / AUTO_DURATION) * Math.PI * 2);
      const px = reduced ? 0 : current.x * pointerStrength;
      const py = reduced ? 0 : current.y * pointerStrength;
      const sc = reduced ? 0 : scroll * scrollStrength;
      const am = reduced ? 0 : auto * autoStrength;

      LAYERS.forEach((layer, i) => {
        const el = layerRefs.current[i];
        if (!el) return;
        const tx = px * layer.x + sc * layer.scrollX + am * layer.drift;
        const ty = py * layer.y + sc * layer.scrollY;
        el.style.setProperty('--ob-x', `${tx.toFixed(2)}px`);
        el.style.setProperty('--ob-y', `${ty.toFixed(2)}px`);
      });
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [pointerStrength, scrollStrength, autoStrength]);

  return (
    <div className="outback-bg" aria-hidden="true">
      <div className="outback-bg__stage">
        {LAYERS.map((layer, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={layer.cls}
            ref={(el) => { layerRefs.current[i] = el; }}
            className={`outback-bg__layer ${layer.cls}`}
            src={layer.src}
            alt=""
          />
        ))}
      </div>
      <div className="outback-bg__shade" />
    </div>
  );
}
