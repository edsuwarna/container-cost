# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## 4. Deployment Guide

### 4.1 Central Server (Production)

#### Docker Compose (Recommended)

The provided `docker-compose.yml` bundles:
- **PostgreSQL 16** — database with health check
- **Container Cost** — Go app with auto-migration

```bash
docker compose up -d
docker compose logs -f
```

**Environment variables** you can set:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port (inside container) |
| `DATABASE_URL` | `postgres://docker-cost:***@postgres:5432/docker-cost?sslmode=disable` | PostgreSQL connection |
| `TZ` | `Asia/Jakarta` | Timezone |

The `DATABASE_URL` in `docker-compose.yml` already points to the `postgres` service. **Make sure to change the password in production.**

#### Standalone Binary

```bash
# From source
make build
./build/docker-cost

# With custom DB
DATABASE_URL="postgres://user:***@localhost:5432/docker-cost?sslmode=disable" ./build/docker-cost
```

#### Docker Run (Without Compose)

```bash
docker run -d --name container-cost \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e DATABASE_URL="postgres://user:***@host:5432/docker-cost?sslmode=disable" \
  ghcr.io/edsuwarna/container-cost:latest
```

### 4.2 Agent Deployment

#### One-liner Script

The `deploy/setup-agent.sh` script automates everything:

```bash
curl -fsSL https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh | bash -s -- \
  --server=http://central:8080 \
  --api-key=dckr_xxx \
  --name="My VPS" \
  --price=200000 \
  --cpu=4 \
  --ram=8
```

**What the script does:**
1. Validates Docker is installed
2. Creates `~/.docker-cost/config.json`
3. Pulls `ghcr.io/edsuwarna/container-cost:latest`
4. Runs the container with `--mode=agent`

#### Manual Docker Compose

```bash
# 1. Download the agent compose file
curl -o docker-compose.agent.yml https://raw.githubusercontent.com/edsuwarna/container-cost/main/docker-compose.agent.yml

# 2. Create config (adjust values to match your VPS)
cat > container-cost-config.json <<EOF
{
  "vps": {
    "name": "My VPS",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
    "currency": "IDR"
  },
  "agent": {
    "mode": "agent",
    "central_url": "http://YOUR_SERVER_IP:8080",
    "agent_key": "dckr_xxx",
    "push_interval": 60,
    "push_retries": 5
  }
}
EOF

# 3. Edit docker-compose.agent.yml — replace CHANGE_ME with actual values

# 4. Start agent
docker compose -f docker-compose.agent.yml up -d
```

#### Docker Run

```bash
docker run -d --name container-cost-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $HOME/.docker-cost/config.json:/root/.docker-cost/config.json:ro \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent \
  --server=http://CENTRAL_IP:8080 \
  --api-key=dckr_xxx \
  --push-interval=60
```

### 4.3 Single VPS Mode (Legacy, No Agent)

If you're monitoring containers on the same machine as the server:

```bash
docker compose up -d

# This runs in server mode with local Docker socket access
# The server collects stats directly without needing an agent
```

### 4.4 Docker Image Details

**Image:** `ghcr.io/edsuwarna/container-cost:latest`

**Tags:**
- `latest` — most recent release
- `v2.0.0` — Multi-VPS release

**Multi-stage build:**
- Stage 1: `golang:1.22-alpine` — compiles static binary
- Stage 2: `alpine:3.19` — runtime (only 15MB + binary)

**Volumes:**
- `/data` — config directory (mount for persistence)
- `/var/run/docker.sock` — Docker socket (read-only)

---
