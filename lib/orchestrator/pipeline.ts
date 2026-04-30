/**
 * Task pipeline FSM.
 *
 * Primary: AXL mesh (real P2P, requires local AXL nodes)
 * Fallback: direct skill invocation (real LLM + real KeeperHub, no AXL transport)
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

async function axlAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${ORCHESTRATOR_AXL_PORT}/topology`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
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

  if (!researcher || !sentinel || !executor) {
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

  const useAXL = researcher.axlPeerId && sentinel.axlPeerId && executor.axlPeerId && await axlAvailable();

  if (useAXL) {
    await runViaAXL(taskId, task, agents, researcher, sentinel, executor);
  } else {
    emit({
      taskId,
      type: "axl.send",
      fromEns: ORCHESTRATOR_ENS,
      layer: "gensyn",
      payloadPreview: "AXL mesh unavailable — running skills directly (real LLM + KeeperHub)",
    });
    await runDirect(taskId, task, researcher, sentinel, executor);
  }
}

async function runViaAXL(
  taskId: string,
  task: { prompt: string; category: string },
  _agents: Agent[],
  researcher: Agent,
  sentinel: Agent,
  executor: Agent,
): Promise<void> {
  const axl = new AXLClient(ORCHESTRATOR_AXL_PORT);

  /* ── Research ── */
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
    const resp = await axl.sendA2A(researcher.axlPeerId!, "analyze_token", {
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
    emit({
      taskId,
      type: "execution.failed",
      fromEns: researcher.ensName,
      layer: "gensyn",
      payloadPreview: `research-alpha AXL error: ${err instanceof Error ? err.message : "connection failed"}`,
    });
    return;
  }

  /* ── Risk ── */
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
    const resp = await axl.sendA2A(sentinel.axlPeerId!, "score_risk", {
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
    emit({
      taskId,
      type: "execution.failed",
      fromEns: sentinel.ensName,
      layer: "gensyn",
      payloadPreview: `risk-sentinel AXL error: ${err instanceof Error ? err.message : "connection failed"}`,
    });
    return;
  }

  if (riskResult.decision !== "approved") {
    emit({ taskId, type: "execution.failed", fromEns: sentinel.ensName, layer: "keeperhub", payloadPreview: `Risk rejected (score ${riskResult.risk_score}/10)` });
    emit({ taskId, type: "task.completed", layer: "system", payloadPreview: "Task completed: no-go decision" });
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
    const resp = await axl.sendA2A(executor.axlPeerId!, "execute_intent", {
      task_id: taskId,
      original_prompt: task.prompt,
      risk_score: riskResult.risk_score,
      risk_rationale: riskResult.rationale,
      approved: true,
      requesting_peer: sentinel.axlPeerId,
    }, 120_000);
    if (resp.error) throw new Error(resp.error.message);
  } catch (err) {
    emit({
      taskId,
      type: "execution.failed",
      fromEns: ORCHESTRATOR_ENS,
      layer: "keeperhub",
      payloadPreview: err instanceof Error ? err.message : "Execution error",
    });
  }
}

async function runDirect(
  taskId: string,
  task: { prompt: string; category: string },
  researcher: Agent,
  sentinel: Agent,
  executor: Agent,
): Promise<void> {
  const { analyzeToken } = await import("@/agents/research-alpha/skills");
  const { scoreRisk } = await import("@/agents/risk-sentinel/skills");
  const { executeIntent } = await import("@/agents/execution-node/skills");

  /* ── Research ── */
  emit({
    taskId,
    type: "skill.invoked",
    fromEns: ORCHESTRATOR_ENS,
    toEns: researcher.ensName,
    skill: "analyze_token",
    layer: "gensyn",
    payloadPreview: `Invoking analyze_token on ${researcher.ensName}`,
  });

  let researchResult: Record<string, unknown>;
  try {
    researchResult = await analyzeToken({ task_id: taskId, prompt: task.prompt, category: task.category }) as Record<string, unknown>;
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
    emit({
      taskId,
      type: "execution.failed",
      fromEns: researcher.ensName,
      layer: "gensyn",
      payloadPreview: `research-alpha error: ${err instanceof Error ? err.message : "failed"}`,
    });
    return;
  }

  /* ── Risk ── */
  emit({
    taskId,
    type: "skill.invoked",
    fromEns: ORCHESTRATOR_ENS,
    toEns: sentinel.ensName,
    skill: "score_risk",
    layer: "gensyn",
    payloadPreview: `Forwarding findings to ${sentinel.ensName} for risk scoring`,
  });

  let riskResult: Record<string, unknown>;
  try {
    riskResult = await scoreRisk({ task_id: taskId, findings: researchResult, threshold: 6.0 }) as Record<string, unknown>;
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
    emit({
      taskId,
      type: "execution.failed",
      fromEns: sentinel.ensName,
      layer: "gensyn",
      payloadPreview: `risk-sentinel error: ${err instanceof Error ? err.message : "failed"}`,
    });
    return;
  }

  if (riskResult.decision !== "approved") {
    emit({ taskId, type: "execution.failed", fromEns: sentinel.ensName, layer: "keeperhub", payloadPreview: `Risk rejected (score ${riskResult.risk_score}/10 < 6.0 threshold)` });
    emit({ taskId, type: "task.completed", layer: "system", payloadPreview: "Task completed: no-go decision from risk-sentinel" });
    return;
  }

  /* ── Execution ── */
  emit({
    taskId,
    type: "skill.invoked",
    fromEns: ORCHESTRATOR_ENS,
    toEns: executor.ensName,
    skill: "execute_intent",
    layer: "gensyn",
    payloadPreview: `Risk approved (${riskResult.risk_score}/10) — invoking execute_intent`,
  });

  try {
    await executeIntent({
      task_id: taskId,
      original_prompt: task.prompt,
      risk_score: riskResult.risk_score,
      risk_rationale: riskResult.rationale,
      approved: true,
      requesting_peer: sentinel.axlPeerId ?? "direct",
    });
  } catch (err) {
    emit({
      taskId,
      type: "execution.failed",
      fromEns: executor.ensName,
      layer: "keeperhub",
      payloadPreview: err instanceof Error ? err.message : "Execution error",
    });
  }
}
