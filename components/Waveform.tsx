'use client';

type WaveformProps = {
  audioUrl: string;
};

export default function Waveform({ audioUrl }: WaveformProps) {
  // Şimdilik gerçek waveform hesabı yok, sadece placeholder.
  const hasAudio = !!audioUrl;

  return (
    <div className="w-full h-10 flex items-center justify-center text-[10px] text-gray-500 bg-black/40 border border-gray-800 rounded">
      Waveform bileşeni şu an devre dışı.
      {hasAudio && <span className="ml-1 text-gray-600">(ses yüklü)</span>}
    </div>
  );
}
