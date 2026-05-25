# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Quick Start

### Central Server (5 minutes)

```bash
git clone https://github.com/edsuwarna/container-cost.git
cd container-cost

# Start Postgres + Container Cost
docker compose up -d

# Open the dashboard
echo "Open http://localhost:8081"
```

**Default Login:**
- Username: `admin`
- Password: `change-me`

> Port 8081 is the external port mapped to the container's port 8080 (see docker-compose.yml).

### Add a VPS Agent

1. Login to dashboard → click **VPS** menu (admin only)
2. Click **➕ Tambah VPS**
3. Enter a name (e.g. "Hetzner CX42")
4. Click **💾 Simpan & Generate Key**
5. Copy the API key shown

### Deploy Agent on Another VPS

**One-liner (recommended):**

```bash
curl -fsSL https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh | bash -s -- \
  --server=http://CENTRAL_IP:8080 \
  --api-key=dckr_xxx_generated_from_dashboard \
  --name="Hetzner CX42" \
  --price=200000 \
  --cpu=4 \
  --ram=8
```

**Or with docker-compose:**

```bash
curl -o docker-compose.agent.yml https://raw.githubusercontent.com/edsuwarna/container-cost/main/docker-compose.agent.yml

# Create config file
cat > container-cost-config.json <<EOF
{
  "vps": {
    "name": "Hetzner CX42",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
    "currency": "IDR"
  },
  "agent": {
    "mode": "agent",
    "central_url": "http://CENTRAL_IP:8080",
    "agent_key": "dckr_xxx",
    "push_interval": 60,
    "push_retries": 5
  }
}
EOF

docker compose -f docker-compose.agent.yml up -d
```

**Or with raw docker run:**

```bash
docker run -d --name container-cost-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v ~/.docker-cost/config.json:/root/.docker-cost/config.json:ro \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent --server=http://CENTRAL_IP:8080 --api-key=dckr_xxx
```

### Verify

```bash
# Check agent logs
docker logs -f container-cost-agent

# Expected output:
# [agent] push success: VPS=Hetzner CX42 containers=5 cost=200000.00

# Dashboard: http://CENTRAL_IP:8081
```

---
