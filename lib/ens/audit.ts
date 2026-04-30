/**
 * Per-task audit subname minting via Namespace SDK.
 *
 * At task completion, mints task-{shortId}.tasks.agentbazaar.eth as an
 * off-chain subname, then writes text records containing the full audit trail.
 * ENS as a queryable, durable audit registry of agent coordination.
 */
import { createOffchainClient } from "@thenamespace/offchain-manager";

const AUDIT_PARENT =
  process.env.AGENT_BAZAAR_AUDIT_ENS ?? "tasks.agentbazaar.eth";
const TESTNET = process.env.ENS_TESTNET === "true";

export type AuditRecord = {
  taskId: string;
  participants: string[];
  riskScore?: number;
  riskDecision?: "approved" | "rejected";
  txHash?: string;
  workflowRunId?: string;
  outcome: string;
  completedAt: string;
};

export async function mintAuditSubname(
  audit: AuditRecord
): Promise<string | null> {
  const apiKey = process.env.NAMESPACE_API_KEY;
  if (!apiKey) {
    console.warn("[ENS] NAMESPACE_API_KEY not set — skipping audit subname mint.");
    return null;
  }

  const client = createOffchainClient({
    mode: TESTNET ? "sepolia" : "mainnet",
    defaultApiKey: apiKey,
  });

  const label = `task-${audit.taskId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
  const subname = `${label}.${AUDIT_PARENT}`;

  const texts = [
    { key: "task.id", value: audit.taskId },
    { key: "task.participants", value: audit.participants.join(",") },
    { key: "task.outcome", value: audit.outcome },
    { key: "task.completed_at", value: audit.completedAt },
    ...(audit.riskScore !== undefined ? [{ key: "task.risk_score", value: String(audit.riskScore) }] : []),
    ...(audit.riskDecision ? [{ key: "task.risk_decision", value: audit.riskDecision }] : []),
    ...(audit.txHash ? [{ key: "task.tx_hash", value: audit.txHash }] : []),
    ...(audit.workflowRunId ? [{ key: "task.workflow_run", value: audit.workflowRunId }] : []),
  ];

  try {
    await client.createSubname({ parentName: AUDIT_PARENT, label, texts });
    console.log(`[ENS] Audit subname minted: ${subname}`);
    return subname;
  } catch (err: unknown) {
    /* Subname already exists — update it instead */
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("exist") || msg.toLowerCase().includes("taken")) {
      try {
        await client.updateSubname(subname, { texts });
        console.log(`[ENS] Audit subname updated: ${subname}`);
        return subname;
      } catch (updateErr) {
        console.error("[ENS] audit subname update failed:", updateErr);
      }
    } else {
      console.error("[ENS] audit subname mint failed:", msg);
    }
    return null;
  }
}
