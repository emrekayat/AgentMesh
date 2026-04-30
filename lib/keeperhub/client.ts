/**
 * KeeperHub REST API client.
 * Base URL: https://app.keeperhub.com/api
 * Org API key (kh_): workflows, executions
 * Direct Execution: POST /api/execute/transfer — synchronous, returns tx hash immediately
 */
import type { WorkflowRun, WorkflowRunRequest } from "./types";

export class KeeperHubClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://app.keeperhub.com/api") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "X-API-Key": this.apiKey,
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers, ...(options?.headers ?? {}) },
    });

    const text = await res.text().catch(() => "");
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }

    if (!res.ok) {
      const msg = (body as { error?: string; message?: string })?.error
        ?? (body as { message?: string })?.message
        ?? `${res.status}`;
      throw new Error(`KeeperHub ${res.status}: ${msg}`);
    }

    // Unwrap { data: ... } envelope if present
    const wrapped = body as { data?: T };
    return (wrapped.data !== undefined ? wrapped.data : body) as T;
  }

  /**
   * Direct Execution: transfer tokens without a workflow.
   * Synchronous — returns completed/failed immediately with executionId.
   */
  async directTransfer(params: {
    network: string;
    recipientAddress: string;
    amount: string;
    tokenAddress?: string;
  }): Promise<{ executionId: string; status: string; transactionHash?: string }> {
    return this.request("/execute/transfer", {
      method: "POST",
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(60000),
    });
  }

  /** Get direct execution status (includes tx hash) */
  async getDirectExecutionStatus(executionId: string): Promise<{
    executionId: string;
    status: string;
    transactionHash?: string;
    transactionLink?: string;
    gasUsedWei?: string;
    error?: string;
    completedAt?: string;
  }> {
    return this.request(`/execute/${executionId}/status`, {
      signal: AbortSignal.timeout(10000),
    });
  }

  /** Trigger a workflow execution */
  async triggerWorkflow(req: WorkflowRunRequest): Promise<WorkflowRun> {
    const raw = await this.request<Record<string, unknown>>(
      `/workflow/${req.workflowId}/execute`,
      {
        method: "POST",
        body: JSON.stringify({ inputs: req.inputs ?? {} }),
        signal: AbortSignal.timeout(30000),
      }
    );
    return this.normalizeRun(raw, req.workflowId);
  }

  /** Poll using /logs endpoint which returns full node output including txHash */
  async pollUntilDone(
    workflowId: string,
    runId: string,
    maxWaitMs = 60_000,
    intervalMs = 4_000
  ): Promise<WorkflowRun> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      try {
        const logsResp = await this.getExecutionLogs(runId);
        const status = String(logsResp.execution?.status ?? "running");
        if (isTerminal(status)) {
          return this.normalizeFromLogs(logsResp, workflowId);
        }
      } catch {
        /* transient — keep polling */
      }
      await sleep(intervalMs);
    }
    throw new Error(`KeeperHub run ${runId} timed out after ${maxWaitMs}ms`);
  }

  /** GET /api/workflows/executions/{id}/logs — full execution + node logs */
  async getExecutionLogs(executionId: string): Promise<{
    execution: Record<string, unknown>;
    logs: Array<Record<string, unknown>>;
  }> {
    return this.request(`/workflows/executions/${executionId}/logs`, {
      signal: AbortSignal.timeout(10000),
    });
  }

  private normalizeFromLogs(
    resp: { execution: Record<string, unknown>; logs: Array<Record<string, unknown>> },
    workflowId: string
  ): WorkflowRun {
    const exec = resp.execution ?? {};
    /* Extract txHash from the transfer node's output */
    const transferLog = resp.logs?.find(
      (l) => String(l.nodeType ?? "").includes("transfer") || String(l.nodeName ?? "").toLowerCase().includes("transfer")
    );
    const nodeOutput = transferLog?.output as Record<string, unknown> | null | undefined;
    const txHash =
      (nodeOutput?.txHash ?? nodeOutput?.tx_hash ?? nodeOutput?.transactionHash ?? nodeOutput?.hash) as string | undefined;

    const logMessages = resp.logs?.map((l) => {
      const out = l.output as Record<string, unknown> | null | undefined;
      const err = l.error as string | null | undefined;
      if (err) return `${l.nodeName}: ERROR — ${err}`;
      if (out?.txHash) return `${l.nodeName}: tx ${String(out.txHash).slice(0, 16)}…`;
      return `${l.nodeName}: ${l.status}`;
    }) ?? [];

    return {
      id: String(exec.id ?? `run_${Date.now()}`),
      workflowId: String((exec.workflow as Record<string, unknown>)?.id ?? exec.workflowId ?? workflowId),
      status: String(exec.status ?? "running") as WorkflowRun["status"],
      txHash,
      gasUsed: nodeOutput?.gasUsedUnits ? String(nodeOutput.gasUsedUnits) : undefined,
      chain: "base-sepolia",
      createdAt: String(exec.startedAt ?? new Date().toISOString()),
      updatedAt: String(exec.completedAt ?? new Date().toISOString()),
      logs: logMessages,
    };
  }

  private normalizeRun(raw: Record<string, unknown>, workflowId: string): WorkflowRun {
    return {
      id: String(raw.id ?? raw.runId ?? raw.executionId ?? `run_${Date.now()}`),
      workflowId: String(raw.workflowId ?? workflowId),
      status: String(raw.status ?? "running") as WorkflowRun["status"],
      txHash: (raw.txHash ?? raw.tx_hash ?? raw.transactionHash) as string | undefined,
      blockNumber: (raw.blockNumber ?? raw.block_number) as number | undefined,
      gasUsed: (raw.gasUsedWei ?? raw.gasUsed ?? raw.gas_used) as string | undefined,
      chain: String(raw.chain ?? raw.network ?? "base-sepolia"),
      createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
      updatedAt: String(raw.updatedAt ?? raw.completedAt ?? new Date().toISOString()),
      logs: (raw.logs as string[]) ?? [],
    };
  }
}

function isTerminal(status: string): boolean {
  return ["success", "succeeded", "failed", "error", "cancelled", "completed"].includes(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
