# Container Cost Documentation

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Deployment Guide

### Central Server (Production)

#### Docker Compose (Recommended)

The provided `docker-compose.yml` bundles:
- **PostgreSQL 16** — database with health check
- **Container Cost** — Go app with auto-migration

```bash
docker compose up -d
docker compose logs -f
```

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port (inside container) |
| `DATABASE_URL` | `postgres://container-cost:***@postgres:5432/container-cost?sslmode=disable` | PostgreSQL connection |
| `TZ` | `Asia/Jakarta` | Timezone |
| `CONTAINER_COST_ADMIN_PASSWORD` | *(generated randomly if not set)* | Admin password — if unset, a random password is printed in server logs on first start |

The `DATABASE_URL` in `docker-compose.yml` already points to the `postgres` service. **Make sure to change the password in production.**

#### Standalone Binary

```bash
# From source
go build -o container-cost ./cmd/server
./container-cost --mode=server

# With custom DB
DATABASE_URL="postgres://user:***@localhost:5432/container-cost?sslmode=disable" ./container-cost
```

#### Docker Run (Without Compose)

```bash
docker run -d --name container-cost \
  -p 8083:8080 \
  -e DATABASE_URL="postgres://user:***@host:5432/container-cost?sslmode=disable" \
  -e CONTAINER_COST_ADMIN_PASSWORD=your_secret_password \
  ghcr.io/edsuwarna/container-cost:latest
```

---

### Agent Deployment

> **New in v2.0:** Agent only needs Docker socket + API key. VPS config (price, CPU, RAM, weights) is managed from the dashboard — no local config files needed.

#### Prerequisites
- Docker installed on the target VPS
- A VPS registered in the dashboard (generates API key)
- Central server URL (e.g. `http://your-server:8080`)

#### One-liner (Recommended)

```bash
docker run -d --name container-cost-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent \
  --server=http://CENTRAL_IP:8080 \
  --api-key=dckr_xxx

That's it — no config files, no VPS specs. Just mount the Docker socket, point to your central server, and provide the API key.

#### With Docker Compose

```bash
# 1. Download the agent compose file
curl -o docker-compose.agent.yml https://raw.githubusercontent.com/edsuwarna/container-cost/main/docker-compose.agent.yml

# 2. Edit the CENTRAL_URL and API_KEY values

# 3. Start agent
docker compose -f docker-compose.agent.yml up -d
```

#### Verify Agent

```bash
docker logs -f container-cost-agent

# Expected output:
# [agent] push success: containers=5
# [agent] push success: containers=5
```

Then check the dashboard — your VPS should show as **online** with live container stats.

---

### Setting Up from the Dashboard

1. Open `http://your-server:8083`
2. Login: **admin** / *(password from server logs or CONTAINER_COST_ADMIN_PASSWORD env var)*
3. Click **VPS** menu → **Tambah VPS**
4. Enter a name (e.g. "Hetzner CX42"), set price, CPU, RAM, weights
5. Click **Simpan & Generate Key** — copy the API key
6. Deploy the agent using the API key as shown above

The VPS config is stored in the database. When you update price or weights, the central server automatically recalculates existing snapshots — no need to restart agents.

---

### Single VPS Mode (Legacy, No Agent)

If monitoring containers on the same machine as the server:

```bash
docker compose up -d
```

This runs in server mode with local Docker socket access. The server collects stats directly without an agent.

---

### Docker Image Details

**Image:** `ghcr.io/edsuwarna/container-cost:latest`

**Tags:**
- `latest` — most recent release
- `v2.0.0` — Multi-VPS release
- `sha-xxxxx` — per-commit builds (from CI)

**Multi-stage build:**
- Stage 1: `golang:1.22-alpine` — compiles static binary
- Stage 2: `alpine:3.19` — runtime (only 15MB + binary)

**Volumes:**
- `~/.container-cost` — config directory (optional for agent)
- `/var/run/docker.sock` — Docker socket (read-only, required)
