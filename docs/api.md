# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## API Reference

### Base URL

```
http://localhost:8080
// Via docker-compose: http://localhost:8081
```

### Endpoint Summary

#### Public (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Login (JSON body: username, password) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/check` | Check session status |

#### Agent Push (API Key Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/push` | Push cost report from agent |

**Headers:** `Authorization: Bearer ***`

#### Dashboard (Authenticated — any role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Aggregated multi-VPS report |
| GET | `/api/report/latest` | Latest snapshot |
| POST | `/api/report/refresh` | Generate fresh report (local Docker only) |
| GET | `/api/report/history` | Historical reports (query: `?since=2024-01-01T00:00:00Z`) |
| GET | `/api/containers` | List all containers + current costs |
| GET | `/api/containers/{name}` | Container cost history |
| GET | `/api/costs/trends` | Cost trend over last 30 days |
| GET/PUT | `/api/config` | Get/update VPS config |

#### VPS Management (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vps` | List all VPS agents |
| POST | `/api/vps` | Add new VPS (generates API key) |
| GET | `/api/vps/{id}` | VPS detail + latest report |
| PUT | `/api/vps/{id}` | Update VPS name/notes |
| DELETE | `/api/vps/{id}` | Remove VPS + all its data |
| POST | `/api/vps/{id}/reset-key` | Regenerate API key |

#### User Management (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create new user |
| PUT | `/api/users/{id}` | Update user role |
| DELETE | `/api/users/{id}` | Delete user |
| POST | `/api/users/{id}/reset-password` | Reset password |

### Detailed Endpoints

#### GET /api/health

```json
// Response 200
{
  "status": "ok",
  "time": "2025-01-15T10:30:00Z"
}
```

#### POST /api/auth/login

```json
// Request
{
  "username": "admin",
  "password": "change-me"
}

// Response 200
{
  "success": true,
  "user": "admin",
  "role": "admin"
}

// Response 401
{
  "error": "invalid credentials"
}
```

**Sets a session cookie** `session` (HttpOnly, SameSite=Lax, 24h expiry).

#### POST /api/v1/push (Agent Push)

```json
// Headers: Authorization: Bearer ***

// Request Body
{
  "vps": {
    "name": "Hetzner CX42",
    "price_per_month": 200000,
    "cpu_cores": 4,
    "ram_gb": 8,
    "currency": "IDR"
  },
  "containers": [
    {
      "container": {
        "name": "web",
        "id": "a1b2c3d4e5f6",
        "image": "nginx:latest",
        "cpu_percent": 2.5,
        "mem_usage_mb": 128,
        "mem_limit_mb": 1024,
        "mem_percent": 12.5,
        "status": "running",
        "created_at": "2025-01-01T00:00:00Z",
        "uptime": "14 days"
      },
      "cpu_cost": 4800,
      "ram_cost": 1500,
      "storage_cost": 6700,
      "total_cost": 13000
    }
  ],
  "overhead_cost": 30000,
  "unallocated_cost": 55000,
  "total_cost": 200000,
  "period": "month"
}

// Response 200
{
  "status": "accepted",
  "snapshot_id": 42
}
```

#### GET /api/dashboard (Aggregated)

```json
// Response 200
{
  "vps_list": [
    {
      "id": 1,
      "name": "Hetzner CX42",
      "cpu_cores": 4,
      "ram_gb": 8,
      "price_per_month": 200000,
      "currency": "IDR",
      "status": "online",
      "last_seen": "2025-01-15T10:28:00Z"
    }
  ],
  "reports": [
    {
      "vps": { "name": "Hetzner CX42", ... },
      "containers": [...],
      "total_cost": 200000
    }
  ],
  "total_cost": 200000,
  "total_vps": 1,
  "total_containers": 3,
  "currency": "IDR",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

### Error Response Format

All errors follow this structure:

```json
{
  "error": "human-readable error message",
  "details": "optional detailed message"
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (VPS, user) |
| 400 | Bad request (missing/invalid fields) |
| 401 | Unauthorized (not logged in or invalid API key) |
| 403 | Forbidden (wrong role) |
| 404 | Not found |
| 500 | Internal server error |

### Authentication

Two authentication methods:

1. **Session Cookie** — for dashboard users:
   - `POST /api/auth/login` sets a `session` cookie
   - Valid for 24 hours
   - Used for all dashboard endpoints

2. **API Key (Bearer Token)** — for agent pushes:
   - Format: `Authorization: Bearer ***`
   - Generated per VPS from the dashboard
   - Can be regenerated (old key invalidated immediately)

### Rate Limiting

The API has no built-in rate limiter. Agents typically push every 60 seconds by default.

---
