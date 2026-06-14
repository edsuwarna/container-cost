#!/usr/bin/env python3
"""Seed dummy data for ContainerCost testing.

Inserts:
- 4 VPS servers (matching mockup: mini-vps, app-server-1, db-server-1, staging-01)
- 30 days of historical snapshots with varying costs
- 25 containers per snapshot to test scrolling/overflow
"""

import json
import random
import subprocess
from datetime import datetime, timedelta
import uuid

random.seed(42)

# ─── VPS Configs ───
VPSS = [
    {"name": "mini-vps",   "price_per_month": 100000, "cpu": 2,  "ram_gb": 4,  "storage_gb": 50,  "currency": "IDR", "overhead_percent": 15},
    {"name": "app-server-1","price_per_month": 250000, "cpu": 4,  "ram_gb": 8,  "storage_gb": 100, "currency": "IDR", "overhead_percent": 12},
    {"name": "db-server-1", "price_per_month": 475000, "cpu": 8,  "ram_gb": 16, "storage_gb": 250, "currency": "IDR", "overhead_percent": 10},
    {"name": "staging-01",  "price_per_month": 150000, "cpu": 4,  "ram_gb": 8,  "storage_gb": 100, "currency": "IDR", "overhead_percent": 15},
]

# ─── Container Templates: (name, cpu_weight, mem_mb, status, image) ───
CONTAINER_TEMPLATES = [
    ("postgres-16",     2.0, 2048, "running", "postgres:16-alpine"),
    ("postgres-17",     1.5, 512,  "running", "postgres:17-alpine"),
    ("postgres-15",     0.8, 512,  "running", "postgres:15-alpine"),
    ("postgres-18",     1.2, 512,  "running", "postgres:18"),
    ("arus-api",        1.2, 768,  "running", "arus-api:latest"),
    ("arus-console",    0.5, 256,  "running", "arus-console:latest"),
    ("arus-db",         0.6, 512,  "running", "postgres:15-alpine"),
    ("arus-worker",     0.8, 384,  "running", "arus-worker:latest"),
    ("anjungan-api",    0.8, 512,  "running", "anjungan-api:latest"),
    ("anjungan-frontend",0.4, 256, "running", "anjungan-frontend:latest"),
    ("anjungan-zot",     1.5, 1024,"running", "ghcr.io/project-zot/zot-linux-amd64:latest"),
    ("anjungan-redis",  0.3, 128,  "running", "redis:7-alpine"),
    ("anjungan-postgres",0.8, 512, "running", "postgres:17-alpine"),
    ("nginx-proxy",     0.2, 64,   "running", "nginx:alpine"),
    ("redis-cache",     0.3, 128,  "running", "redis:7-alpine"),
    ("redis-session",   0.25, 96,  "running", "redis:7-alpine"),
    ("traefik",         0.3, 128,  "running", "traefik:v3"),
    ("prometheus",      0.5, 768,  "running", "prom/prometheus"),
    ("grafana",         0.4, 512,  "running", "grafana/grafana"),
    ("loki",            0.6, 1024, "running", "grafana/loki"),
    ("temporal-server", 0.4, 512,  "running", "temporalio/server"),
    ("minio",           0.5, 256,  "paused",  "minio/minio"),
    ("staging-api",     0.5, 256,  "running", "staging-api:latest"),
    ("upload-service",  0.3, 128,  "running", "upload:latest"),
    ("notification-svc",0.2, 128,  "running", "notif:latest"),
]


def docker_exec(sql):
    """Execute SQL via docker compose exec."""
    cmd = [
        "docker", "compose", "exec", "-T", "postgres",
        "psql", "-U", "docker-cost", "-d", "docker-cost",
        "-c", sql,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd="/home/ubuntu/projects/container-cost")
    return result.stdout


def generate_container(name, mem_mb, cpu_percent, mem_usage_mb, mem_limit_mb, status):
    """Generate a single container report entry."""
    cpu_cost_base = max(0, cpu_percent * random.uniform(50, 200))
    ram_cost_base = (mem_usage_mb / max(mem_limit_mb, 1)) * random.uniform(300, 800)
    storage_cost = random.uniform(500, 2000)
    total_cost = cpu_cost_base + ram_cost_base + storage_cost

    return {
        "cpu_cost": round(cpu_cost_base, 2),
        "ram_cost": round(ram_cost_base, 2),
        "container": {
            "id": uuid.uuid4().hex[:12],
            "name": name,
            "image": "container:latest",
            "status": status,
            "uptime": "",
            "created_at": "2026-05-01T00:00:00Z",
            "cpu_percent": round(cpu_percent, 4),
            "mem_percent": round(mem_usage_mb / max(mem_limit_mb, 1) * 100, 4),
            "mem_limit_mb": round(mem_limit_mb, 2),
            "mem_usage_mb": round(mem_usage_mb, 2),
        },
        "total_cost": round(total_cost, 2),
        "storage_cost": round(storage_cost, 2),
    }


def generate_snapshot(vps, containers_data, day_idx):
    """Generate a snapshot for a given day index (0 = oldest, 29 = newest/today)."""
    mem_limit_mb = vps["ram_gb"] * 1024
    overhead_pct = vps["overhead_percent"]

    # Progressive cost increase over 30 days (trend goes up)
    trend = 1.0 + (day_idx / 29) * 0.35
    # Weekly pattern
    weekly = 1.0 + 0.2 * ((day_idx % 7) - 3) / 3

    total_vps_price = vps["price_per_month"]

    snapshot_containers = []
    total_container_cost = 0

    for name, cpu_w, mem_mb, status, img in containers_data:
        cpu_var = random.uniform(0.3, 1.8)
        mem_var = random.uniform(0.3, 1.8)

        cpu_pct = min(cpu_w * cpu_var * trend * weekly, 100.0)
        mem_usage = min(mem_mb * mem_var * trend * weekly, mem_limit_mb * 0.85)

        # Some containers paused on later days
        c_status = status
        if day_idx > 20 and name == "minio":
            c_status = "paused"

        c = generate_container(name, mem_mb, cpu_pct, mem_usage, mem_limit_mb, c_status)
        c["container"]["image"] = img
        snapshot_containers.append(c)
        total_container_cost += c["total_cost"]

    overhead_cost = round(total_vps_price * overhead_pct / 100, 2)
    unallocated = round(total_vps_price - total_container_cost - overhead_cost, 2)

    # Ensure unallocated is positive for demo
    if unallocated < 5000:
        unallocated = round(random.uniform(15000, 60000), 2)
        # Rebalance: overhead stays same, total container cost = vps_price - overhead - unallocated
        scale_factor = (total_vps_price - overhead_cost - unallocated) / max(total_container_cost, 1)
        if scale_factor > 0:
            for c in snapshot_containers:
                c["total_cost"] = round(c["total_cost"] * scale_factor, 2)
                c["cpu_cost"] = round(c["cpu_cost"] * scale_factor, 2)
                c["ram_cost"] = round(c["ram_cost"] * scale_factor, 2)
                c["storage_cost"] = round(c["storage_cost"] * scale_factor, 2)
            total_container_cost = sum(c["total_cost"] for c in snapshot_containers)
            unallocated = round(total_vps_price - total_container_cost - overhead_cost, 2)

    return {
        "vps": {
            "name": vps["name"],
            "ram_gb": vps["ram_gb"],
            "currency": vps["currency"],
            "cpu_cores": vps["cpu"],
            "price_per_month": total_vps_price,
        },
        "period": "month",
        "containers": snapshot_containers,
        "total_cost": total_vps_price,
        "overhead_cost": overhead_cost,
        "unallocated_cost": round(max(0, unallocated), 2),
    }


def seed():
    print("🗑️  Removing existing data...")
    docker_exec("DELETE FROM snapshots")
    docker_exec("DELETE FROM vps_agents")
    docker_exec("ALTER SEQUENCE vps_agents_id_seq RESTART WITH 1")

    print("🏗️  Creating VPS records...")
    vps_ids = {}
    for v in VPSS:
        api_key = uuid.uuid4().hex
        sql = f"""
        INSERT INTO vps_agents (name, api_key, cpu, ram_gb, storage_gb, price_per_month, currency,
                                cpu_weight, ram_weight, storage_weight, overhead_percent, notes, status, last_seen)
        VALUES ('{v['name']}', '{api_key}', {v['cpu']}, {v['ram_gb']}, {v['storage_gb']},
                {v['price_per_month']}, '{v['currency']}', 0.5, 0.4, 0.1, {v['overhead_percent']},
                'seed data', 'online', NOW())
        RETURNING id;
        """
        output = docker_exec(sql)
        for line in output.split('\n'):
            line = line.strip()
            if line.isdigit():
                vps_ids[v['name']] = int(line)
                break
        print(f"  ✓ {v['name']}")

    if not vps_ids:
        print("❌ Failed to create VPS!")
        return

    # Select container subsets per VPS
    all_templates = CONTAINER_TEMPLATES.copy()
    per_vps = [10, 25, 20, 8]  # stagger for visual variety

    print("📊 Generating 30-day snapshots...")
    base_date = datetime(2026, 5, 15)
    total_ok = 0

    for vi, vps in enumerate(VPSS):
        name = vps['name']
        vid = vps_ids.get(name)
        if not vid:
            continue

        templates = all_templates.copy()
        random.shuffle(templates)
        vps_templates = templates[:per_vps[vi]]

        for day in range(30):
            dt = base_date + timedelta(days=day)
            report = generate_snapshot(vps, vps_templates, day)
            report["created_at"] = dt.strftime("%Y-%m-%dT%H:%M:%SZ")

            rj = json.dumps(report).replace("'", "''")

            sql = f"INSERT INTO snapshots (vps_id, created_at, report_json) VALUES ({vid}, '{dt.isoformat()}', '{rj}');"
            docker_exec(sql)
            total_ok += 1

    print(f"\n✅ {total_ok} snapshots inserted across {len(VPSS)} VPS servers!")
    print(f"   Containers per VPS: {per_vps}")
    print()
    for v in VPSS:
        print(f"   • {v['name']}: Rp {v['price_per_month']:,}/mo ({v['cpu']}c/{v['ram_gb']}GB/{v['storage_gb']}GB)")


if __name__ == "__main__":
    seed()
