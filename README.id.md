# Container Cost 💰🐳

> Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture.

📖 **[Dokumentasi Lengkap → docs/index.html](./docs/index.html)** — Architecture, API Reference, Deployment Guide, Configuration, Cost Formula, Troubleshooting & more.

Hitung & monitor biaya container Docker di **satu atau banyak VPS** dari dashboard terpusat. Deploy **agent** di tiap VPS, semua data otomatis terkumpul di **central server**.

Cocok buat **chargeback**, **cost tracking**, atau tau container mana yang paling boros tanpa SSH satu-satu.

---

## ✨ Fitur

### Single VPS (Legacy)
- 🔍 Collect CPU/RAM dari Docker socket
- 🧮 Weighted cost allocation (CPU 50%, RAM 40%, Storage 10%)
- 💾 PostgreSQL storage + history
- 📊 Frontend dashboard (Chart.js — doughnut, bar, line chart)
- 🔐 Auth system (admin/engineer/management)

### Multi-VPS (Agent Architecture)
- 🚀 Agent Go ringan di tiap VPS (gak perlu Python)
- 📡 Central server kumpulin data dari semua agent
- 📈 Lihat cost breakdown per-VPS dari 1 dashboard
- 🔄 Agent auto-reconnect + health check
- ⚡ One-liner deploy agent via SSH

---

## 🚀 Quick Start

```bash
# Central Server
git clone https://github.com/edsuwarna/container-cost.git
cd container-cost
docker compose up -d

# Tambah agent VPS via dashboard
```

---

## 📚 Dokumentasi

Dokumentasi lengkap: **[docs/index.html](./docs/index.html)** atau di [GitHub](https://github.com/edsuwarna/container-cost).

English version: 🇬🇧 [English](README.md)
