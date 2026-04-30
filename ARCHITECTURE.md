# AgentMesh — Architecture

## System overview

AgentMesh is a three-layer coordination network. Each layer is owned by a different protocol, and each protocol is non-substitutable — remove any one of them and a core capability disappears.

```
┌──────────────────────────────────────────────────────────────┐
│                   ENS — Identity & Policy                    │
│  agent discovery · capability matching · access control      │
│  per-task audit registry · reverse peer-id resolution        │
└──────────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────────┐
│              Gensyn AXL — Decentralized Transport            │
│  4 Go binaries · ed25519 mesh · A2A protocol (encrypted P2P) │
│  orchestrator → research-alpha → risk-sentinel → exec-node   │
└──────────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────────┐
│              KeeperHub — Onchain Execution                   │
│  REST workflow trigger · Turnkey signer · Base Sepolia       │
│  tx hash extracted from /logs · written to ENS audit subname │
└──────────────────────────────────────────────────────────────┘
```

---

## Process topology

```
┌──────────────────────────────────────────────────┐
│  Next.js 15  (orchestrator + UI)                  │
│  AXL node #1  ·  peer d0188180…                  │
│  port :3000 (web)  ·  port :9002 (AXL HTTP)      │
└────────────────────────┬─────────────────────────┘
                         │  Gensyn AXL encrypted mesh (Yggdrasil)
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌────────────────┐ ┌─────────────┐ ┌────────────────┐
│ research-alpha │ │risk-sentinel│ │ execution-node │
│ AXL node #2    │ │ AXL node #3 │ │ AXL node #4    │
│ :8003 (agent)  │ │:8004 (agent)│ │ :8005 (agent)  │
│ :9003 (AXL)    │ │ :9004 (AXL) │ │ :9005 (AXL)    │
│ peer d4ce9a1c… │ │ peer e68bc3…│ │ peer 6c209cf2… │
└────────────────┘ └─────────────┘ └───────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │  KeeperHub API  │
                                  │  Base Sepolia   │
                                  └─────────────────┘
```

Each box is a separate OS process with its own ed25519 keypair. There is no shared memory, no shared process, no central broker.

---

## Task pipeline (end to end)

```
1. User → POST /api/tasks
   ├── orchestrator creates task record in memory
   └── pipeline FSM starts

2. ENS discovery
   ├── Namespace SDK: getFilteredSubnames("agentbazaar.eth")
   ├── reads text records: agent.role, agent.capabilities, axl.peer_id
   └── builds candidate agent list — no hardcoded addresses

3. orchestrator →[AXL A2A]→ research-alpha
   ├── POST /a2a/{peer_id}  (real TCP, Yggdrasil mesh, encrypted)
   ├── research-alpha runs Claude Opus 4.7: analyze_token()
   └── returns structured market findings

4. orchestrator →[AXL A2A]→ risk-sentinel
   ├── forwarded findings from step 3
   ├── risk-sentinel runs Claude Opus 4.7: score_risk()
   └── returns { score: 0–10, approved: bool, rationale }

5. if approved (score ≥ 6):
   orchestrator →[AXL A2A]→ execution-node
   ├── ENS auth check: resolves calling peer → checks agent.role = "evaluator"
   ├── POST /api/workflow/{workflowId}/execute  (KeeperHub)
   ├── poll GET /api/workflows/executions/{id}/logs until terminal
   └── extracts transactionHash from Transfer ERC20 node output

6. SSE stream → UI coordination timeline
   └── every event tagged with ENS name resolved from peer ID

7. on completion: mint task-{id}.agentbazaar.eth
   └── Namespace SDK: createSubname / updateSubname
       text records: participants, risk_score, keeperhub_execution_id,
                     tx_hash, outcome, timestamps
```

---

## ENS layer

ENS is not cosmetic — it is the system's policy engine.

### Agent discovery

The orchestrator has zero hardcoded agent addresses. On every task it calls the Namespace SDK, reads `*.agentbazaar.eth` subnames, and builds the agent list from their text records:

| Text record | Example | Purpose |
|---|---|---|
| `agent.role` | `evaluator` | access control gate |
| `agent.capabilities` | `risk,analysis` | capability matching |
| `axl.peer_id` | `e68bc383aca3…` | AXL routing target |
| `agent.model` | `claude-opus-4-7` | model identity |
| `agent.price` | `0.40` | per-task fee |
| `agent.attestation` | `0xdef456…` | self-attestation hash |

### Policy-by-ENS

Before `execution-node` triggers KeeperHub, it resolves the calling peer's ENS subname and checks that `agent.role = evaluator`. No matching text record → no execution. Authorization is derived from ENS at runtime, not from a config file. Edit the text record → capability revoked instantly, no redeployment.

### Per-task audit subnames

Every completed task mints `task-{id}.agentbazaar.eth` off-chain via Namespace. Text records carry the full coordination ledger:

```
task-e4wkika.agentbazaar.eth
  participants    = research-alpha.agentbazaar.eth, risk-sentinel.agentbazaar.eth, execution-node.agentbazaar.eth
  risk_score      = 7.2
  outcome         = approved
  keeperhub_id    = ex_abc123
  tx_hash         = 0x95b80216f0f3…ecdb316d
  completed_at    = 2026-04-29T11:42:07Z
```

ENS becomes a queryable, durable audit registry — every coordination run is verifiable by anyone with a standard ENS resolver.

### Reverse resolution

Every peer ID in the live coordination timeline is resolved to its ENS name. Users and judges never see raw hex.

---

## Gensyn AXL layer

Four AXL Go binaries form a Yggdrasil overlay mesh. Each has a unique ed25519 keypair and communicates via the A2A protocol over real encrypted TCP connections.

### Node configuration

| Node | AXL port | Agent port | Peer ID (prefix) |
|---|---|---|---|
| orchestrator | 9002 | — (embedded in Next.js) | d0188180… |
| research-alpha | 9003 | 8003 | d4ce9a1c… |
| risk-sentinel | 9004 | 8004 | e68bc383… |
| execution-node | 9005 | 8005 | 6c209cf2… |

Bootstrap peers: 2 Gensyn public bootstrap nodes (configured in each node JSON).

### A2A message flow

```
orchestrator  POST /a2a/{research_peer_id}   (node :9002 → node :9003)
              ↓
research-alpha  POST /a2a/{risk_peer_id}     (node :9003 → node :9004)
              ↓
risk-sentinel  POST /a2a/{exec_peer_id}      (node :9004 → node :9005)
              ↓
execution-node  [KeeperHub trigger]
```

Each arrow is a real encrypted TCP connection routed across the Yggdrasil mesh. The orchestrator never proxies or short-circuits — all three inter-agent hops traverse the mesh.

### Upstream patches applied

Two bugs in the AXL source were found and fixed during this build:

1. **`applyOverrides` in `cmd/node/config.go`** — missing `A2APort` case. All nodes silently defaulted to the same port.
2. **TCP read deadline in `api/a2a.go` and HTTP client timeout in `internal/a2a/a2a_stream.go`** — 30s was too short for KeeperHub polling loops. Extended to 120s.

Both patches are in `axl/source/`.

---

## KeeperHub layer

KeeperHub handles settlement. No KeeperHub → no onchain transaction → task cannot complete.

### Execution flow

```typescript
// 1. trigger
const triggered = await POST /api/workflow/{workflowId}/execute
                         { inputs: { task_id, risk_score } }

// 2. poll until terminal
while (status !== "completed" && status !== "failed") {
  await sleep(3000);
  status = GET /api/workflows/executions/{id}
}

// 3. extract txHash from logs (not available on status endpoint)
const logs = GET /api/workflows/executions/{id}/logs
const txHash = logs
  .find(n => n.output?.transactionHash)
  ?.output.transactionHash
```

### What the workflow does

The `7zde3uktt1ewt8ggelh29` workflow runs a **Transfer ERC20 Token** node on Base Sepolia using KeeperHub's Turnkey-secured signer. Gas per execution: ~45,059 units.

### KeeperHub in the ENS audit trail

The execution ID and tx hash are written into the task's ENS audit subname text records, linking every on-chain settlement to the coordination run that triggered it.

---

## Source layout

```
app/
├── dashboard/          Task submission form
├── agents/             ENS-driven agent registry (zero hardcoded data)
├── tasks/              Task list + [id] coordination timeline
└── api/                REST endpoints, SSE stream

agents/
├── shared/             AgentRunner base, ENS auth (policy-by-ENS)
├── research-alpha/     analyze_token skill
├── risk-sentinel/      score_risk skill
└── execution-node/     execute_intent → KeeperHub

lib/
├── ens/                Namespace SDK, discovery, audit subname minting
├── axl/                AXL A2A HTTP client
├── keeperhub/          REST client, /logs polling for txHash
└── orchestrator/       Task pipeline FSM (no simulation fallback)

axl/
├── source/             Patched AXL Go source
└── nodes/              Per-node JSON configs (a2a_addr, a2a_port, peers)

scripts/
├── start-axl.sh        Boot all 4 AXL nodes
├── start-agents.sh     Boot research-alpha, risk-sentinel, execution-node
└── verify-topology.sh  Confirm all 4 peer IDs visible in GET /topology
```
