"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link";


export default function Home() {
  const router = useRouter()
  const [mediaSelected, setMediaSelected] = useState(false)
  const [fileName, setFileName] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)
  const [currentVideo, setCurrentVideo] = useState(0)

  // 🎥 İlk açılışta galaxy-bg.mp4 oynasın
  const videos = [
    "/galaxy-bg.mp4",
    "/galaxy-bg1.mp4",
    "/galaxy-bg2.mp4",
    "/galaxy-bg3.mp4",
    "/galaxy-bg4.mp4",
    "/galaxy-bg5.mp4",
  ]

  const handleSelectMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    sessionStorage.setItem("selectedFileUrl", url)
    sessionStorage.setItem("selectedFileType", f.type)
    setFileName(f.name)
    setPreviewUrl(url)
    setFileType(f.type)
    setMediaSelected(true)
  }

  const goToEditor = () => router.push("/editor")

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVideo((prev) => (prev + 1) % videos.length)
    }, 28000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center text-center text-white">

      {/* 🎥 Arka Plan Videosu */}
      <video
        key={currentVideo}
        className="absolute inset-0 w-full h-full object-cover brightness-[0.45] saturate-[1.4] transition-opacity duration-1000"
        src={videos[currentVideo]}
        autoPlay
        loop={false}
        muted
        playsInline
        onEnded={() =>
          setCurrentVideo((prev) => (prev + 1) % videos.length)
        }
      />

      {/* 💫 Aurora katmanı */}
      <div className="absolute inset-0 pointer-events-none mix-blend-screen opacity-60">
        <div className="aurora"></div>
      </div>

      {/* 📌 İçerik */}
      <div className="relative z-50 flex flex-col items-center gap-5 px-4 backdrop-blur-[2px]">
        <h1 className="text-[64px] sm:text-[80px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] via-[#ec4899] to-[#3b82f6]
drop-shadow-[0_0_40px_rgba(168,85,247,.8)] tracking-wider animate-titleGlow mt-[-60px]">
  ✨ Edit Sihirbazı ✨
</h1>

        <p
  className="relative text-lg sm:text-xl font-semibold text-transparent bg-clip-text 
             bg-gradient-to-r from-[#60a5fa] via-[#a855f7] to-[#ec4899] 
             animate-gradientFlow tracking-wide drop-shadow-[0_0_15px_rgba(147,51,234,0.6)] mt-2"
>
  Video veya görsel seç ve düzenlemeye başla <span className="inline-block animate-bounce">🚀</span>
</p>

      <label
  className="relative cursor-pointer px-16 py-6 text-3xl font-extrabold rounded-3xl overflow-hidden transition-all
             text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#ec4899]
             shadow-[0_0_45px_rgba(168,85,247,0.9)] animate-gradientFlow animate-glowPulse
             border-4 border-[#a855f7]/80 hover:border-[#ec4899] active:scale-95 mt-16"
>
  📁 Medya Seç
  <input
    type="file"
    accept="video/*,image/*"
    className="hidden"
    onChange={handleSelectMedia}
  />
</label>

        {fileName && (
          <p className="text-emerald-400 font-semibold text-sm">✅ {fileName}</p>
        )}

        {previewUrl && (
          <div className="mt-4 scale-75 hover:scale-90 rounded-2xl overflow-hidden border border-[#333] shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:shadow-[0_0_45px_rgba(168,85,247,0.9)] transition-all duration-700 max-w-[160px]">
            {fileType?.startsWith("video") ? (
              <video src={previewUrl} controls className="w-full h-auto object-cover" />
            ) : (
              <img src={previewUrl} alt="Önizleme" className="w-full h-auto object-cover" />
            )}
          </div>
        )}

     <button
  onClick={goToEditor}
  disabled={!mediaSelected}
  className={`mt-32 relative px-10 py-4 text-4xl font-extrabold rounded-2xl overflow-hidden transition-all duration-300
              text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#ec4899]
              shadow-[0_0_45px_rgba(168,85,247,0.9)] animate-gradientFlow animate-glowPulse
              border-2 border-[#a855f7]/80 hover:border-[#ec4899]
              transform scale-[1.3] hover:scale-[1.5] active:scale-95
              ${!mediaSelected ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
  ✨ Düzenlemeye Başla ✨
</button>


<Link
  href="/sablon"
  className="mt-16 relative inline-block px-10 py-4 text-4xl font-extrabold rounded-2xl overflow-hidden
             transition-all duration-300
             text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#ec4899]
             shadow-[0_0_45px_rgba(168,85,247,0.55)] animate-gradientFlow
             border-2 border-[#a855f7]/80 hover:border-[#ec4899]
             transform scale-[1.3] hover:scale-[1.5] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#a855f7]/60"
>
  ✨ Şablon Sihirbazı ✨
</Link>


      </div>

    {/* 🌠 Aurora animasyonu */}
<style jsx global>{`
  .aurora {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 20% 20%, rgba(255,0,200,0.25), transparent 70%),
                radial-gradient(circle at 80% 60%, rgba(0,255,255,0.25), transparent 70%),
                radial-gradient(circle at 40% 80%, rgba(150,0,255,0.25), transparent 70%);
    filter: blur(120px);
    animation: auroraMove 14s ease-in-out infinite alternate;
  }

@keyframes gradientFlow {
  0% { background-position: 0% 50%; filter: brightness(1.3); }
  50% { background-position: 100% 50%; filter: brightness(1.7); }
  100% { background-position: 0% 50%; filter: brightness(1.3); }
}
.animate-gradientFlow {
  background-size: 250% 250%;
  animation: gradientFlow 3s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% {
    filter: drop-shadow(0 0 20px rgba(168,85,247,0.9))
            drop-shadow(0 0 40px rgba(236,72,153,0.7));
  }
  50% {
    filter: drop-shadow(0 0 50px rgba(192,132,252,1))
            drop-shadow(0 0 90px rgba(236,72,153,1));
  }
}
.animate-glowPulse {
  animation: glowPulse 2.3s ease-in-out infinite;
}

@keyframes auroraMove {
  0% { background-position: 0% 0%, 100% 100%, 50% 50%; }
  50% { background-position: 80% 30%, 20% 70%, 60% 40%; }
  100% { background-position: 0% 100%, 100% 0%, 50% 80%; }
}

@keyframes titleGlow {
  0%, 100% { filter: drop-shadow(0 0 15px rgba(236,72,153,0.8)); }
  50% { filter: drop-shadow(0 0 35px rgba(168,85,247,1)); }
}
.animate-titleGlow {
  animation: titleGlow 3s ease-in-out infinite;
}
`}</style> 

    </main>
  )
}
