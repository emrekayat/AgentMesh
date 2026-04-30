# KeeperHub Builder Feedback

Submitted by: Agent Bazaar / AgentMesh (ETHGlobal OpenAgents 2026)
Build dates: 2026-04-28 → 2026-04-30
Contact: crazyyyidea@gmail.com
Workflow ID used: `7zde3uktt1ewt8ggelh29` (Transfer ERC20 Token, Base Sepolia)

---

## Integration context

AgentMesh is a multi-agent coordination network. Four AI agents run as separate processes on the Gensyn AXL mesh. KeeperHub is the **critical path for onchain execution** — when `risk-sentinel` approves a task (risk score ≥ 6), `execution-node` fires a KeeperHub workflow and the system only completes if a real Base Sepolia tx confirms. No KeeperHub, no settlement. This gave us unusually deep exposure to the API under actual conditions.

Integration lives in `lib/keeperhub/client.ts` and `agents/execution-node/`.

Total workflow executions during build: ~18 (including test runs)
Successful onchain transfers: ~14 · Average gas: 45,059 units · Avg time to confirmation: 12–18s

---

## Feedback items (priority order)

### 1. `transactionHash` only exists in `/logs` — and `/logs` is entirely undocumented

`GET /api/workflows/executions/{id}` returns `status`, `startedAt`, `completedAt`, `inputs` — but **no `transactionHash`**, even after a successful ERC20 transfer. The tx hash only appears in a completely undocumented endpoint:

```
GET /api/workflows/executions/{id}/logs
```

That endpoint isn't listed anywhere in the public API reference. We found it by inspecting XHR traffic in the KeeperHub dashboard. Inside the logs array, the Transfer ERC20 Token node emits:

```json
{
  "nodeId": "transfer_erc20",
  "status": "completed",
  "output": {
    "transactionHash": "0x95b80216f0f3...ecdb316d",
    "gasUsed": "45059"
  }
}
```

**Impact:** High. Every integration that wants to surface a BaseScan link, write an audit record, or confirm onchain settlement will hit this wall. We spent ~2 hours discovering it. Any builder who only reads the docs will never find the tx hash.

**Ask:** Add `transactionHash` to the top-level execution status response, and document `/logs` with its full response schema, which node types emit `transactionHash`, and pagination behavior.

---

### 2. Top-level `status: "completed"` does not reflect node-level errors

We observed runs where the top-level execution status is `"completed"` but a transfer node inside has `status: "error"` and no `transactionHash`. The calling code sees success, attempts to extract the hash, gets `undefined`, and the downstream agent silently writes `tx: undefined` to the audit record.

**Ask:** Either propagate node errors to the top-level status (return `"failed"` if any critical node errored), or add a top-level `nodeErrors` array so callers don't have to walk the log entries to discover the failure.

---

### 3. MCP `execute_workflow` tool doesn't return `executionId`

We initially tried the KeeperHub MCP server before switching to REST. The `execute_workflow` MCP tool returns a success/fail signal but not the execution ID — making it impossible to poll for the tx hash afterward.

**Impact:** Medium. Forces builders off MCP onto raw REST if they need the tx hash, which is almost always.

**Ask:** Return `executionId` in the `execute_workflow` MCP tool response.

---

### 4. `inputs` only accepts flat string values — no nested JSON

`POST /api/workflow/{workflowId}/execute` accepts `inputs` as a flat string-keyed map. There is no way to pass nested objects. We wanted to forward the full risk assessment payload as structured data; instead we had to `JSON.stringify()` it into a single string field and parse it again inside the workflow.

**Ask:** Support arbitrary JSON values in `inputs`, or document the intended pattern for passing structured data.

---

### 5. `401`/`403` errors don't identify the missing scope

When an API key lacks permission, the response body is a generic message with no indication of which scope is required.

**Ask:** Include the required scope in the error body:
```json
{ "error": "Forbidden", "requiredScope": "workflow:execute" }
```

Document which scopes each endpoint requires. We hit a `401` on a workflow we had just created and couldn't tell if it was a key scope issue, wrong endpoint, or a propagation delay.

---

### 6. No polling guidance, no `Retry-After` header

We poll `GET /api/workflows/executions/{id}` every 3 seconds. We don't know if this is too aggressive (rate limiting risk) or too conservative. The status endpoint returns no `Retry-After` or `X-Poll-Interval` header.

**Ask:** Document the recommended polling interval. Better: implement a `callback_url` field on the execute request body so server-side agents can receive a push notification instead of polling.

---

### 7. No sandbox / test mode

Development requires a real API key, a deployed workflow, and a funded Turnkey wallet. There is no mock or dry-run mode. For hackathon teams this means the first integration attempt costs gas and hits production infrastructure.

**Ask:** A `X-KeeperHub-Simulate: true` request header that returns a realistic mock execution response (with a fake tx hash in the `/logs` output) would significantly lower the onboarding friction and let builders test their parsing logic before connecting a real wallet.

---

### 8. x402 / MPP integration has no code example

The Focus Area 2 description mentions "x402 payment rails" but the docs contain no working example of the x402 handshake for KeeperHub specifically. The generic x402 spec doesn't cover KeeperHub's header format.

**Ask:** A minimal curl + Node.js example showing the x402 payment header required to call a KeeperHub endpoint. This is a blocker for any team targeting Focus Area 2.

---

## What worked well

- REST API design is clean and predictable — trigger + poll is easy to wrap in a typed client.
- Turnkey wallet abstraction means agents don't manage private keys — this is the single biggest friction reduction for agentic workflows.
- Base Sepolia support: free gas, reliable RPC, fast confirmations. Right choice for hackathon demos.
- `/execute` endpoint response is fast (< 500ms to return an execution ID).
- Per-node log output in `/logs` is the right shape for AI agents — lets the agent explain exactly what happened to the user.
- Multi-chain routing works. We stayed on Base Sepolia throughout with zero RPC issues.

---

## Summary ask (priority order)

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | Add `transactionHash` to execution status + document `/logs` | Low | High |
| 2 | Fix top-level status to reflect node-level errors | Medium | Medium |
| 3 | Return `executionId` from MCP `execute_workflow` | Low | Medium |
| 4 | Support nested JSON in `inputs` | Medium | Medium |
| 5 | Add scope hint to 401/403 error bodies | Low | Low |
| 6 | Add `Retry-After` header or webhook callback | Medium | Low |
| 7 | Add simulate/dry-run mode | High | Medium |
| 8 | Add x402 code example | Low | Medium |
