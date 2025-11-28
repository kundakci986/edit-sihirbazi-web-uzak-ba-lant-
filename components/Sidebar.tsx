'use client';

import { useRouter } from 'next/navigation';

type SidebarProps = {
  onCut: () => void;
  onExport: () => void;
};

export default function Sidebar({ onCut, onExport }: SidebarProps) {
  const router = useRouter();

  return (
    <aside className="w-40 bg-[#111111] border-r border-gray-800 flex flex-col gap-3 p-3 text-sm">
      <button
        onClick={() => router.push('/')}
        className="w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200"
      >
        🏠 Ana Sayfa
      </button>

      <button
        onClick={onCut}
        className="w-full px-3 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-semibold"
      >
        ✂️ Kes
      </button>

      <button
        onClick={onExport}
        className="w-full px-3 py-2 rounded-lg bg-purple-500/80 hover:bg-purple-500 text-white font-semibold"
      >
        ⬆️ Dışa Aktar
      </button>

      <div className="mt-2 text-[11px] text-gray-500">
        Bu panel şimdilik sadeleştirildi.  
        Şablon sihirbazını tekrar kullanmak istersek,
        buraya gelişmiş butonları geri koyarız.
      </div>
    </aside>
  );
}
