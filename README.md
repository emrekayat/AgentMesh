# AgentMesh

<p align="center">
  <img src="./public/AgentMesh.jpg" alt="AgentMesh" width="160" />
</p>

> An ENS-powered marketplace where AI agents discover each other, coordinate over Gensyn's encrypted P2P mesh, and settle onchain through KeeperHub — with every completed task minting a permanent audit trail in ENS.

Built for **ETHGlobal OpenAgents** · Base Sepolia · April 2026

---

## What It Does

You submit a task ("analyze this token and execute a swap if risk is acceptable"). Four AI agents — each running as a separate process on the Gensyn AXL mesh — pick it up, pass findings between each other over encrypted P2P channels, and trigger a KeeperHub workflow that executes a real onchain transaction. Every step is logged to an ENS subname that anyone can resolve and verify.

No central broker. No shared memory. No simulation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Next.js 15  (orchestrator + UI)             │
│              AXL node #1 · peer d0188180…               │
└──────────────────────────┬──────────────────────────────┘
                           │  Gensyn AXL mesh (encrypted P2P)
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ research-alpha│  │ risk-sentinel │  │execution-node │
│ AXL node #2   │  │ AXL node #3   │  │ AXL node #4   │
│ d4ce9a1c…     │  │ e68bc383…     │  │ 6c209cf2…     │
└───────────────┘  └───────────────┘  └───────────────┘
                                              │
                                     ┌────────▼────────┐
                                     │  KeeperHub API  │
                                     │  Base Sepolia   │
                                     └─────────────────┘
```

Each node is a separate OS process with its own ed25519 identity. Communication happens exclusively over the AXL A2A protocol — the orchestrator never proxies or shortcuts.

---

## How Each Protocol Powers a Layer

### ENS — Identity, Discovery, Authorization, and Audit

ENS is not a lookup table bolted on at the end. It is the system's policy engine.

**Agent discovery** — The orchestrator has zero hardcoded agent addresses. On every task it calls the Namespace SDK, reads `*.agentbazaar.eth` subnames, and builds the agent list from their text records:

| Text record | Example value |
|---|---|
| `agent.role` | `evaluator` |
| `agent.capabilities` | `risk,analysis` |
| `axl.peer_id` | `e68bc383aca3…` |
| `agent.model` | `claude-opus-4-7` |
| `agent.price` | `0.40` |
| `agent.attestation` | `0xdef456…` |

**Policy-by-ENS** — Before `execution-node` triggers KeeperHub, it resolves the calling peer's ENS subname and checks that `agent.role = evaluator`. No text record, no execution. Authorization is derived from ENS, not a config file — change the record to instantly revoke an agent's executor privilege.

**Per-task audit subnames** — Every completed task mints `task-{id}.agentbazaar.eth` off-chain via Namespace with text records carrying the full coordination ledger: participant ENS names, KeeperHub execution ID, txHash, risk score, outcome, timestamps. ENS becomes a queryable, permanent audit registry.

**Reverse resolution** — Every peer ID in the live coordination timeline is resolved to its ENS name. Judges never see raw hex.

### Gensyn AXL — Decentralized Agent Coordination

Four AXL Go binaries, each with a unique ed25519 keypair, forming a Yggdrasil overlay mesh. No shared process, no shared memory.

The pipeline:

```
orchestrator →[AXL A2A]→ research-alpha →[AXL A2A]→ risk-sentinel →[AXL A2A]→ execution-node
```

Each arrow is a real TCP connection over the Yggdrasil mesh, encrypted end-to-end, routed by peer ID. The UI's topology widget shows live peer connections pulled directly from `GET /topology`.

**What "real AXL" means here:**
- Each node has a distinct `our_public_key` visible in `GET /topology`
- Messages are routed across the encrypted mesh, not proxied through localhost HTTP
- Kill any node mid-run — the UI surfaces the routing failure in real time

**Upstream fixes** — Two bugs in the AXL source were found and patched during this build:
1. `applyOverrides` in `cmd/node/config.go` was missing the A2APort case — all nodes silently defaulted to the same port
2. The 30s TCP read deadline in `api/a2a.go` and HTTP client timeout in `internal/a2a/a2a_stream.go` were too short for KeeperHub polling — extended to 120s

### KeeperHub — Onchain Execution

When `risk-sentinel` approves (score ≥ 6), `execution-node` calls KeeperHub's workflow API. The workflow runs a **Transfer ERC20 Token** node on Base Sepolia using KeeperHub's Turnkey-secured signer.

- Trigger: `POST /api/workflow/{workflowId}/execute`
- Result: `GET /api/workflows/executions/{id}/logs` — node-level output including `transactionHash`
- Gas used: ~45,059 units per execution

Every txHash appears in the UI and is written to the task's ENS audit subname.

---

## Task Flow (End to End)

```
1. User submits task via /dashboard
2. Orchestrator queries ENS (Namespace SDK) → discovers 3 agents by capability
3. orchestrator →[AXL]→ research-alpha: analyze_token()
   └ Claude claude-opus-4-7 produces structured market findings
4. orchestrator →[AXL]→ risk-sentinel: score_risk()
   └ Scores 0–10, returns go/no-go with rationale
5. If approved (score ≥ 6):
   orchestrator →[AXL]→ execution-node: execute_intent()
   └ Verifies calling peer's ENS role = "evaluator"
   └ Calls KeeperHub → real Base Sepolia transaction
6. Events stream via SSE → live coordination timeline in UI
7. On completion: task-{id}.agentbazaar.eth minted with full audit trail
```

---

## Live Proof

| Signal | Value |
|---|---|
| ENS parent | `agentbazaar.eth` (Namespace off-chain) |
| Agent subnames | `research-alpha`, `risk-sentinel`, `execution-node` under `agentbazaar.eth` |
| AXL nodes | 4 local nodes + 2 Gensyn bootstrap peers, all `up: true` |
| KeeperHub workflow | `7zde3uktt1ewt8ggelh29` — Eth Swap Demo |
| Sample txHash | `0x95b80216f0f3…ecdb316d` (Base Sepolia) |
| Sample audit subname | `task-e4wkika.agentbazaar.eth` |

---

## Deployment

### Production (live)

| Service | Platform | URL |
|---|---|---|
| Frontend + UI | Vercel | agent-mesh-snowy.vercel.app |
| Pipeline backend | Render | agentmesh-lvmd.onrender.com |

The pipeline backend (Express + Node.js) runs on Render. Vercel Next.js API routes proxy all task and SSE requests to it. This separates the long-running pipeline (60–120s) from Vercel's serverless function timeout.

**Vercel env var required:** `BACKEND_URL=https://agentmesh-lvmd.onrender.com`

### Fallback mode (no AXL mesh)

When AXL nodes are unavailable, the pipeline falls back to direct skill invocation — same LLM (Groq), same KeeperHub workflow, same ENS audit. Only the P2P transport layer is bypassed. The UI labels this clearly in the coordination timeline.

---

## Running Locally

### Prerequisites

- Node.js 20+, pnpm
- Go 1.22+ (to build AXL — optional)
- API keys: `GROQ_API_KEY`, `KEEPERHUB_API_KEY`, `NAMESPACE_API_KEY`

### 1. Backend server

```bash
cp .env .env.local   # fill in API keys
pnpm server:dev      # Express backend on :4000
```

### 2. (Optional) AXL mesh

```bash
cd axl/source && make build && cd ../..
bash scripts/start-axl.sh        # boots nodes on :9002–:9005
bash scripts/verify-topology.sh  # all 4 peer IDs visible
bash scripts/start-agents.sh     # agent processes on :8003–:8005
```

### 3. Web app

```bash
pnpm dev    # localhost:3000 (proxies to localhost:4000 backend)
```

Go to `/dashboard`, submit a task, watch `/tasks/{id}` for the live pipeline.

---

## Project Structure

```
app/
├── dashboard/          Task submission form
├── agents/             ENS-driven agent registry
├── tasks/              Task list + [id] coordination timeline
└── api/                REST endpoints, SSE stream

agents/
├── shared/             AgentRunner, ENS auth (policy-by-ENS)
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
└── nodes/              Per-node JSON configs (a2a_addr, a2a_port)
```

---

## Sponsor Prize Positioning

### ENS — Best Integration for AI Agents

ENS subnames are the sole source of truth for agent discovery, capability matching, and access control. The orchestrator calls the Namespace SDK on every task — no cached list, no hardcoded addresses. `axl.peer_id`, `agent.role`, and `agent.capabilities` text records drive every routing and authorization decision. Remove ENS and the system has no agents.

### ENS — Most Creative Use

Two novel patterns working in production:

**Policy-by-ENS** — `agent.role = evaluator` in a text record is the only credential `execution-node` accepts before triggering KeeperHub. Edit the text record → capability instantly revoked across the entire mesh. No redeployment, no config change.

**ENS as audit registry** — `task-{id}.agentbazaar.eth` is minted on every completed coordination run. Its text records hold the full ledger: which agents participated, what the risk score was, which KeeperHub execution ran, and what the txHash is. Any resolver — ENS App, wagmi, viem — can query the audit trail of any task, forever.

### Gensyn — Best Application of AXL

Four AXL nodes with four distinct ed25519 identities form a live Yggdrasil mesh. All three inter-agent hops use the A2A protocol over real encrypted TCP connections. The topology widget shows live peer state from `GET /topology`. The upstream AXL source was patched to fix a real bug (missing A2APort override) discovered during integration — a level of depth that goes beyond surface-level usage.

### KeeperHub — Best Use

KeeperHub is in the critical path — no KeeperHub, no settlement. The integration goes beyond a single API call: it uses the `/logs` endpoint to extract txHash from the transfer node's output (not available on the status endpoint), surfaces gas consumed, and writes the execution ID into the ENS audit subname. Every run visible in the KeeperHub dashboard maps 1:1 to a real coordination event on the AXL mesh.

---

## Further Reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — deep-dive into the three-layer design: process topology, ENS policy engine, AXL message flow, KeeperHub execution path, and upstream patches applied to the AXL source.
- [`KEEPERHUB_FEEDBACK.md`](./KEEPERHUB_FEEDBACK.md) — builder feedback submitted to KeeperHub covering API gaps discovered during the integration (undocumented `/logs` endpoint, missing txHash on status, node-error propagation, and more).
