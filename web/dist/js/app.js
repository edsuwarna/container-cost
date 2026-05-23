// ─── State ─────────────────────────────────────────────────
let state = {
    report: null,
    containers: [],
    config: null,
    currentPage: 'dashboard',
    selectedContainer: null,
    charts: {
        cost: null,
        breakdown: null,
        history: null,
    }
};

// ─── API Client ───────────────────────────────────────────
const API = {
    async get(path) {
        const res = await fetch(`/api${path}`);
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return res.json();
    },
    async post(path) {
        const res = await fetch(`/api${path}`, { method: 'POST' });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return res.json();
    },
    async put(path, data) {
        const res = await fetch(`/api${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return res.json();
    }
};

// ─── Format Helpers ────────────────────────────────────────
function formatCurrency(n, currency = 'IDR') {
    if (n == null || isNaN(n)) return '-';
    if (currency === 'IDR') {
        return 'Rp ' + Math.round(n).toLocaleString('id-ID');
    }
    return currency + ' ' + n.toFixed(2);
}

function formatBytes(mb) {
    if (mb == null || isNaN(mb)) return '-';
    if (mb < 1024) return mb.toFixed(0) + ' MB';
    return (mb / 1024).toFixed(2) + ' GB';
}

function formatPercent(v) {
    if (v == null || isNaN(v)) return '-';
    return v.toFixed(1) + '%';
}

function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Navigation ────────────────────────────────────────────
function navigate(page) {
    state.currentPage = page;

    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(el => {
        el.classList.toggle('active', el.id === `page-${page}`);
    });

    if (page === 'dashboard') renderDashboard();
    if (page === 'containers') renderContainerList();
    if (page === 'config') loadConfig();
}

document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.page);
    });
});

document.getElementById('btnRefresh').addEventListener('click', refreshReport);
document.getElementById('btnGenerateReport')?.addEventListener('click', refreshReport);

// ─── Report Refresh ────────────────────────────────────────
async function refreshReport() {
    const btn = document.getElementById('btnRefresh');
    btn.classList.add('loading');
    try {
        const result = await API.post('/report/refresh');
        state.report = result.report;
        setStatus('ok', 'Updated ' + formatTime(new Date().toISOString()));
        renderDashboard();
        showConfigStatus('✅ Report generated!', 'success');
    } catch (err) {
        setStatus('error', err.message);
        showConfigStatus('❌ ' + err.message, 'error');
    } finally {
        btn.classList.remove('loading');
    }
}

// ─── Status ────────────────────────────────────────────────
function setStatus(type, text) {
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    if (type === 'ok') {
        dot.style.background = 'var(--green)';
        txt.textContent = text || 'Connected';
    } else {
        dot.style.background = 'var(--red)';
        txt.textContent = text || 'Error';
    }
}

// ─── Main Load ─────────────────────────────────────────────
async function loadDashboard() {
    try {
        const [report, containers] = await Promise.all([
            API.get('/report/latest').catch(() => null),
            API.get('/containers').catch(() => []),
        ]);
        state.report = report?.vps ? report : null;
        state.containers = Array.isArray(containers) ? containers : [];
        renderDashboard();
    } catch (err) {
        setStatus('error', err.message);
    }
}

// ─── Dashboard Render ──────────────────────────────────────
function renderDashboard() {
    const r = state.report;
    if (!r || !r.vps) {
        document.getElementById('vpsName').textContent = 'No data yet';
        document.getElementById('lastUpdated').textContent = 'click refresh';
        document.getElementById('totalCost').textContent = '-';
        document.getElementById('containerCount').textContent = '0';
        document.getElementById('overheadCost').textContent = '-';
        document.getElementById('unallocCost').textContent = '-';
        document.getElementById('tableCount').textContent = '0 containers';
        document.getElementById('containerTableBody').innerHTML =
            '<tr><td colspan="8" class="empty-state">No data yet. Click 🔄 Refresh to generate a report.</td></tr>';
        return;
    }

    const currency = r.vps.currency || 'IDR';

    document.getElementById('vpsName').textContent = r.vps.name || 'VPS';
    document.getElementById('lastUpdated').textContent = 'updated just now';

    document.getElementById('totalCost').textContent = formatCurrency(r.total_cost, currency);
    document.getElementById('containerCount').textContent = (r.containers || []).length;
    document.getElementById('overheadCost').textContent = formatCurrency(r.overhead_cost, currency);
    document.getElementById('unallocCost').textContent = formatCurrency(r.unallocated_cost, currency);

    // Table
    const tbody = document.getElementById('containerTableBody');
    const containers = r.containers || [];

    if (containers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No containers running</td></tr>';
        document.getElementById('tableCount').textContent = '0 containers';
    } else {
        tbody.innerHTML = containers.map(c => `
            <tr>
                <td><a href="#" class="container-name" data-name="${c.container.name}">${c.container.name}</a></td>
                <td style="color:var(--text-secondary)">${c.container.image || '-'}</td>
                <td>${formatPercent(c.container.cpu_percent)}</td>
                <td>${formatBytes(c.container.mem_usage_mb)}</td>
                <td><span class="status-${c.container.status || 'running'}">${c.container.status || 'running'}</span></td>
                <td>${formatCurrency(c.cpu_cost, currency)}</td>
                <td>${formatCurrency(c.ram_cost, currency)}</td>
                <td style="color:var(--accent);font-weight:600">${formatCurrency(c.total_cost, currency)}</td>
            </tr>
        `).join('');
        document.getElementById('tableCount').textContent = containers.length + ' containers';

        tbody.querySelectorAll('.container-name').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                navigate('containers');
                showContainerDetail(el.dataset.name);
            });
        });
    }

    // Charts
    renderCostChart(containers, currency);
    renderBreakdownChart(r, currency);
}

// ─── Cost Distribution Chart (Doughnut) ────────────────────
function renderCostChart(containers, currency) {
    const ctx = document.getElementById('costChart').getContext('2d');
    if (state.charts.cost) { state.charts.cost.destroy(); }

    const labels = containers.map(c => c.container.name);
    const data = containers.map(c => c.total_cost || 0);
    const colors = generateColors(containers.length);

    state.charts.cost = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: 'var(--bg-card)',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: 'var(--text-secondary)',
                        font: { size: 12 },
                        padding: 16,
                        usePointStyle: true,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed, currency)}`
                    }
                }
            }
        }
    });
}

// ─── Cost Breakdown Chart (Bar) ────────────────────────────
function renderBreakdownChart(report, currency) {
    const ctx = document.getElementById('breakdownChart').getContext('2d');
    if (state.charts.breakdown) { state.charts.breakdown.destroy(); }

    const labels = ['Containers', 'Overhead', 'Unallocated'];
    const data = [
        (report.containers || []).reduce((s, c) => s + (c.total_cost || 0), 0),
        report.overhead_cost || 0,
        report.unallocated_cost || 0,
    ];
    const colors = ['var(--accent)', 'var(--yellow)', 'var(--text-muted)'];

    state.charts.breakdown = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Cost per Month',
                data,
                backgroundColor: colors.map(c => c.replace('var(', '').replace(')', '').trim()),
                // Use CSS variables via hex approximation
                backgroundColor: ['rgba(88,166,255,0.7)', 'rgba(210,153,34,0.7)', 'rgba(72,79,88,0.7)'],
                borderColor: ['rgba(88,166,255,1)', 'rgba(210,153,34,1)', 'rgba(72,79,88,1)'],
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(48,54,61,0.5)' },
                    ticks: {
                        color: 'var(--text-muted)',
                        callback: (v) => formatCurrency(v, currency),
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'var(--text-secondary)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatCurrency(ctx.parsed.y, currency)
                    }
                }
            }
        }
    });
}

// ─── Container List ────────────────────────────────────────
function renderContainerList() {
    const containerList = document.getElementById('containerList');
    const detail = document.getElementById('containerDetail');
    detail.style.display = 'none';
    containerList.style.display = 'grid';

    const containers = state.report?.containers || [];
    if (containers.length === 0) {
        containerList.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:48px">No containers. Refresh the dashboard first.</div>';
        return;
    }

    const currency = state.report?.vps?.currency || 'IDR';

    containerList.innerHTML = containers.map(c => `
        <div class="container-card" data-name="${c.container.name}">
            <div class="container-card-header">
                <span class="container-card-name">${c.container.name}</span>
                <span class="container-card-status ${c.container.status !== 'running' ? 'stopped' : ''}">${c.container.status || 'running'}</span>
            </div>
            <div class="container-card-metrics">
                <div class="metric">
                    <span class="metric-label">CPU</span>
                    <span class="metric-value">${formatPercent(c.container.cpu_percent)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">RAM</span>
                    <span class="metric-value">${formatBytes(c.container.mem_usage_mb)}</span>
                </div>
            </div>
            <div class="container-card-cost">${formatCurrency(c.total_cost, currency)} / month</div>
        </div>
    `).join('');

    containerList.querySelectorAll('.container-card').forEach(el => {
        el.addEventListener('click', () => showContainerDetail(el.dataset.name));
    });
}

// ─── Container Detail ──────────────────────────────────────
async function showContainerDetail(name) {
    const containerList = document.getElementById('containerList');
    const detail = document.getElementById('containerDetail');
    containerList.style.display = 'none';
    detail.style.display = 'block';

    state.selectedContainer = name;
    document.getElementById('containerDetailName').textContent = name;

    // Show container info from report
    const container = state.report?.containers?.find(c => c.container.name === name);
    const currency = state.report?.vps?.currency || 'IDR';

    if (container) {
        document.getElementById('detailInfo').innerHTML = `
            <div class="info-item">
                <span class="info-label">Image</span>
                <span class="info-value">${container.container.image || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">CPU Usage</span>
                <span class="info-value">${formatPercent(container.container.cpu_percent)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Memory</span>
                <span class="info-value">${formatBytes(container.container.mem_usage_mb)} / ${formatBytes(container.container.mem_limit_mb)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Status</span>
                <span class="info-value">${container.container.status || 'running'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">CPU Cost</span>
                <span class="info-value">${formatCurrency(container.cpu_cost, currency)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">RAM Cost</span>
                <span class="info-value">${formatCurrency(container.ram_cost, currency)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Storage Cost</span>
                <span class="info-value">${formatCurrency(container.storage_cost, currency)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Total Cost</span>
                <span class="info-value" style="color:var(--accent)">${formatCurrency(container.total_cost, currency)}</span>
            </div>
        `;
    }

    // Load history chart
    try {
        const history = await API.get(`/containers/${encodeURIComponent(name)}`);
        renderHistoryChart(history, currency);
    } catch {
        renderHistoryChart([], currency);
    }
}

document.getElementById('btnBackToList').addEventListener('click', () => {
    document.getElementById('containerDetail').style.display = 'none';
    document.getElementById('containerList').style.display = 'grid';
    state.selectedContainer = null;
});

// ─── History Chart ─────────────────────────────────────────
function renderHistoryChart(history, currency) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    if (state.charts.history) { state.charts.history.destroy(); }

    if (!history || history.length === 0) {
        state.charts.history = null;
        return;
    }

    const labels = history.map(h => formatTime(h.timestamp)).reverse();
    const costs = history.map(h => h.total_cost || 0).reverse();

    state.charts.history = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Cost',
                data: costs,
                borderColor: 'rgba(88,166,255,1)',
                backgroundColor: 'rgba(88,166,255,0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(48,54,61,0.5)' },
                    ticks: {
                        color: 'var(--text-muted)',
                        callback: (v) => formatCurrency(v, currency),
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'var(--text-muted)', maxTicksLimit: 8 }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatCurrency(ctx.parsed.y, currency)
                    }
                }
            }
        }
    });
}

// ─── Config ────────────────────────────────────────────────
async function loadConfig() {
    try {
        state.config = await API.get('/config');
        populateForm(state.config);
    } catch (err) {
        showConfigStatus('❌ Failed to load config: ' + err.message, 'error');
    }
}

function populateForm(cfg) {
    const form = document.getElementById('configForm');
    Object.keys(cfg).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
            input.value = cfg[key];
        }
    });
}

document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    new FormData(form).forEach((value, key) => {
        // Parse numeric types
        const num = parseFloat(value);
        data[key] = isNaN(num) ? value : num;
    });

    try {
        await API.put('/config', data);
        state.config = data;
        showConfigStatus('✅ Config saved! Refresh report to apply changes.', 'success');
        setTimeout(() => document.getElementById('configStatus').style.display = 'none', 5000);
    } catch (err) {
        showConfigStatus('❌ ' + err.message, 'error');
    }
});

function showConfigStatus(msg, type) {
    const el = document.getElementById('configStatus');
    el.textContent = msg;
    el.className = 'config-status ' + type;
    el.style.display = 'block';
}

// ─── Color Generator ───────────────────────────────────────
function generateColors(n) {
    const palette = [
        '#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff',
        '#56d4dd', '#f778ba', '#e3b341', '#7ee787', '#a5d6ff',
        '#ff7b72', '#d2a8ff', '#79c0ff', '#aff5b4', '#ffd78c',
    ];
    return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
}

// ─── Auto Refresh ──────────────────────────────────────────
let autoRefreshInterval = 30000; // 30s
let autoRefreshTimer;

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(async () => {
        try {
            const result = await API.post('/report/refresh');
            state.report = result.report;
            if (state.currentPage === 'dashboard') renderDashboard();
            else if (state.currentPage === 'containers' && !state.selectedContainer) renderContainerList();
            else if (state.selectedContainer) {
                // re-fetch to update container list
                const containers = await API.get('/containers');
                state.containers = containers;
            }
            setStatus('ok', 'Auto-refreshed');
        } catch { /* silent */ }
    }, autoRefreshInterval);
}

// ─── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    startAutoRefresh();
});
