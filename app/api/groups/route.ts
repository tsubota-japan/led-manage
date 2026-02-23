import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const groups = await prisma.group.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { groupFiles: true } },
    },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const group = await prisma.group.create({ data: { name } });
  return NextResponse.json(group);
}
