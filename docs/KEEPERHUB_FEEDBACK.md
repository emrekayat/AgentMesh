# KeeperHub Builder Feedback

Feedback collected during the AgentMesh build (ETHGlobal OpenAgents hackathon, 2026-04-28/29).

## Integration context

AgentMesh is a multi-agent coordination network. KeeperHub is the onchain execution layer — when the `execution-node` AI agent receives an approved task from `risk-sentinel` over Gensyn AXL, it fires a KeeperHub workflow to execute on Base Sepolia. The result (tx hash, block number, gas) is streamed back to the UI.

---

## Feedback items

### 1. Workflow status does not include `chain` in the GET /runs/{runId} response
**What happened:** `GET /workflows/{id}/runs/{runId}` returns the workflow run, but the `chain` field is absent on initial creation (only appears after the run completes). This caused our TypeScript model to mismatch on first poll.
**Suggestion:** Include `chain` in the response from the moment the run is created, defaulting to the workflow's configured chain.

### 2. No structured error codes in error responses
**What happened:** When a workflow trigger fails (e.g., bad inputs, wallet not funded), the error body is a free-form string. Structured error codes (`WALLET_INSUFFICIENT_FUNDS`, `WORKFLOW_NOT_FOUND`, etc.) would let agents branch deterministically on error type.
**Suggestion:** Add an `error_code` field alongside `message` in error responses.

### 3. Webhook / push notification for run completion
**What happened:** We had to poll `GET /runs/{runId}` every 3 seconds. For long-running workflows this is wasteful and creates unnecessary API load.
**Suggestion:** Support a `callback_url` in the `POST /workflows/{id}/runs` request body. On terminal state, POST the `WorkflowRun` payload to that URL. Would eliminate polling entirely for server-side integrations.

### 4. MCP server discovery via ENS
**What happened:** The KeeperHub MCP server URL is static config in our env file. AI agents that discover each other dynamically via ENS cannot auto-discover the KeeperHub MCP server unless it's published somewhere.
**Suggestion:** Publish a well-known ENS text record on `keeperhub.eth` (e.g., `mcp.endpoint`) so ENS-native agent networks can discover and connect without hardcoded config.

### 5. x402/MPP payment rail documentation gap
**What happened:** The Focus Area 2 description mentions "x402 payment rails" and "MPP" but there is no code example or SDK snippet in the docs for the x402 handshake with KeeperHub specifically. The generic x402 spec doesn't cover KeeperHub's specific header format.
**Suggestion:** Add a minimal working example (curl + Node.js) showing the x402 payment header required to call KeeperHub endpoints. This is blocking for hackathon teams targeting Focus Area 2.

### 6. Workflow input schema validation errors are not surfaced in the run status
**What happened:** If the workflow `inputs` don't match the schema defined in the workflow template, the run is created (201) but immediately fails with a generic error message. There is no way to distinguish input validation failures from onchain execution failures in the run status response.
**Suggestion:** Add a `failure_reason` enum: `INPUT_VALIDATION`, `EXECUTION_REVERTED`, `GAS_ESTIMATION_FAILED`, `TIMEOUT`, etc.

### 7. No sandbox / test mode
**What happened:** Development requires a real API key and a deployed workflow. There is no sandbox mode where POST /workflows/test/runs returns realistic mock data.
**Suggestion:** A free-tier sandbox environment (or a `X-KeeperHub-Test: true` header that returns simulated responses) would significantly lower the hackathon onboarding bar.

---

## Positive highlights

- REST API design is clean and predictable — trigger + poll is simple to wrap.
- Base Sepolia support means gas is free for hackathon demos — great choice.
- Turnkey wallet abstraction removes the biggest UX hurdle for agentic workflows.
- The `logs` array in the run response is excellent — exactly what AI agents need to explain what happened to users.
