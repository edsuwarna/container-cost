# Container Cost 💰🐳

> Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture.

| Container Cost is a **Docker container cost allocation tool** that calculates and monitors how much each container costs across one or many VPS instances. Deploy lightweight Go agents on each VPS — they push raw stats to a central server that computes costs using VPS config stored in the database. No local config needed on agents.

Perfect for **chargeback**, **cost tracking**, or finding which containers are the most expensive without SSH-ing into each server.

📖 **[Full Documentation → docs/index.html](./docs/index.html)** — Architecture, API Reference, Deployment Guide, Configuration, Cost Formula, Troubleshooting & more.

---

## ✨ Features

### Single VPS (Legacy Mode)
- Collect CPU/RAM stats from Docker socket
- Weighted cost allocation (CPU 50%, RAM 40%, Storage 10%)
- PostgreSQL storage with history tracking
- Frontend dashboard with Chart.js (doughnut, bar, line charts)
- Auth system (admin/engineer/management roles)

### Multi-VPS (Agent Architecture)
- Lightweight Go agent on each VPS (no Python, no local config needed)
- Agent pushes **raw Docker stats** (CPU%, RAM%) to central server
- Central server calculates costs using **DB-stored VPS config** (price, weights, specs)
- Per-VPS cost breakdown in a single dashboard
- VPS config managed from dashboard — update once, auto recalculates
- Agent auto-reconnect with health checks
- One-liner agent deployment via Docker

---

## 🚀 Quick Start

```bash
# Central Server
git clone https://github.com/edsuwarna/container-cost.git
cd container-cost
docker compose up -d

# Add VPS agents via dashboard
```

---

## 📚 Documentation

Full documentation available at **[docs/index.html](./docs/index.html)** or on [GitHub](https://github.com/edsuwarna/container-cost).

Also available in: 🇮🇩 [Bahasa Indonesia](README.id.md)

---

## 🐳 Docker Images

- `ghcr.io/edsuwarna/container-cost:latest` — Central server image
- One-liner agent setup script included

---

**License:** [Apache 2.0](LICENSE) ![License](https://img.shields.io/badge/License-Apache%202.0-57c1ff.svg)
