import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const trimmed = name.trim();
  // 同じ名前なら変更なし
  if (trimmed === file.name) {
    return NextResponse.json(file);
  }

  // 重複チェック・連番付与
  const dotIndex = trimmed.lastIndexOf(".");
  const basename = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const ext = dotIndex > 0 ? trimmed.slice(dotIndex) : "";

  let candidate = trimmed;
  let n = 2;
  while (true) {
    const conflict = await prisma.file.findFirst({
      where: { name: candidate, NOT: { id } },
    });
    if (!conflict) break;
    candidate = `${basename} (${n})${ext}`;
    n++;
  }

  const updated = await prisma.file.update({
    where: { id },
    data: { name: candidate },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", file.path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await prisma.file.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
