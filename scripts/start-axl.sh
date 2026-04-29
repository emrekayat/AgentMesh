#!/usr/bin/env bash
# Start all 4 AXL nodes as background processes.
# Logs go to axl/logs/*.log
# Run `bash scripts/verify-topology.sh` after this to confirm the mesh.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY="$REPO_ROOT/axl/source/node"
NODES_DIR="$REPO_ROOT/axl/nodes"
LOG_DIR="$REPO_ROOT/axl/logs"

mkdir -p "$LOG_DIR"

if [ ! -f "$BINARY" ]; then
  echo "❌  AXL binary not found at $BINARY"
  echo "   Run: cd axl/source && GOTOOLCHAIN=auto make build"
  exit 1
fi

# Kill any existing AXL nodes
pkill -f "axl/source/node" 2>/dev/null || true
sleep 0.5

start_node() {
  local name="$1"
  local config="$2"
  local log="$LOG_DIR/${name}.log"
  echo "  ↳ Starting $name …"
  cd "$REPO_ROOT/axl/source" && \
    "$BINARY" -config "$config" > "$log" 2>&1 &
  echo $! > "$LOG_DIR/${name}.pid"
}

echo ""
echo "🌐  Starting AXL mesh (4 nodes)"
echo ""

start_node "orchestrator" "$NODES_DIR/node1-orchestrator.json"
sleep 1  # give the listening node a head start
start_node "research"     "$NODES_DIR/node2-research.json"
start_node "risk"         "$NODES_DIR/node3-risk.json"
start_node "execution"    "$NODES_DIR/node4-execution.json"

sleep 3  # let nodes bootstrap

echo ""
echo "✅  AXL nodes started"
echo "   orchestrator  → http://127.0.0.1:9002 (PID $(cat "$LOG_DIR/orchestrator.pid"))"
echo "   research       → http://127.0.0.1:9003 (PID $(cat "$LOG_DIR/research.pid"))"
echo "   risk           → http://127.0.0.1:9004 (PID $(cat "$LOG_DIR/risk.pid"))"
echo "   execution      → http://127.0.0.1:9005 (PID $(cat "$LOG_DIR/execution.pid"))"
echo ""
echo "   Run: bash scripts/verify-topology.sh"
echo ""
