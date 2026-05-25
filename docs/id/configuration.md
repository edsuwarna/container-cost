# Container Cost — Konfigurasi ⚙️

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `8080` | Port central server |
| `DATABASE_URL` | `postgres://...` | Koneksi PostgreSQL |
| `POLL_INTERVAL` | `60s` | Interval polling agent |
| `AGENT_KEY` | (auto) | API key untuk agent |

## Config File

```yaml
server:
  port: 8080
database:
  url: postgres://user:pass@localhost:5432/containercost
pricing:
  cpu_weight: 0.5
  ram_weight: 0.4
  storage_weight: 0.1
```
