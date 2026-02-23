import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isConnected } from "@/lib/sse-manager";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

export async function GET() {
  const displays = await prisma.display.findMany({
    orderBy: { createdAt: "desc" },
  });

  const withStatus = displays.map((d) => ({
    ...d,
    online: isConnected(d.code),
  }));

  return NextResponse.json(withStatus);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let code: string;
  let attempts = 0;
  do {
    code = nanoid();
    attempts++;
    if (attempts > 10) {
      return NextResponse.json(
        { error: "Failed to generate unique code" },
        { status: 500 }
      );
    }
  } while (await prisma.display.findUnique({ where: { code } }));

  const display = await prisma.display.create({ data: { name, code } });
  return NextResponse.json(display);
}
