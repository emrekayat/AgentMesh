#!/usr/bin/env bash
# Boot all 3 agent Node.js processes.
# Each connects to its AXL node (already running via scripts/start-axl.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/axl/logs"
mkdir -p "$LOG_DIR"

echo "[agents] Starting research-alpha on a2a :8003 (axl :9003)…"
pnpm tsx "$ROOT/agents/research-alpha/index.ts" \
  > "$LOG_DIR/research-alpha.log" 2>&1 &
RESEARCH_PID=$!

echo "[agents] Starting risk-sentinel on a2a :8004 (axl :9004)…"
pnpm tsx "$ROOT/agents/risk-sentinel/index.ts" \
  > "$LOG_DIR/risk-sentinel.log" 2>&1 &
RISK_PID=$!

echo "[agents] Starting execution-node on a2a :8005 (axl :9005)…"
pnpm tsx "$ROOT/agents/execution-node/index.ts" \
  > "$LOG_DIR/execution-node.log" 2>&1 &
EXEC_PID=$!

echo "[agents] All 3 agents running. PIDs: research=$RESEARCH_PID risk=$RISK_PID exec=$EXEC_PID"
echo "[agents] Logs: $LOG_DIR/{research-alpha,risk-sentinel,execution-node}.log"
echo "[agents] Press Ctrl+C to stop all."

wait
