/**
 * POST /api/events
 * Receives CoordinationEvents from agent processes and:
 *   1. Persists them to the in-memory task store
 *   2. Publishes them to the SSE bus so live connections update instantly
 */
import { NextResponse } from "next/server";
import { CoordinationEventSchema } from "@/lib/types";
import bus from "@/lib/events/bus";
import { appendEvent, updateTaskFromEvent } from "@/lib/store/tasks";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CoordinationEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_event", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const event = parsed.data;
  appendEvent(event);
  updateTaskFromEvent(event);
  bus.publish(event);

  return NextResponse.json({ ok: true }, { status: 201 });
}
