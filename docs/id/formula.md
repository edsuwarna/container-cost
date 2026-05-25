# Container Cost — Rumus Biaya 🧮

## Cara Alokasi

Biaya container dihitung pake formula berbobot (weighted):

```
Biaya_per_container = (CPU% × CPU_Weight + RAM% × RAM_Weight + Storage% × Storage_Weight) × Total_Biaya_VPS
```

Bobot default:
- **CPU:** 50%
- **RAM:** 40%
- **Storage:** 10%

## Contoh

VPS dengan total biaya $100/bulan:

| Container | CPU% | RAM% | Storage% | Alokasi |
|-----------|------|------|----------|---------|
| nginx | 10% | 5% | 2% | $7.00 |
| postgres | 30% | 60% | 40% | $43.00 |
| redis | 5% | 10% | 1% | $7.50 |
| app | 55% | 25% | 57% | $42.50 |
