import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      groupFiles: {
        orderBy: { order: "asc" },
        include: { file: true },
      },
    },
  });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(group);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name } = await req.json();
  const group = await prisma.group.update({
    where: { id },
    data: { name },
  });
  return NextResponse.json(group);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
