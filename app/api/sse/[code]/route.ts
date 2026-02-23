import { NextRequest } from "next/server";
import { registerClient, unregisterClient } from "@/lib/sse-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const stream = new ReadableStream({
    start(controller) {
      registerClient(code, controller);

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(": keep-alive\n\n");
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      (controller as unknown as { _cleanup: () => void })._cleanup = () => {
        clearInterval(keepAlive);
        unregisterClient(code);
      };
    },
    cancel() {
      unregisterClient(code);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
