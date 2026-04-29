import { z } from "zod";

/* ============================================================================
 * Agent — an ENS-identified AI service running its own AXL node.
 * ============================================================================ */

export const AgentRoleSchema = z.enum(["researcher", "evaluator", "executor"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentCapabilitySchema = z.enum([
  "research",
  "analysis",
  "risk",
  "execution",
  "monitoring",
]);
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const AgentSchema = z.object({
  ensName: z.string(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  description: z.string(),
  role: AgentRoleSchema,
  capabilities: z.array(AgentCapabilitySchema),
  skills: z.array(z.string()),
  axlPeerId: z.string(),
  axlEndpoint: z.string().url(),
  pricePerTaskUsdc: z.number().nonnegative().default(0),
  model: z.string().default("claude-opus-4-7"),
  attestation: z.string().optional(),
  online: z.boolean().default(true),
});
export type Agent = z.infer<typeof AgentSchema>;

/* ============================================================================
 * Task — the unit of work submitted by a user.
 * ============================================================================ */

export const TaskCategorySchema = z.enum([
  "research",
  "risk-analysis",
  "wallet-monitoring",
  "execution-request",
]);
export type TaskCategory = z.infer<typeof TaskCategorySchema>;

export const TaskStatusSchema = z.enum([
  "submitted",
  "discovering",
  "coordinating",
  "execution-pending",
  "execution-complete",
  "failed",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(4),
  prompt: z.string().min(8),
  category: TaskCategorySchema,
  status: TaskStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  participants: z.array(z.string()).default([]), // ENS names
  riskScore: z.number().min(0).max(10).optional(),
  riskDecision: z.enum(["approved", "rejected"]).optional(),
  executionTxHash: z.string().optional(),
  executionWorkflowRun: z.string().optional(),
  auditSubname: z.string().optional(),
  finalSummary: z.string().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskCreateInputSchema = z.object({
  title: z.string().min(4).max(120),
  prompt: z.string().min(8).max(2000),
  category: TaskCategorySchema,
});
export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>;

/* ============================================================================
 * Coordination events — every message that flows over AXL between agents,
 * captured for the live timeline UI.
 * ============================================================================ */

export const CoordinationEventTypeSchema = z.enum([
  "task.submitted",
  "discovery.completed",
  "axl.send",
  "axl.recv",
  "skill.invoked",
  "skill.responded",
  "ens.authorized",
  "execution.requested",
  "execution.confirmed",
  "execution.failed",
  "audit.minted",
  "task.completed",
]);
export type CoordinationEventType = z.infer<typeof CoordinationEventTypeSchema>;

export const CoordinationEventSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  type: CoordinationEventTypeSchema,
  fromEns: z.string().optional(),
  toEns: z.string().optional(),
  fromPeerId: z.string().optional(),
  toPeerId: z.string().optional(),
  skill: z.string().optional(),
  payloadPreview: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
  layer: z.enum(["ens", "gensyn", "keeperhub", "system"]).default("gensyn"),
});
export type CoordinationEvent = z.infer<typeof CoordinationEventSchema>;

/* ============================================================================
 * Execution result — KeeperHub workflow outcome
 * ============================================================================ */

export const ExecutionStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const ExecutionResultSchema = z.object({
  taskId: z.string(),
  workflowId: z.string(),
  workflowRunId: z.string(),
  status: ExecutionStatusSchema,
  txHash: z.string().optional(),
  blockNumber: z.number().optional(),
  gasUsed: z.string().optional(),
  chain: z.string().default("base-sepolia"),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  logs: z.array(z.string()).default([]),
  errorMessage: z.string().optional(),
});
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

/* ============================================================================
 * AXL topology snapshot — surfaced from GET /topology
 * ============================================================================ */

export const TopologyPeerSchema = z.object({
  peerId: z.string(),
  ensName: z.string().optional(),
  hops: z.number().int().nonnegative(),
  reachable: z.boolean(),
  lastSeen: z.string().optional(),
});
export type TopologyPeer = z.infer<typeof TopologyPeerSchema>;

export const TopologySnapshotSchema = z.object({
  selfPeerId: z.string(),
  peers: z.array(TopologyPeerSchema),
  takenAt: z.string(),
});
export type TopologySnapshot = z.infer<typeof TopologySnapshotSchema>;
