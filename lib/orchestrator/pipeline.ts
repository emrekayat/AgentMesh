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
    console.error("[pipeline] AXL research failed:", err instanceof Error ? err.message : err);
    emit({
      taskId,
      type: "execution.failed",
      fromEns: researcher.ensName,
      layer: "gensyn",
      payloadPreview: `research-alpha AXL error: ${err instanceof Error ? err.message : "connection failed"}`,
    });
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
    console.error("[pipeline] AXL risk scoring failed:", err instanceof Error ? err.message : err);
    emit({
      taskId,
      type: "execution.failed",
      fromEns: sentinel.ensName,
      layer: "gensyn",
      payloadPreview: `risk-sentinel AXL error: ${err instanceof Error ? err.message : "connection failed"}`,
    });
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

