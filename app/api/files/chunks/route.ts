import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const tmpDir = path.join(process.cwd(), "tmp", "uploads");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  try {
    const formData = await req.formData();
    const chunk = formData.get("chunk") as File | null;
    const uploadId = formData.get("uploadId") as string | null;
    const chunkIndex = formData.get("chunkIndex") as string | null;

    if (!chunk || !uploadId || chunkIndex === null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // uploadId はランダムUUID形式のみ許可（パストラバーサル対策）
    if (!/^[a-f0-9-]{36}$/.test(uploadId)) {
      return NextResponse.json({ error: "Invalid uploadId" }, { status: 400 });
    }

    const chunkPath = path.join(tmpDir, `${uploadId}_${parseInt(chunkIndex)}`);
    const buffer = Buffer.from(await chunk.arrayBuffer());
    fs.writeFileSync(chunkPath, buffer);

    return NextResponse.json({ success: true, chunkIndex: parseInt(chunkIndex) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chunk upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
