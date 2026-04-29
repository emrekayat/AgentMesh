/**
 * Phase 1 mock data. Replaced by real ENS resolution + AXL events in Phase 2/3.
 * Kept around for the dev fallback path so the UI still works without the
 * agent stack running.
 */
import type {
  Agent,
  CoordinationEvent,
  ExecutionResult,
  Task,
  TopologySnapshot,
} from "@/lib/types";

export const MOCK_AGENTS: Agent[] = [
  {
    ensName: "research-alpha.agentbazaar.eth",
    address: "0x9aE4a5b71F0a1A6c6e9c4F2C6f4bC9c12BdE8C45",
    description:
      "Deep-context research agent. Aggregates onchain history, social signal, and protocol disclosures into structured findings.",
    role: "researcher",
    capabilities: ["research", "analysis"],
    skills: ["analyze_token", "gather_context"],
    axlPeerId: "d4ce9a1cd9a30c2d0c8c826e5f5921b3f17ea06adf3f9972a52f4d0bf622ce3d",
    axlEndpoint: "http://localhost:9003",
    pricePerTaskUsdc: 0.25,
    model: "claude-opus-4-7",
    attestation: "0xabc123…",
    online: true,
  },
  {
    ensName: "risk-sentinel.agentbazaar.eth",
    address: "0x4cF8b17deD3b0f12a8c9E7d6bA2d5c4b8E1aF92e",
    description:
      "Risk evaluator with explicit go/no-go output. Scores opportunities from 0–10 against a configurable risk policy.",
    role: "evaluator",
    capabilities: ["risk", "analysis"],
    skills: ["score_risk", "decide_go_no_go"],
    axlPeerId: "e68bc383aca31dceb8da5554426c7073595258e37db032b85ed07b4edc4b35af",
    axlEndpoint: "http://localhost:9004",
    pricePerTaskUsdc: 0.40,
    model: "claude-opus-4-7",
    attestation: "0xdef456…",
    online: true,
  },
  {
    ensName: "execution-node.agentbazaar.eth",
    address: "0x7bA3f5c1E9d6F2B4a8C9e1D3f5A7b9C2e4F6a8B0",
    description:
      "Authorized executor. Triggers KeeperHub workflows after verifying the upstream caller's ENS role text record.",
    role: "executor",
    capabilities: ["execution", "monitoring"],
    skills: ["execute_intent"],
    axlPeerId: "6c209cf219c2b7e3783c6a82acccc245cb95aa573b122ebc79cf23fd0bbc15a2",
    axlEndpoint: "http://localhost:9005",
    pricePerTaskUsdc: 0.10,
    model: "claude-opus-4-7",
    attestation: "0x789abc…",
    online: true,
  },
];

export const MOCK_TASK_DEMO: Task = {
  id: "demo",
  title: "ETH/USDC opportunity — execute small swap if risk acceptable",
  prompt:
    "Analyze the current ETH/USDC pair conditions on Base Sepolia. If your risk score is at least 6/10, execute a 0.05 ETH → USDC swap via KeeperHub. Otherwise, return the rationale.",
  category: "execution-request",
  status: "execution-complete",
  createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
  participants: [
    "research-alpha.agentbazaar.eth",
    "risk-sentinel.agentbazaar.eth",
    "execution-node.agentbazaar.eth",
  ],
  riskScore: 7.2,
  riskDecision: "approved",
  executionTxHash:
    "0x4d7c8b2a1e9f6c3d5b8a7f0c2d4e6f8a1b3c5d7e9f1a2b3c4d5e6f7a8b9c0d1e",
  executionWorkflowRun: "wfr_4Hk2NqLp",
  auditSubname: "task-demo01.tasks.agentbazaar.eth",
  finalSummary:
    "Executed 0.05 ETH → USDC swap on Base Sepolia. Risk score 7.2/10 cleared the policy threshold. Audit subname minted with full coordination trail.",
};

export const MOCK_EVENTS_DEMO: CoordinationEvent[] = [
  {
    id: "evt-01",
    taskId: "demo",
    type: "task.submitted",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    layer: "system",
    payloadPreview: "User submitted execution-request task",
  },
  {
    id: "evt-02",
    taskId: "demo",
    type: "discovery.completed",
    timestamp: new Date(Date.now() - 1000 * 60 * 7.6).toISOString(),
    layer: "ens",
    payloadPreview:
      "Resolved 3 candidates from *.agentbazaar.eth: research-alpha, risk-sentinel, execution-node",
  },
  {
    id: "evt-03",
    taskId: "demo",
    type: "axl.send",
    fromEns: "orchestrator.agentbazaar.eth",
    toEns: "research-alpha.agentbazaar.eth",
    fromPeerId: "axl_orch_2pA7…",
    toPeerId: "axl_2zqxR6yL…",
    skill: "analyze_token",
    timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    layer: "gensyn",
    payloadPreview: "POST /a2a/{peer} { skill: analyze_token, prompt: … }",
  },
  {
    id: "evt-04",
    taskId: "demo",
    type: "skill.responded",
    fromEns: "research-alpha.agentbazaar.eth",
    skill: "analyze_token",
    timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    layer: "gensyn",
    payloadPreview:
      "{ token: ETH, base: USDC, liquidity: deep, volatility_24h: 1.8%, sentiment: neutral }",
  },
  {
    id: "evt-05",
    taskId: "demo",
    type: "axl.send",
    fromEns: "research-alpha.agentbazaar.eth",
    toEns: "risk-sentinel.agentbazaar.eth",
    fromPeerId: "axl_2zqxR6yL…",
    toPeerId: "axl_8mNqK4rT…",
    skill: "score_risk",
    timestamp: new Date(Date.now() - 1000 * 60 * 5.5).toISOString(),
    layer: "gensyn",
    payloadPreview: "Forwarding research findings for risk scoring",
  },
  {
    id: "evt-06",
    taskId: "demo",
    type: "skill.responded",
    fromEns: "risk-sentinel.agentbazaar.eth",
    skill: "score_risk",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    layer: "gensyn",
    payloadPreview: "{ risk_score: 7.2, decision: approved, threshold: 6.0 }",
  },
  {
    id: "evt-07",
    taskId: "demo",
    type: "axl.send",
    fromEns: "risk-sentinel.agentbazaar.eth",
    toEns: "execution-node.agentbazaar.eth",
    fromPeerId: "axl_8mNqK4rT…",
    toPeerId: "axl_5pXyZ8cV…",
    skill: "execute_intent",
    timestamp: new Date(Date.now() - 1000 * 60 * 4.5).toISOString(),
    layer: "gensyn",
    payloadPreview: "Intent: swap 0.05 ETH → USDC on Base Sepolia",
  },
  {
    id: "evt-08",
    taskId: "demo",
    type: "ens.authorized",
    fromEns: "execution-node.agentbazaar.eth",
    timestamp: new Date(Date.now() - 1000 * 60 * 4.4).toISOString(),
    layer: "ens",
    payloadPreview:
      "ENS role check passed: risk-sentinel.agentbazaar.eth has agent.role=evaluator",
  },
  {
    id: "evt-09",
    taskId: "demo",
    type: "execution.requested",
    fromEns: "execution-node.agentbazaar.eth",
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    layer: "keeperhub",
    payloadPreview:
      "POST /workflows/wf_eth_swap_base_sepolia/runs { amount_in: 0.05 }",
  },
  {
    id: "evt-10",
    taskId: "demo",
    type: "execution.confirmed",
    fromEns: "execution-node.agentbazaar.eth",
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    layer: "keeperhub",
    payloadPreview: "tx 0x4d7c…0d1e mined in block 7,142,338",
  },
  {
    id: "evt-11",
    taskId: "demo",
    type: "audit.minted",
    timestamp: new Date(Date.now() - 1000 * 60 * 1.3).toISOString(),
    layer: "ens",
    payloadPreview:
      "task-demo01.tasks.agentbazaar.eth minted with audit text records",
  },
  {
    id: "evt-12",
    taskId: "demo",
    type: "task.completed",
    timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    layer: "system",
    payloadPreview: "Task completed end-to-end in 7m 0s",
  },
];

export const MOCK_EXECUTION_DEMO: ExecutionResult = {
  taskId: "demo",
  workflowId: "wf_eth_swap_base_sepolia",
  workflowRunId: "wfr_4Hk2NqLp",
  status: "succeeded",
  txHash:
    "0x4d7c8b2a1e9f6c3d5b8a7f0c2d4e6f8a1b3c5d7e9f1a2b3c4d5e6f7a8b9c0d1e",
  blockNumber: 7142338,
  gasUsed: "164,221",
  chain: "base-sepolia",
  startedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  completedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  logs: [
    "Workflow accepted: wf_eth_swap_base_sepolia",
    "Acquired Turnkey signer · enclave handshake ok",
    "Estimated gas: 168,400 · using policy: median + 10%",
    "Submitted tx via primary RPC (base-sepolia.base.org)",
    "Tx 0x4d7c…0d1e seen in mempool",
    "Mined in block 7,142,338 · 1 confirmation",
    "Workflow status → succeeded",
  ],
};

export const MOCK_TOPOLOGY: TopologySnapshot = {
  selfPeerId: "axl_orch_2pA7Q9rZyT4mK6jX3eF8wB1nD5oC0sLh",
  peers: [
    {
      peerId: "d4ce9a1cd9a30c2d0c8c826e5f5921b3f17ea06adf3f9972a52f4d0bf622ce3d",
      ensName: "research-alpha.agentbazaar.eth",
      hops: 1,
      reachable: true,
      lastSeen: new Date(Date.now() - 1000 * 5).toISOString(),
    },
    {
      peerId: "e68bc383aca31dceb8da5554426c7073595258e37db032b85ed07b4edc4b35af",
      ensName: "risk-sentinel.agentbazaar.eth",
      hops: 1,
      reachable: true,
      lastSeen: new Date(Date.now() - 1000 * 7).toISOString(),
    },
    {
      peerId: "6c209cf219c2b7e3783c6a82acccc245cb95aa573b122ebc79cf23fd0bbc15a2",
      ensName: "execution-node.agentbazaar.eth",
      hops: 1,
      reachable: true,
      lastSeen: new Date(Date.now() - 1000 * 3).toISOString(),
    },
  ],
  takenAt: new Date().toISOString(),
};
