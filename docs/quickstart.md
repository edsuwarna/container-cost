# Container Cost Documentation

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
echo "Open http://localhost:8083"
```

**Default Login:**
- Username: `admin`
- Password: *(randomly generated — check server logs on first start)*

> Port 8083 is the external port mapped to the container's port 8080 (see docker-compose.yml).
> If `CONTAINER_COST_ADMIN_PASSWORD` is not set, a random password is generated and printed in the server logs.
> Demo users (`eng`, `mgt`) are only created if `CONTAINER_COST_DEMO_PASSWORD_ENG` and `CONTAINER_COST_DEMO_PASSWORD_MGT` env vars are set.

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
  --name="Hetzner CX42"
```

**Or with docker-compose (no config file needed — CLI flags only):**

```bash
curl -o docker-compose.agent.yml https://raw.githubusercontent.com/edsuwarna/container-cost/main/docker-compose.agent.yml

# Edit the file to set your CENTRAL_IP and API_KEY, then:
docker compose -f docker-compose.agent.yml up -d
```

**Or with raw docker run (CLI flags only — no config file needed):**

```bash
docker run -d --name container-cost-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent --server=http://CENTRAL_IP:8080 --api-key=dckr_xxx
```

### Verify

```bash
# Check agent logs
docker logs -f container-cost-agent

# Expected output:
# [agent] push success: containers=5

# Dashboard: http://CENTRAL_IP:8083
```

---
