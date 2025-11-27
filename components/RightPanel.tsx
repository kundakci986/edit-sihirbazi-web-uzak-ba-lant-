'use client'
import { useEditorStore } from '@/store/editorStore'


export default function RightPanel({ onTogglePlay }: { onTogglePlay: () => void }) {
const audioUrl = useEditorStore(s => s.audioUrl)
const filter = useEditorStore(s => s.filter)
const setFilter = useEditorStore(s => s.setFilter)


return (
<aside className="bg-[#1a1a1a] border-l border-gray-700 p-3 space-y-4">
<button onClick={onTogglePlay} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg w-full">▶ / ⏸</button>


<section>
<h4 className="font-semibold mb-2">Filtreler</h4>
<label className="text-xs">Brightness {filter.brightness.toFixed(2)}</label>
<input type="range" min={0.2} max={2} step={0.01} defaultValue={filter.brightness} onChange={(e)=>setFilter({brightness: Number(e.target.value)})} className="w-full"/>


<label className="text-xs">Contrast {filter.contrast.toFixed(2)}</label>
<input type="range" min={0.2} max={2} step={0.01} defaultValue={filter.contrast} onChange={(e)=>setFilter({contrast: Number(e.target.value)})} className="w-full"/>


<label className="text-xs">Saturate {filter.saturate.toFixed(2)}</label>
<input type="range" min={0} max={3} step={0.01} defaultValue={filter.saturate} onChange={(e)=>setFilter({saturate: Number(e.target.value)})} className="w-full"/>


<label className="text-xs">Hue {filter.hue.toFixed(0)}°</label>
<input type="range" min={-180} max={180} step={1} defaultValue={filter.hue} onChange={(e)=>setFilter({hue: Number(e.target.value)})} className="w-full"/>
</section>


{audioUrl && (
<audio src={audioUrl} controls className="w-full"/>
)}
</aside>
)
}