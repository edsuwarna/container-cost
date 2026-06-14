# Container Cost Documentation

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Configuration Guide

### Config File Location

Default: `~/.container-cost/config.json` (override with `CONTAINER_COST_CONFIG_DIR` env var)

If the config file doesn't exist, defaults are used.

### Server Mode Configuration

In **server mode** (central server), the config file defines the local VPS where the server runs (for single-VPS setups without agents):

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
| `bandwidth_gb` | number | `0` | Bandwidth in GB (reserved for future use) |
| `currency` | string | `"IDR"` | Currency code (IDR, USD, EUR, etc.) |
| `cpu_weight` | 0.0-1.0 | `0.5` | CPU weight in cost formula |
| `ram_weight` | 0.0-1.0 | `0.4` | RAM weight in cost formula |
| `storage_weight` | 0.0-1.0 | `0.1` | Storage weight in cost formula |
| `network_weight` | 0.0-1.0 | `0.0` | Network weight in cost formula (reserved) |
| `overhead_percent` | 0-100 | `15` | OS/Docker overhead percentage |
| `secret_key` | string | `""` | Session signing key (auto-generated 64-char hex if empty) |

The server also stores per-VPS configuration in the database (see **VPS Config in DB** below).

### VPS Config in DB (Multi-VPS)

For multi-VPS setups, each VPS is registered via the dashboard and its config is stored in the `vps_agents` table. This allows centralised management:

| Field | Description | Managed via |
|-------|-------------|-------------|
| `name` | VPS display name | Dashboard form |
| `price_per_month` | Monthly VPS cost | Dashboard form |
| `cpu_cores` | CPU cores | Dashboard form |
| `ram_gb` | RAM in GB | Dashboard form |
| `storage_gb` | Storage in GB | Dashboard form |
| `currency` | Currency code | Dashboard form |
| `cpu_weight` | CPU weight (0.0-1.0) | Dashboard form |
| `ram_weight` | RAM weight (0.0-1.0) | Dashboard form |
| `storage_weight` | Storage weight (0.0-1.0) | Dashboard form |
| `overhead_percent` | Overhead % | Dashboard form |
| `api_key` | Auto-generated on create | Dashboard (copy once) |
| `status` | Online/offline (auto) | Detected via push |

When you update any config field, the central server automatically recalculates the latest snapshot using the new values.

### Agent Mode Configuration

In **agent mode**, the agent only needs to know where the central server is and its API key. **VPS specs, price, and weights are NOT needed on the agent** — they're managed from the dashboard.

#### Minimal (CLI flags, no config file)

```bash
docker run ... ghcr.io/edsuwarna/container-cost:latest \
  --mode=agent \
  --server=http://CENTRAL_IP:8080 \
  --api-key=dckr_xxx
```

#### With Config File (for custom timing)

```json
{
  "agent": {
    "central_url": "http://CENTRAL_IP:8080",
    "agent_key": "dckr_xxx",
    "push_interval": 120,
    "push_retries": 3
  }
}
```

**Agent config fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `central_url` | string | `""` | Central server URL (e.g. `http://ip:8080`) |
| `agent_key` | string | `""` | API key from central dashboard |
| `push_interval` | int | `60` | Seconds between pushes |
| `push_retries` | int | `5` | Retry count on failure |

**CLI flags override config file values.** If both are provided, CLI wins.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | `postgres://container-cost:***@localhost:5432/container-cost?sslmode=disable` | PostgreSQL connection string |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket path |
| `CONTAINER_COST_CONFIG_DIR` | `~/.container-cost` | Config directory |
| `TZ` | `Asia/Jakarta` | Timezone |

### Weights Tuning

The default weights are:

| Resource | Weight | Rationale |
|----------|--------|-----------|
| CPU | 50% | Most common bottleneck |
| RAM | 40% | Second most important |
| Storage | 10% | Relatively cheap |
| Network | 0% | Reserved for future use — has no effect on calculations |

**Tips for adjusting weights:**
- **CPU-heavy workloads** (compute, batch jobs) → increase CPU weight to 0.7+
- **Memory-heavy workloads** (databases, caches) → increase RAM weight to 0.6+
- **Equal split** → set all to 0.33
- Weights don't need to sum to 1.0 (they're normalized internally), but it's recommended for clarity
