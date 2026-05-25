# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Architecture

![Container Cost Architecture Diagram](container-cost-architecture.png)

### Multi-VPS Architecture (v2.0+)

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

### Single VPS Architecture (Legacy)

Runs directly on the Docker host — no agent needed. The pipeline is in the bottom section of the diagram above: Collector → Calculator → Storage → API → Frontend. All within one Go binary.

---
