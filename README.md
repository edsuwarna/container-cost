# Docker Cost Calculator 💰🐳

> Hitung biaya container Docker berdasarkan resource usage aktual di VPS — **dengan dashboard & auth!**

Docker Cost Calculator membantu developer/DevOps melihat seberapa besar biaya yang dipakai setiap container di VPS. Cocok buat **chargeback**, **cost tracking**, atau sekedar tahu container mana yang paling boros tanpa nebak-nebak.

---

## ✨ Fitur

- 🔍 **Collect otomatis** — Baca stat CPU/RAM dari semua container via Docker socket
- 🧮 **Weighted cost allocation** — Hitung biaya per container pake formula terbobot (CPU 50%, RAM 40%, Storage 10%)
- 💾 **PostgreSQL storage** — Simpan snapshot + user data
- 📡 **REST API** — Integrasi dengan tools lain
- 🔐 **Auth & Role-based access** — Login/logout, 3 role (admin/engineer/management)
- 📊 **Dashboard UI** — Chart cost distribution, breakdown, trend, container history
- ⚡ **Auto refresh** — Generate report otomatis tiap 30 detik
- 🐳 **Docker Compose ready** — 2 service (Go app + PostgreSQL)

## 📊 Preview

```
Container           CPU%    RAM      Cost/Bulan
───────────────────────────────────────────────
vps-dashboard       2.5%    128 MB    Rp  6.500
vps-dashboard-db    1.2%    256 MB    Rp  9.200
nginx-proxy         0.8%     64 MB    Rp  3.100
postgres            15.2%   1.2 GB    Rp 45.800
───────────────────────────────────────────────
Overhead (OS/Docker)                   Rp 28.000
Unallocated (idle)                     Rp 37.400
TOTAL VPS                              Rp200.000
```

---

## 🚀 Quick Start (Docker)

### 1. Clone & konfigurasi

```bash
git clone <repo-url>
cd docker-cost

# Config sudah include di docker-compose.yml
# Default: Rp 200.000/bulan, 4 CPU, 8 GB RAM
```

### 2. Jalankan

```bash
docker compose up -d
```

### 3. Buka dashboard

```
http://localhost:8081
```

**Login default:** `admin` / `change-me`

### 4. Generate report pertama

Klik tombol **🔄 Generate Report** di dashboard, atau via API:

```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}' \
  -c cookies.txt

curl -X POST http://localhost:8081/api/report/refresh \
  -b cookies.txt
```

---

## 📡 API Documentation

### Base URL

```
http://localhost:8081
```

### Unauthenticated

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/login` | Login (dapet session cookie) |
| `GET` | `/api/auth/check` | Cek status session |

### Authenticated (perlu session cookie)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/report/latest` | Report cost terakhir |
| `POST` | `/api/report/refresh` | Collect stats + generate report baru |
| `GET` | `/api/report/history` | Histori report (default 7 hari) |
| `GET` | `/api/containers` | List container + cost per bulan |
| `GET` | `/api/containers/{name}` | Cost history per container (50 snapshot) |
| `GET` | `/api/config` | Lihat konfigurasi VPS |
| `PUT` | `/api/config` | Update konfigurasi VPS |
| `GET` | `/api/costs/trends` | Tren biaya harian |

### Admin Only

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | List semua user |
| `POST` | `/api/users` | Tambah user baru |
| `PUT` | `/api/users/{id}` | Update role user |
| `DELETE` | `/api/users/{id}` | Hapus user |
| `POST` | `/api/users/{id}/reset-password` | Reset password user |

### Contoh Response

**GET /api/report/latest**
```json
{
  "vps": {
    "name": "My VPS",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
    "currency": "IDR"
  },
  "containers": [
    {
      "container": {
        "name": "web",
        "id": "abc123def456",
        "image": "nginx:alpine",
        "cpu_percent": 2.5,
        "mem_usage_mb": 128,
        "status": "running"
      },
      "cpu_cost": 4750.00,
      "ram_cost": 1500.00,
      "storage_cost": 500.00,
      "total_cost": 6750.00
    }
  ],
  "overhead_cost": 30000.00,
  "unallocated_cost": 55000.00,
  "total_cost": 200000.00,
  "period": "month"
}
```

**GET /api/containers/web**
```json
[
  {
    "timestamp": "2026-05-23T12:00:00Z",
    "name": "web",
    "cpu_percent": 2.5,
    "mem_usage_mb": 128,
    "total_cost": 6750.00
  }
]
```

---

## 🏗️ Project Structure

```
docker-cost/
├── cmd/
│   └── server/
│       └── main.go              # Entry point, wiring dependencies
├── internal/
│   ├── collector/
│   │   └── docker.go            # Docker socket → ContainerStats
│   ├── calculator/
│   │   └── cost.go              # Cost formula engine (weighted)
│   ├── storage/
│   │   └── postgres.go          # PostgreSQL CRUD (users, snapshots)
│   ├── api/
│   │   └── handler.go           # HTTP handlers + auth middleware
│   └── config/
│       └── config.go            # VPSConfig loader/saver
├── web/
│   └── dist/
│       ├── index.html           # Dashboard HTML
│       ├── css/style.css        # Dark theme CSS
│       └── js/app.js            # Frontend logic (Chart.js)
├── Dockerfile                   # Multi-stage Go build
├── docker-compose.yml           # App + PostgreSQL
├── Makefile                     # Build/run/test commands
├── go.mod / go.sum
├── PRD.md                       # Product Requirements Document
└── README.md                    # You are here
```

### Package Dependency

```
cmd/server/main.go
    │
    ├── internal/config      (VPSConfig struct, load/save JSON)
    ├── internal/collector   (Docker API via Unix socket)
    ├── internal/calculator  (Cost formula: weighted allocation)
    ├── internal/storage     (PostgreSQL: snapshots + users)
    └── internal/api         (HTTP handlers, routing, auth)
```

---

## 🧮 Cara Kerja Cost Calculator

### 1. Collect

```
Docker Socket ──▶ listContainers() ──▶ getContainerStats(id)
                    │                       │
                    ▼                       ▼
              Container list           CPU delta, mem usage
              (id, name, image)        (from /containers/{id}/stats)
```

Collector membaca Docker API via Unix socket (`/var/run/docker.sock`):
- List container: `GET /containers/json`
- Stat per container: `GET /containers/{id}/stats?stream=false`

CPU dihitung dari delta antara waktu sekarang dan sebelumnya (mirip `docker stats`).

### 2. Calculate

```
Stat Container ──▶ CPU Fraction  ──▶ Weight ──▶ Container Cost
                  RAM Fraction  ──▶ Weight ──▶ Container Cost
                  Storage        ──▶ Weight ──▶ Container Cost
                                +
                        Overhead Cost
                        Unallocated Cost
                                =
                      Total VPS Cost
```

Rumus lengkapnya ada di [PRD.md → Cost Formula](./PRD.md#4-cost-formula).

### 3. Store & Serve

```
Calculate ──▶ SaveSnapshot() ──▶ PostgreSQL (snapshots table)
                 │
                 ▼
         REST API endpoints + Web Dashboard
```

---

## 🔐 Auth System

| Role | Akses |
|------|-------|
| **admin** | Full — semua halaman + user management |
| **engineer** | Dashboard, Containers, Settings |
| **management** | Dashboard (read-only), Containers |

**Default user:**
- `admin` / `change-me` — Admin
- `eng` / `change-me` — Engineer
- `mgt` / `change-me` — Management

---

## ⚙️ Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `8080` | Port HTTP server |
| `DOCKER_COST_CONFIG_DIR` | `/data` | Direktori config |
| `DATABASE_URL` | `postgres://docker-cost:***@postgres:5432/docker-cost?sslmode=disable` | Koneksi PostgreSQL |
| `ADMIN_PASSWORD` | `change-me` | Password default admin |
| `TZ` | `Asia/Jakarta` | Timezone |

---

## 🚦 Status & Roadmap

### ✅ v1.0 — Core
- [x] Docker stats collector via Unix socket
- [x] Weighted cost allocation formula (CPU 50%, RAM 40%, Storage 10%)
- [x] PostgreSQL storage with auto-migration
- [x] REST API (13 endpoints)
- [x] VPS config from JSON file
- [x] Startup snapshot

### ✅ v1.1 — Dashboard
- [x] HTML/CSS/JS frontend with Chart.js
- [x] Cost distribution chart (doughnut)
- [x] Cost breakdown chart (bar)
- [x] Cost trend chart (line — dual axis: cost + containers)
- [x] Container detail with cost history chart
- [x] Period filter (latest/7d/30d/all)
- [x] Auto-refresh every 30s

### ✅ v1.2 — Auth & Security
- [x] Login/logout with session cookies
- [x] bcrypt password hashing
- [x] Role-based access (3 roles)
- [x] User management CRUD (admin)
- [x] Rate limiting on login
- [x] Docker Compose deployment

### 📋 v2.0 — Integration (Next)
- [ ] Telegram bot for daily reports
- [ ] Multi-VPS mode
- [ ] Cost alerts (webhook)
- [ ] Export CSV/PDF
- [ ] Scheduled reports (cron)

---

## 🧪 Edge Cases Handled

| Skenario | Handling |
|----------|----------|
| Docker ga terinstall | Collector.available=false, return error dengan pesan jelas |
| Container baru jalan | Terdeteksi di listContainers, masuk next report |
| Container berhenti/mati | Stats = 0, cost minimal |
| Config file belum ada | Auto-create dengan default values |
| DB belum ada | Auto-create + migrate |
| Report kosong (belum pernah refresh) | Return message: "no reports yet" |
| Container name sama | Container ID tetap unik |
| CPU delta 0 (container idle) | Cost minimal (ga ada aktivitas CPU) |
| Overweight (weights > 1) | Normalized — totalWeight dipake sebagai divisor |

---

## 🔧 Development

### Prerequisites

```bash
# Go 1.22+
go version

# Docker (untuk collect container stats)
docker ps
```

### Commands

```bash
# Build binary
make build

# Test
make test

# Run with Docker
docker compose up -d
```

### Testing

```bash
# Semua test
go test -v -race ./...

# Coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

> **Note:** Testing butuh Docker socket. Kalo ga ada Docker, test collector bakal skip.

---

## 👤 Author

**Endang Suwarna** — DevOps Engineer & AI Infrastructure Enthusiast

## 📚 Related

- [PRD.md](./PRD.md) — Product Requirements Document (detail lengkap)
- [Docker Engine API](https://docs.docker.com/engine/api/v1.43/) — Docker API reference
- [Chart.js](https://www.chartjs.org/) — Frontend chart library
