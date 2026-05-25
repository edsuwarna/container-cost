# Container Cost Documentation 📖💰🐳

> **Multi-VPS Docker Container Cost Calculator — Agent & Central Server Architecture**
> Version 2.0 | Author: Endang Suwarna

---

## Platform Variants

Container Cost is designed to be **platform-agnostic** at the VPS level. Any VPS running Docker can host an agent.

### Traditional VPS

| Provider | Tested | Notes |
|----------|--------|-------|
| Hetzner Cloud | ✅ | CX/CX series |
| DigitalOcean | ✅ | Droplets |
| Linode/Akamai | ✅ | |
| Vultr | ✅ | |
| AWS EC2 | ⚠️ | Must mount Docker socket |
| Google Cloud | ⚠️ | Must mount Docker socket |

### Special Environments

**Orchestrated environments (Kubernetes, Nomad):** The agent reads the *host* Docker socket, so it works on any single Docker host. For Kubernetes, deploy the agent as a DaemonSet to measure node-level container costs.

---
