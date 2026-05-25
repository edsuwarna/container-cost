# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Roadmap

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
