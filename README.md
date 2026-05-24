# Container Cost 💰🐳

> Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture.

Hitung & monitor biaya container Docker di **satu atau banyak VPS** dari dashboard terpusat. Deploy **agent** di tiap VPS, semua data otomatis terkumpul di **central server**.

Cocok buat **chargeback**, **cost tracking**, atau tau container mana yang paling boros tanpa SSH satu-satu.

---

## ✨ Fitur

### 🔹 Single VPS (Legacy)
- 🔍 Collect CPU/RAM dari Docker socket
- 🧮 Weighted cost allocation (CPU 50%, RAM 40%, Storage 10%)
- 💾 PostgreSQL storage + history
- 📊 Frontend dashboard (Chart.js — doughnut, bar, line chart)
- 🔐 Auth system (admin/engineer/management)
- 🐳 Docker Compose deployment

### 🔸 Multi-VPS (v2.0)
- 🖥️ **VPS Management** — tambah/hapus/edit VPS dari dashboard
- 🤖 **Agent Mode** — `--mode=agent` di setiap VPS
- 📡 **Push API** — agent push report ke central (API key auth)
- 📊 **Aggregated Dashboard** — total cost semua VPS
- 🟢 **Live Status** — online/offline detection per VPS
- 🔑 **Auto API Key** — generate key pas tambah VPS
- 🐳 **Docker Image** — `ghcr.io/edsuwarna/container-cost`
- 🚀 **One-liner deploy** — `curl ... | bash`

---

## 🏗️ Arsitektur

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

Setiap agent punya **config.json sendiri** (nama VPS, spesifikasi, harga). Agent ngitung cost per VPS masing-masing, lalu push hasilnya ke central. Dashboard langsung nampilin data dari semua VPS.

---

## 🚀 Quick Start

### 1️⃣ Central Server

```bash
git clone https://github.com/edsuwarna/container-cost.git
cd container-cost

# Set DATABASE_URL di docker-compose.yml atau .env
# Lalu:
docker compose up -d

# Buka: http://localhost:8081
# Login: admin / change-me
```

### 2️⃣ Tambah VPS dari Dashboard

Login → **VPS** menu (admin only) → **➕ Tambah VPS** → isi nama → dapet API Key + command buat agent:

```
docker-cost --mode=agent \
  --server=http://CENTRAL_IP:8080 \
  --api-key=dckr_a1b2c3d4...
```

### 3️⃣ Deploy Agent di VPS Lain

**One-liner (recommended):**
```bash
curl -fsSL https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh | bash -s -- \
  --server=http://CENTRAL_IP:8080 \
  --api-key=dckr_lanjka... \
  --name="Hetzner CX42" \
  --price=200000 \
  --cpu=4 \
  --ram=8
```

**Atau pake docker-compose:**
```bash
curl -o docker-compose.agent.yml https://raw.githubusercontent.com/edsuwarna/container-cost/main/docker-compose.agent.yml
# Edit: ganti --server dan --api-key
docker compose -f docker-compose.agent.yml up -d
```

**Atau pake docker run:**
```bash
docker run -d --name container-cost-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v ~/.docker-cost/config.json:/root/.docker-cost/config.json:ro \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent --server=http://CENTRAL_IP:8080 --api-key=dckr_xxx
```

**Atau binary langsung:**
```bash
# Di VPS target (butuh Go 1.22+)
docker-cost --mode=agent \
  --server=http://CENTRAL_IP:8080 \
  --api-key=dckr_xxx \
  --push-interval=60
```

---

## 📊 Preview

```
VPS-1: Hetzner CX42 (Rp 200.000/bulan)
├── web        2.5% CPU   128 MB RAM    Rp  6.500
├── postgres  15.2% CPU   1.2 GB RAM    Rp 45.800
└── nginx      0.8% CPU    64 MB RAM    Rp  3.100

VPS-2: DOK Basic (Rp 350.000/bulan)
├── api        8.1% CPU   512 MB RAM    Rp 28.400
├── redis      3.2% CPU   256 MB RAM    Rp 12.100
└── worker    12.5% CPU   1.0 GB RAM    Rp 41.200

──────────────────────────────────────────────────
TOTAL: 6 containers · Rp 137.100 · 2 VPS
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:8080 (atau 8081 via docker-compose)
```

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login (body: username, password) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/check` | Check session |

### Agent Push (API Key auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/push` | Push report (Authorization: Bearer <key>) |

### Dashboard (Authenticated)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Aggregated multi-VPS report |
| GET | `/api/report/latest` | Latest snapshot |
| POST | `/api/report/refresh` | Generate report |
| GET | `/api/report/history` | Historical reports |
| GET | `/api/containers` | List all containers + cost |
| GET | `/api/containers/{name}` | Container cost history |
| GET | `/api/costs/trends` | Cost trend over time |
| GET/PUT | `/api/config` | VPS config |

### VPS Management (Admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vps` | List VPS agents |
| POST | `/api/vps` | Add new VPS (generates API key) |
| GET | `/api/vps/{id}` | VPS detail + latest report |
| PUT | `/api/vps/{id}` | Update VPS name/notes |
| DELETE | `/api/vps/{id}` | Remove VPS + data |
| POST | `/api/vps/{id}/reset-key` | Regenerate API key |

### User Management (Admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/users` | List / Create users |
| PUT/DELETE | `/api/users/{id}` | Update / Delete user |
| POST | `/api/users/{id}/reset-password` | Reset password |

---

## 🖥️ CLI Reference

```
Usage of /app/docker-cost:
  -mode string
        Run mode: 'server' (central) or 'agent' (default "server")
  -server string
        Central server URL (agent mode)
  -api-key string
        Agent API key (agent mode)
  -push-interval int
        Push interval in seconds (agent mode, default 60)
```

---

## 🧮 Cost Formula

```
Container Cost = Harga VPS × Weighted Resource Fraction

CPU Fraction   = Container CPU cores / Available CPU (after 15% overhead)
RAM Fraction   = Container RAM GB / Available RAM
Weighted       = CPU_Frac × 50% + RAM_Frac × 40% + Storage_Frac × 10%
```

Setiap agent ngitung cost **per VPS masing-masing** pake config sendiri (harga, CPU, RAM beda tiap VPS).

---

## 🏗️ Project Structure

```
docker-cost/
├── cmd/server/main.go              # Entry point (server & agent mode)
├── internal/
│   ├── agent/client.go             # Agent push client + retry logic
│   ├── collector/docker.go         # Docker socket → ContainerStats
│   ├── calculator/cost.go          # Weighted cost formula engine
│   ├── storage/postgres.go         # PostgreSQL: users, snapshots, vps_agents
│   ├── api/handler.go              # HTTP handlers + routes
│   └── config/config.go            # VPSConfig + AgentConfig loader
├── web/dist/                        # Frontend (HTML/CSS/JS + Chart.js)
├── deploy/
│   └── setup-agent.sh              # One-liner agent deployment script
├── Dockerfile                       # Multi-stage build → ghcr.io
├── docker-compose.yml               # Central server (Go app + PostgreSQL)
├── docker-compose.agent.yml         # Agent deployment
├── Makefile
├── PRD.md
└── README.md
```

---

## 🐳 Docker Image

Image tersedia di **GitHub Container Registry**:

```bash
docker pull ghcr.io/edsuwarna/container-cost:latest
```

Tags:
- `latest` — rilis terbaru
- `v2.0.0` — Multi-VPS release

### Run as Server
```bash
docker run -d --name container-cost \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/edsuwarna/container-cost:latest
```

### Run as Agent
```bash
docker run -d --name container-cost-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $HOME/.docker-cost/config.json:/root/.docker-cost/config.json:ro \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent --server=http://CENTRAL_IP:8080 --api-key=dckr_xxx
```

---

## 🔧 Development

### Prerequisites

```bash
# Go 1.22+
go version

# PostgreSQL 16+
psql --version

# Docker (for agent testing)
docker --version
```

### Commands

```bash
# Build binary
make build

# Run server mode langsung
make run-quick

# Test
make test

# Build Docker image
docker build -t container-cost:latest .

# Clean
make clean
```

### Testing

```bash
# Semua test
go test -v -race ./...

# Coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

---

## 🚦 Status & Roadmap

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

### 📋 Future
- [ ] Cost alerts (Telegram/webhook)
- [ ] Export CSV/PDF
- [ ] Cost comparison chart antar VPS
- [ ] Telegram bot for daily reports

---

## ⚙️ Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `8080` | Port HTTP server |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket path |
| `DOCKER_COST_CONFIG_DIR` | `~/.docker-cost` | Direktori config & database |
| `TZ` | `Asia/Jakarta` | Timezone |

---

## 🧪 Edge Cases Handled

| Skenario | Handling |
|----------|----------|
| Docker ga terinstall di central | Central tetep jalan — dia nunggu push dari agent |
| Agent ga bisa reach central | Retry 5x dengan exponential backoff |
| Container baru jalan | Masuk di next report cycle |
| Container berhenti/mati | Stats = 0, cost minimal |
| VPS mati total | Status otomatis jadi offline setelah 24 jam |
| Multiple VPS name sama | Dibedain oleh ID internal (vps_id) |
| Config file belum ada | Auto-create dengan default values |
| Container name duplicate di VPS beda | Container "nginx" di VPS-1 ≠ "nginx" di VPS-2 |
| API key kompromi | Bisa regenerate dari dashboard, key lama langsung mati |

---

## 👤 Author

**Endang Suwarna** — DevOps Engineer & AI Infrastructure Enthusiast

---

## 📚 Related

- [PRD.md](./PRD.md) — Product Requirements Document (detail lengkap)
- [Docker Engine API](https://docs.docker.com/engine/api/v1.43/) — Docker API reference
- [ghcr.io/edsuwarna/container-cost](https://github.com/edsuwarna/container-cost/pkgs/container/container-cost) — Docker image
