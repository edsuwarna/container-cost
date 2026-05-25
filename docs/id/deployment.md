# Container Cost — Panduan Deployment 🚀

## Central Server (Production)

### Docker Compose (Rekomendasi)

```bash
docker compose up -d
docker compose logs -f
```

### Binary Standalone

```bash
# Build dari source
go build -o container-cost ./cmd/server
./container-cost -mode=server
```

## Agent Deployment

```bash
# One-liner
curl -sSL https://raw.githubusercontent.com/edsuwarna/container-cost/main/deploy/setup-agent.sh | bash
```
