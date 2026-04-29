/**
 * KeeperHub REST API client.
 * Base URL: https://app.keeperhub.com/api
 * Auth: Bearer {kh_...} API key (org-scoped endpoints)
 * Response format: { data: { ... } } or { error: { code, message } }
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
      const msg = (body as { error?: { message?: string } })?.error?.message ?? text;
      throw new Error(`KeeperHub ${res.status}: ${msg}`);
    }

    // Unwrap { data: ... } envelope
    const data = (body as { data?: T })?.data;
    return (data ?? body) as T;
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

  /** Poll a workflow run until terminal state */
  async pollUntilDone(
    workflowId: string,
    runId: string,
    maxWaitMs = 120_000,
    intervalMs = 5_000
  ): Promise<WorkflowRun> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      try {
        const run = await this.getExecution(runId, workflowId);
        if (isTerminal(run.status)) return run;
      } catch {
        /* transient — keep polling */
      }
      await sleep(intervalMs);
    }
    throw new Error(`KeeperHub run ${runId} timed out after ${maxWaitMs}ms`);
  }

  /** Get execution by run ID — tries /executions/{id} then /workflow/{wfId}/runs/{id} */
  async getExecution(runId: string, workflowId?: string): Promise<WorkflowRun> {
    try {
      const raw = await this.request<Record<string, unknown>>(
        `/executions/${runId}`,
        { signal: AbortSignal.timeout(10000) }
      );
      return this.normalizeRun(raw, workflowId ?? "");
    } catch {
      if (!workflowId) throw new Error(`No execution found for ${runId}`);
      const raw = await this.request<Record<string, unknown>>(
        `/workflow/${workflowId}/runs/${runId}`,
        { signal: AbortSignal.timeout(10000) }
      );
      return this.normalizeRun(raw, workflowId);
    }
  }

  private normalizeRun(raw: Record<string, unknown>, workflowId: string): WorkflowRun {
    return {
      id: String(raw.id ?? raw.runId ?? raw.run_id ?? `run_${Date.now()}`),
      workflowId: String(raw.workflowId ?? raw.workflow_id ?? workflowId),
      status: String(raw.status ?? "running") as WorkflowRun["status"],
      txHash: (raw.txHash ?? raw.tx_hash ?? raw.transactionHash) as string | undefined,
      blockNumber: (raw.blockNumber ?? raw.block_number) as number | undefined,
      gasUsed: (raw.gasUsed ?? raw.gas_used) as string | undefined,
      chain: String(raw.chain ?? raw.chainId ?? "base-sepolia"),
      createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
      updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
      logs: (raw.logs as string[]) ?? [],
    };
  }
}

function isTerminal(status: string): boolean {
  return ["succeeded", "failed", "cancelled", "completed", "success", "error"].includes(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
