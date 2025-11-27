// app/sablon/oynat/page.tsx
'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'

/* ---------- Tipler ---------- */
type Scene = { start: number; end: number }

type AIPlan = {
  duration: number
  tempo?: number
  beats: number[]
  scenes: Scene[]
  motion_peaks: number[]
}

type TplHint = { introCutMs?: number; zoom?: number; musicOffset?: number }

type EffectPreset = {
  id: string
  title: string
  desc?: string
  baseZoom?: number
  microZoom?: number
  beatGap?: number
  beatFactor?: number
  jumpCutEvery?: number
  jumpCutMs?: [number, number]
  spinEvery?: number
  flashEvery?: number
  glitchEvery?: number
  blurEvery?: number
  shakeEvery?: number
  speedRampEvery?: number
}

type MusicCand = {
  url: string
  bpm?: number
  name?: string
  keywords?: string[]
}

type MixMode = 'replace' | 'blend'

/* ---------- Küçük helper’lar ---------- */
function randf() {
  return Math.random()
}

function near(list: number[], t: number, tol: number) {
  return list.some((x) => Math.abs(x - t) < tol)
}

function getOrCreateSource(
  ctx: AudioContext,
  el: HTMLMediaElement | null,
  ref: MutableRefObject<MediaElementAudioSourceNode | null>,
) {
  if (!el) return null
  if (ref.current) return ref.current
  try {
    ref.current = ctx.createMediaElementSource(el)
    return ref.current
  } catch {
    return ref.current
  }
}

/* ---------- AI servis çağrısı ---------- */
async function aiAnalyzeFromUrl(fileUrl: string): Promise<AIPlan> {
  const blob = await fetch(fileUrl).then((r) => r.blob())
  const fd = new FormData()
  fd.append('video', new File([blob], 'input.mp4', { type: blob.type || 'video/mp4' }))

  const res = await fetch('/api/ai/analyze', { method: 'POST', body: fd })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error('AI analyze failed: ' + txt)
  }

  const data = await res.json()
  const plan = (data?.plan ?? data) as AIPlan
  if (!plan || typeof plan.duration !== 'number') {
    throw new Error('Geçersiz AI plan cevabı')
  }
  return plan
}

/* ===================================================== */
/*                    BİLEŞEN                            */
/* ===================================================== */
export default function OynatPage() {
  /* ----- Refs & state ----- */
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)

  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  // Efekt değişkenleri
  const [zoom, setZoom] = useState(1)
  const baseZoomRef = useRef(1)
  const [rotate, setRotate] = useState(0)
  const [flash, setFlash] = useState(false)
  const [blur, setBlur] = useState(false)
  const [shake, setShake] = useState(false)
  const [glitch, setGlitch] = useState(false)
  const [veil, setVeil] = useState(false) // cut’ı yumuşak göstermek için

  const [presetId, setPresetId] = useState<string>('tiktok-classic')
  const [hint, setHint] = useState<TplHint | null>(null)

  // AI planını sakla
  const aiPlanRef = useRef<AIPlan | null>(null)
  const tempoRef = useRef<number | undefined>(undefined)
  const strongBeatsRef = useRef<number[]>([])
  const lastCutRef = useRef(0)

  // Ses grafiği
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const videoSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const videoGainRef = useRef<GainNode | null>(null)
  const musicGainRef = useRef<GainNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastBeatRef = useRef(0)
  const beatCountRef = useRef(0)
  const rmsBufRef = useRef<number[]>([])

  const [mixMode, setMixMode] = useState<MixMode>(() => {
    try {
      return (sessionStorage.getItem('mixMode') as MixMode) || 'replace'
    } catch {
      return 'replace'
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem('mixMode', mixMode)
    } catch {}
  }, [mixMode])

  const DEFAULT_BEAT_GAP = 0.25
  const DEFAULT_BEAT_FACTOR = 1.35

  /* ----- Ses kilidi ----- */
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  async function unlockAudio() {
    try {
      await audioCtxRef.current?.resume()
    } catch {}
    const a = audioRef.current
    if (!a) return
    try {
      a.muted = false
      a.volume = 1
      await a.play()
      setAudioUnlocked(true)
    } catch {
      setTimeout(async () => {
        try {
          a.muted = false
          a.volume = 1
          await a.play()
          setAudioUnlocked(true)
        } catch {}
      }, 120)
    }
  }

  /* ----- AI yükleniyor overlay ----- */
  const [aiBusy, setAiBusy] = useState(false)
  const [aiProgress, setAiProgress] = useState(0)

  /* ----- Boot: seçili medya ----- */
  useEffect(() => {
    try {
      const fu = sessionStorage.getItem('selectedFileUrl')
      const ft = sessionStorage.getItem('selectedFileType')
      const mu = sessionStorage.getItem('selectedMusicUrl')
      const rawHint = sessionStorage.getItem('tpl_hint')
      if (fu) setFileUrl(fu)
      if (ft) setFileType(ft)
      if (mu) setMusicUrl(mu)
      if (rawHint) {
        try {
          setHint(JSON.parse(rawHint))
        } catch {}
      }
    } catch {}
  }, [])

  // meta & time
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => setCurrent(v.currentTime || 0)
    const onMeta = () => setDuration(v.duration || 0)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
    }
  }, [fileUrl])

  // hint uygula
  const appliedRef = useRef(false)
  useEffect(() => {
    if (appliedRef.current || !hint) return
    if (typeof hint.zoom === 'number') {
      setZoom(hint.zoom)
      baseZoomRef.current = hint.zoom
    }
    const apply = () => {
      if (videoRef.current && hint.introCutMs) {
        try {
          videoRef.current.currentTime = Math.max(0, hint.introCutMs / 1000)
        } catch {}
      }
      if (audioRef.current && hint.musicOffset) {
        try {
          audioRef.current.currentTime = Math.max(0, hint.musicOffset)
        } catch {}
      }
      appliedRef.current = true
    }
    if (duration > 0) apply()
    else setTimeout(apply, 250)
  }, [hint, duration])

  // müzik varsa video mute
  useEffect(() => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v) return
    if (musicUrl) {
      try {
        v.muted = true
      } catch {}
      if (a) {
        a.muted = false
        a.volume = 1
      }
    } else {
      try {
        v.muted = false
      } catch {}
      if (a) {
        a.muted = true
      }
    }
  }, [musicUrl])

  /* ----- Preset listesi ----- */
  const presets: EffectPreset[] = [
    // AI preset → cut & sahne + hafif efekt
    {
      id: 'ai-auto',
      title: 'AI Otomatik',
      desc: 'Beat + sahne + soft geçiş',
      baseZoom: 1.0,
      microZoom: 0.03,
    },
    {
      id: 'tiktok-classic',
      title: 'Klasik Nabız',
      desc: 'Micro zoom + ara sıra flash',
      baseZoom: 1.0,
      microZoom: 0.05,
      flashEvery: 6,
      beatFactor: 1.35,
    },
    {
      id: 'velocity-zoom',
      title: 'Velocity Zoom',
      desc: '2 beatte hız ramp',
      baseZoom: 1.01,
      microZoom: 0.06,
      speedRampEvery: 2,
    },
    {
      id: 'jump-cuts',
      title: 'Jump Cuts',
      desc: '3 beatte 80–140ms ileri',
      baseZoom: 1.0,
      microZoom: 0.04,
      jumpCutEvery: 3,
      jumpCutMs: [80, 140],
    },
    {
      id: 'spin-flash',
      title: 'Spin + Flash',
      desc: '2 beat spin, 6 beat flash',
      baseZoom: 1.0,
      microZoom: 0.05,
      spinEvery: 2,
      flashEvery: 6,
    },
    {
      id: 'glitchy',
      title: 'Glitch',
      desc: '3 beat glitch, 8 beat shake',
      baseZoom: 1.0,
      microZoom: 0.04,
      glitchEvery: 3,
      shakeEvery: 8,
    },
    {
      id: 'slow-mo',
      title: 'Slow-Mo',
      desc: 'Geniş nabız, seyrek flash',
      baseZoom: 1.02,
      microZoom: 0.05,
      flashEvery: 10,
      beatGap: 0.35,
    },
  ]

  const getPreset = () =>
    presets.find((p) => p.id === presetId) ?? presets[0]

  /* ---------- Müzik havuzu / seçim ---------- */
  async function fetchCandidates(): Promise<MusicCand[]> {
    try {
      const cached = sessionStorage.getItem('musicCandidates')
      if (cached) return JSON.parse(cached)
    } catch {}
    try {
      const res = await fetch('/api/tracks', { cache: 'no-store' })
      const data = await res.json()
      const items: MusicCand[] = Array.isArray(data?.items) ? data.items : []
      sessionStorage.setItem('musicCandidates', JSON.stringify(items))
      return items
    } catch {
      return []
    }
  }

  function hashInt(s: string) {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0
    }
    return Math.abs(h)
  }

  async function pickMusicForPreset(
    preset: EffectPreset,
    tempoHint?: number,
  ) {
    const pool = await fetchCandidates()
    if (!pool.length) {
      setMusicUrl(null)
      return
    }

    // AI otomatik: tempoya en yakın eşleşme
    if (preset.id === 'ai-auto' && tempoHint) {
      let best = pool[0]
      let diff = Infinity
      for (const c of pool) {
        const bpm = c.bpm ?? tempoHint
        const d = Math.abs(bpm - tempoHint)
        if (d < diff) {
          diff = d
          best = c
        }
      }
      setMusicUrl(best.url)
      return
    }

    // Diğer presetler: her preset için stabil ama farklı seçim
    const idx = hashInt(preset.id) % pool.length
    setMusicUrl(pool[idx].url)
  }

  /* ---------- AudioGraph ---------- */
  const ensureAudioGraph = () => {
    const vEl = videoRef.current
    const aEl = audioRef.current

    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current =
          new (window.AudioContext ||
            (window as any).webkitAudioContext)()
      } catch {}
    }
    const ctx = audioCtxRef.current
    if (!ctx || !vEl) return

    if (aEl) {
      try {
        aEl.muted = false
      } catch {}
      try {
        aEl.volume = 1
      } catch {}
      try {
        ;(aEl as any).playsInline = true
      } catch {}
    }

    try {
      analyserRef.current?.disconnect()
    } catch {}
    try {
      videoGainRef.current?.disconnect()
    } catch {}
    try {
      musicGainRef.current?.disconnect()
    } catch {}
    analyserRef.current = null
    videoGainRef.current = null
    musicGainRef.current = null

    const vSrc = getOrCreateSource(ctx, vEl, videoSourceRef)
    const mSrc =
      musicUrl && aEl
        ? getOrCreateSource(ctx, aEl, musicSourceRef)
        : null

    try {
      vEl.muted = true
    } catch {}

    const an = ctx.createAnalyser()
    an.fftSize = 2048
    an.smoothingTimeConstant = 0.8
    analyserRef.current = an

    const vGain = ctx.createGain()
    const mGain = ctx.createGain()
    videoGainRef.current = vGain
    musicGainRef.current = mGain

    if (musicUrl && mSrc) {
      if (mixMode === 'replace') {
        vGain.gain.value = 0
        mGain.gain.value = 1
        if (vSrc) {
          try {
            vSrc.connect(vGain)
            vGain.connect(ctx.destination)
          } catch {}
        }
        try {
          mSrc.connect(mGain)
          mGain.connect(ctx.destination)
        } catch {}
        try {
          mSrc.connect(an)
        } catch {}
      } else {
        vGain.gain.value = 0.4
        mGain.gain.value = 1.0
        if (vSrc) {
          try {
            vSrc.connect(vGain)
            vGain.connect(ctx.destination)
          } catch {}
        }
        try {
          mSrc.connect(mGain)
          mGain.connect(ctx.destination)
        } catch {}
        try {
          mSrc.connect(an)
        } catch {
          if (vSrc) {
            try {
              vSrc.connect(an)
            } catch {}
          }
        }
      }
    } else {
      vGain.gain.value = 1
      if (vSrc) {
        try {
          vSrc.connect(vGain)
          vGain.connect(ctx.destination)
          vSrc.connect(an)
        } catch {}
      }
    }
  }

  /* ---------- Efekt helpers ---------- */
  const startVeil = (ms = 140) => {
    setVeil(true)
    window.setTimeout(() => setVeil(false), ms)
  }

  const doStylizedCut = (dt: number) => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v) return

    const mediaT =
      a && !a.paused ? a.currentTime : v.currentTime

    if (mediaT - lastCutRef.current < 0.35) return
    lastCutRef.current = mediaT

    const pv = v.playbackRate
    const pa = a?.playbackRate ?? 1
    v.playbackRate = 1.25
    if (a) a.playbackRate = 1.25

    startVeil(150)

    window.setTimeout(() => {
      const to = Math.min(v.duration, mediaT + dt)
      try {
        v.currentTime = to
      } catch {}
      if (a) {
        try {
          a.currentTime = Math.min(a.duration || v.duration, to)
        } catch {}
      }
      window.setTimeout(() => {
        v.playbackRate = pv
        if (a) a.playbackRate = pa
      }, 140)
    }, 90)
  }

  const doFlash = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 90)
  }
  const doBlur = () => {
    setBlur(true)
    setTimeout(() => setBlur(false), 160)
  }
  const doShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 180)
  }
  const doGlitch = () => {
    setGlitch(true)
    setTimeout(() => setGlitch(false), 120)
  }
  const doSpin = () => {
    setRotate((r) => r + 16)
    setTimeout(() => setRotate((r) => r - 16), 140)
  }
  const doSpeedRamp = () => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v) return
    const pv = v.playbackRate
    const pa = a?.playbackRate ?? 1
    v.playbackRate = 1.2
    if (a) a.playbackRate = 1.2
    setTimeout(() => {
      v.playbackRate = pv
      if (a) a.playbackRate = pa
    }, 260)
  }
  const doSlowMo = () => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v) return
    const pv = v.playbackRate
    const pa = a?.playbackRate ?? 1
    v.playbackRate = 0.6
    if (a) a.playbackRate = 0.6
    setTimeout(() => {
      v.playbackRate = pv
      if (a) a.playbackRate = pa
    }, 400)
  }

  const doJumpCut = ([minMs, maxMs]: [number, number]) => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v) return
    const dt =
      (Math.floor(
        minMs + Math.random() * (maxMs - minMs + 1),
      )) / 1000
    const t = Math.min(
      a && !a.paused ? a.currentTime + dt : v.currentTime + dt,
      v.duration,
    )
    v.currentTime = t
    if (a)
      a.currentTime = Math.min(a.duration || t, t)
    setCurrent(v.currentTime)
  }

  /* ---------- Beat trigger ---------- */
  const triggerBeat = (t: number, preset: EffectPreset) => {
    lastBeatRef.current = t
    const n = (beatCountRef.current += 1)

    // AI preset → cut / geçiş ağırlıklı
    if (preset.id === 'ai-auto') {
      const isStrong = near(
        strongBeatsRef.current,
        t,
        0.06,
      )

      // güçlü vuruş → stilize cut + biraz efekt
      if (isStrong || randf() < 0.45) {
        const dt = 0.25 + randf() * 0.2
        doStylizedCut(dt)
        if (randf() < 0.3) doFlash()
        if (randf() < 0.25) doGlitch()
        if (randf() < 0.25) doShake()
        if (randf() < 0.2) doSlowMo()
        return
      }

      // zayıf vuruş → hafif zoom / blur
      const base = preset.baseZoom ?? baseZoomRef.current
      const micro = preset.microZoom ?? 0.03
      if (randf() < 0.7) {
        setZoom(base + micro)
        setTimeout(() => setZoom(base), 120)
      }
      if (randf() < 0.2) doBlur()
      return
    }

    // Diğer presetler: klasik davranış
    const base = preset.baseZoom ?? baseZoomRef.current
    const micro = preset.microZoom ?? 0.04
    if (randf() < 0.45) {
      setZoom(base + micro)
      setTimeout(() => setZoom(base), 120)
    }
    if (preset.speedRampEvery && n % preset.speedRampEvery === 0)
      doSpeedRamp()
    if (preset.jumpCutEvery && n % preset.jumpCutEvery === 0)
      doJumpCut(
        preset.jumpCutMs ?? [80, 120],
      )
    if (preset.spinEvery && n % preset.spinEvery === 0)
      doSpin()
    if (preset.glitchEvery && n % preset.glitchEvery === 0)
      doGlitch()
    if (preset.flashEvery && n % preset.flashEvery === 0)
      doFlash()
    if (preset.blurEvery && n % preset.blurEvery === 0)
      doBlur()
    if (preset.shakeEvery && n % preset.shakeEvery === 0)
      doShake()
  }

  /* ---------- Beat analizi + senkron ---------- */
  const startAnalyzeLoop = () => {
    stopAnalyzeLoop()
    const an = analyserRef.current
    const v = videoRef.current
    const a = audioRef.current
    if (!v || !an) return

    const buf = new Uint8Array(an.fftSize)

    const tick = () => {
      if (!isPlaying) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const isAi = presetId === 'ai-auto'
      const plan = aiPlanRef.current

      // Ses-vizyon senkro
      if (musicUrl && a && !a.paused) {
        const t = Math.min(
          v.duration || a.currentTime,
          a.currentTime,
        )
        if (
          Math.abs((v.currentTime || 0) - t) >
          0.03
        ) {
          try {
            v.currentTime = t
          } catch {}
        }
      }

      const mediaT =
        musicUrl && a
          ? a.currentTime || 0
          : v.currentTime || 0

      if (isAi && plan) {
        const sceneStarts = plan.scenes.map(
          (s) => s.start,
        )

        // Sahne başı → stylized cut
        if (near(sceneStarts, mediaT, 0.12)) {
          doStylizedCut(0.28 + randf() * 0.16)
        }

        // motion peak → glitch / spin / slowmo
        if (
          near(
            plan.motion_peaks || [],
            mediaT,
            0.06,
          )
        ) {
          if (randf() < 0.5) doGlitch()
          if (randf() < 0.4) doShake()
          if (randf() < 0.35) doSlowMo()
          if (randf() < 0.3) doFlash()
        }

        // Beat listesinden direkt trigger
        if (near(plan.beats || [], mediaT, 0.05)) {
          triggerBeat(mediaT, {
            id: 'ai-auto',
            title: 'AI',
            baseZoom: 1.02,
            microZoom: 0.04,
          })
        }
      } else {
        // Klasik RMS tabanlı beat
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const x = (buf[i] - 128) / 128
          sum += x * x
        }
        const rms = Math.sqrt(sum / buf.length)
        const arr = rmsBufRef.current
        arr.push(rms)
        if (arr.length > 60) arr.shift()
        const avg =
          arr.reduce((aa, b) => aa + b, 0) /
          Math.max(1, arr.length)

        const since = mediaT - lastBeatRef.current
        const preset = getPreset()
        const gap = preset.beatGap ?? DEFAULT_BEAT_GAP
        const fac = preset.beatFactor ?? DEFAULT_BEAT_FACTOR
        if (rms > avg * fac && since > gap) {
          triggerBeat(mediaT, preset)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  const stopAnalyzeLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  /* ---------- Oynat / durdur ---------- */
  const togglePlay = async () => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v) return
    if (isPlaying) {
      v.pause()
      if (a) a.pause()
      setIsPlaying(false)
      stopAnalyzeLoop()
    } else {
      await unlockAudio()
      try {
        await audioCtxRef.current?.resume()
      } catch {}
      await new Promise(requestAnimationFrame)
      ensureAudioGraph()
      try {
        await v.play()
      } catch {}
      try {
        await a?.play()
      } catch {}
      setIsPlaying(true)
      startAnalyzeLoop()
    }
  }

  /* ---------- Müzik değişince otomatik başlat ---------- */
  useEffect(() => {
    if (!musicUrl) return
    ;(async () => {
      await unlockAudio()
      await new Promise(requestAnimationFrame)
      ensureAudioGraph()
      try {
        audioCtxRef.current?.resume()
      } catch {}
      const a = audioRef.current
      const v = videoRef.current
      if (a) {
        a.currentTime = 0
        a.muted = false
        a.volume = 1
        try {
          await a.play()
        } catch {}
      }
      if (v) {
        v.currentTime = 0
        try {
          await v.play()
        } catch {}
      }
      setIsPlaying(true)
      startAnalyzeLoop()
    })()
  }, [musicUrl])

  /* ---------- AI planı uygula ---------- */
  const applyAIPlan = async (plan: AIPlan) => {
    aiPlanRef.current = plan
    tempoRef.current = plan.tempo

    // güçlü beat = motion peak civarı beat'ler
    const strong: number[] = []
    for (const b of plan.beats || []) {
      if (
        plan.motion_peaks?.some(
          (m) => Math.abs(m - b) < 0.08,
        )
      ) {
        strong.push(b)
      }
    }
    strongBeatsRef.current = strong

    const v = videoRef.current
    const a = audioRef.current
    if (!v) return
    try {
      v.currentTime = 0
      if (a) a.currentTime = 0
    } catch {}

    // Oynatmayı garanti et
    if (!isPlaying) {
      await togglePlay()
    }
  }

  /* ---------- İlerleme ---------- */
  const progress = useMemo(
    () =>
      !duration || duration <= 0
        ? 0
        : Math.min(1, Math.max(0, current / duration)),
    [current, duration],
  )

  /* ===================================================== */
  /*                        UI                             */
  /* ===================================================== */
  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-start py-6">
      {/* Telefon kartı */}
      <div className="w-[360px] h-[640px] relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 select-none">
        {/* AI yükleniyor overlay */}
        {aiBusy && (
          <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-sm">
            <div className="mb-2 font-medium">
              Yapay zeka düzenlemeyi hazırlıyor...
            </div>
            <div className="w-40 h-2 rounded-full bg-white/10 overflow-hidden mb-1">
              <div
                className="h-full bg-white/90 transition-all"
                style={{ width: `${aiProgress}%` }}
              />
            </div>
            {tempoRef.current && (
              <div className="text-[11px] opacity-70">
                Algılanan tempo: {Math.round(tempoRef.current)} BPM
              </div>
            )}
          </div>
        )}

        {/* 🔊 Ses için dokun overlay (ilk kez) */}
        {!audioUnlocked && !aiBusy && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <button
              onClick={unlockAudio}
              className="h-12 px-6 rounded-full bg-emerald-400 text-black font-semibold shadow hover:bg-emerald-300 transition"
            >
              🔊 Ses için dokun
            </button>
          </div>
        )}

        {/* Üst bilgi */}
        <div className="absolute top-3 left-0 right-0 flex justify-center z-20">
          <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 backdrop-blur">
            <span>🎵</span>
            <span className="text-sm">
              {musicUrl ? 'Şablon müziği' : 'Orijinal ses'}
            </span>
            {musicUrl && (
              <button
                className="ml-1 text-sm opacity-90 hover:opacity-100"
                onClick={() => {
                  try {
                    audioRef.current?.pause()
                  } catch {}
                  setMusicUrl(null)
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Görsel alan (tıkla: play/pause) */}
        <div
          className={`absolute inset-0 z-0 flex items-center justify-center ${
            shake ? 'animate-shake' : ''
          }`}
          onClick={async () => {
            await unlockAudio()
            togglePlay()
          }}
        >
          {fileUrl && fileType?.startsWith('video') && (
            <video
              ref={videoRef}
              src={fileUrl}
              className={`max-w-full max-h-full object-contain ${
                blur ? 'backdrop-blur-[2px]' : ''
              }`}
              style={{
                transform: `scale(${zoom}) rotate(${rotate}deg)`,
                transformOrigin: 'center',
                backgroundColor: 'black',
                filter: glitch
                  ? 'contrast(1.12) saturate(1.08)'
                  : undefined,
              }}
              playsInline
              controls={false}
              preload="auto"
              onEnded={() => {
                setIsPlaying(false)
                stopAnalyzeLoop()
              }}
            />
          )}
          {fileUrl && fileType?.startsWith('image') && (
            <img
              src={fileUrl}
              className={`max-w-full max-h-full object-contain ${
                blur
                  ? 'blur-[2px]'
                  : 'animate-[kenburns_10s_ease-in-out_infinite]'
              }`}
              style={{
                transform: `scale(${zoom}) rotate(${rotate}deg)`,
                transformOrigin: 'center',
              }}
            />
          )}
          {flash && (
            <div className="absolute inset-0 bg-white/70 pointer-events-none animate-flash" />
          )}
          {glitch && (
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.08)_3px)] mix-blend-screen pointer-events-none" />
          )}
          {veil && (
            <div className="absolute inset-0 bg-black/30 pointer-events-none animate-veil" />
          )}
        </div>

        {/* Müzik */}
        {musicUrl && (
          <audio
            key={musicUrl}
            ref={audioRef}
            src={musicUrl}
            preload="auto"
            onEnded={() => {
              setIsPlaying(false)
              stopAnalyzeLoop()
            }}
          />
        )}

        {/* Orta Play */}
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <button
            onClick={async () => {
              await unlockAudio()
              togglePlay()
            }}
            className="pointer-events-auto h-14 px-8 rounded-full bg-white text-black font-semibold shadow hover:bg-white/90 transition"
          >
            {isPlaying ? 'Durdur' : 'Oynat'}
          </button>
        </div>

        {/* İnce ilerleme */}
        <div className="absolute left-4 right-4 bottom-4 z-10">
          <div className="h-1 rounded bg-white/15">
            <div
              className="h-full rounded bg-white/90 transition-[width] duration-100"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Alt şablon barı – TikTok gibi */}
      <div className="w-[360px] mt-3 bg-neutral-900/95 text-white rounded-2xl border border-white/10 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[15px] font-semibold">
            Şablonu değiştirin
          </span>
          <button
            onClick={() =>
              setMixMode(
                mixMode === 'replace' ? 'blend' : 'replace',
              )
            }
            className="text-[12px] px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15"
          >
            {mixMode === 'replace'
              ? 'AutoMusic: Replace'
              : 'AutoMusic: Blend'}
          </button>
        </div>

        {/* Kaydırılabilir preset şeridi */}
        <div className="px-3 pt-3 pb-2">
          <div
            className="flex gap-3 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
            onMouseDown={(e) => {
              const el = e.currentTarget
              let x = e.pageX,
                left = el.scrollLeft,
                down = true
              const mm = (ev: MouseEvent) => {
                if (!down) return
                el.scrollLeft = left + (x - ev.pageX)
              }
              const up = () => {
                down = false
                window.removeEventListener(
                  'mousemove',
                  mm,
                )
                window.removeEventListener('mouseup', up)
              }
              window.addEventListener('mousemove', mm)
              window.addEventListener('mouseup', up)
            }}
            onTouchStart={(e) => {
              const el = e.currentTarget
              const t = e.touches[0]
              let x = t.pageX,
                left = el.scrollLeft
              const mv = (ev: TouchEvent) => {
                const tt = ev.touches[0]
                el.scrollLeft =
                  left + (x - tt.pageX)
              }
              const end = () => {
                window.removeEventListener(
                  'touchmove',
                  mv,
                )
                window.removeEventListener(
                  'touchend',
                  end,
                )
              }
              window.addEventListener('touchmove', mv, {
                passive: true,
              })
              window.addEventListener('touchend', end)
            }}
          >
            {presets.map((p) => (
              <button
                key={p.id}
                title={p.desc}
                className="shrink-0 w-[84px] text-left"
                onClick={async () => {
                  if (!fileUrl) return
                  await unlockAudio()
                  setPresetId(p.id)
                  baseZoomRef.current = p.baseZoom ?? 1
                  setZoom(baseZoomRef.current)

                  if (p.id === 'ai-auto') {
                    // AI preset – tam otomatik
                    try {
                      setAiBusy(true)
                      setAiProgress(5)
                      const progTimer =
                        window.setInterval(() => {
                          setAiProgress((prev) =>
                            prev < 90
                              ? prev + 5
                              : prev,
                          )
                        }, 200)

                      const plan =
                        await aiAnalyzeFromUrl(fileUrl)
                      window.clearInterval(progTimer)
                      setAiProgress(100)

                      await pickMusicForPreset(
                        p,
                        plan.tempo,
                      )
                      await applyAIPlan(plan)
                    } catch (err) {
                      console.error(err)
                    } finally {
                      setTimeout(() => {
                        setAiBusy(false)
                        setAiProgress(0)
                      }, 300)
                    }
                  } else {
                    // Normal presetler
                    await pickMusicForPreset(p)
                    if (!isPlaying) {
                      setTimeout(() => {
                        if (!isPlaying) togglePlay()
                      }, 60)
                    }
                  }
                }}
              >
                <div
                  className={`w-[84px] h-[84px] rounded-xl overflow-hidden border ${
                    presetId === p.id
                      ? 'border-white'
                      : 'border-white/20'
                  }`}
                >
                  <div
                    className={`w-full h-full ${
                      presetId === p.id
                        ? 'bg-white/15'
                        : 'bg-white/10'
                    }`}
                  />
                </div>
                <div className="mt-1 text-[11px] leading-4 opacity-90 line-clamp-2">
                  {p.title}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 pb-3">
          <button className="flex-1 h-10 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition text-[13px] font-medium">
            Hikâyeniz
          </button>
          <button
            className="flex-1 h-10 rounded-xl bg-rose-500 hover:bg-rose-400 text-white transition text-[13px] font-semibold"
            onClick={() => {
              if (!isPlaying) togglePlay()
            }}
          >
            İleri
          </button>
        </div>
      </div>

      {/* CSS */}
      <style jsx global>{`
        @keyframes kenburns {
          0% {
            transform: scale(${zoom});
          }
          50% {
            transform: scale(${zoom + 0.05});
          }
          100% {
            transform: scale(${zoom});
          }
        }
        @keyframes flash {
          0% {
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .animate-flash {
          animation: flash 120ms ease-out;
        }
        @keyframes shake {
          0% {
            transform: translate3d(0, 0, 0);
          }
          25% {
            transform: translate3d(2px, -2px, 0);
          }
          50% {
            transform: translate3d(-2px, 2px, 0);
          }
          75% {
            transform: translate3d(2px, 2px, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }
        .animate-shake {
          animation: shake 180ms linear;
        }
        @keyframes veil {
          0% {
            opacity: 0;
          }
          40% {
            opacity: 0.4;
          }
          100% {
            opacity: 0;
          }
        }
        .animate-veil {
          animation: veil 160ms ease-out;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
