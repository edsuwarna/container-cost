# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## 12. Security

### 12.1 Authentication

- **Dashboard:** Session-based auth with HttpOnly cookies, 24h expiry
- **Agents:** API key auth (Bearer token), auto-generated per VPS
- **Passwords:** Hashed with bcrypt

### 12.2 API Key Security

API keys are:
- Generated with `crypto/rand` (32 bytes → hex → prefixed with `dckr_`)
- Stored hashed in PostgreSQL
- Displayed once on creation (copy it immediately)
- Regenerable from dashboard (old key invalidated immediately)

### 12.3 Docker Socket

The Docker socket is mounted **read-only** (`ro`):
- Agents and server can only *read* stats
- No container modification possible

### 12.4 Network Security

- The default setup exposes port 8080/8081
- **Recommendation:** Run behind a reverse proxy (nginx, Caddy, Traefik) with:
  - TLS (HTTPS)
  - IP whitelisting for agent push endpoint
  - Rate limiting

### 12.5 Database Password

Change the default PostgreSQL password in docker-compose.yml for production:

```yaml
environment:
  POSTGRES_PASSWORD: your_secure_password_here
  POSTGRES_USER: container-cost
  POSTGRES_DB: container-cost
```

Update `DATABASE_URL` accordingly.

### 12.6 Secret Key

The server auto-generates a random 32-byte secret key for session signing. For production, set it in config.json:

```json
{
  "secret_key": "your-64-char-hex-secret"
}
```

---
