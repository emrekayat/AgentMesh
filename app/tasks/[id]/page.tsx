import { notFound } from "next/navigation";
import { getTask } from "@/lib/store/tasks";
import { TaskDetailClient } from "./task-detail-client";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = getTask(id);
  if (!record) notFound();

  return (
    <TaskDetailClient
      task={record.task}
      events={record.events}
      execution={record.execution}
    />
  );
}
