# Docker Cost Calculator — PRD

> **Product Requirements Document**
> **Version:** 2.0
> **Status:** Active
> **Author:** Endang Suwarna

---

## 1. Executive Summary

**Docker Cost Calculator** adalah alat untuk menghitung alokasi biaya container Docker berdasarkan resource yang digunakan (CPU, RAM, Storage) di satu atau banyak VPS. Mendukung **arsitektur agent + central server** — deploy agent di setiap VPS, semua data terkumpul di central dashboard.

### 1.1 Problem Statement

Developer/DevOps yang menjalankan container di **banyak VPS** sering kesulitan:

- "Container A di VPS mana? Total cost semua VPS berapa?"
- "VPS mana yang paling mahal? Paling boros?"
- "Kalau client punya container di VPS berbeda, gue charge gimana?"
- "Tracking cost per VPS tanpa harus SSH satu-satu?"

Tanpa alat ini, jawabannya manual: SSH ke tiap VPS, `docker stats`, kalkulasi manual.

### 1.2 Target Audience

| Segment | Kebutuhan |
|---------|-----------|
| **Indie Developer / Solo Dev** | Side project di 1-3 VPS, tau cost breakdown |
| **DevOps Engineer** | Multi-tenant container deployment, chargeback ke tim/client |
| **VPS Reseller** | Jual container ke client, perlu acuan pricing |
| **Small Team** | Sharing VPS, perlu fair cost splitting |

### 1.3 Goals

1. **Show cost per container** secara real-time berdasarkan resource usage aktual
2. **Multi-VPS support** — agent di tiap VPS push ke central dashboard
3. **Historical tracking** — lihat tren biaya dari waktu ke waktu
4. **Fair allocation** — weighted formula (CPU 50%, RAM 40%, Storage 10%)
5. **REST API** — integrasi dengan tools lain
6. **Role-based access** — admin, engineer, management

### 1.4 Non-Goals

- ❌ Bukan billing system — ga ada payment gateway
- ❌ Bukan cost optimizer — ga kasih rekomendasi ganti provider
- ❌ Bukan container orchestrator — cukup monitor cost aja

---

## 2. Product Overview

### 2.1 Arsitektur Multi-VPS

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  VPS-1 (Agent)       │     │  VPS-2 (Agent)       │     │  VPS-3 (Agent)       │
│  ┌─────────────────┐ │     │  ┌─────────────────┐ │     │  ┌─────────────────┐ │
│  │ Docker Collector │ │     │  │ Docker Collector │ │     │  │ Docker Collector │ │
│  │ Cost Calculator  │ │     │  │ Cost Calculator  │ │     │  │ Cost Calculator  │ │
│  │ Agent Client     │─┼─────┼─►│ Agent Client     │─┼─────┼─►│ Agent Client     │ │
│  └─────────────────┘ │     │  └─────────────────┘ │     │  └─────────────────┘ │
│  config.json:        │     │  config.json:        │     │  config.json:        │
│  name: "Hetzner"     │     │  name: "DOK"         │     │  name: "Vultr"      │
│  cpu: 4, ram: 8GB   │     │  cpu: 8, ram: 16GB   │     │  cpu: 2, ram: 4GB   │
│  price: Rp200rb      │     │  price: Rp350rb      │     │  price: Rp100rb     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                          │                          │
         └──────────────┬───────────┴──────────────┬───────────┘
                        │                          │
               POST /api/v1/push          POST /api/v1/push
               (Bearer API Key)            (Bearer API Key)
                        │                          │
                        ▼                          ▼
            ┌──────────────────────────────────────────┐
            │           CENTRAL SERVER                   │
            │                                            │
            │  ┌──────────┐   ┌────────────┐           │
            │  │Collector │──▶│ Calculator │──▶  DB    │
            │  │ (local)  │   │ (Weighted  │    PG    │
            │  │          │   │  Formula)  │          │
            │  └──────────┘   └─────┬──────┘          │
            │                       │                  │
            │                 ┌─────▼──────────────┐   │
            │                 │  REST API Server    │   │
            │                 │  :8080              │   │
            │                 │  /api/v1/push       │   │
            │                 │  /api/vps/*         │   │
            │                 │  /api/dashboard     │   │
            │                 │  /api/report/*      │   │
            │                 └────────────────────┘   │
            │                                            │
            │  ┌──────────────────────────────────┐      │
            │  │  Frontend Dashboard (Chart.js)    │      │
            │  │  - Multi-VPS overview             │      │
            │  │  - VPS management (admin)         │      │
            │  │  - Cost per container / VPS       │      │
            │  │  - Cost trend charts              │      │
            │  └──────────────────────────────────┘      │
            └────────────────────────────────────────────┘
```

### 2.2 Arsitektur Single VPS (Legacy)

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host (VPS)                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Docker Cost Calculator                │   │
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

### 2.3 Tech Stack

| Layer | Technology | Alasan |
|-------|-----------|--------|
| **Language** | Go 1.22 | Performa tinggi, binary kecil, cocok untuk CLI/tool |
| **Storage** | PostgreSQL 16 | Robust, JSONB untuk snapshot report |
| **API** | net/http (stdlib) | No framework — ringan, mudah di-maintain |
| **Docker API** | Unix socket (HTTP) | Baca stat container langsung dari Docker Engine |
| **Frontend** | Vanilla HTML/CSS/JS + Chart.js | Zero build step, dark theme |
| **Auth** | Session-based (cookie) | Login/logout, bcrypt, 3 role (admin/engineer/management) |
| **Container Registry** | GitHub Container Registry | ghcr.io/edsuwarna/container-cost |

### 2.4 Data Model

```sql
-- VPS Agents (multi-VPS support)
CREATE TABLE vps_agents (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,        -- "Hetzner CX42"
    api_key         VARCHAR(128) UNIQUE NOT NULL,  -- auto-generated
    cpu             DOUBLE PRECISION,             -- from agent report
    ram_gb          DOUBLE PRECISION,
    storage_gb      DOUBLE PRECISION,
    price_per_month DOUBLE PRECISION,
    currency        VARCHAR(10) DEFAULT 'IDR',
    cpu_weight      DOUBLE PRECISION DEFAULT 0.5,
    ram_weight      DOUBLE PRECISION DEFAULT 0.4,
    storage_weight  DOUBLE PRECISION DEFAULT 0.1,
    overhead_percent DOUBLE PRECISION DEFAULT 15.0,
    notes           TEXT DEFAULT '',
    status          VARCHAR(20) DEFAULT 'offline', -- online/offline
    last_seen       TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Cost report snapshots (per VPS)
CREATE TABLE snapshots (
    id          SERIAL PRIMARY KEY,
    vps_id      INTEGER REFERENCES vps_agents(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW(),
    report_json JSONB NOT NULL                     -- Full CostReport
);

-- Users
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    VARCHAR(200),
    role            VARCHAR(20) DEFAULT 'engineer',
    created_at      TIMESTAMP DEFAULT NOW()
);
```

**Report JSON structure** (disimpan di snapshots.report_json):
```json
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
      "container": { "name": "web", "cpu_percent": 2.5, "mem_usage_mb": 128 },
      "cpu_cost": 4750.00,
      "ram_cost": 1500.00,
      "total_cost": 6750.00
    }
  ],
  "overhead_cost": 30000.00,
  "unallocated_cost": 55000.00,
  "total_cost": 200000.00,
  "period": "month"
}
```

---

## 3. Feature Requirements

### 3.1 P0 — Core (Wajib)

| ID | Feature | Priority | Deskripsi |
|----|---------|----------|-----------|
| F1 | Docker Stats Collector | P0 | Collect CPU%, memory, status dari container via Docker socket |
| F2 | Weighted Cost Calculator | P0 | Alokasi biaya per container pake formula terbobot |
| F3 | PostgreSQL Storage | P0 | Simpan snapshot report, users, VPS agents |
| F4 | REST API | P0 | Semua data bisa diakses via HTTP API |
| F5 | VPS Configuration | P0 | Load config dari JSON file |
| F6 | Auth System | P0 | Login/logout, session cookies, bcrypt passwords |

### 3.2 P1 — Important (Penting)

| ID | Feature | Priority | Deskripsi |
|----|---------|----------|-----------|
| F7 | Frontend Dashboard | P1 | UI visual dengan Chart.js (doughnut, bar, line) |
| F8 | Cost History | P1 | Lihat tren biaya dari waktu ke waktu |
| F9 | Role-based Access | P1 | Admin, Engineer, Management — beda akses |
| F10 | User Management | P1 | CRUD users, assign roles, reset password |
| F11 | Docker Deployment | P1 | Dockerfile + docker-compose.yml |
| F12 | Auto-migration | P1 | Database schema auto-create on startup |

### 3.3 P2 — Multi-VPS & Scale (v2.0)

| ID | Feature | Priority | Deskripsi |
|----|---------|----------|-----------|
| F13 | Agent Mode | P2 | `--mode=agent` — jalan di VPS remote |
| F14 | Push API | P2 | `POST /api/v1/push` — agent push report (API key auth) |
| F15 | VPS Management | P2 | CRUD VPS agents dari dashboard |
| F16 | Aggregated Dashboard | P2 | Total cost, containers, overhead across all VPS |
| F17 | API Key Auth | P2 | Agent authentication via Bearer token |
| F18 | Retry & Buffer | P2 | Agent retry 5x kalo central down |
| F19 | Offline Detection | P2 | VPS marked offline if not seen for 24h |
| F20 | GitHub Container Registry | P2 | Image published ke ghcr.io |
| F21 | One-liner Deploy | P2 | `curl ... | bash` — deploy agent dalam 1 command |

---

## 4. Cost Formula

### 4.1 Rumus

```
Biaya Container per Bulan = Total Biaya VPS × (Proporsi Resource Tertimbang)

Langkah:
1. Resource tersedia (setelah overhead OS/Docker 15%):
   CPU_available = Total_CPU × (1 - Overhead)
   RAM_available = Total_RAM × (1 - Overhead)

2. Fraction tiap container:
   CPU_fraction   = CPU_cores_container / CPU_available
   RAM_fraction   = RAM_GB_container / RAM_available
   Storage_fraction = 1 / jumlah_container (equal share)

3. Weighted cost:
   Container_cost = Harga_VPS × (CPU_weight × CPU_fraction
                                + RAM_weight × RAM_fraction
                                + Storage_weight × Storage_fraction)
                             / (CPU_weight + RAM_weight + Storage_weight)
```

### 4.2 Default Weights

| Resource | Weight | Alasan |
|----------|--------|--------|
| CPU | 50% | Paling sering jadi bottleneck |
| RAM | 40% | Kedua paling penting |
| Storage | 10% | Relatif murah |
| Network | 0% | Reserved untuk future |

### 4.3 Overhead Cost

Biaya OS dan Docker itu sendiri (~15% dari total VPS):
- CPU overhead: total_CPU × overhead_percent
- RAM overhead: total_RAM × overhead_percent
- Overhead dihitung secara proporsional

### 4.4 Contoh Multi-VPS

**VPS-1 (Hetzner):** Rp 200.000/bulan, 4 CPU, 8GB RAM → 3 container
**VPS-2 (DOK):** Rp 350.000/bulan, 8 CPU, 16GB RAM → 5 container

**Total biaya semua VPS:** Rp 200.000 + Rp 350.000 = **Rp 550.000/bulan**
**Total container:** 8 container dari 2 VPS
**Biaya per container:** dihitung otomatis per VPS masing-masing

---

## 5. API Specifications

### 5.1 Endpoints

#### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/check` | Check session |

#### Agent Push (API Key auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/push` | Agent pushes cost report (Authorization: Bearer <key>) |

#### Dashboard (Authenticated)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/report/latest` | Latest snapshot |
| POST | `/api/report/refresh` | Generate report (local collector only) |
| GET | `/api/report/history` | Historical reports |
| GET | `/api/containers` | List containers + cost |
| GET | `/api/containers/{name}` | Container cost history |
| GET | `/api/costs/trends` | Cost trend data |
| GET | `/api/dashboard` | Aggregated multi-VPS report |
| GET/PUT | `/api/config` | VPS config |

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
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/{id}` | Update role |
| DELETE | `/api/users/{id}` | Delete user |
| POST | `/api/users/{id}/reset-password` | Reset password |

### 5.2 Agent Push Request (POST /api/v1/push)

```
Headers:
  Authorization: Bearer dckr_a1b2c3d4...

Body (CostReport JSON):
{
  "vps": {
    "name": "Hetzner CX42",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
    "currency": "IDR"
  },
  "containers": [...],
  "total_cost": 200000.00
}

Response 200:
{
  "status": "accepted",
  "snapshot_id": 42
}
```

### 5.3 Error Handling

```json
{
  "error": "failed to collect stats",
  "details": "cannot connect to docker socket: dial unix /var/run/docker.sock"
}
```

Semua error response: `{ "error": string, "details?": string }`

---

## 6. Konfigurasi

### 6.1 File: `~/.docker-cost/config.json`

#### Server Mode:
```json
{
  "name": "My VPS",
  "price_per_month": 200000,
  "cpu_cores": 4,
  "ram_gb": 8,
  "storage_gb": 100,
  "currency": "IDR",
  "cpu_weight": 0.5,
  "ram_weight": 0.4,
  "storage_weight": 0.1,
  "overhead_percent": 15
}
```

#### Agent Mode (FullConfig):
```json
{
  "vps": {
    "name": "Hetzner CX42",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
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

### 6.2 Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `8080` | Port HTTP server |
| `DATABASE_URL` | `postgres://docker-cost:***@localhost:5432/docker-cost?sslmode=disable` | PostgreSQL connection |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket path |
| `DOCKER_COST_CONFIG_DIR` | `~/.docker-cost` | Direktori config |

---

## 7. CLI Usage

### Server Mode (default)
```bash
docker-cost
# atau
docker-cost --mode=server
```

### Agent Mode
```bash
docker-cost \
  --mode=agent \
  --server=http://central-ip:8080 \
  --api-key=dckr_xxx \
  --push-interval=60
```

### Docker (image: ghcr.io/edsuwarna/container-cost)
```bash
# Server
docker run -d -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/edsuwarna/container-cost:latest

# Agent
docker run -d \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent --server=http://central:8080 --api-key=dckr_xxx
```

---

## 8. Milestone

### ✅ v1.0 — Core
- [x] Docker stats collector
- [x] Cost calculator engine
- [x] SQLite storage (legacy) / PostgreSQL storage
- [x] REST API endpoints
- [x] VPS config

### ✅ v1.1 — Dashboard & Deployment
- [x] Frontend dashboard (Chart.js)
- [x] Cost charts (doughnut, bar, line)
- [x] Container detail page
- [x] Dockerfile + docker-compose.yml
- [x] Auth system (login, roles, sessions)
- [x] User management (CRUD)

### ✅ v2.0 — Multi-VPS Scale
- [x] Multi-VPS agent mode
- [x] Agent push API (API key auth)
- [x] VPS management (CRUD from dashboard)
- [x] Aggregated dashboard (across all VPS)
- [x] Agent retry mechanism
- [x] VPS offline detection
- [x] GitHub Container Registry (ghcr.io)
- [x] One-liner agent deployment script

### 📋 Future
- [ ] Cost alerts (webhook/telegram)
- [ ] Export CSV/PDF
- [ ] Per-period breakdown (hour/day/week)
- [ ] Cost comparison chart antar VPS
- [ ] Telegram bot for daily report

---

## 9. Glossary

| Istilah | Definisi |
|---------|----------|
| **VPS** | Virtual Private Server — server virtual tempat container jalan |
| **Agent** | Binary/container yang jalan di tiap VPS, collect & push report |
| **Central Server** | Server pusat yang nerima data dari semua agent |
| **Container** | Docker container yang jalan di VPS |
| **Snapshot** | Cuplikan cost report di satu titik waktu |
| **Overhead** | Resource yang dipakai OS dan Docker itu sendiri |
| **Unallocated** | Resource VPS yang tidak dipakai container (idle) |
| **Weighted allocation** | Pembagian biaya berdasarkan bobot resource |
| **ghcr.io** | GitHub Container Registry — tempat image Docker di-host |
| **API Key** | Token unik per VPS agent buat autentikasi ke central |

---

## 10. Deployment

### One-liner Agent Setup
```bash
curl -fsSL https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh | bash -s -- \
  --server=http://CENTRAL_IP:8080 \
  --api-key=dckr_lanjka... \
  --name="My VPS" \
  --price=200000 \
  --cpu=4 \
  --ram=8
```

### Docker Compose (Central Server)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: docker-cost
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: docker-cost
    volumes:
      - pgdata:/var/lib/postgresql/data

  container-cost:
    image: ghcr.io/edsuwarna/container-cost:latest
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./config.json:/root/.docker-cost/config.json:ro
    environment:
      - DATABASE_URL=postgres://docker-cost:***@postgres:5432/docker-cost?sslmode=disable
```

### Docker Compose (Agent)
```yaml
services:
  container-cost-agent:
    image: ghcr.io/edsuwarna/container-cost:latest
    command: >
      --mode=agent
      --server=http://CENTRAL_IP:8080
      --api-key=dckr_xxx
      --push-interval=60
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./config.json:/root/.docker-cost/config.json:ro
    restart: unless-stopped
```

---

## 11. Related Documents

- [README.md](./README.md) — Dokumentasi teknis & cara pakai
- [Makefile](./Makefile) — Build commands
- [deploy/setup-agent.sh](./deploy/setup-agent.sh) — One-liner agent deployment
- [docker-compose.yml](./docker-compose.yml) — Central server deployment
- [docker-compose.agent.yml](./docker-compose.agent.yml) — Agent deployment
