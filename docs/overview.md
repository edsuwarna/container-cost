# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Overview

### What is Container Cost?

Container Cost is a **Docker container cost allocation tool** that helps you calculate and monitor how much each container costs across one or many VPS instances. It uses a weighted resource allocation formula based on actual CPU and RAM usage.

### Why?

If you run Docker containers across multiple VPS, you've probably asked:

- "Container A is on which VPS? What's the total cost across all VPS?"
- "Which VPS is the most expensive? Most wasteful?"
- "How do I charge back clients whose containers run on different VPS?"
- "How do I track per-VPS costs without SSH-ing into each one?"

Container Cost answers all of these with a single dashboard.

### Who Is It For?

| Segment | Use Case |
|---------|----------|
| **Indie Developer / Solo Dev** | Side projects on 1-3 VPS, know your cost breakdown |
| **DevOps Engineer** | Multi-tenant container deployment, chargeback to teams/clients |
| **VPS Reseller** | Selling containers to clients with data-driven pricing |
| **Small Team** | Sharing VPS, fair cost splitting |

### Key Features

**Single VPS (Legacy)**
- Live Docker stats collection (CPU%, memory, status)
- Weighted cost allocation (CPU 50%, RAM 40%, Storage 10%)
- PostgreSQL storage with history tracking
- Chart.js dashboard (doughnut, bar, line charts)
- Role-based auth (admin, engineer, management)
- Docker Compose deployment

**Multi-VPS (v2.0)**
- VPS management — add/edit/delete VPS from dashboard
- Agent mode — deploy a lightweight agent on each VPS
- Push API — agents push reports to central server (API key auth)
- Aggregated dashboard — total cost across all VPS
- Live status — online/offline detection per VPS
- Auto API key generation on VPS creation
- GitHub Container Registry image
- One-liner agent deployment

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|------|
| **Language** | Go 1.22 | High performance, single binary, perfect for CLI tools |
| **Storage** | PostgreSQL 16 | Robust, JSONB for flexible report snapshots |
| **API** | net/http (stdlib) | No framework — lightweight, easy to maintain |
| **Docker API** | Unix socket (HTTP) | Read container stats directly from Docker Engine |
| **Frontend** | Vanilla HTML/CSS/JS + Chart.js | Zero build step, dark theme |
| **Auth** | Session-based (cookie) | Login/logout, bcrypt, 3 roles |
| **Container Registry** | GitHub Container Registry | ghcr.io/edsuwarna/container-cost |

---
