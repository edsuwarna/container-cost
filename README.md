# Container Cost 💰🐳

> Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture.

A **Docker container cost allocation tool** that calculates and monitors how much each container costs across one or many VPS instances. It uses a weighted resource allocation formula based on actual CPU and RAM usage.

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
- Lightweight Go agent on each VPS (no Python needed)
- Central server aggregates data from all agents
- Per-VPS cost breakdown in a single dashboard
- Agent auto-reconnect with health checks
- One-liner agent deployment via SSH

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

**License:** MIT
