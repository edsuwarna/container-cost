# Docker Cost Calculator — PRD

> **Product Requirements Document**
> **Version:** 1.0
> **Status:** Draft
> **Author:** Endang Suwarna

---

## 1. Executive Summary

**Docker Cost Calculator** adalah alat untuk menghitung alokasi biaya container Docker berdasarkan resource yang digunakan (CPU, RAM, Storage) di atas sebuah VPS. Setiap container yang jalan di VPS yang sama berbagi resource VPS tersebut — dengan kalkulator ini, kita bisa tahu secara fair berapa biaya masing-masing container per bulan.

### 1.1 Problem Statement

Developer/DevOps yang menjalankan banyak container di satu VPS sering kesulitan menjawab pertanyaan:

- "Container A make biaya berapa per bulan?"
- "Kalau client bayar sekian, untung gue berapa setelah dikurangi biaya VPS?"
- "Container mana yang paling boros resource?"
- "Apakah harga VPS yang gue bayar sebanding dengan yang dipake?"

Tanpa alat ini, jawabannya cuma perkiraan kasar karena resource sharing antar container.

### 1.2 Target Audience

| Segment | Kebutuhan |
|---------|-----------|
| **Indie Developer / Solo Dev** | Side project di VPS murah, pingin tau cost breakdown |
| **DevOps Engineer** | Multi-tenant container deployment, chargeback ke tim/client |
| **VPS Reseller** | Jual container ke client, perlu acuan pricing |
| **Small Team** | Sharing 1 VPS, perlu fair cost splitting |

### 1.3 Goals

1. **Show cost per container** secara real-time berdasarkan resource usage aktual
2. **Historical tracking** — lihat tren biaya dari waktu ke waktu
3. **Fair allocation** — weighted formula yang representatif (CPU 50%, RAM 40%, Storage 10%)
4. **REST API first** — biar gampang diintegrasi sama tools lain (dashboard, bot, dll)
5. **Zero dependency on cloud APIs** — semua berjalan lokal via Docker socket

### 1.4 Non-Goals

- ❌ Bukan billing system — ga ada payment gateway
- ❌ Bukan cost optimizer — ga kasih rekomendasi ganti provider
- ❌ Bukan container orchestrator — cukup monitor cost aja
- ❌ Bukan multi-VPS agent — arsitektur single VPS dulu

---

## 2. Product Overview

### 2.1 Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host (VPS)                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Docker Cost Calculator                │   │
│  │                                                    │   │
│  │  ┌──────────┐   ┌────────────┐   ┌────────────┐  │   │
│  │  │Collector │──▶│ Calculator │──▶│  Storage    │  │   │
│  │  │(Docker   │   │ (Weighted  │   │ (SQLite)    │  │   │
│  │  │ socket)  │   │  Formula)  │   │             │  │   │
│  │  └──────────┘   └─────┬──────┘   └──────┬──────┘  │   │
│  │                       │                  │         │   │
│  │                 ┌─────▼──────────────────▼──────┐  │   │
│  │                 │        REST API Server         │  │   │
│  │                 │        (port :8080)           │  │   │
│  │                 └───────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │Container│  │Container│  │Container│                  │
│  │   A     │  │   B     │  │   C     │                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Tech Stack

| Layer | Technology | Alasan |
|-------|-----------|--------|
| **Language** | Go 1.22 | Performa tinggi, binary kecil, cocok untuk CLI/tool |
| **Storage** | SQLite (mattn/go-sqlite3) | Zero config, embedded, cukup untuk single VPS |
| **API** | net/http (stdlib) | No framework — ringan, mudah di-maintain |
| **Docker API** | Unix socket (HTTP) | Baca stat container langsung dari Docker Engine |
| **Masa depan** | React/Svelte (dashboard) | Frontend SPA ringan |

### 2.3 Data Model

```
┌──────────────────────────────┐
│         VPSConfig            │
├──────────────────────────────┤
│ name: string                 │
│ price_per_month: float64     │
│ cpu_cores: float64           │
│ ram_gb: float64              │
│ storage_gb: float64          │
│ currency: string             │
│ cpu_weight: float64 [0.5]    │
│ ram_weight: float64 [0.4]    │
│ storage_weight: float64 [0.1]│
│ overhead_percent: float64    │
└──────────────────────────────┘

┌──────────────────────────────┐
│        ContainerCost         │
├──────────────────────────────┤
│ name: string                 │
│ cpu_percent: float64         │
│ mem_usage_mb: float64        │
│ mem_limit_mb: float64        │
│ cpu_cost: float64            │
│ ram_cost: float64            │
│ storage_cost: float64        │
│ total_cost: float64          │
└──────────────────────────────┘

┌──────────────────────────────┐
│         CostReport           │
├──────────────────────────────┤
│ vps: VPSInfo                 │
│ containers: []ContainerCost  │
│ overhead_cost: float64       │
│ unallocated_cost: float64    │
│ total_cost: float64          │
│ period: string               │
│ created_at: datetime         │
└──────────────────────────────┘

Database:
┌──────────────────────────────────────────┐
│              snapshots                    │
├──────────────────────────────────────────┤
│ id (PK)  │  created_at  │  report_json   │
│ INTEGER  │  DATETIME    │  TEXT (JSON)    │
└──────────────────────────────────────────┘
```

---

## 3. Feature Requirements

### 3.1 P0 — Core (Wajib)

| ID | Feature | Priority | Deskripsi |
|----|---------|----------|-----------|
| F1 | Docker Stats Collector | P0 | Collect CPU%, memory usage, status dari semua container via Docker socket |
| F2 | Weighted Cost Calculator | P0 | Alokasi biaya per container pake formula terbobot |
| F3 | SQLite Storage | P0 | Simpan snapshot report ke database |
| F4 | GET /api/report/latest | P0 | Lihat report terakhir |
| F5 | POST /api/report/refresh | P0 | Generate report baru (collect + calculate + save) |
| F6 | GET /api/containers | P0 | List container beserta cost-nya |
| F7 | VPS Configuration | P0 | Load config dari JSON file (~/.docker-cost/config.json) |

### 3.2 P1 — Important (Penting)

| ID | Feature | Priority | Deskripsi |
|----|---------|----------|-----------|
| F8 | GET /api/report/history | P1 | Histori report (default 7 hari) |
| F9 | GET /api/containers/{name} | P1 | Detail biaya spesifik container dari waktu ke waktu |
| F10 | Startup snapshot | P1 | Auto-generate report saat aplikasi pertama jalan |
| F11 | CORS support | P1 | Biar frontend bisa consume API dari domain beda |
| F12 | GET/PUT /api/config | P1 | Lihat/update konfigurasi via API |

### 3.3 P2 — Future (Nanti)

| ID | Feature | Priority | Deskripsi |
|----|---------|----------|-----------|
| F13 | React Dashboard | P2 | UI visual buat liat chart cost |
| F14 | Per-period breakdown | P2 | Biaya per jam/hari/bulan |
| F15 | Docker image | P2 | Jalan sebagai container |
| F16 | Telegram bot notification | P2 | Laporan harian ke grup |
| F17 | Multi-VPS support | P2 | Agent di tiap VPS, central collector |
| F18 | Cost alert threshold | P2 | Notifikasi kalau biaya naik drastis |
| F19 | Export to CSV | P2 | Download raw data |
| F20 | Backup config | P2 | Export/import config |

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

Biaya OS dan Docker itu sendiri (biasanya ~15% dari total VPS):
- CPU overhead: total_CPU × overhead_percent
- RAM overhead: total_RAM × overhead_percent
- Overhead dihitung secara proporsional

### 4.4 Contoh Kasus

**Konfigurasi VPS:**
- Harga: Rp 200.000/bulan
- CPU: 4 core
- RAM: 8 GB
- Overhead: 15%

**Container A (Nginx):** 15% CPU, 256 MB RAM
**Container B (Postgres):** 35% CPU, 2 GB RAM

**Hasil:**
- CPU tersedia: 4 × 0.85 = 3.4 core
- RAM tersedia: 8 × 0.85 = 6.8 GB
- Container A: ~Rp 13.500/bulan (CPU) + Rp 2.400/bulan (RAM) = **~Rp 16.500/bulan**
- Container B: ~Rp 31.500/bulan (CPU) + Rp 18.800/bulan (RAM) = **~Rp 51.000/bulan**
- Overhead: ~Rp 30.000/bulan
- Unallocated: sisanya (resource yang nganggur)

---

## 5. API Specifications

### 5.1 Endpoints

#### GET /api/health
```json
{
  "status": "ok",
  "time": "2026-05-23T14:30:00Z"
}
```

#### POST /api/report/refresh
```json
// Response 200
{
  "message": "report generated",
  "snapshot_id": 42,
  "report": { /* CostReport object */ }
}
```

#### GET /api/report/latest
```json
// Response 200
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
      "container": { "name": "web", "cpu_percent": 12.5, ... },
      "cpu_cost": 10500.00,
      "ram_cost": 2400.00,
      "total_cost": 15400.00
    }
  ],
  "overhead_cost": 30000.00,
  "unallocated_cost": 45000.00,
  "total_cost": 200000.00,
  "period": "month"
}
```

#### GET /api/report/history?since=2026-01-01T00:00:00Z
```json
[ /* array of CostReport */ ]
```

#### GET /api/containers
```json
[
  {
    "name": "web",
    "image": "nginx:alpine",
    "cpu_percent": 12.5,
    "mem_usage_mb": 256,
    "cost_per_month": 15400.00,
    "cpu_cost": 10500.00,
    "ram_cost": 2400.00,
    "status": "running"
  }
]
```

#### GET /api/containers/{name}
```json
[
  {
    "timestamp": "2026-05-23T12:00:00Z",
    "name": "web",
    "cpu_percent": 12.5,
    "mem_usage_mb": 256.0,
    "total_cost": 15400.00
  }
]
```

#### GET/PUT /api/config
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

### 5.2 Error Handling

```json
{
  "error": "failed to collect stats",
  "details": "cannot connect to docker socket: dial unix /var/run/docker.sock"
}
```

Semua error response pakai format: `{ "error": string, "details?": string }`

---

## 6. Konfigurasi

### 6.1 File: `~/.docker-cost/config.json`

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
  "overhead_percent": 15
}
```

### 6.2 Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `8080` | Port HTTP server |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket path |
| `DOCKER_COST_CONFIG_DIR` | `~/.docker-cost` | Direktori config & database |

---

## 7. Non-Functional Requirements

| Aspek | Target |
|-------|--------|
| **Startup time** | < 1 detik |
| **Memory usage** | < 50 MB |
| **Binary size** | < 10 MB |
| **API latency** | < 500ms untuk report fresh, < 100ms untuk cached |
| **Data retention** | Unlimited (SQLite) — pruning opsional |
| **Uptime** | Stateless design — tinggal restart |
| **Security** | Hanya akses Docker socket lokal, tanpa auth |

---

## 8. Milestone & Timeline

### Phase 1: Core (v1.0) ✅ Done
- [x] Docker stats collector
- [x] Cost calculator engine
- [x] SQLite storage
- [x] REST API endpoints
- [x] VPS config

### Phase 2: Dashboard (v1.1) — Next
- [ ] React/Vue frontend
- [ ] Cost chart visual
- [ ] Container detail view

### Phase 3: Integration (v1.2)
- [ ] Docker image & docker-compose
- [ ] Telegram bot integration
- [ ] Scheduled reports

### Phase 4: Scale (v2.0)
- [ ] Multi-VPS mode
- [ ] Cost alerts
- [ ] Export/backup

---

## 9. Glossary

| Istilah | Definisi |
|---------|----------|
| **VPS** | Virtual Private Server — server virtual tempat container jalan |
| **Container** | Docker container yang jalan di VPS |
| **Snapshot** | Cuplikan cost report di satu titik waktu |
| **Overhead** | Resource yang dipakai OS dan Docker itu sendiri |
| **Unallocated** | Resource VPS yang tidak dipakai container (idle) |
| **Weighted allocation** | Pembagian biaya berdasarkan bobot resource |
| **Chargeback** | Mekanisme billing antar tim berdasarkan resource usage |

---

## 10. FAQ

**Q: Akurat ga sih perhitungannya?**
A: Tidak 100% akurat secara akuntansi — resource sharing di Linux itu kompleks. Tapi cukup untuk estimasi chargeback, pricing, dan monitoring tren.

**Q: Bisa dipake di production?**
A: Bisa — kodenya sederhana, edge cases udah di-handle (Docker ga available, container berhenti, db error).

**Q: Butuh database server?**
A: Nggak — SQLite aja cukup. Database cuma 1 file.

**Q: Mode multi-VPS?**
A: Belum — fase 2.0 nanti. Buat sekarang per VPS jalan sendiri-sendiri.

---

## 11. Related Documents

- [README.md](./README.md) — Dokumentasi teknis & cara pakai
- [Makefile](./Makefile) — Build commands
