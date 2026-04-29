/**
 * In-memory task store. Phase 1 keeps tasks in memory for the demo.
 * Phase 3 swaps the executor side to the real AXL pipeline.
 */
import { nanoid } from "nanoid";
import {
  type Task,
  type TaskCreateInput,
  type CoordinationEvent,
  type ExecutionResult,
} from "@/lib/types";
import {
  MOCK_TASK_DEMO,
  MOCK_EVENTS_DEMO,
  MOCK_EXECUTION_DEMO,
} from "@/lib/mock/seed";

type TaskRecord = {
  task: Task;
  events: CoordinationEvent[];
  execution: ExecutionResult | null;
};

const tasks = new Map<string, TaskRecord>();
tasks.set(MOCK_TASK_DEMO.id, {
  task: MOCK_TASK_DEMO,
  events: MOCK_EVENTS_DEMO,
  execution: MOCK_EXECUTION_DEMO,
});

export function listTasks(): Task[] {
  return [...tasks.values()].map((r) => r.task).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export function getTask(id: string): TaskRecord | undefined {
  return tasks.get(id);
}

export function appendEvent(event: CoordinationEvent): void {
  const record = tasks.get(event.taskId);
  if (!record) return;
  record.events.push(event);
  record.task.updatedAt = event.timestamp;
}

export function updateTaskFromEvent(event: CoordinationEvent): void {
  const record = tasks.get(event.taskId);
  if (!record) return;
  const task = record.task;

  switch (event.type) {
    case "task.submitted":
      task.status = "submitted";
      break;
    case "discovery.completed":
      if (task.status === "submitted") task.status = "discovering";
      break;
    case "skill.invoked":
      if (task.status === "submitted" || task.status === "discovering")
        task.status = "coordinating";
      break;
    case "execution.requested":
      task.status = "execution-pending";
      break;
    case "execution.confirmed":
      if (event.data) {
        const d = event.data as Record<string, unknown>;
        task.executionTxHash = d.txHash as string | undefined;
        task.executionWorkflowRun = d.workflowRunId as string | undefined;
      }
      task.status = "execution-complete";
      break;
    case "execution.failed":
      task.status = "failed";
      break;
    case "audit.minted":
      task.auditSubname = event.payloadPreview?.split(" ")[0];
      break;
    case "task.completed":
      task.status = "execution-complete";
      if (event.data) {
        const d = event.data as Record<string, unknown>;
        if (d.auditSubname) task.auditSubname = d.auditSubname as string;
        if (d.txHash) task.executionTxHash = d.txHash as string;
      }
      break;
  }

  if (event.fromEns && !task.participants.includes(event.fromEns)) {
    task.participants.push(event.fromEns);
  }
}

export function setExecution(taskId: string, execution: ExecutionResult): void {
  const record = tasks.get(taskId);
  if (!record) return;
  record.execution = execution;
}

export function createTask(input: TaskCreateInput): Task {
  const id = nanoid(8);
  const now = new Date().toISOString();
  const task: Task = {
    id,
    title: input.title,
    prompt: input.prompt,
    category: input.category,
    status: "submitted",
    createdAt: now,
    updatedAt: now,
    participants: [],
  };
  tasks.set(id, {
    task,
    events: [
      {
        id: `${id}-init`,
        taskId: id,
        type: "task.submitted",
        timestamp: now,
        layer: "system",
        payloadPreview: `New ${input.category} task accepted`,
      },
    ],
    execution: null,
  });
  return task;
}
