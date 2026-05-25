# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## 6. Configuration Guide

### 6.1 Config File Location

Default: `~/.docker-cost/config.json` (override with `DOCKER_COST_CONFIG_DIR` env var)

### 6.2 Server Mode Configuration

```json
{
  "name": "My VPS",
  "price_per_month": 200000,
  "cpu_cores": 4,
  "ram_gb": 8,
  "storage_gb": 100,
  "bandwidth_gb": 0,
  "currency": "IDR",
  "cpu_weight": 0.5,
  "ram_weight": 0.4,
  "storage_weight": 0.1,
  "network_weight": 0.0,
  "overhead_percent": 15,
  "admin_user": "admin",
  "admin_pass": "",
  "secret_key": ""
}
```

**Field Reference:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | `"My VPS"` | Display name in dashboard |
| `price_per_month` | number | `200000` | Monthly VPS cost in your currency |
| `cpu_cores` | number | `4` | Number of CPU cores |
| `ram_gb` | number | `8` | RAM in GB |
| `storage_gb` | number | `100` | Storage in GB |
| `bandwidth_gb` | number | `0` | Bandwidth (reserved for future) |
| `currency` | string | `"IDR"` | Currency code (IDR, USD, EUR, etc.) |
| `cpu_weight` | 0.0-1.0 | `0.5` | CPU weight in cost formula |
| `ram_weight` | 0.0-1.0 | `0.4` | RAM weight in cost formula |
| `storage_weight` | 0.0-1.0 | `0.1` | Storage weight in cost formula |
| `network_weight` | 0.0-1.0 | `0.0` | Network weight (reserved) |
| `overhead_percent` | 0-100 | `15` | OS/Docker overhead percentage |

> If the config file doesn't exist, it's **auto-created with defaults** on first run.

### 6.3 Agent Mode Configuration

For agent mode, use the FullConfig format that wraps both VPS and agent settings:

```json
{
  "vps": {
    "name": "Hetzner CX42",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
    "storage_gb": 100,
    "currency": "IDR",
    "cpu_weight": 0.5,
    "ram_weight": 0.4,
    "storage_weight": 0.1,
    "overhead_percent": 15
  },
  "agent": {
    "mode": "agent",
    "central_url": "http://central:8080",
    "agent_key": "dckr_xxx...",
    "push_interval": 60,
    "push_retries": 5
  }
}
```

**Agent config fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | string | `"server"` | Run mode: `"server"` or `"agent"` |
| `central_url` | string | `""` | Central server URL (e.g. `http://ip:8080`) |
| `agent_key` | string | `""` | API key from central dashboard |
| `push_interval` | int | `60` | Seconds between pushes |
| `push_retries` | int | `5` | Retry count on failure |

**CLI flags override config file values.** If both are provided, CLI wins.

### 6.4 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | `postgres://docker-cost:***@localhost:5432/docker-cost?sslmode=disable` | PostgreSQL connection string |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket path |
| `DOCKER_COST_CONFIG_DIR` | `~/.docker-cost` | Config directory |
| `TZ` | `Asia/Jakarta` | Timezone |

### 6.5 Weights Tuning

The default weights are:

| Resource | Weight | Rationale |
|----------|--------|-----------|
| CPU | 50% | Most common bottleneck |
| RAM | 40% | Second most important |
| Storage | 10% | Relatively cheap |
| Network | 0% | Reserved for future |

**Tips for adjusting weights:**
- **CPU-heavy workloads** (compute, batch jobs) → increase CPU weight to 0.7+
- **Memory-heavy workloads** (databases, caches) → increase RAM weight to 0.6+
- **Equal split** → set all to 0.33
- Weights don't need to sum to 1.0 (they're normalized internally), but it's recommended for clarity

---
