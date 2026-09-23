/* ═══════════════════════════════════════════
   SKULL2FACE AI — ADMIN DASHBOARD JS
   Connected to real backend API
═══════════════════════════════════════════ */

// ── API CONFIG ────────────────────────────
const API = 'http://localhost:5000/api';
function getToken()    { return localStorage.getItem('token'); }
function getUsername() { return localStorage.getItem('username') || 'Admin'; }
if (!getToken() || localStorage.getItem('role') !== 'admin') {
  window.location.href = 'login.html';
}

// ── DATA (fallback arrays) ─────────────────
const ALL_CASES     = [];
const INVESTIGATORS = [];
const LOGS          = [];

let currentFilter = 'all';
let caseToDelete  = null;
let invNextId     = 1;
let notifOpen     = false;
let profileOpen   = false;
let sidebarOpen   = false;
let currentLogs   = [];
let currentCases  = [];
let invList       = [];

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const uname    = getUsername();
  const initials = uname.substring(0,2).toUpperCase();
  document.querySelectorAll('.avatar-circle span, .pd-avatar span').forEach(el => el.textContent = initials);
  document.querySelectorAll('.avatar-label, .pd-name').forEach(el => el.textContent = uname);

  setTodayDate();
  initSidebar();
  initDropdowns();

  await loadAllData();

  updateAdminStats();
  animateCounters();
  initCharts();  // after data loaded
  renderCasesTable(currentCases);
  renderInvestigators(invList);
  renderReports('all');
  renderLogs(currentLogs);
});

// ── LOAD ALL DATA ─────────────────────────
async function loadAllData() {
  await Promise.all([ loadAllCases(), loadAllUsers(), loadStats(), loadLogs() ]);
}

// ── LOAD STATS ───────────────────────────
async function loadStats() {
  try {
    const res  = await fetch(API + '/admin/stats', { headers: { 'Authorization': 'Bearer ' + getToken() } });
    if (!res.ok) return;
    const s = await res.json();
    // Update stat card targets
    const vals = [ s.total, s.active, s.completed, s.pending, s.investigators, s.todayCount ];
    document.querySelectorAll('.stat-num[data-target]').forEach((el, i) => {
      if (vals[i] !== undefined) el.dataset.target = vals[i];
    });
    // Store monthly data for chart
    window._monthlyStats = s.monthly || [];
  } catch(err) { console.warn('Stats load failed:', err.message); }
}

// ── LOAD LOGS ────────────────────────────
async function loadLogs() {
  try {
    const res  = await fetch(API + '/admin/logs', { headers: { 'Authorization': 'Bearer ' + getToken() } });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return;

    currentLogs.length = 0;
    data.forEach(l => {
      currentLogs.push({
        time:   new Date(l.createdAt).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}),
        inv:    l.username,
        action: l.action,
        caseId: l.caseId || '—',
        detail: l.detail
      });
    });

    // Update activity feed with real logs
    updateActivityFeed();
    // Update notifications with real logs
    updateNotifications();
  } catch(err) { console.warn('Logs load failed:', err.message); }
}

// ── ACTIVITY FEED ────────────────────────
function updateActivityFeed() {
  const list = document.querySelector('.activity-list');
  if (!list) return;
  if (!currentLogs.length) {
    list.innerHTML = '<li style="color:#64748b;padding:12px 0;font-size:13px">No activity yet.</li>';
    return;
  }
  const recent = currentLogs.slice(0, 6);
  list.innerHTML = recent.map(l => {
    const dot   = l.action === 'complete' ? 'success'
                : l.action === 'login'    ? 'admin'
                : l.action === 'register' ? 'admin'
                : l.action === 'submit'   ? 'info'
                : l.action === 'delete' || l.action === 'reset' ? 'warn' : 'info';
    const label = l.action === 'complete' ? '<strong>' + l.caseId + '</strong> reconstruction complete'
                : l.action === 'submit'   ? '<strong>' + l.inv + '</strong> submitted ' + l.caseId
                : l.action === 'login'    ? '<strong>' + l.inv + '</strong> logged in'
                : l.action === 'register' ? 'New investigator <strong>' + l.inv + '</strong> created'
                : l.action === 'delete'   ? 'Case <strong>' + l.caseId + '</strong> deleted'
                : l.action === 'reset'    ? 'All cases reset by admin'
                : l.detail;
    return '<li><div class="a-dot ' + dot + '"></div><div class="a-body"><p>' + label + '</p><small>' + l.time + '</small></div></li>';
  }).join('');
}

// ── NOTIFICATIONS ────────────────────────
function updateNotifications() {
  const notifList = document.querySelector('.notif-list');
  if (!notifList) return;
  if (!currentLogs.length) {
    notifList.innerHTML = '<li style="color:#64748b;padding:12px 16px;font-size:13px">No notifications yet.</li>';
    return;
  }
  const recent = currentLogs.slice(0, 4);
  notifList.innerHTML = recent.map(l => {
    const icon  = l.action === 'complete' ? 'fa-circle-check ni-icon success'
                : l.action === 'submit'   ? 'fa-folder-plus ni-icon info'
                : l.action === 'register' ? 'fa-user-plus ni-icon admin'
                : l.action === 'login'    ? 'fa-right-to-bracket ni-icon admin'
                :                          'fa-triangle-exclamation ni-icon warn';
    const label = l.action === 'complete' ? 'Reconstruction complete — <strong>' + l.caseId + '</strong>'
                : l.action === 'submit'   ? 'New case submitted — <strong>' + l.caseId + '</strong>'
                : l.action === 'register' ? 'New investigator created — <strong>' + l.inv + '</strong>'
                : l.action === 'login'    ? '<strong>' + l.inv + '</strong> logged in'
                : l.detail;
    return '<li class="notif-item unread"><i class="fa-solid ' + icon + '"></i><div class="ni-text"><p>' + label + '</p><small>' + l.time + '</small></div></li>';
  }).join('');
}

async function loadAllCases() {
  try {
    const res  = await fetch(API + '/admin/cases', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return;

    ALL_CASES.length = 0; currentCases.length = 0; currentLogs.length = 0;

    data.forEach((r, i) => {
      const c = {
        _id:        r._id,
        id:         r.caseId || ('CA' + String(101 + i).padStart(3,'0')),
        inv:        'INV-' + String(i+1).padStart(3,'0'),
        invName:    r.userId?.username || 'Investigator',
        desc:       r.description || 'No description.',
        date:       new Date(r.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
        createdAt:  r.createdAt,
        status:     r.status === 'done' ? 'completed' : r.status === 'failed' ? 'pending' : 'active',
        faceOutput: r.faceOutput || null
      };
      ALL_CASES.push(c);
      currentCases.push(c);
      currentLogs.push({
        time:   c.date,
        inv:    c.invName,
        action: c.status === 'completed' ? 'complete' : 'submit',
        caseId: c.id,
        detail: c.status === 'completed' ? 'AI reconstruction completed.' : 'New case submitted.'
      });
    });
  } catch(err) { console.warn('Cases load failed:', err.message); }
}

async function loadAllUsers() {
  try {
    const res  = await fetch(API + '/admin/users', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return;

    invList.length = 0; INVESTIGATORS.length = 0;
    data.filter(u => u.role !== 'admin').forEach((u, i) => {
      const inv = {
        _id:    u._id,
        id:     'INV-' + String(i+1).padStart(3,'0'),
        name:   u.username,
        dept:   u.department || 'Forensic Division',
        cases:  ALL_CASES.filter(c => c.invName === u.username).length,
        status: u.active === false ? 'inactive' : 'active'
      };
      invList.push(inv); INVESTIGATORS.push(inv);
    });
    invNextId = invList.length + 1;
  } catch(err) { console.warn('Users load failed:', err.message); }
}

// ── UPDATE STATS ──────────────────────────
function updateAdminStats() {
  // Always use real values, never fallback to old targets
  const vals = [
    ALL_CASES.length,
    ALL_CASES.filter(c => c.status === 'active').length,
    ALL_CASES.filter(c => c.status === 'completed').length,
    ALL_CASES.filter(c => c.status === 'pending').length,
    invList.length,
    ALL_CASES.filter(c => {
      const today = new Date().toDateString();
      return new Date(c.date).toDateString() === today;
    }).length
  ];
  document.querySelectorAll('.stat-num[data-target]').forEach((el, i) => {
    el.dataset.target = vals[i] !== undefined ? vals[i] : 0;
    el.textContent = vals[i] !== undefined ? vals[i] : 0;
  });
}

// ── DATE ───────────────────────────────────
function setTodayDate() {
  const el = document.getElementById('todayDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}

// ── SECTION NAV ────────────────────────────
function showSection(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const btn = document.querySelector('.nav-btn[data-section="' + name + '"]');
  if (btn) btn.classList.add('active');
  closeSidebar(); closeDropdowns();
}

// ── SIDEBAR ────────────────────────────────
function initSidebar() {
  document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
  document.getElementById('overlay').addEventListener('click', closeSidebar);
}
function toggleSidebar() { sidebarOpen ? closeSidebar() : openSidebar(); }
function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('show'); sidebarOpen = true; }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show'); sidebarOpen = false; }

// ── DROPDOWNS ──────────────────────────────
function initDropdowns() {
  document.getElementById('notifBtn').addEventListener('click', e => {
    e.stopPropagation(); notifOpen = !notifOpen;
    document.getElementById('notifDropdown').classList.toggle('hidden', !notifOpen);
    if (notifOpen) { profileOpen = false; document.getElementById('profileDropdown').classList.add('hidden'); document.getElementById('avatarWrap').classList.remove('open'); }
  });
  document.getElementById('avatarWrap').addEventListener('click', e => {
    e.stopPropagation(); profileOpen = !profileOpen;
    document.getElementById('profileDropdown').classList.toggle('hidden', !profileOpen);
    document.getElementById('avatarWrap').classList.toggle('open', profileOpen);
    if (profileOpen) { notifOpen = false; document.getElementById('notifDropdown').classList.add('hidden'); }
  });
  document.addEventListener('click', closeDropdowns);
}
function closeDropdowns() {
  notifOpen = false; profileOpen = false;
  document.getElementById('notifDropdown').classList.add('hidden');
  document.getElementById('profileDropdown').classList.add('hidden');
  document.getElementById('avatarWrap').classList.remove('open');
}
function clearNotifs() {
  document.querySelectorAll('.notif-item.unread').forEach(i => i.classList.remove('unread'));
  const dot = document.getElementById('notifDot');
  if (dot) dot.style.display = 'none';
}

// ── COUNTER ANIMATION ──────────────────────
function animateCounters() {
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = cur;
      if (cur >= target) clearInterval(t);
    }, 40);
  });
}

// ── CHARTS ─────────────────────────────────
let _adminChartInstance = null;

function initCharts() {
  const barCtx = document.getElementById('barChart');
  if (!barCtx) return;
  if (_adminChartInstance) { _adminChartInstance.destroy(); _adminChartInstance = null; }

  const months = ['Oct','Nov','Dec','Jan','Feb','Mar'];
  const submitted = [0,0,0,0,0,0];
  const completed = [0,0,0,0,0,0];

  // Use real monthly stats from backend if available
  const monthlyStats = window._monthlyStats || [];
  if (monthlyStats.length) {
    monthlyStats.forEach(m => {
      const idx = [10,11,12,1,2,3].indexOf(m._id.month);
      if (idx !== -1) {
        submitted[idx] += m.count;
        if (m._id.status === 'done') completed[idx] += m.count;
      }
    });
  } else {
    ALL_CASES.forEach(c => {
      const mo  = new Date(c.date).getMonth();
      const idx = [9,10,11,0,1,2].indexOf(mo);
      if (idx !== -1) {
        submitted[idx]++;
        if (c.status === 'completed') completed[idx]++;
      }
    });
  }

  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label:'Submitted',
          data: submitted,
          backgroundColor: ctx => { const g=ctx.chart.ctx.createLinearGradient(0,0,0,240); g.addColorStop(0,'rgba(192,38,211,0.8)'); g.addColorStop(1,'rgba(139,92,246,0.2)'); return g; },
          borderRadius:8, borderSkipped:false, borderWidth:0,
        },
        {
          label:'Completed',
          data: completed,
          backgroundColor: ctx => { const g=ctx.chart.ctx.createLinearGradient(0,0,0,240); g.addColorStop(0,'rgba(16,185,129,0.75)'); g.addColorStop(1,'rgba(16,185,129,0.1)'); return g; },
          borderRadius:8, borderSkipped:false, borderWidth:0,
        }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:true,
      animation:{ duration:1200, easing:'easeOutQuart' },
      plugins:{
        legend:{ labels:{ color:'#94a3b8', font:{ family:'DM Sans',size:12 }, boxWidth:12, boxHeight:12, borderRadius:4 }},
        tooltip:{ backgroundColor:'#0f1222', borderColor:'rgba(192,38,211,0.3)', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8', padding:12, cornerRadius:10 }
      },
      scales:{
        x:{ grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'#64748b', font:{ family:'DM Sans',size:12 }}},
        y:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#64748b', font:{ family:'DM Sans',size:12 }, stepSize:2 }, beginAtZero:true }
      }
    }
  });
}

// ── CASES TABLE ────────────────────────────
function renderCasesTable(list) {
  const tbody = document.getElementById('casesTableBody');
  const noRes = document.getElementById('caseNoResults');
  const table = document.getElementById('casesTable');

  if (!list.length) {
    tbody.innerHTML = '';
    noRes.classList.remove('hidden');
    table.style.display = 'none';
    return;
  }
  noRes.classList.add('hidden');
  table.style.display = '';

  tbody.innerHTML = list.map(c => `
    <tr>
      <td><span class="td-id">${c.id}</span></td>
      <td><span class="td-inv"><i class="fa-solid fa-user" style="color:var(--admin);margin-right:6px;font-size:11px"></i>${c.invName}</span></td>
      <td><span class="td-desc" title="${c.desc}">${c.desc}</span></td>
      <td><span class="td-date"><i class="fa-regular fa-calendar" style="color:var(--admin);margin-right:5px"></i>${c.date}</span></td>
      <td><span class="status-badge ${c.status}">${c.status}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-view" onclick="showToast('Viewing ${c.id}','info')">
            <i class="fa-regular fa-eye"></i> View
          </button>
          <button class="btn-delete" onclick="openDeleteModal('${c.id}')">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function filterCases() { applyFilters(); }

function applyFilters() {
  const raw   = document.getElementById('caseSearch').value;
  const query = raw.toLowerCase().replace(/\s/g,'');
  let list = currentFilter === 'all' ? [...ALL_CASES] : ALL_CASES.filter(c => c.status === currentFilter);
  if (query) {
    list = list.filter(c => {
      const id = c.id.toLowerCase();
      return id.includes(query) || id.replace(/[^0-9]/g,'').includes(query) ||
        c.desc.toLowerCase().includes(raw.toLowerCase()) ||
        c.invName.toLowerCase().includes(raw.toLowerCase());
    });
  }
  renderCasesTable(list);
}

// ── DELETE CASE ────────────────────────────
function openDeleteModal(id) {
  caseToDelete = id;
  document.getElementById('deleteCaseId').textContent = id;
  document.getElementById('deleteModal').classList.remove('hidden');
}

async function confirmDelete() {
  if (!caseToDelete) return;
  const c = ALL_CASES.find(c => c.id === caseToDelete);
  try {
    if (c && c._id) {
      await fetch(API + '/admin/cases/' + c._id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
    }
  } catch(err) { console.warn('Server delete failed:', err.message); }

  [ALL_CASES, currentCases].forEach(arr => {
    const i = arr.findIndex(c => c.id === caseToDelete);
    if (i !== -1) arr.splice(i, 1);
  });

  closeModal('deleteModal');
  applyFilters();
  updateTabCounts();
  updateAdminStats();
  showToast('Case ' + caseToDelete + ' deleted.', 'warn');
  caseToDelete = null;
}

function updateTabCounts() {
  const q = (sel) => document.querySelector(sel);
  if (q('[data-filter="all"] .tab-count'))       q('[data-filter="all"] .tab-count').textContent       = ALL_CASES.length;
  if (q('[data-filter="active"] .tab-count'))    q('[data-filter="active"] .tab-count').textContent    = ALL_CASES.filter(c=>c.status==='active').length;
  if (q('[data-filter="completed"] .tab-count')) q('[data-filter="completed"] .tab-count').textContent = ALL_CASES.filter(c=>c.status==='completed').length;
  if (q('[data-filter="pending"] .tab-count'))   q('[data-filter="pending"] .tab-count').textContent   = ALL_CASES.filter(c=>c.status==='pending').length;
}

// ── INVESTIGATORS ──────────────────────────
function renderInvestigators(list) {
  const grid = document.getElementById('invGrid');
  if (!list.length) {
    grid.innerHTML = '<p class="empty-msg"><i class="fa-solid fa-circle-exclamation"></i> No investigators found.</p>';
    return;
  }
  grid.innerHTML = list.map((inv, i) => `
    <div class="inv-card" style="animation-delay:${i * 0.06}s">
      <div class="inv-card-top">
        <div class="inv-avatar">${inv.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
        <div>
          <p class="inv-name">${inv.name}</p>
          <p class="inv-id-tag">${inv.id}</p>
        </div>
      </div>
      <div class="inv-meta">
        <div class="inv-meta-row"><i class="fa-solid fa-building"></i>${inv.dept}</div>
        <div class="inv-meta-row"><i class="fa-solid fa-folder"></i>${inv.cases} cases assigned</div>
      </div>
      <div class="inv-status-row">
        <span class="inv-status ${inv.status}">${inv.status}</span>
      </div>
      <div class="inv-actions">
        <button class="btn-inv-view" onclick="showToast('Viewing cases for ${inv.name}','info')">
          <i class="fa-solid fa-folder-open"></i> View Cases
        </button>
        <button class="btn-toggle" onclick="toggleInvStatus('${inv.id}', this)">
          <i class="fa-solid fa-${inv.status === 'active' ? 'toggle-on' : 'toggle-off'}"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function filterInvestigators() {
  const q = document.getElementById('invSearch').value.toLowerCase();
  renderInvestigators(invList.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)));
}

async function toggleInvStatus(id, btn) {
  const inv = invList.find(i => i.id === id);
  if (!inv) return;
  inv.status = inv.status === 'active' ? 'inactive' : 'active';
  try {
    if (inv._id) {
      await fetch(API + '/admin/users/' + inv._id + '/toggle', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
    }
  } catch(err) { console.warn('Toggle failed:', err.message); }
  renderInvestigators(invList);
  showToast(inv.name + ' marked as ' + inv.status + '.', inv.status === 'active' ? 'success' : 'warn');
}

// ── ADD INVESTIGATOR ───────────────────────
function openAddInvModal() {
  document.getElementById('newInvId').value   = 'INV-' + String(invNextId).padStart(3,'0');
  document.getElementById('newInvName').value = '';
  document.getElementById('newInvDept').value = '';
  document.getElementById('newInvPass').value = '';
  document.getElementById('addInvModal').classList.remove('hidden');
}

async function confirmAddInv() {
  const name = document.getElementById('newInvName').value.trim();
  const dept = document.getElementById('newInvDept').value.trim();
  const pass = document.getElementById('newInvPass').value.trim();
  if (!name || !dept || !pass) { showToast('Please fill all fields.','warn'); return; }

  try {
    const res = await fetch(API + '/auth/register', {
      method:  'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() },
      body:    JSON.stringify({ username: name, password: pass, role: 'investigator', department: dept })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || 'Registration failed');

    const newId = 'INV-' + String(invNextId).padStart(3,'0');
    invList.push({ _id: data.user?.id, id: newId, name, dept, cases: 0, status: 'active' });
    invNextId++;
    renderInvestigators(invList);
    closeModal('addInvModal');
    showToast('Investigator ' + name + ' added successfully!');
  } catch(err) {
    showToast('Failed: ' + err.message, 'warn');
  }
}

// ── REPORTS ────────────────────────────────
function renderReports(invFilter) {
  const completed = ALL_CASES.filter(c => c.status === 'completed' && (invFilter === 'all' || c.invName === invFilter));
  const grid = document.getElementById('reportsGrid');
  if (!completed.length) {
    grid.innerHTML = '<p style="color:#64748b;text-align:center;padding:40px;grid-column:1/-1">No completed cases yet.</p>';
    return;
  }
  grid.innerHTML = completed.map((c, i) => `
    <div class="report-card" style="animation-delay:${i*0.06}s">
      <div class="report-thumb">
        ${c.faceOutput
          ? '<img src="http://localhost:5000/uploads/' + c.faceOutput + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px" alt="Face">'
          : '<i class="fa-solid fa-person-circle-check"></i>'
        }
      </div>
      <p class="report-id">${c.id}</p>
      <p class="report-inv"><i class="fa-solid fa-user" style="margin-right:4px"></i>${c.invName}</p>
      <p class="report-date"><i class="fa-regular fa-calendar" style="margin-right:4px"></i>${c.date}</p>
      <button class="dl-btn" onclick="downloadReport('${c.id}','${c.desc}','${c.date}','${c.invName}','${c.inv}')">
        <i class="fa-solid fa-file-arrow-down"></i> Download Report
      </button>
    </div>
  `).join('');
}

function filterReports() {
  renderReports(document.getElementById('reportInvFilter').value);
}

function downloadReport(id, desc, date, invName, invId) {
  const win = window.open('','_blank');
  win.document.write(
    '<!DOCTYPE html><html><head><title>Report ' + id + '</title>' +
    '<style>body{font-family:Segoe UI,sans-serif;background:#fff;color:#1a1a2e;padding:40px;font-size:13px;}' +
    'h1{font-size:26px;color:#7c3aed;margin-bottom:4px;}.sub{color:#64748b;font-size:13px;margin-bottom:24px;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:20px;}' +
    'td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}' +
    'td:first-child{font-weight:600;color:#475569;width:160px;background:#f8fafc;}' +
    '.sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8b5cf6;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;}' +
    '.note{padding:14px 18px;background:#faf5ff;border-left:4px solid #c026d3;border-radius:0 8px 8px 0;font-size:12.5px;color:#4c1d95;line-height:1.7;}' +
    '.foot{margin-top:28px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px;}' +
    '@media print{body{padding:20px;}@page{margin:1cm;}}' +
    '</style></head><body>' +
    '<h1>Skull2Face AI — Forensic Report</h1>' +
    '<p class="sub">Generated by Admin · ' + new Date().toLocaleString() + ' · v2.1.0</p>' +
    '<p class="sec">Case Information</p>' +
    '<table>' +
    '<tr><td>Case ID</td><td>' + id + '</td></tr>' +
    '<tr><td>Date</td><td>' + date + '</td></tr>' +
    '<tr><td>Investigator</td><td>' + invName + ' (' + invId + ')</td></tr>' +
    '<tr><td>Description</td><td>' + desc + '</td></tr>' +
    '<tr><td>Status</td><td>Completed</td></tr>' +
    '</table>' +
    '<p class="sec">Reconstruction Output</p>' +
    faceImgHtml +
    '<div class="note">This reconstruction is an investigative aid. Review by a qualified forensic specialist is required before official use.</div>' +
    '<div class="foot">© 2026 Skull2Face AI · Forensic Identity Reconstruction · Built for Justice</div>' +
    '<scr' + 'ipt>window.onload=function(){window.print();}<\/scr' + 'ipt>' +
    '</body></html>'
  );
  win.document.close();
  showToast('Report for ' + id + ' opened.');
}

// ── LOGS ───────────────────────────────────
function renderLogs(list) {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;
  tbody.innerHTML = list.map(log => `
    <tr>
      <td style="font-size:12px;color:var(--text-muted);white-space:nowrap"><i class="fa-regular fa-clock" style="color:var(--admin);margin-right:6px"></i>${log.time}</td>
      <td style="font-size:12.5px">${log.inv}</td>
      <td><span class="log-action ${log.action}">${log.action}</span></td>
      <td style="font-family:'Syne',sans-serif;font-weight:700">${log.caseId}</td>
      <td style="font-size:12.5px;color:var(--text-muted)">${log.detail}</td>
    </tr>
  `).join('');
}

function filterLogs() {
  const q = document.getElementById('logSearch').value.toLowerCase();
  if (!q) { renderLogs(currentLogs); return; }
  renderLogs(currentLogs.filter(l =>
    l.inv.toLowerCase().includes(q) || l.caseId.toLowerCase().includes(q) ||
    l.action.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q)
  ));
}

function exportLogs() {
  const headers = ['Timestamp','Investigator','Action','Case ID','Details'];
  const rows    = currentLogs.map(l => [l.time,l.inv,l.action,l.caseId,l.detail].map(v => '"'+v+'"').join(','));
  const csv     = [headers.join(','), ...rows].join('\n');
  const a       = document.createElement('a');
  a.href        = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download    = 'SystemLogs_' + Date.now() + '.csv';
  a.click();
  showToast('Logs exported as CSV!');
}


// Danger zone removed


// ── MODAL HELPERS ──────────────────────────
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.add('hidden'); });
  });
});

// ── LOGOUT ────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

// ── VIEW CASE ─────────────────────────────
function adminViewCase(id, status, caseId, faceOutput, desc) {
  if (status === 'completed' && faceOutput && faceOutput !== 'null') {
    const win = window.open('','_blank');
    win.document.write(
      '<!DOCTYPE html><html><head><title>Case ' + caseId + '</title>' +
      '<style>body{font-family:Segoe UI,sans-serif;background:#0b0e1a;color:#e2e8f0;padding:40px;text-align:center;}' +
      'h2{color:#a78bfa;margin-bottom:8px;font-size:24px;}p{color:#64748b;margin-bottom:20px;}' +
      'img{max-width:420px;width:100%;border-radius:16px;box-shadow:0 0 40px rgba(139,92,246,0.5);}' +
      'table{width:100%;max-width:600px;margin:20px auto;border-collapse:collapse;text-align:left;}' +
      'td{padding:10px 14px;border-bottom:1px solid #1e293b;font-size:13px;}td:first-child{color:#64748b;width:140px;}' +
      '</style></head><body>' +
      '<h2>Case ' + caseId + '</h2><p>Reconstruction Complete ✅</p>' +
      '<img src="http://localhost:5000/uploads/' + faceOutput + '" alt="Reconstructed Face"><br><br>' +
      '<table><tr><td>Description</td><td>' + (desc||'') + '</td></tr><tr><td>Status</td><td style="color:#10b981">Completed</td></tr></table>' +
      '</body></html>'
    );
    win.document.close();
  } else {
    showToast('Case ' + caseId + ' — ' + status + ' (reconstruction not yet complete)', 'info');
  }
}

// ── TOAST ──────────────────────────────────
function showToast(msg, type = 'success') {
  const icons  = { success:'fa-circle-check', warn:'fa-triangle-exclamation', info:'fa-circle-info' };
  const colors = { success:'var(--green)', warn:'var(--amber)', info:'var(--cyan)' };
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<i class="fa-solid ' + (icons[type]||icons.success) + '" style="color:' + (colors[type]||colors.success) + '"></i> ' + msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'all .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}