'use client'
import { useRouter } from 'next/navigation'
import { useEditorStore } from '@/store/editorStore'


export default function Sidebar({ onCut, onExport }: { onCut: () => void, onExport: () => void }) {
const router = useRouter()
const setMedia = useEditorStore(s => s.setMedia)
const setAudio = useEditorStore(s => s.setAudio)


return (
<aside className="bg-[#1a1a1a] border-r border-gray-700 p-3 flex flex-col items-center gap-3">
<label className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded cursor-pointer">
📁 Medya
<input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
const f = e.target.files?.[0]; if (!f) return;
const url = URL.createObjectURL(f)
setMedia(url, f.type)
sessionStorage.setItem('selectedFileUrl', url)
sessionStorage.setItem('selectedFileType', f.type)
}} />
</label>


<label className="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded cursor-pointer">
🎵 Müzik
<input type="file" accept="audio/*" className="hidden" onChange={(e) => {
const f = e.target.files?.[0]; if (!f) return;
const url = URL.createObjectURL(f)
setAudio(url)
}} />
</label>


<button onClick={onCut} className="text-xs bg-yellow-600 hover:bg-yellow-500 px-3 py-2 rounded w-full">✂ Kes</button>
<button onClick={onExport} className="text-xs bg-purple-700 hover:bg-purple-600 px-3 py-2 rounded w-full">💾 Export</button>
<button onClick={() => router.push('/')} className="mt-auto bg-red-700 hover:bg-red-600 px-3 py-2 rounded w-full">⬅ Çık</button>
</aside>
)
}