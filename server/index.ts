import "dotenv/config";
import express from "express";
import { nanoid } from "nanoid";
import { discoverAgents } from "@/lib/ens/registry";
import { analyzeToken } from "@/agents/research-alpha/skills";
import { scoreRisk } from "@/agents/risk-sentinel/skills";
import { executeIntent } from "@/agents/execution-node/skills";
import type { Task, TaskCreateInput, CoordinationEvent, ExecutionResult } from "@/lib/types";
import { TaskCreateInputSchema } from "@/lib/types";

const app = express();
app.use(express.json());

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

/* ── In-process task store ───────────────────────────────────────────────── */
type TaskRecord = {
  task: Task;
  events: CoordinationEvent[];
  execution: ExecutionResult | null;
};

const store = new Map<string, TaskRecord>();
const sseClients = new Map<string, Set<(data: string) => void>>();

function emit(event: Omit<CoordinationEvent, "id" | "timestamp">): void {
  const full: CoordinationEvent = {
    ...event,
    id: nanoid(),
    timestamp: new Date().toISOString(),
  };
  const record = store.get(full.taskId);
  if (record) {
    record.events.push(full);
    record.task.updatedAt = full.timestamp;
    updateStatus(record.task, full);
  }
  sseClients.get(full.taskId)?.forEach((send) => send(JSON.stringify(full)));
}

function updateStatus(task: Task, event: CoordinationEvent): void {
  switch (event.type) {
    case "task.submitted": task.status = "submitted"; break;
    case "discovery.completed": if (task.status === "submitted") task.status = "discovering"; break;
    case "skill.invoked": if (task.status === "submitted" || task.status === "discovering") task.status = "coordinating"; break;
    case "execution.requested": task.status = "execution-pending"; break;
    case "execution.confirmed":
      task.status = "execution-complete";
      if (event.data) {
        const d = event.data as Record<string, unknown>;
        task.executionTxHash = d.txHash as string | undefined;
        task.executionWorkflowRun = d.workflowRunId as string | undefined;
      }
      break;
    case "execution.failed": task.status = "failed"; break;
    case "audit.minted": task.auditSubname = event.payloadPreview?.split(" ")[0]; break;
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

/* ── Routes ──────────────────────────────────────────────────────────────── */
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/tasks", (_req, res) => {
  const tasks = [...store.values()]
    .map((r) => r.task)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ tasks });
});

app.get("/tasks/:id", (req, res) => {
  const record = store.get(req.params.id);
  if (!record) return res.status(404).json({ error: "not_found" });
  res.json({ task: record.task, events: record.events, execution: record.execution });
});

app.post("/tasks", async (req, res) => {
  const parsed = TaskCreateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", issues: parsed.error.issues });
  }

  const input: TaskCreateInput = parsed.data;
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

  store.set(id, {
    task,
    events: [{
      id: `${id}-init`,
      taskId: id,
      type: "task.submitted",
      timestamp: now,
      layer: "system",
      payloadPreview: `New ${input.category} task accepted`,
    }],
    execution: null,
  });

  res.status(201).json({ task });

  runPipeline(id, task).catch((err) =>
    console.error("[pipeline] unhandled:", err)
  );
});

/* SSE */
app.get("/stream/:taskId", (req, res) => {
  const { taskId } = req.params;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const record = store.get(taskId);
  if (record) {
    for (const ev of record.events) {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    }
  }

  const send = (data: string) => res.write(`data: ${data}\n\n`);
  if (!sseClients.has(taskId)) sseClients.set(taskId, new Set());
  sseClients.get(taskId)!.add(send);

  const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(ping);
    sseClients.get(taskId)?.delete(send);
  });
});

/* ── Pipeline ────────────────────────────────────────────────────────────── */
const ORCHESTRATOR_ENS = "orchestrator.agentbazaar.eth";

async function runPipeline(taskId: string, task: Task): Promise<void> {
  emit({ taskId, type: "discovery.completed", fromEns: ORCHESTRATOR_ENS, layer: "ens", payloadPreview: "Discovering agents via ENS subname registry…" });

  let agents;
  try {
    agents = await discoverAgents();
  } catch (err) {
    emit({ taskId, type: "execution.failed", fromEns: ORCHESTRATOR_ENS, layer: "ens", payloadPreview: `ENS discovery failed: ${err instanceof Error ? err.message : "unknown"}` });
    return;
  }

  const researcher = agents.find((a) => a.role === "researcher");
  const sentinel = agents.find((a) => a.role === "evaluator");
  const executor = agents.find((a) => a.role === "executor");

  if (!researcher || !sentinel || !executor) {
    emit({ taskId, type: "execution.failed", fromEns: ORCHESTRATOR_ENS, layer: "ens", payloadPreview: "Missing required agents in ENS registry" });
    return;
  }

  emit({ taskId, type: "discovery.completed", fromEns: ORCHESTRATOR_ENS, layer: "ens", payloadPreview: `Resolved ${agents.length} agents: ${agents.map((a) => a.ensName).join(", ")}` });

  /* Research */
  emit({ taskId, type: "skill.invoked", fromEns: ORCHESTRATOR_ENS, toEns: researcher.ensName, skill: "analyze_token", layer: "gensyn", payloadPreview: `Invoking analyze_token on ${researcher.ensName}` });

  let researchResult: Record<string, unknown>;
  try {
    researchResult = await analyzeToken({ task_id: taskId, prompt: task.prompt, category: task.category }) as Record<string, unknown>;
    emit({ taskId, type: "skill.responded", fromEns: researcher.ensName, skill: "analyze_token", layer: "gensyn", payloadPreview: `Research complete: sentiment=${researchResult.sentiment ?? "?"}, volatility=${researchResult.volatility24h ?? "?"}`, data: researchResult });
  } catch (err) {
    emit({ taskId, type: "execution.failed", fromEns: researcher.ensName, layer: "gensyn", payloadPreview: `research-alpha error: ${err instanceof Error ? err.message : "failed"}` });
    return;
  }

  /* Risk */
  emit({ taskId, type: "skill.invoked", fromEns: ORCHESTRATOR_ENS, toEns: sentinel.ensName, skill: "score_risk", layer: "gensyn", payloadPreview: `Forwarding findings to ${sentinel.ensName} for risk scoring` });

  let riskResult: Record<string, unknown>;
  try {
    riskResult = await scoreRisk({ task_id: taskId, findings: researchResult, threshold: 6.0 }) as Record<string, unknown>;
    emit({ taskId, type: "skill.responded", fromEns: sentinel.ensName, skill: "score_risk", layer: "gensyn", payloadPreview: `Risk score: ${riskResult.risk_score ?? "?"}/10 — decision: ${riskResult.decision ?? "?"}`, data: riskResult });
  } catch (err) {
    emit({ taskId, type: "execution.failed", fromEns: sentinel.ensName, layer: "gensyn", payloadPreview: `risk-sentinel error: ${err instanceof Error ? err.message : "failed"}` });
    return;
  }

  if (riskResult.decision !== "approved") {
    emit({ taskId, type: "execution.failed", fromEns: sentinel.ensName, layer: "keeperhub", payloadPreview: `Risk rejected (score ${riskResult.risk_score}/10 < 6.0 threshold)` });
    emit({ taskId, type: "task.completed", layer: "system", payloadPreview: "Task completed: no-go decision from risk-sentinel" });
    return;
  }

  /* Execution */
  emit({ taskId, type: "skill.invoked", fromEns: ORCHESTRATOR_ENS, toEns: executor.ensName, skill: "execute_intent", layer: "gensyn", payloadPreview: `Risk approved (${riskResult.risk_score}/10) — invoking execute_intent` });

  try {
    await executeIntent({ task_id: taskId, original_prompt: task.prompt, risk_score: riskResult.risk_score, risk_rationale: riskResult.rationale, approved: true, requesting_peer: "direct" });
  } catch (err) {
    emit({ taskId, type: "execution.failed", fromEns: executor.ensName, layer: "keeperhub", payloadPreview: err instanceof Error ? err.message : "Execution error" });
  }
}

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`[server] AgentMesh backend on :${PORT}`));
