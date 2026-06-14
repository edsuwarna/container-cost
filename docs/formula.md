# Container Cost Documentation

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Cost Formula

### How Allocation Works

Container Cost uses a **weighted resource fraction** model:

```
Container Cost = VPS Monthly Price × Weighted Resource Fraction
```

### Step-by-Step Calculation

**Step 1: Available Resources (after 15% overhead)**

```
Available CPU = Total CPU × (1 - Overhead%)
Available RAM = Total RAM × (1 - Overhead%)
```

For a VPS with 4 CPU cores and 8GB RAM, 15% overhead:
- Available CPU = 4 × 0.85 = **3.4 cores**
- Available RAM = 8 × 0.85 = **6.8 GB**

**Step 2: Container Fractions**

```
CPU Fraction = Container CPU Cores / Available CPU
RAM Fraction = Container RAM (GB) / Available RAM
Storage Fraction = 1 / Number of Containers (equal split per container)
Network Fraction = 1 / Number of Containers (equal split per container, weight = 0 by default)
```

**Step 3: Weighted Cost**

```
Container Monthly Cost = Price × (CPU_Weight × CPU_Fraction + RAM_Weight × RAM_Fraction + Storage_Weight × Storage_Fraction + Network_Weight × Network_Fraction)
                         / (CPU_Weight + RAM_Weight + Storage_Weight + Network_Weight)
```

### Example

**VPS:** Hetzner CX42 — Rp 200.000/month, 4 CPU, 8GB RAM, 3 containers

**Weights:** CPU=0.5, RAM=0.4, Storage=0.1, Network=0.0

| Container | CPU% | RAM | CPU Cost | RAM Cost | Storage Cost | **Total** |
|-----------|------|-----|----------|----------|-------------|-----------|
| web | 2.5% | 128MB | Rp 5.500 | Rp 2.500 | Rp 7.000 | **Rp 15.000** |
| postgres | 15.2% | 1.2GB | Rp 32.000 | Rp 16.000 | Rp 7.000 | **Rp 55.000** |
| nginx | 0.8% | 64MB | Rp 2.000 | Rp 1.000 | Rp 7.000 | **Rp 10.000** |

**Overhead cost (OS + Docker ~15%):** Rp 40.000  
**Unallocated (idle resources):** Rp 80.000  
**Total allocated:** Rp 200.000 ✓

### Overhead Cost

The OS and Docker daemon themselves consume resources. The overhead is calculated as:

```
Overhead CPU = Total CPU × Overhead%
Overhead RAM = Total RAM × Overhead%

Overhead Cost = Price × (overheadCPU/totalCPU + overheadRAM/totalRAM) / 2
```

Default overhead: **15%** (adjustable in config)

### Unallocated Cost

Resources not used by any container or overhead:

```
Unallocated = Price × (unusedCPUratio + unusedRAMratio) / 2
```

This represents **idle capacity** you're paying for but not using.

### Multi-VPS Totals

The aggregated dashboard sums costs across all VPS:

```
Total Cost All VPS = Σ(VPS 1 Price + VPS 2 Price + ... + VPS N Price)
Total Containers = Σ(Container Count per VPS)
```

---
