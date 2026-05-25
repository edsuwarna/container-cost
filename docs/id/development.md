# Container Cost — Pengembangan 🛠️

## Prasyarat

- Go 1.22+
- PostgreSQL 16+
- Docker (untuk testing agent)

## Setup

```bash
git clone https://github.com/edsuwarna/container-cost.git
cd container-cost
```

## Struktur

```
container-cost/
├── cmd/server/       ← Central server
├── cmd/agent/        ← VPS agent
├── internal/
│   ├── api/          ← HTTP handlers
│   ├── db/           ← Database layer
│   ├── pricing/      ← Cost formula
│   └── agent/        ← Agent logic
├── docs/             ← Dokumentasi
└── deploy/           ← Deployment scripts
```

## Testing

```bash
go test ./...
```
