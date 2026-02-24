import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { groupId, startTime, endTime, repeat, priority, active } = await req.json();

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      ...(groupId !== undefined && { groupId }),
      ...(startTime !== undefined && { startTime: new Date(startTime) }),
      ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      ...(repeat !== undefined && { repeat }),
      ...(priority !== undefined && { priority }),
      ...(active !== undefined && { active }),
    },
    include: { group: { select: { id: true, name: true } } },
  });

  return NextResponse.json(schedule);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.schedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
