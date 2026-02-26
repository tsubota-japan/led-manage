import { NextRequest, NextResponse } from "next/server";
import { broadcastToAll, getConnectedCount, resetAllClientPriorities } from "@/lib/sse-manager";
import { prisma } from "@/lib/prisma";

/** 接続中ディスプレイ数を返す */
export async function GET() {
  return NextResponse.json({ connectedCount: getConnectedCount() });
}

/** 全ディスプレイに即時配信 */
export async function POST(req: NextRequest) {
  const { groupId, priority } = await req.json();

  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  const connectedCount = getConnectedCount();
  const sent = broadcastToAll(groupId, priority ?? 0);

  // 常時配信スケジュールとして保存（サーバー再起動時にこのグループを復元するため）
  await prisma.schedule.deleteMany({ where: { groupId, repeat: "always" } });
  await prisma.schedule.create({
    data: {
      groupId,
      startTime: new Date(),
      endTime: null,
      repeat: "always",
      priority: priority ?? 0,
      active: true,
    },
  });

  return NextResponse.json({ success: true, sent, connectedCount });
}

/** 全ディスプレイの優先度をリセット（高優先度ブロック解除） */
export async function DELETE() {
  resetAllClientPriorities();
  return NextResponse.json({ success: true });
}
