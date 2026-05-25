# Container Cost — Keamanan 🔒

## Agent Auth

- Agent pake API key untuk terhubung ke central server
- Key digenerate otomatis pas register
- Komunikasi via HTTPS (recommended)

## Database

- PostgreSQL dengan user terisolasi
- Password pake environment variable, bukan hardcode

## Best Practices

1. Jangan expose port central server ke public
2. Pake reverse proxy (Nginx) dengan HTTPS
3. Ganti default API key
4. Audit log akses agent
