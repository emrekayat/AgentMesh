import { NextResponse } from "next/server";
import { getTask } from "@/lib/store/tasks";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const record = getTask(id);
  if (!record) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    task: record.task,
    events: record.events,
    execution: record.execution,
  });
}
