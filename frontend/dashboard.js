/* ═══════════════════════════════════════════
   SKULL2FACE AI — INVESTIGATOR DASHBOARD JS
═══════════════════════════════════════════ */

// ── API CONFIG ────────────────────────────
const API = 'http://localhost:5000/api';
function getToken()    { return localStorage.getItem('token'); }
function getUsername() { return localStorage.getItem('username') || 'Investigator'; }
if (!getToken()) { window.location.href = 'login.html'; }

// ── CASES — loaded from backend, starts empty ──
// Cases loaded from backend only — no dummy data
const CASES = [];

// ── STATE ─────────────────────────────────
let sidebarOpen    = false;
let notifOpen      = false;
let profileOpen    = false;
let currentCaseNum = 114;

// Stored for report generation after reconstruction
let lastCaseData   = null;
// DataURLs of uploaded images
let frontalDataURL = null;
let lateralDataURL = null;
// Raw file names for same-file detection
let frontalFileName = null;
let lateralFileName = null;

// ── DOM READY ─────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Set username
  const uname = getUsername();
  const initials = uname.substring(0,2).toUpperCase();
  document.querySelectorAll('.avatar-circle span, .pd-avatar span').forEach(el => el.textContent = initials);
  document.querySelectorAll('.avatar-label, .pd-name').forEach(el => el.textContent = uname);

  initCaseId();
  initDate();
  initDropdowns();
  initSidebar();

  // Load real data from backend
  await loadCasesFromBackend();
  await loadProfile();

  initChart();
  renderCases(CASES);
  renderReports();
  updateStats();
  animateCounters();
  updateActivityFeed();
  updateNotifications();
});

// ── LOAD CASES FROM BACKEND ───────────────
async function loadCasesFromBackend() {
  try {
    const res = await fetch(API + '/reconstruct/history', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;

    CASES.length = 0;
    data.forEach((r, i) => {
      CASES.push({
        _id:        r._id,
        id:         r.caseId || ('CA' + String(101 + i).padStart(3,'0')),
        desc:       r.description || 'No description provided.',
        date:       new Date(r.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
        createdAt:  r.createdAt,
        status:     r.status === 'done' ? 'completed' : r.status === 'failed' ? 'pending' : 'active',
        faceOutput: r.faceOutput || null,
        traits:     r.traits || {}
      });
    });

    const maxNum = CASES.reduce((max, c) => {
      const n = parseInt(c.id.replace(/[^0-9]/g,''));
      return n > max ? n : max;
    }, 113);
    currentCaseNum = maxNum + 1;
    initCaseId();
  } catch (err) {
    console.warn('Could not load from backend:', err.message);
  }
}

// ── UPDATE STAT CARDS ─────────────────────
function updateStats() {
  const vals = [
    CASES.length,
    CASES.filter(c => c.status === 'active').length,
    CASES.filter(c => c.status === 'completed').length,
    CASES.filter(c => c.status === 'pending').length
  ];
  // Always update — even if 0, show 0 not old dummy value
  document.querySelectorAll('.stat-num[data-target]').forEach((el, i) => {
    el.dataset.target = vals[i] !== undefined ? vals[i] : 0;
    el.textContent = vals[i] !== undefined ? vals[i] : 0;
  });
}

// ── ACTIVITY FEED ─────────────────────────
function updateActivityFeed() {
  const list = document.querySelector('.activity-list');
  if (!list) return;
  if (!CASES.length) {
    list.innerHTML = '<li style="color:#64748b;font-size:13px;padding:12px 0">No activity yet.</li>';
    return;
  }
  // Sort by createdAt newest first
  const sorted = [...CASES].sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date)).slice(0,6);
  list.innerHTML = sorted.map(cas => {
    const dot   = cas.status === 'completed' ? 'success' : cas.status === 'active' ? 'info' : 'warn';
    const label = cas.status === 'completed' ? 'Reconstruction complete — <strong>' + cas.id + '</strong>'
                : cas.status === 'active'    ? 'New case submitted — <strong>' + cas.id + '</strong>'
                :                              'Case pending — <strong>' + cas.id + '</strong>';
    return '<li><div class="a-dot ' + dot + '"></div><div class="a-body"><p>' + label + '</p><small>' + cas.date + '</small></div></li>';
  }).join('');
}

// ── NOTIFICATIONS ─────────────────────────
function updateNotifications() {
  const notifList = document.querySelector('.notif-list');
  if (!notifList) return;
  if (!CASES.length) {
    notifList.innerHTML = '<li style="color:#64748b;font-size:13px;padding:12px 16px">No notifications yet.</li>';
    return;
  }
  const sorted = [...CASES].sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date)).slice(0,4);
  notifList.innerHTML = sorted.map(cas => {
    const icon  = cas.status === 'completed' ? 'fa-circle-check ni-icon success'
                : cas.status === 'active'    ? 'fa-file-arrow-down ni-icon info'
                :                              'fa-hourglass-half ni-icon warn';
    const label = cas.status === 'completed' ? 'Reconstruction complete — <strong>' + cas.id + '</strong>'
                : cas.status === 'active'    ? 'New case submitted — <strong>' + cas.id + '</strong>'
                :                              'Case pending — <strong>' + cas.id + '</strong>';
    return '<li class="notif-item unread"><i class="fa-solid ' + icon + '"></i><div class="ni-text"><p>' + label + '</p><small>' + cas.date + '</small></div></li>';
  }).join('');
}
// caseid and date 
function initCaseId() {
  const el = document.getElementById('caseId');
  if (el && !el.value) el.value = 'CA' + currentCaseNum;
}

function initDate() {
  const el = document.getElementById('caseDate');
  if (el && !el.value) {
    const today = new Date().toISOString().split('T')[0];
    el.value = today;
  }
}
// ── SECTION NAVIGATION ────────────────────
function showSection(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-section="${name}"]`);
  if (btn) btn.classList.add('active');
  closeSidebar();
  closeDropdowns();
}

// ── SIDEBAR ───────────────────────────────
function initSidebar() {
  document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
  document.getElementById('overlay').addEventListener('click', closeSidebar);
}
function toggleSidebar() { sidebarOpen ? closeSidebar() : openSidebar(); }
function openSidebar()  {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  sidebarOpen = true;
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  sidebarOpen = false;
}

// ── DROPDOWNS ─────────────────────────────
function initDropdowns() {
  document.getElementById('notifBtn').addEventListener('click', e => {
    e.stopPropagation();
    notifOpen = !notifOpen;
    document.getElementById('notifDropdown').classList.toggle('hidden', !notifOpen);
    if (notifOpen) { profileOpen = false; document.getElementById('profileDropdown').classList.add('hidden'); }
  });
  document.getElementById('avatarWrap').addEventListener('click', e => {
    e.stopPropagation();
    profileOpen = !profileOpen;
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
  const dot = document.querySelector('.badge-dot');
  if (dot) dot.style.display = 'none';
}

// ── CHART ─────────────────────────────────
let _chartInstance = null;

function initChart() {
  const ctx = document.getElementById('casesChart');
  if (!ctx) return;

  // Destroy old chart if exists
  if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }

  // Build real data from CASES
  const submitted = [0,0,0,0,0,0];
  const completed = [0,0,0,0,0,0];
  CASES.forEach(cas => {
    try {
      // createdAt from backend is ISO string, date is localised string
      const raw = cas.createdAt || cas.date;
      const mo  = new Date(raw).getMonth(); // 0=Jan
      const idx = [9,10,11,0,1,2].indexOf(mo);
      if (idx !== -1) {
        submitted[idx]++;
        if (cas.status === 'completed') completed[idx]++;
      }
    } catch(e){}
  });

  _chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Oct','Nov','Dec','Jan','Feb','Mar'],
      datasets: [
        {
          label: 'Cases Submitted',
          data: submitted,
          backgroundColor: c => {
            const g = c.chart.ctx.createLinearGradient(0,0,0,260);
            g.addColorStop(0,'rgba(139,92,246,0.8)');
            g.addColorStop(1,'rgba(6,182,212,0.2)');
            return g;
          },
          borderRadius:8, borderSkipped:false, borderWidth:0,
        },
        {
          label: 'Completed',
          data: completed,
          backgroundColor: c => {
            const g = c.chart.ctx.createLinearGradient(0,0,0,260);
            g.addColorStop(0,'rgba(16,185,129,0.7)');
            g.addColorStop(1,'rgba(16,185,129,0.1)');
            return g;
          },
          borderRadius:8, borderSkipped:false, borderWidth:0,
        }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:true,
      animation:{ duration:1200, easing:'easeOutQuart' },
      plugins:{
        legend:{ labels:{ color:'#94a3b8', font:{ family:'DM Sans',size:12 }, boxWidth:12, boxHeight:12, borderRadius:4 }},
        tooltip:{ backgroundColor:'#0f1222', borderColor:'rgba(139,92,246,0.3)', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8', padding:12, cornerRadius:10 }
      },
      scales:{
        x:{ grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'#64748b', font:{ family:'DM Sans',size:12 }}},
        y:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#64748b', font:{ family:'DM Sans',size:12 }, stepSize:1 }, beginAtZero:true }
      }
    }
  });
}

// ── COUNTER ANIMATION ─────────────────────
function animateCounters() {
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    let cur = 0;
    const step = Math.ceil(target / 30);
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = cur;
      if (cur >= target) clearInterval(t);
    }, 40);
  });
}

// ── FILE UPLOAD ───────────────────────────
function triggerUpload(side) {
  document.getElementById('file' + cap(side)).click();
}

function previewFile(side) {
  const file = document.getElementById('file' + cap(side)).files[0];
  if (!file) return;

  // Store file name for same-file check
  if (side === 'frontal') frontalFileName = file.name + '_' + file.size;
  else                    lateralFileName = file.name + '_' + file.size;

  checkSameFile();

  const img  = document.getElementById('prev' + cap(side));
  const ph   = document.getElementById('ph'   + cap(side));
  const fn   = document.getElementById('fn'   + cap(side));

  if (file.type === 'application/pdf') {
    // PDF — show filename, no image preview
    img.classList.add('hidden');
    ph.classList.add('hidden');
    fn.textContent = '📄 ' + file.name;
    fn.classList.remove('hidden');
    // Store null for DataURL (PDF can't be embedded as img)
    if (side === 'frontal') frontalDataURL = null;
    else                    lateralDataURL = null;
  } else {
    // Image — show preview + store DataURL
    const reader = new FileReader();
    reader.onload = e => {
      img.src = e.target.result;
      img.classList.remove('hidden');
      ph.classList.add('hidden');
      fn.classList.add('hidden');
      if (side === 'frontal') frontalDataURL = e.target.result;
      else                    lateralDataURL = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function checkSameFile() {
  const warn = document.getElementById('sameFileWarn');
  if (frontalFileName && lateralFileName && frontalFileName === lateralFileName) {
    warn.classList.remove('hidden');
  } else {
    warn.classList.add('hidden');
  }
}

function dragOver(e, side) {
  e.preventDefault();
  document.getElementById('uz' + cap(side)).classList.add('drag-over');
}
function dragLeave(side) {
  document.getElementById('uz' + cap(side)).classList.remove('drag-over');
}
function dropFile(e, side) {
  e.preventDefault();
  dragLeave(side);
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const allowed = ['image/png','image/jpeg','image/jpg','image/webp','image/bmp','application/pdf'];
  if (!allowed.includes(file.type)) { showToast('Unsupported file type.','warn'); return; }
  const dt = new DataTransfer();
  dt.items.add(file);
  document.getElementById('file' + cap(side)).files = dt.files;
  previewFile(side);
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── SUBMIT CASE (real backend) ───────────
async function submitCase() {
  const desc   = document.getElementById('caseDesc').value.trim();
  const caseId = document.getElementById('caseId').value;
  const date   = document.getElementById('caseDate').value;
  const gender = document.getElementById('traitGender').value;
  const age    = document.getElementById('traitAge').value;
  const hair   = document.getElementById('traitHair').value;

  if (!desc) { showToast('Please enter a case description.','warn'); return; }

  const frontalFile = document.getElementById('fileFrontal').files[0];
  const lateralFile = document.getElementById('fileLateral').files[0];
  if (!frontalFile) { showToast('Please upload the Frontal X-ray.','warn'); return; }
  if (!lateralFile) { showToast('Please upload the Lateral X-ray.','warn'); return; }
  if (frontalFileName === lateralFileName) {
    showToast('Frontal and Lateral X-rays must be different files.','warn'); return;
  }

  const skin = document.getElementById('traitSkin')?.value || 'Auto';
  lastCaseData = { caseId, date, desc, gender, age, hair, skin };
  lockForm();

  const btn = document.getElementById('submitBtn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  btn.disabled  = true;

  try {
    const formData = new FormData();
    formData.append('skull',       frontalFile);
    formData.append('skull_side',  lateralFile);
    formData.append('description', desc);
    formData.append('caseId',      caseId);
    formData.append('gender',      gender);
    formData.append('age',         age);
    formData.append('hairColor',   hair);
    const skin = document.getElementById('traitSkin')?.value || 'Auto';
    formData.append('skinTone', skin);

    const res  = await fetch(API + '/reconstruct/upload', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body:    formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || 'Upload failed');

    // Store face image for output page
    if (data.face_b64) {
      window._lastFaceB64 = 'data:image/png;base64,' + data.face_b64;
    } else if (data.record && data.record.faceOutput) {
      window._lastFaceURL = 'http://localhost:5000/uploads/' + data.record.faceOutput;
    }

    // Add to local CASES list
    const today = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    CASES.push({ _id: data.record?._id, id: caseId, desc, date: today, status: 'active', faceOutput: data.record?.faceOutput });
    currentCaseNum++;

    // Refresh UI
    updateStats();
    animateCounters();
    updateActivityFeed();
    updateNotifications();

    showOutputPage();

  } catch (err) {
    console.error(err);
    showToast('Reconstruction failed: ' + err.message, 'warn');
    btn.innerHTML = '<i class="fa-solid fa-microchip"></i> Run Reconstruction';
    btn.disabled  = false;
    unlockForm();
  }
}

// Lock all form inputs after reconstruction
function lockForm() {
  const form = document.getElementById('newCaseForm');
  form.querySelectorAll('input,textarea,select,button').forEach(el => {
    el.disabled = true;
  });
}

// ── OUTPUT PAGE ───────────────────────────
function showOutputPage() {
  const { caseId, date, desc, gender, age, hair } = lastCaseData;

  // Labels
  document.getElementById('outCaseIdLabel').textContent = caseId;
  document.getElementById('outDateLabel').textContent   = date;

  // Meta list
  document.getElementById('outputMeta').innerHTML = `
    <div class="ometa-row"><span class="ometa-key">Case ID</span><span class="ometa-val">${caseId}</span></div>
    <div class="ometa-row"><span class="ometa-key">Date</span><span class="ometa-val">${date}</span></div>
    <div class="ometa-row"><span class="ometa-key">Description</span><span class="ometa-val">${desc}</span></div>
    <div class="ometa-row"><span class="ometa-key">Gender</span><span class="ometa-val">${gender}</span></div>
    <div class="ometa-row"><span class="ometa-key">Age Group</span><span class="ometa-val">${age}</span></div>
    <div class="ometa-row"><span class="ometa-key">Hair</span><span class="ometa-val">${hair}</span></div>
    <div class="ometa-row"><span class="ometa-key">Skin Tone</span><span class="ometa-val">${lastCaseData.skin || 'Auto'}</span></div>
    <div class="ometa-row"><span class="ometa-key">Status</span><span class="ometa-val status-chip">Reconstruction Complete</span></div>
  `;

  // Uploaded X-ray previews
  if (frontalDataURL) {
    document.getElementById('outFrontalImg').src = frontalDataURL;
    document.getElementById('outFrontalImg').classList.remove('hidden');
    document.getElementById('outFrontalPh').classList.add('hidden');
  }
  if (lateralDataURL) {
    document.getElementById('outLateralImg').src = lateralDataURL;
    document.getElementById('outLateralImg').classList.remove('hidden');
    document.getElementById('outLateralPh').classList.add('hidden');
  }

  // Show AI-generated face in output card
  const faceBox = document.querySelector('.output-face-box');
  if (faceBox) {
    const faceSrc = window._lastFaceB64 || window._lastFaceURL || null;
    if (faceSrc) {
      faceBox.innerHTML = '<img src="' + faceSrc + '" style="width:100%;border-radius:12px;box-shadow:0 0 30px rgba(139,92,246,0.4)" alt="Reconstructed Face">';
      window._lastFaceB64 = null;
      window._lastFaceURL = null;
    }
  }

  // Hide form, show output page
  document.getElementById('newCaseForm').classList.add('hidden');
  document.getElementById('outputPage').classList.remove('hidden');

  showToast('Reconstruction complete!');
}

// ── NEW CASE RESET ────────────────────────
function startNewCase() {
  // Unlock & reset form
  const form = document.getElementById('newCaseForm');
  form.querySelectorAll('input,textarea,select,button').forEach(el => {
    el.disabled = false;
  });

  // Clear fields
  document.getElementById('caseDesc').value = '';
  document.getElementById('traitGender').value = 'Auto Detect';
  document.getElementById('traitAge').value    = 'Auto';
  document.getElementById('traitHair').value   = 'Auto';

  // Clear uploads
  ['frontal','lateral'].forEach(side => {
    document.getElementById('file' + cap(side)).value = '';
    document.getElementById('prev' + cap(side)).src   = '';
    document.getElementById('prev' + cap(side)).classList.add('hidden');
    document.getElementById('ph'   + cap(side)).classList.remove('hidden');
    document.getElementById('fn'   + cap(side)).classList.add('hidden');
  });
  frontalDataURL  = null; lateralDataURL  = null;
  frontalFileName = null; lateralFileName = null;
  document.getElementById('sameFileWarn').classList.add('hidden');

  // Update case ID + date
  initCaseId();
  initDate();

  // Reset submit button
  const btn = document.getElementById('submitBtn');
  btn.innerHTML = '<i class="fa-solid fa-microchip"></i> Run Reconstruction';
  btn.disabled  = false;

  // Hide output, show form
  document.getElementById('outputPage').classList.add('hidden');
  document.getElementById('newCaseForm').classList.remove('hidden');

  // Update reports
  renderReports();
}

// ── DOWNLOAD PDF REPORT ───────────────────
function downloadReport() {
  if (!lastCaseData) { showToast('No reconstruction data found.','warn'); return; }
  const { caseId, date, desc, gender, age, hair } = lastCaseData;
  const skin = lastCaseData.skin || 'Auto';

  // Get face image
  const faceSrc = window._reconstructedFaceSrc || null;
  const faceHtml = faceSrc
    ? '<img src="' + faceSrc + '" style="max-width:350px;width:100%;border-radius:12px;display:block;margin:16px auto" alt="Reconstructed Face">'
    : '<div style="padding:40px;background:#f1f5f9;border-radius:8px;text-align:center;color:#94a3b8;border:1px dashed #cbd5e1;margin:16px 0">[ AI Reconstruction Output ]</div>';

  const frontalHtml = frontalDataURL
    ? '<img src="' + frontalDataURL + '" style="width:100%;border-radius:8px" alt="Frontal">'
    : '<div style="padding:20px;background:#f1f5f9;border-radius:8px;text-align:center;color:#94a3b8">[ Frontal X-ray ]</div>';
  const lateralHtml = lateralDataURL
    ? '<img src="' + lateralDataURL + '" style="width:100%;border-radius:8px" alt="Lateral">'
    : '<div style="padding:20px;background:#f1f5f9;border-radius:8px;text-align:center;color:#94a3b8">[ Lateral X-ray ]</div>';

  const win = window.open('','_blank');
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report ' + caseId + '</title>' +
    '<style>*{margin:0;padding:0;box-sizing:border-box;}' +
    'body{font-family:Segoe UI,sans-serif;background:#fff;color:#1a1a2e;padding:40px;font-size:13px;}' +
    '.hdr{display:flex;justify-content:space-between;border-bottom:3px solid #8b5cf6;padding-bottom:16px;margin-bottom:20px;}' +
    '.logo{width:40px;height:40px;background:linear-gradient(135deg,#8b5cf6,#06b6d4);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:800;}' +
    '.t1{font-size:22px;font-weight:700;}.t2{font-size:11px;color:#64748b;}' +
    '.sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8b5cf6;margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:16px;}' +
    'td{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;}' +
    'td:first-child{font-weight:600;color:#475569;width:140px;background:#f8fafc;}' +
    'th{background:#8b5cf6;color:#fff;padding:8px 12px;font-size:12px;text-align:left;}' +
    '.imgs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;}' +
    '.ibox{text-align:center;}.ibox p{font-size:11px;font-weight:600;margin-top:6px;color:#475569;}' +
    '.disc{background:#faf5ff;border-left:4px solid #8b5cf6;padding:12px 16px;font-size:12px;color:#4c1d95;line-height:1.6;border-radius:0 8px 8px 0;}' +
    '.foot{display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;margin-top:16px;}' +
    '@media print{body{padding:20px;}@page{margin:1cm;}}' +
    '</style></head><body>' +
    '<div class="hdr"><div style="display:flex;align-items:center;gap:10px"><div class="logo">S2F</div><div><div class="t1">Skull2Face AI</div><div class="t2">Forensic Facial Reconstruction Report</div></div></div>' +
    '<div style="text-align:right;font-size:11px;color:#64748b;line-height:1.8">RPT-' + caseId + '-' + Date.now().toString().slice(-5) + '<br>' + new Date().toLocaleString() + '</div></div>' +
    '<p class="sec">Case Information</p>' +
    '<table><tr><td>Case ID</td><td>' + caseId + '</td></tr><tr><td>Date</td><td>' + date + '</td></tr><tr><td>Description</td><td>' + desc + '</td></tr></table>' +
    '<p class="sec">Subject Traits</p>' +
    '<table><tr><th>Trait</th><th>Value</th></tr>' +
    '<tr><td>Gender</td><td>' + gender + '</td></tr>' +
    '<tr><td>Age Group</td><td>' + age + '</td></tr>' +
    '<tr><td>Hair</td><td>' + hair + '</td></tr>' +
    '<tr><td>Skin Tone</td><td>' + skin + '</td></tr></table>' +
    '<p class="sec">Images</p>' +
    '<div class="imgs">' +
    '<div class="ibox">' + frontalHtml + '<p>Frontal X-ray</p></div>' +
    '<div class="ibox">' + faceHtml + '<p>Reconstruction</p></div>' +
    '<div class="ibox">' + lateralHtml + '<p>Lateral X-ray</p></div>' +
    '</div>' +
    '<div class="disc">AI generated report. Results must be reviewed by a qualified forensic specialist before official use.</div>' +
    '<div class="foot"><span>© 2026 Skull2Face AI · Forensic Identity Reconstruction · Built for Justice</span><span>Case: ' + caseId + ' · Confidential</span></div>' +
    '<scr' + 'ipt>window.onload=function(){window.print();}<\/scr' + 'ipt>' +
    '</body></html>'
  );
  win.document.close();
  showToast('Report opened — use Print to save as PDF');
}

// ── CASES FILTER ──────────────────────────
function renderCases(list) {
  const grid = document.getElementById('casesGrid');
  const none = document.getElementById('noResults');
  if (!list.length) {
    grid.innerHTML = '<p style="color:#64748b;text-align:center;padding:40px;grid-column:1/-1"><i class="fa-solid fa-folder-open" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.3"></i>No cases yet. Submit your first reconstruction above!</p>';
    none.classList.add('hidden');
    return;
  }
  none.classList.add('hidden');
  grid.innerHTML = list.map(c => `
    <div class="case-card">
      <div class="case-card-top">
        <span class="case-id">${c.id}</span>
        <span class="status-badge ${c.status}">${c.status}</span>
      </div>
      <p class="case-desc">${c.desc}</p>
      <p class="case-date"><i class="fa-regular fa-calendar"></i> ${c.date}</p>
      <div class="case-actions">
        <button class="view-btn" onclick="viewCase('${c.id}')">
          <i class="fa-regular fa-eye"></i> View Case
        </button>
      </div>
    </div>
  `).join('');
}

function filterCases() {
  const raw   = document.getElementById('caseSearch').value;
  const query = raw.toLowerCase().replace(/\s/g,'');
  if (!query) { renderCases(CASES); return; }
  const filtered = CASES.filter(c => {
    const id      = c.id.toLowerCase();
    const numOnly = id.replace(/[^0-9]/g,'');
    const qNum    = query.replace(/[^0-9]/g,'');
    return (
      id.includes(query) ||
      numOnly.includes(query) ||
      (qNum && numOnly.includes(qNum)) ||
      c.desc.toLowerCase().includes(raw.toLowerCase())
    );
  });
  renderCases(filtered);
}

function viewCase(id) {
  const cas = CASES.find(c => c.id === id);
  if (!cas) { showToast('Case not found', 'warn'); return; }
  // If case is completed and has face output, show it
  if (cas.status === 'completed' && cas.faceOutput) {
    const info = 'Case: ' + cas.id + ' | Status: Completed | Date: ' + cas.date;
    const win = window.open('','_blank');
    win.document.write(
      '<!DOCTYPE html><html><head><title>Case ' + cas.id + '</title>' +
      '<style>body{font-family:Segoe UI,sans-serif;background:#0b0e1a;color:#e2e8f0;padding:40px;text-align:center;}' +
      'h2{color:#a78bfa;margin-bottom:8px;}p{color:#64748b;margin-bottom:20px;}' +
      'img{max-width:400px;border-radius:16px;box-shadow:0 0 40px rgba(139,92,246,0.5);}' +
      'table{width:100%;max-width:600px;margin:20px auto;border-collapse:collapse;text-align:left;}' +
      'td{padding:10px 14px;border-bottom:1px solid #1e293b;font-size:13px;}' +
      'td:first-child{color:#64748b;width:140px;}</style></head><body>' +
      '<h2>Case ' + cas.id + '</h2>' +
      '<p>' + cas.date + '</p>' +
      '<img src="http://localhost:5000/uploads/' + cas.faceOutput + '" alt="Reconstructed Face"><br><br>' +
      '<table>' +
      '<tr><td>Description</td><td>' + cas.desc + '</td></tr>' +
      '<tr><td>Status</td><td style="color:#10b981">Completed</td></tr>' +
      '</table>' +
      '<script>document.title="Case ' + cas.id + '";<\/script>' +
      '</body></html>'
    );
    win.document.close();
  } else {
    // Show case info in toast and navigate to new case section
    showSection('newcase');
    showToast('Case ' + id + ' — status: ' + cas.status, 'info');
  }
}

// ── REPORTS ───────────────────────────────
function renderReports() {
  const completed = CASES.filter(c => c.status === 'completed');
  const grid = document.getElementById('reportsGrid');
  if (!grid) return;
  if (!completed.length) {
    grid.innerHTML = '<p style="color:#64748b;text-align:center;padding:40px;grid-column:1/-1"><i class="fa-solid fa-file-circle-xmark" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.3"></i>No completed reconstructions yet.</p>';
    return;
  }
  grid.innerHTML = completed.map((c,i) => `
    <div class="report-card" style="animation-delay:${i*0.07}s">
      <div class="report-thumb">
        ${c.faceOutput
          ? `<img src="http://localhost:5000/uploads/${c.faceOutput}" style="width:100%;height:100%;object-fit:cover;border-radius:12px" alt="Face">`
          : '<i class="fa-solid fa-person-circle-check"></i>'
        }
      </div>
      <p class="report-id">${c.id}</p>
      <p class="report-date"><i class="fa-regular fa-calendar" style="color:#8b5cf6;margin-right:5px"></i>${c.date}</p>
      <button class="dl-btn" onclick="downloadReportById('${c.id}','${c.desc}','${c.date}')">
        <i class="fa-solid fa-file-arrow-down"></i> Download PDF Report
      </button>
      ${c._id ? `<button class="dl-btn" style="margin-top:6px;background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3)" onclick="downloadFaceOutput('${c._id}','${c.id}')">
        <i class="fa-solid fa-image"></i> Download Face Image
      </button>` : ''}
    </div>
  `).join('');
}

// Download face image from backend
async function downloadFaceOutput(recordId, caseId) {
  try {
    const res = await fetch(API + '/reconstruct/download/' + recordId, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) throw new Error('Not found');
    const blob = await res.blob();
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'FaceOutput_' + caseId + '.png';
    a.click();
    showToast('Face image for ' + caseId + ' downloaded!');
  } catch (err) {
    showToast('Download failed: ' + err.message, 'warn');
  }
}

async function downloadReportById(id, desc, date) {
  const cas     = CASES.find(c => c.id === id);
  const faceUrl = cas && cas.faceOutput ? 'http://localhost:5000/uploads/' + cas.faceOutput : null;
  const faceHtml = faceUrl
    ? '<img src="' + faceUrl + '" style="max-width:350px;width:100%;border-radius:12px;display:block;margin:16px auto;box-shadow:0 4px 20px rgba(0,0,0,0.15)" alt="Reconstructed Face">'
    : '<div style="padding:40px;background:#f1f5f9;border-radius:8px;text-align:center;color:#94a3b8;border:1px dashed #cbd5e1;margin:16px 0">[ AI Reconstruction Output ]</div>';

  const reportWin = window.open('','_blank');
  reportWin.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Forensic Report ' + id + '</title>' +
    '<style>' +
    '*{margin:0;padding:0;box-sizing:border-box;}' +
    'body{font-family:Segoe UI,Arial,sans-serif;background:#fff;color:#1a1a2e;padding:40px;font-size:13px;}' +
    '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #8b5cf6;padding-bottom:18px;margin-bottom:24px;}' +
    '.logo{width:40px;height:40px;background:linear-gradient(135deg,#8b5cf6,#06b6d4);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:800;}' +
    '.title{font-size:22px;font-weight:700;}.sub{font-size:11px;color:#64748b;margin-top:2px;}' +
    '.sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8b5cf6;margin:20px 0 10px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:20px;}' +
    'td{padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}' +
    'td:first-child{font-weight:600;color:#475569;width:160px;background:#f8fafc;}' +
    '.disc{background:#faf5ff;border-left:4px solid #8b5cf6;padding:14px 18px;font-size:12.5px;color:#4c1d95;line-height:1.7;border-radius:0 8px 8px 0;margin:20px 0;}' +
    '.foot{display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:12px;font-size:10.5px;color:#94a3b8;margin-top:20px;}' +
    '@media print{body{padding:20px;}@page{margin:1cm;}}' +
    '</style></head><body>' +
    '<div class="header"><div style="display:flex;align-items:center;gap:10px"><div class="logo">S2F</div><div><div class="title">Skull2Face AI</div><div class="sub">Forensic Facial Reconstruction Report</div></div></div>' +
    '<div style="text-align:right;font-size:11.5px;color:#64748b;line-height:1.8"><strong>Report:</strong> RPT-' + id + '-' + Date.now().toString().slice(-5) + '<br><strong>Generated:</strong> ' + new Date().toLocaleString('en-IN') + '</div></div>' +
    '<p class="sec">Case Information</p>' +
    '<table><tr><td>Case ID</td><td>' + id + '</td></tr><tr><td>Date</td><td>' + date + '</td></tr><tr><td>Description</td><td>' + desc + '</td></tr><tr><td>Status</td><td>Completed</td></tr></table>' +
    '<p class="sec">Reconstruction Output</p>' +
    faceHtml +
    '<div class="disc">This facial reconstruction is an AI-assisted investigative aid. Results must be reviewed by a qualified forensic specialist before official use.</div>' +
    '<div class="foot"><span>© 2026 Skull2Face AI · Forensic Identity Reconstruction · Built for Justice</span><span>Case: ' + id + ' · Confidential</span></div>' +
    '<scr' + 'ipt>window.onload=function(){window.print();}<\/scr' + 'ipt>' +
    '</body></html>'
  );
  reportWin.document.close();
  showToast('PDF report for ' + id + ' opened.');
}

// ── PROFILE LOAD ──────────────────────────
async function loadProfile() {
  try {
    const res  = await fetch(API + '/user/me', { headers: { 'Authorization': 'Bearer ' + getToken() } });
    const user = await res.json();
    const name     = user.fullName || user.username || 'Investigator';
    const initials = name.substring(0,2).toUpperCase();
    const dept     = user.department || 'Forensic Division';

    document.querySelectorAll('.avatar-circle span, .pd-avatar span').forEach(el => el.textContent = initials);
    document.querySelectorAll('.avatar-label, .pd-name').forEach(el => el.textContent = user.username || name);

    const nameDisp = document.getElementById('profileNameDisplay');
    const deptDisp = document.getElementById('profileDeptDisplay');
    const initEl   = document.getElementById('profileAvatarInitials');
    const imgEl    = document.getElementById('profileAvatarImg');

    if (nameDisp) nameDisp.textContent = name;
    if (deptDisp) deptDisp.textContent = 'Department: ' + dept;
    if (initEl)   initEl.textContent   = initials;

    const fn = document.getElementById('profileFullName');
    const dp = document.getElementById('profileDept');
    const em = document.getElementById('profileEmail');
    const ph = document.getElementById('profilePhone');
    if (fn) fn.value = user.fullName   || '';
    if (dp) dp.value = user.department || 'Forensic Division';
    if (em) em.value = user.email      || '';
    if (ph) ph.value = user.phone      || '';

    if (user.avatar && imgEl) {
      imgEl.src = user.avatar;
      imgEl.style.display = 'block';
      if (initEl) initEl.style.display = 'none';
    }
  } catch(err) { console.warn('Profile load failed:', err.message); }
}

// ── AVATAR UPLOAD (resize to small for storage) ──────────
function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    // Resize to max 120x120 to keep base64 small
    const tempImg = new Image();
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 120;
      let w = tempImg.width, h = tempImg.height;
      if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
      else       { w = Math.round(w * maxSize / h); h = maxSize; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(tempImg, 0, 0, w, h);
      const smallSrc = canvas.toDataURL('image/jpeg', 0.8);

      const img  = document.getElementById('profileAvatarImg');
      const init = document.getElementById('profileAvatarInitials');
      if (img)  { img.src = smallSrc; img.style.display = 'block'; }
      if (init) init.style.display = 'none';
      document.querySelectorAll('.avatar-circle').forEach(el => {
        el.style.backgroundImage = 'url(' + smallSrc + ')';
        el.style.backgroundSize  = 'cover';
        el.style.borderRadius    = '50%';
        const sp = el.querySelector('span');
        if (sp) sp.style.display = 'none';
      });
      // Store small version for saving
      window._pendingAvatarSrc = smallSrc;
    };
    tempImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── PROFILE SAVE ──────────────────────────
async function saveProfile() {
  const emailInput = document.getElementById('profileEmail');
  const phoneInput = document.getElementById('profilePhone');
  const emailMsg   = document.getElementById('emailError');
  const phoneMsg   = document.getElementById('phoneError');
  const emailVal   = emailInput?.value || '';
  const phoneVal   = phoneInput?.value || '';

  const emailErr = emailVal ? validateEmail(emailVal) : null;
  const phoneErr = phoneVal ? validatePhone(phoneVal) : null;
  setFieldError(emailInput, emailMsg, emailErr);
  setFieldError(phoneInput, phoneMsg, phoneErr);
  if (emailErr || phoneErr) { showToast('Please fix the errors before saving.', 'warn'); return; }

  const fullName   = document.getElementById('profileFullName')?.value.trim() || '';
  const department = document.getElementById('profileDept')?.value.trim()     || '';
  // Use resized avatar (stored by handleAvatarUpload) or existing img src
  const avatarImg  = document.getElementById('profileAvatarImg');
  const avatar     = window._pendingAvatarSrc ||
                     (avatarImg && avatarImg.style.display !== 'none' && avatarImg.src && !avatarImg.src.startsWith('http://localhost') ? avatarImg.src : '');

  try {
    const res = await fetch(API + '/user/profile', {
      method:  'PUT',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + getToken() },
      body:    JSON.stringify({ fullName, department, email: emailVal, phone: phoneVal, avatar })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg);

    if (fullName) {
      const initials = fullName.substring(0,2).toUpperCase();
      document.getElementById('profileNameDisplay').textContent = fullName;
      document.getElementById('profileAvatarInitials').textContent = initials;
      document.querySelectorAll('.avatar-circle span, .pd-avatar span').forEach(el => el.textContent = initials);
    }
    if (department) document.getElementById('profileDeptDisplay').textContent = 'Department: ' + department;
    window._pendingAvatarSrc = null; // clear after save
    showToast('Profile updated successfully!');
  } catch(err) { showToast('Save failed: ' + err.message, 'warn'); }
}

function validateEmail(val) {
  if (!val.trim()) return 'Email is required.';
  const regex = /^[a-zA-Z0-9._\-+]+@(gmail\.com|outlook\.com)$/;
  if (!regex.test(val.trim())) return 'Only name@gmail.com or name@outlook.com is allowed.';
  return null;
}

function validatePhone(val) {
  const normalised = val.replace(/\s+/g, '');
  if (!normalised) return 'Phone number is required.';
  // Must be +91 then exactly 10 digits starting with 6-9
  if (!/^\+91[6-9]\d{9}$/.test(normalised)) 
    return 'Must be +91 followed by 10 digits starting with 6–9 (e.g. +91 9876543210).';
  // Reject all-same-digit: 0000000000, 9999999999 etc.
  const digits = normalised.slice(3);
  if (/^(\d)\1{9}$/.test(digits)) 
    return 'Phone number cannot be all the same digit.';
  return null;
}

function setFieldError(inputEl, msgEl, message) {
  if (message) {
    inputEl.classList.add('input-error');
    msgEl.textContent = message;
    msgEl.classList.remove('hidden');
  } else {
    inputEl.classList.remove('input-error');
    msgEl.classList.add('hidden');
    msgEl.textContent = '';
  }
}

function clearFieldError(inputId, msgId) {
  document.getElementById(inputId)?.classList.remove('input-error');
  const msg = document.getElementById(msgId);
  if (msg) { msg.textContent = ''; msg.classList.add('hidden'); }
}

// ── LOGOUT ────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

// ── UNLOCK FORM ───────────────────────────
function unlockForm() {
  const form = document.getElementById('newCaseForm');
  if (form) form.querySelectorAll('input,textarea,select,button').forEach(el => el.disabled = false);
}

// ── TOAST ─────────────────────────────────
function showToast(msg, type = 'success') {
  const icons  = { success:'fa-circle-check', warn:'fa-triangle-exclamation', info:'fa-circle-info' };
  const colors = { success:'#10b981',         warn:'#f59e0b',                 info:'#06b6d4'        };
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="fa-solid ${icons[type]||icons.success}" style="color:${colors[type]||colors.success}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'all .3s';
    t.style.opacity    = '0';
    t.style.transform  = 'translateY(10px)';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}