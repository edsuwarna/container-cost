# Container Cost — Arsitektur 🏗

## Arsitektur Multi-VPS (v2.0+)

Setiap agent:
1. Baca Docker socket untuk stats container (CPU%, RAM)
2. Kirim data ke central server tiap ~60 detik
3. Central server agregasi + kalkulasi biaya

```
VPS-1 (Agent) ──┐
VPS-2 (Agent) ──┼──▶ Central Server (PostgreSQL + Dashboard)
VPS-3 (Agent) ──┘
```

## Arsitektur Single VPS (Legacy)

Jalan langsung di satu VPS tanpa agent. Cocok buat setup sederhana.
