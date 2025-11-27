export async function getWaveform(url: string, bars = 128) {
const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
const res = await fetch(url)
const buf = await res.arrayBuffer()
const audio = await ctx.decodeAudioData(buf)
const data = audio.getChannelData(0)
const step = Math.floor(data.length / bars)
const peaks: number[] = []
for (let i = 0; i < bars; i++) {
let sum = 0
for (let j = 0; j < step; j++) sum += Math.abs(data[i * step + j] || 0)
peaks.push(sum / step)
}
const max = Math.max(...peaks) || 1
return peaks.map(p => p / max)
}