/**
 * Task pipeline FSM.
 *
 * Called after a task is created via POST /api/tasks.
 * Drives the full chain:
 *   ENS discovery → select research-alpha → AXL sendA2A → rest is agent-driven
 *
 * The agents themselves chain the remaining steps (research→risk→execution)
 * by forwarding over AXL. The orchestrator's job is to kick off the first call
 * and set up any necessary state.
 */
import { discoverAgents } from "@/lib/ens/registry";
import { AXLClient } from "@/lib/axl/client";
import { appendEvent, updateTaskFromEvent, getTask } from "@/lib/store/tasks";
import bus from "@/lib/events/bus";
import { nanoid } from "nanoid";
import type { CoordinationEvent } from "@/lib/types";

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

  let agents;
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
  if (!researcher?.axlPeerId) {
    emit({
      taskId,
      type: "execution.failed",
      fromEns: ORCHESTRATOR_ENS,
      layer: "ens",
      payloadPreview: "No researcher agent found in ENS registry",
    });
    return;
  }

  /* ── 2. Emit discovery result ────────────────────────────────────────── */
  emit({
    taskId,
    type: "discovery.completed",
    fromEns: ORCHESTRATOR_ENS,
    layer: "ens",
    payloadPreview: `Resolved ${agents.length} agents: ${agents.map((a) => a.ensName).join(", ")}`,
  });

  /* ── 3. Send task to researcher via AXL ─────────────────────────────── */
  const axl = new AXLClient(ORCHESTRATOR_AXL_PORT);

  emit({
    taskId,
    type: "axl.send",
    fromEns: ORCHESTRATOR_ENS,
    toEns: researcher.ensName,
    toPeerId: researcher.axlPeerId,
    skill: "analyze_token",
    layer: "gensyn",
    payloadPreview: `Dispatching task to ${researcher.ensName} via AXL mesh`,
  });

  try {
    await axl.sendA2A(researcher.axlPeerId, "analyze_token", {
      task_id: taskId,
      task_prompt: task.prompt,
      prompt: task.prompt,
      category: task.category,
    });

    emit({
      taskId,
      type: "axl.recv",
      fromEns: researcher.ensName,
      toEns: ORCHESTRATOR_ENS,
      layer: "gensyn",
      payloadPreview: `Task accepted by ${researcher.ensName} — pipeline running`,
    });
  } catch (err) {
    /* AXL nodes not running — simulate the full pipeline for demo mode */
    console.warn(
      "[pipeline] AXL unavailable — running simulation:",
      err instanceof Error ? err.message : err
    );
    await simulatePipeline(taskId, task.prompt, agents);
  }
}

/** Full simulation when AXL nodes aren't running */
async function simulatePipeline(
  taskId: string,
  prompt: string,
  agents: Awaited<ReturnType<typeof discoverAgents>>
) {
  const researcher = agents.find((a) => a.role === "researcher");
  const sentinel = agents.find((a) => a.role === "evaluator");
  const executor = agents.find((a) => a.role === "executor");

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* Research phase */
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

  /* Risk phase */
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

  /* ENS authorization */
  await delay(400);
  emit({
    taskId,
    type: "ens.authorized",
    fromEns: executor?.ensName ?? "execution-node.agentbazaar.eth",
    layer: "ens",
    payloadPreview: `[sim] ENS role check PASSED: risk-sentinel.agentbazaar.eth has agent.role=evaluator`,
  });

  /* Execution */
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

  /* Audit subname */
  await delay(800);
  const shortId = taskId.slice(0, 6);
  const auditSubname = `task-${shortId}.tasks.agentbazaar.eth`;
  emit({
    taskId,
    type: "audit.minted",
    layer: "ens",
    payloadPreview: `${auditSubname} minted with audit text records`,
  });

  /* Complete */
  await delay(300);
  emit({
    taskId,
    type: "task.completed",
    layer: "system",
    payloadPreview: `[sim] Execution pipeline complete`,
    data: { auditSubname, workflowRunId, txHash },
  });
}
