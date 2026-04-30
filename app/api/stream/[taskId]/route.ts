import { BACKEND_URL } from "@/lib/backend";

export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;

  const upstream = await fetch(`${BACKEND_URL}/stream/${taskId}`, {
    headers: { Accept: "text/event-stream" },
    signal: request.signal,
  });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
