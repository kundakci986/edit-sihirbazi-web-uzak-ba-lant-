'use client'
import { useEffect, useState } from 'react'
import { getWaveform } from '@/lib/waveform'


export default function Waveform({ audioUrl }: { audioUrl: string }) {
const [peaks, setPeaks] = useState<number[]>([])
useEffect(()=>{
if (!audioUrl) return
getWaveform(audioUrl).then(setPeaks)
}, [audioUrl])


return (
<div className="flex items-end h-16 gap-[2px] px-5 py-2 bg-black/40 border-t border-gray-800">
{peaks.map((p,i)=> (
<div key={i} className="bg-green-500/70 w-[3px]" style={{ height: `${Math.max(4, p*60)}px` }} />
))}
</div>
)
}