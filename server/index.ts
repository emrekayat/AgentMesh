import "dotenv/config";
import express from "express";
import { nanoid } from "nanoid";
import { discoverAgents } from "@/lib/ens/registry";
import { analyzeToken } from "@/agents/research-alpha/skills";
import { scoreRisk } from "@/agents/risk-sentinel/skills";
import { KeeperHubClient } from "@/lib/keeperhub/client";
import { mintAuditSubname } from "@/lib/ens/audit";
import type { Task, TaskCreateInput, CoordinationEvent, ExecutionResult } from "@/lib/types";
import { TaskCreateInputSchema } from "@/lib/types";

const EXECUTION_ENS = "execution-node.agentbazaar.eth";

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
    if (full.type === "execution.confirmed" && full.data) {
      const d = full.data as Record<string, unknown>;
      record.execution = {
        taskId: full.taskId,
        workflowId: process.env.KEEPERHUB_WORKFLOW_ID ?? "",
        workflowRunId: (d.workflowRunId as string) ?? "",
        txHash: d.txHash as string | undefined,
        blockNumber: d.blockNumber as number | undefined,
        gasUsed: d.gasUsed as string | undefined,
        status: "succeeded",
        logs: (d.logs as string[]) ?? [],
        chain: "base-sepolia",
        startedAt: full.timestamp,
      };
    }
  }
  sseClients.get(full.taskId)?.forEach((send) => send(JSON.stringify(full)));
}

function updateStatus(task: Task, event: CoordinationEvent): void {
  switch (event.type) {
    case "task.submitted": task.status = "submitted"; break;
    case "discovery.completed": if (task.status === "submitted") task.status = "discovering"; break;
    case "skill.invoked": if (task.status === "submitted" || task.status === "discovering") task.status = "coordinating"; break;
    case "skill.responded":
      if (event.skill === "score_risk" && event.data) {
        const d = event.data as Record<string, unknown>;
        task.riskScore = d.risk_score as number | undefined;
        task.riskDecision = (d.decision === "approved" || d.decision === "rejected") ? d.decision : undefined;
      }
      break;
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
  emit({ taskId, type: "ens.authorized", fromEns: EXECUTION_ENS, layer: "ens", payloadPreview: "ENS role check PASSED: agent.role=evaluator" });
  emit({ taskId, type: "execution.requested", fromEns: EXECUTION_ENS, layer: "keeperhub", payloadPreview: `POST /workflow/${process.env.KEEPERHUB_WORKFLOW_ID}/execute` });

  try {
    const keeperhub = new KeeperHubClient(
      process.env.KEEPERHUB_API_KEY ?? "",
      process.env.KEEPERHUB_API_URL ?? "https://app.keeperhub.com/api",
    );
    const workflowId = process.env.KEEPERHUB_WORKFLOW_ID ?? "";

    const triggered = await keeperhub.triggerWorkflow({
      workflowId,
      inputs: { task_id: taskId, risk_score: riskResult.risk_score },
    });

    const run = triggered.status === "running" || triggered.status === "pending"
      ? await keeperhub.pollUntilDone(workflowId, triggered.id, 120_000)
      : triggered;

    emit({
      taskId,
      type: "execution.confirmed",
      fromEns: EXECUTION_ENS,
      layer: "keeperhub",
      payloadPreview: `tx ${run.txHash?.slice(0, 14) ?? run.id} — status: ${run.status}`,
      data: { workflowRunId: run.id, txHash: run.txHash, blockNumber: run.blockNumber, gasUsed: run.gasUsed, status: run.status },
    });

    const auditSubname = await mintAuditSubname({
      taskId,
      participants: ["research-alpha.agentbazaar.eth", "risk-sentinel.agentbazaar.eth", EXECUTION_ENS],
      riskScore: riskResult.risk_score as number | undefined,
      riskDecision: "approved",
      txHash: run.txHash,
      workflowRunId: run.id,
      outcome: `KeeperHub workflow ${run.status}`,
      completedAt: new Date().toISOString(),
    });

    if (auditSubname) {
      emit({ taskId, type: "audit.minted", layer: "ens", payloadPreview: `${auditSubname} minted with audit text records` });
    }

    emit({ taskId, type: "task.completed", layer: "system", payloadPreview: "Execution pipeline complete", data: { auditSubname, workflowRunId: run.id, txHash: run.txHash } });
  } catch (err) {
    emit({ taskId, type: "execution.failed", fromEns: EXECUTION_ENS, layer: "keeperhub", payloadPreview: err instanceof Error ? err.message : "Execution error" });
  }
}

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`[server] AgentMesh backend on :${PORT}`));
