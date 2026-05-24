// ─── State ─────────────────────────────────────────────────
let state = {
    report: null,
    containers: [],
    config: null,
    currentPage: 'dashboard',
    selectedContainer: null,
    userRole: null,
    charts: {
        cost: null,
        breakdown: null,
        history: null,
        trend: null,
    }
};

// ─── API Client ───────────────────────────────────────────
const API = {
    async get(path) {
        const res = await fetch(`/api${path}`, { credentials: 'include' });
        if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return res.json();
    },
    async post(path) {
        const res = await fetch(`/api${path}`, { method: 'POST', credentials: 'include' });
        if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return res.json();
    },
    async postWithBody(path, data) {
        const res = await fetch(`/api${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });
        if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return res.json();
    },
    async put(path, data) {
        const res = await fetch(`/api${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });
        if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return res.json();
    },
    async del(path) {
        const res = await fetch(`/api${path}`, { method: 'DELETE', credentials: 'include' });
        if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
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

// ─── Password Toggle ─────────────────────────────────────
function togglePwd(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPwd = input.type === 'password';
    input.type = isPwd ? 'text' : 'password';
    btn.textContent = isPwd ? '🙈' : '👁️';
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

    // Update topbar title
    const titles = { 'dashboard': 'Dashboard', 'containers': 'Containers', 'config': 'Settings', 'users': 'Users', 'permissions': 'Permissions' };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    if (page === 'dashboard') renderDashboard();
    if (page === 'containers') renderContainerList();
    if (page === 'config') loadConfig();
    if (page === 'users') loadUsers();
    if (page === 'permissions') renderPermissions();
}

document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.page);
    });
});

document.getElementById('btnGenerateReport')?.addEventListener('click', refreshReport);

// ─── Loading Overlay ─────────────────────────────────
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// ─── Report Refresh ────────────────────────────────────────
async function refreshReport() {
    showLoading();
    const btn = document.getElementById('btnGenerateReport');
    if (btn) btn.classList.add('loading');
    try {
        const result = await API.post('/report/refresh');
        state.report = result.report;
        setStatus('ok', 'Updated ' + formatTime(new Date().toISOString()));
        await reloadDashboard();
        showConfigStatus('✅ Report generated!', 'success');
    } catch (err) {
        setStatus('error', err.message);
        showConfigStatus('❌ ' + err.message, 'error');
    } finally {
        hideLoading();
        if (btn) btn.classList.remove('loading');
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

// ─── Auth ────────────────────────────────────────────────
let isAuthenticated = false;

function showLogin() {
    isAuthenticated = false;
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
}

function showApp() {
    isAuthenticated = true;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const errEl = document.getElementById('loginError');
    try {
        const res = await API.postWithBody('/auth/login', { username, password });
        if (res.success) {
            state.userRole = res.role;
            if (res.role === 'admin') {
                document.getElementById('navUsers').style.display = 'flex';
                document.getElementById('navPermissions').style.display = 'flex';
            }
            document.getElementById('sidebarUser').textContent = res.user;
            showApp();
            loadDashboard();
        }
    } catch (err) {
        errEl.textContent = 'Invalid credentials';
        errEl.style.display = 'block';
    }
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    try { await API.post('/auth/logout'); } catch {}
    state.userRole = null;
    document.getElementById('navUsers').style.display = 'none';
    document.getElementById('navPermissions').style.display = 'none';
    document.getElementById('sidebarUser').textContent = '';
    showLogin();
});

async function checkAuth() {
    try {
        const res = await API.get('/auth/check');
        if (res.authenticated) {
            state.userRole = res.role;
            if (res.role === 'admin') {
                document.getElementById('navUsers').style.display = 'flex';
                document.getElementById('navPermissions').style.display = 'flex';
            }
            document.getElementById('sidebarUser').textContent = res.user;
            showApp();
            return true;
        }
    } catch {}
    showLogin();
    return false;
}

// ─── Cost Trend ──────────────────────────────────────────
async function loadCostTrend() {
    try {
        const data = await API.get('/costs/trends');
        renderTrendChart(data);
        if (data.vps_name) {
            document.getElementById('vpsName').textContent = data.vps_name;
        }
        if (data.budget > 0 && data.current_month > 0) {
            const pct = ((data.current_month / data.budget) * 100).toFixed(1);
            document.getElementById('totalPeriod').textContent = `${pct}% of budget`;
            const indicator = document.getElementById('budgetIndicator');
            if (indicator) {
                const numPct = parseFloat(pct);
                if (numPct > 90) { indicator.textContent = '⚠ ' + pct + '%'; indicator.className = 'card-change down'; }
                else if (numPct > 70) { indicator.textContent = '📊 ' + pct + '%'; indicator.className = 'card-change up'; }
                else { indicator.textContent = '✅ ' + pct + '%'; indicator.className = 'card-change up'; }
            }
        }
    } catch {}
}

function renderTrendChart(data) {
    const canvas = document.getElementById('trendChart');
    if (!canvas || !data.trends || data.trends.length === 0) return;
    const ctx = canvas.getContext('2d');

    if (state.charts.trend) { state.charts.trend.destroy(); }

    const labels = data.trends.map(t => {
        const parts = t.date.split('-');
        if (parts.length >= 3) return parts[2] + '/' + parts[1];
        return t.date;
    });
    const costs = data.trends.map(t => t.total_cost || 0);
    const containers = data.trends.map(t => t.containers || 0);

    state.charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Total Cost',
                data: costs,
                borderColor: '#58a6ff',
                backgroundColor: 'rgba(88,166,255,0.08)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: '#58a6ff',
                pointBorderColor: '#0b0f1a',
                pointBorderWidth: 2,
                borderWidth: 3,
                yAxisID: 'y',
            }, {
                label: 'Containers',
                data: containers,
                borderColor: '#3fb950',
                backgroundColor: 'rgba(63,185,80,0.05)',
                fill: false,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#3fb950',
                pointBorderColor: '#0b0f1a',
                pointBorderWidth: 2,
                borderWidth: 2,
                borderDash: [5, 3],
                yAxisID: 'y1',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(48,54,61,0.5)' },
                    ticks: {
                        color: '#b0b6c4',
                        callback: (v) => data.currency === 'IDR' ? 'Rp' + Math.round(v).toLocaleString('id-ID') : '$' + v.toFixed(0),
                    }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: {
                        color: 'rgba(63,185,80,0.7)',
                        callback: (v) => v + ' c',
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#b0b6c4', maxTicksLimit: 10 }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#d4d8e0', font: { size: 11 }, padding: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.datasetIndex === 0) return 'Cost: ' + (data.currency === 'IDR' ? 'Rp' + Math.round(ctx.parsed.y).toLocaleString('id-ID') : '$' + ctx.parsed.y.toFixed(2));
                            return 'Containers: ' + ctx.parsed.y;
                        }
                    }
                }
            }
        }
    });
}

// ─── Period Filter ────────────────────────────────────
let currentPeriod = 'latest';

async function setPeriod(period) {
    currentPeriod = period;
    // Update button states
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });
    const info = document.getElementById('periodInfo');
    const labels = {
        'latest': 'Showing latest snapshot',
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        'all': 'All time'
    };
    info.textContent = labels[period] || period;
    await reloadDashboard();
}

async function reloadDashboard() {
    try {
        const since = getPeriodSince();
        let report, containers;

        if (currentPeriod === 'latest') {
            [report, containers] = await Promise.all([
                API.get('/report/latest').catch(() => null),
                API.get('/containers').catch(() => []),
            ]);
        } else {
            // Load history for the period
            const history = await API.get(`/report/history?since=${encodeURIComponent(since.toISOString())}`).catch(() => []);
            // Use the most recent snapshot in the period
            report = history.length > 0 ? history[0] : null;
            containers = report?.containers?.map(c => ({
                name: c.container.name,
                image: c.container.image,
                cpu_percent: c.container.cpu_percent,
                mem_usage_mb: c.container.mem_usage_mb,
                mem_percent: c.container.mem_percent,
                cost_per_month: c.total_cost,
                cpu_cost: c.cpu_cost,
                ram_cost: c.ram_cost,
                status: c.container.status,
            })) || [];
        }

        state.report = report?.vps ? report : null;
        state.containers = Array.isArray(containers) ? containers : [];
        renderDashboard();
    } catch (err) {
        setStatus('error', err.message);
    }
}

function getPeriodSince() {
    const now = new Date();
    switch (currentPeriod) {
        case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case 'all': return new Date('2020-01-01');
        default: return now;
    }
}

// ─── Main Load ─────────────────────────────────────────────
async function loadDashboard() {
    await reloadDashboard();
}

// ─── Dashboard Render ──────────────────────────────────────
function renderDashboard() {
    const r = state.report;
    if (!r || !r.vps) {
        document.getElementById('vpsName').textContent = 'No data yet · click refresh';
        document.getElementById('lastUpdated').textContent = '-';
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

    document.getElementById('vpsName').textContent = (r.vps.name || 'VPS') + ' · ' + document.getElementById('periodInfo').textContent;
    document.getElementById('lastUpdated').textContent = r.vps.currency || 'IDR';

    document.getElementById('totalCost').textContent = formatCurrency(r.total_cost, currency);
    const totalContainerCost = (r.containers || []).reduce((sum, c) => sum + (c.total_cost || 0), 0);
    document.getElementById('containerCount').textContent = formatCurrency(totalContainerCost, currency);
    document.getElementById('containerSub').textContent = (r.containers || []).length + ' containers';
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
    loadCostTrend();
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
                        color: '#d4d8e0',
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

    state.charts.breakdown = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Cost per Month',
                data,
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
                        color: '#b0b6c4',
                        callback: (v) => formatCurrency(v, currency),
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#d4d8e0' }
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

    // Rebuild chart container fresh (avoid stale canvas issues)
    const chartCard = document.querySelector('#containerDetail .detail-chart-card');
    const oldChartContainer = chartCard.querySelector('.chart-container');
    if (oldChartContainer) oldChartContainer.remove();

    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'historyLoading';
    loadingDiv.style.cssText = 'text-align:center;padding:48px;color:var(--text-muted);font-size:13px;';
    loadingDiv.textContent = '🔄 Loading history...';
    chartCard.appendChild(loadingDiv);

    // Fetch history
    try {
        const history = await API.get(`/containers/${encodeURIComponent(name)}`);

        // Remove loading
        loadingDiv.remove();

        // Create new chart container
        const newChartContainer = document.createElement('div');
        newChartContainer.className = 'chart-container';
        newChartContainer.style.cssText = 'height:300px;position:relative;';

        if (history && history.length > 0) {
            // Add data summary above chart
            const total = history.reduce((s, h) => s + (h.total_cost || 0), 0);
            const avg = total / history.length;
            const summary = document.createElement('div');
            summary.style.cssText = 'text-align:center;padding:0 0 12px;color:var(--text-muted);font-size:11px;';
            summary.textContent = `📊 ${history.length} snapshots · Avg: ${formatCurrency(avg, currency)} · Latest: ${formatCurrency(history[0].total_cost || 0, currency)}`;
            newChartContainer.appendChild(summary);

            // Create fresh canvas
            const canvas = document.createElement('canvas');
            canvas.id = 'historyChart';
            newChartContainer.appendChild(canvas);
            chartCard.appendChild(newChartContainer);

            // Small delay then render
            await new Promise(r => setTimeout(r, 100));
            renderHistoryChart(history, currency);
        } else {
            // No data
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'text-align:center;padding:48px;color:var(--text-muted);font-size:12px;';
            emptyMsg.textContent = '📊 Collecting more data points — click Generate Report a few times';
            newChartContainer.appendChild(emptyMsg);
            chartCard.appendChild(newChartContainer);
        }
    } catch (err) {
        loadingDiv.remove();
        const errMsg = document.createElement('div');
        errMsg.style.cssText = 'text-align:center;padding:48px;color:var(--red);font-size:12px;';
        errMsg.textContent = '❌ Failed to load history: ' + (err.message || 'unknown error');
        chartCard.appendChild(errMsg);
    }
}

document.getElementById('btnBackToList').addEventListener('click', () => {
    document.getElementById('containerDetail').style.display = 'none';
    document.getElementById('containerList').style.display = 'grid';
    state.selectedContainer = null;
});

// ─── History Chart ─────────────────────────────────────────
function renderHistoryChart(history, currency) {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.charts.history) { state.charts.history.destroy(); }
    state.charts.history = null;

    if (!history || history.length === 0) return;

    // Set explicit canvas dimensions
    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.clientWidth || 600;
        canvas.height = parent.clientHeight || 280;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
    }

    try {
        const labels = history.map(h => {
            if (!h.timestamp) return '-';
            try {
                const d = new Date(h.timestamp);
                return String(d.getDate()).padStart(2, '0') + '/' +
                       String(d.getMonth() + 1).padStart(2, '0') + ' ' +
                       String(d.getHours()).padStart(2, '0') + ':' +
                       String(d.getMinutes()).padStart(2, '0');
            } catch { return h.timestamp.substring(0, 10); }
        }).reverse();
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
                animation: { duration: 300 },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(48,54,61,0.5)' },
                        ticks: {
                            color: '#b0b6c4',
                            callback: (v) => formatCurrency(v, currency),
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#b0b6c4', maxTicksLimit: 8 }
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
    } catch (err) {
        // Chart render failed — summary already shown above
    }
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
document.addEventListener('DOMContentLoaded', async () => {
    const authed = await checkAuth();
    if (authed) {
        loadDashboard();
        startAutoRefresh();
    }
});

// ─── User Management ──────────────────────────────────────
async function loadUsers() {
    try {
        const users = await API.get('/users');
        renderUsersTable(users);
    } catch (err) {
        document.getElementById('usersTableBody').innerHTML =
            `<tr><td colspan="6" class="empty-state">❌ ${err.message}</td></tr>`;
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${u.display_name || '-'}</td>
            <td><span class="user-role-badge user-role-${u.role}">${u.role}</span></td>
            <td>${formatTime(u.created_at)}</td>
            <td>
                <button class="btn-role-edit" onclick="openRoleModal(${u.id}, '${u.username}', '${u.role}')" title="Edit role">✏️</button>
                <button class="btn-user-reset" onclick="openResetPasswordModal(${u.id}, '${u.username}')" title="Reset password">🔑</button>
                <button class="btn-user-delete" onclick="deleteUser(${u.id}, '${u.username}')" title="Delete user">🗑</button>
            </td>
        </tr>
    `).join('');
}

// Modal handlers
document.getElementById('btnAddUser').addEventListener('click', () => {
    document.getElementById('userModalTitle').textContent = 'Add User';
    document.getElementById('userUsername').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userDisplayName').value = '';
    document.getElementById('userRole').value = 'engineer';
    document.getElementById('userFormError').style.display = 'none';
    document.getElementById('userModal').style.display = 'flex';
});

document.getElementById('btnCancelUser').addEventListener('click', () => {
    document.getElementById('userModal').style.display = 'none';
});

document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('userFormError');
    try {
        await API.postWithBody('/users', {
            username: document.getElementById('userUsername').value,
            password: document.getElementById('userPassword').value,
            display_name: document.getElementById('userDisplayName').value,
            role: document.getElementById('userRole').value,
        });
        document.getElementById('userModal').style.display = 'none';
        loadUsers();
    } catch (err) {
        errEl.textContent = '❌ ' + err.message;
        errEl.style.display = 'block';
    }
});

async function deleteUser(id, username) {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
        await API.del(`/users/${id}`);
        loadUsers();
    } catch (err) {
        alert('Failed to delete: ' + err.message);
    }
}

// ─── Reset Password Modal ──────────────────────────────
let resetPwdUserId = null;

function openResetPasswordModal(id, username) {
    resetPwdUserId = id;
    document.getElementById('resetPwdUserDisplay').value = username;
    document.getElementById('resetPwdNewPass').value = '';
    document.getElementById('resetPwdConfirm').value = '';
    document.getElementById('resetPwdError').style.display = 'none';
    document.getElementById('resetPwdModal').style.display = 'flex';
}

document.getElementById('btnCancelResetPwd').addEventListener('click', () => {
    document.getElementById('resetPwdModal').style.display = 'none';
    resetPwdUserId = null;
});

document.getElementById('resetPwdForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('resetPwdError');
    const newPass = document.getElementById('resetPwdNewPass').value;
    const confirm = document.getElementById('resetPwdConfirm').value;

    if (newPass.length < 4) {
        errEl.textContent = '❌ Password must be at least 4 characters';
        errEl.style.display = 'block';
        return;
    }
    if (newPass !== confirm) {
        errEl.textContent = '❌ Passwords do not match';
        errEl.style.display = 'block';
        return;
    }

    try {
        await API.postWithBody(`/users/${resetPwdUserId}/reset-password`, { password: newPass });
        document.getElementById('resetPwdModal').style.display = 'none';
        resetPwdUserId = null;
        loadUsers();
    } catch (err) {
        errEl.textContent = '❌ ' + err.message;
        errEl.style.display = 'block';
    }
});

// ─── Edit Role Modal ────────────────────────────────────
let editingUserId = null;

function openRoleModal(id, username, currentRole) {
    editingUserId = id;
    document.getElementById('roleUserDisplay').value = username;
    document.getElementById('roleCurrentDisplay').value = currentRole;
    document.getElementById('roleNewSelect').value = currentRole;
    document.getElementById('roleFormError').style.display = 'none';
    document.getElementById('roleModal').style.display = 'flex';
}

document.getElementById('btnCancelRole').addEventListener('click', () => {
    document.getElementById('roleModal').style.display = 'none';
    editingUserId = null;
});

document.getElementById('roleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('roleFormError');
    const newRole = document.getElementById('roleNewSelect').value;
    try {
        // PUT /api/users/{id} with role
        await API.put(`/users/${editingUserId}`, { role: newRole });
        document.getElementById('roleModal').style.display = 'none';
        editingUserId = null;
        loadUsers();
    } catch (err) {
        errEl.textContent = '❌ ' + err.message;
        errEl.style.display = 'block';
    }
});

// ─── Permissions Page (static) ──────────────────────────
function renderPermissions() {
    // Content is already in HTML — no dynamic data needed
    // This triggers any future dynamic logic if needed
}
