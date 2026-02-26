import { NextRequest } from "next/server";
import { registerClient, unregisterClient } from "@/lib/sse-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      registerClient(code, controller);

      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
        }
      }, 5000);
    },
    cancel() {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      unregisterClient(code);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
