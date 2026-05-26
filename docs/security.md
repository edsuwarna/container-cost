# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Security

### Authentication

- **Dashboard:** Session-based auth with HttpOnly cookies, 24h expiry
- **Agents:** API key auth (Bearer token), auto-generated per VPS
- **Passwords:** Hashed with bcrypt

### API Key Security

API keys are:
- Generated with `crypto/rand` (32 bytes → hex → prefixed with `dckr_`)
- **Stored hashed** in PostgreSQL using SHA-256 (never in plaintext)
- Displayed **only once** on creation (copy it immediately)
- Regenerable from dashboard (old key invalidated immediately)
- APIs use key lookup via SHA-256 hash for both security and performance

### Docker Socket

The Docker socket is mounted **read-only** (`ro`):
- Agents and server can only *read* stats
- No container modification possible

### Network Security

- The default setup exposes port 8080/8081
- **Recommendation:** Run behind a reverse proxy (nginx, Caddy, Traefik) with:
  - TLS (HTTPS)
  - IP whitelisting for agent push endpoint
  - Rate limiting

### Database Password

Change the default PostgreSQL password in docker-compose.yml for production:

```yaml
environment:
  POSTGRES_PASSWORD: your_secure_password_here
  POSTGRES_USER: container-cost
  POSTGRES_DB: container-cost
```

Update `DATABASE_URL` accordingly.

### Secret Key

The server auto-generates a random 32-byte secret key for session signing. For production, set it in config.json:

```json
{
  "secret_key": "your-64-char-hex-secret"
}
```

### Configuration File Permissions

The configuration file (`config.json`) is created with `0600` permissions (owner read/write only) to protect any stored secrets.

### Password Policy

- All passwords are hashed with bcrypt before storage
- Minimum password length is **8 characters** (enforced at API level)
- Default seed accounts (`admin`, `eng`, `mgt`) use bcrypt-hashed passwords

### Cookie Security

Session cookies use:
- `HttpOnly` flag (inaccessible to JavaScript)
- `Secure` flag (only sent over HTTPS)
- `SameSite=Strict` mode (prevents CSRF)
- 24-hour expiration

---
