import React, { useEffect, useMemo, useRef, useState } from "react";

type RulerBarProps = {
  /** Toplam süre (sn) */
  duration: number;
  /** Timeline’ın scroll ettiği viewport (senkron tutar) */
  viewportRef: React.RefObject<HTMLDivElement>;
  /** Editörde kullanılan px/sn referansı */
  pxPerSecRef: React.MutableRefObject<number>;
  /** Zoom değiştikçe yeniden hesaplamak için tetik */
  zoom: number;
  /** İsteğe bağlı yükseklik */
  height?: number;
};

/**
 * Hafif (div-tabanlı) cetvel:
 * - Yalnızca görünür pencere içinde tick render eder (performanslı)
 * - Zoom artınca ms gösterir
 * - Verilen viewport’un scroll’u ile senkron kayar
 */
export default function RulerBar({
  duration,
  viewportRef,
  pxPerSecRef,
  zoom,
  height = 28,
}: RulerBarProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  // Major tick aralığını seç (ekranda ~70px aralık hedefi)
  const chooseMajorStep = (pxPerSec: number) => {
    const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const targetPx = 70;
    let best = steps[0];
    for (const s of steps) {
      if (s * pxPerSec >= targetPx) { best = s; break; }
      best = s;
    }
    return best;
  };

  const formatLabel = (t: number, pxPerSec: number) => {
    t = Math.max(0, t);
    const hours = Math.floor(t / 3600);
    const mins = Math.floor((t % 3600) / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t - Math.floor(t)) * 1000);
    const showMs = pxPerSec >= 250; // yeterince zoom yapınca ms göster

    const hh = hours > 0 ? String(hours).padStart(2, "0") + ":" : "";
    const mm = String(mins).padStart(2, "0");
    const ss = String(secs).padStart(2, "0");
    if (showMs) return `${hh}${mm}:${ss}.${String(ms).padStart(3, "0")}`;
    return `${hh}${mm}:${ss}`;
  };

  // Scroll/zoom/resize olduğunda yeniden hesapla
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onScroll = () => force(v => v + 1);
    vp.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => force(v => v + 1));
    ro.observe(vp);

    return () => {
      vp.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [viewportRef]);

  // Kendi genişliğimiz değişirse de yeniden hesapla
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => force(v => v + 1));
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const ticks = useMemo(() => {
    const vp = viewportRef.current;
    const pxPerSec = pxPerSecRef.current;
    if (!vp || !hostRef.current || pxPerSec <= 0) return [] as any[];

    const viewW = vp.clientWidth;
    const left = vp.scrollLeft;
    const padPx = 80; // kenarların biraz ötesini de çiz
    const startT = clamp((left - padPx) / pxPerSec, 0, duration);
    const endT = clamp((left + viewW + padPx) / pxPerSec, 0, duration);

    const major = chooseMajorStep(pxPerSec);
    const minor = major / 5;

    const firstMajor = Math.floor(startT / major) * major;
    const firstMinor = Math.floor(startT / minor) * minor;

    const out: { px: number; label?: string; big: boolean }[] = [];

    // minor ticks
    for (let t = firstMinor; t <= endT + 1e-6; t += minor) {
      const px = t * pxPerSec;
      if (px < left - padPx || px > left + viewW + padPx) continue;
      out.push({ px, big: false });
    }

    // major ticks + etiket
    for (let t = firstMajor; t <= endT + 1e-6; t += major) {
      const px = t * pxPerSec;
      if (px < left - padPx || px > left + viewW + padPx) continue;
      out.push({ px, big: true, label: formatLabel(t, pxPerSec) });
    }

    out.sort((a, b) => a.px - b.px);
    return out;
  }, [viewportRef, pxPerSecRef.current, zoom, duration]);

  const vp = viewportRef.current;
  const left = vp?.scrollLeft ?? 0;

  return (
    <div
      ref={hostRef}
      className="relative w-full select-none border-b border-white/10 bg-[rgba(10,10,10,0.9)]"
      style={{ height }}
    >
      <div className="absolute inset-0">
        {ticks.map((t, i) => {
          const localLeft = t.px - left; // viewport scroll kompanzasyonu
          return (
            <div key={i} className="absolute bottom-0" style={{ left: localLeft }}>
              <div
                style={{ height: t.big ? height : Math.round(height * 0.45), width: 1 }}
                className="bg-white/30"
              />
              {t.label && (
                <div
                  className="absolute"
                  style={{
                    transform: "translate(-50%, -100%)",
                    bottom: t.big ? height : Math.round(height * 0.45),
                    whiteSpace: "nowrap",
                    fontSize: 11,
                    opacity: 0.9,
                  }}
                >
                  {t.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
