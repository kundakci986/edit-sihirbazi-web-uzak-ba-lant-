import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Bu API: video yüklenir → Python ile analiz → AI velocity plan döner
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("video") as File;

    if (!file) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    // Geçici video dosyası
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "ai-vid-")
    );
    const videoPath = path.join(tempDir, "input.mp4");

    // Videoyu geçici klasöre yaz
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(videoPath, buf);

    // Python script yolu
    const scriptPath = path.join(process.cwd(), "scripts", "ai_analyze.py");

    // FFmpeg ve FFprobe ortam değişkenleri
    process.env.FFMPEG_BIN =
      process.env.FFMPEG_BIN ||
      "C:\\Users\\ALPER\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-full_build\\bin\\ffmpeg.exe";
    process.env.FFPROBE_BIN =
      process.env.FFPROBE_BIN ||
      "C:\\Users\\ALPER\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-full_build\\bin\\ffprobe.exe";

    // ---------------- PYTHON ANALİZ BAŞLIYOR ----------------
    const py = spawn("python", [scriptPath, videoPath], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      windowsHide: true,
    });

    let out = "";
    let err = "";

    py.stdout.on("data", (d) => (out += d.toString()));
    py.stderr.on("data", (d) => (err += d.toString()));

    const result = await new Promise((resolve, reject) => {
      py.on("close", (code) => {
        if (code !== 0) {
          reject(new Error("python_failed: " + err));
        } else {
          resolve(out);
        }
      });
    });

    let plan = {};
    try {
      plan = JSON.parse(result as string);
    } catch {
      return NextResponse.json(
        { error: "json_parse_failed", detail: result },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      plan,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "analyze_failed",
        detail: e.toString(),
      },
      { status: 500 }
    );
  }
}
