# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Quick Start](#3-quick-start)
4. [Deployment Guide](#4-deployment-guide)
5. [Platform Variants](#5-platform-variants)
6. [Configuration Guide](#6-configuration-guide)
7. [Cost Formula](#7-cost-formula)
8. [API Reference](#8-api-reference)
9. [Frontend Dashboard](#9-frontend-dashboard)
10. [CLI Reference](#10-cli-reference)
11. [Development Guide](#11-development-guide)
12. [Security](#12-security)
13. [Troubleshooting](#13-troubleshooting)
14. [FAQ](#14-faq)
15. [Roadmap](#15-roadmap)

---

## 1. Overview

### 1.1 What is Container Cost?

Container Cost is a **Docker container cost allocation tool** that helps you calculate and monitor how much each container costs across one or many VPS instances. It uses a weighted resource allocation formula based on actual CPU and RAM usage.

### 1.2 Why?

If you run Docker containers across multiple VPS, you've probably asked:

- "Container A is on which VPS? What's the total cost across all VPS?"
- "Which VPS is the most expensive? Most wasteful?"
- "How do I charge back clients whose containers run on different VPS?"
- "How do I track per-VPS costs without SSH-ing into each one?"

Container Cost answers all of these with a single dashboard.

### 1.3 Who Is It For?

| Segment | Use Case |
|---------|----------|
| **Indie Developer / Solo Dev** | Side projects on 1-3 VPS, know your cost breakdown |
| **DevOps Engineer** | Multi-tenant container deployment, chargeback to teams/clients |
| **VPS Reseller** | Selling containers to clients with data-driven pricing |
| **Small Team** | Sharing VPS, fair cost splitting |

### 1.4 Key Features

**Single VPS (Legacy)**
- Live Docker stats collection (CPU%, memory, status)
- Weighted cost allocation (CPU 50%, RAM 40%, Storage 10%)
- PostgreSQL storage with history tracking
- Chart.js dashboard (doughnut, bar, line charts)
- Role-based auth (admin, engineer, management)
- Docker Compose deployment

**Multi-VPS (v2.0)**
- VPS management — add/edit/delete VPS from dashboard
- Agent mode — deploy a lightweight agent on each VPS
- Push API — agents push reports to central server (API key auth)
- Aggregated dashboard — total cost across all VPS
- Live status — online/offline detection per VPS
- Auto API key generation on VPS creation
- GitHub Container Registry image
- One-liner agent deployment

### 1.5 Tech Stack

| Layer | Technology | Why |
|-------|-----------|------|
| **Language** | Go 1.22 | High performance, single binary, perfect for CLI tools |
| **Storage** | PostgreSQL 16 | Robust, JSONB for flexible report snapshots |
| **API** | net/http (stdlib) | No framework — lightweight, easy to maintain |
| **Docker API** | Unix socket (HTTP) | Read container stats directly from Docker Engine |
| **Frontend** | Vanilla HTML/CSS/JS + Chart.js | Zero build step, dark theme |
| **Auth** | Session-based (cookie) | Login/logout, bcrypt, 3 roles |
| **Container Registry** | GitHub Container Registry | ghcr.io/edsuwarna/container-cost |

---

## 2. Architecture

### 2.1 Multi-VPS Architecture (v2.0+)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  VPS-1       │  │  VPS-2       │  │  VPS-3       │
│  ┌──────────┐│  │  ┌──────────┐│  │  ┌──────────┐│
│  │  Agent   ││  │  │  Agent   ││  │  │  Agent   ││
│  │ (Docker) ││  │  │ (Docker) ││  │  │ (Docker) ││
│  └────┬─────┘│  │  └────┬─────┘│  │  └────┬─────┘│
└───────┼──────┘  └───────┼──────┘  └───────┼──────┘
        │ POST            │ POST            │ POST
        │ /api/v1/push    │ /api/v1/push    │ /api/v1/push
        ▼                 ▼                 ▼
┌───────────────────────────────────────────────────┐
│               CENTRAL SERVER                        │
│  ┌─────────────────────────────────────────────┐   │
│  │  API Server (:8080) + Frontend Dashboard    │   │
│  │  PostgreSQL (snapshots, users, vps_agents)  │   │
│  └─────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

Each agent:
1. Reads Docker socket for container stats (CPU%, RAM)
2. Calculates cost using its own VPS config (name, specs, price)
3. Pushes the cost report to the central server
4. Retries up to 5× with exponential backoff on failure

The central server:
1. Receives push reports from agents (API key auth)
2. Stores snapshots in PostgreSQL (per VPS)
3. Detects offline VPS (24h threshold)
4. Serves the aggregated dashboard
5. Can also collect locally if Docker socket is available

### 2.2 Single VPS Architecture (Legacy)

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host (VPS)                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Container Cost                        │   │
│  │  ┌──────────┐   ┌────────────┐   ┌───────────┐  │   │
│  │  │Collector │──▶│ Calculator │──▶│  Storage   │  │   │
│  │  │(Docker   │   │ (Weighted  │   │ (PostgreSQL│  │   │
│  │  │ socket)  │   │  Formula)  │   │           │  │   │
│  │  └──────────┘   └─────┬──────┘   └─────┬─────┘  │   │
│  │                       │                │         │   │
│  │                 ┌─────▼────────────────▼──────┐  │   │
│  │                 │        REST API Server       │  │   │
│  │                 │        (port :8080)          │  │   │
│  │                 └─────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │Container│  │Container│  │Container│                  │
│  │   A     │  │   B     │  │   C     │                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow

```
Docker Socket
     │
     ▼
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Collector   │────▶│  Calculator   │────▶│   Storage      │
│ (CPU%, RAM,  │     │ (CostReport   │     │ (PostgreSQL)   │
│  status)     │     │  w/ formula)  │     │ snapshots +    │
└─────────────┘     └──────────────┘     │ users + agents  │
                                         └───────┬────────┘
                                                 │
                                         ┌───────▼────────┐
                                         │  API Server    │
                                         │  :8080         │
                                         │  JSON REST     │
                                         └───────┬────────┘
                                                 │
                                         ┌───────▼────────┐
                                         │  Frontend      │
                                         │  (Chart.js)    │
                                         └────────────────┘
```

---

## 3. Quick Start

### 3.1 Central Server (5 minutes)

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

### 3.2 Add a VPS Agent

1. Login to dashboard → click **VPS** menu (admin only)
2. Click **➕ Tambah VPS**
3. Enter a name (e.g. "Hetzner CX42")
4. Click **💾 Simpan & Generate Key**
5. Copy the API key shown

### 3.3 Deploy Agent on Another VPS

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

### 3.4 Verify

```bash
# Check agent logs
docker logs -f container-cost-agent

# Expected output:
# [agent] push success: VPS=Hetzner CX42 containers=5 cost=200000.00

# Dashboard: http://CENTRAL_IP:8081
```

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
DATABASE_URL="postgres://user:pass@localhost:5432/docker-cost?sslmode=disable" ./build/docker-cost
```

#### Docker Run (Without Compose)

```bash
docker run -d --name container-cost \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e DATABASE_URL="postgres://user:pass@host:5432/docker-cost?sslmode=disable" \
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

## 5. Platform Variants

Container Cost is designed to be **platform-agnostic** at the VPS level. Any VPS running Docker can host an agent.

### 5.1 Traditional VPS

| Provider | Tested | Notes |
|----------|--------|-------|
| Hetzner Cloud | ✅ | CX/CX series |
| DigitalOcean | ✅ | Droplets |
| Linode/Akamai | ✅ | |
| Vultr | ✅ | |
| AWS EC2 | ⚠️ | Must mount Docker socket |
| Google Cloud | ⚠️ | Must mount Docker socket |

### 5.2 Special Environments

**Orchestrated environments (Kubernetes, Nomad):** The agent reads the *host* Docker socket, so it works on any single Docker host. For Kubernetes, deploy the agent as a DaemonSet to measure node-level container costs.

---

## 6. Configuration Guide

### 6.1 Config File Location

Default: `~/.docker-cost/config.json` (override with `DOCKER_COST_CONFIG_DIR` env var)

### 6.2 Server Mode Configuration

```json
{
  "name": "My VPS",
  "price_per_month": 200000,
  "cpu_cores": 4,
  "ram_gb": 8,
  "storage_gb": 100,
  "bandwidth_gb": 0,
  "currency": "IDR",
  "cpu_weight": 0.5,
  "ram_weight": 0.4,
  "storage_weight": 0.1,
  "network_weight": 0.0,
  "overhead_percent": 15,
  "admin_user": "admin",
  "admin_pass": "",
  "secret_key": ""
}
```

**Field Reference:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | `"My VPS"` | Display name in dashboard |
| `price_per_month` | number | `200000` | Monthly VPS cost in your currency |
| `cpu_cores` | number | `4` | Number of CPU cores |
| `ram_gb` | number | `8` | RAM in GB |
| `storage_gb` | number | `100` | Storage in GB |
| `bandwidth_gb` | number | `0` | Bandwidth (reserved for future) |
| `currency` | string | `"IDR"` | Currency code (IDR, USD, EUR, etc.) |
| `cpu_weight` | 0.0-1.0 | `0.5` | CPU weight in cost formula |
| `ram_weight` | 0.0-1.0 | `0.4` | RAM weight in cost formula |
| `storage_weight` | 0.0-1.0 | `0.1` | Storage weight in cost formula |
| `network_weight` | 0.0-1.0 | `0.0` | Network weight (reserved) |
| `overhead_percent` | 0-100 | `15` | OS/Docker overhead percentage |

> If the config file doesn't exist, it's **auto-created with defaults** on first run.

### 6.3 Agent Mode Configuration

For agent mode, use the FullConfig format that wraps both VPS and agent settings:

```json
{
  "vps": {
    "name": "Hetzner CX42",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
    "storage_gb": 100,
    "currency": "IDR",
    "cpu_weight": 0.5,
    "ram_weight": 0.4,
    "storage_weight": 0.1,
    "overhead_percent": 15
  },
  "agent": {
    "mode": "agent",
    "central_url": "http://central:8080",
    "agent_key": "dckr_xxx...",
    "push_interval": 60,
    "push_retries": 5
  }
}
```

**Agent config fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | string | `"server"` | Run mode: `"server"` or `"agent"` |
| `central_url` | string | `""` | Central server URL (e.g. `http://ip:8080`) |
| `agent_key` | string | `""` | API key from central dashboard |
| `push_interval` | int | `60` | Seconds between pushes |
| `push_retries` | int | `5` | Retry count on failure |

**CLI flags override config file values.** If both are provided, CLI wins.

### 6.4 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | `postgres://docker-cost:***@localhost:5432/docker-cost?sslmode=disable` | PostgreSQL connection string |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket path |
| `DOCKER_COST_CONFIG_DIR` | `~/.docker-cost` | Config directory |
| `TZ` | `Asia/Jakarta` | Timezone |

### 6.5 Weights Tuning

The default weights are:

| Resource | Weight | Rationale |
|----------|--------|-----------|
| CPU | 50% | Most common bottleneck |
| RAM | 40% | Second most important |
| Storage | 10% | Relatively cheap |
| Network | 0% | Reserved for future |

**Tips for adjusting weights:**
- **CPU-heavy workloads** (compute, batch jobs) → increase CPU weight to 0.7+
- **Memory-heavy workloads** (databases, caches) → increase RAM weight to 0.6+
- **Equal split** → set all to 0.33
- Weights don't need to sum to 1.0 (they're normalized internally), but it's recommended for clarity

---

## 7. Cost Formula

### 7.1 How Allocation Works

Container Cost uses a **weighted resource fraction** model:

```
Container Cost = VPS Monthly Price × Weighted Resource Fraction
```

### 7.2 Step-by-Step Calculation

**Step 1: Available Resources (after 15% overhead)**

```
Available CPU = Total CPU × (1 - Overhead%)
Available RAM = Total RAM × (1 - Overhead%)
```

For a VPS with 4 CPU cores and 8GB RAM, 15% overhead:
- Available CPU = 4 × 0.85 = **3.4 cores**
- Available RAM = 8 × 0.85 = **6.8 GB**

**Step 2: Container Fractions**

```
CPU Fraction = Container CPU Cores / Available CPU
RAM Fraction = Container RAM (GB) / Available RAM
Storage Fraction = 1 / Number of Containers (equal split per container)
```

**Step 3: Weighted Cost**

```
Container Monthly Cost = Price × (CPU_Weight × CPU_Fraction + RAM_Weight × RAM_Fraction + Storage_Weight × Storage_Fraction)
                         / (CPU_Weight + RAM_Weight + Storage_Weight)
```

### 7.3 Example

**VPS:** Hetzner CX42 — Rp 200.000/month, 4 CPU, 8GB RAM, 3 containers

**Weights:** CPU=0.5, RAM=0.4, Storage=0.1

| Container | CPU% | RAM | CPU Cost | RAM Cost | Storage Cost | **Total** |
|-----------|------|-----|----------|----------|-------------|-----------|
| web | 2.5% | 128MB | Rp 4.800 | Rp 1.500 | Rp 6.700 | **Rp 13.000** |
| postgres | 15.2% | 1.2GB | Rp 29.200 | Rp 14.100 | Rp 6.700 | **Rp 50.000** |
| nginx | 0.8% | 64MB | Rp 1.500 | Rp 750 | Rp 6.700 | **Rp 8.950** |

**Overhead cost (OS + Docker ~15%):** Rp 30.000  
**Unallocated (idle resources):** Rp 55.000  
**Total allocated:** Rp 200.000 ✓

### 7.4 Overhead Cost

The OS and Docker daemon themselves consume resources. The overhead is calculated as:

```
Overhead CPU = Total CPU × Overhead%
Overhead RAM = Total RAM × Overhead%

Overhead Cost = Price × (overheadCPU/totalCPU + overheadRAM/totalRAM) / 2
```

Default overhead: **15%** (adjustable in config)

### 7.5 Unallocated Cost

Resources not used by any container or overhead:

```
Unallocated = Price × (unusedCPUratio + unusedRAMratio) / 2
```

This represents **idle capacity** you're paying for but not using.

### 7.6 Multi-VPS Totals

The aggregated dashboard sums costs across all VPS:

```
Total Cost All VPS = Σ(VPS 1 Price + VPS 2 Price + ... + VPS N Price)
Total Containers = Σ(Container Count per VPS)
```

---

## 8. API Reference

### 8.1 Base URL

```
http://localhost:8080
// Via docker-compose: http://localhost:8081
```

### 8.2 Endpoint Summary

#### Public (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Login (JSON body: username, password) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/check` | Check session status |

#### Agent Push (API Key Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/push` | Push cost report from agent |

**Headers:** `Authorization: Bearer dckr_xxx`

#### Dashboard (Authenticated — any role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Aggregated multi-VPS report |
| GET | `/api/report/latest` | Latest snapshot |
| POST | `/api/report/refresh` | Generate fresh report (local Docker only) |
| GET | `/api/report/history` | Historical reports (query: `?since=2024-01-01T00:00:00Z`) |
| GET | `/api/containers` | List all containers + current costs |
| GET | `/api/containers/{name}` | Container cost history |
| GET | `/api/costs/trends` | Cost trend over last 30 days |
| GET/PUT | `/api/config` | Get/update VPS config |

#### VPS Management (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vps` | List all VPS agents |
| POST | `/api/vps` | Add new VPS (generates API key) |
| GET | `/api/vps/{id}` | VPS detail + latest report |
| PUT | `/api/vps/{id}` | Update VPS name/notes |
| DELETE | `/api/vps/{id}` | Remove VPS + all its data |
| POST | `/api/vps/{id}/reset-key` | Regenerate API key |

#### User Management (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create new user |
| PUT | `/api/users/{id}` | Update user role |
| DELETE | `/api/users/{id}` | Delete user |
| POST | `/api/users/{id}/reset-password` | Reset password |

### 8.3 Detailed Endpoints

#### GET /api/health

```json
// Response 200
{
  "status": "ok",
  "time": "2025-01-15T10:30:00Z"
}
```

#### POST /api/auth/login

```json
// Request
{
  "username": "admin",
  "password": "change-me"
}

// Response 200
{
  "success": true,
  "user": "admin",
  "role": "admin"
}

// Response 401
{
  "error": "invalid credentials"
}
```

**Sets a session cookie** `session` (HttpOnly, SameSite=Lax, 24h expiry).

#### POST /api/v1/push (Agent Push)

```json
// Headers: Authorization: Bearer dckr_xxx

// Request Body
{
  "vps": {
    "name": "Hetzner CX42",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
    "currency": "IDR"
  },
  "containers": [
    {
      "container": {
        "name": "web",
        "id": "a1b2c3d4e5f6",
        "image": "nginx:latest",
        "cpu_percent": 2.5,
        "mem_usage_mb": 128,
        "mem_limit_mb": 1024,
        "mem_percent": 12.5,
        "status": "running",
        "created_at": "2025-01-01T00:00:00Z",
        "uptime": "14 days"
      },
      "cpu_cost": 4800,
      "ram_cost": 1500,
      "storage_cost": 6700,
      "total_cost": 13000
    }
  ],
  "overhead_cost": 30000,
  "unallocated_cost": 55000,
  "total_cost": 200000,
  "period": "month"
}

// Response 200
{
  "status": "accepted",
  "snapshot_id": 42
}
```

#### GET /api/dashboard (Aggregated)

```json
// Response 200
{
  "vps_list": [
    {
      "id": 1,
      "name": "Hetzner CX42",
      "cpu_cores": 4,
      "ram_gb": 8,
      "price_per_month": 200000,
      "currency": "IDR",
      "status": "online",
      "last_seen": "2025-01-15T10:28:00Z"
    }
  ],
  "reports": [
    {
      "vps": { "name": "Hetzner CX42", ... },
      "containers": [...],
      "total_cost": 200000
    }
  ],
  "total_cost": 200000,
  "total_vps": 1,
  "total_containers": 3,
  "currency": "IDR",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

### 8.4 Error Response Format

All errors follow this structure:

```json
{
  "error": "human-readable error message",
  "details": "optional detailed message"
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (VPS, user) |
| 400 | Bad request (missing/invalid fields) |
| 401 | Unauthorized (not logged in or invalid API key) |
| 403 | Forbidden (wrong role) |
| 404 | Not found |
| 500 | Internal server error |

### 8.5 Authentication

Two authentication methods:

1. **Session Cookie** — for dashboard users:
   - `POST /api/auth/login` sets a `session` cookie
   - Valid for 24 hours
   - Used for all dashboard endpoints

2. **API Key (Bearer Token)** — for agent pushes:
   - Format: `Authorization: Bearer dckr_xxxxx`
   - Generated per VPS from the dashboard
   - Can be regenerated (old key invalidated immediately)

### 8.6 Rate Limiting

The API has no built-in rate limiter. Agents typically push every 60 seconds by default.

---

## 9. Frontend Dashboard

### 9.1 Access

After starting the server, open:

```
http://your-server:8081
```

Default login: `admin` / `change-me`

### 9.2 Pages

**Dashboard** — Main overview with:
- Summary cards: Total Cost, Container Cost, Overhead, Unallocated
- Period filter: Latest, 7 Days, 30 Days, All Time
- Cost Distribution doughnut chart (per container)
- Cost Breakdown bar chart (CPU vs RAM vs Storage)
- Cost Trend line chart (over time)
- Container table (name, image, CPU%, RAM, CPU cost, RAM cost, total)

**Containers** — Container list with click-through to detail view:
- Individual container cost history chart
- CPU / RAM / cost details

**VPS Management (Admin)** — CRUD for VPS agents:
- VPS list with specs, price, status (online/offline), last seen
- Add VPS → auto-generates API key
- View details → latest report per VPS
- Delete VPS → removes all associated data

**Settings** — Configure VPS specs:
- Name, currency, price per month, overhead%
- CPU cores, RAM, storage
- Cost weights (CPU, RAM, Storage, Network)

**Users (Admin)** — User management:
- Create, edit role, delete users
- Reset password

### 9.3 Chart Types

| Chart | Type | Data |
|-------|------|------|
| Cost Distribution | Doughnut | Per-container cost share |
| Cost Breakdown | Bar | CPU vs RAM vs Storage per container |
| Cost Trend | Line | Total cost over time |
| Detail History | Line | Single container cost over time |

### 9.4 Roles & Permissions

| Feature | Admin | Engineer | Management |
|---------|-------|----------|------------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Containers | ✅ | ✅ | ✅ |
| View Cost Trends | ✅ | ✅ | ✅ |
| View/Edit Settings | ✅ | ✅ | ❌ |
| Generate Report | ✅ | ✅ | ❌ |
| Manage VPS | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ |

---

## 10. CLI Reference

### 10.1 Flags

```
Usage of /app/docker-cost:

  -mode string
        Run mode: 'server' (central) or 'agent' (default: "server")
  -server string
        Central server URL (agent mode: http://central:8080)
  -api-key string
        Agent API key (agent mode, from dashboard)
  -push-interval int
        Push interval in seconds (agent mode, default: 60)
```

### 10.2 Makefile Commands

| Command | Description |
|---------|-------------|
| `make build` | Build binary to `./build/docker-cost` |
| `make build-static` | Static Linux binary |
| `make run` | Build + run |
| `make run-quick` | Quick run with `go run` |
| `make test` | Run all tests with race detection |
| `make clean` | Remove build artifacts |
| `make install-deps` | Install system deps (gcc, sqlite3) |
| `make info` | Show project info |

---

## 11. Development Guide

### 11.1 Prerequisites

```bash
# Go 1.22+
go version

# PostgreSQL 16+
psql --version

# Docker (for agent testing)
docker --version
```

### 11.2 Project Structure

```
container-cost/
├── cmd/server/main.go              # Entry point — server & agent modes
├── internal/
│   ├── agent/client.go             # Push client + retry logic
│   ├── api/handler.go              # HTTP handlers + routes + auth
│   ├── calculator/cost.go          # Weighted cost formula engine
│   ├── collector/docker.go         # Docker socket → ContainerStats
│   ├── config/config.go            # VPSConfig + AgentConfig loader
│   └── storage/postgres.go         # PostgreSQL: migrations, users, snapshots, agents
├── web/dist/                        # Frontend (HTML/CSS/JS + Chart.js)
├── deploy/
│   └── setup-agent.sh              # One-liner agent deployment script
├── Dockerfile                       # Multi-stage build → ghcr.io
├── docker-compose.yml               # Central server (Go app + PostgreSQL)
├── docker-compose.agent.yml         # Agent deployment
├── Makefile
├── PRD.md                           # Product Requirements Document
├── README.md
└── DOCS.md                          # This documentation
```

### 11.3 Running Locally

```bash
# Quick start (no Postgres setup needed for some dev tasks)
make run-quick

# Or build first
make build
./build/docker-cost

# With custom port
PORT=9000 ./build/docker-cost
```

### 11.4 Testing

```bash
# All tests
go test -v -race ./...

# Coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

### 11.5 Building Docker Image

```bash
docker build -t container-cost:latest .
docker run -d -p 8080:8080 container-cost:latest
```

### 11.6 Database

**Auto-migration:** On startup, the app creates all tables automatically:

```sql
-- VPS Agents
CREATE TABLE IF NOT EXISTS vps_agents (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    api_key         VARCHAR(128) UNIQUE NOT NULL,
    cpu             DOUBLE PRECISION DEFAULT 0,
    ram_gb          DOUBLE PRECISION DEFAULT 0,
    storage_gb      DOUBLE PRECISION DEFAULT 0,
    price_per_month DOUBLE PRECISION DEFAULT 0,
    currency        VARCHAR(10) DEFAULT 'IDR',
    cpu_weight      DOUBLE PRECISION DEFAULT 0.5,
    ram_weight      DOUBLE PRECISION DEFAULT 0.4,
    storage_weight  DOUBLE PRECISION DEFAULT 0.1,
    overhead_percent DOUBLE PRECISION DEFAULT 15.0,
    notes           TEXT DEFAULT '',
    status          VARCHAR(20) DEFAULT 'offline',
    last_seen       TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    VARCHAR(200) DEFAULT '',
    role            VARCHAR(20) DEFAULT 'engineer',
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    id          SERIAL PRIMARY KEY,
    vps_id      INTEGER REFERENCES vps_agents(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW(),
    report_json JSONB NOT NULL
);
```

**Default seeding:** On first startup, creates initial users:
- `admin` / `change-me` (role: admin)
- `eng` / `change-me` (role: engineer)
- `mgt` / `change-me` (role: management)

### 11.7 Adding Tests

Tests use Go's standard `testing` package. The calculator package has deterministic logic — add test cases in `internal/calculator/` for new cost scenarios.

### 11.8 Code Conventions

- **No external frameworks** — pure Go standard library (net/http, database/sql)
- **Docker API** — communicate via Unix socket HTTP
- **Password hashing** — bcrypt via `golang.org/x/crypto/bcrypt`
- **PostgreSQL driver** — pgx v5 via `github.com/jackc/pgx/v5/stdlib`
- **JSON storage** — report snapshots stored as JSONB

---

## 12. Security

### 12.1 Authentication

- **Dashboard:** Session-based auth with HttpOnly cookies, 24h expiry
- **Agents:** API key auth (Bearer token), auto-generated per VPS
- **Passwords:** Hashed with bcrypt

### 12.2 API Key Security

API keys are:
- Generated with `crypto/rand` (32 bytes → hex → prefixed with `dckr_`)
- Stored hashed in PostgreSQL
- Displayed once on creation (copy it immediately)
- Regenerable from dashboard (old key invalidated immediately)

### 12.3 Docker Socket

The Docker socket is mounted **read-only** (`ro`):
- Agents and server can only *read* stats
- No container modification possible

### 12.4 Network Security

- The default setup exposes port 8080/8081
- **Recommendation:** Run behind a reverse proxy (nginx, Caddy, Traefik) with:
  - TLS (HTTPS)
  - IP whitelisting for agent push endpoint
  - Rate limiting

### 12.5 Database Password

Change the default PostgreSQL password in docker-compose.yml for production:

```yaml
environment:
  POSTGRES_PASSWORD: your_secure_password_here
  POSTGRES_USER: container-cost
  POSTGRES_DB: container-cost
```

Update `DATABASE_URL` accordingly.

### 12.6 Secret Key

The server auto-generates a random 32-byte secret key for session signing. For production, set it in config.json:

```json
{
  "secret_key": "your-64-char-hex-secret"
}
```

---

## 13. Troubleshooting

### 13.1 Agent Can't Reach Central Server

```
[agent] push failed after 5 retries: push request failed: ...
```

**Check:**
1. Is the central server URL correct? `http://IP:8080` not `https://`
2. Is the port open? `telnet CENTRAL_IP 8080`
3. Firewall rules? Cloud security group?
4. Agent logs: `docker logs container-cost-agent`

### 13.2 Docker Socket Not Available

```
Warning: Docker collector not available: docker socket not found at /var/run/docker.sock
```

**Fixes:**
- For server mode: not critical — the server waits for agent pushes
- For agent mode: the agent requires Docker. Mount the socket: `-v /var/run/docker.sock:/var/run/docker.sock:ro`

### 13.3 Database Connection Failed

```
Failed to open database: failed to ping database: ...
```

**Check:**
1. Is PostgreSQL running? `docker ps | grep postgres`
2. Is the DATABASE_URL correct?
3. Can the app reach the DB host? (in Docker Compose, service name `postgres`)

### 13.4 VPS Shows Offline

By default, a VPS is marked offline if no push received for **24 hours**.

**Check:**
1. Is the agent running? `docker ps | grep container-cost-agent`
2. Agent logs: `docker logs container-cost-agent`
3. API key still valid? Try regenerating from dashboard

### 13.5 Invalid API Key

```
push rejected (HTTP 401): invalid api key
```

**Fix:**
1. Regenerate key from dashboard: `POST /api/vps/{id}/reset-key`
2. Update the agent with the new key

### 13.6 Config File Issues

If config.json doesn't exist, it's auto-created with defaults. Check:
- Path: `~/.docker-cost/config.json`
- Or set `DOCKER_COST_CONFIG_DIR` env var

### 13.7 Common Docker Commands

```bash
# Agent logs
docker logs -f container-cost-agent

# Server logs
docker logs -f container-cost

# Database
docker exec -it docker-cost-postgres psql -U docker-cost -d docker-cost

# Restart everything
docker compose restart

# Reset (⚠️ deletes all data)
docker compose down -v
docker compose up -d
```

---

## 14. FAQ

### What's the difference between server mode and agent mode?

**Server mode** (`--mode=server`, default): Runs the API server, database connection, frontend, and optionally collects local Docker stats. This is your central dashboard.

**Agent mode** (`--mode=agent`): A lightweight process that collects Docker stats, calculates costs, and pushes reports to the central server. No database, no frontend.

### Can I run multiple agents on the same VPS?

You can, but it's not useful — one agent per VPS is sufficient. Each agent represents a VPS in the dashboard.

### What happens if the central server goes down?

Agents detect connection failures and **retry up to 5 times** with 10-second delays. If still down, they log the error and try again on the next push interval. No data is lost on the agent side — it simply skips that cycle.

### How is storage cost calculated if disk usage isn't available?

Storage cost is allocated **equally** across all running containers: `Price × Storage_Weight / Container_Count`. This is a simplification — true per-container disk monitoring requires volume-level tracking.

### Can I change the currency?

Yes. Set `currency` in config.json to any code (IDR, USD, EUR, SGD, etc.). The dashboard displays it as-is.

### Does it work with Docker Desktop?

Yes, if Docker Desktop exposes the socket at `/var/run/docker.sock`. On macOS, this is usually a symlink.

### Can I use it with Podman?

Podman with Docker-compatible socket (`podman system service`) should work, but is not officially tested.

---

## 15. Roadmap

### ✅ v1.0 — Core
- [x] Docker stats collector
- [x] Weighted cost allocation formula
- [x] PostgreSQL storage + auto-migration
- [x] REST API (health, report, containers, config)
- [x] VPS config from JSON file

### ✅ v1.1 — Dashboard & Auth
- [x] Frontend dashboard (Chart.js)
- [x] Cost charts + container detail
- [x] Auth system (login, sessions, roles)
- [x] User management (CRUD)
- [x] Dockerfile + docker-compose.yml

### ✅ v2.0 — Multi-VPS Scale
- [x] Multi-VPS agent mode (`--mode=agent`)
- [x] Agent push API (`POST /api/v1/push`)
- [x] VPS management (CRUD from dashboard)
- [x] Aggregated dashboard (all VPS)
- [x] Offline detection per VPS
- [x] GitHub Container Registry
- [x] One-liner agent deployment

### 🔜 Future
- [ ] Cost alerts (Telegram / webhook)
- [ ] Export CSV / PDF reports
- [ ] Cost comparison chart across VPS
- [ ] Telegram bot for daily reports
- [ ] Per-container disk usage tracking
- [ ] Time-range cost projections
- [ ] Multi-currency support

---

## Related Resources

- [README.md](./README.md) — Quick start guide
- [PRD.md](./PRD.md) — Product Requirements Document (full specs)
- [Docker Engine API](https://docs.docker.com/engine/api/v1.43/) — Docker stats API reference
- [GitHub Container Registry](https://github.com/edsuwarna/container-cost/pkgs/container/container-cost) — Docker images
- [Chart.js](https://www.chartjs.org/) — Frontend charting library

---

> Built with ❤️ by **Endang Suwarna** — DevOps Engineer & AI Infrastructure Enthusiast
