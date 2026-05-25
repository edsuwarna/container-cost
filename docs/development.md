# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## 11. Development Guide

### 11.1 Prerequisites

```bash
# Go 1.22+
go version

# PostgreSQL 16+
psql --version

# Docker (for agent testing)
docker --version
```

### 11.2 Project Structure

```
container-cost/
├── cmd/server/main.go              # Entry point — server & agent modes
├── internal/
│   ├── agent/client.go             # Push client + retry logic
│   ├── api/handler.go              # HTTP handlers + routes + auth
│   ├── calculator/cost.go          # Weighted cost formula engine
│   ├── collector/docker.go         # Docker socket → ContainerStats
│   ├── config/config.go            # VPSConfig + AgentConfig loader
│   └── storage/postgres.go         # PostgreSQL: migrations, users, snapshots, agents
├── web/dist/                        # Frontend (HTML/CSS/JS + Chart.js)
├── deploy/
│   └── setup-agent.sh              # One-liner agent deployment script
├── Dockerfile                       # Multi-stage build → ghcr.io
├── docker-compose.yml               # Central server (Go app + PostgreSQL)
├── docker-compose.agent.yml         # Agent deployment
├── Makefile
├── PRD.md                           # Product Requirements Document
├── README.md
└── DOCS.md                          # This documentation
```

### 11.3 Running Locally

```bash
# Quick start (no Postgres setup needed for some dev tasks)
make run-quick

# Or build first
make build
./build/docker-cost

# With custom port
PORT=9000 ./build/docker-cost
```

### 11.4 Testing

```bash
# All tests
go test -v -race ./...

# Coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

### 11.5 Building Docker Image

```bash
docker build -t container-cost:latest .
docker run -d -p 8080:8080 container-cost:latest
```

### 11.6 Database

**Auto-migration:** On startup, the app creates all tables automatically:

```sql
-- VPS Agents
CREATE TABLE IF NOT EXISTS vps_agents (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    api_key         VARCHAR(128) UNIQUE NOT NULL,
    cpu             DOUBLE PRECISION DEFAULT 0,
    ram_gb          DOUBLE PRECISION DEFAULT 0,
    storage_gb      DOUBLE PRECISION DEFAULT 0,
    price_per_month DOUBLE PRECISION DEFAULT 0,
    currency        VARCHAR(10) DEFAULT 'IDR',
    cpu_weight      DOUBLE PRECISION DEFAULT 0.5,
    ram_weight      DOUBLE PRECISION DEFAULT 0.4,
    storage_weight  DOUBLE PRECISION DEFAULT 0.1,
    overhead_percent DOUBLE PRECISION DEFAULT 15.0,
    notes           TEXT DEFAULT '',
    status          VARCHAR(20) DEFAULT 'offline',
    last_seen       TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    VARCHAR(200) DEFAULT '',
    role            VARCHAR(20) DEFAULT 'engineer',
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    id          SERIAL PRIMARY KEY,
    vps_id      INTEGER REFERENCES vps_agents(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW(),
    report_json JSONB NOT NULL
);
```

**Default seeding:** On first startup, creates initial users:
- `admin` / `change-me` (role: admin)
- `eng` / `change-me` (role: engineer)
- `mgt` / `change-me` (role: management)

### 11.7 Adding Tests

Tests use Go's standard `testing` package. The calculator package has deterministic logic — add test cases in `internal/calculator/` for new cost scenarios.

### 11.8 Code Conventions

- **No external frameworks** — pure Go standard library (net/http, database/sql)
- **Docker API** — communicate via Unix socket HTTP
- **Password hashing** — bcrypt via `golang.org/x/crypto/bcrypt`
- **PostgreSQL driver** — pgx v5 via `github.com/jackc/pgx/v5/stdlib`
- **JSON storage** — report snapshots stored as JSONB

---
