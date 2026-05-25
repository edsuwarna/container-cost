# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Troubleshooting

### Agent Can't Reach Central Server

```
[agent] push failed after 5 retries: push request failed: ...
```

**Check:**
1. Is the central server URL correct? `http://IP:8080` not `https://`
2. Is the port open? `telnet CENTRAL_IP 8080`
3. Firewall rules? Cloud security group?
4. Agent logs: `docker logs container-cost-agent`

### Docker Socket Not Available

```
Warning: Docker collector not available: docker socket not found at /var/run/docker.sock
```

**Fixes:**
- For server mode: not critical — the server waits for agent pushes
- For agent mode: the agent requires Docker. Mount the socket: `-v /var/run/docker.sock:/var/run/docker.sock:ro`

### Database Connection Failed

```
Failed to open database: failed to ping database: ...
```

**Check:**
1. Is PostgreSQL running? `docker ps | grep postgres`
2. Is the DATABASE_URL correct?
3. Can the app reach the DB host? (in Docker Compose, service name `postgres`)

### VPS Shows Offline

By default, a VPS is marked offline if no push received for **24 hours**.

**Check:**
1. Is the agent running? `docker ps | grep container-cost-agent`
2. Agent logs: `docker logs container-cost-agent`
3. API key still valid? Try regenerating from dashboard

### Invalid API Key

```
push rejected (HTTP 401): invalid api key
```

**Fix:**
1. Regenerate key from dashboard: `POST /api/vps/{id}/reset-key`
2. Update the agent with the new key

### Config File Issues

If config.json doesn't exist, it's auto-created with defaults. Check:
- Path: `~/.docker-cost/config.json`
- Or set `DOCKER_COST_CONFIG_DIR` env var

### Common Docker Commands

```bash
# Agent logs
docker logs -f container-cost-agent

# Server logs
docker logs -f container-cost

# Database
docker exec -it docker-cost-postgres psql -U docker-cost -d docker-cost

# Restart everything
docker compose restart

# Reset (⚠️ deletes all data)
docker compose down -v
docker compose up -d
```

---
