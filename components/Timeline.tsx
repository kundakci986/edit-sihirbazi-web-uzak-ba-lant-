'use client';

import React from 'react';

type TimelineProps = any;

export default function Timeline(_props: TimelineProps) {
  // Şimdilik bu bileşen sadece görsel bir placeholder.
  // Asıl zaman çizelgesi mantığın app/editor/page.tsx içinde.
  return (
    <div className="w-full h-24 bg-[#111111] border-t border-gray-800 flex items-center justify-center text-xs text-gray-500">
      Timeline bileşeni şu an devre dışı (şablon sihirbazı için ayrıldı).
    </div>
  );
}
