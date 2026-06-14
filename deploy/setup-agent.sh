#!/usr/bin/env bash
# ─── Container Cost Agent — One-liner Setup ───────────────
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh | bash -s -- \
#     --server=https://your-central-server:8080 \
#     --api-key=dckr_your_key_here \
#     --name="My VPS"
#
# Or download manually:
#   wget https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh
#   chmod +x setup-agent.sh
#   ./setup-agent.sh --server=http://... --api-key=... --name="VPS Name"
#
# VPS config (price, specs, weights) is managed from the dashboard —
# no local config files needed.
# ────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Parse args ──────────────────────────────────────────
SERVER=""
API_KEY=""
VPS_NAME="Container Cost Agent"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER="$2"; shift 2 ;;
    --api-key) API_KEY="$2"; shift 2 ;;
    --name) VPS_NAME="$2"; shift 2 ;;
    *) echo "❌ Unknown arg: $1"; exit 1 ;;
  esac
done

# ─── Validate ────────────────────────────────────────────
if [[ -z "$SERVER" || -z "$API_KEY" ]]; then
  echo "❌ Usage: $0 --server=URL --api-key=KEY [--name=N]"
  echo ""
  echo "   --server     Central server URL (required)"
  echo "   --api-key    API key from central dashboard (required)"
  echo "   --name       VPS name (default: 'Container Cost Agent')"
  exit 1
fi

# ─── Check Docker ────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found. Install Docker first:"
  echo "   curl -fsSL https://get.docker.com | sh"
  exit 1
fi

# ─── Pull & Run Agent ────────────────────────────────────
echo "🚀 Pulling container-cost agent image..."
docker pull ghcr.io/edsuwarna/container-cost:latest

echo "🔄 Starting agent..."
docker rm -f container-cost-agent 2>/dev/null || true

docker run -d \
  --name container-cost-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e TZ=Asia/Jakarta \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent --server="$SERVER" --api-key="$API_KEY" --push-interval=60

echo ""
echo "✅ Agent deployed successfully!"
echo "   Check logs: docker logs -f container-cost-agent"
echo "   Check status: docker ps --filter name=container-cost-agent"
echo ""
echo "   Next: Set VPS config (price, CPU, RAM) from the dashboard at $SERVER"
