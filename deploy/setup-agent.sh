#!/usr/bin/env bash
# ─── Container Cost Agent — One-liner Setup ───────────────
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh | bash -s -- \
#     --server=https://your-central-server:8080 \
#     --api-key=dckr_your_key_here \
#     --name="My VPS" \
#     --price=200000 \
#     --cpu=4 \
#     --ram=8
#
# Or download manually:
#   wget https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh
#   chmod +x setup-agent.sh
#   ./setup-agent.sh --server=http://... --api-key=... --name="VPS Name"
#
# ────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Parse args ──────────────────────────────────────────
SERVER=""
API_KEY=""
VPS_NAME="Container Cost Agent"
VPS_PRICE=0
VPS_CPU=0
VPS_RAM=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER="$2"; shift 2 ;;
    --api-key) API_KEY="$2"; shift 2 ;;
    --name) VPS_NAME="$2"; shift 2 ;;
    --price) VPS_PRICE="$2"; shift 2 ;;
    --cpu) VPS_CPU="$2"; shift 2 ;;
    --ram) VPS_RAM="$2"; shift 2 ;;
    *) echo "❌ Unknown arg: $1"; exit 1 ;;
  esac
done

# ─── Validate ────────────────────────────────────────────
if [[ -z "$SERVER" || -z "$API_KEY" ]]; then
  echo "❌ Usage: $0 --server=URL --api-key=KEY [--name=N] [--price=N] [--cpu=N] [--ram=N]"
  echo ""
  echo "   --server     Central server URL (required)"
  echo "   --api-key    API key from central dashboard (required)"
  echo "   --name       VPS name (default: 'Container Cost Agent')"
  echo "   --price      VPS monthly price in IDR (optional)"
  echo "   --cpu        CPU cores count (optional)"
  echo "   --ram        RAM in GB (optional)"
  exit 1
fi

# ─── Check Docker ────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found. Install Docker first:"
  echo "   curl -fsSL https://get.docker.com | sh"
  exit 1
fi

# ─── Create config ───────────────────────────────────────
CONFIG_DIR="$HOME/.docker-cost"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.json" <<EOF
{
  "name": "$VPS_NAME",
  "price_per_month": $VPS_PRICE,
  "cpu_cores": $VPS_CPU,
  "ram_gb": $VPS_RAM,
  "storage_gb": 0,
  "bandwidth_gb": 0,
  "currency": "IDR",
  "cpu_weight": 0.5,
  "ram_weight": 0.4,
  "storage_weight": 0.1,
  "network_weight": 0.0,
  "overhead_percent": 15
}
EOF

echo "✅ Config created at $CONFIG_DIR/config.json"

# ─── Pull & Run Agent ────────────────────────────────────
echo "🚀 Pulling container-cost agent image..."
docker pull ghcr.io/edsuwarna/container-cost:latest

echo "🔄 Starting agent..."
docker rm -f container-cost-agent 2>/dev/null || true

docker run -d \
  --name container-cost-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v "$CONFIG_DIR:/root/.docker-cost" \
  -e TZ=Asia/Jakarta \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent --server="$SERVER" --api-key="$API_KEY" --push-interval=60

echo ""
echo "✅ Agent deployed successfully!"
echo "   Check logs: docker logs -f container-cost-agent"
echo "   Check status: docker ps --filter name=container-cost-agent"
