import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { items } = (await req.json()) as {
    items: { fileId: string; duration?: number | null }[];
  };

  await prisma.groupFile.deleteMany({ where: { groupId: id } });

  const created = await prisma.$transaction(
    items.map((item, index) =>
      prisma.groupFile.create({
        data: {
          groupId: id,
          fileId: item.fileId,
          order: index,
          duration: item.duration ?? null,
        },
        include: { file: true },
      })
    )
  );

  return NextResponse.json(created);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { fileId, duration } = await req.json();

  const last = await prisma.groupFile.findFirst({
    where: { groupId: id },
    orderBy: { order: "desc" },
  });
  const order = last ? last.order + 1 : 0;

  const groupFile = await prisma.groupFile.create({
    data: {
      groupId: id,
      fileId,
      order,
      duration: duration ?? null,
    },
    include: { file: true },
  });

  return NextResponse.json(groupFile);
}
