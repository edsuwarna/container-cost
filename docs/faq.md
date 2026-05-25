# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## FAQ

### What's the difference between server mode and agent mode?

**Server mode** (`--mode=server`, default): Runs the API server, database connection, frontend, and optionally collects local Docker stats. This is your central dashboard.

**Agent mode** (`--mode=agent`): A lightweight process that collects Docker stats, calculates costs, and pushes reports to the central server. No database, no frontend.

### Can I run multiple agents on the same VPS?

You can, but it's not useful — one agent per VPS is sufficient. Each agent represents a VPS in the dashboard.

### What happens if the central server goes down?

Agents detect connection failures and **retry up to 5 times** with 10-second delays. If still down, they log the error and try again on the next push interval. No data is lost on the agent side — it simply skips that cycle.

### How is storage cost calculated if disk usage isn't available?

Storage cost is allocated **equally** across all running containers: `Price × Storage_Weight / Container_Count`. This is a simplification — true per-container disk monitoring requires volume-level tracking.

### Can I change the currency?

Yes. Set `currency` in config.json to any code (IDR, USD, EUR, SGD, etc.). The dashboard displays it as-is.

### Does it work with Docker Desktop?

Yes, if Docker Desktop exposes the socket at `/var/run/docker.sock`. On macOS, this is usually a symlink.

### Can I use it with Podman?

Podman with Docker-compatible socket (`podman system service`) should work, but is not officially tested.

---
