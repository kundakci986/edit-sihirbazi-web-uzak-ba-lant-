'use client'
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TemplateId = "reels-fast" | "slideshow-beat";
type MediaFile = { file: File; url: string; type: string };

const TEMPLATES: { id: TemplateId; title: string; desc: string }[] = [
  { id: "reels-fast", title: "Reels Hızlı Başlangıç", desc: "0.5 sn intro hissi, 9:16, 1080p." },
  { id: "slideshow-beat", title: "Slayt (Foto → Beat)", desc: "Fotoğrafları 1–1.5 sn aralıkla dizer; müzik ofset." },
];

export default function TemplateWizard() {
  const router = useRouter();

  const [tpl, setTpl] = useState<TemplateId>("reels-fast");
  const [mainMedia, setMainMedia] = useState<MediaFile | null>(null);
  const [extras, setExtras] = useState<MediaFile[]>([]);
  const [music, setMusic] = useState<MediaFile | null>(null);

  const planSummary = useMemo(() => {
    switch (tpl) {
      case "reels-fast":
        return [
          "• 0.00s: Ana medya başlar",
          "• 0.00–0.50s: Kısa intro hissi",
          "• Dikey 9:16, 1080p",
        ].join("\n");
      case "slideshow-beat":
        return [
          "• Fotoğraflar 1–1.5s aralıklarla",
          "• Müzik 0–2s ofsetle girer",
          "• Dikey 9:16, 1080p",
        ].join("\n");
    }
  }, [tpl]);

  const onPickMain = (f?: File) => {
    if (!f) return;
    setMainMedia({ file: f, url: URL.createObjectURL(f), type: f.type });
  };
  const onPickExtras = (fl?: FileList | null) => {
    if (!fl?.length) return;
    const arr: MediaFile[] = [];
    for (const f of Array.from(fl)) arr.push({ file: f, url: URL.createObjectURL(f), type: f.type });
    setExtras((p) => [...p, ...arr]);
  };
  const onPickMusic = (f?: File) => {
    if (!f) return;
    setMusic({ file: f, url: URL.createObjectURL(f), type: f.type });
  };

  const applyTemplateAndOpen = () => {
    if (!mainMedia) {
      alert("Ana video veya görsel seç.");
      return;
    }
    // 1) Ana medya
    sessionStorage.setItem("selectedFileUrl", mainMedia.url);
    sessionStorage.setItem("selectedFileType", mainMedia.type);
    // 2) Ekler
    if (extras.length) {
      sessionStorage.setItem("appendVideos", JSON.stringify(extras.map((m) => m.url)));
    } else {
      sessionStorage.removeItem("appendVideos");
    }
    // 3) Müzik
    if (music?.url) sessionStorage.setItem("selectedMusicUrl", music.url);
    else sessionStorage.removeItem("selectedMusicUrl");

    // 4) Şablon ipucu
    switch (tpl) {
      case "reels-fast":
        sessionStorage.setItem("tpl_hint", JSON.stringify({ kind: tpl, introCutMs: 500, zoom: 1.0 }));
        break;
      case "slideshow-beat":
        sessionStorage.setItem("tpl_hint", JSON.stringify({ kind: tpl, photoDur: 1.2, musicOffset: 1.0, zoom: 1.1 }));
        break;
    }

    // 5) KENDİ önizleme sayfamıza gidelim:
    router.push("/sablon/oynat");
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-5xl p-6">
        <header className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-bold text-purple-400">✨ Şablon Sihirbazı</h1>
          <span className="text-xs text-gray-400">Önizleme için kendi sayfasına geçecek</span>
        </header>

        {/* Şablon seçimi */}
        <section className="grid sm:grid-cols-2 gap-4 mb-8">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTpl(t.id)}
              className={`text-left rounded-2xl border p-4 transition ${
                tpl === t.id ? "border-teal-400 bg-teal-950/40" : "border-gray-700 hover:border-gray-500"
              }`}
            >
              <div className="font-semibold">{t.title}</div>
              <div className="text-xs text-gray-400 mt-1 whitespace-pre-line">{t.desc}</div>
            </button>
          ))}
        </section>

        {/* Medya seçimleri */}
        <section className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="rounded-xl border border-gray-700 p-4">
            <div className="font-semibold mb-2">Ana Medya (video/görsel)</div>
            <input type="file" accept="video/*,image/*" onChange={(e) => onPickMain(e.target.files?.[0])} />
            {mainMedia && <p className="text-xs text-gray-400 mt-2 break-words">{mainMedia.file.name}</p>}
          </div>
          <div className="rounded-xl border border-gray-700 p-4">
            <div className="font-semibold mb-2">Ek Medyalar (opsiyonel)</div>
            <input type="file" accept="video/*,image/*" multiple onChange={(e) => onPickExtras(e.target.files)} />
            {extras.length > 0 && <p className="text-xs text-gray-400 mt-2">{extras.length} dosya eklendi</p>}
          </div>
          <div className="rounded-xl border border-gray-700 p-4">
            <div className="font-semibold mb-2">Müzik (opsiyonel)</div>
            <input type="file" accept="audio/*" onChange={(e) => onPickMusic(e.target.files?.[0])} />
            {music && <p className="text-xs text-gray-400 mt-2 break-words">{music.file.name}</p>}
          </div>
        </section>

        {/* Plan özeti */}
        <section className="rounded-2xl border border-gray-700 p-4 mb-6">
          <div className="font-semibold mb-2">Şablon Planı</div>
          <pre className="text-xs whitespace-pre-wrap text-gray-300">{planSummary}</pre>
        </section>

        {/* Uygula */}
        <div className="flex justify-end">
          <button
            onClick={applyTemplateAndOpen}
            className="px-5 py-2 rounded bg-teal-600 hover:bg-teal-700"
          >
            🚀 Şablonu Uygula ve Önizle
          </button>
        </div>
      </div>
    </main>
  );
}
