#!/usr/bin/env tsx
/**
 * research-alpha agent process.
 *
 * Starts an A2A HTTP server on port 8003.
 * The AXL node (node2-research.json, api_port=9003) forwards incoming A2A
 * messages to this server.
 *
 * After processing, it calls risk-sentinel via AXL for risk scoring.
 */
import "dotenv/config";
import { AgentRunner } from "@/agents/shared/runner";
import { AXLClient } from "@/lib/axl/client";
import { discoverAgents } from "@/lib/ens/registry";
import { analyzeToken, gatherContext } from "./skills";

const ENS_NAME = "research-alpha.agentbazaar.eth";
const AXL_PORT = 9003;
const A2A_PORT = 8003;

const runner = new AgentRunner(ENS_NAME, AXL_PORT, A2A_PORT);
const axl = new AXLClient(AXL_PORT);

/* Shared task context passed between skills when in a multi-step pipeline */
const taskContexts = new Map<string, Record<string, unknown>>();

runner.skill("analyze_token", async (params, fromPeerId) => {
  const taskId = params.task_id as string | undefined;

  await runner["emit"]({
    taskId: taskId ?? "unknown",
    type: "skill.invoked",
    fromEns: "orchestrator.agentbazaar.eth",
    toEns: ENS_NAME,
    fromPeerId,
    skill: "analyze_token",
    layer: "gensyn",
    payloadPreview: `Analyzing: ${params.prompt ?? params.token ?? "token opportunity"}`,
  });

  const findings = await analyzeToken(params);

  await runner["emit"]({
    taskId: taskId ?? "unknown",
    type: "skill.responded",
    fromEns: ENS_NAME,
    skill: "analyze_token",
    layer: "gensyn",
    payloadPreview: `token:${findings.token} sentiment:${findings.sentiment} volatility:${findings.volatility24h}`,
  });

  /* Forward to risk-sentinel over AXL */
  if (taskId) {
    taskContexts.set(taskId, { ...params, findings });
    await forwardToRisk(taskId, findings, fromPeerId);
  }

  return findings;
});

runner.skill("gather_context", async (params, fromPeerId) => {
  const taskId = params.task_id as string | undefined;

  await runner["emit"]({
    taskId: taskId ?? "unknown",
    type: "skill.invoked",
    fromEns: "orchestrator.agentbazaar.eth",
    toEns: ENS_NAME,
    fromPeerId,
    skill: "gather_context",
    layer: "gensyn",
    payloadPreview: `Gathering context: ${params.prompt ?? "…"}`,
  });

  return gatherContext(params);
});

async function forwardToRisk(
  taskId: string,
  findings: Record<string, unknown>,
  fromPeerId?: string
) {
  try {
    const agents = await discoverAgents();
    const riskAgent = agents.find((a) => a.role === "evaluator");
    if (!riskAgent?.axlPeerId) {
      console.warn("[research-alpha] No risk agent found — skipping forward");
      return;
    }

    await runner["emit"]({
      taskId,
      type: "axl.send",
      fromEns: ENS_NAME,
      toEns: riskAgent.ensName,
      fromPeerId,
      toPeerId: riskAgent.axlPeerId,
      skill: "score_risk",
      layer: "gensyn",
      payloadPreview: "Forwarding research findings for risk scoring",
    });

    await axl.sendA2A(riskAgent.axlPeerId, "score_risk", {
      task_id: taskId,
      findings,
    });
  } catch (err) {
    console.error("[research-alpha] forward to risk failed:", err);
  }
}

runner.start();
console.log(`[research-alpha] Running — AXL node expected on :${AXL_PORT}`);
