import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import {
  type Task,
  type TaskCreateInput,
  type CoordinationEvent,
  type ExecutionResult,
} from "@/lib/types";

// Vercel: filesystem is read-only except /tmp
const DB_PATH = process.env.VERCEL
  ? "/tmp/.tasks.json"
  : path.join(process.cwd(), ".tasks.json");

type TaskRecord = {
  task: Task;
  events: CoordinationEvent[];
  execution: ExecutionResult | null;
};

type DB = Record<string, TaskRecord>;

function readDB(): DB {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeDB(db: DB): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function listTasks(): Task[] {
  const db = readDB();
  return Object.values(db)
    .map((r) => r.task)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getTask(id: string): TaskRecord | undefined {
  return readDB()[id];
}

export function appendEvent(event: CoordinationEvent): void {
  const db = readDB();
  const record = db[event.taskId];
  if (!record) return;
  record.events.push(event);
  record.task.updatedAt = event.timestamp;
  writeDB(db);
}

export function updateTaskFromEvent(event: CoordinationEvent): void {
  const db = readDB();
  const record = db[event.taskId];
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

  writeDB(db);
}

export function setExecution(taskId: string, execution: ExecutionResult): void {
  const db = readDB();
  const record = db[taskId];
  if (!record) return;
  record.execution = execution;
  writeDB(db);
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
  const db = readDB();
  db[id] = {
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
  };
  writeDB(db);
  return task;
}
