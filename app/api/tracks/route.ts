// app/api/tracks/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "tracks");
    if (!fs.existsSync(dir)) return NextResponse.json({ items: [] });
    const items = fs.readdirSync(dir)
      .filter(n => /\.mp3$/i.test(n))
      .map(name => {
        const low = name.toLowerCase();
        const m = low.match(/(\d{2,3})\s*bpm|[-_ ](\d{2,3})/);
        const bpm = m ? Number(m[1] || m[2]) : undefined;
        const keywords = low.replace(/\.mp3$/, "").split(/[_\-\s]+/).filter(Boolean);
        return { url: `/tracks/${name}`, name, bpm, keywords };
      });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
