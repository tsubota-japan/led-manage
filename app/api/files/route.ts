import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      },
    });

    return NextResponse.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
