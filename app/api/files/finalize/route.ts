import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MIME_BY_EXT, resolveDisplayName } from "@/lib/upload-utils";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { uploadId, fileName, displayName: rawDisplayName, mimeType, totalChunks, totalSize } =
    await req.json();

  if (!uploadId || !fileName || !totalChunks || !totalSize) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // uploadId はランダムUUID形式のみ許可（パストラバーサル対策）
  if (!/^[a-f0-9-]{36}$/.test(uploadId)) {
    return NextResponse.json({ error: "Invalid uploadId" }, { status: 400 });
  }

  const tmpDir = path.join(process.cwd(), "tmp", "uploads");
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(fileName);
  const filename = `${nanoid()}${ext}`;
  const filepath = path.join(uploadDir, filename);

  try {
    // チャンクを順番に結合してファイルを書き出す
    const writeStream = fs.createWriteStream(filepath);
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tmpDir, `${uploadId}_${i}`);
      if (!fs.existsSync(chunkPath)) {
        writeStream.destroy();
        fs.rmSync(filepath, { force: true });
        return NextResponse.json({ error: `チャンク ${i} が見つかりません` }, { status: 400 });
      }
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
      fs.unlinkSync(chunkPath);
    }
    await new Promise<void>((resolve, reject) => {
      writeStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });

    const rawName = rawDisplayName?.trim() || fileName;
    const displayName = await resolveDisplayName(rawName);

    const record = await prisma.file.create({
      data: {
        name: displayName,
        path: `/uploads/${filename}`,
        mimeType: mimeType || MIME_BY_EXT[ext.toLowerCase()] || "application/octet-stream",
        size: totalSize,
      },
    });

    return NextResponse.json(record);
  } catch (err) {
    // エラー時は不完全なファイルを削除
    fs.rmSync(filepath, { force: true });
    const message = err instanceof Error ? err.message : "Finalize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
