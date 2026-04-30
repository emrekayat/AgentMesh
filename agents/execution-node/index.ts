#!/usr/bin/env tsx
/**
 * execution-node agent process.
 * A2A server on port 8005. AXL node on port 9005.
 *
 * On execute_intent:
 *   1. Verify calling peer's ENS role is "evaluator" (policy-by-ENS)
 *   2. Confirm approval flag
 *   3. Respond to AXL immediately with "accepted"
 *   4. Run KeeperHub + audit in background, emitting SSE events
 */
import "dotenv/config";
import { AgentRunner } from "@/agents/shared/runner";
import { isAuthorizedEvaluator } from "@/agents/shared/auth";
import { KeeperHubClient } from "@/lib/keeperhub/client";
import type { WorkflowRun } from "@/lib/keeperhub/types";
import { mintAuditSubname } from "@/lib/ens/audit";
import { env } from "@/agents/shared/env";

const ENS_NAME = "execution-node.agentbazaar.eth";
const AXL_PORT = 9005;
const A2A_PORT = 8005;

const runner = new AgentRunner(ENS_NAME, AXL_PORT, A2A_PORT);
const keeperhub = new KeeperHubClient(env.keeperhubApiKey, env.keeperhubApiUrl);

runner.skill("execute_intent", async (params, fromPeerId) => {
  const taskId = params.task_id as string | undefined;

  /* ── 1. ENS-based authorization check ─────────────────────────────────── */
  const authPeer = (params.requesting_peer as string | undefined) ?? fromPeerId;
  if (authPeer) {
    const authorized = await isAuthorizedEvaluator(authPeer).catch(() => false);
    if (!authorized) {
      console.warn(`[execution-node] Unauthorized from peer ${authPeer?.slice(0, 12)}…`);
      runner["emit"]({
        taskId: taskId ?? "unknown",
        type: "ens.authorized",
        fromEns: ENS_NAME,
        layer: "ens",
        payloadPreview: `ENS role check FAILED for peer ${authPeer?.slice(0, 12)}…`,
      }).catch(() => {});
      throw new Error("Unauthorized: calling peer's ENS role is not 'evaluator'");
    }
  }

  runner["emit"]({
    taskId: taskId ?? "unknown",
    type: "ens.authorized",
    fromEns: ENS_NAME,
    layer: "ens",
    payloadPreview: `ENS role check PASSED: peer ${authPeer?.slice(0, 12)}… has agent.role=evaluator`,
  }).catch(() => {});

  /* ── 2. Gate on approval ─────────────────────────────────────────────── */
  if (!params.approved) {
    runner["emit"]({
      taskId: taskId ?? "unknown",
      type: "execution.failed",
      fromEns: ENS_NAME,
      layer: "keeperhub",
      payloadPreview: `Risk decision was rejected — execution aborted`,
    }).catch(() => {});
    return { status: "skipped", reason: "risk rejected" };
  }

  /* ── 3. Respond to AXL immediately, run KeeperHub in background ─────── */
  // Fire-and-forget so the AXL TCP connection is freed quickly
  runKeeperHub(taskId ?? "unknown", params).catch((err) => {
    console.error("[execution-node] background KeeperHub error:", err);
  });

  return { status: "accepted", taskId };
});

async function runKeeperHub(taskId: string, params: Record<string, unknown>) {
  runner["emit"]({
    taskId,
    type: "execution.requested",
    fromEns: ENS_NAME,
    layer: "keeperhub",
    payloadPreview: `POST /workflow/${env.keeperhubWorkflowId}/execute`,
  }).catch(() => {});

  let run: WorkflowRun;
  try {
    /* Trigger the pre-configured KeeperHub workflow */
    const triggered = await keeperhub.triggerWorkflow({
      workflowId: env.keeperhubWorkflowId,
      inputs: {
        task_id: taskId,
        risk_score: params.risk_score,
      },
    });

    console.log(`[execution-node] KeeperHub workflow triggered: ${triggered.id} status=${triggered.status}`);

    /* Poll until terminal if still running */
    if (triggered.status === "running" || triggered.status === "pending") {
      run = await keeperhub.pollUntilDone(env.keeperhubWorkflowId, triggered.id, 120_000);
    } else {
      run = triggered;
    }

    console.log(`[execution-node] KeeperHub workflow done: ${run.id} status=${run.status} tx=${run.txHash}`);
  } catch (err) {
    console.error("[execution-node] KeeperHub error:", err);
    runner["emit"]({
      taskId,
      type: "execution.failed",
      fromEns: ENS_NAME,
      layer: "keeperhub",
      payloadPreview: err instanceof Error ? err.message : "Unknown error",
    }).catch(() => {});
    return;
  }

  await runner["emit"]({
    taskId,
    type: "execution.confirmed",
    fromEns: ENS_NAME,
    layer: "keeperhub",
    payloadPreview: `tx ${run.txHash?.slice(0, 14) ?? run.id} — status: ${run.status}`,
    data: {
      workflowRunId: run.id,
      txHash: run.txHash,
      blockNumber: run.blockNumber,
      gasUsed: run.gasUsed,
      status: run.status,
      logs: run.logs,
    },
  });

  /* Mint audit subname */
  const auditSubname = await mintAuditSubname({
    taskId,
    participants: [
      "research-alpha.agentbazaar.eth",
      "risk-sentinel.agentbazaar.eth",
      ENS_NAME,
    ],
    riskScore: params.risk_score as number | undefined,
    riskDecision: "approved",
    txHash: run.txHash,
    workflowRunId: run.id,
    outcome: `KeeperHub workflow ${run.status}`,
    completedAt: new Date().toISOString(),
  });

  if (auditSubname) {
    await runner["emit"]({
      taskId,
      type: "audit.minted",
      layer: "ens",
      payloadPreview: `${auditSubname} minted with audit text records`,
    });
  }

  await runner["emit"]({
    taskId,
    type: "task.completed",
    layer: "system",
    payloadPreview: `Execution pipeline complete`,
    data: { auditSubname, workflowRunId: run.id, txHash: run.txHash },
  });
}


runner.start();
console.log(`[execution-node] Running — AXL node expected on :${AXL_PORT}`);
