'use client';

import { useState } from 'react';

type RightPanelProps = {
  onTogglePlay: () => void;
};

export default function RightPanel({ onTogglePlay }: RightPanelProps) {
  // Sadece lokal, görsel slider değerleri (global store yok)
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturate, setSaturate] = useState(1);
  const [hue, setHue] = useState(0);

  return (
    <aside className="bg-[#1a1a1a] border-l border-gray-700 p-3 space-y-4">
      <button
        onClick={onTogglePlay}
        className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg w-full"
      >
        ▶ / ⏸
      </button>

      <section>
        <h4 className="font-semibold mb-2">Filtreler (şu an pasif)</h4>

        <label className="text-xs">
          Brightness {brightness.toFixed(2)}
        </label>
        <input
          type="range"
          min={0.2}
          max={2}
          step={0.01}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-full"
        />

        <label className="text-xs">
          Contrast {contrast.toFixed(2)}
        </label>
        <input
          type="range"
          min={0.2}
          max={2}
          step={0.01}
          value={contrast}
          onChange={(e) => setContrast(Number(e.target.value))}
          className="w-full"
        />

        <label className="text-xs">
          Saturate {saturate.toFixed(2)}
        </label>
        <input
          type="range"
          min={0}
          max={3}
          step={0.01}
          value={saturate}
          onChange={(e) => setSaturate(Number(e.target.value))}
          className="w-full"
        />

        <label className="text-xs">
          Hue {hue.toFixed(0)}°
        </label>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={hue}
          onChange={(e) => setHue(Number(e.target.value))}
          className="w-full"
        />

        <p className="mt-2 text-[10px] text-gray-500">
          Bu panel şimdilik sadece görsel; şablon sihirbazını aktif
          kullanmaya başladığımızda gerçek filtre mantığını buraya
          tekrar bağlarız.
        </p>
      </section>
    </aside>
  );
}
