# Container Cost 💰🐳

> Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture.

📖 **[Dokumentasi Lengkap → docs/index.html](./docs/index.html)** — Architecture, API Reference, Deployment Guide, Configuration, Cost Formula, Troubleshooting & more.

Hitung & monitor biaya container Docker di **satu atau banyak VPS** dari dashboard terpusat. Deploy **agent** ringan di tiap VPS — agent push raw stats CPU/RAM ke **central server**, central yang hitung biaya pakai konfigurasi VPS dari database. Ga perlu config file di agent.

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
- 🚀 Agent Go ringan di tiap VPS (gak perlu Python, gak perlu config lokal)
- 📡 Agent push **raw stats** CPU/RAM ke central server
- 🧮 Central server hitung biaya pakai **konfigurasi VPS dari database**
- 📈 Lihat cost breakdown per-VPS dari 1 dashboard
- ⚙️ Konfigurasi VPS dari dashboard — update sekali, auto recalculate
- 🔄 Agent auto-reconnect + health check
- ⚡ One-liner deploy agent via Docker

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
