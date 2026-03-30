


// แก้ไขส่วนหัวไฟล์
const supabaseUrl = 'https://hmslzkhetlqcxnqbtfit.supabase.co'; 
const supabaseKey = 'sb_publishable_Qr_sjmM-sZoncdNt2Iluqg_OMYbRn8Y'; 
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ฟังก์ชัน Login
async function doLogin() {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;

    if (!u || !p) {
        showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
        return;
    }

    // ปั่นรหัสเป็นตัวเล็ก (LowerCase Hex)
    const hashedPass = CryptoJS.SHA256(p).toString().toLowerCase();

    try {
        const { data: found, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', u)
            .eq('password', hashedPass)
            .single();

        if (error || !found) {
            document.getElementById('login-error').style.display = 'block';
            return;
        }

        currentUser = found;
        ls(SESSION_KEY, found.id);
        
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initApp();
        showToast('ยินดีต้อนรับคุณ ' + found.name, 'success');

    } catch (err) {
        console.error('Login Error:', err);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
}


















// ==================== DATA STORE ====================
const USERS_KEY = 'edms_users';
const FILES_KEY = 'edms_files';
const LOGS_KEY = 'edms_logs';
const FOLDERS_KEY = 'edms_folders';
const ANN_KEY = 'edms_announcements';
const SESSION_KEY = 'edms_session';
const WM_KEY = 'edms_watermark';

function initData() {
   
        if (!ls(FILES_KEY)) ls(FILES_KEY, '[]');
        if (!ls(LOGS_KEY)) ls(LOGS_KEY, '[]');
        if (!ls(ANN_KEY)) ls(ANN_KEY, JSON.stringify([
            { id: 'a1', text: 'ยินดีต้อนรับสู่ระบบ EDMS กรุณาอ่านคู่มือการใช้งานก่อนเริ่มต้น', date: now(), files: [] }
        ]));
        if (!ls(FOLDERS_KEY)) ls(FOLDERS_KEY, JSON.stringify({
            dept: ['HR', 'IT', 'Finance'],
            car: ['2566','2567','2568','2569'],
            audit: ['2566','2567','2568','2569']
        }));
}

function ls(k, v) {
        if (v === undefined) return localStorage.getItem(k);
            localStorage.setItem(k, v);
}

function getJSON(k) { try { return JSON.parse(ls(k)) || []; } catch { return []; } }
function setJSON(k, v) { ls(k, JSON.stringify(v)); }
function now() { return new Date().toISOString(); }
function fmtDate(d) {
    const dt = new Date(d);
        return dt.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
        dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(d) {
        return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmtSize(b) {
        if (b < 1024) return b + ' B';
        if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
        return (b/1024/1024).toFixed(1) + ' MB';
}

// ==================== SESSION (SQL VERSION) ====================
async function doLogin() {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;

    if (!u || !p) {
        showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
        return;
    }

    const hashedPass = CryptoJS.SHA256(p).toString();

    try {
                const { data: found, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', u)
            .eq('password', hashedPass)
            .single();

        if (error || !found) {
            document.getElementById('login-error').style.display = 'block';
            addLog('login_fail', u, 'พยายามเข้าสู่ระบบแต่รหัสผิด');
            return;
        }

      
        currentUser = found;
        ls(SESSION_KEY, found.id);
        
        addLog('login', found.username, 'เข้าสู่ระบบสำเร็จ (Cloud SQL)');
        
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initApp();
        showToast('ยินดีต้อนรับคุณ ' + found.name, 'success');

    } catch (err) {
        console.error('Login Error:', err);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล', 'error');
    }
}
function doLogout() {
        addLog('logout', currentUser.username, 'ออกจากระบบ');
    currentUser = null;
        ls(SESSION_KEY, '');
            document.getElementById('app').style.display = 'none';
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('login-password').value = '';
            document.getElementById('login-error').style.display = 'none';
}

async function checkSession() {
    const sid = ls(SESSION_KEY);
    if (sid) {
               const { data: found, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', sid)
            .single();

        if (found && !error) {
            currentUser = found;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            initApp();
        } else {
            ls(SESSION_KEY, ''); 
        }
    }
}

// ==================== LOG ====================
function addLog(type, user, action) {
    const logs = getJSON(LOGS_KEY);
        logs.unshift({ id: uid(), type, user, action, time: now() });
        if (logs.length > 500) logs.splice(500);
        setJSON(LOGS_KEY, logs);
}

// ==================== APP INIT ====================
let currentPage = 'home';
let currentFolder = null;
let currentSubfolder = null;

function initApp() {
            document.getElementById('user-avatar').textContent = currentUser.name[0].toUpperCase();
            document.getElementById('user-display-name').textContent = currentUser.name;
            document.getElementById('user-display-role').textContent = currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้ทั่วไป';
        renderSidebar();
        navigate('home');
}

function renderSidebar() {
    const isAdmin = currentUser.role === 'admin';
    let html = `
            <div class="nav-section">เมนูเอกสาร</div>
                <div class="nav-item ${currentPage==='home'?'active':''}" onclick="navigate('home')">
                    <span class="nav-icon"><i class="fa-solid fa-house"></i></span> หน้าแรก
                </div>
            <div class="nav-item ${currentPage==='dept'?'active':''}" onclick="navigate('dept')">
                <span class="nav-icon"><i class="fa-solid fa-folder-tree"></i></span> เอกสารฝ่ายต่างๆ
            </div>
            <div class="nav-item ${currentPage==='central'?'active':''}" onclick="navigate('central')">
                <span class="nav-icon"><i class="fa-solid fa-file-lines"></i></span> เอกสารส่วนกลาง
            </div>
            <div class="nav-item ${currentPage==='car'?'active':''}" onclick="navigate('car')">
                <span class="nav-icon"><i class="fa-solid fa-file-circle-check"></i></span> เอกสาร CAR
            </div>
            <div class="nav-item ${currentPage==='audit'?'active':''}" onclick="navigate('audit')">
                <span class="nav-icon"><i class="fa-solid fa-file-contract"></i></span> เอกสารการตรวจติดตาม
            </div>

    `;
        if (isAdmin) {
    html += `
            <div class="nav-section">จัดการระบบ</div>
                <div class="nav-item ${currentPage==='users'?'active':''}" onclick="navigate('users')">
                    <span class="nav-icon"><i class="fa-solid fa-users-gear"></i></span> จัดการผู้ใช้
                </div>
            <div class="nav-item ${currentPage==='logs'?'active':''}" onclick="navigate('logs')">
                    <span class="nav-icon"><i class="fa-solid fa-clock-rotate-left"></i></span> บันทึกการใช้งาน
            </div>
            <div class="nav-item ${currentPage==='watermark'?'active':''}" onclick="navigate('watermark')">
                    <span class="nav-icon"><i class="fa-solid fa-stamp"></i></span> ตั้งค่าลายน้ำ
            </div>
    `;
        }
    document.getElementById('sidebar-nav').innerHTML = html;
}

function navigate(page, folder, subfolder) {
    currentPage = page;
    currentFolder = folder || null;
    currentSubfolder = subfolder || null;
    closeSidebar();
    renderSidebar();

        const titles = {
            home: 'หน้าแรก', dept: 'เอกสารฝ่ายต่างๆ',
            central: 'เอกสารส่วนกลาง', car: 'เอกสาร CAR',
            audit: 'เอกสารการตรวจติดตาม', users: 'จัดการผู้ใช้',
            logs: 'บันทึกการใช้งาน', watermark: 'ตั้งค่าลายน้ำ'
        };
        
        document.getElementById('page-title').textContent = titles[page] || page;
        const content = document.getElementById('page-content');
        content.innerHTML = '';

        if (page === 'home') renderHome();
        else if (page === 'dept') renderDept(folder, subfolder);
        else if (page === 'central') renderCentral();
        else if (page === 'car') renderYearFolder('car', folder);
        else if (page === 'audit') renderYearFolder('audit', folder);
        else if (page === 'users') renderUsers();
        else if (page === 'logs') renderLogs();
        else if (page === 'watermark') renderWatermark();
}

function openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('show');
}
function closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('show');
}

// ==================== HOME ====================
function renderHome() {
    const isAdmin = currentUser.role === 'admin';
    const anns = getJSON(ANN_KEY);
    let html = `<div class="card">
        <div class="card-header">
            <div class="card-title">📢 ประกาศและข่าวสาร</div>
                ${isAdmin ? `<button class="btn btn-sm" onclick="showAddAnn()">+ เพิ่มประกาศ</button>` : ''}
        </div>`;
            if (anns.length === 0) {
            html += `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">ยังไม่มีประกาศ</div></div>`;
            }
        anns.forEach(a => {
            html += `<div class="announcement-item">
                        <span class="ann-icon">📌</span>
                    <div style="flex:1">
                    <div class="ann-text">${escHtml(a.text)}</div>`;
            if (a.files && a.files.length > 0) {
            a.files.forEach(f => {
                    html += `<span class="ann-file-badge" onclick="previewFile('${f.id}')">
                        📎 ${escHtml(f.name)}
                    </span>`;
            });
            }

            if (isAdmin) {
                html += `<div style="margin-top:8px;display:flex;gap:6px;">
                <button class="btn btn-outline btn-xs" onclick="editAnn('${a.id}')">✏️ แก้ไข</button>
                <button class="btn btn-outline btn-xs" onclick="addAnnFile('${a.id}')">📎 แนบไฟล์</button>
                <button class="btn btn-danger btn-xs" onclick="deleteAnn('${a.id}')">🗑 ลบ</button>
                </div>`;
            }

                `</div><div class="ann-date">${fmtDateShort(a.date)}</div></div>`;
        });
                html += `</div>`;
                document.getElementById('page-content').innerHTML = html;
}

function showAddAnn() {
    showModal('เพิ่มประกาศ',
    `<div class="form-group"><label>ข้อความประกาศ</label>
        <textarea id="ann-text" rows="4" style="width:100%;padding:10px;border:1px solid var(--border2);border-radius:var(--radius);font-family:inherit;font-size:14px;resize:vertical;outline:none;"
        placeholder="กรอกข้อความประกาศ..."></textarea></div>`,
        [
            { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
            { text: 'บันทึก', fn: () => {
            const t = document.getElementById('ann-text').value.trim();
            if (!t) { showToast('กรุณากรอกข้อความ', 'error'); return; }
            const anns = getJSON(ANN_KEY);
            anns.unshift({ id: uid(), text: t, date: now(), files: [] });
            setJSON(ANN_KEY, anns);
            addLog('create', currentUser.username, 'เพิ่มประกาศ: ' + t.slice(0, 40));
            closeModal(); renderHome();
            showToast('เพิ่มประกาศสำเร็จ', 'success');
            }}
        ]
    );
}

function editAnn(id) {
    const anns = getJSON(ANN_KEY);
    const a = anns.find(x => x.id === id);
        if (!a) return;
        showModal('แก้ไขประกาศ',
            `<div class="form-group"><label>ข้อความประกาศ</label>
            <textarea id="ann-text-edit" rows="4" style="width:100%;padding:10px;border:1px solid var(--border2);border-radius:var(--radius);font-family:inherit;font-size:14px;resize:vertical;outline:none;">${escHtml(a.text)}</textarea></div>`,
            [
                { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
                { text: 'บันทึก', fn: () => {
                a.text = document.getElementById('ann-text-edit').value.trim();
                setJSON(ANN_KEY, anns);
                addLog('edit', currentUser.username, 'แก้ไขประกาศ');
                closeModal(); renderHome();
                showToast('แก้ไขสำเร็จ', 'success');
            }}
            ]
        );
}

function deleteAnn(id) {
        if (!confirm('ลบประกาศนี้?')) return;
            const anns = getJSON(ANN_KEY).filter(x => x.id !== id);
            setJSON(ANN_KEY, anns);
            addLog('delete', currentUser.username, 'ลบประกาศ');
            renderHome();
            showToast('ลบประกาศสำเร็จ', 'success');
}

function addAnnFile(annId) {
        showModal('แนบไฟล์ประกาศ',
            `<div class="upload-zone" onclick="document.getElementById('ann-file-input').click()" id="ann-upload-zone">
                <div class="upload-zone-icon">📎</div>
                    <div class="upload-zone-text">คลิกเพื่อเลือกไฟล์</div>
                        <div class="upload-zone-hint">Word, Excel, PDF, PNG, JPG</div>
            </div>
                <div id="ann-file-list"></div>
                <input type="file" id="ann-file-input" multiple accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" style="display:none" onchange="handleAnnFiles(this,'${annId}')">`,
                [
                    { text: 'ปิด', cls: 'btn-outline', fn: closeModal }
                ]
        );
}

function handleAnnFiles(input, annId) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const container = document.getElementById('ann-file-list');
  container.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px;">⏳ กำลังอัพโหลด...</div>';
  
  let done = 0;
  const anns = getJSON(ANN_KEY);
  const ann = anns.find(x => x.id === annId);
  if (!ann) { closeModal(); return; }

    files.forEach(file => {
    const reader = new FileReader();
        reader.onload = e => {
        const fileObj = {
        id: uid(), name: file.name, type: file.type, size: file.size,
        data: e.target.result, uploaded: now(), uploadedBy: currentUser.username,
        section: 'announcement', folder: null, docType: null
        };
            const allFiles = getJSON(FILES_KEY);
            allFiles.push(fileObj);
            setJSON(FILES_KEY, allFiles);
            ann.files = ann.files || [];
            ann.files.push({ id: fileObj.id, name: file.name });
            addLog('upload', currentUser.username, 'อัพโหลดไฟล์ประกาศ: ' + file.name);
            done++;
            if (done === files.length) {
            setJSON(ANN_KEY, anns);
            container.innerHTML = `<div class="watermark-note">✅ อัพโหลด ${done} ไฟล์สำเร็จ</div>`;
            renderHome();
            showToast('อัพโหลดสำเร็จ', 'success');
            }
        };
    reader.readAsDataURL(file);
    });
}

// ==================== DEPT ====================
function renderDept(folder, subfolder) {
    const folders = getJSON(FOLDERS_KEY);
    const deptFolders = folders.dept || [];
    const isAdmin = currentUser.role === 'admin';
    const content = document.getElementById('page-content');

    if (!folder) {
    let html = ``;
    if (isAdmin) {
        html += `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px;">
            <button class="btn" onclick="showAddFolder('dept')">+ เพิ่มโฟลเดอร์</button>
        </div>`;
    }
            html += `<div class="folder-grid">`;
            deptFolders.forEach(f => {
                const count = getJSON(FILES_KEY).filter(x => x.section === 'dept' && x.folder === f).length;
                    html += `<div class="folder-card" onclick="navigate('dept','${f}')">
                        ${isAdmin ? `<button class="folder-delete" onclick="event.stopPropagation();deleteFolder('dept','${f}')">✕</button>` : ''}
                            <div class="folder-icon"><i class="fa-solid fa-folder"></i></div>
                            <div class="folder-name">ฝ่าย ${f}</div>
                            <div class="folder-count">${count} ไฟล์</div>
            </div>`;
        });
        html += `</div>`;
        content.innerHTML = html;
    } else {

                // Inside folder
                const files = getJSON(FILES_KEY).filter(x => x.section === 'dept' && x.folder === folder);
                const DOC_TYPES = ['ทั้งหมด', 'FR', 'WI', 'JD', 'SP', 'SD'];
                let activeFilter = subfolder || 'ทั้งหมด';
                let html = `<div class="breadcrumb">
                    <a onclick="navigate('dept')">📂 เอกสารฝ่ายต่างๆ</a>
                    <span class="sep">›</span>
                    <span class="current">ฝ่าย ${folder}</span>
                </div>`;

                    html += `<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
                                <div class="filter-row" style="margin-bottom:0">`;
                                    DOC_TYPES.forEach(t => {
                                        html += `<button class="filter-btn ${t===activeFilter?'active':''}" onclick="navigate('dept','${folder}','${t}')">${t}</button>`;
                                    });
                                html += `</div>`;
                                    if (isAdmin) {
                                    html += `<button class="btn btn-sm" onclick="showUploadModal('dept','${folder}')">+ อัพโหลดไฟล์</button>`;
                                    }
                    html += `</div>`;
                        const filtered = activeFilter === 'ทั้งหมด' ? files : files.filter(f => f.docType === activeFilter);
                    html += renderFileTable(filtered, isAdmin);
                    content.innerHTML = html;
    }
}

function renderFileTable(files, isAdmin) {
  if (files.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">ยังไม่มีไฟล์</div></div>`;
  }

  // Search within folder
  const searchId = 'folder-search-' + Math.random().toString(36).slice(2);
  let html = `<div class="card" style="padding:0;overflow:hidden;">
   
    <div style="padding:0px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;"> </div>
    <div class="file-table-wrap">
    <table class="file-table">
      <thead><tr>
        <th>ประเภทเอกสาร</th>
        <th>ประเภทไฟล์</th>
        <th>ชื่อไฟล์</th>
        <th>วันที่อัพโหลด</th>
        <th>อัพโหลดโดย</th>
        <th>การดำเนินการ</th>
      </tr></thead>
      <tbody id="file-table-body-main">`;


  files.sort((a,b) => new Date(b.uploaded) - new Date(a.uploaded)).forEach(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    html += `<tr data-search="${f.name.toLowerCase()} ${(f.docType||'').toLowerCase()}">
      <td>${f.docType ? `<span class="doc-type-badge">${f.docType}</span>` : '<span class="text-muted">—</span>'}</td>
      <td><span class="file-type-badge ${ext}">${ext.toUpperCase()}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(f.name)}">${escHtml(f.name)}</td>
      <td class="text-muted text-sm">${fmtDateShort(f.uploaded)}</td>
      <td class="text-muted text-sm">${f.uploadedBy}</td>
      <td><div class="actions-cell">
        <button class="btn btn-outline btn-xs" onclick="previewFile('${f.id}')">👁 ดู</button>
        <button class="btn btn-xs" onclick="downloadFile('${f.id}')">ดาวน์โหลด</button>
        ${isAdmin ? `<button class="btn btn-danger btn-xs" onclick="deleteFile('${f.id}')">🗑</button>` : ''}
      </div></td>
    </tr>`;
  });
  html += `</tbody></table></div></div>`;
  return html;
}

function filterTable(input, tbodyId) {
  const q = input.value.toLowerCase();
  const rows = document.querySelectorAll(`#${tbodyId} tr`);
  rows.forEach(r => {
    const s = r.getAttribute('data-search') || '';
    r.style.display = s.includes(q) ? '' : 'none';
  });
}

// ==================== CENTRAL ====================
function renderCentral() {
  const isAdmin = currentUser.role === 'admin';
  const files = getJSON(FILES_KEY).filter(x => x.section === 'central');
  let html = '';
  if (isAdmin) {
    html += `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn" onclick="showUploadModal('central',null)">+ อัพโหลดไฟล์</button>
    </div>`;
  }
  html += renderFileTable(files, isAdmin);
  document.getElementById('page-content').innerHTML = html;
}

// ==================== CAR / AUDIT ====================
function renderYearFolder(section, year) {
  const folders = getJSON(FOLDERS_KEY);
  const years = folders[section] || [];
  const isAdmin = currentUser.role === 'admin';
  const content = document.getElementById('page-content');
  const sectionName = section === 'car' ? 'เอกสาร CAR' : 'เอกสารการตรวจติดตาม';

  if (!year) {
    let html = '';
    if (isAdmin) {
      html += `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px;">
        <button class="btn" onclick="showAddFolder('${section}')">+ เพิ่มปี</button>
      </div>`;
    }
    html += `<div class="folder-grid">`;
    years.forEach(y => {
      const count = getJSON(FILES_KEY).filter(x => x.section === section && x.folder === y).length;
      html += `<div class="folder-card" onclick="navigate('${section}','${y}')">
        ${isAdmin ? `<button class="folder-delete" onclick="event.stopPropagation();deleteFolder('${section}','${y}')">✕</button>` : ''}
        <div class="folder-icon">📅</div>
        <div class="folder-name">${y}</div>
        <div class="folder-count">${count} ไฟล์</div>
      </div>`;
    });
    html += `</div>`;
    content.innerHTML = html;
  } else {
    const files = getJSON(FILES_KEY).filter(x => x.section === section && x.folder === year);
    let html = `<div class="breadcrumb">
      <a onclick="navigate('${section}')">${section === 'car' ? 'เอกสาร CAR' : 'เอกสารการตรวจติดตาม'}</a>
      <span class="sep">›</span>
      <span class="current">${year}</span>
    </div>`;
    if (isAdmin) {
      html += `<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
        <button class="btn btn-sm" onclick="showUploadModal('${section}','${year}')">+ อัพโหลดไฟล์</button>
      </div>`;
    }
    html += renderFileTable(files, isAdmin);
    content.innerHTML = html;
  }
}

// ==================== FOLDER MANAGEMENT ====================
function showAddFolder(section) {
  const label = section === 'dept' ? 'ชื่อโฟลเดอร์ฝ่าย' : 'ปี (เช่น 2570)';
  showModal('เพิ่ม' + (section==='dept' ? 'โฟลเดอร์' : 'ปี'),
    `<div class="form-group"><label>${label}</label>
     <input type="text" id="new-folder-name" placeholder="${label}"></div>`,
    [
      { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
      { text: 'เพิ่ม', fn: () => {
        const name = document.getElementById('new-folder-name').value.trim();
        if (!name) { showToast('กรุณากรอกชื่อ', 'error'); return; }
        const folders = getJSON(FOLDERS_KEY);
        if (!folders[section]) folders[section] = [];
        if (folders[section].includes(name)) { showToast('มีชื่อนี้แล้ว', 'error'); return; }
        folders[section].push(name);
        setJSON(FOLDERS_KEY, folders);
        addLog('create', currentUser.username, `เพิ่มโฟลเดอร์ ${section}: ${name}`);
        closeModal();
        navigate(section === 'dept' ? 'dept' : section);
        showToast('เพิ่มสำเร็จ', 'success');
      }}
    ]
  );
}

function deleteFolder(section, name) {
  const files = getJSON(FILES_KEY).filter(x => x.section === section && x.folder === name);
  if (files.length > 0 && !confirm(`โฟลเดอร์นี้มีไฟล์ ${files.length} ไฟล์ ยืนยันลบ?`)) return;
  if (files.length === 0 && !confirm(`ลบโฟลเดอร์ "${name}"?`)) return;
  
  const folders = getJSON(FOLDERS_KEY);
  folders[section] = (folders[section] || []).filter(x => x !== name);
  setJSON(FOLDERS_KEY, folders);
  
  const allFiles = getJSON(FILES_KEY).filter(x => !(x.section === section && x.folder === name));
  setJSON(FILES_KEY, allFiles);
  addLog('delete', currentUser.username, `ลบโฟลเดอร์ ${section}: ${name}`);
  navigate(section === 'dept' ? 'dept' : section);
  showToast('ลบสำเร็จ', 'success');
}

// ==================== UPLOAD ====================
let pendingFiles = [];

function showUploadModal(section, folder) {
  pendingFiles = [];
  const isDocType = section === 'dept';
  const DOC_TYPES = ['FR', 'WI', 'JD', 'SP', 'SD'];
  const wmImg = ls(WM_KEY);
  
  let body = `
    <div class="watermark-note">📄 ลายน้ำจะถูกประทับลงไฟล์ PDF และ PNG/JPG โดยอัตโนมัติ</div>`;
  
  if (isDocType) {
    body += `<div class="form-group"><label>ประเภทเอกสาร</label>
      <select id="upload-doc-type">
        <option value="">-- ไม่ระบุ --</option>
        ${DOC_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select></div>`;
  }

  body += `<div class="upload-zone" id="upload-zone" 
      onclick="document.getElementById('file-input-upload').click()"
      ondragover="event.preventDefault();this.classList.add('drag')"
      ondragleave="this.classList.remove('drag')"
      ondrop="handleDrop(event,'${section}','${folder||''}')">
      <div class="upload-zone-icon">📤</div>
      <div class="upload-zone-text">คลิกหรือลากไฟล์มาวางที่นี่</div>
      <div class="upload-zone-hint">Word, Excel, PDF, PNG, JPG (เลือกได้หลายไฟล์)</div>
    </div>
    <div id="upload-file-list"></div>
    <input type="file" id="file-input-upload" multiple 
      accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg" style="display:none"
      onchange="handleFileSelect(this,'${section}','${folder||''}')">`;

  showModal('อัพโหลดไฟล์',
    body,
    [
      { text: 'ยกเลิก', cls: 'btn-outline', fn: () => { pendingFiles = []; closeModal(); } },
      { text: 'อัพโหลด', fn: () => confirmUpload(section, folder) }
    ]
  );
}

function handleDrop(event, section, folder) {
  event.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag');
  const files = Array.from(event.dataTransfer.files);
  processFiles(files, section, folder);
}

function handleFileSelect(input, section, folder) {
  processFiles(Array.from(input.files), section, folder);
  input.value = '';
}

function processFiles(files, section, folder) {
  files.forEach(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'];
    if (!allowed.includes(ext)) { showToast(`ไม่รองรับไฟล์ .${ext}`, 'error'); return; }
    pendingFiles.push({ file: f, name: f.name, size: f.size, ext });
  });
  renderUploadList();
}

function renderUploadList() {
  const container = document.getElementById('upload-file-list');
  if (!container) return;
  if (pendingFiles.length === 0) { container.innerHTML = ''; return; }
  let html = '<div style="margin-top:8px;">';
  pendingFiles.forEach((f, i) => {
    html += `<div class="upload-file-item">
      <span>${getFileIcon(f.ext)}</span>
      <span class="file-name">${escHtml(f.name)}</span>
      <span class="file-size">${fmtSize(f.size)}</span>
      <span class="upload-file-remove" onclick="removePendingFile(${i})">✕</span>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function removePendingFile(i) {
  pendingFiles.splice(i, 1);
  renderUploadList();
}

function confirmUpload(section, folder) {
  if (pendingFiles.length === 0) { showToast('กรุณาเลือกไฟล์', 'error'); return; }
  const docType = document.getElementById('upload-doc-type')?.value || null;
  
  closeModal();
  showToast(`⏳ กำลังอัพโหลด ${pendingFiles.length} ไฟล์...`);

  let done = 0;
  const toProcess = [...pendingFiles];
  pendingFiles = [];

  toProcess.forEach(item => {
    const reader = new FileReader();
    reader.onload = e => {
      const needsWatermark = ['pdf', 'png', 'jpg', 'jpeg'].includes(item.ext);
      const data = e.target.result;
      
      const saveFile = (finalData) => {
        const fileObj = {
          id: uid(), name: item.name, type: item.file.type,
          size: item.size, data: finalData, uploaded: now(),
          uploadedBy: currentUser.username, section, folder: folder || null,
          docType: docType || null, hasWatermark: needsWatermark
        };
        const allFiles = getJSON(FILES_KEY);
        allFiles.push(fileObj);
        setJSON(FILES_KEY, allFiles);
        addLog('upload', currentUser.username, `อัพโหลด: ${item.name} → ${section}/${folder||'-'}`);
        done++;
        if (done === toProcess.length) {
          showToast(`✅ อัพโหลด ${done} ไฟล์สำเร็จ`, 'success');
          navigate(currentPage, currentFolder, currentSubfolder);
        }
      };

      // แก้ไขเพื่อให้รองรับ PDF ด้วย
      if (needsWatermark && item.ext === 'pdf') {
      applyPdfWatermark(data, saveFile); // เรียกฟังก์ชันทำลายน้ำ PDF
      } else if (needsWatermark && ['png', 'jpg', 'jpeg'].includes(item.ext)) {
       applyImageWatermark(data, saveFile);
        } else {
  saveFile(data);
}

 };
    reader.readAsDataURL(item.file);
  });
}

function applyImageWatermark(dataUrl, callback) {
  const wmData = ls(WM_KEY);
  const wmText = ls('edms_wm_text') || '';
  
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Apply image watermark if available
    if (wmData) {
      const wm = new Image();
      wm.onload = () => {
        ctx.globalAlpha = 0.25;
        const maxW = canvas.width * 0.8;
        const scale = maxW / wm.width;
        const ww = wm.width * scale, wh = wm.height * scale;
        const posX = (canvas.width / 2) - (ww / 2);
        const posY = (canvas.height / 2) - (wh / 2);
        ctx.drawImage(wm, posX, posY, ww, wh);
        ctx.globalAlpha = 1.0;

    if (wmText && wmText.trim() !== '') {
            drawTextWatermark(ctx, canvas.width, canvas.height, wmText);
        }
        callback(canvas.toDataURL('image/jpeg', 0.92));
      };

      wm.onerror = () => {
        drawTextWatermark(ctx, canvas.width, canvas.height, wmText);
        callback(canvas.toDataURL('image/jpeg', 0.92));
      };
      wm.src = wmData;
    } else {
      drawTextWatermark(ctx, canvas.width, canvas.height, wmText);
      callback(canvas.toDataURL('image/jpeg', 0.92));
    }
  };
  img.src = dataUrl;
}

// --- 1. ฟังก์ชันทำลายน้ำ PDF (ปรับปรุงให้เบาเครื่องขึ้น ป้องกันเว็บค้าง) ---
async function applyPdfWatermark(dataUrl, callback) {
  const wmData = ls(WM_KEY);
  const wmText = ls('edms_wm_text') || '';
  
  // ถ้าไม่มีการตั้งค่าลายน้ำอะไรเลย ให้ข้ามไปเซฟไฟล์ทันที
  if (!wmData && wmText.trim() === '') {
    callback(dataUrl);
    return;
  }

  try {
    // ใช้วิธีแปลงไฟล์แบบลูป (For Loop) ซึ่งปลอดภัยและไม่ทำให้เบราว์เซอร์ค้าง
    const base64String = dataUrl.split(',')[1];
    const binaryString = atob(base64String);
    const existingPdfBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      existingPdfBytes[i] = binaryString.charCodeAt(i);
    }
    
    const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    // จัดการโลโก้ลายน้ำ (ถ้ามี)
    let embeddedImage = null;
    if (wmData) {
      try {
        if (wmData.startsWith('data:image/png')) {
          embeddedImage = await pdfDoc.embedPng(wmData);
        } else if (wmData.startsWith('data:image/jpeg') || wmData.startsWith('data:image/jpg')) {
          embeddedImage = await pdfDoc.embedJpg(wmData);
        }
      } catch (imgError) {
        console.error("PDF Embed Image Error:", imgError);
      }
    }

    // วนลูปจัดการแต่ละหน้าของ PDF
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // วาดรูปภาพโลโก้
      if (embeddedImage) {
        const imgDims = embeddedImage.scale(0.8 * (width / embeddedImage.width));
        page.drawImage(embeddedImage, {
          x: width / 2 - imgDims.width / 2,
          y: height / 2 - imgDims.height / 2,
          width: imgDims.width,
          height: imgDims.height,
          opacity: 0.08, // โปร่งใส
        });
      }

      // วาดข้อความ (สร้าง Canvas เพื่อให้ฟอนต์ตรงกับฝั่งรูปภาพและรองรับภาษาไทย)
      if (wmText.trim() !== '') {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2; // คูณ 2 ช่วยให้ตัวหนังสือคมชัดขึ้น
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        
        // วาดข้อความลงบน Canvas เสมือน
        drawTextWatermark(ctx, width, height, wmText.trim());
        
        // แปลงข้อความเป็นรูปภาพ แล้วประทับลง PDF
        const textImgData = canvas.toDataURL('image/png');
        const embeddedText = await pdfDoc.embedPng(textImgData);
        
        page.drawImage(embeddedText, {
          x: 0,
          y: 0,
          width: width,
          height: height,
        });
      }
    }

    // บันทึกและส่งไฟล์ไปทำงานต่อ
    const pdfBytes = await pdfDoc.saveAsBase64({ dataUri: true });
    callback(pdfBytes);

  } catch (err) {
    console.error("PDF Watermark Error:", err);
    callback(dataUrl); // ถ้ามีข้อผิดพลาด ให้เซฟไฟล์ดั้งเดิมแทน เพื่อให้ผู้ใช้อัพโหลดผ่าน
  }
}

// --- 2. ฟังก์ชันวาดข้อความ (ต้องมีฟังก์ชันนี้อยู่ห้ามลบนะครับ) ---
function drawTextWatermark(ctx, w, h, text) {
  ctx.save();
  ctx.font = `bold ${Math.max(20, Math.floor(w * 0.06))}px 'IBM Plex Mono', monospace`;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.translate(w/2, h/2);
  ctx.rotate(-Math.PI/6);
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}


// ==================== FILE ACTIONS ====================
function previewFile(id) {
  const files = getJSON(FILES_KEY);
  const f = files.find(x => x.id === id);
  if (!f) { showToast('ไม่พบไฟล์', 'error'); return; }

  addLog('view', currentUser.username, `ดูไฟล์: ${f.name}`);
  document.getElementById('preview-title').textContent = f.name;
  
  const frame = document.getElementById('preview-frame');
  const ext = f.name.split('.').pop().toLowerCase();

  if (['png', 'jpg', 'jpeg'].includes(ext)) {
    frame.innerHTML = `<img src="${f.data}" alt="${escHtml(f.name)}" style="max-height:480px;object-fit:contain;">`;
  } else if (ext === 'pdf') {
    frame.innerHTML = `<iframe src="${f.data}" style="width:100%;height:100%;border:none;border-radius:6px;"></iframe>`;
  } else {
    frame.innerHTML = `<div style="text-align:center;padding:40px;">
      <div style="font-size:48px;">${getFileIcon(ext)}</div>
      <div style="margin-top:12px;font-size:15px;font-weight:500;">${escHtml(f.name)}</div>
      <div style="margin-top:8px;color:var(--text3);font-size:13px;">${fmtSize(f.size)} · ${fmtDate(f.uploaded)}</div>
      <p style="margin-top:16px;font-size:13px;color:var(--text2);">ไฟล์ประเภทนี้ไม่สามารถแสดงผลในเบราว์เซอร์ได้ กรุณาดาวน์โหลดเพื่อเปิด</p>
      <button class="btn mt-16" onclick="downloadFile('${id}')">ดาวน์โหลด</button>
    </div>`;
  }

  document.getElementById('preview-download-btn').onclick = () => downloadFile(id);
  document.getElementById('preview-overlay').classList.add('show');
}

function closePreview() {
  document.getElementById('preview-overlay').classList.remove('show');
  document.getElementById('preview-frame').innerHTML = '';
}

function downloadFile(id) {
  const files = getJSON(FILES_KEY);
  const f = files.find(x => x.id === id);
  if (!f) { showToast('ไม่พบไฟล์', 'error'); return; }
  addLog('download', currentUser.username, `ดาวน์โหลด: ${f.name}`);
  const a = document.createElement('a');
  a.href = f.data;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('ดาวน์โหลดสำเร็จ', 'success');
}

function deleteFile(id) {
  if (!confirm('ลบไฟล์นี้?')) return;
  const files = getJSON(FILES_KEY);
  const f = files.find(x => x.id === id);
  const newFiles = files.filter(x => x.id !== id);
  setJSON(FILES_KEY, newFiles);
  if (f) addLog('delete', currentUser.username, `ลบไฟล์: ${f.name}`);
  navigate(currentPage, currentFolder, currentSubfolder);
  showToast('ลบไฟล์สำเร็จ', 'success');
}

// ==================== GLOBAL SEARCH ====================
function globalSearch(q) {
  if (!q.trim()) return;
  q = q.toLowerCase();
  const files = getJSON(FILES_KEY).filter(f =>
    f.name.toLowerCase().includes(q) ||
    (f.folder || '').toLowerCase().includes(q) ||
    (f.docType || '').toLowerCase().includes(q)
  );
  
  const isAdmin = currentUser.role === 'admin';
  document.getElementById('page-title').textContent = `ผลการค้นหา: "${q}"`;
  const content = document.getElementById('page-content');

  if (files.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">ไม่พบไฟล์ที่ตรงกัน</div></div>`;
    return;
  }

  let html = `<div style="margin-bottom:12px;font-size:13px;color:var(--text3);">พบ ${files.length} ไฟล์</div>`;
  html += renderFileTable(files, isAdmin);
  content.innerHTML = html;
}

// ==================== USERS ====================
function renderUsers() {
  const users = getJSON(USERS_KEY);
  let html = `<div class="card">
    <div class="card-header">
      <div class="card-title">👥 จัดการผู้ใช้งาน (${users.length} บัญชี)</div>
      <button class="btn btn-sm" onclick="showAddUser()">+ เพิ่มผู้ใช้</button>
    </div>
    <div class="file-table-wrap">
    <table class="file-table">
      <thead><tr>
        <th>ชื่อ</th>
        <th>ชื่อผู้ใช้</th>
        <th>บทบาท</th>
        <th>วันที่สร้าง</th>
        <th>การดำเนินการ</th>
      </tr></thead>
      <tbody>`;
  users.forEach(u => {
    html += `<tr>
      <td>${escHtml(u.name)}</td>
      <td><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;">${escHtml(u.username)}</span></td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role === 'admin' ? 'Admin' : 'User'}</span></td>
      <td class="text-muted text-sm">${fmtDateShort(u.created)}</td>
      <td><div class="actions-cell">
        ${u.id !== currentUser.id ? `
          <button class="btn btn-outline btn-xs" onclick="editUser('${u.id}')">✏️ แก้ไข</button>
          <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">🗑 ลบ</button>
        ` : '<span class="text-muted text-sm">(บัญชีปัจจุบัน)</span>'}
      </div></td>
    </tr>`;
  });
  html += `</tbody></table></div></div>`;
  document.getElementById('page-content').innerHTML = html;
}

function showAddUser() {
  showModal('เพิ่มผู้ใช้งาน',
    `<div class="form-group"><label>ชื่อ-นามสกุล</label><input type="text" id="new-u-name" placeholder="ชื่อ-นามสกุล"></div>
     <div class="form-group"><label>ชื่อผู้ใช้</label><input type="text" id="new-u-user" placeholder="username (ไม่มีช่องว่าง)"></div>
     <div class="form-group"><label>รหัสผ่าน</label><input type="password" id="new-u-pass" placeholder="อย่างน้อย 4 ตัวอักษร"></div>
     <div class="form-group"><label>บทบาท</label>
       <select id="new-u-role"><option value="user">User (ผู้ใช้ทั่วไป)</option><option value="admin">Admin (ผู้ดูแลระบบ)</option></select>
     </div>`,
    [
      { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
      { text: 'เพิ่ม', fn: () => {
        const name = document.getElementById('new-u-name').value.trim();
        const username = document.getElementById('new-u-user').value.trim();
        const password = document.getElementById('new-u-pass').value;
        const role = document.getElementById('new-u-role').value;
        if (!name || !username || !password) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
        if (password.length < 4) { showToast('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 'error'); return; }
        if (username.includes(' ')) { showToast('ชื่อผู้ใช้ห้ามมีช่องว่าง', 'error'); return; }
        const users = getJSON(USERS_KEY);
        if (users.find(u => u.username === username)) { showToast('ชื่อผู้ใช้นี้ถูกใช้แล้ว', 'error'); return; }
        users.push({ id: uid(), name, username, password, role, created: now() });
        setJSON(USERS_KEY, users);
        addLog('create', currentUser.username, `เพิ่มผู้ใช้: ${username} (${role})`);
        closeModal(); renderUsers();
        showToast('เพิ่มผู้ใช้สำเร็จ', 'success');
      }}
    ]
  );
}

function editUser(id) {
    const users = getJSON(USERS_KEY);
    const u = users.find(x => x.id === id);
        if (!u) return;
        showModal('แก้ไขผู้ใช้งาน',
        `<div class="form-group"><label>ชื่อ-นามสกุล</label><input type="text" id="edit-u-name" value="${escHtml(u.name)}"></div>
        <div class="form-group"><label>รหัสผ่านใหม่ (เว้นว่างถ้าไม่ต้องการเปลี่ยน)</label><input type="password" id="edit-u-pass" placeholder="รหัสผ่านใหม่"></div>
        <div class="form-group"><label>บทบาท</label>
            <select id="edit-u-role">
            <option value="user" ${u.role==='user'?'selected':''}>User</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
            </select></div>`,
    [
      { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
      { text: 'บันทึก', fn: () => {
        u.name = document.getElementById('edit-u-name').value.trim();
        const newPass = document.getElementById('edit-u-pass').value;
        if (newPass) {
          if (newPass.length < 4) { showToast('รหัสผ่านต้องมีอย่างน้อย 4 ตัว', 'error'); return; }
          u.password = newPass;
        }
        u.role = document.getElementById('edit-u-role').value;
        setJSON(USERS_KEY, users);
        addLog('edit', currentUser.username, `แก้ไขผู้ใช้: ${u.username}`);
        closeModal(); renderUsers();
        showToast('แก้ไขสำเร็จ', 'success');
      }}
    ]
  );
}

function deleteUser(id) {
  if (!confirm('ลบผู้ใช้งานนี้?')) return;
  const users = getJSON(USERS_KEY);
  const u = users.find(x => x.id === id);
  setJSON(USERS_KEY, users.filter(x => x.id !== id));
  if (u) addLog('delete', currentUser.username, `ลบผู้ใช้: ${u.username}`);
  renderUsers();
  showToast('ลบผู้ใช้สำเร็จ', 'success');
}

// ==================== LOGS ====================
function renderLogs() {
  const logs = getJSON(LOGS_KEY);
  let html = `<div class="card">
    <div class="card-header">
      <div class="card-title">📝 บันทึกการใช้งานระบบ</div>
      <span class="text-muted text-sm">${logs.length} รายการ</span>
    </div>`;
  if (logs.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">ยังไม่มีบันทึก</div></div>`;
  } else {
    html += `<div style="max-height:600px;overflow-y:auto;">`;
    logs.slice(0, 200).forEach(l => {
      const icons = { login:'🔑', logout:'🚪', upload:'📤', download:'⬇', delete:'🗑', create:'✨', edit:'✏️', view:'👁' };
      html += `<div class="log-entry">
        <span class="log-time">${fmtDate(l.time)}</span>
        <span class="log-user">${escHtml(l.user)}</span>
        <span class="log-action">${icons[l.type]||'•'} ${escHtml(l.action)}</span>
      </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  document.getElementById('page-content').innerHTML = html;
}

// ==================== WATERMARK ====================
function renderWatermark() {
  const wmData = ls(WM_KEY);
  const wmText = ls('edms_wm_text') !== null ? ls('edms_wm_text') : '';
  let html = `<div class="card" style="max-width:500px;">
    <div class="card-header">
      <div class="card-title">📄ตั้งค่าลายน้ำ</div>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:16px;">
      ลายน้ำจะถูกประทับลงบนไฟล์ภาพ (PNG/JPG) โดยอัตโนมัติเมื่ออัพโหลด ไฟล์ Word/Excel จะไม่มีลายน้ำ
    </p>
    <div class="form-group">
      <label>ข้อความลายน้ำ</label>
      <input type="text" id="wm-text-input" value="${escHtml(wmText)}" placeholder="เช่น ลับเฉพาะ, CONFIDENTIAL, ชื่อบริษัท">
    </div>
    <div class="form-group">
      <label>โลโก้/รูปภาพลายน้ำ (ไม่บังคับ)</label>
      <div class="upload-zone" onclick="document.getElementById('wm-file-input').click()" style="padding:20px;">
        <div class="upload-zone-text">คลิกเพื่อเลือกภาพโลโก้</div>
        <div class="upload-zone-hint">PNG หรือ JPG ขนาดเล็ก</div>
      </div>
      <input type="file" id="wm-file-input" accept=".png,.jpg,.jpeg" style="display:none" onchange="loadWatermarkImage(this)">
    </div>`;

  if (wmData) {
    html += `<div style="margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">ลายน้ำปัจจุบัน:</div>
      <img src="${wmData}" style="max-width:120px;max-height:60px;border:1px solid var(--border);border-radius:4px;padding:4px;">
      <button class="btn btn-danger btn-xs" style="margin-left:8px;" onclick="clearWatermark()">ลบ</button>
    </div>`;
  }

  html += `<button class="btn" onclick="saveWatermark()">💾 บันทึกการตั้งค่า</button>
  </div>`;
  document.getElementById('page-content').innerHTML = html;
}

function loadWatermarkImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    ls(WM_KEY, e.target.result);
    renderWatermark();
    showToast('โหลดภาพสำเร็จ', 'success');
  };
  reader.readAsDataURL(file);
}

function clearWatermark() {
  ls(WM_KEY, '');
  renderWatermark();
  showToast('ลบลายน้ำสำเร็จ', 'success');
}

function saveWatermark() {
 const text = document.getElementById('wm-text-input').value; 
  ls('edms_wm_text', text || '');
  addLog('edit', currentUser.username, 'แก้ไขการตั้งค่าลายน้ำ');
  showToast('บันทึกการตั้งค่าสำเร็จ', 'success');
}

// ==================== MODAL ====================
function showModal(title, body, buttons) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.cls || '');
    btn.textContent = b.text;
    btn.onclick = b.fn;
    footer.appendChild(btn);
  });
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.getElementById('preview-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('preview-overlay')) closePreview();
});

// ==================== TOAST ====================
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => container.removeChild(toast), 300);
  }, 3000);
}

// ==================== UTILS ====================
function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getFileIcon(ext) {
  const icons = { pdf:'📄', docx:'📝', doc:'📝', xlsx:'📊', xls:'📊', png:'🖼', jpg:'🖼', jpeg:'🖼' };
  return icons[ext] || '📄';
}

// Enter key login
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('login-username').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

initData();
checkSession().catch(console.error);