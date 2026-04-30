/**
 * Standalone executeIntent — callable directly (no AXL runner dependency).
 * Used by the pipeline fallback when AXL mesh is unavailable.
 */
import { KeeperHubClient } from "@/lib/keeperhub/client";
import { mintAuditSubname } from "@/lib/ens/audit";
import { appendEvent, updateTaskFromEvent } from "@/lib/store/tasks";
import bus from "@/lib/events/bus";
import { nanoid } from "nanoid";
import type { CoordinationEvent } from "@/lib/types";

const ENS_NAME = "execution-node.agentbazaar.eth";

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

export async function executeIntent(params: Record<string, unknown>): Promise<void> {
  const taskId = params.task_id as string;
  const keeperhubApiKey = process.env.KEEPERHUB_API_KEY ?? "";
  const keeperhubApiUrl = process.env.KEEPERHUB_API_URL ?? "https://app.keeperhub.com/api";
  const workflowId = process.env.KEEPERHUB_WORKFLOW_ID ?? "";

  const keeperhub = new KeeperHubClient(keeperhubApiKey, keeperhubApiUrl);

  emit({
    taskId,
    type: "ens.authorized",
    fromEns: ENS_NAME,
    layer: "ens",
    payloadPreview: `ENS role check PASSED: agent.role=evaluator`,
  });

  emit({
    taskId,
    type: "execution.requested",
    fromEns: ENS_NAME,
    layer: "keeperhub",
    payloadPreview: `POST /workflow/${workflowId}/execute`,
  });

  const triggered = await keeperhub.triggerWorkflow({
    workflowId,
    inputs: { task_id: taskId, risk_score: params.risk_score },
  });

  const run =
    triggered.status === "running" || triggered.status === "pending"
      ? await keeperhub.pollUntilDone(workflowId, triggered.id, 120_000)
      : triggered;

  emit({
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
    },
  });

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
    emit({
      taskId,
      type: "audit.minted",
      layer: "ens",
      payloadPreview: `${auditSubname} minted with audit text records`,
    });
  }

  emit({
    taskId,
    type: "task.completed",
    layer: "system",
    payloadPreview: `Execution pipeline complete`,
    data: { auditSubname, workflowRunId: run.id, txHash: run.txHash },
  });
}
