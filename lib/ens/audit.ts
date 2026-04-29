/**
 * Per-task audit subname minting.
 *
 * At task completion, we mint task-{shortId}.tasks.agentbazaar.eth as an
 * off-chain subname via Namespace, then write text records containing the
 * full audit trail. This is the "Most Creative ENS Use" angle: ENS becomes
 * a queryable, durable audit registry of agent coordination.
 */

const NAMESPACE_API =
  process.env.NAMESPACE_API_URL ?? "https://api.namespace.ninja/v1";
const AUDIT_PARENT =
  process.env.AGENT_BAZAAR_AUDIT_ENS ?? "tasks.agentbazaar.eth";

export type AuditRecord = {
  taskId: string;
  participants: string[];        // ENS names of participating agents
  riskScore?: number;
  riskDecision?: "approved" | "rejected";
  txHash?: string;
  workflowRunId?: string;
  outcome: string;
  completedAt: string;
};

/**
 * Mint an audit subname and write text records for a completed task.
 * Returns the full subname (e.g. task-abc123.tasks.agentbazaar.eth).
 *
 * No-ops gracefully if NAMESPACE_API_KEY is not set.
 */
export async function mintAuditSubname(
  audit: AuditRecord
): Promise<string | null> {
  const apiKey = process.env.NAMESPACE_API_KEY;
  if (!apiKey) {
    console.warn(
      "[ENS] NAMESPACE_API_KEY not set — skipping audit subname mint."
    );
    return null;
  }

  const label = `task-${audit.taskId.toLowerCase().slice(0, 8)}`;
  const subname = `${label}.${AUDIT_PARENT}`;

  try {
    /* Step 1: register the subname */
    await fetch(`${NAMESPACE_API}/subnames`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        label,
        parent: AUDIT_PARENT,
      }),
    });

    /* Step 2: write text records */
    const records: Record<string, string> = {
      "task.id": audit.taskId,
      "task.participants": audit.participants.join(","),
      "task.outcome": audit.outcome,
      "task.completed_at": audit.completedAt,
    };
    if (audit.riskScore !== undefined) {
      records["task.risk_score"] = String(audit.riskScore);
    }
    if (audit.riskDecision) {
      records["task.risk_decision"] = audit.riskDecision;
    }
    if (audit.txHash) {
      records["task.tx_hash"] = audit.txHash;
    }
    if (audit.workflowRunId) {
      records["task.workflow_run"] = audit.workflowRunId;
    }

    await fetch(`${NAMESPACE_API}/subnames/${subname}/text-records`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ records }),
    });

    console.log(`[ENS] Audit subname minted: ${subname}`);
    return subname;
  } catch (err) {
    console.error("[ENS] audit subname mint failed:", err);
    return null;
  }
}
