export type WorkflowRunRequest = {
  workflowId: string;
  inputs?: Record<string, unknown>;
};

export type WorkflowRunStatus =
  | "queued"
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type WorkflowRun = {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  chain: string;
  createdAt: string;
  updatedAt: string;
  logs: string[];
  errorMessage?: string;
};
