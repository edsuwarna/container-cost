# Container Cost Documentation

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Architecture

![Container Cost Architecture Diagram](container-cost-architecture.png)

### Multi-VPS Architecture (v2.0+)

Container Cost uses a **push-based architecture** with three tiers:

```
┌─────────────┐    raw stats     ┌──────────────┐    query     ┌───────────┐
│  VPS Agent   │ ──────────────→ │    Central    │ ──────────→ │    DB     │
│  (Go binary) │   POST /push    │    Server     │   store/    │ Postgres │
│              │   API key auth  │               │   retrieve  │           │
└─────────────┘                  └───────┬───────┘             └───────────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │   Dashboard   │
                                  │  (Chart.js)   │
                                  └──────────────┘
```

**Each agent:**
1. Reads Docker socket for container stats (CPU%, RAM%, memory limit, status)
2. Sends **raw stats** (not calculated costs) to central server via `POST /api/v1/push`
3. Authenticates via **API key** generated from the dashboard
4. Retries up to 5× with exponential backoff on failure
5. Does **no local cost calculation** — just collects and pushes

**The central server:**
1. Receives raw stats from agents (API key auth)
2. Looks up the VPS configuration from DB (price, CPU cores, RAM, weights)
3. Creates a **Calculator** with that VPS config and computes the cost report
4. Stores the snapshot in PostgreSQL linked to the VPS
5. Updates VPS `last_seen` timestamp for online/offline detection
6. Serves aggregated dashboard with totals across all VPS

### Why Push Raw Stats?

| Before (v1.x) | After (v2.0+) |
|----------------|----------------|
| Agent calculates cost with its own config | Agent pushes raw stats only |
| Config must be synced to every agent | Config managed centrally in DB |
| Changing price/weights = update all agents | Change once in dashboard → auto recalculates |
| Agent needs full VPS config locally | Agent only needs Docker socket + API key |

### Single VPS Architecture (Legacy)

If running on a single machine, the server can also collect stats locally via Docker socket — no agent needed:

```
Docker Socket → Collector → Calculator → Storage → API → Dashboard
                            ↑
                     config from DB
```
