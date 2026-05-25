# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## 2. Architecture

### 2.1 Multi-VPS Architecture (v2.0+)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  VPS-1       │  │  VPS-2       │  │  VPS-3       │
│  ┌──────────┐│  │  ┌──────────┐│  │  ┌──────────┐│
│  │  Agent   ││  │  │  Agent   ││  │  │  Agent   ││
│  │ (Docker) ││  │  │ (Docker) ││  │  │ (Docker) ││
│  └────┬─────┘│  │  └────┬─────┘│  │  └────┬─────┘│
└───────┼──────┘  └───────┼──────┘  └───────┼──────┘
        │ POST            │ POST            │ POST
        │ /api/v1/push    │ /api/v1/push    │ /api/v1/push
        ▼                 ▼                 ▼
┌───────────────────────────────────────────────────┐
│               CENTRAL SERVER                        │
│  ┌─────────────────────────────────────────────┐   │
│  │  API Server (:8080) + Frontend Dashboard    │   │
│  │  PostgreSQL (snapshots, users, vps_agents)  │   │
│  └─────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

Each agent:
1. Reads Docker socket for container stats (CPU%, RAM)
2. Calculates cost using its own VPS config (name, specs, price)
3. Pushes the cost report to the central server
4. Retries up to 5× with exponential backoff on failure

The central server:
1. Receives push reports from agents (API key auth)
2. Stores snapshots in PostgreSQL (per VPS)
3. Detects offline VPS (24h threshold)
4. Serves the aggregated dashboard
5. Can also collect locally if Docker socket is available

### 2.2 Single VPS Architecture (Legacy)

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host (VPS)                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Container Cost                        │   │
│  │  ┌──────────┐   ┌────────────┐   ┌───────────┐  │   │
│  │  │Collector │──▶│ Calculator │──▶│  Storage   │  │   │
│  │  │(Docker   │   │ (Weighted  │   │ (PostgreSQL│  │   │
│  │  │ socket)  │   │  Formula)  │   │           │  │   │
│  │  └──────────┘   └─────┬──────┘   └─────┬─────┘  │   │
│  │                       │                │         │   │
│  │                 ┌─────▼────────────────▼──────┐  │   │
│  │                 │        REST API Server       │  │   │
│  │                 │        (port :8080)          │  │   │
│  │                 └─────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │Container│  │Container│  │Container│                  │
│  │   A     │  │   B     │  │   C     │                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow

```
Docker Socket
     │
     ▼
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Collector   │────▶│  Calculator   │────▶│   Storage      │
│ (CPU%, RAM,  │     │ (CostReport   │     │ (PostgreSQL)   │
│  status)     │     │  w/ formula)  │     │ snapshots +    │
└─────────────┘     └──────────────┘     │ users + agents  │
                                         └───────┬────────┘
                                                 │
                                         ┌───────▼────────┐
                                         │  API Server    │
                                         │  :8080         │
                                         │  JSON REST     │
                                         └───────┬────────┘
                                                 │
                                         ┌───────▼────────┐
                                         │  Frontend      │
                                         │  (Chart.js)    │
                                         └────────────────┘
```

---
