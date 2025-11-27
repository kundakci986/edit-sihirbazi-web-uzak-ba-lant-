import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'


let ffmpeg: any = null


export async function getFFmpeg() {
if (!ffmpeg) {
ffmpeg = createFFmpeg({ log: false })
await ffmpeg.load()
}
return ffmpeg
}


export { fetchFile }