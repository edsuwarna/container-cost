# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Frontend Dashboard

### Access

After starting the server, open:

```
http://your-server:8081
```

Default login: `admin` / `change-me`

### Pages

**Dashboard** — Main overview with:
- Summary cards: Total Cost, Container Cost, Overhead, Unallocated
- Period filter: Latest, 7 Days, 30 Days, All Time
- Cost Distribution doughnut chart (per container)
- Cost Breakdown bar chart (CPU vs RAM vs Storage)
- Cost Trend line chart (over time)
- Container table (name, image, CPU%, RAM, CPU cost, RAM cost, total)

**Containers** — Container list with click-through to detail view:
- Individual container cost history chart
- CPU / RAM / cost details

**VPS Management (Admin)** — CRUD for VPS agents:
- VPS list with specs, price, status (online/offline), last seen
- Add VPS → auto-generates API key
- View details → latest report per VPS
- Delete VPS → removes all associated data

**Settings** — Configure VPS specs:
- Name, currency, price per month, overhead%
- CPU cores, RAM, storage
- Cost weights (CPU, RAM, Storage, Network)

**Users (Admin)** — User management:
- Create, edit role, delete users
- Reset password

### Chart Types

| Chart | Type | Data |
|-------|------|------|
| Cost Distribution | Doughnut | Per-container cost share |
| Cost Breakdown | Bar | CPU vs RAM vs Storage per container |
| Cost Trend | Line | Total cost over time |
| Detail History | Line | Single container cost over time |

### Roles & Permissions

| Feature | Admin | Engineer | Management |
|---------|-------|----------|------------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Containers | ✅ | ✅ | ✅ |
| View Cost Trends | ✅ | ✅ | ✅ |
| View/Edit Settings | ✅ | ✅ | ❌ |
| Generate Report | ✅ | ✅ | ❌ |
| Manage VPS | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ |

---
