'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useEditorStore } from '../store/editorStore';



export default function Preview() {
const fileUrl = useEditorStore(s => s.fileUrl)
const fileType = useEditorStore(s => s.fileType)
const filter = useEditorStore(s => s.filter)


const videoRef = useRef<HTMLVideoElement>(null)
const canvasRef = useRef<HTMLCanvasElement>(null)


const isVideo = useMemo(()=>fileType?.startsWith('video'), [fileType])
const isImage = useMemo(()=>fileType?.startsWith('image'), [fileType])


useEffect(()=>{
if (!fileUrl || !isImage || !canvasRef.current) return
const img = new Image()
img.onload = () => {
const canvas = canvasRef.current!
const ctx = canvas.getContext('2d')
if (!ctx) return
const scale = Math.min(1280 / img.width, 720 / img.height, 1)
canvas.width = img.width * scale
canvas.height = img.height * scale
ctx.clearRect(0, 0, canvas.width, canvas.height)
ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
}
img.src = fileUrl
}, [fileUrl, isImage])


const cssFilter = `brightness(${filter.brightness}) contrast(${filter.contrast}) saturate(${filter.saturate}) hue-rotate(${filter.hue}deg)`


return (
<div className="flex justify-center items-center bg-[#0e0e0e] overflow-hidden">
{isImage && (
<canvas ref={canvasRef} className="rounded-lg shadow-xl object-contain" style={{ maxHeight: '75vh', maxWidth: '100%', filter: cssFilter }} />
)}
{isVideo && (
<video ref={videoRef} src={fileUrl!} className="rounded-lg shadow-xl object-contain" style={{ maxHeight: '75vh', maxWidth: '100%', filter: cssFilter }} controls/>
)}
</div>
)}