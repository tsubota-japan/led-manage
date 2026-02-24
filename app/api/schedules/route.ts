import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const schedules = await prisma.schedule.findMany({
    orderBy: { startTime: "asc" },
    include: { group: { select: { id: true, name: true } } },
  });
  return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
  const { groupId, startTime, endTime, repeat, priority } = await req.json();

  if (!groupId || !startTime) {
    return NextResponse.json(
      { error: "groupId and startTime are required" },
      { status: 400 }
    );
  }

  const schedule = await prisma.schedule.create({
    data: {
      groupId,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      repeat: repeat ?? "none",
      priority: priority ?? 0,
      active: true,
    },
    include: { group: { select: { id: true, name: true } } },
  });

  return NextResponse.json(schedule);
}
