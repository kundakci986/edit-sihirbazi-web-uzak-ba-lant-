'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import WaveformTrack from "../../components/WaveformTrack";
import * as FFmpeg from "@ffmpeg/ffmpeg";
const { createFFmpeg, fetchFile } = FFmpeg as any;
console.log("FFmpeg modülü:", FFmpeg);
let ffmpegInstance: FFmpeg.FFmpeg | null = null;
if (typeof window !== "undefined") {
  console.log("🧩 window aktif, ffmpegRef:", (window as any).ffmpegRef);
}
type Preset =
  | 'none' | 'warm' | 'cool' | 'vibrant' | 'bw'
  | 'pop'  | 'soft' | 'cinematic' | 'bright'
type Segment = { start: number; end: number }
type AppendClip = {
  url: string;
  kind: "video" | "image";
  // sadece video için dolacak, saniye cinsinden
  duration?: number;
};
export default function EditorPage() {
  // media
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [musicLayers, setMusicLayers] = useState<string[]>([]);
// raf yönetimi: oynatma döngüsünü iptal etmek için
const rafIdRef = useRef<number | null>(null);
// Kullanıcı eliyle durdurma bayrağı (auto-continue ile çakışmasın)
const userPausedRef = useRef(false);
// İlk açılışta sessionStorage'tan geri yüklemenin tamamlandığını göstermek için
const [hydrated, setHydrated] = useState(false);
// 🔴 Her şeyi durdur (kullanıcı isteğiyle)
const pauseAllMedia = () => {
  // Bu çağrı manuel durdurma — auto-continue devre dışı
  userPausedRef.current = true;
  // Video dur
  if (videoRef.current) {
    videoRef.current.pause();
  }
  // Tüm müzikler dur
  musicAudioRefs.current.forEach((a) => {
    try { a?.pause(); } catch {}
  });
 // Master durum ve döngü
  setPlaying(false);
  playingRef.current = false;
  if (rafIdRef.current != null) {
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
  }
};



// 🪄 Yükleme ekranı (Edit Sihirbazı)
const [loadingProgress, setLoadingProgress] = useState(0);
const [isLoading, setIsLoading] = useState(false);
const [showMenu, setShowMenu] = useState(false);
// ➕ Ekstra videolar için yükleme ekranı
const [appendImporting, setAppendImporting] = useState(false);
const [appendImportProgress, setAppendImportProgress] = useState(0);
// ... mevcut state'lerin arasına ekle
const [soundMsg, setSoundMsg] = useState<string | null>(null);
const soundMsgTimer = useRef<number | null>(null); // toast zamanlayıcıyı yönetmek için
const [splitFlashTime, setSplitFlashTime] = useState<number | null>(null);
// ⏱️ Tek zaman çizelgesi (master clock)
const [masterTime, setMasterTime] = useState(0);
// seçili segment (örnek: timeline track seçimi)
const [selectedTrack, setSelectedTrack] = useState<"none" | "video" | "music">("none");
const [selectedMusicLayer, setSelectedMusicLayer] = useState<number | null>(null);
// 🎯 İmleç başlangıç ofseti (imleç = zaman 0)
const [timeOffset, setTimeOffset] = useState(0);
// Ortadaki imlecin temsil ettiği mutlak zaman (video track bazlı)
const getPlayheadAbsoluteTime = () => {
  // Tüm hesap tek yerden: getTimeAtPlayhead
  return getTimeAtPlayhead();
};




  // playback
  const [playing, setPlaying] = useState(false)
// 🖼️ Resim modu mu?
const [isImageMode, setIsImageMode] = useState(false);
useEffect(() => {
  setIsImageMode(!!fileType?.startsWith("image"));
}, [fileType]);



// ⏱️ Görsel modunda zaman ilerletmek için
const lastTsRef = useRef<number | null>(null);

// 🎥 Video bittiğinde geçici siyah ekran göster
const [showBlackFrame, setShowBlackFrame] = useState(false);

// 🎬 Video zamanını artık video değil, bizim ilerlettiğimizi söyleyen bayrak
const videoEndedRef = useRef(false);

const [time, setTime] = useState(0);
const newTime = time;

const [duration, setDuration] = useState(0);



  const [appendVideos, setAppendVideos] = useState<AppendClip[]>([])
// tek imleç kontrolü — hangi şerit aktif?
const [activeTrack, setActiveTrack] = useState<'video' | 'music'>('video')
// 🎛️ Video & Müzik scroll/zoom kilidi — varsayılan: kapalı
const [linkTracks, setLinkTracks] = useState(false);
// 🧱 Bağla modunda müziğin gelebileceği en sol scroll pozisyonu
const [musicLockScroll, setMusicLockScroll] = useState<number | null>(null);

// === CapCut-Style: her track kendi başlangıç ofsetiyle çalışır (saniye cinsinden)
const [videoOffset, setVideoOffset] = useState(0);
const [musicOffset, setMusicOffset] = useState(0);
  // trim + segments
  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState<number | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
// 🔘 Seçili segment (video veya müzik)
const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
const [selectedSegmentType, setSelectedSegmentType] = useState<"video" | "music" | null>(null);
// 🎵 Müzik segmentleri (her layer ayrı dizi)
const [musicSegments, setMusicSegments] = useState<Segment[]>([]);
// Timeline üzerinde bir şey seçili mi? (track veya kesilmiş parça)
const hasTimelineSelection =
  selectedSegmentIndex !== null || selectedTrack !== "none";
// 🎵 Müzik segmentlerini kaydet
useEffect(() => {
  sessionStorage.setItem("musicSegments", JSON.stringify(musicSegments));
}, [musicSegments]);
// 🌐 ALT + SCROLL → Sayfa kaymasını tamamen engelle
useEffect(() => {
  const stopAltScroll = (e: WheelEvent) => {
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  window.addEventListener("wheel", stopAltScroll, { passive: false });
  document.addEventListener("wheel", stopAltScroll, { passive: false });
  return () => {
    window.removeEventListener("wheel", stopAltScroll);
    document.removeEventListener("wheel", stopAltScroll);
  };
}, []);
// 🔓 Uzun bası ile özgür sürükleme
type FreeDragState = {
  active: boolean;
  kind: 'video' | 'music';
  index: number;
  startX: number;
  origStart: number;
  origEnd: number;
};
const [freeDrag, setFreeDrag] = useState<FreeDragState | null>(null);
const freeDragRef = useRef<FreeDragState | null>(null);
useEffect(() => { freeDragRef.current = freeDrag; }, [freeDrag]);
const longPressTimerRef = useRef<number | null>(null);
const LONG_PRESS_MS = 1000; // 300–400ms iyi
// Komşulara göre çakışma engeli (overlap yok)
const clampToNeighbors = (
  kind: 'video' | 'music',
  index: number,
  proposedStart: number
) => {
  const list = kind === 'video' ? segments : musicSegments;
  const me = list[index];
  if (!me) return proposedStart;
  const myLen = me.end - me.start;
  const prevEnd = index > 0 ? list[index - 1].end : 0;
  const nextStart = index < list.length - 1 ? list[index + 1].start : Infinity;
  // sınırlar
  const minStart = prevEnd;
  const maxStart = nextStart - myLen;
  return clamp(proposedStart, minStart, maxStart);
};
// frames
const [frames, setFrames] = useState<string[]>([])
  // effects
  const [speed, setSpeed] = useState<number>(1)
  // 0.25x → 5x arası, 0.25’lik adımlarla hız listesi
  const speedOptions = Array.from(
    { length: ((5 - 0.25) / 0.25) + 1 },
    (_, i) => Number((0.25 + i * 0.25).toFixed(2))
  );
  // Slider hangi çentiğe denk geliyor? (0.25, 0.50, ... 5.00)
  const currentSpeedIndex = (() => {
    const idx = speedOptions.findIndex((v) => v === speed);
    if (idx !== -1) return idx;
    // fallback: 1x’i bul, o da yoksa 0.25x’e git
    const fallback = speedOptions.findIndex((v) => v === 1);
    return fallback === -1 ? 0 : fallback;
  })();
  const [preset, setPreset] = useState<Preset>('none')
  const filterPresets: { id: Preset; label: string; badge: string }[] = [
    { id: 'none',      label: 'Filtre Yok',  badge: 'Varsayılan' },
    { id: 'warm',      label: 'Sıcak',       badge: 'Portre' },
    { id: 'cool',      label: 'Soğuk',       badge: 'Gece' },
    { id: 'vibrant',   label: 'Canlı',       badge: 'Renk Bombası' },
    { id: 'bw',        label: 'Siyah-Beyaz', badge: 'Klasik' },
    { id: 'pop',       label: 'Pop',         badge: 'Sosyal' },
    { id: 'soft',      label: 'Soft',        badge: 'Yumuşak' },
    { id: 'cinematic', label: 'Cinematic',   badge: 'Film Look' },
    { id: 'bright',    label: 'Parlak',      badge: 'Vlog' },
  ]
      // Timeline Zoom
   const [zoom, setZoom] = useState(1)
  const [fadeInOut, setFadeInOut] = useState<boolean>(true)
// 🎯 Sabit imleç merkezinde 0 noktası oluşturmak için boşluk (gap)
useEffect(() => {
  const vp = videoViewportRef.current;
  if (!vp) return;
  const update = () => setGap(vp.clientWidth / 2);
  update();
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}, []);
// 🎧 Müzik ref'leri loop yapmasın (güvenlik için)
useEffect(() => {
  musicAudioRefs.current.forEach(a => { if (a) a.loop = false; });
  if (audioRef.current) audioRef.current.loop = false;
}, [musicLayers]);
  // export
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportStatusText, setExportStatusText] = useState<string | null>(null);
  const cancelExportRef = useRef(false);
    // FFmpeg aynı anda sadece 1 komut çalıştırabilsin diye kilit
  const ffmpegBusyRef = useRef(false);
  // 🎥 Çözünürlük ayarları
  const [exportResolution, setExportResolution] =
    useState<"720p" | "1080p" | "2k" | "4k">("1080p");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  // 📤 Dışa aktarma “sayfa” modu ve FPS
  const [showExportPage, setShowExportPage] = useState(false);
  const [exportFps, setExportFps] = useState<30 | 45 | 60>(30);

  const textViewportRef = useRef<HTMLDivElement>(null);
// ui
const [showFilters, setShowFilters] = useState(false)
const [showSpeedMenu, setShowSpeedMenu] = useState(false)
// ✅ Boyutlandırma menüsü ve oranlar
const [showAspectMenu, setShowAspectMenu] = useState(false)
const [aspect, setAspect] = useState("9/16") // varsayılan: TikTok dikey format
const [platformPreset, setPlatformPreset] = useState<
  "youtube" | "tiktok" | "reels" | "instagram"
>("tiktok")
// 🔴 İmleç rengi (değiştirilebilir)
const [playheadColor, setPlayheadColor] = useState<
  "red" | "blue" | "purple" | "white"
>("red")
// 📐 Aspect oranını hem state'e hem DOM'a uygula
const applyAspect = (
  ratio: string,
  preset?: "youtube" | "tiktok" | "reels" | "instagram"
) => {
  setAspect(ratio)
  if (preset) {
    setPlatformPreset(preset)
  }
  const [w, h] = ratio.split("/").map(Number)
  const container = document.getElementById("video-container")
  if (!container || !videoRef.current || !w || !h) return
  const video = videoRef.current
  const containerRatio = w / h
  const videoRatio = video.videoWidth / video.videoHeight
  // Videoyu kutuya "contain" olarak sığdır
  if (videoRatio > containerRatio) {
    video.style.width = "100%"
    video.style.height = "auto"
  } else {
    video.style.width = "auto"
    video.style.height = "100%"
  }
  // container oranını da güncelle
  container.style.aspectRatio = `${w}/${h}`
}
// ✅ Timeline piksel yoğunluğu
const pxPerSec = 120 * zoom
// === Track-bazlı zoom ===
const videoZoom = zoom;
const musicZoom = zoom;
const vPxPerSec = pxPerSec;
const mPxPerSec = pxPerSec;
// === Bağımsız viewport referansları ===
const videoViewportRef = useRef<HTMLDivElement>(null);
const musicViewportRef = useRef<HTMLDivElement>(null);
const [gap, setGap] = useState(0);
const musicScrollOffsetRef = useRef(0);
const FREE_PAD = 350; // px — sol boşluk, gerekirse 8000/12000 yapabilirsiniz
// 📏 Resim klipleri için sabit süre (saniye)
const APPEND_CLIP_SEC = 3;
// ➕ Eklenen kliplerin toplam süresi (video = kendi süresi, resim = sabit 3 sn)
const getAppendTotalSec = () =>
  appendVideos.reduce((sum, clip) => {
    if (clip.kind === "image") return sum + APPEND_CLIP_SEC;
    return sum + (clip.duration ?? APPEND_CLIP_SEC);
  }, 0);
const isDraggingRef = useRef(false);
// --- Editing UX: snap, drag, preview ---
// px cinsinden snap eşiği (playhead'a, segment kenarlarına, saniye çizgilerine yapışma)
const SNAP_PX = 8;
// saniyeye göre major çizgiler (örn. her 1s)
const SNAP_GRID_SEC = 1;
// scrubbing ses örnekleyici throttling (ms)
const SCRUB_AUDIO_THROTTLE = 28;
// görünür kare sanallaştırma: yalnızca viewport+buffer kadar çizeriz
const FRAME_BUFFER_VW = 1.2; // viewport genişliğinin 1.2x’i
const [timelineScale, setTimelineScale] = useState(0.2); // %20 boyutla başla
// 🎛️ Segment menüsü (Sil / Ses Kapat)
const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
// 🎵 Müzik viewport'un scrollLeft'ini takip et (butonları sabit tutmak için)
const [musicScroll, setMusicScroll] = useState(0);
useEffect(() => {
  const el = musicViewportRef.current;
  if (!el) return;
  const onScroll = () => setMusicScroll(el.scrollLeft);
  el.addEventListener("scroll", onScroll);
  return () => el.removeEventListener("scroll", onScroll);
}, []);
// 🎯 Gerçek zamanlı referanslar (animasyon için)
const playingRef = useRef(false);
const gapRef = useRef(0);
const durationRef = useRef(0);
const pxPerSecRef = useRef(pxPerSec);
// state değiştikçe ref’leri güncel tut
useEffect(() => {
  playingRef.current = playing;
}, [playing]);
useEffect(() => { playingRef.current = playing; }, [playing]);
useEffect(() => { durationRef.current = duration || 0; }, [duration]);
// Resimde zamanı state ile akıt (videoda videoRef zaten akıtır)
useEffect(() => {
  let raf = 0;
  const tick = (now: number) => {
    if (!playingRef.current) { lastTsRef.current = null; return; }

    // ⏱ Foto modunda VEYA video bittikten sonra süreyi biz akıtıyoruz
    const shouldSelfDrive =
      fileType?.startsWith("image") || videoEndedRef.current;

    if (shouldSelfDrive) {
      if (lastTsRef.current == null) lastTsRef.current = now;
      const dt = (now - lastTsRef.current) / 1000;
      lastTsRef.current = now;

      setTime(prev => {
        const dur = durationRef.current ?? duration ?? 0;
        const next = Math.min(dur, prev + dt);
        if (next >= dur && dur > 0) {
          // kompozisyon bitti
          playingRef.current = false;
          setPlaying(false);
          videoEndedRef.current = false;
        }
        return next;
      });
    }

    scrollAnim();
    raf = requestAnimationFrame(tick);
  };

  if (playing) raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [playing, fileType, duration]);


useEffect(() => {
  gapRef.current = gap;
}, [gap]);
useEffect(() => {
  durationRef.current = duration;
}, [duration]);
useEffect(() => {
  pxPerSecRef.current = pxPerSec;
}, [pxPerSec]);
// ⬇️ appendVideos'u sessionStorage'tan yükle
useEffect(() => {
  const raw = sessionStorage.getItem("appendVideos");
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Eski format: ["url1", "url2", ...] ise video say → video gibi al
      if (parsed.length > 0 && typeof parsed[0] === "string") {
        setAppendVideos(
          parsed.map((url: string) => ({ url, kind: "video" }))
        );
      } else {
        // Yeni format: [{ url, kind }, ...]
        setAppendVideos(parsed);
      }
    }
  } catch {
    // Bozuksa boşver
  }
}, [])
// ⬇️ appendVideos değiştikçe sessionStorage'a yaz
useEffect(() => {
  sessionStorage.setItem("appendVideos", JSON.stringify(appendVideos))
}, [appendVideos])
  // refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
// 🎚️ Zaman çizelgesi (ruler) referansı
const rulerRef = useRef<HTMLDivElement>(null)
// 🔊 WebAudio yapı taşları
const audioCtxRef = useRef<AudioContext | null>(null);
// Video için kaynak ve gain
const videoSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
const videoGainRef   = useRef<GainNode | null>(null);
// Müzik katmanları için kaynak ve gain listeleri
const musicSourceRefs = useRef<Array<MediaElementAudioSourceNode | null>>([]);
const musicGainRefs   = useRef<Array<GainNode | null>>([]);
// Yüzde (0–300) UI göstergesi — video + her müzik katmanı
const [videoVolPct, setVideoVolPct] = useState(100);
const [musicVolPctMap, setMusicVolPctMap] = useState<Record<number, number>>({});
// Mute sonrası geri döndürmek için “son iyi seviye”
const videoLastPctRef = useRef(100);
const musicLastPctRefs = useRef<number[]>([]);
// Aynı anda birden fazla extract çalışmasın diye kilit
const extractingRef = useRef(false);
  // session
  useEffect(() => {
    setFileUrl(sessionStorage.getItem('selectedFileUrl'))
    setFileType(sessionStorage.getItem('selectedFileType'))
    setMusicUrl(sessionStorage.getItem('selectedMusicUrl'))
  }, [])
// 🎬 Video ve müzik bittiğinde tamamen durdur ve eşitle
useEffect(() => {
  const video = videoRef.current;
  const audio = audioRef.current;
  if (!video || !audio) return;
  const stopAll = () => {
    // Her şeyi durdur
    setPlaying(false);
    playingRef.current = false;
    // Döngüyü durdur
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Videoyu ve sesi tamamen durdur
    video.pause();
    audio.pause();
    // İkisini de başa sar (veya istersen kaldır)
    video.currentTime = 0;
    audio.currentTime = 0;
  };
  // Hem video hem ses bittiğinde tetiklenecek
 // 🎬 Video veya ses bittiğinde akış devam etsin
const onVideoEnd = () => {};
const onAudioEnd = () => {};
  video.addEventListener("ended", onVideoEnd);
  audio.addEventListener("ended", onAudioEnd);
  return () => {
    video.removeEventListener("ended", onVideoEnd);
    audio.removeEventListener("ended", onAudioEnd);
  };
}, []);
  // keep clock in sync
// ✅ Video yüklendiğinde kare çıkar + auto scroll
// ✅ Frame extract sadece metadata geldiğinde 1 kere
useEffect(() => {
  if (fileType?.startsWith('video') && duration > 0) {
    extractFrames()
  }
}, [fileType, duration])
// 🎯 Zoom sonrası scroll sınırlarını düzelt (beyaz ekranı önler)
useEffect(() => {
  const fixScroll = () => {
    const mp = musicViewportRef.current;
    if (mp) {
    const baseDur = Math.max(duration || 0, audioRef.current?.duration || 0);
const totalDur = baseDur + getAppendTotalSec();
const maxScroll = Math.max(
  0,
  totalDur * pxPerSecRef.current - mp.clientWidth
);
      if (mp.scrollLeft > maxScroll) mp.scrollLeft = maxScroll;
    }
  };
  fixScroll();
}, [zoom, duration]);
// ✅ ADIM 1: Scroll Takip (İmleç sabit, timeline kayar)
// 🎯 Timeline imleç sabit ortada kalır,
// video/müzik biterken son kare imleç hizasında durur.
// ✅ Timeline akışı: imleç ortada, başta imleçten başlar, sonda durur
// 🎬 Timeline auto-scroll sadece oynarken aktif
// ⏩ Zaman akışıyla şeritleri sola doğru kaydır (video + müzik)
// 🎵 Tüm müzik katmanlarının referanslarını tutar
const musicAudioRefs = useRef<Array<HTMLAudioElement | null>>([]);
// ⏱ Video süresini sadece video oynarken güncelle
// 🎵 Her müzik katmanı için ayrı zaman (UI'daki müzik playhead'i)
const [musicTimes, setMusicTimes] = useState<number[]>([]);
// ⏱ Video süresini sadece video oynarken güncelle
// ⏱ Video süresini sadece video oynarken güncelle
//    (video bittikten sonra time'ı artık biz ilerleteceğiz)
useEffect(() => {
  const id = setInterval(() => {
    const v = videoRef.current;
    if (!v || !playing) return;
    if (videoEndedRef.current) return; // video bittiyse burası karışmasın

    setTime(v.currentTime);

    // 🎵 Kompozisyon süresi = max(video süresi, müzik segmentlerinin sonu)
    let baseDur = v.duration || 0;
    let musicMax = 0;
    if (musicSegments.length > 0) {
      musicMax = musicSegments.reduce(
        (max, seg) => Math.max(max, seg.end),
        0
      );
    }
    const compDur = Math.max(baseDur, musicMax);
    setDuration(compDur);
  }, 100);

  return () => clearInterval(id);
}, [playing, musicSegments]);

// 🎵 Müzik katmanlarının zamanını HER ZAMAN kendi currentTime'ından oku
//    (müzik kendi başına da çalsa timeline'daki müzik time akar)
useEffect(() => {
  const id = window.setInterval(() => {
    setMusicTimes((prev) => {
      const next = [...prev];
      musicAudioRefs.current.forEach((audio, idx) => {
        if (!audio) return;
        next[idx] = audio.currentTime;
      });
      return next;
    });
  }, 100); // 100ms: UI için yeterince akıcı
  return () => window.clearInterval(id);
}, []);
  // first segment = full
  useEffect(() => {
    if (duration > 0 && segments.length === 0) {
      setSegments([{ start: 0, end: duration }])
      setOutPoint(duration)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])






// 🎬 Müzik: video zamanı + müzik kaydırma
// Müzik time'ı sağa/sola oynattıkça, şarkının başka bir saniyesi kırmızı imlecin altına gelir.
useEffect(() => {
  // Oynatma kapalıysa tüm müzikleri durdur
  if (!playing) {
    musicAudioRefs.current.forEach((audio) => {
      if (!audio) return;
      try {
        audio.pause();
      } catch {}
    });
    return;
  }

  // px → saniye çevir
  const pxPerSecNow = pxPerSecRef.current || pxPerSec;
  const offsetSec = (musicScrollOffsetRef.current || 0) / pxPerSecNow;

  // Bu frame'de şarkıda olmamız gereken saniye:
  const musicTime = time + offsetSec;

  musicAudioRefs.current.forEach((audio) => {
    if (!audio) return;

    const dur = audio.duration || duration || 0;
    let target = musicTime;

    // Süreyi aşma / negatife düşme
    if (dur > 0) {
      if (target < 0) target = 0;
      else if (target > dur) target = dur;
    }

    try {
      // Gereksiz seek spam'ini azalt
      if (Math.abs(audio.currentTime - target) > 0.03) {
        audio.currentTime = target;
      }
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } catch {}
  });
}, [playing, time, duration]);






// 📌 Oynatma yokken yatay scroll → time'ı playhead'e eşitle
useEffect(() => {
  const vp = videoViewportRef.current;
  if (!vp) return;
  const onScroll = () => {
    if (!playingRef.current) {
      setTime(getTimeAtPlayhead());
    }
  };
  vp.addEventListener("scroll", onScroll);
  return () => vp.removeEventListener("scroll", onScroll);
}, []);
// Video bağla
useEffect(() => {
  wireVideoGain();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [videoRef.current]);
// Müzikleri bağla (katmanlar/render sonrası)
useEffect(() => {
  musicAudioRefs.current.forEach((el, idx) => el && wireMusicGain(idx));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [musicAudioRefs.current.length, /* varsa musicLayers */]);
// px -> time
const pxToTime = (px:number) => px / pxPerSecRef.current;
// time -> px (imleç-merkezli metrik, gap dahil)
const timeToPx = (t:number) => t * pxPerSecRef.current + gapRef.current;
// Snap hedeflerini topla (playhead, segment sınırları, 1s grid)
const collectSnapTargets = () => {
  const targets:number[] = [];
  // 1) Playhead zamanı
  const playheadTime = getTimeAtPlayhead();
  targets.push(playheadTime);
  // 2) Segment sınırları (video + music)
  segments.forEach(s => { targets.push(s.start, s.end); });
  musicSegments.forEach(s => { targets.push(s.start, s.end); });
  // 3) Grid noktaları (0..duration)
  const dur = durationRef.current || duration || 0;
  for (let t=0; t<=dur; t+=SNAP_GRID_SEC) targets.push(t);
  return targets;
};
// Verilen zaman değeri için “en yakın snap” zamanını döndür
const snapTime = (t:number) => {
  const targets = collectSnapTargets();
  let best = t, bestDist = Infinity;
  const tPx = timeToPx(t);
  for (const cand of targets) {
    const cPx = timeToPx(cand);
    const dist = Math.abs(cPx - tPx);
    if (dist <= SNAP_PX && dist < bestDist) {
      best = cand; bestDist = dist;
    }
  }
  return best;
};
// --- Track yardımcıları ---
type TrackKind = 'video' | 'music';
const offsetFor = (kind: TrackKind) => (kind === 'video' ? videoOffset : musicOffset);
const setOffsetFor = (kind: TrackKind) => (kind === 'video' ? setVideoOffset : setMusicOffset);
// Bir zamanı (t) verilen track için scrollLeft'e çevir (imleç merkezli mantık)
const timeToScroll = (t: number, kind: TrackKind) => {
  // imleç sabit olduğu için viewport.scrollLeft = (t - offset) * px/sn
  return Math.max(0, (t - offsetFor(kind)) * pxPerSecRef.current);
};
const scrollToTime = (vp: HTMLDivElement | null, t: number, kind: TrackKind) => {
  if (!vp) return;
  vp.scrollLeft = timeToScroll(t, kind);
};
// 🎯 Timeline üzerinde wheel yapıldığında sayfa kaymasını tamamen engelle (native)
useEffect(() => {
  const videoEl = videoViewportRef.current;
  const musicEl = musicViewportRef.current;
  if (!videoEl && !musicEl) return;
  const blockScroll = (e: WheelEvent) => {
    // 🎯 Alt tuşuna basılıyken varsayılan kaydırmayı tamamen engelle
    if (e.altKey) {
      e.preventDefault();
      return;
    }
    // 👇 Normalde dikey kaydırmayı engelle ama yatay kaydırmaya izin ver
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
    }
  };
  if (videoEl)
    videoEl.addEventListener("wheel", blockScroll, { passive: false });
  if (musicEl)
    musicEl.addEventListener("wheel", blockScroll, { passive: false });
  return () => {
    if (videoEl)
      videoEl.removeEventListener("wheel", blockScroll);
    if (musicEl)
      musicEl.removeEventListener("wheel", blockScroll);
  };
}, []);
// === VIDEO FRAMES EXTRACTION ===
const extractFrames = async () => {
  console.log("extractFrames CALISTI ✅");
  if (!videoRef.current || duration <= 0) return;
  setIsLoading(true);
  setLoadingProgress(0);
  const video = videoRef.current;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const baseWidth = 200;
  const scale = Math.min(zoom * 1.5, 4);
  canvas.width = Math.round(baseWidth * scale);
  canvas.height = Math.round((canvas.width * 9) / 16);
  const framesTemp: string[] = [];
  const fpsStep = Math.max(1.0, 1.0 / zoom);
  let t = 0;
  video.currentTime = 0;
  const capture = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    framesTemp.push(canvas.toDataURL("image/jpeg", 0.8));
    const percent = Math.min(100, (t / duration) * 100);
    setLoadingProgress(Math.round(percent));
    t += fpsStep;
    if (t <= duration) {
      video.currentTime = t;
    } else {
      setFrames(framesTemp);
      video.removeEventListener("seeked", capture);
      setLoadingProgress(100);
      setTimeout(() => setIsLoading(false), 400); // kısa gecikmeyle kapanır
      console.log("Frame çıkarma bitti ✅");
    }
  };
  video.addEventListener("seeked", capture);
  capture(); // başlat
};
  // helpers
// 🔢 Zaman formatlayıcı (mm:ss.d)
const formatTime = (t:number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const d = Math.floor((t - Math.floor(t)) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${d}`;
};
// 🎯 İmleç (ekrandaki sabit çizgi) altındaki GERÇEK ZAMAN
// Track mantığı: scrollLeft = (t - videoOffset) * px/sn  ⇒  t = videoOffset + scrollLeft / px/sn
const getTimeAtPlayhead = () => {
  const vp = videoViewportRef.current;
  if (!vp) return 0;

  const scroll = vp.scrollLeft;
  const t = videoOffset + scroll / pxPerSecRef.current;

  return Math.max(0, t);
};

  const clamp = (v:number, a:number, b:number)=>Math.max(a, Math.min(b, v))

// ▶️ Bitince timeline'ı son kareye hizala
const snapToEnd = (viewport: HTMLDivElement | null, pxPerSecLocal: number) => {
  if (!viewport || duration <= 0) return;
  const center = viewport.clientWidth / 2;
  const xEnd = (gap + duration * pxPerSec) - center;
  viewport.scrollTo({ left: Math.max(0, xEnd), behavior: "smooth" });
};
const getTrackRefs = (kind: TrackKind) => {
  return {
    viewport: kind === 'video' ? videoViewportRef.current : musicViewportRef.current,
    pxPerSec: pxPerSec, // tek zoom
  };
};
const startTrimDrag = (
  e: React.MouseEvent,
  which: "in" | "out",
  kind: "video" | "music"
) => {
  e.preventDefault();
  e.stopPropagation();
  const viewport =
    kind === "video" ? videoViewportRef.current : musicViewportRef.current;
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const onMove = (ev: MouseEvent) => {
    const px = ev.clientX - rect.left + viewport.scrollLeft;
    const newTime = Math.max(0, (px - gap) / pxPerSec);
    if (which === "in") {
  setInPoint(Math.max(0, Math.min(newTime, (outPoint ?? duration) - 0.05)));
} else {
  setOutPoint(Math.min(duration, Math.max(newTime, inPoint + 0.05)));
}
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};
// UZUN BASI -> özgür sürükleme başlatan handler fabrikası
const makeSegmentLongDrag = (kind: 'video' | 'music', index: number) =>
  (e: React.MouseEvent<HTMLDivElement>) => {
  
e.preventDefault();
e.stopPropagation(); // viewport’un makePanDrag’ı tetiklenmesin
    const vp = kind === 'video' ? videoViewportRef.current : musicViewportRef.current;
    if (!vp) return;
    // yalnızca uzun bası ile aktifleştir
    const startX = e.clientX;
    // ilgili liste ve segment
    const list = (kind === 'video' ? segments : musicSegments);
    const seg = list[index];
    if (!seg) return;
    // uzun bası zamanlayıcısı
  if (longPressTimerRef.current) {
     clearTimeout(longPressTimerRef.current);
  }
  longPressTimerRef.current = window.setTimeout(() => {
     // uzun bası gerçekten tetiklendi: olayı burada yut
     // (kısa tıkta değil)
    
      // özgür sürükleme modu aktif
      setFreeDrag({
        active: true,
        kind,
        index,
        startX,
        origStart: seg.start,
        origEnd: seg.end,
      });

      const onMove = (ev: MouseEvent) => {
        // ÖZGÜR SÜRÜKLEME yalnızca uzun bası ile aktif olmalı
        const fd = freeDragRef.current;
        if (!fd || !fd.active || fd.kind !== kind || fd.index !== index) return;
        const dx = ev.clientX - fd.startX;           // başlangıç X’i state’ten
        const dt = dx / pxPerSecRef.current;         // piksel → saniye
        const segLen = fd.origEnd - fd.origStart;
        // 🟣 Artık SNAP YOK → kullanıcının sürüklediği yere gider
        let proposedStart = fd.origStart + dt;
        // Komşulara çakışmasın ama arada boşluk bırakabilsin
        const clampedStart = clampToNeighbors(kind, index, proposedStart);
        const newSeg = { start: clampedStart, end: clampedStart + segLen };
        if (kind === "video") {
          setSegments(prev => prev.map((s, i) => (i === index ? newSeg : s)));
        } else {
          setMusicSegments(prev => prev.map((s, i) => (i === index ? newSeg : s)));
        }
      };
      const endDrag = () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        setFreeDrag(null);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', endDrag);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', endDrag);
    }, LONG_PRESS_MS);
  };
// AudioContext’i temin et
const ensureAudioCtx = () => {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtxRef.current!;
};
// Video elementini GainNode ile bağla
const wireVideoGain = () => {
  const el = videoRef.current;
  if (!el) return;
  const ctx = ensureAudioCtx();
  if (!videoSourceRef.current) {
    videoSourceRef.current = ctx.createMediaElementSource(el);
  }
  if (!videoGainRef.current) {
    videoGainRef.current = ctx.createGain();
    videoGainRef.current.gain.value = (videoVolPct ?? 100) / 100;
    videoSourceRef.current.connect(videoGainRef.current).connect(ctx.destination);
  }
  el.volume = 1;
  // ⬇⬇⬇ BURAYA EKLE
  // HTML sesi açık; ses kontrolünü GainNode üzerinden de yapabiliriz.
el.muted = false;
};
// Müzik elementi (idx) için GainNode bağla
const wireMusicGain = (idx: number) => {
  const el = musicAudioRefs.current[idx];
  if (!el) return;
  const ctx = ensureAudioCtx();
  // kaynak
  if (!musicSourceRefs.current[idx]) {
    musicSourceRefs.current[idx] = ctx.createMediaElementSource(el);
  }
  // gain
  if (!musicGainRefs.current[idx]) {
    musicGainRefs.current[idx] = ctx.createGain();
    const pct = musicVolPctMap[idx] ?? 100;
    musicGainRefs.current[idx]!.gain.value = pct / 100; // 3.0’a kadar çıkacağız
    musicSourceRefs.current[idx]!.connect(musicGainRefs.current[idx]!).connect(ctx.destination);
  }
  el.volume = 1;
};
// --- Mouse tekerleğiyle yakınlaştırma ---
const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
  // Sadece Alt basılıyken zoom aktif olsun
  if (!e.altKey) return;

  e.preventDefault();
  e.stopPropagation();

  const targetVp = e.currentTarget as HTMLDivElement;

  // Track'ler bağlıysa her iki viewport'u, değilse sadece hedefi güncelle
  const viewports: HTMLDivElement[] = linkTracks
    ? [videoViewportRef.current, musicViewportRef.current].filter(
        (v): v is HTMLDivElement => !!v
      )
    : [targetVp];

  setZoom((prevZoom) => {
    // deltaY > 0 → aşağı → uzaklaş, < 0 → yukarı → yakınlaş
    const delta = e.deltaY;
    const step = 0.15;

    let nextZoom = prevZoom + (delta > 0 ? -step : step);

    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 5;
    if (nextZoom < MIN_ZOOM) nextZoom = MIN_ZOOM;
    if (nextZoom > MAX_ZOOM) nextZoom = MAX_ZOOM;

    const newPxPerSec = 120 * nextZoom;
    const oldPxPerSec = pxPerSec; // bu render'daki mevcut değer

    pxPerSecRef.current = newPxPerSec;

    // Basit yaklaşım: merkezdeki zamanı koruyarak scroll'u ayarla
    viewports.forEach((vp) => {
      const centerX = vp.clientWidth / 2;
      const beforeTime = (vp.scrollLeft + centerX - gap) / (oldPxPerSec || 1);
      const afterScrollLeft = beforeTime * newPxPerSec + gap - centerX;
      vp.scrollLeft = Math.max(0, afterScrollLeft);
    });

    return nextZoom;
  });
};

// --- Orta tuş sürükleme ile zoom ---
const makeMiddleDragZoom = (kind: TrackKind) => (e: React.MouseEvent<HTMLDivElement>) => {
  // 🚫 Artık hiçbir şey yapmasın
  if (e.button === 1) {
    e.preventDefault();
    e.stopPropagation();
  }
};
// 🧲 CapCut-style drag (imleç sabit, scroll serbest)
const makePanDrag = (kind: "video" | "music") => (e: React.MouseEvent<HTMLDivElement>) => {
  e.preventDefault();
  const viewport =
    kind === "video" ? videoViewportRef.current : musicViewportRef.current;
  if (!viewport) return;
  isDraggingRef.current = true;
  const startX = e.clientX;
  const startScroll = viewport.scrollLeft;
  // Drag başladığı anda iki track'in başlangıç scroll'larını kaydet
  const videoStartScroll = videoViewportRef.current?.scrollLeft ?? 0;
  const musicStartScroll = musicViewportRef.current?.scrollLeft ?? 0;

    const onMove = (ev: MouseEvent) => {
    // özgür sürükleme (long press) aktifken pan çalışmasın
    if (freeDragRef.current?.active) return;

    const dx = ev.clientX - startX;
    const baseNext = Math.max(0, startScroll - dx);

    if (linkTracks) {
      // 🔗 Bağlı mod: iki track birlikte kayar ama aradaki mesafe korunur
      const v = videoViewportRef.current;
      const m = musicViewportRef.current;

      if (v && m) {
        if (kind === "video") {
          // Videoyu baseNext'e götür, müziği aynı delta kadar oynat
          const delta = baseNext - v.scrollLeft;
          v.scrollLeft = baseNext;
          m.scrollLeft += delta;
        } else {
          // Müzik sürükleniyorsa tam tersi
          const delta = baseNext - m.scrollLeft;
          m.scrollLeft = baseNext;
          v.scrollLeft += delta;
        }
      }
    } else {
      // 🪶 Serbest mod: sadece o track kayar
      viewport.scrollLeft = baseNext;
    }

    // Sürüklerken oynatma yoksa sadece VIDEO track time'ını güncelle
    if (!playingRef.current && kind === "video") {
      const newTime = viewport.scrollLeft / pxPerSecRef.current;
      setTime(newTime);
    }
  };

  const onUp = () => {
    isDraggingRef.current = false;

    // video için: global time güncelle
    if (viewport) {
      const finalScroll = viewport.scrollLeft;
      const newTime = finalScroll / pxPerSecRef.current;

      if (kind === "video") {
        setTime(newTime);
        if (videoRef.current) {
          videoRef.current.currentTime = newTime;
        }
      }

      // 🎵 MÜZİK için: scroll farkını saniyeye çevir ve tüm müzik segmentlerini kaydır
      if (kind === "music" && !playingRef.current) {
        const deltaPx = finalScroll - startScroll;
        const deltaSec = deltaPx / pxPerSecRef.current;

        if (Math.abs(deltaSec) > 0.0001) {
          setMusicSegments(prev =>
            prev.map(seg => ({
              start: seg.start + deltaSec,
              end: seg.end + deltaSec,
            }))
          );
        }
      }
    }

    // 🔴 SERBEST MOD: müzik ve video arasındaki ofseti kaydet
    const v = videoViewportRef.current;
    const m = musicViewportRef.current;
    if (kind === "music" && v && m && !linkTracks) {
      musicScrollOffsetRef.current = m.scrollLeft - v.scrollLeft;
    }

    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};
  // 🔁 Hız: sadece videoya etki etsin, müzik sabit kalsın
  const applyPlaybackRate = (v: number) => {
    // Video varsa hızı değiştir
    if (videoRef.current) {
      videoRef.current.playbackRate = v;
    }
    // 🎵 Müzik hızına dokunmuyoruz ki 1x kalsın
    // Eğer ileride "sadece müziği hızlandır" istersek,
    // onu ayrı bir fonksiyonda yaparız.
  };
// 🎞 Timeline akışı (imleç ortada, smooth scrol
console.log("🎬 scrollAnim tick", playingRef.current, time);
// ✅ Timeline akışı: video ve müzik aynı hızda,
//    ama aralarındaki mesafe sabit kalabilir
const scrollAnim = () => {
  const video = videoRef.current;
  const videoViewport = videoViewportRef.current;
  const musicViewport = musicViewportRef.current;
  if (!videoViewport) return;
  if (!playingRef.current) return;

  if (isDraggingRef.current) return;
  const pxPerSecNow = pxPerSecRef.current;
  const gapNow = gapRef.current;
  const baseDur = durationRef.current || (video?.duration ?? 0);
  const extraDur = getAppendTotalSec();
  let durNow = baseDur + extraDur;
 let t = (video && !videoEndedRef.current) ? video.currentTime : time;

  if (!Number.isFinite(t)) t = 0;
  if (durNow <= 0) {
    durNow = Math.max(t + 1, 1);
  }
   if (t < 0) t = 0;
  if (t > durNow) t = durNow;

  // 🔪 SEGMENT BAZLI OYNATMA:
  // segments dizisi "tutulacak" parçalar. Aralarındaki boşluklar kesilmiş yer demek.
  if (segments.length > 0) {
    const inSegment = segments.some(seg => t >= seg.start && t <= seg.end);

    // Eğer şu anki zaman hiçbir segmentin içinde değilse, bir sonraki segmente zıpla:
    if (!inSegment) {
      const sorted = [...segments].sort((a, b) => a.start - b.start);
      const future = sorted.find(seg => seg.start > t + 0.01);

      if (future) {
        // bir sonraki segmentin başına sar
        if (video) {
          try {
            video.currentTime = future.start;
          } catch {}
        }
        t = future.start;
      } else {
        // ileri segment yok: oynatmayı bitir
        playingRef.current = false;
        setPlaying(false);
        return;
      }
    }
  }

  const vDur = video?.duration || durNow;

  const vEnded = vDur > 0 && t >= vDur - 0.02;
  setShowBlackFrame(vEnded);
  // 🎯 Video için hedef scroll (imleç ortada)
  const targetVideo = t * pxPerSecNow + gapNow * 2;
  // 🎵 Müzik için hedef scroll: videodan OFFSET kadar kaymış olsun
  const targetMusic = targetVideo + (musicScrollOffsetRef.current || 0);
  const minScroll = -gapNow * 2;
  const maxScroll = durNow * pxPerSecNow + gapNow * 2;
  const applyScroll = (vp: HTMLDivElement | null, target: number) => {
    if (!vp) return;
    const current = vp.scrollLeft;
    const nextRaw = current + (target - current) * 0.25;
    const clamped = Math.max(minScroll, Math.min(nextRaw, maxScroll));
    vp.scrollLeft = clamped;
  };
  // 🎯 Video ve müzik aynı hızda kayar ama offset korunur
  applyScroll(videoViewport, targetVideo);
  applyScroll(musicViewport, targetMusic);
};
// 🎥 Play/Pause – kırmızı imleçten başlat, müzikleri de aynı anda sar
const toggleVideo = async () => {
  const video = videoRef.current;
  if (!video) return;

  // 🔴 0) KIRMIZI İMLECİN gösterdiği zamanı hesapla
  const playheadTime = getTimeAtPlayhead(); // scrollLeft / pxPerSec
  let safeTime = video.currentTime;

  if (Number.isFinite(playheadTime)) {
    const hasDur =
      Number.isFinite(video.duration) && video.duration > 0;
    const maxDur = hasDur ? video.duration : playheadTime;
    safeTime = clamp(playheadTime, 0, maxDur);
  }

  // ▶ Videoyu ve global time'ı imleç altına sar
  try {
    video.currentTime = safeTime;
  } catch {}
  setTime(safeTime);

  // 🔊 0.5) MÜZİK katmanlarını da aynı zamana (serbest offset ile) sar
  const baseTime = safeTime;
  const pxPerSecNow = pxPerSecRef.current || 1;
  const offsetSecGlobal = -(musicScrollOffsetRef.current || 0) / pxPerSecNow;

  musicAudioRefs.current.forEach((audio, idx) => {
    if (!audio) return;

    const effectiveTime = baseTime + offsetSecGlobal;

    // Eğer hiç müzik segmenti yoksa: tek parça track + offset
    if (musicSegments.length === 0) {
      const rawDesired = effectiveTime;
      const desired = Math.max(
        0,
        Math.min(rawDesired, audio.duration || rawDesired)
      );
      try {
        audio.currentTime = desired;
      } catch {}
      return;
    }

    // Segmentli mod: önce offset, sonra segment hesabı
    const seg = musicSegments[idx];
    const segStart = seg?.start ?? 0;
    const segEndRaw = seg?.end ?? (audio.duration || duration || 0);
    const segLen = Math.max(0, segEndRaw - segStart);
    const rel = effectiveTime - segStart; // segment içi konum

    if (rel < 0 || segLen <= 0) {
      try {
        audio.currentTime = 0;
      } catch {}
      return;
    }

    if (rel >= segLen) {
      const endPos = Math.min(segLen, audio.duration || segLen);
      try {
        audio.currentTime = endPos;
      } catch {}
      return;
    }

    try {
      audio.currentTime = rel;
    } catch {}
  });

  // 1) AudioContext’i kullanıcı jestinde uyandır
  try {
    const ctx = ensureAudioCtx();
    if (ctx.state !== "running") await ctx.resume();
  } catch {}

  // 2) "ended" kilidine takıldıysa, görünmez bir çentik kadar başa al
  if (
    Number.isFinite(video.duration) &&
    video.currentTime >= (video.duration - 0.02)
  ) {
    try {
      video.currentTime = 0.0001;
    } catch {}
  }

  const startLoop = () => {
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    const loop = () => {
      scrollAnim();
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);
  };

  if (video.paused) {
    try {
      await video.play();
      // Eğer tarayıcı play’i reddettiyse paused true kalır
      if (!video.paused) {
        setPlaying(true);
        playingRef.current = true;
      setPlaying(true);
      playingRef.current = true;
      videoEndedRef.current = false;
      lastTsRef.current = null;
      startLoop();

        startLoop();
      } else {
        // Son çare: bir kere sessiz başlatmayı dene (bazı politikalar için)
        video.muted = true;
        try {
          await video.play();
        } catch {}
        if (!video.paused) {
          setPlaying(true);
          playingRef.current = true;
          startLoop();
          // Ses zincirin çalışıyorsa vakit kaybetmeden geri aç
          setTimeout(() => {
            video.muted = false;
          }, 100);
        }
      }
    } catch (e) {
      // Play tamamen reddedildiyse state’i zorlamayalım
      setPlaying(false);
      playingRef.current = false;
    }
  } else {
    video.pause();
    setPlaying(false);
    playingRef.current = false;
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
  }
};


useEffect(() => {
  if (!playing || !isImageMode) return;
  let raf: number;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    setTime(prev => {
      const d = durationRef.current || duration || 3;
      const next = Math.min(prev + dt, d);
      if (next >= d - 0.0001) {
        setPlaying(false);
        playingRef.current = false;
      }
      return next;
    });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}, [playing, isImageMode, duration]);
// 🎵 SADECE bir müzik katmanını oynat / durdur (timeline'dakiyle aynı ses)
const toggleMusic = async () => {
  // Eğer seçili bir müzik katmanı varsa onu kullan, yoksa ilk katmanı kullan
  const layerIndex =
    selectedMusicLayer !== null
      ? selectedMusicLayer
      : (musicAudioRefs.current.length > 0 ? 0 : null);
  if (layerIndex === null) return;
  const audio = musicAudioRefs.current[layerIndex];
  if (!audio) return;
  if (audio.paused) {
    try {
      await audio.play();
    } catch {
      // autoplay engellenirse sessizce geç
    }
  } else {
    audio.pause();
  }
};
<div className="flex gap-4 justify-center mt-4">
<button
  onClick={() => {
    if (fileType?.startsWith("image")) {
      const now = !playingRef.current;
      setPlaying(now);
      playingRef.current = now;
      // süre bittiği yerdeyse tekrar başlatırken başa al
      const D = durationRef?.current ?? duration ?? 3;
      if (now && time >= D) setTime(0);
    } else {
      toggleVideo(); // video modunda eskisi gibi
    }
  }}
  className="px-4 py-2 bg-purple-600 rounded text-white hover:bg-purple-700"
>
  🎬 Play / Pause
</button>
  <button
    onClick={toggleMusic}
    className="px-4 py-2 bg-green-600 rounded text-white hover:bg-green-700"
  >
    🎵 Müzik Play / Pause
  </button>
</div>
const togglePlay = () => {
  // 🖼 Resim modunda basit state tabanlı Play/Pause
  if (fileType?.startsWith("image")) {
    const nowPlaying = !playingRef.current;
    setPlaying(nowPlaying);
    playingRef.current = nowPlaying;
    // Resim süresi dolmuşsa tekrar oynatırken başa al
    const dur = durationRef.current || 3;
    if (nowPlaying && time >= dur) {
      setTime(0);
    }
    return;
  }
  // 🎬 Video modunda eski davranış
  toggleVideo();
};
// 🛑 Timeline’a dokunulduğunda video/müzik durur
const handleTimelineGrab = () => {
  const video = videoRef.current;
  const audio = audioRef.current;
  if (!video) return;
  // 🎯 Video ve ses durdurulsun
  video.pause();
  if (audio) audio.pause();
  // 🧠 Durum state'lerini sıfırla
  setPlaying(false);
  playingRef.current = false;
  // ⏹️ Animasyon döngüsünü iptal et
  if (rafIdRef.current != null) {
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
  }
};
// 🎬 Timeline kutularının açılma animasyonu (sadece tarayıcıda, ilk açılışta)
useEffect(() => {
  if (typeof window === "undefined") return;
  let start = performance.now();
  const durationAnim = 1200; // 1.2 saniyelik açılma
  let rafId: number;
  const animate = (now: number) => {
    const progress = Math.min((now - start) / durationAnim, 1);
    setTimelineScale(0.2 + progress * 0.8);
    if (progress < 1) {
      rafId = window.requestAnimationFrame(animate);
    }
  };
  rafId = window.requestAnimationFrame(animate);
  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
  };
}, []);
  // seek
  const seekAtPercent = (percent:number) => {
    if (!videoRef.current || !duration) return
    const p = clamp(percent, 0, 1)
    const newTime = p * duration
    videoRef.current.currentTime = newTime
    setTime(newTime)
  }
  const handleSeekMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const p = (e.clientX - rect.left) / rect.width
    seekAtPercent(p)
  }
  const handleSeekTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    const t = e.touches[0]
    const rect = timelineRef.current.getBoundingClientRect()
    const p = (t.clientX - rect.left) / rect.width
    seekAtPercent(p)
  }
  // trim drag (use timeline rect to avoid parent issues)
  const startDrag = (which:'in'|'out') => (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const onMove = (ev: MouseEvent) => {
     const scrollLeft =
  (videoViewportRef.current?.scrollLeft ?? 0); // aktif track video ise
const px = ev.clientX - rect.left + scrollLeft;
 // hangi viewport ise
      const t = Math.max(0, (px - gap) / pxPerSec)
      if (which === 'in') setInPoint(Math.min(t, (outPoint ?? duration) || 0))
      else setOutPoint(Math.max(t, inPoint))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  // playhead drag
  const startPlayheadDragMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const onMove = (ev: MouseEvent) => {
      const p = clamp((ev.clientX - rect.left)/rect.width, 0, 1)
      seekAtPercent(p)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const startPlayheadDragTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const onMove = (ev: TouchEvent) => {
      const t = ev.touches[0]
      const p = clamp((t.clientX - rect.left)/rect.width, 0, 1)
      seekAtPercent(p)
    }
// seek sonrası görünümü track bazında hizala
scrollToTime(videoViewportRef.current, newTime, 'video');
scrollToTime(musicViewportRef.current, newTime, 'music');
    const onUp = () => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('touchcancel', onUp)
    }
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    window.addEventListener('touchcancel', onUp)
  }
  // segment ops
  const deleteSegment = (index: number) => {
    const updated = segments.filter((_, i) => i !== index)
    setSegments(updated)
  }
  const duplicateSegment = (index: number) => {
    const seg = segments[index]
    const clone = { start: seg.start, end: seg.end }
    const updated = [...segments.slice(0, index + 1), clone, ...segments.slice(index + 1)]
    setSegments(updated)
  }
  // split at playhead
const splitAtPlayhead = () => {
  if (duration <= 0 || segments.length === 0) return;
  const t = getTimeAtPlayhead(); // 🔴 kırmızı imlecin altındaki gerçek zaman
  const MIN = 0.2;
  let changed = false;
  const next: Segment[] = [];
  for (const s of segments) {
    if (t > s.start + MIN && t < s.end - MIN) {
      next.push({ start: s.start, end: t });
      next.push({ start: t, end: s.end });
      changed = true;
    } else {
      next.push(s);
    }
  }
  if (!changed) return;

  let newSelectedIndex: number | null = null;
  next.forEach((seg, idx) => {
    if (newSelectedIndex === null && t >= seg.start && t < seg.end) {
      newSelectedIndex = idx;
    }
  });

  setSegments(next);
  if (newSelectedIndex !== null) {
    setSelectedSegmentIndex(newSelectedIndex);
    setSelectedSegmentType("video");
    setSelectedTrack("video");
  }
};

  // 🎨 Tüm preset'ler için CSS filter helper
  const cssFilterForPreset = (p: Preset): string => {
    switch (p) {
      case 'warm':
        return 'brightness(1.05) contrast(1.05) saturate(1.2)'
      case 'cool':
        return 'brightness(1.0) contrast(1.05) saturate(1.05) hue-rotate(200deg)'
      case 'vibrant':
        return 'brightness(1.05) contrast(1.1) saturate(1.35)'
      case 'bw':
        return 'grayscale(1) contrast(1.1)'
      case 'pop':
        return 'brightness(1.06) contrast(1.12) saturate(1.45)'
      case 'soft':
        return 'brightness(1.02) contrast(0.98) saturate(1.05)'
      case 'cinematic':
        return 'brightness(0.98) contrast(1.15) saturate(1.15) hue-rotate(330deg)'
      case 'bright':
        return 'brightness(1.15) contrast(1.05) saturate(1.1)'
      default:
        return 'none'
    }
  }
  // Seçili preset için önizleme filtresi
  const cssFilter = cssFilterForPreset(preset)
  const ffmpegFilterFromPreset = () => {
    let contrast = 1.0, brightness = 0.0, saturation = 1.0
    let gray = false, hueRotateDeg = 0
    if (preset === 'warm')      { contrast=1.05; brightness=0.05; saturation=1.20 }
    if (preset === 'cool')      { contrast=1.05; brightness=0.00; saturation=1.05; hueRotateDeg=200 }
    if (preset === 'vibrant')   { contrast=1.10; brightness=0.05; saturation=1.35 }
    if (preset === 'bw')        { gray=true; contrast=1.10; brightness=0.00; saturation=1.00 }
    if (preset === 'pop')       { contrast=1.12; brightness=0.06; saturation=1.45 }
    if (preset === 'soft')      { contrast=0.98; brightness=0.02; saturation=1.05 }
    if (preset === 'cinematic') { contrast=1.15; brightness=-0.02; saturation=1.15; hueRotateDeg=330 }
    if (preset === 'bright')    { contrast=1.05; brightness=0.15; saturation=1.10 }
    const parts: string[] = [
      `eq=contrast=${contrast.toFixed(2)}:brightness=${brightness.toFixed(2)}:saturation=${saturation.toFixed(2)}`
    ]
    if (gray) parts.push('format=gray')
    if (hueRotateDeg) parts.push(`hue=h=${hueRotateDeg}`)
    return parts.join(',')
  }
const handleCancelExport = () => {
  cancelExportRef.current = true;
  setExportStatusText("İptal ediliyor...");
};

// 🧠 FFmpeg'i 1 kere oluştur + progress bağla
const ensureFFmpeg = async () => {
  if (!ffmpegInstance) {
    try {
      ffmpegInstance = createFFmpeg({
        log: true,
        corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
      });

      // Yükleme / encode sırasında yüzde takibi
      if (typeof ffmpegInstance.setProgress === "function") {
        ffmpegInstance.setProgress(({ ratio }: any) => {
          const raw = Math.round((ratio || 0) * 100);
          const clamped = Math.min(99, Math.max(1, raw)); // 1–99 arası gezinsin

          setExportProgress(clamped);

          if (clamped < 20) setExportStatusText("Görüntü hazırlanıyor...");
          else if (clamped < 50) setExportStatusText("Yeniden boyutlandırılıyor...");
          else if (clamped < 80) setExportStatusText("Video işleniyor...");
          else setExportStatusText("Son dokunuşlar...");
        });
      }

      console.log("⏳ FFmpeg yükleniyor...");
      setExportStatusText("FFmpeg hazırlanıyor...");
      await ffmpegInstance.load();
      console.log("✅ FFmpeg hazır");
      setExportStatusText("FFmpeg hazır. Dışa aktarmaya başlanıyor...");
    } catch (err) {
      console.error("❌ FFmpeg yükleme hatası:", err);
      setExportStatusText("❌ FFmpeg yüklenemedi.");
      throw new Error("FFmpeg yüklenemedi. Sayfayı yenileyin.");
    }
  }

  return ffmpegInstance!;
};


// 🚀 EN BASİT HALİ: Sadece yüklenen videoyu aynen dışa aktar (re-encode yok)
const exportWasm = async () => {
  if (!fileUrl) {
    alert("❌ Dışa aktarılacak medya bulunamadı!");
    return;
  }

  if (ffmpegBusyRef.current) {
    alert("⚠️ Başka bir dışa aktarma işlemi sürüyor.");
    return;
  }

  ffmpegBusyRef.current = true;

  try {
    setExporting(true);
    setDownloadUrl(null);
    setExportProgress(0);
    setExportStatusText("FFmpeg hazırlanıyor...");
    cancelExportRef.current = false;

    // 🧠 FFmpeg'i hazırla
    const ffmpeg = await ensureFFmpeg();

    const isImage = fileType?.startsWith("image") ?? false;
    const inputName = isImage ? "input.png" : "input.mp4";

    // Eski dosyaları temizle
    try { ffmpeg.FS("unlink", inputName); } catch {}
    try { ffmpeg.FS("unlink", "output.mp4"); } catch {}

    // Yüklediğin dosyayı FFmpeg sanal dosya sistemine yaz
    const blob = await fetch(fileUrl).then(r => r.blob());
    const data = new Uint8Array(await blob.arrayBuffer());
    ffmpeg.FS("writeFile", inputName, data);

    let args: string[] = ["-y"];

    if (isImage) {
      // 📷 Eğer sadece resim ise: 3 saniyelik basit bir video yap
      const imgDur = Math.max(3, duration || 3);
      args.push(
        "-loop", "1",
        "-framerate", "30",
        "-t", imgDur.toFixed(2),
        "-i", inputName,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "output.mp4"
      );
      setExportStatusText("Fotoğraftan video oluşturuluyor...");
    } else {
      // 🎥 Video ise: SADECE KOPYALA, yeniden encode ETME
      args.push(
        "-i", inputName,
        "-c", "copy",
        "-movflags", "+faststart",
        "output.mp4"
      );
      setExportStatusText("Video kopyalanıyor...");
    }

    console.log("🎬 FFmpeg komutu:", args.join(" "));

    // ❗ BURAYA DİKKAT: üç nokta olacak
    await ffmpeg.run(...args);

    if (cancelExportRef.current) {
      setExportStatusText("⛔ Dışa aktarma iptal edildi.");
      setExportProgress(null);
      return;
    }

    setExportProgress(100);
    setExportStatusText("✅ Dışa aktarma tamamlandı!");

    // FFmpeg çıktı dosyasını oku ve blob oluştur
const outData = ffmpeg.FS("readFile", "output.mp4") as Uint8Array;
// TS burada SharedArrayBuffer ihtimalinden korkuyor, ama bizim için normal ArrayBuffer.
// Bu yüzden buffer'ı açıkça ArrayBuffer olarak işaretliyoruz.
const blobOut = new Blob([outData.buffer as ArrayBuffer], { type: "video/mp4" });
const url = URL.createObjectURL(blobOut);
setDownloadUrl(url);


  } catch (err: any) {
    console.error("❌ Dışa aktarma hatası:", err);
    alert("Dışa aktarım hatası: " + (err?.message || err));
    setExportStatusText("❌ Hata oluştu.");
  } finally {
    ffmpegBusyRef.current = false;
    cancelExportRef.current = false;
    setExporting(false);
  }
};




  if (!fileUrl || !fileType) {
    return (
      <main
        className="w-full h-auto flex flex-col items-center justify-center bg-black text-white overflow-y-scroll overflow-x-hidden"
    onMouseDown={(e) => {
  // sadece ANA boş alana basılırsa seçim temizlensin
  if (e.target === e.currentTarget) {
    setSelectedSegmentIndex(null);
    setSelectedSegmentType(null);
    setSelectedTrack("none");
  }
}}

      >
        <p>Medya bulunamadı. Ana sayfadan dosya seç.</p>
        <Link
          href="/"
          className="px-4 py-2 rounded bg-[#7e22ce]"
        >
          Ana Sayfa
        </Link>
      </main>
    );
  }
const mediaDur = Math.min(duration || 0, audioRef.current?.duration || duration || 0);
  // --- Toplam süre hesabı (video + müzik + append klipler) ---
  const baseVideoDur = duration || 0;
  const baseMusicDur = audioRef.current?.duration || 0;
  const baseDurAll = Math.max(baseVideoDur, baseMusicDur);
  const totalDurationSec = baseDurAll + getAppendTotalSec();

  // --- UI ---
 return (
   <main
   <main
  className="w-full max-w-[900px] mx-auto min-h-screen flex flex-col items-center justify-start bg-black text-white overflow-y-auto overflow-x-hidden px-2"
    onClick={(e) => {
      // 🔹 Menüler her yerde tıklayınca kapansın
      setContextMenu(null);
      setShowMenu(false);
      // 🔹 Sadece gerçekten ANA boş alana tıklanırsa seçim iptal olsun
      if (e.target !== e.currentTarget) return;
      // Timeline seçimini temizle
      setSelectedSegmentIndex(null);
      setSelectedSegmentType(null);
      setSelectedTrack("none");
    }}
  >
{(isLoading || appendImporting) && (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-black z-[99999] transition-opacity duration-700">
    <h1 className="text-3xl font-bold text-white mb-4 animate-pulse">
      🧙‍♂️ Edit Sihirbazı
    </h1>
    <p className="text-gray-400 mb-4">
      {isLoading
        ? "Sizin için videonuzu hazırlıyor..."
        : "Seçtiğiniz videoları sona ekliyor..."}
    </p>
    <div className="w-[70%] h-[12px] bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-300"
        style={{
          width: `${
            isLoading ? loadingProgress : appendImportProgress
          }%`,
        }}
      />
    </div>
    <p className="mt-3 text-sm text-gray-300 font-mono">
      %{isLoading ? loadingProgress : appendImportProgress}
    </p>
  </div>
)}
    {/* Top Bar */}
      <header className="w-full max-w-[980px] px-2 pt-2 pb-1 flex items-center gap-2">
      <h1 className="text-base sm:text-lg font-bold tracking-wide text-[#a855f7]">
        Edit Sihirbazı
      </h1>

      {/* 📤 Dışa Aktar “ayar sayfası” butonu */}
      <button
        type="button"
        onClick={() => setShowExportPage(true)}
        className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-500/90 text-black text-xs font-semibold shadow-[0_0_12px_rgba(16,185,129,.7)] hover:bg-emerald-400 active:scale-95 transition-all"
      >
        📤 Dışa Aktar
      </button>

      <Link
        href="/"
        onClick={() => sessionStorage.clear()}
        className="text-xs text-gray-400 hover:text-white underline"
      >
        Yeni Medya Seç
      </Link>
     </header>

    {/* 📤 Dışa Aktar Ayar Sayfası (tam ekran overlay) */}
    {showExportPage && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
        <div className="w-full max-w-[460px] mx-4 rounded-2xl bg-[#141414] border border-[#2a2a2a] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Dışa Aktarma Ayarları
            </h2>
            <button
              type="button"
              onClick={() => !exporting && setShowExportPage(false)}
              className="text-xs text-gray-400 hover:text-white"
            >
              ✖ Kapat
            </button>
          </div>

          {/* Çözünürlük seçimleri */}
          <div className="space-y-2">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Çözünürlük
            </p>
            <div className="flex gap-2 flex-wrap">
              {["720p", "1080p", "2k", "4k"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setExportResolution(label.toLowerCase() as any)
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    exportResolution === label.toLowerCase()
                      ? "bg-emerald-500 text-black shadow-[0_0_14px_rgba(16,185,129,.8)]"
                      : "bg-[#222] text-gray-300 hover:bg-[#333]"
                  }`}
                >
                  {label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* FPS seçimleri */}
          <div className="space-y-2">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Kare Hızı (FPS)
            </p>
            <div className="flex gap-2">
              {[30, 45, 60].map((fps) => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => setExportFps(fps as 30 | 45 | 60)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    exportFps === fps
                      ? "bg-sky-500 text-black shadow-[0_0_14px_rgba(56,189,248,.8)]"
                      : "bg-[#222] text-gray-300 hover:bg-[#333]"
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Dışa aktar butonu */}
          <button
            onClick={exportWasm}
            disabled={exporting}
            className="w-full px-3 py-2 rounded-xl bg-emerald-400 text-black font-semibold shadow-[0_0_14px_rgba(16,185,129,.8)] hover:bg-emerald-300 disabled:bg-gray-500 disabled:shadow-none transition-all active:scale-95"
          >
            {exporting
              ? exportProgress !== null
                ? `⏳ İşleniyor... %${exportProgress}`
                : "⏳ İşleniyor..."
              : `📤 Dışa Aktar (${exportResolution.toUpperCase()} • ${exportFps} FPS)`}
          </button>

          {/* Progress + iptal + indir */}
          {exporting && (
            <div className="w-full mt-2 space-y-2">
              <div className="w-full h-2 rounded-full bg-[#222] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-fuchsia-500 transition-[width] duration-200 ease-out"
                  style={{ width: `${exportProgress ?? 5}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-300">
                <span>{exportStatusText ?? "İşlem hazırlanıyor..."}</span>
                <span className="tabular-nums">%{exportProgress ?? 0}</span>
              </div>
              <button
                type="button"
                onClick={handleCancelExport}
                className="w-full mt-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300 bg-red-500/20 hover:text-red-100 transition-all active:scale-95"
              >
                ❌ İptal Et
              </button>
            </div>
          )}

          {downloadUrl && (
            <a
              download={`edit_sihirbazi_${exportResolution}.mp4`}
              href={downloadUrl}
              className="mt-2 block text-xs underline text-gray-300 text-center"
            >
              📥 Videoyu indir
            </a>
          )}
        </div>
      </div>
    )}

    {/* 🎥 TikTok tarzı gerçek boyutlandırma */}
    <div
      id="video-container"
      className="relative bg-black flex items-center justify-center overflow-hidden rounded-xl"
      style={{
        aspectRatio: aspect || "9/16",
        width: "100%",
        maxHeight: "80vh",
      }}
    >
  {/* Platform çerçevesi */}
  <div
    className={
      "pointer-events-none absolute inset-0 rounded-[1.2rem] border " +
      (platformPreset === "youtube"
        ? "border-red-600/70"
        : platformPreset === "tiktok"
        ? "border-pink-500/70"
        : platformPreset === "reels"
        ? "border-fuchsia-500/70"
        : platformPreset === "instagram"
        ? "border-amber-400/70"
        : "border-white/10")
    }
  />
  {/* Üstte küçük etiket */}
  <div className="pointer-events-none absolute left-3 top-3 px-2 py-1 rounded-md bg-black/60 text-[10px] uppercase tracking-wide text-white/80">
    {platformPreset === "youtube"
      ? "YouTube Önizleme"
      : platformPreset === "tiktok"
      ? "TikTok Önizleme"
      : platformPreset === "reels"
      ? "Reels Önizleme"
      : platformPreset === "instagram"
      ? "Instagram Önizleme"
      : "Önizleme"}
  </div>
{fileType?.startsWith("video") && (
  <div className="relative w-full h-full  flex items-center justify-center bg-black rounded-xl overflow-hidden">
    <video
      ref={videoRef}
      src={fileUrl!}
       className="relative z-[10] max-w-full max-h-full object-contain transition-all duration-300"
      style={{
        filter: cssFilter,
        transformOrigin: "center",
        backgroundColor: "black",
      }}
      playsInline
      controls={false}
      disablePictureInPicture
      autoPlay={false}
      muted={false}
      preload="auto"
      onLoadedMetadata={() => {
        if (videoRef.current) setDuration(videoRef.current.duration || 0);
      }}
      onLoadedData={() => extractFrames()}
      onPlay={() => setPlaying(true)}
      onPause={() => {}}
onEnded={() => {
  // 🎬 Video bitti: siyah ekran göster
  setShowBlackFrame(true);

  // Global oynatmayı kapat
  setPlaying(false);
  playingRef.current = false;

  // Videoyu son karede sabitle (istersen 0'a da alabiliriz)
  if (videoRef.current) {
    const v = videoRef.current;
    const end = Math.max(0, (v.duration || 0) - 0.001);
    v.pause();
    v.currentTime = end;
  }

  // Ana müziği otomatik BAŞLATMA, varsa durdur
  const a = audioRef.current;
  if (a) {
    a.pause();
    // a.currentTime'i 0'a ALMADIĞIM için baştan tekrar başlamaz
    // istersen buraya: a.currentTime = 0; da ekleyebiliriz
  }
}}


    />
    {/* 🎬 Video bittiğinde siyah ekran */}
   {showBlackFrame && (
      <div
        className="fixed inset-0 bg-black z-[999999] pointer-events-none transition-opacity duration-300"
        style={{ opacity: 1 }}
      />
    )}
  </div>
)}
{fileType && fileType.startsWith("image") && (
  <div className="relative w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden">
    <img
      ref={imgRef}
      src={fileUrl!}
      alt="Yüklenen görsel"
      className="relative z-[10] max-w-full max-h-full object-contain transition-all duration-300"
      style={{ transformOrigin: "center", backgroundColor: "black", filter: cssFilter }}
      onLoad={() => {
        const D = 3;            // her resim 3 sn
        setDuration(D);
        durationRef.current = D;
        setTime(0);
        setSegments([{ start: 0, end: D }]);  // timeline’da şerit
        setOutPoint?.(D);
        setShowBlackFrame(false);
      }}
      onError={() => console.error("Görsel yüklenemedi veya desteklenmiyor.")}
    />
  </div>
)}

  
</div>
    
{/* === TİMELİNE (SABİT MERKEZ İMLEÇ) === */}
{fileType && (fileType.startsWith("video") || fileType.startsWith("image")) && (
  <section className="w-full max-w-[700px] mx-auto mt-[60px] pb-24 relative">
   {/* 🔴 Sabit ortadaki imleç */}
<div
  className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-[3px] z-[999999]"
  style={{
    transform: "translateX(-50%)",
    background:
      playheadColor === "red"
        ? "rgba(255,0,0,0.9)"
        : playheadColor === "blue"
        ? "rgba(0,136,255,0.9)"
        : playheadColor === "purple"
        ? "rgba(168,85,247,0.9)"
        : "rgba(255,255,255,0.9)",
    boxShadow: `0 0 20px 5px ${
      playheadColor === "red"
        ? "rgba(255,0,0,0.8)"
        : playheadColor === "blue"
        ? "rgba(0,136,255,0.8)"
        : playheadColor === "purple"
        ? "rgba(168,85,247,0.8)"
        : "rgba(255,255,255,0.8)"
    }`,
    borderRadius: "3px",
    height: "1000px",
  }}
>
  {/* 🔺 Küçük üçgen (CapCut tarzı, mobil uyumlu) */}
  <div
  className="absolute left-1/2 translate-x-[-50%] w-0 h-0 sm:border-t-[6px] sm:border-x-[4px] sm:border-x-transparent
              border-b-[6px] border-x-[4px] border-x-transparent"
  style={{
    borderBottomColor: "rgba(255,0,0,0.9)",
    borderTopColor: "rgba(255,0,0,0.9)",
    bottom: "-8px",
    top: "auto",
  }}
/>
</div>
{/* ⏱️ İmleç zamanı (canlı) */}
<div
  className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2
             px-2 py-[2px] rounded bg-black/80 border border-white/20
             text-[11px] font-mono z-[1000000]"
>
  {formatTime(getTimeAtPlayhead())}
</div>
{/* === VIDEO VIEWPORT (PAN/ZOOM BAĞIMSIZ) === */}
<div
  ref={videoViewportRef}
 className="hidden relative w-full h-[90px] overflow-x-scroll overflow-y-hidden bg-[#0b0b0b] rounded-md"
  onMouseDown={makePanDrag("video")}
>
  {/* time içeriği */}
  <div
    className="relative flex h-full items-center"
    style={{
      width: `${(duration || 0) * vPxPerSec + gap * 2 + FREE_PAD}px`,
      marginLeft: `${gap + FREE_PAD}px`,
    }}
  >
    {/* 🎞️ Video veya resim aynı akış hattında */}
    {(fileType?.startsWith("video") && frames?.length > 0) ||
    (fileType?.startsWith("image") && fileUrl) ? (
      <div
        className="flex h-full absolute top-0 left-0"
        style={{
          width: `${(duration || 0) * vPxPerSec}px`,
         
        }}
      >
        {fileType?.startsWith("video") && frames?.length > 0
          ? frames.map((f, i) => (
              <img
                key={i}
                src={f}
                alt={`frame-${i}`}
                className="object-cover"
                style={{
                  width: `${vPxPerSec}px`,
                  height: "100%",
                  flexShrink: 0,
                  opacity: 0.9,
                }}
              />
            ))
          : Array.from({ length: Math.ceil(duration) }, (_, i) => (
              <img
                key={i}
                src={fileUrl!}
                alt={`frame-${i}`}
                className="object-cover"
                style={{
                  width: `${vPxPerSec}px`,
                  height: "100%",
                  flexShrink: 0,
                  filter: cssFilter,
                  opacity: 0.9,
                }}
              />
            ))}
      </div>
    ) : null}
{segments.map((seg, i) => (
  <div
    key={i}
    className="absolute bg-purple-600/40 rounded-md border border-purple-400/70"
    style={{
      left: `${seg.start * vPxPerSec}px`,
      width: `${(seg.end - seg.start) * vPxPerSec}px`,
      height: "80%",
      zIndex: 2,            // ▶ segmentler karelerin üstünde görünsün
    }}
  />
))}
  </div>
</div>
<div
  onMouseUpCapture={() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }}
  onMouseLeave={() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }}
  ref={videoViewportRef}
onClick={(e) => {
  e.stopPropagation();
  setSelectedTrack(selectedTrack === "video" ? "none" : "video");
}}
className="relative w-full flex flex-col gap-3 overflow-x-auto scrollbar-hide rounded-xl select-none bg-[#0b0b0b] transition-all duration-300"
      style={{ height: `${100 + (zoom - 1) * 0}px` }}
      onContextMenu={(e)=>e.preventDefault()}
      onWheel={handleWheelZoom}
      onMouseDown={makePanDrag('video')}
      onMouseDownCapture={handleTimelineGrab}
      onTouchStartCapture={handleTimelineGrab}
      onAuxClick={(e)=>e.preventDefault()}
      title="Sol tuş: sürükle (pan) • Orta tuş: sürükle (zoom) • Mouse tekerlek: zoom"
    > 
{/* 🖼 Fotoğrafı video time’ın İÇİNE döşe */}
<div
  className="relative bg-gray-800 rounded-md overflow-hidden"
 style={{
  marginLeft: `${(gapRef.current || 0) + FREE_PAD}px`,
        width: `${Math.max(
      1,
      (
        Math.max(duration || 0, audioRef.current?.duration || 0) +
        getAppendTotalSec()
      ) * mPxPerSec
        + (gapRef.current || 0) * 2
        + FREE_PAD
    )}px`,
  height: "100%",
  transition: "width 1s linear, transform 0.3s ease-out",
}}
>
{/* ✂️ Bölme çizgisi efekti */}
{splitFlashTime !== null && (
  <div
    className="absolute top-0 bottom-0 w-[2px] bg-[#a855f7] shadow-[0_0_16px_rgba(168,85,247,0.9)] animate-pulse"
    style={{
      left: `${gap + splitFlashTime * vPxPerSec}px`,
      transition: "left 0.2s linear",
    }}
  ></div>
)}
<div
  onClick={(e) => {
  e.stopPropagation();
  setShowMenu(true);
  // Timeline’a tıklanınca menü sağ ortada gözüksün
  setContextMenu({ x: window.innerWidth - 200, y: window.innerHeight / 2, index: 0 });
}}
  className="absolute inset-0 z-[50] cursor-pointer"
  title="Sil / Ses Kapat menüsü"
></div>
{/* 🎚️ Zaman Çizelgesi (timeline ile birlikte akar) */}
<div
  ref={rulerRef}
  className="absolute top-[-24px] left-0 h-[22px] w-full text-[10px] font-mono text-gray-400 select-none overflow-hidden"
  style={{
    background: "linear-gradient(to bottom, #111, #0b0b0b)",
    borderBottom: "1px solid #222",
    zIndex: 30,
  }}
>
  <div
  className="absolute top-0 left-0 h-full"
  style={{
    width: `${(duration || 0) * vPxPerSec + gap * 2}px`,
    // 🎯 Başlangıç noktası sabit imleç olsun
    marginLeft: `${
      videoViewportRef.current?.clientWidth
        ? videoViewportRef.current.clientWidth / 2
        : 0
    }px`,
    
    position: "relative",
  }}
>
    {Array.from({ length: Math.ceil(duration * 10) + 1 }).map((_, i) => {
      const t = i / 10
      const sec = Math.floor(t)
      const ms = Math.round((t % 1) * 10)
      const label = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(
        sec % 60
      ).padStart(2, "0")}.${ms}`
      const isMajor = i % 10 === 0
      return (
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${t * vPxPerSec}px` }}
        >
          <div
            className={`${
              isMajor ? "h-[6px] bg-gray-300" : "h-[3px] bg-gray-500/30"
            } w-[1px] mb-[1px]`}
          />
          {isMajor && <span>{label}</span>}
        </div>
      )
    })}
  </div>
</div>
      
{/* Başlangıç (In) tutamacı */}
{selectedTrack === "video" && (
  <div
    onMouseDown={(e) => startTrimDrag(e, "in", "video")}
    className="absolute left-0 top-0 h-full w-[8px]
               bg-gradient-to-b from-[#a855f7] to-[#9333ea]
               shadow-[0_0_16px_rgba(168,85,247,0.85)]
               rounded-r-md cursor-ew-resize z-[30]"
    title="Başlangıç - kırpma tutamacı"
  />
)}
{/* Bitiş (Out) tutamacı */}
{selectedTrack === "video" && (
  <div
    onMouseDown={(e) => startTrimDrag(e, "out", "video")}
    className="absolute right-[0px] translate-x-[-100%] top-0 h-full w-[8px]
               bg-gradient-to-b from-[#9333ea] to-[#7e22ce]
               shadow-[0_0_16px_rgba(168,85,247,0.85)]
               rounded-l-md cursor-ew-resize z-[30]"
    title="Bitiş - kırpma tutamacı"
  />
)}
{/* ⬇️ Seçiliyken sol başta kalın tutamaç */}
{selectedTrack === "video" && (
  <div
    onMouseDown={(e) => startTrimDrag(e, "in", "video")}
    className="absolute left-0 top-0 h-full w-[8px]
               bg-gradient-to-b from-[#a855f7] to-[#9333ea]
               shadow-[0_0_16px_rgba(168,85,247,0.85)]
               rounded-r-md cursor-ew-resize z-[20]"
    title="Başlangıç - kırpma tutamacı"
  />
)}
{/* Trim aralığı vurgusu */}
{inPoint !== null && outPoint !== null && (
  <div
    className="absolute top-0 h-full bg-[#9333ea]/20 border-x border-[#a855f7]/60 z-[10]"
    style={{
      left: `${gap + inPoint * vPxPerSec}px`,
      width: `${Math.max(1, gap + (duration || 0) * vPxPerSec + gap)}px`,
transition: "width 1s ease-out",
    }}
  />
)}
        {/* Kareler */}
        <div className="h-[88px] relative">
{/* 🎬 Bölünmüş segment kutuları */}
{segments.map((s, i) => (
  <div
onMouseDown={makeSegmentLongDrag('video', i)}
onClick={(e) => {
  e.stopPropagation();
  setSelectedSegmentIndex(i);
  setSelectedSegmentType("video");
}}
className="absolute top-0 h-[88px] rounded-xl overflow-hidden cursor-pointer transition-all duration-200"

    key={i}
  
    style={{
      left: `${gap + s.start * vPxPerSec}px`,
      width: `${(s.end - s.start) * vPxPerSec}px`,
      border: "3px solid white",
      borderRadius: "12px",
      boxShadow: "0 0 16px rgba(255,255,255,0.4)",
      background: "rgba(255,255,255,0.04)",
      zIndex: 5,
...(freeDrag?.active && freeDrag.kind === 'video' && freeDrag.index === i
  ? {
      zIndex: 999,                 // en üste
      transform: 'scale(1.03)',    // milimetrik büyüt
      boxShadow: '0 0 22px rgba(34,197,94,0.55)', // yeşil ışıma
      transition: 'transform 120ms ease, box-shadow 120ms ease',
    }
  : null),
    }}
  >



    {/* Üst başlık alanı */}
    <div
      className="absolute top-[-18px] left-[-3px] px-2 py-[1px] text-[11px] font-semibold text-white border-2 border-white rounded-t-lg shadow-[0_0_10px_rgba(255,255,255,0.8)]"
      style={{
        clipPath: "polygon(0 0, 100% 0, 95% 100%, 5% 100%)", // çentikli efekt
        background: "linear-gradient(180deg, #ffffff, #d4d4d4)",
        color: "#000",
      }}
    >
      Parça {i + 1}
    </div>
  </div>
))}
{/* 🎨 Segment arka planları */}
{segments.map((s, i) => (
  <div
    key={i}
    className="absolute top-0 bottom-0"
    style={{
      left: `${gap + s.start * vPxPerSec}px`,
      width: `${(s.end - s.start) * vPxPerSec}px`,
      background: i % 2 === 0 ? "#9333ea10" : "#22c55e10",
      borderLeft: "1px solid rgba(147,51,234,0.3)",
      borderRight: "1px solid rgba(147,51,234,0.3)",
      transition: "all 0.3s ease-out",
      zIndex: 1,
     cursor: 'grab',
     ...(freeDrag?.active && freeDrag.kind === 'video' && freeDrag.index === i
      ? { outline: '2px dashed #22c55e', cursor: 'grabbing' }
       : null),
    }}
  />
))}
{/* ➕ Sona eklenen ekstra klipler (video + resim) */}
{appendVideos.map((clip, idx) => {
  // Bu klipten önceki bütün ek kliplerin toplam süresi
  const prevDuration = appendVideos
    .slice(0, idx)
    .reduce((sum, c) => {
      if (c.kind === "image") return sum + APPEND_CLIP_SEC;
      return sum + (c.duration ?? APPEND_CLIP_SEC);
    }, 0);
  // Bu klibin kendi süresi
  const clipDur =
    clip.kind === "image"
      ? APPEND_CLIP_SEC
      : (clip.duration ?? APPEND_CLIP_SEC);
  // Ana videonun sonundan itibaren başlama zamanı
  const start = (duration || 0) + prevDuration;
  return (
    <div
      key={`append-${idx}`}
      className="absolute top-[10%] h-[72px] rounded-xl border border-emerald-400/70 bg-emerald-400/10 flex items-center justify-center text-[10px] text-emerald-200"
      style={{
        left: `${gap + start * vPxPerSec}px`,
        width: `${clipDur * vPxPerSec}px`,
        zIndex: 0, // segment kutularının altında kalsın
      }}
    >
      {clip.kind === "image" ? "🖼️ Resim" : "🎬 Video"}
    </div>
  );
})}
        {fileType?.startsWith("video") && 
frames?.length > 0
  ? frames.map((f, i) => {
      const pos = gap + ((duration ? (i / frames.length) * duration : 0) * vPxPerSec);
      return (
        <img
          key={`v-${i}`}
          src={f}
          className="absolute top-0 object-cover bg-black"
          style={{
            left: `${pos}px`,
            width: `${vPxPerSec}px`,
            height: "100%",
            borderRadius: "2px",
          }}
          alt=""
          draggable={false}
        />
      );
    })
  : (fileType?.startsWith("image") && fileUrl)
  ? Array.from({ length: Math.max(1, Math.ceil((duration || 3))) }).map((_, i) => {
      const pos = gap + i * vPxPerSec; // her saniyeye bir kare
      return (
        <img
          key={`img-${i}`}
          src={fileUrl}
          className="absolute top-0 object-cover"
          style={{
            left: `${pos}px`,
            width: `${vPxPerSec}px`,
            height: "100%",
            filter: cssFilter,
            opacity: 0.9,
          }}
          alt=""
          draggable={false}
        />
      );
    })
  : null}
{/* ➕ Sona eklenen klipler (video + resim) */}
{appendVideos.length > 0 && (() => {
  let offset = duration || 0; // ilk klip ana videonun sonunda başlasın
  return appendVideos.map((clip, idx) => {
    const clipDur =
      clip.kind === "image"
        ? APPEND_CLIP_SEC
        : (clip.duration ?? APPEND_CLIP_SEC);
    const start = offset;
    offset += clipDur;
    return (
      <div
        key={`append-${idx}`}
        className="absolute top-1/2 -translate-y-1/2 h-[72px] rounded-xl overflow-hidden shadow-[0_0_10px_rgba(0,0,0,.8)] border border-white/10"
        style={{
          left: `${gap + start * vPxPerSec}px`,
          width: `${clipDur * vPxPerSec}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTrack("video");
          // buraya istersek ayrı seçim state’i de ekleriz
        }}
      >
        {clip.kind === "image" ? (
          <img
            src={clip.url}
            alt="Resim klip"
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <video
            src={clip.url}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
          />
        )}
      </div>
    );
  });
})()}
        </div>
      </div>
    </div>
{/* ➕ SONA VİDEO EKLE butonu */}
<button
   onClick={(e) => {
    e.stopPropagation();
    // Yeni Medya Seç’teki gibi dosya seçtiren input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*,image/*";
    input.multiple = true; // birden fazla video/resim seçebil
       input.onchange = async (ev: any) => {
      const fileList = ev.target.files as FileList | null;
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const total = files.length;
      // 🎛 Yükleme ekranını aç
      setAppendImporting(true);
      setAppendImportProgress(0);
      let doneCount = 0;
      const updateProgress = () => {
        doneCount++;
        const percent = Math.round((doneCount / total) * 100);
        setAppendImportProgress(percent);
      };
      for (const f of files) {
        const url = URL.createObjectURL(f);
        const kind: "video" | "image" =
          f.type.startsWith("image") ? "image" : "video";
        // 🖼 Resimler: sabit süreli klip (APPEND_CLIP_SEC)
        if (kind === "image") {
          setAppendVideos((prev) => [
            ...prev,
            { url, kind: "image", duration: APPEND_CLIP_SEC },
          ]);
          updateProgress();
          continue;
        }
        // 🎬 Videolar: önce metadata'dan gerçek süresini oku
        await new Promise<void>((resolve) => {
          const tempVideo = document.createElement("video");
          tempVideo.src = url;
          tempVideo.preload = "metadata";
          tempVideo.onloadedmetadata = () => {
            const dur = tempVideo.duration || APPEND_CLIP_SEC;
            setAppendVideos((prev) => [
              ...prev,
              { url, kind: "video", duration: dur },
            ]);
            updateProgress();
            resolve();
          };
          tempVideo.onerror = () => {
            // Süre okunamazsa fallback
            setAppendVideos((prev) => [
              ...prev,
              { url, kind: "video", duration: APPEND_CLIP_SEC },
            ]);
            updateProgress();
            resolve();
          };
        });
      }
      // ✅ Hepsi bitti
      setAppendImportProgress(100);
      setTimeout(() => {
        setAppendImporting(false);
      }, 400);
      // Küçük bilgi mesajı
      setSoundMsg(`${total} medya klibi sona eklendi`);
      if (soundMsgTimer.current) window.clearTimeout(soundMsgTimer.current);
      soundMsgTimer.current = window.setTimeout(
        () => setSoundMsg(null),
        2000
      );
    };
    input.click();
  }}
  title="Sona video ekle"
  className="absolute z-[60] w-[40px] h-[40px] rounded-full
             bg-white/20 hover:bg-white/30
             border border-white/70
             flex items-center justify-center
             hover:scale-110 active:scale-95 cursor-pointer
             transition-all shadow-[0_0_16px_rgba(255,255,255,5)]"
  style={{
    right: "-45px",
    top: "25%",
    transform: "translateY(-50%)",
  }}
>
  <span className="text-2xl leading-none text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
    +
  </span>
</button>
{/* 🔸 Eklenen video sayısını göster */}
{appendVideos.length > 0 && (
  <div
    className="absolute z-[50] text-xs font-mono px-2 py-1 rounded
               bg-black/70 border border-[#22c55e]/40 text-white/90"
    style={{
  left: `${(gap + (duration || 0) * vPxPerSec) + 20}px`,
  top: "50%",
  transform: "translateY(-50%)",
  transition: "left 0.2s ease-out",
}}
  >
    +{appendVideos.length} klip
  </div>
)}
{/* 🔗 Bağlı / 🪶 Serbest – Müzik Ekle’nin ÜSTÜNE konumlanır */}
<button
   onClick={(e) => {
    e.stopPropagation();
  setLinkTracks(prev => {
  const next = !prev;

  if (next) {
    // 🔒 Bağla’ya geçerken, O ANKİ video ve müzik scroll farkını offset olarak kaydet
    const v = videoViewportRef.current;
    const m = musicViewportRef.current;

    if (v && m) {
      // px cinsinden fark: müzik, videodan ne kadar ileride/geride?
      musicScrollOffsetRef.current = m.scrollLeft - v.scrollLeft;
    }

    // Müzik için sol kilidi de güncelle (eski davranış)
    if (m) setMusicLockScroll(m.scrollLeft);
  } else {
    // 🪶 Serbest’e dönünce sadece kilidi temizle
    setMusicLockScroll(null);
    // İstersen burada offset'i SIFIRLAMAYABİLİRİZ.
    // Böylece serbest modda da mevcut fark korunur.
    // musicScrollOffsetRef.current'u dokunmadan bırakmak iyi çalışıyor.
  }

  return next;
});

  }}

  title={linkTracks ? "Zinciri aç (serbest kaydır)" : "Zinciri kapat (bağlı kaydır)"}
  className={`absolute -left-[56px] top-[calc(50%-52px)] -translate-y-1/2
              w-[42px] h-[42px] rounded-full z-20
              shadow-[0_0_12px_rgba(34,197,94,0.5)] hover:scale-110 active:scale-95 transition-all
              ${linkTracks ? "bg-[#22c55e]/20 text-[#22c55e]" : "bg-[#3a3a3a] text-white"}`}
>
  {linkTracks ? "🔗" : "🪶"}
</button>
  {/* === MÜZİK VIEWPORT (PAN/ZOOM BAĞIMSIZ) === */}
<div className="relative w-full max-w-[700px] mx-auto mt-4">
  {/* 🎵 Sol dıştaki ikon (kutunun DIŞI) */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "file";
input.accept = "audio/*,video/*";
      input.onchange = (ev: any) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  // 🎧 Yeni müziği anında ekle (sayfa yenilenmeden)
  setMusicLayers((prev) => [...prev, url]);
  setMusicUrl(url);
  sessionStorage.setItem("selectedMusicUrl", url);
  // 🎵 Gizli audio elemanını da senkronize et
  if (audioRef.current) {
    audioRef.current.src = url;
    audioRef.current.load();
  }
};
// 🎬 Yeni eklenen müziği anında senkronize et
setTimeout(() => {
  const t = videoRef.current?.currentTime ?? 0;
  const last = musicAudioRefs.current[musicAudioRefs.current.length - 1];
  if (last) {
    last.currentTime = t;
    if (playing) last.play().catch(() => {});
  }
}, 0);
      input.click();
    }}
    title="Müzik Ekle"
    className="absolute -left-[56px] top-1/2 -translate-y-1/2 flex items-center justify-center
               w-[42px] h-[42px] rounded-full bg-[#22c55e]/10 text-[#22c55e]
               shadow-[0_0_12px_rgba(34,197,94,0.5)] hover:bg-[#22c55e]/20
               hover:scale-110 active:scale-95 transition-all"
  >
    {/* %15 küçük ikon */}
    <span className="text-[24px] leading-none">🎵</span>
  </button>
  {/* Müzik dalga alanı — video timeline ile aynı GENİŞLİK ve 88px yükseklik */}
  <div
    ref={musicViewportRef}
 onClick={(e) => {
  e.stopPropagation();
  setSelectedTrack(selectedTrack === "music" ? "none" : "music");
}}
className="relative w-full flex flex-col gap-2 overflow-x-auto scrollbar-hide rounded-xl select-none bg-[#0b0b0b] transition-all duration-300"
onContextMenu={(e)=>e.preventDefault()}
onWheel={handleWheelZoom}
onMouseDown={makePanDrag("music")}
onMouseDownCapture={handleTimelineGrab}
    onAuxClick={(e)=>e.preventDefault()}
    title="Sol tuş: sürükle (pan) • Mouse tekerlek: zoom"
  >
<div
  className="relative bg-gray-700 rounded-md overflow-hidden"
style={{
  marginLeft: `${(gapRef.current || 0) + FREE_PAD}px`,
      width: `${Math.max(
  1,
  (Math.max(duration || 0, audioRef.current?.duration || 0)) * mPxPerSec
    + (gapRef.current || 0) * 2
    + FREE_PAD
)}px`,
  height: "100%",
  transition: "width 1s linear, transform 0.3s ease-out",
}}
>
      {/* Müzik yoksa placeholder */}
      {musicLayers.length === 0 && (
  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm opacity-40">
    (Müzik eklenmedi)
  </div>
)}
   {/* 🎵 Müzik katmanları */}
{musicLayers.length > 0 ? (
  // 👇 bu sarmalayıcıya relative ekle ki toast'ı ortalayabilelim
  <div className="flex flex-col gap-3 mt-2 relative">
    {musicLayers.map((url, idx) => {
      const isSelected = selectedMusicLayer === idx;
      const audio = musicAudioRefs.current[idx];
      return (
        <div
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedMusicLayer(idx);
            setSelectedTrack("music");
          }}
          className={`group relative rounded-2xl border-2 bg-[#0f0f0f] transition-all cursor-pointer overflow-hidden ${
            isSelected
              ? "border-[#22c55e] shadow-[0_0_16px_rgba(34,197,94,0.85)]"
              : "border-[#22c55e]/40 hover:border-[#22c55e]/80 hover:shadow-[0_0_12px_rgba(34,197,94,0.5)]"
          }`}
          style={{ height: "88px" }}
        >
          {/* 🔘 Sol üst: BÜYÜTÜLMÜŞ butonlar */}
          <div
  className="absolute top-2 left-3 flex gap-3 z-10"
  style={{
    transform: `translateX(${musicScroll}px)`,
    transition: "transform 0s",
  }}
>
{/* 🗑️ Sil */}
{hasTimelineSelection && (
<button
  onClick={() => {
  const confirmDelete = window.confirm(
    "Seçili kısmı silmek istediğine emin misin? Sadece bölünmüş parça kaldırılacak."
  );
  if (!confirmDelete) return;

  // 1️⃣ HALİHAZIRDA bir segment seçiliyse → onu sil
  if (selectedSegmentIndex !== null && selectedSegmentType) {
    if (selectedSegmentType === "video") {
      setSegments(prev => prev.filter((_, i) => i !== selectedSegmentIndex));
      console.log("🗑️ Video segmenti silindi:", selectedSegmentIndex);
    } else if (selectedSegmentType === "music") {
      setMusicSegments(prev => prev.filter((_, i) => i !== selectedSegmentIndex));
      console.log("🗑️ Müzik segmenti silindi:", selectedSegmentIndex);
    }

    setSelectedSegmentIndex(null);
    setSelectedSegmentType(null);
    setSelectedTrack("none");
    setContextMenu(null);
    setShowMenu(false);
    return;
  }

  // 2️⃣ Segment seçili değilse: KIRMIZI İMLECİN ALTINDAKİ parçayı bul ve sil
  const t = getPlayheadAbsoluteTime();

  // Önce video segmentlerine bak
  const videoIdx = segments.findIndex(seg => t >= seg.start && t <= seg.end);
  if (videoIdx !== -1) {
    setSegments(prev => prev.filter((_, i) => i !== videoIdx));
    console.log("🗑️ Video segmenti (playhead altı) silindi:", videoIdx);
    setSelectedSegmentIndex(null);
    setSelectedSegmentType(null);
    setSelectedTrack("none");
    setContextMenu(null);
    setShowMenu(false);
    return;
  }

  // Sonra müzik segmentlerine bak
  const musicIdx = musicSegments.findIndex(seg => t >= seg.start && t <= seg.end);
  if (musicIdx !== -1) {
    setMusicSegments(prev => prev.filter((_, i) => i !== musicIdx));
    console.log("🗑️ Müzik segmenti (playhead altı) silindi:", musicIdx);
    setSelectedSegmentIndex(null);
    setSelectedSegmentType(null);
    setSelectedTrack("none");
    setContextMenu(null);
    setShowMenu(false);
    return;
  }

  // 3️⃣ Hâlâ bulunamadıysa → kullanıcıya bilgi ver
  alert("Silinecek bir parça bulunamadı. Önce ✂️ Böl ile kes, sonra Sil'e bas.");
}}

  className="px-4 py-2 rounded-xl font-semibold bg-red-600 hover:bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] active:scale-95 transition-all"
>
  🗑️ Sil
</button>
)}
  
            {/* 🔇 Sustur / Aç */}
<button
onClick={(e) => {
  e.stopPropagation();
  const thisAudio = musicAudioRefs.current[idx];
  const globalAudio = audioRef.current;
  // 🎯 Önlem: bu katmandaki sesi tamamen sustur
  if (thisAudio) {
    const mutedNow = !thisAudio.muted;
    thisAudio.muted = mutedNow;
    thisAudio.volume = mutedNow ? 0 : 1;
    // 🔊 Aynı URL global seste de varsa onu da sustur
    if (globalAudio && globalAudio.src === thisAudio.src) {
      globalAudio.muted = mutedNow;
      globalAudio.volume = mutedNow ? 0 : 1;
    }
    setSoundMsg(mutedNow ? "🔇 Katman susturuldu" : "🔈 Katman sesi açıldı");
    if (soundMsgTimer.current) clearTimeout(soundMsgTimer.current);
    soundMsgTimer.current = window.setTimeout(() => setSoundMsg(null), 1500);
  }
}}
  className="relative w-28 h-28 flex items-center justify-center rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-black text-4xl shadow-[0_0_14px_rgba(234,179,8,0.8)] transition-all active:scale-95"
  title="Sesi Aç/Kapat"
>
  {audio?.muted ? (
    <>
      🔇
      <span className="absolute left-0 top-0 w-full h-full border-t-4 border-red-600 rotate-45 rounded-xl pointer-events-none"></span>
    </>
  ) : (
    "🔈"
  )}
</button>
          </div>
          {/* Katman etiketi */}
          <div className="absolute top-2 right-3 text-sm text-[#22c55e]/80 select-none">
            Katman {idx + 1}
          </div>
{/* 🎵 Müzik segment çerçeveleri */}
{musicSegments.map((s, i) => (
  <div
    key={i}
    onMouseDown={makeSegmentLongDrag("music", i)}
    onClick={(e) => {
      e.stopPropagation();
      setSelectedSegmentIndex(i);
      setSelectedSegmentType("music");
      setSelectedTrack("music");
    }}
    className="absolute top-0 h-full rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
    style={{
      left: `${gap + s.start * mPxPerSec}px`,
      width: `${(s.end - s.start) * mPxPerSec}px`,
      borderRadius: "12px",
      background: "rgba(255,255,255,0.04)",
      zIndex: 5,
      // normal görünüm
      ...(selectedSegmentType === "music" && selectedSegmentIndex === i
        ? {
            border: "3px solid #22c55e",
            boxShadow: "0 0 16px rgba(34,197,94,0.8)",
          }
        : {
            border: "3px solid rgba(255,255,255,0.6)",
            boxShadow: "0 0 10px rgba(255,255,255,0.4)",
          }),
      // uzun basılı sürükleme efekti
      ...(freeDrag?.active &&
        freeDrag.kind === "music" &&
        freeDrag.index === i
        ? {
            outline: "2px dashed #22c55e",
            cursor: "grabbing",
            zIndex: 999,
            transform: "scale(1.03)",
            boxShadow: "0 0 22px rgba(34,197,94,0.55)",
            transition:
              "transform 120ms ease, box-shadow 120ms ease, outline 120ms ease",
          }
        : { cursor: "grab" }),
    }}
  >
    {/* Üst başlık alanı */}
    <div
      className="absolute top-[-18px] left-[-3px] px-2 py-[1px] text-[11px] font-semibold text-black border border-white rounded-t-lg shadow-[0_0_10px_rgba(255,255,255,0.8)]"
      style={{
        clipPath: "polygon(0 0, 100% 0, 95% 100%, 5% 100%)",
        background: "linear-gradient(180deg, #ffffff, #d4d4d4)",
      }}
    >
      Parça {i + 1}
    </div>
  </div>
))}
               {/* Dalga formu */}
          <WaveformTrack
            audioUrl={url}
            pxPerSec={mPxPerSec}
            durationSec={duration}
            // 🎵 Her katman kendi zamanını kullanır;
            // henüz ölçülmediyse yedek olarak global time
            currentTime={musicTimes[idx] ?? 0}
          />
         {/* Ses tag'i (ref ile kontrol) */}
<audio
  ref={(el) => {
    if (el) {
      musicAudioRefs.current[idx] = el;
    }
  }}
  src={url}
  preload="auto"
  crossOrigin="anonymous"
  controls
  onTimeUpdate={(e) => {
    const t = e.currentTarget.currentTime;
    setMusicTimes((prev) => {
      const next = [...prev];
      next[idx] = t;
      return next;
    });
  }}
  className="absolute bottom-1 right-2 opacity-50 hover:opacity-100 w-[120px]"
/>

        </div>
      );
    })}
    {/* 🎵 Ortada fade'lenip kaybolan mesaj (map'in DIŞI!) */}
    {soundMsg && (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
        <div className="px-4 py-2 rounded-xl bg-black/70 text-white text-lg font-semibold animate-fadeOut">
          {soundMsg}
        </div>
      </div>
    )}
  </div>
) : (
  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm opacity-40">
    (Müzik eklenmedi)
  </div>
)}
      {/* Seçiliyken kap-cut tarzı tutamaçlar */}
      {selectedTrack === "music" && (
        <>
          <div
            onMouseDown={(e) => startTrimDrag(e, "in", "music")}
            className="absolute left-0 top-0 h-full w-[8px]
                       bg-gradient-to-b from-[#22c55e] to-[#16a34a]
                       shadow-[0_0_16px_rgba(34,197,94,0.85)]
                       rounded-r-md cursor-ew-resize z-[30]"
            title="Başlangıç - kırpma tutamacı"
          />
          <div
            onMouseDown={(e) => startTrimDrag(e, "out", "music")}
            className="absolute right-[0px] translate-x-[-100%] top-0 h-full w-[8px]
                       bg-gradient-to-b from-[#16a34a] to-[#15803d]
                       shadow-[0_0_16px_rgba(34,197,94,0.85)]
                       rounded-l-md cursor-ew-resize z-[30]"
            title="Bitiş - kırpma tutamacı"
          />
        </>
      )}
    </div>
  </div>
</div>
{/* === Boyutlandırma + Platform Önizleme: Timeline Altı === */}
<div className="w-full max-w-[900px] flex flex-wrap items-center justify-center gap-3 mt-10 mb-4 relative z-[60]">
  {/* Boyutlandırma dropdown */}
  <div className="relative">
    <button
      type="button"
      onClick={() => setShowAspectMenu((prev) => !prev)}
      className="px-4 py-2 bg-[#7e22ce] hover:bg-[#9333ea] rounded-lg transition-all active:scale-95 shadow-lg"
    >
      🧩 Boyutlandırma
    </button>
    {showAspectMenu && (
      <div className="absolute top-12 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-3 flex flex-col gap-2 text-xs text-white">
        {[
          { label: "📱 TikTok / Reels / Shorts — 9:16", ratio: "9/16" },
          { label: "🖼 Instagram Kare — 1:1", ratio: "1/1" },
          { label: "📸 Instagram Dikey — 4:5", ratio: "4/5" },
          { label: "🎞 YouTube — 16:9", ratio: "16/9" },
          { label: "🎬 Sinema — 21:9", ratio: "21/9" },
          { label: "📺 Eski TV — 4:3", ratio: "4/3" },
          { label: "🎥 Ultra Wide — 32:9", ratio: "32/9" },
          { label: "🎭 Snapchat — 3:4", ratio: "3/4" },
        ].map((r) => (
          <button
            key={r.ratio}
            type="button"
            onClick={() => {
              applyAspect(r.ratio)
              setShowAspectMenu(false)
            }}
            className="px-3 py-1 rounded bg-[#222] hover:bg-[#333] active:scale-95 text-left transition-all"
          >
            {r.label}
          </button>
        ))}
      </div>
    )}
  </div>
  {/* Platform preset butonları */}
  <div className="flex flex-wrap items-center gap-2 text-[11px]">
    <span className="text-gray-300">Platform önizleme:</span>
    <button
      type="button"
      onClick={() => applyAspect("16/9", "youtube")}
      className={
        "px-3 py-1 rounded-full border text-xs " +
        (platformPreset === "youtube"
          ? "bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(248,113,113,.6)]"
          : "bg-[#111] text-gray-300 border-white/10 hover:bg-[#222]")
      }
    >
      YouTube
    </button>
    <button
      type="button"
      onClick={() => applyAspect("9/16", "tiktok")}
      className={
        "px-3 py-1 rounded-full border text-xs " +
        (platformPreset === "tiktok"
          ? "bg-pink-600 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,.6)]"
          : "bg-[#111] text-gray-300 border-white/10 hover:bg-[#222]")
      }
    >
      TikTok
    </button>
    <button
      type="button"
      onClick={() => applyAspect("9/16", "reels")}
      className={
        "px-3 py-1 rounded-full border text-xs " +
        (platformPreset === "reels"
          ? "bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,.6)]"
          : "bg-[#111] text-gray-300 border-white/10 hover:bg-[#222]")
      }
    >
      Reels
    </button>
    <button
      type="button"
      onClick={() => applyAspect("4/5", "instagram")}
      className={
        "px-3 py-1 rounded-full border text-xs " +
        (platformPreset === "instagram"
          ? "bg-amber-500 text-black border-amber-300 shadow-[0_0_10px_rgba(245,158,11,.6)]"
          : "bg-[#111] text-gray-300 border-white/10 hover:bg-[#222]")
      }
    >
      Instagram
    </button>
  </div>
</div>
    {/* Ortadaki zaman etiketi */}
    <div
      className="absolute text-[10px] font-mono px-1 py-0.5 rounded text-white border bg-black/70"
      style={{
        left: "50%",
        transform: "translate(-50%, -130%)",
        top: 5,
        borderColor: "#444",
        zIndex: 999999,
      }}
    >
      {new Date(time * 1000).toISOString().substr(14, 5)}
    </div>
{/* 🎬 Beyaz Neon Play/Pause Tuşu (Timeline Sol Baş, Yumuşak Işık) */}
<div className="absolute -top-[70px] left-[335px] flex items-center gap-3 z-[999] select-none">
  <button
  onClick={togglePlay}
  className={`group flex items-center justify-center w-[32px] h-[32px] rounded-full border-2
    ${playing
      ? "border-white bg-transparent shadow-[0_0_14px_rgba(255,255,255,0.8)]"
      : "border-white/70 bg-transparent shadow-[0_0_14px_rgba(255,255,255,0.5)]"}
    transition-all hover:scale-110 active:scale-95 hover:shadow-[0_0_20px_rgba(255,255,255,1)]`}
>
    {playing ? (
      // ⏸️ Durdurma (Pause) İkonu - beyaz neon (aynı parlaklık)
      <div className="flex gap-[6px]">
  <div className="w-[5px] h-[18px] bg-white rounded-sm shadow-[0_0_8px_rgba(255,255,255,0.9)]"></div>
  <div className="w-[5px] h-[18px] bg-white rounded-sm shadow-[0_0_8px_rgba(255,255,255,0.9)]"></div>
</div>
    ) : (
      // ▶️ Oynat (Play) İkonu - beyaz neon
      <div className="ml-[2px] w-0 h-0 border-t-[8px] border-t-transparent border-l-[16px] border-l-white border-b-[8px] border-b-transparent drop-shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all group-hover:scale-110" />
    )}
  </button>
  {/* Süre Bilgisi */}
  <div className="text-sm font-mono text-white/70 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]  ml-[240px] mt-[50px]">
    {new Date(time * 1000).toISOString().substr(14, 5)} /{" "}
    {new Date(duration * 1000).toISOString().substr(14, 5)}
  </div>
</div>
  </section>
)}
    {/* Hidden Audio */}
<audio ref={audioRef} src={musicUrl ?? undefined} crossOrigin="anonymous" preload="auto" />
    {/* Scroll testi için geçici boşluk */}
    <div className="h-[80px] bg-transparent"></div>
    {/* Bottom toolbar */}
  <footer className="mt-20 mb-24 px-3 w-full flex justify-center">
  <div className="mx-auto w-full max-w-[980px] grid grid-cols-3 sm:grid-cols-7 gap-2 bg-[#0b0b0b] border border-[#1f1f1f] rounded-2xl p-2 sm:p-3 shadow-[0_10px_40px_rgba(0,0,0,.4)]">
    
               {/* Hız – kaydırmalı, çentikli kontrol */}
          <div className="px-2 py-2 rounded-xl bg-[#141414] flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-gray-300">Hız</span>
              <span className="font-semibold text-white">
                {speed.toFixed(2).replace(/\.00$/, "")}x
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={speedOptions.length - 1}
              step={1}
              value={currentSpeedIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                const v = speedOptions[idx] ?? 1;
                setSpeed(v);
                applyPlaybackRate(v); // sadece videoyu hızlandırıyor
              }}
              className="w-full accent-purple-400"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>0.25x</span>
              <span>5x</span>
            </div>
          </div>
{/* 🗑️ Sil */}
{hasTimelineSelection && (
<button
  onClick={() => {
    const confirmDelete = window.confirm("Silmek istediğine emin misin?");
    if (!confirmDelete) return;
    // 1️⃣ MÜZİK seçiliyse
    if (selectedTrack === "music" && selectedMusicLayer !== null) {
      setMusicLayers(prev => prev.filter((_, i) => i !== selectedMusicLayer));
      musicAudioRefs.current.splice(selectedMusicLayer, 1);
      setSelectedMusicLayer(null);
      console.log("🗑️ Müzik katmanı silindi");
      return;
    }
    // 2️⃣ VİDEO seçiliyse
    if (selectedTrack === "video" && fileUrl) {
      setFileUrl(null);
      setFrames([]);
      console.log("🗑️ Video silindi");
      return;
    }
    // 3️⃣ SEGMENT seçiliyse (örneğin kesit)
    const t = getPlayheadAbsoluteTime();
    const idx = segments.findIndex(s => t >= s.start && t <= s.end);
    if (idx !== -1) {
      setSegments(prev => prev.filter((_, i) => i !== idx));
      console.log("🗑️ Segment silindi:", idx);
      return;
    }
    // 4️⃣ Hiçbiri seçili değilse
    alert("Silinecek bir öğe seçilmedi veya bulunamadı.");
  }}
  className="px-4 py-2 rounded-xl font-semibold bg-red-600 hover:bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] active:scale-95 transition-all"
>
  🗑️ Sil
</button>
)}
{/* ✂️ Böl (imleçte, video veya müzik) */}
{hasTimelineSelection && (
<button
  onClick={() => {
    const playheadTime = getPlayheadAbsoluteTime();
    if (playheadTime <= 0 || duration <= 0) return;
    // 🔥 Kesilen yeri görsel olarak işaretle (mor çizgi)
    setSplitFlashTime(playheadTime);
    window.setTimeout(() => {
      setSplitFlashTime(null);
    }, 500);
    // 🎬 Video seçiliyse
    if (selectedTrack === "video") {
      setSegments(prev => {
        const next: Segment[] = [];
        let changed = false;
        for (const s of prev) {
          if (playheadTime > s.start && playheadTime < s.end) {
            next.push({ start: s.start, end: playheadTime });
            next.push({ start: playheadTime, end: s.end });
            changed = true;
          } else {
            next.push(s);
          }
        }
        return changed ? next : prev;
      });
      console.log("✂️ Video bölündü:", playheadTime.toFixed(2));
    }
    // 🎵 MÜZİK seçiliyse (aktif time = selectedTrack: 'music')
    if (selectedTrack === "music" && selectedMusicLayer !== null) {
      setMusicSegments(prev => {
        const next: Segment[] = [];
        let changed = false;
        for (const s of prev) {
          if (playheadTime > s.start && playheadTime < s.end) {
            next.push({ start: s.start, end: playheadTime });
            next.push({ start: playheadTime, end: s.end });
            changed = true;
          } else {
            next.push(s);
          }
        }
        // Eğer segment listesi yoksa, tam müzik süresini ikiye böl
        if (!changed && prev.length === 0 && duration > 0) {
          return [
            { start: 0, end: playheadTime },
            { start: playheadTime, end: duration },
          ];
        }
        return changed ? next : prev;
      });
      console.log(
        `🎵 Müzik layer ${selectedMusicLayer + 1} bölündü:`,
        playheadTime.toFixed(2)
      );
    }
  }}
  className="px-4 py-2 rounded-xl bg-[#9333ea] hover:bg-[#a855f7] text-white text-sm transition-all active:scale-95 shadow-[0_0_12px_rgba(147,51,234,0.7)]"
>
  ✂️ Böl
</button>
)}
    {/* 🔇 Ses Kapat */}
{/* 🔊 Ses Düzeyi */}
{selectedTrack === "music" && selectedMusicLayer !== null && (
  <div
 className="flex flex-col items-center gap-2 mt-2">
    <label className="text-sm text-gray-400">Ses Düzeyi</label>
   <input
  type="range"
  min={0}
  max={300}
  step={1}
  value={
    selectedMusicLayer !== null
      ? (musicVolPctMap[selectedMusicLayer] ?? 100)
      : 100
  }
  onChange={(e) => {
    if (selectedMusicLayer === null) return;
    const idx = selectedMusicLayer;
    const pct = Math.max(0, Math.min(300, parseInt(e.target.value, 10) || 0));
    setMusicVolPctMap(prev => ({ ...prev, [idx]: pct }));
    musicLastPctRefs.current[idx] = pct || musicLastPctRefs.current[idx] || 100;
    if (musicGainRefs.current[idx]) {
      musicGainRefs.current[idx]!.gain.value = pct / 100;
    }
    // Kaçak yok
    const el = musicAudioRefs.current[idx];
    if (el) el.muted = pct === 0;
  }}
  className="w-40 accent-green-400"
/>
{selectedMusicLayer !== null && (
  <span className="ml-2 text-xs text-gray-400 font-mono">
    {(musicVolPctMap[selectedMusicLayer] ?? 100)}%
  </span>
)}
  </div>
)}
{hasTimelineSelection && (
<button
  onClick={() => {
    if (selectedTrack === "video" && videoRef.current) {
      // video sessize alma
      videoRef.current.muted = !videoRef.current.muted;
    } else if (selectedTrack === "music") {
      // 🔊 sadece seçilen müzik katmanını sessize al
      if (selectedMusicLayer !== null) {
        const target = musicAudioRefs.current[selectedMusicLayer];
        if (target) target.muted = !target.muted;
      } else {
        // 🔇 hiçbir katman seçili değilse hepsini sessize al
        musicAudioRefs.current.forEach((a) => {
          if (a) a.muted = !a.muted;
        });
      }
    }
  }}
  className="px-4 py-2 rounded-xl font-semibold bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_12px_rgba(234,179,8,0.8)] active:scale-95 transition-all"
>
  🔇{" "}
  {selectedTrack === "video"
    ? videoRef.current?.muted
      ? "Sesi Aç (Video)"
      : "Sesi Kapat (Video)"
    : selectedMusicLayer !== null &&
      musicAudioRefs.current[selectedMusicLayer]?.muted
    ? "Sesi Aç (Müzik)"
    : "Sesi Kapat (Müzik)"}
</button>
)}
{/* 🎚️ Video Ses Düzeyi */}
{selectedTrack === "video" && (
  <div className="flex flex-col items-center gap-1 mt-2">
    <label className="text-xs text-gray-400">Ses Düzeyi (Video)</label>
<input
  type="range"
  min={0}
  max={300}
  step={1}
  value={videoVolPct}
  onChange={(e) => {
    const pct = Math.max(0, Math.min(300, parseInt(e.target.value, 10) || 0));
    setVideoVolPct(pct);
    videoLastPctRef.current = pct || videoLastPctRef.current; // 0 değilse hatırla
    // Gain: 0..3.0
    if (videoGainRef.current) videoGainRef.current.gain.value = pct / 100;
    // Kaçak yok: HTML volume 1, mute sinyali tutarlı olsun
    if (videoRef.current) videoRef.current.muted = pct === 0;
  }}
  className="w-40 accent-green-400"
/>
<span className="ml-2 text-xs text-gray-400 font-mono">{videoVolPct}%</span>
  </div>
)}
    {selectedTrack === "video" && (
      <>
        {/* 🎨 Filtre */}
        <button
          onClick={() => setShowFilters(true)}
          className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 shadow-[0_0_14px_rgba(59,130,246,.9)] active:scale-95 transition-all"
        >
          🎨 Filtre
        </button>
      </>
    )}
  </div>
</footer>
      {/* Filter Panel (modal) */}
      {showFilters && (
        <div className="fixed left-0 right-0 bottom-[120px] z-[10000] flex justify-center pointer-events-none">
          {/* Sadece panel tıklanabilir olsun */}
          <div className="pointer-events-auto w-full max-w-[880px] mx-3 rounded-3xl bg-[#050308] border border-[#2a1542] shadow-[0_0_40px_rgba(168,85,247,0.45)] p-4 sm:p-5">
            {/* Başlık */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="font-bold text-base sm:text-lg">
                  <span className="text-[#a855f7]">Filtreler</span>
                  <span className="text-gray-300"> — Canlı Önizleme</span>
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                  Aşağıdan bir görünüm seç; önizleme hemen güncellenir, dışa aktarımda da aynı filtre kullanılır.
                </p>
              </div>
              <button
                onClick={() => setShowFilters(false)}
                className="px-3 py-1.5 rounded-2xl bg-[#141414] hover:bg-[#1f1f1f] text-xs sm:text-sm text-gray-200 border border-white/10 shadow-[0_0_18px_rgba(0,0,0,0.7)] transition-all active:scale-95"
              >
                ✕ Kapat
              </button>
            </div>
            {/* CapCut tarzı: yana kaydırmalı filtre kartları */}
            <div className="flex gap-3 overflow-x-auto pb-1 pt-1">
              {filterPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`group flex-shrink-0 w-[120px] sm:w-[150px] flex flex-col gap-2 rounded-2xl border px-2.5 py-2.5 text-left transition-all ${
                    preset === p.id
                      ? "border-[#a855f7] bg-[#100717] shadow-[0_0_25px_rgba(168,85,247,0.55)] scale-[1.03]"
                      : "border-white/5 bg-[#050308] hover:border-[#a855f7]/70 hover:bg-[#0b0612]"
                  }`}
                >
                  {/* Küçük canlı önizleme kutusu – her filtre kendi rengini gösteriyor */}
                  <div
                    className="w-full aspect-[9/16] rounded-xl overflow-hidden bg-gradient-to-tr from-[#1a1030] via-[#050308] to-[#22c55e] border border-white/10 shadow-inner"
                    style={{ filter: cssFilterForPreset(p.id) }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-col">
                      <span className="text-[11px] sm:text-[12px] font-semibold text-gray-100">
                        {p.label}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {p.badge}
                      </span>
                    </div>
                    {preset === p.id && (
                      <span className="text-[11px] text-[#a855f7] font-semibold">
                        Seçili
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {/* Alt bilgi */}
            <div className="mt-3 flex items-center justify-between text-[10px] sm:text-[11px] text-gray-400">
              <span>🎬 Filtreler sadece video katmanına uygulanır.</span>
              <span className="hidden sm:inline">
                Efekti istediğin zaman değiştirebilirsin, timeline bozulmaz.
              </span>
            </div>
          </div>
        </div>
      )}
{contextMenu && (
  <div
    className="fixed bg-gray-800 border border-gray-600 rounded-lg p-3 flex flex-col gap-2 z-[9999] shadow-lg"
    style={{
      top: `${contextMenu.y}px`,
      left: `${contextMenu.x}px`,
      transform: "translate(-50%, 10px)",
    }}
  >
    <button
      className="text-red-400 hover:text-red-300 font-semibold"
      onClick={() => {
        const idxFromMenu = contextMenu?.index ?? null;
        setContextMenu(null);
        // 1️⃣ Öncelik: seçili segment varsa onu sil (video veya müzik)
        if (selectedSegmentIndex !== null && selectedSegmentType) {
          if (selectedSegmentType === "video") {
            setSegments((prev) =>
              prev.filter((_, idx) => idx !== selectedSegmentIndex)
            );
          } else if (selectedSegmentType === "music") {
            setMusicSegments((prev) =>
              prev.filter((_, idx) => idx !== selectedSegmentIndex)
            );
          }
          setSelectedSegmentIndex(null);
          setSelectedSegmentType(null);
          return;
        }
        // 2️⃣ Hiç seçim yoksa eski davranış: video tarafında context index
        if (idxFromMenu !== null) {
          setSegments((prev) => prev.filter((_, idx) => idx !== idxFromMenu));
        }
      }}
    >
      🗑️ Sil
    </button>
        <button
      className="text-yellow-400 hover:text-yellow-300 font-semibold"
      onClick={() => {
        if (audioRef.current) {
          audioRef.current.muted = !audioRef.current.muted;
        }
        setContextMenu(null);
      }}
    >
      🔇 Ses {audioRef.current?.muted ? "Aç" : "Kapat"}
    </button>

  </div>
)}
{showMenu && (
  <div
    className="fixed inset-0 flex items-end justify-center z-[9999999999]"
    onClick={() => setShowMenu(false)} // dışarı tıklayınca kapanır
  >
    <div
      className="mb-[40px] bg-gray-900/95 border border-gray-700 rounded-xl p-4 w-[220px]
                 shadow-[0_0_25px_rgba(255,255,255,0.25)] flex flex-col gap-3 items-center animate-slideUp"
      onClick={(e) => e.stopPropagation()} // menüye tıklayınca kapanmasın
    >
      <button
        className="w-full text-red-400 hover:text-red-300 font-semibold text-center py-2 bg-red-500/10 rounded-lg border border-red-400/30 hover:bg-red-500/20 transition-all"
        onClick={() => {
          const t = getPlayheadAbsoluteTime();
          const idx = segments.findIndex(s => t >= s.start && t <= s.end);
          if (idx !== -1) {
            setSegments(prev => prev.filter((_, i) => i !== idx));
          }
          setShowMenu(false);
        }}
      >
        🗑️ Sil
      </button>
      <button
        className="w-full text-yellow-400 hover:text-yellow-300 font-semibold text-center py-2 bg-yellow-500/10 rounded-lg border border-yellow-400/30 hover:bg-yellow-500/20 transition-all"
        onClick={() => {
          if (audioRef.current) audioRef.current.muted = !audioRef.current.muted;
          setShowMenu(false);
        }}
      >
        🔇 Ses {audioRef.current?.muted ? "Aç" : "Kapat"}
      </button>
      <button
        className="mt-1 text-gray-400 hover:text-white text-sm text-right"
        onClick={() => setShowMenu(false)}
      >
        ✖ Kapat
      </button>
    </div>
  </div>
)}
  </main>
);
}
