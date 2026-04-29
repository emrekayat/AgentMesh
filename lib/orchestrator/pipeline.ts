/**
 * Task pipeline FSM.
 *
 * Drives the full chain over real AXL mesh:
 *   ENS discovery → research-alpha (AXL) → risk-sentinel (AXL) → execution-node (AXL)
 *
 * Falls back to simulation when AXL nodes aren't running.
 */
import { discoverAgents } from "@/lib/ens/registry";
import { AXLClient } from "@/lib/axl/client";
import { appendEvent, updateTaskFromEvent, getTask } from "@/lib/store/tasks";
import bus from "@/lib/events/bus";
import { nanoid } from "nanoid";
import type { Agent, CoordinationEvent } from "@/lib/types";

const ORCHESTRATOR_ENS = "orchestrator.agentbazaar.eth";
const ORCHESTRATOR_AXL_PORT = 9002;

function emit(event: Omit<CoordinationEvent, "id" | "timestamp">): void {
  const full: CoordinationEvent = {
    ...event,
    id: nanoid(),
    timestamp: new Date().toISOString(),
  };
  appendEvent(full);
  updateTaskFromEvent(full);
  bus.publish(full);
}

export async function runTaskPipeline(taskId: string): Promise<void> {
  const record = getTask(taskId);
  if (!record) return;
  const task = record.task;

  /* ── 1. Discover agents via ENS ──────────────────────────────────────── */
  emit({
    taskId,
    type: "discovery.completed",
    fromEns: ORCHESTRATOR_ENS,
    layer: "ens",
    payloadPreview: "Discovering agents via ENS subname registry…",
  });

  let agents: Agent[];
  try {
    agents = await discoverAgents();
  } catch (err) {
    emit({
      taskId,
      type: "execution.failed",
      fromEns: ORCHESTRATOR_ENS,
      layer: "ens",
      payloadPreview: `ENS discovery failed: ${err instanceof Error ? err.message : "unknown"}`,
    });
    return;
  }

  const researcher = agents.find((a) => a.role === "researcher");
  const sentinel = agents.find((a) => a.role === "evaluator");
  const executor = agents.find((a) => a.role === "executor");

  if (!researcher?.axlPeerId || !sentinel?.axlPeerId || !executor?.axlPeerId) {
    emit({
      taskId,
      type: "execution.failed",
      fromEns: ORCHESTRATOR_ENS,
      layer: "ens",
      payloadPreview: "Missing required agents in ENS registry",
    });
    return;
  }

  emit({
    taskId,
    type: "discovery.completed",
    fromEns: ORCHESTRATOR_ENS,
    layer: "ens",
    payloadPreview: `Resolved ${agents.length} agents: ${agents.map((a) => a.ensName).join(", ")}`,
  });

  const axl = new AXLClient(ORCHESTRATOR_AXL_PORT);

  /* ── 2. Research phase ───────────────────────────────────────────────── */
  emit({
    taskId,
    type: "axl.send",
    fromEns: ORCHESTRATOR_ENS,
    toEns: researcher.ensName,
    toPeerId: researcher.axlPeerId,
    skill: "analyze_token",
    layer: "gensyn",
    payloadPreview: `Dispatching to ${researcher.ensName} via AXL`,
  });

  let researchResult: Record<string, unknown>;
  try {
    const resp = await axl.sendA2A(researcher.axlPeerId, "analyze_token", {
      task_id: taskId,
      prompt: task.prompt,
      category: task.category,
    }, 45_000);

    if (resp.error) throw new Error(resp.error.message);
    researchResult = (resp.result as Record<string, unknown>) ?? {};

    emit({
      taskId,
      type: "skill.responded",
      fromEns: researcher.ensName,
      skill: "analyze_token",
      layer: "gensyn",
      payloadPreview: `Research complete: sentiment=${researchResult.sentiment ?? "?"}, volatility=${researchResult.volatility24h ?? "?"}`,
      data: researchResult,
    });
  } catch (err) {
    console.warn("[pipeline] AXL research failed — falling back to simulation:", err instanceof Error ? err.message : err);
    await simulatePipeline(taskId, task.prompt, agents);
    return;
  }

  /* ── 3. Risk evaluation phase ────────────────────────────────────────── */
  emit({
    taskId,
    type: "axl.send",
    fromEns: ORCHESTRATOR_ENS,
    toEns: sentinel.ensName,
    toPeerId: sentinel.axlPeerId,
    skill: "score_risk",
    layer: "gensyn",
    payloadPreview: `Forwarding findings to ${sentinel.ensName} for risk scoring`,
  });

  let riskResult: Record<string, unknown>;
  try {
    const resp = await axl.sendA2A(sentinel.axlPeerId, "score_risk", {
      task_id: taskId,
      findings: researchResult,
      threshold: 6.0,
    }, 45_000);

    if (resp.error) throw new Error(resp.error.message);
    riskResult = (resp.result as Record<string, unknown>) ?? {};

    emit({
      taskId,
      type: "skill.responded",
      fromEns: sentinel.ensName,
      skill: "score_risk",
      layer: "gensyn",
      payloadPreview: `Risk score: ${riskResult.risk_score ?? "?"}/10 — decision: ${riskResult.decision ?? "?"}`,
      data: riskResult,
    });
  } catch (err) {
    console.warn("[pipeline] AXL risk scoring failed — falling back:", err instanceof Error ? err.message : err);
    await simulatePipeline(taskId, task.prompt, agents);
    return;
  }

  /* ── 4. Execution phase (if approved) ────────────────────────────────── */
  if (riskResult.decision !== "approved") {
    emit({
      taskId,
      type: "execution.failed",
      fromEns: sentinel.ensName,
      layer: "keeperhub",
      payloadPreview: `Risk rejected (score ${riskResult.risk_score}/10 < threshold) — execution aborted`,
    });
    emit({
      taskId,
      type: "task.completed",
      layer: "system",
      payloadPreview: `Task completed: no-go decision from risk-sentinel`,
    });
    return;
  }

  emit({
    taskId,
    type: "axl.send",
    fromEns: ORCHESTRATOR_ENS,
    toEns: executor.ensName,
    toPeerId: executor.axlPeerId,
    skill: "execute_intent",
    layer: "gensyn",
    payloadPreview: `Risk approved — dispatching to ${executor.ensName}`,
  });

  try {
    const resp = await axl.sendA2A(executor.axlPeerId, "execute_intent", {
      task_id: taskId,
      original_prompt: task.prompt,
      risk_score: riskResult.risk_score,
      risk_rationale: riskResult.rationale,
      approved: true,
      requesting_peer: sentinel.axlPeerId,  // ENS auth: execution checks this is evaluator role
    }, 120_000);

    if (resp.error) throw new Error(resp.error.message);
  } catch (err) {
    console.warn("[pipeline] AXL execution failed:", err instanceof Error ? err.message : err);
    emit({
      taskId,
      type: "execution.failed",
      fromEns: ORCHESTRATOR_ENS,
      layer: "keeperhub",
      payloadPreview: err instanceof Error ? err.message : "Execution error",
    });
  }
}

/** Full simulation when AXL nodes aren't running */
async function simulatePipeline(
  taskId: string,
  prompt: string,
  agents: Agent[]
) {
  const researcher = agents.find((a) => a.role === "researcher");
  const sentinel = agents.find((a) => a.role === "evaluator");
  const executor = agents.find((a) => a.role === "executor");

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await delay(800);
  emit({
    taskId,
    type: "skill.invoked",
    fromEns: ORCHESTRATOR_ENS,
    toEns: researcher?.ensName ?? "research-alpha.agentbazaar.eth",
    skill: "analyze_token",
    layer: "gensyn",
    payloadPreview: `[sim] Analyzing: ${prompt.slice(0, 60)}…`,
  });

  await delay(2000);
  emit({
    taskId,
    type: "skill.responded",
    fromEns: researcher?.ensName ?? "research-alpha.agentbazaar.eth",
    skill: "analyze_token",
    layer: "gensyn",
    payloadPreview:
      "[sim] Research complete: sentiment=bullish, volatility=medium, liquidity=high",
  });

  await delay(600);
  emit({
    taskId,
    type: "skill.invoked",
    fromEns: researcher?.ensName ?? "research-alpha.agentbazaar.eth",
    toEns: sentinel?.ensName ?? "risk-sentinel.agentbazaar.eth",
    skill: "score_risk",
    layer: "gensyn",
    payloadPreview: "[sim] Forwarding findings for risk evaluation",
  });

  await delay(1500);
  const riskScore = 7.2;
  emit({
    taskId,
    type: "skill.responded",
    fromEns: sentinel?.ensName ?? "risk-sentinel.agentbazaar.eth",
    skill: "score_risk",
    layer: "gensyn",
    payloadPreview: `[sim] score:${riskScore} decision:approved threshold:6.0`,
  });

  await delay(400);
  emit({
    taskId,
    type: "ens.authorized",
    fromEns: executor?.ensName ?? "execution-node.agentbazaar.eth",
    layer: "ens",
    payloadPreview: `[sim] ENS role check PASSED: risk-sentinel.agentbazaar.eth has agent.role=evaluator`,
  });

  await delay(500);
  emit({
    taskId,
    type: "execution.requested",
    fromEns: executor?.ensName ?? "execution-node.agentbazaar.eth",
    layer: "keeperhub",
    payloadPreview: "[sim] POST /workflows/wf_demo/runs",
  });

  await delay(2500);
  const txHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  const workflowRunId = `wfr_sim_${taskId}`;

  emit({
    taskId,
    type: "execution.confirmed",
    fromEns: executor?.ensName ?? "execution-node.agentbazaar.eth",
    layer: "keeperhub",
    payloadPreview: `[sim] tx ${txHash.slice(0, 14)}… — status: succeeded`,
    data: {
      workflowRunId,
      txHash,
      blockNumber: 7_142_338 + Math.floor(Math.random() * 1000),
      gasUsed: "164,221",
      status: "succeeded",
      logs: [
        "Workflow accepted (simulation mode)",
        "Simulated Turnkey signer — enclave handshake ok",
        `Simulated tx ${txHash.slice(0, 16)}… submitted`,
        "Workflow status → succeeded (simulated)",
      ],
    },
  });

  await delay(800);
  const shortId = taskId.slice(0, 6);
  const auditSubname = `task-${shortId}.tasks.agentbazaar.eth`;
  emit({
    taskId,
    type: "audit.minted",
    layer: "ens",
    payloadPreview: `${auditSubname} minted with audit text records`,
  });

  await delay(300);
  emit({
    taskId,
    type: "task.completed",
    layer: "system",
    payloadPreview: `[sim] Execution pipeline complete`,
    data: { auditSubname, workflowRunId, txHash },
  });
}
