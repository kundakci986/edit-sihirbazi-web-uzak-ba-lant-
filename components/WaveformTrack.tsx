'use client'
import { useEffect, useRef } from 'react'

interface WaveformTrackProps {

  audioUrl: string
  pxPerSec: number
  durationSec: number
  currentTime: number
}


export default function WaveformTrack({
  audioUrl,
  pxPerSec,
  durationSec,
  currentTime,
}: WaveformTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const drawReq = useRef<number | null>(null)

  const height = 80

  // 🔹 Ses dosyasını bir kere yükle
  useEffect(() => {
    let active = true
if (currentTime >= (audioBufferRef.current?.duration || durationSec || 0)) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    fetch(audioUrl)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(audioBuf => {
        if (!active) return
        audioBufferRef.current = audioBuf
        drawWaveform()
      })

      .catch(err => console.error('Audio decode error:', err))
    return () => { active = false }
  }, [audioUrl])

  // 🔹 Zoom veya duration değiştiğinde yeniden çiz
  useEffect(() => {
    drawWaveform()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerSec, durationSec])

  // 🔹 Ana çizim fonksiyonu
  const drawWaveform = () => {
    const canvas = canvasRef.current
    const audioBuf = audioBufferRef.current
    if (!canvas || !audioBuf) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return


    const realDuration = audioBuf.duration || durationSec || 0
const totalWidth = Math.max(1, Math.floor(realDuration * pxPerSec))

    canvas.width = totalWidth
    canvas.height = height

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = 1
    ctx.strokeStyle = '#faff00' // neon sarı
    ctx.beginPath()

    const channel = audioBuf.getChannelData(0)
    const samplesPerPixel = Math.max(1, Math.floor(channel.length / totalWidth))
    const step = Math.floor(samplesPerPixel * 0.05) // ~50 ms civarı

  // 🔥 İmleç sabit, waveform timeline’ı imlece göre kaydır



for (let x = 0; x < totalWidth; x++) {
  const screenX = x - currentTime * pxPerSec + (canvas.width / 2)


  if (screenX < 0 || screenX > canvas.width) continue

      const start = x * samplesPerPixel
      let sumSq = 0
      let count = 0
      for (let i = start; i < start + step && i < channel.length; i++) {
        const val = channel[i]
        sumSq += val * val
        count++
      }
      const rms = Math.sqrt(sumSq / Math.max(1, count))

// 🎯 Anlık peak (tepe) değerini bul
let peak = 0
for (let i = start; i < start + step && i < channel.length; i++) {
  peak = Math.max(peak, Math.abs(channel[i]))
}

// 🔥 RMS ve Peak'i harmanla (gerçek zamanlı enerji)
const energy = (rms * 0.6 + peak * 0.4)

// 🔊 İstersen bass’ı vurgula (başta patlama efekti)
const energyBoost = x < pxPerSec ? 1.3 : 1.0
const mixed = energy * energyBoost

const y = height / 2 - mixed * height * 0.9
const y2 = height / 2 + mixed * height * 0.9
ctx.moveTo(x, y)
ctx.lineTo(x, y2)

    }

    ctx.stroke()
  }

  // 🔹 Oynatma konumuna tepki efekti (merkezde beyaz çizgi)
   // 🔹 Oynatma konumuna tepki efekti (merkezde beyaz çizgi)
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const drawCursor = () => {
      if (Math.floor(currentTime * 10) % 2 === 0) drawWaveform()

      const x = canvas.width / 2 // sabit merkez
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.shadowColor = "rgba(255,0,0,0.8)" // kırmızı neon gölge
      ctx.shadowBlur = 12
      ctx.fillRect(x - 1, 0, 2, height)
      ctx.shadowBlur = 0

      drawReq.current = requestAnimationFrame(drawCursor)
    }

    cancelAnimationFrame(drawReq.current || 0)
    drawReq.current = requestAnimationFrame(drawCursor)

    return () => {
      if (drawReq.current) cancelAnimationFrame(drawReq.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, pxPerSec])

  // 🎯 Dönüş: canvas genişliği süresi kadar
  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: `${Math.max(1, (audioBufferRef.current?.duration || durationSec || 0) * pxPerSec)}px`,

        height: `${height}px`,
        backgroundColor: "#000",
        borderRadius: "4px",
      }}
    ></canvas>
  )
}

