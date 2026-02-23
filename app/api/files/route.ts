import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".m4v": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export async function GET() {
  const files = await prisma.file.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
}

/**
 * 表示名の重複を確認し、重複があれば "(2)", "(3)"... と連番を付与して返す。
 * 例: "photo.jpg" が存在 → "photo (2).jpg"、それも存在 → "photo (3).jpg"
 */
async function resolveDisplayName(name: string): Promise<string> {
  const existing = await prisma.file.findFirst({ where: { name } });
  if (!existing) return name;

  const dotIndex = name.lastIndexOf(".");
  const basename = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";

  let n = 2;
  while (true) {
    const candidate = `${basename} (${n})${ext}`;
    const conflict = await prisma.file.findFirst({ where: { name: candidate } });
    if (!conflict) return candidate;
    n++;
  }
}

export async function POST(req: NextRequest) {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `ファイルサイズは100MB以内にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)} MB）` },
        { status: 413 }
      );
    }

    const ext = path.extname(file.name);
    const filename = `${nanoid()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // カスタム名があればそれを使用、なければ元のファイル名
    const customName = (formData.get("name") as string | null)?.trim();
    const rawName = customName || file.name;

    // 重複があれば連番を付与
    const displayName = await resolveDisplayName(rawName);

    const record = await prisma.file.create({
      data: {
        name: displayName,
        path: `/uploads/${filename}`,
        mimeType: file.type || MIME_BY_EXT[ext.toLowerCase()] || "application/octet-stream",
        size: file.size,
      },
    });

    return NextResponse.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
