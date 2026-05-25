# Container Cost — Referensi CLI 💻

## Flags

```
Usage: container-cost -mode=<mode> [options]

Mode:
  -mode=server     Jalankan sebagai central server
  -mode=agent      Jalankan sebagai agent

Options:
  -port=8080       Port server
  -server=URL      URL central server (agent mode)
  -interval=60s    Polling interval (agent mode)
