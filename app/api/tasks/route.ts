import { NextResponse } from "next/server";
import { TaskCreateInputSchema } from "@/lib/types";
import { createTask, listTasks } from "@/lib/store/tasks";
import { runTaskPipeline } from "@/lib/orchestrator/pipeline";

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = TaskCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const task = createTask(parsed.data);

  /* Fire-and-forget — response returns immediately, pipeline runs async */
  runTaskPipeline(task.id).catch((err) =>
    console.error("[pipeline] unhandled error:", err)
  );

  return NextResponse.json({ task }, { status: 201 });
}
