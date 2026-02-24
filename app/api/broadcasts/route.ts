import { NextRequest, NextResponse } from "next/server";
import { broadcastToAll } from "@/lib/sse-manager";

export async function POST(req: NextRequest) {
  const { groupId, priority } = await req.json();

  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  broadcastToAll(groupId, priority ?? 0);
  return NextResponse.json({ success: true });
}
