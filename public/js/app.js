// ─── Chart defaults for dark theme ───────────────────────────────────────────
Chart.defaults.color = 'rgba(255,255,255,0.5)';
Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── State ───────────────────────────────────────────────────────────────────
let token = localStorage.getItem('token');
let currentUser = null;
let charts = {};
let socket = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (token) initApp();
  else showAuth();
});

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function initApp() {
  try {
    const res = await api('GET', '/api/auth/me');
    currentUser = res.user;
    document.getElementById('user-name-sidebar').textContent = currentUser.name;
    document.getElementById('set-maxwatts').value = currentUser.alertThresholds?.maxWatts || 3000;
    document.getElementById('set-minbattery').value = currentUser.alertThresholds?.minBattery || 20;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initSocket();
    loadDashboard();
    loadAlertBadge();
  } catch {
    logout();
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('auth-error').classList.add('hidden');
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const res = await api('POST', '/api/auth/login', { email, password }, false);
    token = res.token;
    localStorage.setItem('token', token);
    initApp();
  } catch (e) {
    showAuthError(e.message || 'Login failed');
  }
}

async function register() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  try {
    const res = await api('POST', '/api/auth/register', { name, email, password }, false);
    token = res.token;
    localStorage.setItem('token', token);
    initApp();
  } catch (e) {
    showAuthError(e.message || 'Registration failed');
  }
}

function logout() {
  token = null;
  localStorage.removeItem('token');
  if (socket) socket.disconnect();
  showAuth();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── API helper ───────────────────────────────────────────────────────────────
async function api(method, url, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
function initSocket() {
  socket = io();

  socket.on('live-reading', (data) => {
    document.getElementById('stat-watts').textContent = Math.round(data.watts) + ' W';
    document.getElementById('stat-source').textContent = 'Source: ' + data.source;
    const bat = Math.round(data.batteryLevel || 0);
    document.getElementById('stat-battery').textContent = bat + ' %';
    document.getElementById('battery-fill').style.width = bat + '%';
    document.getElementById('battery-fill').style.background = bat < 20 ? '#dc2626' : bat < 50 ? '#d97706' : '#1D9E75';
  });

  socket.on('new-alert', (alert) => {
    loadAlertBadge();
    // Re-render recent alerts if on dashboard
    if (document.getElementById('page-dashboard').classList.contains('active')) loadRecentAlerts();
  });

  socket.on('new-reading', () => {
    if (document.getElementById('page-dashboard').classList.contains('active')) loadDashboard();
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  page.classList.remove('hidden');
  page.classList.add('active');
  if (el) el.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'analytics') loadAnalytics();
  if (name === 'devices') loadDevices();
  if (name === 'alerts') loadAlerts();
  if (name === 'profile') loadProfile();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [summaryData, readingsData, sourcesData] = await Promise.all([
      api('GET', '/api/analytics/summary'),
      api('GET', '/api/readings?limit=48'),
      api('GET', '/api/analytics/sources')
    ]);

    const { today, latest } = summaryData;

    if (latest) {
      document.getElementById('stat-watts').textContent = Math.round(latest.watts) + ' W';
      document.getElementById('stat-source').textContent = 'Source: ' + latest.source;
      const bat = Math.round(latest.batteryLevel || 0);
      document.getElementById('stat-battery').textContent = bat + ' %';
      document.getElementById('battery-fill').style.width = bat + '%';
      document.getElementById('stat-solar').textContent = Math.round(latest.solarGeneration || 0) + ' W';
    }

    document.getElementById('stat-avg').textContent = Math.round(today.avg || 0) + ' W';

    // Usage chart
    const readings = readingsData.readings.slice().reverse();
    const labels = readings.map(r => {
      const d = new Date(r.timestamp);
      return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    });
    const watts = readings.map(r => Math.round(r.watts));
    const solar = readings.map(r => Math.round(r.solarGeneration || 0));

    drawLineChart('chart-usage', labels,
      [{ label: 'Usage (W)', data: watts, borderColor: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
       { label: 'Solar (W)', data: solar, borderColor: '#fbbf24', bg: 'rgba(251,191,36,0.1)' }]
    );

    // Source donut
    const srcLabels = sourcesData.data.map(d => d._id);
    const srcVals = sourcesData.data.map(d => Math.round(d.totalWatts));
    const srcColors = srcLabels.map(s => s === 'solar' ? '#fbbf24' : s === 'battery' ? '#c084fc' : '#60a5fa');
    drawDoughnut('chart-source', srcLabels, srcVals, srcColors);

    loadRecentAlerts();
  } catch (e) { console.error('Dashboard error:', e); }
}

async function loadRecentAlerts() {
  const data = await api('GET', '/api/alerts');
  const recent = data.alerts.slice(0, 5);
  const el = document.getElementById('recent-alerts-list');
  if (!recent.length) { el.innerHTML = '<p class="empty-state">No recent alerts</p>'; return; }
  el.innerHTML = recent.map(a => alertHTML(a)).join('');
}

// ─── Analytics ────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  try {
    const [dailyData, peakData, predData] = await Promise.all([
      api('GET', '/api/analytics/daily'),
      api('GET', '/api/analytics/peak'),
      api('GET', '/api/analytics/prediction')
    ]);

    // Daily chart
    const dLabels = dailyData.data.map(d => `${d._id.month}/${d._id.day}`);
    const dVals = dailyData.data.map(d => Math.round(d.avgWatts));
    drawLineChart('chart-daily', dLabels,
      [{ label: 'Avg watts/day', data: dVals, borderColor: '#a78bfa', bg: 'rgba(167,139,250,0.12)' }]
    );

    // Peak hours chart
    const pLabels = peakData.data.map(d => d._id.hour + ':00');
    const pVals = peakData.data.map(d => Math.round(d.avgWatts));
    drawBarChart('chart-peak', pLabels, pVals, '#8b5cf6');

    // Prediction
    document.getElementById('prediction-val').textContent = predData.prediction + ' W';
    document.getElementById('prediction-sub').textContent =
      `7-day moving average based on ${predData.basedOnDays} days of data`;
  } catch (e) { console.error('Analytics error:', e); }
}

// ─── Devices ──────────────────────────────────────────────────────────────────
async function loadDevices() {
  const data = await api('GET', '/api/devices');
  const el = document.getElementById('devices-list');
  if (!data.devices.length) { el.innerHTML = '<p class="empty-state">No devices added yet</p>'; return; }
  el.innerHTML = data.devices.map(d => `
    <div class="device-card">
      <div class="device-badge badge-${d.type}">${d.type.replace('_', ' ')}</div>
      <div class="device-card-name">${d.name}</div>
      <div class="device-card-type">${d.location}</div>
      ${d.ratedWatts ? `<div class="device-card-meta">${d.ratedWatts} W rated</div>` : ''}
      <div class="device-card-meta" style="margin-top:8px">
        <span style="color:${d.isActive ? '#1D9E75' : '#dc2626'}">${d.isActive ? 'Active' : 'Inactive'}</span>
        &nbsp;&middot;&nbsp;
        <a href="#" onclick="toggleDevice('${d._id}', ${!d.isActive})" style="color:#3b82f6;font-size:13px;text-decoration:none">${d.isActive ? 'Deactivate' : 'Activate'}</a>
        &nbsp;&middot;&nbsp;
        <a href="#" onclick="deleteDevice('${d._id}')" style="color:#dc2626;font-size:13px;text-decoration:none">Remove</a>
      </div>
    </div>
  `).join('');
}

function openAddDevice() { document.getElementById('device-modal').classList.remove('hidden'); }
function closeAddDevice() { document.getElementById('device-modal').classList.add('hidden'); }

async function addDevice() {
  const name = document.getElementById('device-name').value.trim();
  const type = document.getElementById('device-type').value;
  const location = document.getElementById('device-location').value.trim();
  const ratedWatts = Number(document.getElementById('device-watts').value);
  if (!name) return;
  await api('POST', '/api/devices', { name, type, location, ratedWatts });
  closeAddDevice();
  loadDevices();
}

async function toggleDevice(id, isActive) {
  await api('PATCH', `/api/devices/${id}`, { isActive });
  loadDevices();
}

async function deleteDevice(id) {
  if (!confirm('Remove this device?')) return;
  await api('DELETE', `/api/devices/${id}`);
  loadDevices();
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
async function loadAlerts() {
  const data = await api('GET', '/api/alerts');
  const el = document.getElementById('alerts-list');
  if (!data.alerts.length) { el.innerHTML = '<p class="empty-state">No alerts</p>'; return; }
  el.innerHTML = `<div class="section-card">${data.alerts.map(a => alertHTML(a, true)).join('')}</div>`;
}

async function loadAlertBadge() {
  const data = await api('GET', '/api/alerts');
  const unread = data.alerts.filter(a => !a.isRead).length;
  const badge = document.getElementById('alert-badge');
  if (unread > 0) { badge.textContent = unread; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

async function markRead(id) {
  await api('PATCH', `/api/alerts/${id}/read`);
  loadAlerts();
  loadAlertBadge();
}

async function clearAlerts() {
  await api('DELETE', '/api/alerts/clear');
  loadAlerts();
  loadAlertBadge();
}

function alertHTML(a, showRead = false) {
  const time = new Date(a.createdAt).toLocaleString();
  return `<div class="alert-item ${a.isRead ? 'alert-read' : ''}">
    <div class="alert-dot ${a.severity}"></div>
    <div class="alert-msg">${a.message}</div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
      <span class="alert-time">${time}</span>
      ${showRead && !a.isRead ? `<a href="#" onclick="markRead('${a._id}')" style="font-size:12px;color:#3b82f6;text-decoration:none">Mark read</a>` : ''}
    </div>
  </div>`;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
async function saveSettings() {
  const maxWatts = Number(document.getElementById('set-maxwatts').value);
  const minBattery = Number(document.getElementById('set-minbattery').value);
  await api('PATCH', '/api/auth/thresholds', { maxWatts, minBattery });
  currentUser.alertThresholds = { maxWatts, minBattery };
  const msg = document.getElementById('settings-msg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
}

async function addTestReading() {
  const watts = Number(document.getElementById('test-watts').value);
  const source = document.getElementById('test-source').value;
  const batteryLevel = Number(document.getElementById('test-battery').value);
  const solarGeneration = Number(document.getElementById('test-solar').value);
  const data = await api('POST', '/api/readings', { watts, source, batteryLevel, solarGeneration, gridConsumption: source === 'grid' ? watts : 0 });
  const msg = document.getElementById('test-msg');
  msg.textContent = `Reading saved! ${data.alerts?.length ? data.alerts.length + ' alert(s) triggered.' : ''}`;
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 3000);
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function drawLineChart(id, labels, datasets) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(ds => ({
        label: ds.label, data: ds.data,
        borderColor: ds.borderColor, backgroundColor: ds.bg,
        borderWidth: 2, pointRadius: 0, fill: true, tension: 0.4
      }))
    },
    options: {
      responsive: true, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: datasets.length > 1 } },
      scales: {
        x: { ticks: { maxTicksLimit: 12, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { font: { size: 11 } }, grid: { color: '#f0f0f0' } }
      }
    }
  });
}

function drawBarChart(id, labels, data, color) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Avg watts', data, backgroundColor: color + '99', borderColor: color, borderWidth: 1 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

function drawDoughnut(id, labels, data, colors) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 12 } } }
    }
  });
}

// ─── Profile ──────────────────────────────────────────────────────────────────
let profileEditMode = false;
let currentPhoto = '';

async function loadProfile() {
  try {
    const [profileData, devicesData, alertsData] = await Promise.all([
      api('GET', '/api/auth/profile'),
      api('GET', '/api/devices'),
      api('GET', '/api/alerts')
    ]);

    const u = profileData.user;
    currentPhoto = u.photo || '';

    // Photo card
    document.getElementById('profile-name-display').textContent = u.name;
    document.getElementById('profile-email-display').textContent = u.email;
    document.getElementById('profile-joined').textContent =
      'Joined ' + new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    renderAvatar(u.name, u.photo);

    // View mode fields
    document.getElementById('pv-name').textContent = u.name;
    document.getElementById('pv-email').textContent = u.email;
    document.getElementById('pv-created').textContent =
      new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('pv-thresholds').textContent =
      `Max ${u.alertThresholds?.maxWatts || 3000}W usage · Low battery at ${u.alertThresholds?.minBattery || 20}%`;

    // Edit mode pre-fill
    document.getElementById('edit-name').value = u.name;
    document.getElementById('edit-email').value = u.email;

    // Stats
    document.getElementById('pv-devices').textContent = devicesData.devices.length;
    document.getElementById('pv-alerts').textContent = alertsData.alerts.length;

  } catch (e) { console.error('Profile load error:', e); }
}

function renderAvatar(name, photo) {
  const img = document.getElementById('profile-photo-img');
  const initials = document.getElementById('profile-initials');
  if (photo) {
    img.src = photo;
    img.classList.remove('hidden');
    initials.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    initials.classList.remove('hidden');
    const parts = name.trim().split(' ');
    initials.textContent = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
}

function toggleProfileEdit() {
  profileEditMode = !profileEditMode;
  document.getElementById('profile-view-mode').classList.toggle('hidden', profileEditMode);
  document.getElementById('profile-edit-mode').classList.toggle('hidden', !profileEditMode);
  document.getElementById('edit-toggle-btn').textContent = profileEditMode ? 'Cancel' : 'Edit';
  document.getElementById('profile-save-msg').classList.add('hidden');
}

async function saveProfile() {
  const name = document.getElementById('edit-name').value.trim();
  const email = document.getElementById('edit-email').value.trim();
  if (!name || !email) return;
  try {
    const data = await api('PATCH', '/api/auth/profile', { name, email, photo: currentPhoto });
    const u = data.user;
    currentUser = u;

    // Update display
    document.getElementById('profile-name-display').textContent = u.name;
    document.getElementById('profile-email-display').textContent = u.email;
    document.getElementById('pv-name').textContent = u.name;
    document.getElementById('pv-email').textContent = u.email;
    document.getElementById('user-name-sidebar').textContent = u.name;
    renderAvatar(u.name, u.photo);

    const msg = document.getElementById('profile-save-msg');
    msg.classList.remove('hidden');
    setTimeout(() => {
      msg.classList.add('hidden');
      toggleProfileEdit();
    }, 1500);
  } catch (e) {
    alert('Save failed: ' + e.message);
  }
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert('Photo must be under 2MB'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    currentPhoto = e.target.result;
    renderAvatar(currentUser.name, currentPhoto);
    document.getElementById('profile-name-display').textContent = currentUser.name;
    // Auto-save photo immediately
    try {
      await api('PATCH', '/api/auth/profile', { photo: currentPhoto });
    } catch (err) { console.error('Photo save error:', err); }
  };
  reader.readAsDataURL(file);
}