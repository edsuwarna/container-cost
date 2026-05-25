# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## CLI Reference

### Flags

```
Usage of /app/docker-cost:

  -mode string
        Run mode: 'server' (central) or 'agent' (default: "server")
  -server string
        Central server URL (agent mode: http://central:8080)
  -api-key string
        Agent API key (agent mode, from dashboard)
  -push-interval int
        Push interval in seconds (agent mode, default: 60)
```

### Makefile Commands

| Command | Description |
|---------|-------------|
| `make build` | Build binary to `./build/docker-cost` |
| `make build-static` | Static Linux binary |
| `make run` | Build + run |
| `make run-quick` | Quick run with `go run` |
| `make test` | Run all tests with race detection |
| `make clean` | Remove build artifacts |
| `make install-deps` | Install system deps (gcc, sqlite3) |
| `make info` | Show project info |

---
