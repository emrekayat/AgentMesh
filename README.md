# Agent Bazaar

An ENS-powered marketplace of capability-tagged AI agents that discover each other via subname text records, coordinate as separate AXL mesh nodes over Gensyn's encrypted P2P network, and settle execution onchain through KeeperHub workflows — with each completed task minting an audit-trail subname.

Built for ETHGlobal OpenAgents hackathon (2026).

---

## How each protocol powers a layer

### ENS — identity, discovery, and authorization

Every agent owns a subname under `agentbazaar.eth` (e.g., `research-alpha.agentbazaar.eth`). Discovery is ENS-driven: the orchestrator queries the Namespace API for all `*.agentbazaar.eth` subnames and reads their text records to understand capabilities.

Key text records:
| Record | Purpose |
|---|---|
| `agent.capabilities` | `research,analysis` — drives task routing |
| `agent.role` | `researcher / evaluator / executor` — used for authorization |
| `agent.skills` | JSON array of A2A skill names |
| `axl.peer_id` | Ed25519 peer ID for AXL mesh routing |
| `agent.model` | `claude-opus-4-7` |

**Creative use — policy-by-ENS authorization:** `execution-node` will only trigger KeeperHub if the calling agent's ENS subname has `agent.role=evaluator`. Revoke the role by editing one text record — no code change required.

**Creative use — audit subnames:** On task completion, `task-{shortId}.tasks.agentbazaar.eth` is minted with text records carrying the full audit trail (participant ENS names, KeeperHub tx hash, risk score, timestamps). ENS becomes a queryable, durable audit registry of all agent activity.

### Gensyn AXL — encrypted P2P inter-agent communication

Four separate AXL Go nodes (ed25519 identities, mesh routing) form the transport layer:

```
orchestrator (9002) ─── research-alpha (9003)
                    └── risk-sentinel  (9004)
                    └── execution-node (9005)
```

All inter-agent messages travel exclusively over AXL using the A2A protocol (`POST /a2a/{peer_id}`). The orchestrator never proxies — it fires the first AXL message, then `research-alpha → risk-sentinel → execution-node` chain themselves over the mesh. Remove any AXL node and the corresponding agent becomes unreachable.

### KeeperHub — reliable onchain execution

When `execution-node` receives an approved task from `risk-sentinel` via AXL, it:
1. Verifies ENS authorization (policy-by-ENS)
2. Calls `POST /workflows/{id}/runs` on the KeeperHub REST API
3. Polls until terminal state
4. Returns tx hash + block number + gas used

KeeperHub handles Turnkey wallet management and Base Sepolia submission. The demo falls back to a realistic simulation when `KEEPERHUB_API_KEY` is not set.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Next.js 16 App                     │
│  Dashboard · Agents · Task timeline · SSE feed  │
│  AXL orchestrator node :9002                    │
└─────────────────┬───────────────────────────────┘
                  │ AXL mesh (ed25519, encrypted)
     ┌────────────┼────────────┐
     ▼            ▼            ▼
research-alpha  risk-sentinel  execution-node
:9003 / :8003   :9004 / :8004  :9005 / :8005
Claude Opus 4.7 Claude Opus 4.7 → KeeperHub REST
                                  → Base Sepolia
```

---

## Getting started

### Prerequisites

- Node.js 22+, pnpm 9+
- Go 1.25.5 (auto-downloaded via `GOTOOLCHAIN=auto`)
- AXL binary: `cd axl && GOTOOLCHAIN=auto make build`

### Environment

Copy `.env.example` to `.env.local` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
NAMESPACE_API_KEY=...          # from namespace.ninja
KEEPERHUB_API_KEY=...          # optional — simulation runs without it
KEEPERHUB_WORKFLOW_ID=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run the full stack

```bash
# Terminal 1: AXL mesh (4 nodes)
bash scripts/start-axl.sh

# Terminal 2: 3 agent processes
bash scripts/start-agents.sh

# Terminal 3: Next.js app
pnpm dev
```

Then open `http://localhost:3000`, navigate to Dashboard, submit a task, and watch the coordination timeline populate in real time.

### Seed ENS subnames (run once)

```bash
pnpm ens:seed
```

Creates `research-alpha.agentbazaar.eth`, `risk-sentinel.agentbazaar.eth`, `execution-node.agentbazaar.eth` with all text records via the Namespace API.

---

## Project structure

```
app/              Next.js 16 App Router
agents/           research-alpha, risk-sentinel, execution-node
  shared/         AgentRunner base, ENS auth, env
axl/              AXL Go node configs and keys
lib/
  ens/            registry, text-records, reverse, audit
  axl/            HTTP client, topology
  keeperhub/      REST client + types
  orchestrator/   Task pipeline FSM
  events/         In-process pub/sub + SSE helpers
  llm/            Claude Opus 4.7 wrapper
scripts/          seed-ens, start-axl, start-agents, verify-topology
docs/             Architecture, demo script, KeeperHub feedback
```

---

## Sponsor tracks

| Track | What we built |
|---|---|
| ENS Best AI Agent Integration | ENS subnames + text records drive all discovery, routing, and capability matching — zero hardcoded agent addresses |
| ENS Most Creative Use | Policy-by-ENS authorization (revoke executor role by editing a text record); per-task audit subnames turn ENS into an agent activity ledger |
| Gensyn Best AXL Application | 4 real AXL nodes (Go binary, ed25519, mesh); all inter-agent communication uses A2A protocol; topology widget shows live mesh state |
| KeeperHub Best Use | Real KeeperHub REST API in the critical execution path; simulation fallback with realistic tx data; builder feedback in `docs/KEEPERHUB_FEEDBACK.md` |
| KeeperHub Builder Feedback Bounty | `docs/KEEPERHUB_FEEDBACK.md` — 7 concrete items with reproduction steps and suggestions |
