#!/usr/bin/env tsx
/**
 * risk-sentinel agent process.
 * A2A server on port 8004. AXL node on port 9004.
 *
 * On approval, forwards the execution intent to execution-node over AXL.
 */
import "dotenv/config";
import { AgentRunner } from "@/agents/shared/runner";
import { AXLClient } from "@/lib/axl/client";
import { discoverAgents } from "@/lib/ens/registry";
import { scoreRisk, decideGoNoGo } from "./skills";

const ENS_NAME = "risk-sentinel.agentbazaar.eth";
const AXL_PORT = 9004;
const A2A_PORT = 8004;

const runner = new AgentRunner(ENS_NAME, AXL_PORT, A2A_PORT);
const axl = new AXLClient(AXL_PORT);

runner.skill("score_risk", async (params, fromPeerId) => {
  const taskId = params.task_id as string | undefined;

  await runner["emit"]({
    taskId: taskId ?? "unknown",
    type: "skill.invoked",
    fromEns: "research-alpha.agentbazaar.eth",
    toEns: ENS_NAME,
    fromPeerId,
    skill: "score_risk",
    layer: "gensyn",
    payloadPreview: "Evaluating research findings for risk",
  });

  const result = await scoreRisk(params);

  await runner["emit"]({
    taskId: taskId ?? "unknown",
    type: "skill.responded",
    fromEns: ENS_NAME,
    skill: "score_risk",
    layer: "gensyn",
    payloadPreview: `score:${result.risk_score} decision:${result.decision} threshold:${result.threshold}`,
  });

  /* Forward to execution-node if approved */
  if (taskId && result.decision === "approved") {
    await forwardToExecution(taskId, params, result, fromPeerId);
  }

  return result;
});

runner.skill("decide_go_no_go", async (params, fromPeerId) => {
  return decideGoNoGo(params);
});

async function forwardToExecution(
  taskId: string,
  originalParams: Record<string, unknown>,
  riskResult: Record<string, unknown>,
  fromPeerId?: string
) {
  try {
    const agents = await discoverAgents();
    const execAgent = agents.find((a) => a.role === "executor");
    if (!execAgent?.axlPeerId) {
      console.warn("[risk-sentinel] No executor found — skipping forward");
      return;
    }

    await runner["emit"]({
      taskId,
      type: "axl.send",
      fromEns: ENS_NAME,
      toEns: execAgent.ensName,
      fromPeerId,
      toPeerId: execAgent.axlPeerId,
      skill: "execute_intent",
      layer: "gensyn",
      payloadPreview: `Approved (score ${riskResult.risk_score}). Forwarding execution intent.`,
    });

    await axl.sendA2A(execAgent.axlPeerId, "execute_intent", {
      task_id: taskId,
      approved: true,
      risk_score: riskResult.risk_score,
      risk_rationale: riskResult.rationale,
      original_prompt: originalParams.prompt ?? originalParams.task_prompt,
      findings: originalParams.findings,
    });
  } catch (err) {
    console.error("[risk-sentinel] forward to execution failed:", err);
  }
}

runner.start();
console.log(`[risk-sentinel] Running — AXL node expected on :${AXL_PORT}`);
