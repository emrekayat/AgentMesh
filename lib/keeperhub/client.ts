/**
 * KeeperHub REST API client.
 *
 * Wraps the KeeperHub workflow execution endpoints:
 *   POST /workflows/{id}/runs  — trigger a workflow
 *   GET  /workflows/{id}/runs/{runId} — poll status
 */
import type { WorkflowRun, WorkflowRunRequest } from "./types";

export class KeeperHubClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.keeperhub.com/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /** Trigger a pre-registered workflow */
  async triggerWorkflow(req: WorkflowRunRequest): Promise<WorkflowRun> {
    const res = await fetch(
      `${this.baseUrl}/workflows/${req.workflowId}/runs`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ inputs: req.inputs ?? {} }),
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`KeeperHub trigger error ${res.status}: ${text}`);
    }
    return res.json();
  }

  /** Poll a workflow run until it reaches a terminal state */
  async pollUntilDone(
    workflowId: string,
    runId: string,
    maxWaitMs = 120_000,
    intervalMs = 3_000
  ): Promise<WorkflowRun> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const run = await this.getWorkflowRun(workflowId, runId);
      if (
        run.status === "succeeded" ||
        run.status === "failed" ||
        run.status === "cancelled"
      ) {
        return run;
      }
      await sleep(intervalMs);
    }
    throw new Error(`KeeperHub workflow run ${runId} timed out after ${maxWaitMs}ms`);
  }

  /** Get the current state of a workflow run */
  async getWorkflowRun(workflowId: string, runId: string): Promise<WorkflowRun> {
    const res = await fetch(
      `${this.baseUrl}/workflows/${workflowId}/runs/${runId}`,
      {
        headers: this.headers,
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`KeeperHub get run error ${res.status}: ${text}`);
    }
    return res.json();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
