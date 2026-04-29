#!/usr/bin/env bash
# Verify all 4 AXL nodes are reachable and returns topology.

echo ""
echo "🔍  AXL topology check"
echo ""

for port in 9002 9003 9004 9005; do
  name=""
  case $port in
    9002) name="orchestrator" ;;
    9003) name="research    " ;;
    9004) name="risk        " ;;
    9005) name="execution   " ;;
  esac

  result=$(curl -sf --max-time 3 "http://127.0.0.1:$port/topology" 2>/dev/null)
  if [ $? -eq 0 ]; then
    peer_count=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('peers', [])))" 2>/dev/null || echo "?")
    our_key=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('our_public_key','?')[:16]+'…')" 2>/dev/null || echo "?")
    echo "  ✓ $name  port:$port  key:$our_key  peers:$peer_count"
  else
    echo "  ✗ $name  port:$port  — not reachable"
  fi
done

echo ""
