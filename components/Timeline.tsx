'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import clsx from 'classnames'


export default function Timeline({ onCut, onSeek }: { onCut: ()=>void, onSeek: (ratio:number)=>void }) {
const segments = useEditorStore(s => s.segments)
const setSegments = useEditorStore(s => s.setSegments)
const zoom = useEditorStore(s => s.zoom)
const setZoom = useEditorStore(s => s.setZoom)


const total = useMemo(()=> (segments.reduce((acc,s)=>acc + (s.end - s.start), 0) || 1), [segments])


const [dragId, setDragId] = useState<string|null>(null)


const onDropOn = (id: string) => {
if (!dragId || dragId === id) return
const fromIdx = segments.findIndex((s)=>s.id===dragId)
const toIdx = segments.findIndex((s)=>s.id===id)
if (fromIdx<0 || toIdx<0) return
const copy = [...segments]; const [moved] = copy.splice(fromIdx,1); copy.splice(toIdx,0,moved)
setSegments(copy)
setDragId(null)
}


return (
<section className="bg-[#0c0c0c] border-t border-gray-800 py-2">
<div className="px-5 flex justify-between items-center mb-2 text-sm text-gray-300">
<div className="flex items-center gap-2">
<button onClick={onCut} className="bg-yellow-600 hover:bg-yellow-500 px-3 py-1 rounded">✂ Kes</button>
<div className="ml-4">Zoom</div>
<input type="range" min={1} max={5} step={1} value={zoom} onChange={(e)=>setZoom(Number(e.target.value))} />
</div>
</div>


<div className="px-5 flex gap-2 overflow-x-auto select-none">
{segments.map((s) => (
<div
key={s.id}
draggable
onDragStart={() => setDragId(s.id)}
onDragOver={(e) => e.preventDefault()}
onDrop={() => onDropOn(s.id)}
className={clsx('h-10 rounded flex items-center justify-center text-xs bg-purple-600/70 hover:bg-purple-600 cursor-move')}
style={{ width: `${Math.max(5, (s.end - s.start)/total * 100 * zoom)}%` }}
title={`${s.start.toFixed(2)}s → ${s.end.toFixed(2)}s`}
>
}