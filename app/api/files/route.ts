import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MIME_BY_EXT, resolveDisplayName } from "@/lib/upload-utils";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function GET() {
  const files = await prisma.file.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
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

    const MAX_SIZE = 500 * 1024 * 1024; // 500MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `ファイルサイズは500MB以内にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)} MB）` },
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
