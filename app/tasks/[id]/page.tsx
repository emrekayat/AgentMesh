"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TaskDetailClient } from "./task-detail-client";
import type { Task, CoordinationEvent, ExecutionResult } from "@/lib/types";

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<CoordinationEvent[]>([]);
  const [execution, setExecution] = useState<ExecutionResult | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Initial fetch
    fetch(`/api/tasks/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.task) {
          setTask(d.task);
          setEvents(d.events ?? []);
          setExecution(d.execution);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Poll for updates every 2s while task is running
    const interval = setInterval(() => {
      fetch(`/api/tasks/${id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.task) {
            setTask(d.task);
            setEvents(d.events ?? []);
            setExecution(d.execution);
          }
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading task…</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Task not found</p>
          <p className="text-muted-foreground text-sm">ID: {id}</p>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <TaskDetailClient task={task} events={events} execution={execution as any} />;
}
