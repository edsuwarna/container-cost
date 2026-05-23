# Docker Cost Calculator 💰🐳

> Hitung biaya container Docker berdasarkan resource usage aktual di VPS.

Docker Cost Calculator membantu developer/DevOps melihat seberapa besar biaya yang dipakai setiap container di VPS. Cocok buat **chargeback**, **cost tracking**, atau sekedar tahu container mana yang paling boros tanpa nebak-nebak.

---

## ✨ Fitur

- 🔍 **Collect otomatis** — Baca stat CPU/RAM dari semua container via Docker socket
- 🧮 **Weighted cost allocation** — Hitung biaya per container pake formula terbobot
- 💾 **Riwayat SQLite** — Simpan snapshot tiap kali refresh
- 📡 **REST API** — Integrasi dengan dashboard, bot, atau tools lain
- ⚡ **Binary kecil** — ~7MB, zero dependency runtime

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

## 🚀 Quick Start

### 1. Prasyarat

- Docker (dengan Docker socket `/var/run/docker.sock`)
- Go 1.22+ (untuk build)
- SQLite3 (terinstall di OS)

```bash
# Install sistem dependencies (Debian/Ubuntu)
sudo apt-get update && sudo apt-get install -y gcc libc6-dev sqlite3

# Clone atau copy project
cd /home/ubuntu/docker-cost
```

### 2. Konfigurasi VPS

```bash
mkdir -p ~/.docker-cost
```

Buat file `~/.docker-cost/config.json`:

```json
{
  "name": "VPS Gue",
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

| Field | Type | Default | Deskripsi |
|-------|------|---------|-----------|
| `name` | string | "My VPS" | Nama VPS (untuk display) |
| `price_per_month` | float | 200000 | Harga VPS per bulan |
| `cpu_cores` | float | 4 | Total CPU cores |
| `ram_gb` | float | 8 | Total RAM dalam GB |
| `storage_gb` | float | 100 | Total storage dalam GB |
| `currency` | string | "IDR" | Mata uang (IDR/USD/etc) |
| `cpu_weight` | float | 0.5 | Bobot CPU (50%) |
| `ram_weight` | float | 0.4 | Bobot RAM (40%) |
| `storage_weight` | float | 0.1 | Bobot storage (10%) |
| `overhead_percent` | float | 15 | Overhead OS/Docker (%) |

### 3. Build & Run

```bash
# Build
make build

# Run
./build/docker-cost

# Atau langsung tanpa build
make run-quick
```

Output:
```
2026/05/23 14:30:00 Initial snapshot saved (id=1)
2026/05/23 14:30:00 Docker Cost Calculator starting on :8080
2026/05/23 14:30:00 Config: /home/ubuntu/.docker-cost/config.json
2026/05/23 14:30:00 Database: /home/ubuntu/.docker-cost/docker-cost.db
```

### 4. Cek API

```bash
# Health check
curl http://localhost:8080/api/health

# Generate report baru
curl -X POST http://localhost:8080/api/report/refresh

# Lihat report terakhir
curl http://localhost:8080/api/report/latest | jq .

# List container + cost
curl http://localhost:8080/api/containers | jq .
```

---

## 📡 API Documentation

### Base URL

```
http://localhost:8080
```

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/health` | Health check | ❌ |
| `POST` | `/api/report/refresh` | Collect stats + generate report baru | ❌ |
| `GET` | `/api/report/latest` | Report cost terakhir | ❌ |
| `GET` | `/api/report/history` | Histori report (default 7 hari) | ❌ |
| `GET` | `/api/containers` | List container + cost per bulan | ❌ |
| `GET` | `/api/containers/{name}` | Cost history per container | ❌ |
| `GET` | `/api/config` | Lihat konfigurasi VPS | ❌ |
| `PUT` | `/api/config` | Update konfigurasi VPS | ❌ |

### Contoh Response

**GET /api/report/latest**
```json
{
  "vps": {
    "name": "VPS Gue",
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
  },
  {
    "timestamp": "2026-05-23T13:00:00Z",
    "name": "web",
    "cpu_percent": 3.1,
    "mem_usage_mb": 132,
    "total_cost": 7100.00
  }
]
```

---

## 🏗️ Project Structure

```
docker-cost/
├── cmd/
│   └── server/
│       └── main.go            # Entry point, wiring dependencies
├── internal/
│   ├── collector/
│   │   └── docker.go          # Docker socket -> ContainerStats
│   ├── calculator/
│   │   └── cost.go            # Cost formula engine
│   ├── storage/
│   │   └── sqlite.go          # SQLite CRUD
│   ├── api/
│   │   └── handler.go         # HTTP handlers
│   └── config/
│       └── config.go          # VPSConfig loader/saver
├── web/                        # Frontend (coming soon)
├── build/                      # Compiled binary
├── Makefile
├── go.mod / go.sum
├── PRD.md                      # Product Requirements Document
└── README.md                   # You are here
```

### Package Dependency

```
cmd/server/main.go
    │
    ├── internal/config      (VPSConfig struct, load/save JSON)
    ├── internal/collector   (Docker API via Unix socket)
    ├── internal/calculator  (Cost formula: weighted allocation)
    ├── internal/storage     (SQLite: snapshots table)
    └── internal/api         (HTTP handlers, routing)
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
Calculate ──▶ SaveSnapshot() ──▶ SQLite (snapshots table)
                 │
                 ▼
         REST API endpoints
         - GET /api/report/latest
         - GET /api/report/history
         - GET /api/containers
```

---

## 🔧 Development

### Prerequisites

```bash
# Go 1.22+
go version

# C compiler (untuk SQLite CGO)
gcc --version
```

### Commands

```bash
# Build binary
make build

# Run langsung (tanpa build)
make run-quick

# Test
make test

# Clean
make clean

# Build static binary
make build-static
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

## 🐳 Docker Deployment

Coming soon di fase v1.2. Rencana `Dockerfile`:

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /app
COPY . .
RUN make build

FROM alpine:3.19
RUN apk add --no-cache ca-certificates sqlite-libs
COPY --from=builder /app/build/docker-cost /usr/local/bin/
VOLUME /data
EXPOSE 8080
CMD ["docker-cost"]
```

```yaml
# docker-compose.yml
services:
  docker-cost:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ~/.docker-cost:/root/.docker-cost
    environment:
      - PORT=8080
```

---

## 🚦 Status & Roadmap

### ✅ v1.0 — Core (Done)
- [x] Docker stats collector via Unix socket
- [x] Weighted cost allocation formula
- [x] SQLite storage with auto-migration
- [x] REST API (7 endpoints)
- [x] VPS config from JSON file
- [x] Startup snapshot
- [x] CORS support

### 🔄 v1.1 — Dashboard (Next)
- [ ] React/Svelte frontend
- [ ] Cost chart (per container daily trend)
- [ ] Container detail page
- [ ] Dark mode UI

### 📋 v1.2 — Integration
- [ ] Docker image publish
- [ ] Telegram bot for daily report
- [ ] Scheduled auto-refresh
- [ ] Config backup/export

### 🚀 v2.0 — Scale
- [ ] Multi-VPS mode (agent + central)
- [ ] Cost alerts (webhook)
- [ ] Export CSV/PDF
- [ ] Role-based access

---

## ⚙️ Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `8080` | Port HTTP server |
| `DOCKER_HOST` | `/var/run/docker.sock` | Path ke Docker socket |
| `DOCKER_COST_CONFIG_DIR` | `~/.docker-cost` | Direktori config & database |

---

## 🧪 Edge Cases Handled

| Skenario | Handling |
|----------|----------|
| Docker ga terinstall | Collector.available=false, return error dengan pesan jelas |
| Container baru jalan | Terdeteksi di listContainers, masuk next report |
| Container berhenti/mati | Stats = 0, cost minimal |
| Config file belum ada | Auto-create dengan default values |
| DB file belum ada | Auto-create + migrate |
| Report kosong (belum pernah refresh) | Return message: "no reports yet" |
| Container name sama | Container ID tetap unik |
| CPU delta 0 (container idle) | Cost minimal (ga ada aktivitas CPU) |
| Overweight (weights > 1) | Normalized — totalWeight dipake sebagai divisor |

---

## 🤝 Kontribusi

Lagi open source friendly! Beberapa cara bantu:

1. **Report bug** — buka issue di repo
2. **Request feature** — PRD udah ada list P2-nya
3. **Pull request** — langsung aja
4. **Frontend** — butuh React/Svelte developer buat dashboard

---

## 📄 License

MIT — bebas dipake, dimodif, didistribusiin.

---

## 👤 Author

**Endang Suwarna** — DevOps Engineer & AI Infrastructure Enthusiast

---

## 📚 Related

- [PRD.md](./PRD.md) — Product Requirements Document (detail lengkap)
- [Docker Engine API](https://docs.docker.com/engine/api/v1.43/) — Docker API reference
- [mattn/go-sqlite3](https://github.com/mattn/go-sqlite3) — SQLite driver for Go
