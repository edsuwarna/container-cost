# Container Cost — Varian Platform 🌍

## Docker (Rekomendasi)

```bash
docker compose up -d
```

## Binary Go

```bash
go build -o container-cost ./cmd/server
./container-cost -mode=server
```

## Agent (tiap VPS)

Container ringan (~15MB) jalan sebagai sidecar:
```bash
docker run -d --name cc-agent \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/edsuwarna/container-cost:latest \
  -mode=agent -server=https://central.example.com
```
