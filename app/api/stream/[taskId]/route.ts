/**
 * GET /api/stream/:taskId
 * Server-Sent Events stream. Replays existing task events on connect,
 * then pushes new events in real time via the in-process event bus.
 */
import { sseHeaders, sseData, sseComment } from "@/lib/events/sse";
import bus from "@/lib/events/bus";
import { getTask } from "@/lib/store/tasks";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;

  const encoder = new TextEncoder();
  let unsub: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          /* client disconnected */
        }
      };

      /* Replay existing events so the client catches up immediately */
      const record = getTask(taskId);
      if (record) {
        for (const event of record.events) {
          enqueue(sseData(event));
        }
      }

      /* Keep-alive ping every 15 s */
      const ping = setInterval(
        () => enqueue(sseComment("ping")),
        15_000
      );

      /* Subscribe to new events */
      unsub = bus.subscribe(taskId, (event) => {
        enqueue(sseData(event));
      });

      /* Clean up on close */
      _request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsub?.();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      unsub?.();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
