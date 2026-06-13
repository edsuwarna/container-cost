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
        cpuTrend: null,
        memTrend: null,
        breakdownDonut: null,
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
    const icon = btn.querySelector('.icon-sm');
    if (icon) {
        icon.setAttribute('href', isPwd ? '#icon-eye-off' : '#icon-eye');
    }
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
    const titles = { 'dashboard': 'Dashboard', 'containers': 'Containers', 'vps': 'VPS', 'config': 'Settings', 'users': 'Users', 'permissions': 'Permissions' };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    if (page === 'dashboard') renderDashboard();
    if (page === 'containers') renderContainerList();
    if (page === 'vps') loadVPSList();
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
        showConfigStatus('Report generated!', 'success');
    } catch (err) {
        setStatus('error', err.message);
        showConfigStatus(err.message, 'error');
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
        dot.style.background = 'var(--accent-green)';
        txt.textContent = text || 'Connected';
    } else {
        dot.style.background = 'var(--accent-red)';
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
                const vpsNav = document.querySelector('.nav-item[data-page="vps"]');
                if (vpsNav) vpsNav.style.display = 'flex';
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
    const vpsNav = document.querySelector('.nav-item[data-page="vps"]');
    if (vpsNav) vpsNav.style.display = 'none';
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
                const vpsNav = document.querySelector('.nav-item[data-page="vps"]');
                if (vpsNav) vpsNav.style.display = 'flex';
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
            document.getElementById('vpsNameBadge').textContent = data.vps_name;
        }

        // Compute month-over-month change from trends
        if (data.trends && data.trends.length >= 2) {
            const trends = [...data.trends].sort((a, b) => a.date.localeCompare(b.date));
            const latest = trends[trends.length - 1];
            const prev = trends[trends.length - 2];

            // Total cost change
            const totalChange = prev.total_cost > 0
                ? ((latest.total_cost - prev.total_cost) / prev.total_cost) * 100
                : 0;

            // Set change badge for Total Cost
            updateChangeBadge('budgetIndicator', totalChange);

            // For container/overhead/unalloc, compute proportional changes
            // Use container count change as a proxy
            const containerChange = prev.containers > 0
                ? ((latest.containers - prev.containers) / prev.containers) * 100
                : 0;

            updateChangeBadge('containerChange', containerChange);
            updateChangeBadge('overheadChange', 0);
            updateChangeBadge('unallocChange', -(totalChange > 0 ? totalChange : -totalChange));
        }
    } catch {}
}

function updateChangeBadge(elId, change) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (change === 0 || isNaN(change) || !isFinite(change)) {
        el.textContent = '±0%';
        el.className = 'card-change neutral';
        return;
    }
    const prefix = change > 0 ? '+' : '';
    el.textContent = prefix + change.toFixed(1) + '%';
    el.className = 'card-change ' + (change > 0 ? 'up' : 'down');
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
                borderColor: '#57c1ff',
                backgroundColor: 'rgba(87,193,255,0.08)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: '#57c1ff',
                pointBorderColor: '#07080a',
                pointBorderWidth: 2,
                borderWidth: 3,
                yAxisID: 'y',
            }, {
                label: 'Containers',
                data: containers,
                borderColor: '#59d499',
                backgroundColor: 'rgba(89,212,153,0.05)',
                fill: false,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#59d499',
                pointBorderColor: '#07080a',
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
                    grid: { color: '#242728' },
                    ticks: {
                        color: '#cdcdcd',
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
                    ticks: { color: '#cdcdcd', maxTicksLimit: 10 }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f4f4f6', font: { size: 11 }, padding: 12 }
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
    await Promise.all([reloadDashboard(), renderVPSStrip()]);
}

// ─── VPS Strip ──────────────────────────────────────────────
let activeVPSId = null;

async function renderVPSStrip() {
    const strip = document.getElementById('vpsStrip');
    if (!strip) return;

    try {
        const vpsList = await API.get('/vps').catch(() => []);
        const config = await API.get('/config').catch(() => null);

        if (!vpsList || vpsList.length === 0) {
            // Show single config VPS if no agents registered
            if (config && config.name) {
                strip.innerHTML = `
                    <div class="vps-item active">
                        <div class="vps-bar blue"></div>
                        <div>
                            <div class="vps-name">${config.name}</div>
                            <div class="vps-cost">${config.currency || 'IDR'}</div>
                        </div>
                    </div>`;
            } else {
                strip.style.display = 'none';
            }
            return;
        }

        strip.style.display = 'flex';
        const colors = ['blue', 'green', 'yellow', 'purple', 'blue', 'green'];
        strip.innerHTML = vpsList.map((v, i) => `
            <div class="vps-item${activeVPSId === v.id ? ' active' : (activeVPSId === null && i === 0 ? ' active' : '')}" data-vps-id="${v.id}">
                <div class="vps-bar ${colors[i % colors.length]}"></div>
                <div>
                    <div class="vps-name">${v.name}</div>
                    <div class="vps-cost">${formatCurrency(v.price_per_month, v.currency || 'IDR')}/mo</div>
                </div>
            </div>
        `).join('');

        // Click handlers
        strip.querySelectorAll('.vps-item').forEach(item => {
            item.addEventListener('click', () => {
                strip.querySelectorAll('.vps-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                activeVPSId = parseInt(item.dataset.vpsId);
                // TODO: reload dashboard with selected VPS
            });
        });
    } catch (err) {
        strip.style.display = 'none';
    }
}

// ─── Dashboard Render ──────────────────────────────────────
function renderDashboard() {
    const r = state.report;
    if (!r || !r.vps) {
        document.getElementById('vpsNameBadge').textContent = 'No data yet';
        document.getElementById('lastUpdatedBadge').textContent = 'click refresh';
        document.getElementById('totalCost').textContent = '-';
        document.getElementById('containerCount').textContent = '0';
        document.getElementById('overheadCost').textContent = '-';
        document.getElementById('unallocCost').textContent = '-';
        document.getElementById('tableCount').textContent = '0 containers';
        document.getElementById('containerTableBody').innerHTML =
            '<tr><td colspan="6" class="empty-state">No data yet. Click Generate Report to get started.</td></tr>';
        return;
    }

    const currency = r.vps.currency || 'IDR';

    document.getElementById('vpsNameBadge').textContent = r.vps.name || 'VPS';
    const minutes = Math.floor((Date.now() - new Date(r.vps.last_seen || r.created_at || Date.now()).getTime()) / 60000);
    document.getElementById('lastUpdatedBadge').textContent = minutes < 1 ? 'Updated just now' : minutes < 60 ? `Updated ${minutes}m ago` : `Updated ${Math.floor(minutes/60)}h ago`;

    document.getElementById('totalCost').textContent = formatCurrency(r.total_cost, currency);
    const totalContainerCost = (r.containers || []).reduce((sum, c) => sum + (c.total_cost || 0), 0);
    document.getElementById('containerCount').textContent = formatCurrency(totalContainerCost, currency);
    const containerCount = (r.containers || []).length;
    document.getElementById('containerSub').textContent = containerCount + ' containers';
    document.getElementById('overheadCost').textContent = formatCurrency(r.overhead_cost, currency);
    document.getElementById('unallocCost').textContent = formatCurrency(r.unallocated_cost, currency);

    // Keep "per month" as card subtitle
    document.getElementById('totalPeriod').textContent = 'per month';

    // Table
    const tbody = document.getElementById('containerTableBody');
    const containers = r.containers || [];

    if (containers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No containers running</td></tr>';
        document.getElementById('tableCount').textContent = '0 containers';
    } else {
        const vpsName = r.vps?.name || 'VPS';
        tbody.innerHTML = containers.map(c => {
            const status = c.container.status || 'running';
            const statusPill = status === 'running' ? 'pill-green' : status === 'paused' ? 'pill-yellow' : 'pill-red';
            return `
            <tr>
                <td><div class="cell-name"><div class="dot ${status === 'running' ? 'run' : status === 'paused' ? 'pause' : 'stop'}"></div><a href="#" class="container-name" data-name="${c.container.name}">${c.container.name}</a></div></td>
                <td><span class="text-muted">${vpsName}</span></td>
                <td>${formatPercent(c.container.cpu_percent)}</td>
                <td>${formatBytes(c.container.mem_usage_mb)}</td>
                <td><span class="pill ${statusPill}">${status}</span></td>
                <td class="cost-val">${formatCurrency(c.total_cost, currency)}</td>
            </tr>
        `}).join('');
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

// ─── Cost Distribution Chart (Horizontal Bar, scrollable) ───
function renderCostChart(containers, currency) {
    const ctx = document.getElementById('costChart').getContext('2d');
    if (state.charts.cost) { state.charts.cost.destroy(); }

    // Sort by cost descending
    const sorted = [...containers].sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));

    // Show top 15, group rest into "Others"
    const MAX_SHOWN = 15;
    const shown = sorted.slice(0, MAX_SHOWN);
    const rest = sorted.slice(MAX_SHOWN);
    const othersCost = rest.reduce((s, c) => s + (c.total_cost || 0), 0);

    // Horizontal bar: container names as y-axis labels (no truncation needed)
    const labels = shown.map(c => c.container.name);
    const data = shown.map(c => c.total_cost || 0);
    const colors = generateColors(shown.length);

    // Append "Others" if there are hidden containers
    if (rest.length > 0) {
        labels.push(`+ Others (${rest.length} containers)`);
        data.push(othersCost);
        colors.push('#6a6b6c');
    }

    const barCount = labels.length;
    // 36px per bar for horizontal layout, 180px min, 540px max
    const chartH = Math.max(180, Math.min(540, barCount * 36));
    const containerEl = document.getElementById('costChartContainer');
    if (containerEl) {
        containerEl.style.height = chartH + 'px';
        // Enable scroll when bar count exceeds ~12
        containerEl.style.overflowY = barCount > 12 ? 'auto' : 'hidden';
    }

    // Update header with count info — mockup style

    state.charts.cost = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#242728' },
                    ticks: {
                        color: '#cdcdcd',
                        callback: (v) => formatCurrency(v, currency),
                        font: { size: 10 },
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: '#6a6b6c',
                        font: { size: 11 },
                        // Truncate long names in y-axis labels
                        callback: (val) => {
                            const label = labels[val] || '';
                            return label.length > 24 ? label.substring(0, 22) + '…' : label;
                        },
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed.x, currency)}`
                    }
                }
            }
        }
    });
}

// Truncate long container names for chart labels
function truncateLabel(name, maxLen) {
    if (!name) return '';
    return name.length > maxLen ? name.substring(0, maxLen - 1) + '…' : name;
}

// ─── Cost Breakdown Chart (Doughnut) ────────────────────────
function renderBreakdownChart(report, currency) {
    const ctx = document.getElementById('breakdownChart').getContext('2d');
    if (state.charts.breakdown) { state.charts.breakdown.destroy(); }

    const containerCost = (report.containers || []).reduce((s, c) => s + (c.total_cost || 0), 0);
    const overheadCost = report.overhead_cost || 0;
    const unallocCost = report.unallocated_cost || 0;
    const total = containerCost + overheadCost + unallocCost;

    const labels = ['Container Cost', 'Overhead', 'Unallocated'];
    const data = [containerCost, overheadCost, unallocCost];
    const bgColors = ['rgba(87,193,255,0.85)', 'rgba(255,197,51,0.85)', 'rgba(255,97,97,0.85)'];
    const borderColors = ['#57c1ff', '#ffc533', '#ff6161'];

    state.charts.breakdown = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverBorderColor: '#f4f4f6',
                hoverBorderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed;
                            const pct = total > 0 ? (val / total * 100).toFixed(1) : '0';
                            return `${ctx.label}: ${formatCurrency(val, currency)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // ── Custom HTML legend (matches mockup v3 .donut-legend) ──
    const legendEl = document.getElementById('breakdownLegend');
    const totalEl = document.getElementById('donutTotal');
    if (totalEl) totalEl.textContent = formatCurrency(total, currency);
    if (legendEl) {
        legendEl.innerHTML = labels.map((label, i) => {
            const pct = total > 0 ? (data[i] / total * 100).toFixed(1) : '0';
            return `
                <div class="legend-item">
                    <div class="legend-sq" style="background:${borderColors[i]}"></div>
                    <span class="legend-lbl">${label}</span>
                    <span class="legend-val">${formatCurrency(data[i], currency)}</span>
                    <span class="legend-pct">${pct}%</span>
                </div>`;
        }).join('');
    }
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
        document.getElementById('containerListCount').textContent = '';
        return;
    }

    const currency = state.report?.vps?.currency || 'IDR';

    // Get filter/sort
    const searchTerm = (document.getElementById('containerSearch').value || '').toLowerCase();
    const sortBy = document.getElementById('containerSort').value;

    // Filter by name or image
    let filtered = containers.filter(c =>
        c.container.name.toLowerCase().includes(searchTerm) ||
        (c.container.image || '').toLowerCase().includes(searchTerm)
    );

    // Sort
    filtered.sort((a, b) => {
        if (sortBy === 'name') return a.container.name.localeCompare(b.container.name);
        if (sortBy === 'cpu') return (b.container.cpu_percent || 0) - (a.container.cpu_percent || 0);
        return (b.total_cost || 0) - (a.total_cost || 0); // cost descending default
    });

    document.getElementById('containerListCount').textContent = filtered.length + ' containers';

    const maxCost = Math.max(...filtered.map(c => c.total_cost || 0), 1);

    containerList.innerHTML = filtered.map((c, i) => {
        const rank = i + 1;
        const status = c.container.status || 'running';
        const uptime = c.container.uptime || '';
        const image = c.container.image || '-';
        const shortImg = image.length > 32 ? image.substring(0, 30) + '…' : image;
        const cpu = c.container.cpu_percent || 0;
        const memMb = c.container.mem_usage_mb || 0;
        const memLimit = c.container.mem_limit_mb || 0;
        const memPct = memLimit > 0 ? Math.min((memMb / memLimit) * 100, 100) : 0;
        const costVal = c.total_cost || 0;
        const costPct = maxCost > 0 ? Math.min((costVal / maxCost) * 100, 100) : 0;

        return `
        <div class="container-card" data-name="${c.container.name}">
            <div class="card-top-row">
                <span class="card-rank-badge">#${rank}</span>
                <span class="container-card-name">${c.container.name}</span>
                <span class="container-card-status ${status !== 'running' ? 'stopped' : ''}">${status}</span>
            </div>
            <div class="card-meta-row">
                <svg class="icon-sm"><use href="#icon-image"/></svg>
                ${shortImg}
                ${uptime ? `<span class="meta-sep">·</span><svg class="icon-sm"><use href="#icon-clock"/></svg>${uptime}` : ''}
            </div>
            <div class="card-chips">
                <div class="chip chip-cpu">
                    <div class="chip-header">
                        <svg class="icon-sm"><use href="#icon-cpu"/></svg>
                        CPU
                    </div>
                    <div class="chip-value">${formatPercent(cpu)}</div>
                    <div class="chip-bar"><div class="chip-bar-fill cpu" style="width:${Math.min(cpu, 100)}%"></div></div>
                </div>
                <div class="chip chip-mem">
                    <div class="chip-header">
                        <svg class="icon-sm"><use href="#icon-database"/></svg>
                        MEM
                    </div>
                    <div class="chip-value">${formatBytes(memMb)}${memLimit ? '' : ''}</div>
                    <div class="chip-bar"><div class="chip-bar-fill mem" style="width:${memPct}%"></div></div>
                </div>
                <div class="chip chip-cost">
                    <div class="chip-header">
                        <svg class="icon-sm"><use href="#icon-dollar"/></svg>
                        Cost
                    </div>
                    <div class="chip-value">${formatCurrency(costVal, currency)}</div>
                    <div class="chip-bar"><div class="chip-bar-fill cost" style="width:${costPct}%"></div></div>
                </div>
            </div>
        </div>`;
    }).join('');

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

    // Get container from report for quick info + prev/next
    const containers = state.report?.containers || [];
    const currentIdx = containers.findIndex(c => c.container.name === name);
    const container = containers[currentIdx];
    const currency = state.report?.vps?.currency || 'IDR';

    // ── Prev/Next navigation ──
    const prevBtn = document.getElementById('btnPrevContainer');
    const nextBtn = document.getElementById('btnNextContainer');
    prevBtn.disabled = currentIdx <= 0;
    nextBtn.disabled = currentIdx >= containers.length - 1;
    prevBtn.onclick = () => showContainerDetail(containers[currentIdx - 1].container.name);
    nextBtn.onclick = () => showContainerDetail(containers[currentIdx + 1].container.name);

    // ── Header ──
    document.getElementById('containerDetailName').textContent = name;
    if (container) {
        const st = container.container.status || 'running';
        const img = container.container.image || '-';
        const uptime = container.container.uptime || '';
        document.getElementById('detailHeaderMeta').innerHTML = `
            <span class="detail-status-badge ${st === 'running' ? 'running' : 'stopped'}">${st}</span>
            <span><svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> ${img}</span>
            ${uptime ? `<span><svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Uptime: ${uptime}</span>` : ''}`;
    }

    // ── Info grid ──
    if (container) {
        document.getElementById('detailInfo').innerHTML = `
            <div class="info-item">
                <span class="info-label">CPU Usage</span>
                <span class="info-value">${formatPercent(container.container.cpu_percent)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Memory</span>
                <span class="info-value">${formatBytes(container.container.mem_usage_mb)} / ${formatBytes(container.container.mem_limit_mb)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Memory %</span>
                <span class="info-value">${formatPercent(container.container.mem_percent)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Image</span>
                <span class="info-value" style="font-size:12px;">${container.container.image || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Container ID</span>
                <span class="info-value" style="font-size:11px;font-family:monospace;">${(container.container.id || '').substring(0, 12)}</span>
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
                <span class="info-value" style="color:var(--accent-blue);font-weight:600;">${formatCurrency(container.total_cost, currency)}</span>
            </div>`;
    }

    // ── Stats row (will fill after fetch) ──
    document.getElementById('detailStatsRow').innerHTML = `
        <div class="detail-stat-card">
            <div class="detail-stat-value">-</div>
            <div class="detail-stat-label">Snapshots</div>
        </div>
        <div class="detail-stat-card">
            <div class="detail-stat-value">-</div>
            <div class="detail-stat-label">Avg Cost</div>
        </div>
        <div class="detail-stat-card">
            <div class="detail-stat-value">-</div>
            <div class="detail-stat-label">Max Cost</div>
        </div>
        <div class="detail-stat-card">
            <div class="detail-stat-value">-</div>
            <div class="detail-stat-label">Current</div>
        </div>`;

    // ── Destroy old charts ──
    if (state.charts.history) { state.charts.history.destroy(); state.charts.history = null; }
    if (state.charts.cpuTrend) { state.charts.cpuTrend.destroy(); state.charts.cpuTrend = null; }
    if (state.charts.memTrend) { state.charts.memTrend.destroy(); state.charts.memTrend = null; }
    if (state.charts.breakdownDonut) { state.charts.breakdownDonut.destroy(); state.charts.breakdownDonut = null; }

    // ── Loading state ──
    document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="4" class="empty-state">Loading history...</td></tr>';

    // ── Fetch history ──
    try {
        const history = await API.get(`/containers/${encodeURIComponent(name)}`);

        if (history && history.length > 0) {
            // Fill stats
            const total = history.reduce((s, h) => s + (h.total_cost || 0), 0);
            const avg = total / history.length;
            const max = Math.max(...history.map(h => h.total_cost || 0));
            const statsEls = document.querySelectorAll('#detailStatsRow .detail-stat-card');
            if (statsEls[0]) statsEls[0].querySelector('.detail-stat-value').textContent = history.length;
            if (statsEls[1]) statsEls[1].querySelector('.detail-stat-value').textContent = formatCurrency(avg, currency);
            if (statsEls[2]) statsEls[2].querySelector('.detail-stat-value').textContent = formatCurrency(max, currency);
            if (statsEls[3]) statsEls[3].querySelector('.detail-stat-value').textContent = formatCurrency(history[0].total_cost || 0, currency);

            // Small delay for DOM settle
            await new Promise(r => setTimeout(r, 60));

            renderHistoryChart(history, currency);
            renderCpuTrendChart(history, currency);
            renderMemTrendChart(history, currency);
            renderBreakdownDonut(container, currency);
            renderHistoryTable(history, currency);
        } else {
            document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="4" class="empty-state">Collecting more data points — generate reports to build history</td></tr>';
        }
    } catch (err) {
        document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="4" class="empty-state">' + (err.message || 'Failed to load history') + '</td></tr>';
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
        canvas.height = parent.clientHeight || 180;
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
                    borderColor: '#57c1ff',
                    backgroundColor: 'rgba(87,193,255,0.1)',
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
                        grid: { color: '#242728' },
                        ticks: {
                            color: '#cdcdcd',
                            callback: (v) => formatCurrency(v, currency),
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#cdcdcd', maxTicksLimit: 8, font: { size: 9 } }
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
        // Chart render failed — silently skip
    }
}

// ─── CPU Trend Chart ───────────────────────────────────────
function renderCpuTrendChart(history, currency) {
    const canvas = document.getElementById('cpuTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.charts.cpuTrend) { state.charts.cpuTrend.destroy(); }

    if (!history || history.length === 0) return;

    const parent = canvas.parentElement;
    if (parent) { canvas.width = parent.clientWidth || 280; canvas.height = parent.clientHeight || 180; }

    const reversed = [...history].reverse();
    const labels = reversed.map(h => {
        if (!h.timestamp) return '-';
        try { const d = new Date(h.timestamp); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
        catch { return '-'; }
    });
    const data = reversed.map(h => h.cpu_percent || 0);

    try {
        state.charts.cpuTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'CPU %',
                    data,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167,139,250,0.08)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 300 },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#242728' }, ticks: { color: '#cdcdcd', callback: v => v + '%', font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: '#cdcdcd', maxTicksLimit: 6, font: { size: 9 } } }
                },
                plugins: {
                    legend: { labels: { color: '#f4f4f6', font: { size: 10 }, padding: 8 } },
                    tooltip: { callbacks: { label: ctx => 'CPU: ' + ctx.parsed.y.toFixed(1) + '%' } }
                }
            }
        });
    } catch {}
}

// ─── Memory Trend Chart ────────────────────────────────────
function renderMemTrendChart(history, currency) {
    const canvas = document.getElementById('memTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.charts.memTrend) { state.charts.memTrend.destroy(); }

    if (!history || history.length === 0) return;

    const parent = canvas.parentElement;
    if (parent) { canvas.width = parent.clientWidth || 280; canvas.height = parent.clientHeight || 180; }

    const reversed = [...history].reverse();
    const labels = reversed.map(h => {
        if (!h.timestamp) return '-';
        try { const d = new Date(h.timestamp); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }
        catch { return '-'; }
    });
    const data = reversed.map(h => h.mem_usage_mb || 0);

    try {
        state.charts.memTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Memory (MB)',
                    data,
                    borderColor: '#59d499',
                    backgroundColor: 'rgba(89,212,153,0.08)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 300 },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#242728' }, ticks: { color: '#cdcdcd', callback: v => v + ' MB', font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: '#cdcdcd', maxTicksLimit: 6, font: { size: 9 } } }
                },
                plugins: {
                    legend: { labels: { color: '#f4f4f6', font: { size: 10 }, padding: 8 } },
                    tooltip: { callbacks: { label: ctx => 'Memory: ' + ctx.parsed.y.toFixed(0) + ' MB' } }
                }
            }
        });
    } catch {}
}

// ─── Cost Breakdown Donut (Detail) ─────────────────────────
function renderBreakdownDonut(container, currency) {
    const canvas = document.getElementById('breakdownDonut');
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (state.charts.breakdownDonut) { state.charts.breakdownDonut.destroy(); }

    const cpuCost = container.cpu_cost || 0;
    const ramCost = container.ram_cost || 0;
    const storageCost = container.storage_cost || 0;
    const total = cpuCost + ramCost + storageCost;

    if (total === 0) {
        document.getElementById('breakdownLegendDetail').innerHTML = '<div style="color:var(--ash);font-size:12px;">No cost data</div>';
        return;
    }

    try {
        state.charts.breakdownDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['CPU', 'RAM', 'Storage'],
                datasets: [{
                    data: [cpuCost, ramCost, storageCost],
                    backgroundColor: ['rgba(167,139,250,0.85)', 'rgba(87,193,255,0.85)', 'rgba(255,197,51,0.85)'],
                    borderColor: ['#a78bfa', '#57c1ff', '#ffc533'],
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const pct = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : '0';
                                return `${ctx.label}: ${formatCurrency(ctx.parsed, currency)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch {}

    // Custom legend
    const legendEl = document.getElementById('breakdownLegendDetail');
    if (legendEl) {
        const colors = ['#a78bfa', '#57c1ff', '#ffc533'];
        const labels = ['CPU Cost', 'RAM Cost', 'Storage Cost'];
        const data = [cpuCost, ramCost, storageCost];
        legendEl.innerHTML = labels.map((l, i) => {
            const pct = total > 0 ? (data[i] / total * 100).toFixed(1) : '0';
            return `<div class="breakdown-item">
                <span class="breakdown-dot" style="background:${colors[i]}"></span>
                <span class="breakdown-lbl">${l}</span>
                <span class="breakdown-val">${formatCurrency(data[i], currency)}</span>
                <span class="breakdown-pct">${pct}%</span>
            </div>`;
        }).join('');
    }
}

// ─── History Table ──────────────────────────────────────
function renderHistoryTable(history, currency) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No history data</td></tr>';
        return;
    }

    tbody.innerHTML = history.slice(0, 20).map(h => {
        const ts = h.timestamp ? (() => {
            try {
                const d = new Date(h.timestamp);
                return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
            } catch { return h.timestamp.substring(0, 16); }
        })() : '-';
        return `<tr>
            <td style="font-size:12px;color:var(--mute);">${ts}</td>
            <td>${formatPercent(h.cpu_percent)}</td>
            <td>${formatBytes(h.mem_usage_mb)}</td>
            <td class="cost-val">${formatCurrency(h.total_cost, currency)}</td>
        </tr>`;
    }).join('');
}

// ─── Config ────────────────────────────────────────────────
async function loadConfig() {
    try {
        state.config = await API.get('/config');
        populateForm(state.config);
    } catch (err) {
        showConfigStatus('Failed to load config: ' + err.message, 'error');
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
        showConfigStatus('Config saved! Refresh report to apply changes.', 'success');
        setTimeout(() => document.getElementById('configStatus').style.display = 'none', 5000);
    } catch (err) {
        showConfigStatus(err.message, 'error');
    }
});

function showConfigStatus(msg, type) {
    const el = document.getElementById('configStatus');
    const icon = type === 'success' ? '<svg class="icon-sm" style="color:var(--accent-green);vertical-align:middle;margin-right:4px;"><use href="#icon-check"/></svg>' : '<svg class="icon-sm" style="color:var(--accent-red);vertical-align:middle;margin-right:4px;"><use href="#icon-x"/></svg>';
    el.innerHTML = icon + msg;
    el.className = 'config-status ' + type;
    el.style.display = 'block';
}

// ─── Color Generator ───────────────────────────────────────
function generateColors(n) {
    const palette = [
        '#57c1ff', '#a78bfa', '#fb923c', '#2dd4bf', '#59d499',
        '#ff6161', '#ffc533', '#f472b6', '#818cf8', '#34d399',
        '#fbbf24', '#c084fc', '#38bdf8', '#4ade80', '#facc15',
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

    // ─── Container list search/sort ───
    const searchInput = document.getElementById('containerSearch');
    const sortSelect = document.getElementById('containerSort');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (state.currentPage === 'containers') renderContainerList();
        });
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            if (state.currentPage === 'containers') renderContainerList();
        });
    }
});

// ─── User Management ──────────────────────────────────────
async function loadUsers() {
    try {
        const users = await API.get('/users');
        renderUsersTable(users);
    } catch (err) {
        document.getElementById('usersTableBody').innerHTML =
            `<tr><td colspan="6" class="empty-state">${err.message}</td></tr>`;
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
                <button class="btn-role-edit" onclick="openRoleModal(${u.id}, '${u.username}', '${u.role}')" title="Edit role"><svg class="icon-sm"><use href="#icon-edit"/></svg></button>
                <button class="btn-user-reset" onclick="openResetPasswordModal(${u.id}, '${u.username}')" title="Reset password"><svg class="icon-sm"><use href="#icon-key"/></svg></button>
                <button class="btn-user-delete" onclick="deleteUser(${u.id}, '${u.username}')" title="Delete user"><svg class="icon-sm"><use href="#icon-trash"/></svg></button>
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
        errEl.textContent = err.message;
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
        errEl.textContent = 'Password must be at least 4 characters';
        errEl.style.display = 'block';
        return;
    }
    if (newPass !== confirm) {
        errEl.textContent = 'Passwords do not match';
        errEl.style.display = 'block';
        return;
    }

    try {
        await API.postWithBody(`/users/${resetPwdUserId}/reset-password`, { password: newPass });
        document.getElementById('resetPwdModal').style.display = 'none';
        resetPwdUserId = null;
        loadUsers();
    } catch (err) {
        errEl.textContent = err.message;
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
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
});

// ─── Permissions Page (static) ──────────────────────────
function renderPermissions() {
    // Content is already in HTML — no dynamic data needed
}

// ─── VPS Management ─────────────────────────────────────
let currentVPSId = null;
let vpsList = [];

async function loadVPSList() {
    document.getElementById('vpsDetail').style.display = 'none';
    try {
        vpsList = await API.get('/vps');
        renderVPSTable(vpsList);
    } catch (err) {
        document.getElementById('vpsTableBody').innerHTML =
            `<tr><td colspan="6" class="empty-state">Failed to load VPS: ${err.message}</td></tr>`;
    }
}

function renderVPSTable(vpsList) {
    const tbody = document.getElementById('vpsTableBody');
    const statsBar = document.getElementById('vpsStatsBar');

    if (!vpsList || vpsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No VPS registered yet. Click "Add VPS" to add one.</td></tr>';
        statsBar.style.display = 'none';
        return;
    }

    // Update metric chips
    statsBar.style.display = 'grid';
    document.getElementById('vpsTotalCount').textContent = vpsList.length;
    const online = vpsList.filter(v => v.status === 'online').length;
    document.getElementById('vpsOnlineCount').textContent = online;
    const totalCost = vpsList.reduce((sum, v) => sum + (v.price_per_month || 0), 0);
    document.getElementById('vpsTotalCost').textContent = formatCurrency(totalCost, 'IDR');

    const colors = ['blue', 'green', 'yellow', 'purple', 'blue', 'green'];
    tbody.innerHTML = vpsList.map((v, i) => `
        <tr>
            <td>
                <div class="vps-name-cell">
                    <div class="vps-name-dot ${colors[i % colors.length]}"></div>
                    <a href="#" class="container-name vps-row-link" data-id="${v.id}">${v.name}</a>
                </div>
            </td>
            <td><span class="vps-spec-tag">${v.cpu_cores || '?'} CPU · ${v.ram_gb || '?'} GB</span></td>
            <td style="font-weight:600;">${formatCurrency(v.price_per_month, v.currency || 'IDR')}</td>
            <td><span class="vps-status-badge ${v.status}"><svg class="icon-sm"><use href="#icon-${v.status === 'online' ? 'zap' : 'eye-off'}"/></svg> ${v.status === 'online' ? 'Live' : 'Off'}</span></td>
            <td style="color:var(--ash);font-size:13px;">${v.last_seen ? formatTime(v.last_seen) : 'Never'}</td>
            <td>
                <div class="vps-table-actions">
                    <button class="btn-secondary btn-sm" onclick="viewVPS(${v.id})" title="View details"><svg class="icon-sm"><use href="#icon-eye"/></svg></button>
                    <button class="btn-secondary btn-sm" onclick="deleteVPS(${v.id})" title="Remove VPS" style="color:var(--accent-red);"><svg class="icon-sm"><use href="#icon-trash"/></svg></button>
                </div>
            </td>
        </tr>
    `).join('');

    // Click row to view
    tbody.querySelectorAll('.vps-row-link').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            viewVPS(parseInt(el.dataset.id));
        });
    });
}

async function viewVPS(id) {
    currentVPSId = id;
    document.getElementById('vpsDetail').style.display = 'block';
    const content = document.getElementById('vpsDetailContent');

    try {
        const data = await API.get(`/vps/${id}`);
        const v = data.vps;
        const report = data.report;
        const currency = v.currency || 'IDR';

        content.innerHTML = `
            <div class="vps-detail-header">
                <div>
                    <div class="vps-detail-title">
                        <svg class="icon-lg"><use href="#icon-server"/></svg>
                        <h2>${v.name}</h2>
                        <span class="vps-status-badge ${v.status}"><svg class="icon-sm"><use href="#icon-${v.status === 'online' ? 'zap' : 'eye-off'}"/></svg> ${v.status === 'online' ? 'Live' : 'Off'}</span>
                    </div>
                    <div class="vps-detail-meta">
                        <svg class="icon-sm"><use href="#icon-clock"/></svg>
                        Last seen: ${v.last_seen ? formatTime(v.last_seen) : 'Never'}
                    </div>
                </div>
                <div class="vps-detail-actions">
                    <button class="btn-secondary btn-sm" onclick="deleteVPS(${v.id})" style="color:var(--accent-red);"><svg class="icon-sm"><use href="#icon-trash"/></svg> Delete</button>
                </div>
            </div>

            <div class="vps-detail-layout">
                <div class="vps-info-card">
                    <h4>Spesifikasi</h4>
                    <div class="vps-info-grid">
                        <div class="vps-info-item">
                            <span class="info-label">CPU Cores</span>
                            <span class="info-value">${v.cpu_cores || '-'}</span>
                        </div>
                        <div class="vps-info-item">
                            <span class="info-label">RAM</span>
                            <span class="info-value">${v.ram_gb || '-'} GB</span>
                        </div>
                        <div class="vps-info-item">
                            <span class="info-label">Harga</span>
                            <span class="info-value">${formatCurrency(v.price_per_month, currency)}</span>
                        </div>
                    </div>
                </div>

                <div class="vps-key-card">
                    <h4><svg class="icon-sm"><use href="#icon-key"/></svg> API Key</h4>
                    <div class="vps-key-display">
                        <code>${v.api_key || '********'}</code>
                        <button class="btn-secondary btn-sm" onclick="copyVPSKey('${v.id}')"><svg class="icon-sm"><use href="#icon-copy"/></svg> Copy</button>
                    </div>
                    <button class="btn-secondary btn-sm" style="align-self:flex-start;" onclick="regenerateKey(${v.id})"><svg class="icon-sm"><use href="#icon-refresh-cw"/></svg> Regenerate Key</button>
                </div>
            </div>

            <div class="vps-setup-card">
                <h4><svg class="icon-sm"><use href="#icon-terminal"/></svg> Setup Agent</h4>
                <p>SSH ke VPS ini, lalu jalankan perintah berikut:</p>
                <div class="vps-setup-code">
                    <code>docker-cost --mode=agent --server=http://CENTRAL_IP:8080 --api-key=${v.api_key || 'YOUR_KEY'}</code>
                    <button class="btn-secondary btn-sm" onclick="copySetupCmd()"><svg class="icon-sm"><use href="#icon-copy"/></svg> Copy</button>
                </div>
            </div>

            ${report ? `
            <div class="vps-report-card">
                <h4><svg class="icon-sm"><use href="#icon-bar-chart-3"/></svg> Latest Cost Report</h4>
                <div class="vps-report-grid">
                    <div class="vps-report-item">
                        <div class="report-label">Containers</div>
                        <div class="report-value">${(report.containers || []).length}</div>
                    </div>
                    <div class="vps-report-item">
                        <div class="report-label">Total Cost</div>
                        <div class="report-value blue">${formatCurrency(report.total_cost, currency)}</div>
                    </div>
                    <div class="vps-report-item">
                        <div class="report-label">Overhead</div>
                        <div class="report-value yellow">${formatCurrency(report.overhead_cost, currency)}</div>
                    </div>
                </div>
            </div>` : ''}
        `;
    } catch (err) {
        content.innerHTML = `<div class="empty-state">Failed to load VPS detail: ${err.message}</div>`;
    }
}

function copyVPSKey(id) {
    const codeEl = document.querySelector('.vps-key-display code');
    const key = codeEl.textContent;
    if (key && key !== '********') {
        navigator.clipboard.writeText(key).then(() => {
            showCopyFeedback('.vps-key-display .btn-sm');
        }).catch(() => fallbackCopy(key));
    }
}

function showCopyFeedback(selector) {
    const btn = document.querySelector(selector);
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg class="icon-sm"><use href="#icon-check"/></svg> Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
}

function copySetupCmd() {
    const codeEl = document.querySelector('.vps-setup-code code');
    const cmd = codeEl.textContent;
    navigator.clipboard.writeText(cmd).then(() => {
        showCopyFeedback('.vps-setup-code .btn-sm');
    }).catch(() => fallbackCopy(cmd));
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showCopyFeedback('.vps-key-display .btn-sm, .vps-setup-code .btn-sm');
}

document.getElementById('btnBackToVPSList').addEventListener('click', () => {
    document.getElementById('vpsDetail').style.display = 'none';
    currentVPSId = null;
    loadVPSList();
});

async function deleteVPS(id) {
    if (!confirm('Are you sure you want to remove this VPS? All its data will be deleted.')) return;
    try {
        await API.del(`/vps/${id}`);
        if (currentVPSId === id) {
            document.getElementById('vpsDetail').style.display = 'none';
            currentVPSId = null;
        }
        loadVPSList();
    } catch (err) {
        alert('Failed to delete VPS: ' + err.message);
    }
}

async function regenerateKey(id) {
    if (!confirm('Regenerate API key? The old key will stop working immediately.')) return;
    try {
        const data = await API.post(`/vps/${id}/reset-key`);
        showConfigStatus('New API key generated! Copy it now: ' + data.api_key, 'success');
        viewVPS(id); // Refresh view
    } catch (err) {
        alert('Failed to regenerate key: ' + err.message);
    }
}

// ─── Add VPS Modal ────────────────────────────────────
document.getElementById('btnAddVPS').addEventListener('click', openAddVPSModal);

// Topbar "Add VPS" button — same handler
const btnAddVPSFromTopbar = document.getElementById('btnAddVPSFromTopbar');
if (btnAddVPSFromTopbar) {
    btnAddVPSFromTopbar.addEventListener('click', openAddVPSModal);
}

function openAddVPSModal() {
    document.getElementById('vpsForm').reset();
    document.getElementById('vpsKeyGroup').style.display = 'none';
    document.getElementById('vpsFormError').style.display = 'none';
    document.getElementById('vpsSaveBtn').innerHTML = '<svg class="icon-sm"><use href="#icon-save"/></svg> Save & Generate Key';
    document.getElementById('vpsModal').style.display = 'flex';
}

document.getElementById('btnCancelVPS').addEventListener('click', () => {
    document.getElementById('vpsModal').style.display = 'none';
    document.getElementById('vpsSaveBtn').innerHTML = '<svg class="icon-sm"><use href="#icon-save"/></svg> Save & Generate Key';
    document.getElementById('vpsSaveBtn').onclick = null;
    document.getElementById('btnCancelVPS').textContent = 'Cancel';
    document.getElementById('vpsNameInput').disabled = false;
    document.getElementById('vpsNotesInput').disabled = false;
});

document.getElementById('vpsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('vpsNameInput').value;
    const notes = document.getElementById('vpsNotesInput').value;
    const errEl = document.getElementById('vpsFormError');

    try {
        const result = await API.postWithBody('/vps', { name, notes });
        // Show the generated API key — modal stays open until user closes
        document.getElementById('vpsKeyGroup').style.display = 'block';
        document.getElementById('vpsApiKey').textContent = result.api_key;
        document.getElementById('vpsSaveBtn').innerHTML = '<svg class="icon-sm"><use href="#icon-copy"/></svg> Copied? Click to copy again';
        document.getElementById('vpsSaveBtn').onclick = () => copyKey();
        document.getElementById('vpsNameInput').disabled = true;
        document.getElementById('vpsNotesInput').disabled = true;
        document.getElementById('btnCancelVPS').textContent = '✓ Close';
        // Refresh VPS list in background
        loadVPSList();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
});

function copyKey() {
    const key = document.getElementById('vpsApiKey').textContent;
    navigator.clipboard.writeText(key).then(() => {
        showCopyFeedback('#vpsSaveBtn');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = key;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopyFeedback('#vpsSaveBtn');
    });
}


