# Container Cost — Pemecahan Masalah 🔍

## Agent tidak connect

```bash
# Cek log agent
docker logs cc-agent

# Test koneksi
curl -I https://central.example.com

# Restart agent
docker restart cc-agent
```

## Data tidak muncul di dashboard

```bash
# Cek interval polling
# Default 60 detik, tunggu

# Cek database
docker compose exec db psql -U postgres -d containercost -c "SELECT count(*) FROM containers;"
```

## Port sudah dipake

Ubah port di environment variable:
```bash
SERVER_PORT=8081 docker compose up -d
```
