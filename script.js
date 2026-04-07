// ==================== SUPABASE CONFIG ====================
const supabaseUrl = 'https://hmslzkhetlqcxnqbtfit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc2x6a2hldGxxY3hucWJ0Zml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTM3MDAsImV4cCI6MjA5MDQyOTcwMH0.53DYgg2MwqDRYf_VPdL4VQ5EOm1BEVmDz2DLLQxdA0Y';

window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

// ==================== CONSTANTS ====================
const SESSION_KEY = 'edms_session';
const PAGE_SIZE = 25;
const SESSION_EXPIRY_MS = 1.5 * 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// Supabase Free Tier Quotas
const SUPABASE_STORAGE_MAX_GB = 1;
const SUPABASE_BANDWIDTH_MAX_GB = 5;

// ==================== UTILS ====================
function ls(k, v) {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
}

function fmtDate(d) {
    const dt = new Date(d);
    return dt.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
        dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(d) {
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
}

function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getFileIcon(ext) {
    const icons = { pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', png: '🖼', jpg: '🖼', jpeg: '🖼' };
    return icons[ext] || '📄';
}

// ==================== LOADING ====================
function toggleLoading(show, text = 'กำลังตรวจสอบสิทธิ์...') {
    let overlay = document.getElementById('global-loading');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-loading';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `<div class="spinner"></div><div class="loading-text" id="loading-msg"></div>`;
        document.body.appendChild(overlay);
    }
    document.getElementById('loading-msg').textContent = text;
    overlay.style.display = show ? 'flex' : 'none';
}

function showFolderLoading(message = 'กำลังโหลดเอกสาร...') {
    return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px;">
        <div class="spinner" style="border-top-color:#000;"></div>
        <div style="font-size:13px;font-weight:500;color:var(--text2);">${message}</div>
    </div>`;
}

function setupSupabaseClient(token) {
    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
    });
}

function getAuthToken() {
    try {
        const raw = ls(SESSION_KEY);
        const session = JSON.parse(raw);
        return session.token || supabaseKey;
    } catch {
        return supabaseKey;
    }
}

// ==================== AUTH ====================
let currentUser = null;
let loginAttempts = {};

async function doLogin() {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    if (!u || !p) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }

    const now = Date.now();
    if (!loginAttempts[u]) loginAttempts[u] = { count: 0, lockUntil: 0 };
    const att = loginAttempts[u];
    if (att.lockUntil > now) {
        const remaining = Math.ceil((att.lockUntil - now) / 1000);
        showToast(`บัญชีถูกล็อค กรุณารอ ${remaining} วินาที`, 'error');
        return;
    }

    toggleLoading(true, 'กำลังเข้าสู่ระบบ...');

    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/issue-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ username: u, password: p })
        });

        const result = await res.json();

        if (!res.ok || result.error) {
            toggleLoading(false);
            att.count++;
            if (att.count >= 5) {
                att.lockUntil = now + 5 * 60 * 1000;
                att.count = 0;
                showToast('ล็อคบัญชี 5 นาที เนื่องจากกรอกผิดเกิน 5 ครั้ง', 'error');
            } else {
                document.getElementById('login-error').style.display = 'block';
                showToast(`รหัสผ่านผิด (${att.count}/5)`, 'error');
            }
            addLogAnon('login_fail', u, `พยายามเข้าสู่ระบบแต่รหัสผิด (ครั้งที่ ${att.count})`);
            return;
        }

        loginAttempts[u] = { count: 0, lockUntil: 0 };
        currentUser = result.user;
        setupSupabaseClient(result.token);

        const session = { id: result.user.id, ts: Date.now(), token: result.token };
        ls(SESSION_KEY, JSON.stringify(session));

        addLog('login', result.user.username, 'เข้าสู่ระบบสำเร็จ');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initApp();
        showToast('ยินดีต้อนรับคุณ ' + result.user.name, 'success');
        toggleLoading(false);

    } catch (err) {
        toggleLoading(false);
        console.error('Login Error:', err);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
}

function doLogout() {
    if (currentUser) addLog('logout', currentUser.username, 'ออกจากระบบ');
    currentUser = null;
    ls(SESSION_KEY, '');

    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });

    document.getElementById('app').style.display = 'none';
    showLoginScreen();
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').style.display = 'none';
}

function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    setTimeout(() => {
        if (document.getElementById('request-account-link')) return;
        const loginBox = document.querySelector('.login-box');
        if (!loginBox) return;
        const el = document.createElement('div');
    }, 100);
}

async function checkSession() {
    const raw = ls(SESSION_KEY);
    if (!raw) { showLoginScreen(); return; }

    let session;
    try { session = JSON.parse(raw); }
    catch { ls(SESSION_KEY, ''); showLoginScreen(); return; }

    if (!session.id || !session.token || (Date.now() - session.ts) > SESSION_EXPIRY_MS) {
        ls(SESSION_KEY, '');
        showLoginScreen();
        if (session.id) showToast('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
        return;
    }

    toggleLoading(true, 'กำลังโหลด...');
    try {
        window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${session.token}` } },
            auth: { persistSession: false }
        });

        const { data: found, error } = await window.supabaseClient
            .from('users')
            .select('id, username, name, role, created_at')
            .eq('id', session.id)
            .single();

        if (found && !error) {
            currentUser = found;
            setupSupabaseClient(session.token);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            initApp();
        } else {
            ls(SESSION_KEY, '');
            showLoginScreen();
        }
    } catch (err) {
        console.error('Session Error:', err);
        ls(SESSION_KEY, '');
        showLoginScreen();
    }
    toggleLoading(false);
}

// ==================== ADMIN CHECK ====================
async function verifyAdminFromDB() {
    const raw = ls(SESSION_KEY);
    if (!raw) return false;
    try {
        const session = JSON.parse(raw);
        const { data, error } = await window.supabaseClient
            .from('users').select('role').eq('id', session.id).single();
        return !error && data?.role === 'admin';
    } catch { return false; }
}

// ==================== AUTO LOGOUT ====================
let _idleTimer = null;

function resetIdleTimer() {
    clearTimeout(_idleTimer);
    if (typeof currentUser === 'undefined' || !currentUser) return;
    _idleTimer = setTimeout(() => {
        showToast('หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่', 'error');
        setTimeout(doLogout, 2000);
    }, IDLE_TIMEOUT_MS);
}

['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
});

// ==================== LOG ====================
async function addLogAnon(type, user, action) {
    try {
        const anonClient = supabase.createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
        });
        await anonClient.from('logs').insert([{ type, user_name: user, action }]);
    } catch (e) { console.warn('Log insert ล้มเหลว:', e.message); }
}

async function addLog(type, user, action) {
    if (!window.supabaseClient) return;
    try {
        await window.supabaseClient.from('logs').insert([{ type, user_name: user, action }]);
    } catch (e) { console.warn('Log insert ล้มเหลว:', e.message); }
}

// ==================== RENDER LOGS (+ Storage Stats) ====================
async function renderLogs() {
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังโหลดบันทึก...');

    const { data: logs, error } = await window.supabaseClient
        .from('logs').select('*').order('created_at', { ascending: false }).limit(200);

    // นับ upload/download จาก logs
    const allLogs = logs || [];
    const uploadCount = allLogs.filter(l => l.type === 'upload').length;
    const downloadCount = allLogs.filter(l => l.type === 'download').length;

    // คำนวณ storage จาก files table
    const { data: filesData } = await window.supabaseClient
        .from('files').select('size');
    const totalBytes = (filesData || []).reduce((s, f) => s + (f.size || 0), 0);
    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const storePct = Math.min(100, Math.round((totalGB / SUPABASE_STORAGE_MAX_GB) * 100));

    const storageBarColor = storePct > 80 ? '#e53e3e' : storePct > 60 ? '#d97706' : '#16a34a';

    let html = `
    <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">📊 สถิติการใช้งานระบบ</div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
            <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">อัพโหลดทั้งหมด</div>
                <div style="font-size:24px;font-weight:600;">⬆️ ${uploadCount}</div>
                <div style="font-size:11px;color:var(--text2);">ครั้ง (200 รายการล่าสุด)</div>
            </div>
            <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">ดาวน์โหลดทั้งหมด</div>
                <div style="font-size:24px;font-weight:600;">⬇️ ${downloadCount}</div>
                <div style="font-size:11px;color:var(--text2);">ครั้ง (200 รายการล่าสุด)</div>
            </div>
            <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">ไฟล์ทั้งหมด</div>
                <div style="font-size:24px;font-weight:600;">🗎 ${(filesData || []).length}</div>
                <div style="font-size:11px;color:var(--text2);">ไฟล์</div>
            </div>
        </div>

        <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:13px;font-weight:500;">พื้นที่จัดเก็บไฟล์ (Storage)</span>
                <span style="font-size:12px;color:var(--text2);">${fmtSize(totalBytes)} / ${SUPABASE_STORAGE_MAX_GB} GB</span>
            </div>
            <div style="background:var(--border);border-radius:99px;height:10px;overflow:hidden;">
                <div style="height:100%;width:${storePct}%;background:${storageBarColor};border-radius:99px;transition:width 0.4s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
                <span style="font-size:11px;color:var(--text2);">ใช้ไปแล้ว ${storePct}%</span>
                <span style="font-size:11px;color:var(--text2);">Supabase Free Tier: ${SUPABASE_STORAGE_MAX_GB} GB</span>
            </div>
            ${storePct > 80 ? `<div style="margin-top:6px;padding:6px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:12px;color:#dc2626;">⚠️ พื้นที่ใกล้เต็ม ควร Upgrade หรือลบไฟล์ที่ไม่ใช้</div>` : ''}
        </div>
    </div>

    <div class="card">
        <div class="card-header"><div class="card-title">📝 บันทึกการใช้งานระบบ</div></div>`;

    if (error || !logs || !logs.length) {
        html += `<div class="empty-state">ยังไม่มีบันทึก</div>`;
    } else {
        html += `<div style="max-height:600px;overflow-y:auto;">`;
        logs.forEach(l => {
            const icons = { login: '🔑', upload: '📤', download: '⬇️', delete: '🗑', view: '👁', edit: '✏️', create: '➕', logout: '🚪' };
            html += `<div class="log-entry">
                <span class="log-time">${fmtDate(l.created_at)}</span>
                <span class="log-user">${escHtml(l.user_name)}</span>
                <span class="log-action">${icons[l.type] || '•'} ${escHtml(l.action)}</span>
            </div>`;
        });
        html += `</div>`;
    }

    content.innerHTML = html + `</div>`;
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
        <div class="nav-item ${currentPage === 'home' ? 'active' : ''}" onclick="navigate('home')">
            <span class="nav-icon"><i class="fa-solid fa-house"></i></span> หน้าแรก
        </div>
        <div class="nav-item ${currentPage === 'dept' ? 'active' : ''}" onclick="navigate('dept')">
            <span class="nav-icon"><i class="fa-solid fa-folder-tree"></i></span> เอกสารฝ่ายต่างๆ
        </div>
        <div class="nav-item ${currentPage === 'central' ? 'active' : ''}" onclick="navigate('central')">
            <span class="nav-icon"><i class="fa-solid fa-file-lines"></i></span> เอกสารส่วนกลาง
        </div>
        <div class="nav-item ${currentPage === 'car' ? 'active' : ''}" onclick="navigate('car')">
            <span class="nav-icon"><i class="fa-solid fa-file-circle-check"></i></span> เอกสาร CAR
        </div>
        <div class="nav-item ${currentPage === 'audit' ? 'active' : ''}" onclick="navigate('audit')">
            <span class="nav-icon"><i class="fa-solid fa-file-contract"></i></span> เอกสารการตรวจติดตาม
        </div>
        <div class="nav-item ${currentPage === 'knowledge' ? 'active' : ''}" onclick="navigate('knowledge')">
            <span class="nav-icon"><i class="fa-solid fa-door-open"></i></span> คลังคู่มือ / ความรู้
        </div>`;

    if (isAdmin) {
        html += `
            <div class="nav-section">จัดการระบบ</div>
            <div class="nav-item ${currentPage === 'users' ? 'active' : ''}" onclick="navigate('users')">
                <span class="nav-icon"><i class="fa-solid fa-users-gear"></i></span> จัดการผู้ใช้
            </div>
            <div class="nav-item ${currentPage === 'logs' ? 'active' : ''}" onclick="navigate('logs')">
                <span class="nav-icon"><i class="fa-solid fa-clock-rotate-left"></i></span> บันทึกการใช้งาน
            </div>
            <div class="nav-item ${currentPage === 'watermark' ? 'active' : ''}" onclick="navigate('watermark')">
                <span class="nav-icon"><i class="fa-solid fa-stamp"></i></span> ตั้งค่าลายน้ำ
            </div>`;
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
        logs: 'บันทึกการใช้งาน', watermark: 'ตั้งค่าลายน้ำ',
        knowledge: 'คลังคู่มือ / เอกสารความรู้'
    };
    document.getElementById('page-title').textContent = titles[page] || page;
    document.getElementById('page-content').innerHTML = '';

    if (page === 'home') renderHome();
    else if (page === 'dept') renderDept(folder, subfolder);
    else if (page === 'central') renderCentral();
    else if (page === 'car') renderYearFolder('car', folder);
    else if (page === 'audit') renderYearFolder('audit', folder);
    else if (page === 'knowledge') renderKnowledge(folder);
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

// ==================== DASHBOARD HELPERS ====================
let _dashKnowledgeAll = [];
let _dashDeptAll = [];

function renderDashboardFileItem(f, section) {
    const ext = (f.name || '').split('.').pop().toLowerCase();
    const icon = getFileIcon(ext);
    const target = section === 'knowledge' ? `navigate('knowledge','${escHtml(f.folder)}')` : `navigate('dept','${escHtml(f.folder)}')`;
    return `<div class="dash-item" onclick="${target}" style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;cursor:pointer;border-bottom:0.5px solid var(--border);">
        <span style="font-size:18px;flex-shrink:0;">${icon}</span>
        <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(f.name)}</div>
            <div style="font-size:11px;color:var(--text2);">ฝ่าย ${escHtml(f.folder)} · ${fmtDateShort(f.created_at)}</div>
        </div>
    </div>`;
}

function showDashMore(section) {
    const list = section === 'knowledge' ? _dashKnowledgeAll : _dashDeptAll;
    const containerId = section === 'knowledge' ? 'dash-knowledge-list' : 'dash-dept-list';
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = list.map(f => renderDashboardFileItem(f, section)).join('');
    const btn = document.getElementById(`dash-${section}-more`);
    if (btn) btn.style.display = 'none';
}

// ==================== HOME / ANNOUNCEMENTS + DASHBOARD ====================
async function renderHome() {
    const isAdmin = currentUser.role === 'admin';
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังโหลดหน้าแรก...');

    // ดึงข้อมูลทั้งหมดพร้อมกัน
    const [
        { data: anns, error: annErr },
        { data: annFiles },
        { data: knowledgeFiles },
        { data: deptFiles },
        { data: logData }
    ] = await Promise.all([
        window.supabaseClient.from('announcements').select('*').order('created_at', { ascending: false }),
        window.supabaseClient.from('files').select('*').eq('section', 'announcement').order('created_at', { ascending: false }),
        window.supabaseClient.from('files').select('id, name, folder, created_at').eq('section', 'knowledge').order('created_at', { ascending: false }).limit(10),
        window.supabaseClient.from('files').select('id, name, folder, doc_type, created_at').eq('section', 'dept').order('created_at', { ascending: false }).limit(10),
        window.supabaseClient.from('logs').select('action, type').or('type.eq.download,type.eq.view').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    // เก็บไว้ใช้ตอน load more
    _dashKnowledgeAll = knowledgeFiles || [];
    _dashDeptAll = deptFiles || [];

    // ===================== ส่วนประกาศ =====================
    let html = `<div class="card" style="margin-bottom:16px;">
        <div class="card-header">
            <div class="card-title">📢 ประกาศและข่าวสาร</div>
            ${isAdmin ? `<button class="btn btn-sm" onclick="showAddAnn()">+ เพิ่มประกาศ</button>` : ''}
        </div>`;

    if (annErr || !anns || !anns.length) {
        html += `<div class="empty-state">ยังไม่มีประกาศ</div>`;
    } else {
        anns.forEach(a => {
            const files = (annFiles || []).filter(f => f.folder === a.id);
            html += `<div class="announcement-item" style="flex-direction:column;align-items:flex-start;gap:8px;">
                <div style="display:flex;justify-content:space-between;width:100%;align-items:flex-start;">
                    <div class="ann-text">${escHtml(a.text)}</div>
                    <div class="ann-date" style="flex-shrink:0;margin-left:12px;">${fmtDateShort(a.created_at)}</div>
                </div>`;

            if (files.length > 0) {
                html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">`;
                files.forEach(f => {
                    const ext = f.name.split('.').pop().toLowerCase();
                    html += `<div style="display:flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;">
                        <span>${getFileIcon(ext)}</span>
                        <span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
                        <button class="btn btn-outline btn-xs" style="padding:1px 6px;" onclick="previewFile('${f.id}')">ดูไฟล์</button>
                        <button class="btn btn-xs" style="padding:1px 6px;" onclick="downloadFile('${f.id}')">ดาวน์โหลดไฟล์</button>
                        ${isAdmin ? `<button class="btn btn-danger btn-xs" style="padding:1px 6px;" onclick="deleteFile('${f.id}')">ลบไฟล์</button>` : ''}
                    </div>`;
                });
                html += `</div>`;
            }

            if (isAdmin) {
                html += `<div style="display:flex;gap:6px;margin-top:4px;">
                    <button class="btn btn-outline btn-xs" onclick="editAnn('${a.id}','${escHtml(a.text).replace(/'/g, "\\'")}')">✏️ แก้ไข</button>
                    <button class="btn btn-outline btn-xs" onclick="showAnnFileUpload('${a.id}')">📎 แนบไฟล์</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteAnn('${a.id}')">🗑 ลบ</button>
                </div>`;
            }
            html += `</div>`;
        });
    }
    html += `</div>`;

    // ===================== DASHBOARD =====================

    // --- คู่มือ/ความรู้ใหม่ ---
    const kShow = _dashKnowledgeAll.slice(0, 3);
    const kHasMore = _dashKnowledgeAll.length > 3;

    html += `<div class="card" style="margin-bottom:16px;padding:0;overflow:hidden;">
        <div class="card-header" style="padding:12px 16px;">
            <div class="card-title">📚 คู่มือ / ความรู้ใหม่ล่าสุด</div>
        </div>
        <div id="dash-knowledge-list">`;

    if (kShow.length === 0) {
        html += `<div class="empty-state" style="padding:16px;">ยังไม่มีเอกสาร</div>`;
    } else {
        kShow.forEach(f => { html += renderDashboardFileItem(f, 'knowledge'); });
    }
    html += `</div>`;
    if (kHasMore) {
        html += `<div id="dash-knowledge-more" onclick="showDashMore('knowledge')"
            style="text-align:center;padding:10px;font-size:13px;color:var(--text2);cursor:pointer;border-top:0.5px solid var(--border);">
            โหลดเพิ่มเติม →</div>`;
    }
    html += `</div>`;

    // --- เอกสารฝ่ายใหม่ ---
    const dShow = _dashDeptAll.slice(0, 3);
    const dHasMore = _dashDeptAll.length > 3;

    html += `<div class="card" style="margin-bottom:16px;padding:0;overflow:hidden;">
        <div class="card-header" style="padding:12px 16px;">
            <div class="card-title">📄 เอกสารใหม่ฝ่ายต่างๆ</div>
        </div>
        <div id="dash-dept-list">`;

    if (dShow.length === 0) {
        html += `<div class="empty-state" style="padding:16px;">ยังไม่มีเอกสาร</div>`;
    } else {
        dShow.forEach(f => { html += renderDashboardFileItem(f, 'dept'); });
    }
    html += `</div>`;
    if (dHasMore) {
        html += `<div id="dash-dept-more" onclick="showDashMore('dept')"
            style="text-align:center;padding:10px;font-size:13px;color:var(--text2);cursor:pointer;border-top:0.5px solid var(--border);">
            โหลดเพิ่มเติม →</div>`;
    }
    html += `</div>`;

    // --- ฝ่ายที่ถูกดู/ดาวน์โหลดมากที่สุด ---
    const deptCount = {};
    (logData || []).forEach(l => {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const match = l.action?.match(/ฝ่าย\s*([^\s·:]+)/);
        if (match && !UUID_RE.test(match[1])) {
        deptCount[match[1]] = (deptCount[match[1]] || 0) + 1;
        }
    });
    const topDepts = Object.entries(deptCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxCount = topDepts[0]?.[1] || 1;

    html += `<div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:12px 16px;">
            <div class="card-title">🏆 เอกสารฝ่ายที่ถูกดู/ดาวน์โหลดมากที่สุด</div>
            <span style="font-size:11px;color:var(--text2);">30 วันล่าสุด</span>
        </div>
        <div style="padding:4px 16px 8px;">`;

    if (topDepts.length === 0) {
        html += `<div class="empty-state" style="padding:16px;">ยังไม่มีข้อมูลการใช้งาน</div>`;
    } else {
        topDepts.forEach(([dept, count], i) => {
            const pct = Math.round((count / maxCount) * 100);
            html += `<div onclick="navigate('dept','${escHtml(dept)}')"
                style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:0.5px solid var(--border);cursor:pointer;">
                <span style="font-size:13px;font-weight:500;color:var(--text2);min-width:18px;">${i + 1}</span>
                <span style="font-size:13px;flex:1;">ฝ่าย ${escHtml(dept)}</span>
                <div style="width:80px;height:6px;background:var(--border);border-radius:99px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:#1D9E75;border-radius:99px;"></div>
                </div>
                <span style="font-size:12px;color:var(--text2);min-width:50px;text-align:right;">${count} ครั้ง</span>
            </div>`;
        });
    }
    html += `</div></div>`;

    content.innerHTML = html;
}

// ==================== ANNOUNCEMENTS ====================
function showAddAnn() {
    showModal('เพิ่มประกาศ',
        `<div class="form-group">
            <label>ข้อความประกาศ</label>
            <textarea id="ann-text" rows="4" style="width:100%;padding:10px;border:1px solid var(--border2);border-radius:var(--radius);font-family:inherit;font-size:14px;resize:vertical;outline:none;"></textarea>
        </div>`,
        [
            { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
            { text: 'บันทึก', fn: async () => {
                const t = document.getElementById('ann-text').value.trim();
                if (!t) { showToast('กรุณากรอกข้อความ', 'error'); return; }
                const { error } = await window.supabaseClient.from('announcements').insert([{ text: t, author: currentUser.username }]);
                if (error) { showToast('เพิ่มประกาศไม่สำเร็จ: ' + error.message, 'error'); return; }
                addLog('create', currentUser.username, 'เพิ่มประกาศใหม่');
                closeModal();
                renderHome();
                showToast('เพิ่มประกาศสำเร็จ', 'success');
            }}
        ]
    );
}

function editAnn(id, currentText) {
    const decoded = currentText
        .replace(/\\'/g, "'").replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    showModal('แก้ไขประกาศ',
        `<div class="form-group">
            <label>ข้อความประกาศ</label>
            <textarea id="ann-text-edit" rows="4" style="width:100%;padding:10px;border:1px solid var(--border2);border-radius:var(--radius);font-family:inherit;font-size:14px;resize:vertical;outline:none;">${escHtml(decoded)}</textarea>
        </div>`,
        [
            { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
            { text: 'บันทึก', fn: async () => {
                const newText = document.getElementById('ann-text-edit').value.trim();
                if (!newText) { showToast('กรุณากรอกข้อความ', 'error'); return; }
                const { error } = await window.supabaseClient.from('announcements').update({ text: newText }).eq('id', id);
                if (error) { showToast('แก้ไขไม่สำเร็จ', 'error'); return; }
                addLog('edit', currentUser.username, 'แก้ไขประกาศ');
                closeModal();
                renderHome();
                showToast('แก้ไขสำเร็จ', 'success');
            }}
        ]
    );
}

async function deleteAnn(id) {
    if (!confirm('ลบประกาศนี้?')) return;
    if (!(await verifyAdminFromDB())) { showToast('ไม่มีสิทธิ์ดำเนินการ', 'error'); return; }
    const { error } = await window.supabaseClient.from('announcements').delete().eq('id', id);
    if (error) { showToast('ลบไม่สำเร็จ', 'error'); return; }
    addLog('delete', currentUser.username, 'ลบประกาศ');
    renderHome();
    showToast('ลบประกาศสำเร็จ', 'success');
}

function showAnnFileUpload(annId) {
    showModal('แนบไฟล์ประกาศ',
        `<div class="upload-zone" id="ann-upload-zone"
            onclick="document.getElementById('ann-file-input').click()"
            ondragover="event.preventDefault();this.classList.add('drag')"
            ondragleave="this.classList.remove('drag')"
            ondrop="handleAnnDrop(event,'${annId}')">
            <div class="upload-zone-icon">📎</div>
            <div class="upload-zone-text">คลิกหรือลากไฟล์มาวางที่นี่</div>
            <div class="upload-zone-hint">Word, Excel, PDF, PNG, JPG</div>
        </div>
        <div id="ann-upload-status"></div>
        <input type="file" id="ann-file-input" multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
            style="display:none"
            onchange="handleAnnFiles(this,'${annId}')">`,
        [{ text: 'ปิด', cls: 'btn-outline', fn: closeModal }]
    );
}

function handleAnnDrop(event, annId) {
    event.preventDefault();
    document.getElementById('ann-upload-zone').classList.remove('drag');
    handleAnnFiles({ files: event.dataTransfer.files }, annId);
}

async function handleAnnFiles(input, annId) {
    const files = Array.from(input.files);
    if (!files.length) return;

    const status = document.getElementById('ann-upload-status');
    if (status) status.innerHTML = '<div style="text-align:center;padding:8px;font-size:13px;">⏳ กำลังอัปโหลด...</div>';

    let done = 0, failed = 0;
    for (const file of files) {
        try {
            const ext = file.name.split('.').pop().toLowerCase();
            const safeName = file.name.replace(/[^\w\s\-_.]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_') || 'file';
            const fileName = `${Date.now()}_${safeName}.${ext}`.replace(/\.\w+\.\w+$/, `.${ext}`);

            const { error: stError } = await window.supabaseClient.storage.from('edms-file').upload(fileName, file);
            if (stError) throw stError;

            const { data: urlData } = window.supabaseClient.storage.from('edms-file').getPublicUrl(fileName);
            const { error: dbError } = await window.supabaseClient.from('files').insert([{
                name: file.name, file_url: urlData.publicUrl,
                uploader_name: currentUser.name, section: 'announcement',
                folder: annId, doc_type: null, size: file.size
            }]);
            if (dbError) throw dbError;
            done++;
        } catch (err) {
            console.error('Ann file upload error:', err);
            failed++;
        }
    }

    if (status) {
        status.innerHTML = `<div style="text-align:center;padding:8px;font-size:13px;">
            ${done > 0 ? `<span style="color:#15803d;">✅ อัปโหลดสำเร็จ ${done} ไฟล์</span>` : ''}
            ${failed > 0 ? `<span style="color:#dc2626;"> ❌ ล้มเหลว ${failed} ไฟล์</span>` : ''}
        </div>`;
    }
    addLog('upload', currentUser.username, `แนบไฟล์ประกาศ ${done} ไฟล์`);
    setTimeout(() => { closeModal(); renderHome(); }, 1000);
}

// ==================== FILE CRUD ====================
async function deleteFile(id) {
    if (!confirm('ยืนยันการลบไฟล์นี้ถาวร?')) return;
    if (!(await verifyAdminFromDB())) { showToast('ไม่มีสิทธิ์ดำเนินการ', 'error'); return; }

    const { data: f } = await window.supabaseClient.from('files').select('*').eq('id', id).single();
    if (!f) return;
    try {
        const fileNameInStorage = f.file_url.split('/').pop();
        await window.supabaseClient.storage.from('edms-file').remove([fileNameInStorage]);
        await window.supabaseClient.from('files').delete().eq('id', id);
        addLog('delete', currentUser.username, `ลบไฟล์: ${f.name}`);
        showToast('ลบไฟล์เรียบร้อย', 'success');
        navigate(currentPage, currentFolder, currentSubfolder);
    } catch (err) {
        showToast('ลบไม่สำเร็จ', 'error');
        console.error(err);
    }
}

async function getCloudFiles(section, folder, subfolder, page = 0) {
    let query = window.supabaseClient
        .from('files')
        .select('id, name, doc_type, uploader_name, created_at, section, folder')
        .eq('section', section)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (folder) query = query.eq('folder', folder);
    if (subfolder && subfolder !== 'ทั้งหมด') query = query.eq('doc_type', subfolder);

    const { data: files, error } = await query;
    return error ? [] : files;
}

// ==================== DEPT ====================
async function renderDept(folder, subfolder) {
    const isAdmin = currentUser.role === 'admin';
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังโหลดเอกสารฝ่าย...');

    if (!folder) {
        try {
            const { data: deptFolders, error: folderErr } = await window.supabaseClient
                .from('folders').select('*').eq('section', 'dept').order('name');
            const { data: allFiles, error: fileErr } = await window.supabaseClient
                .from('files').select('folder').eq('section', 'dept');
            if (folderErr || fileErr) throw folderErr || fileErr;

            let html = '';
            if (isAdmin) {
                html += `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
                    <button class="btn" onclick="showAddFolder('dept')">+ เพิ่มฝ่าย/แผนก</button>
                </div>`;
            }
            html += `<div class="folder-grid">`;
            if (deptFolders && deptFolders.length > 0) {
                deptFolders.forEach(f => {
                    const fileCount = allFiles.filter(file => file.folder === f.name).length;
                    html += `<div class="folder-card" onclick="navigate('dept','${f.name}')">
                        ${isAdmin ? `<button class="folder-delete" onclick="event.stopPropagation();deleteFolder('${f.id}','${f.name}','dept')">✕</button>` : ''}
                        <div class="folder-icon"><i class="fa-solid fa-folder"></i></div>
                        <div class="folder-name">ฝ่าย ${f.name}</div>
                        <div class="folder-count">${fileCount} ไฟล์</div>
                    </div>`;
                });
            } else {
                html += `<div class="empty-state">ยังไม่มีการเพิ่มรายชื่อฝ่าย</div>`;
            }
            content.innerHTML = html + `</div>`;
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
            console.error(err);
        }
    } else {
        try {
            const files = await getCloudFiles('dept', folder, subfolder);
            const DOC_TYPES = ['ทั้งหมด', 'FR', 'WI', 'JD'];
            const activeFilter = subfolder || 'ทั้งหมด';
            let html = `<div class="breadcrumb">
                <a onclick="navigate('dept')">📂 เอกสารฝ่ายต่างๆ</a>
                <span class="sep">›</span>
                <span class="current">ฝ่าย ${folder}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap;">
                <div class="filter-row" style="margin-bottom:0">
                    ${DOC_TYPES.map(t => `<button class="filter-btn ${t === activeFilter ? 'active' : ''}" onclick="navigate('dept','${folder}','${t}')">${t}</button>`).join('')}
                </div>
                ${isAdmin ? `<button class="btn btn-sm" onclick="showUploadModal('dept','${folder}')">+ อัพโหลดไฟล์</button>` : ''}
            </div>`;
            html += renderFileTable(files, isAdmin, 'dept', folder, subfolder);
            content.innerHTML = html;
        } catch (err) {
            console.error('renderDept error:', err);
            content.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาด<br><small>${err.message}</small></div>`;
        }
    }
}


// ==================== FILE TABLE ====================
function renderFileTable(files, isAdmin, section, folder, subfolder, page = 0) {
    if (!files || files.length === 0) {
        return `<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">ยังไม่มีไฟล์</div></div>`;
    }

    let toolbar = '';
    if (isAdmin) {
        toolbar = `<div id="bulk-toolbar" style="display:none;align-items:center;gap:10px;margin-bottom:10px;padding:10px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
            <span id="selected-count" style="font-size:13px;font-weight:600;">เลือก 0 ไฟล์</span>
            <button class="btn btn-danger btn-sm" onclick="deleteSelectedFiles()">🗑 ลบที่เลือก</button>
            <button class="btn btn-outline btn-sm" onclick="clearSelection()">✕ ยกเลิก</button>
        </div>`;
    }

    let html = `<div class="card" style="padding:0;overflow:hidden;">
        <div class="file-table-wrap">
        <table class="file-table">
            <thead><tr>`;

    if (isAdmin) {
        html += `<th style="width:36px;"><input type="checkbox" id="select-all-files" onchange="toggleSelectAll(this)" title="เลือกทั้งหมด"></th>`;
    }

    html += `<th>ประเภทเอกสาร</th><th>ประเภทไฟล์</th><th>ชื่อไฟล์</th>
                <th>วันที่อัพโหลด</th><th>อัพโหลดโดย</th><th>การดำเนินการ</th>
            </tr></thead><tbody>`;

    files.forEach(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        html += `<tr data-file-id="${f.id}">`;
        if (isAdmin) {
            html += `<td><input type="checkbox" class="file-checkbox" value="${f.id}"></td>`;
        }
        html += `
            <td>${f.doc_type ? `<span class="doc-type-badge">${f.doc_type}</span>` : '<span class="text-muted">—</span>'}</td>
            <td><span class="file-type-badge ${ext}">${ext.toUpperCase()}</span></td>
            <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(f.name)}">${escHtml(f.name)}</td>
            <td class="text-muted text-sm">${fmtDateShort(f.created_at)}</td>
            <td class="text-muted text-sm">${escHtml(f.uploader_name || '')}</td>
            <td><div class="actions-cell">
                <button class="btn btn-outline btn-xs" onclick="previewFile('${f.id}')">👁 ดู</button>
                <button class="btn btn-xs" onclick="downloadFile('${f.id}')">ดาวน์โหลด</button>
                ${isAdmin ? `
                    <button class="btn btn-outline btn-xs" onclick="renameFile('${f.id}','${escHtml(f.name).replace(/'/g,"\\'")}')">✏️</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteFile('${f.id}')">🗑</button>
                ` : ''}
            </div></td>
        </tr>`;
    });

    html += `</tbody></table></div></div>`;

    let loadMore = '';
    if (files.length === PAGE_SIZE) {
        loadMore = `<div style="text-align:center;margin-top:12px;">
            <button class="btn btn-sm" onclick="loadMoreFiles('${section}','${folder || ''}','${subfolder || ''}',${page + 1})">
                โหลดเพิ่มเติม...
            </button>
        </div>`;
    }

    return toolbar + html + loadMore;
}

async function loadMoreFiles(section, folder, subfolder, page) {
    const files = await getCloudFiles(section, folder || null, subfolder || null, page);
    const isAdmin = currentUser.role === 'admin';
    const tbody = document.querySelector('.file-table tbody');
    const loadMoreBtn = document.querySelector('[onclick^="loadMoreFiles"]')?.parentElement;

    if (!tbody) return;

    files.forEach(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        const tr = document.createElement('tr');
        tr.dataset.fileId = f.id;
        tr.innerHTML = `
            ${isAdmin ? `<td><input type="checkbox" class="file-checkbox" value="${f.id}"></td>` : ''}
            <td>${f.doc_type ? `<span class="doc-type-badge">${f.doc_type}</span>` : '<span class="text-muted">—</span>'}</td>
            <td><span class="file-type-badge ${ext}">${ext.toUpperCase()}</span></td>
            <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(f.name)}">${escHtml(f.name)}</td>
            <td class="text-muted text-sm">${fmtDateShort(f.created_at)}</td>
            <td class="text-muted text-sm">${escHtml(f.uploader_name || '')}</td>
            <td><div class="actions-cell">
                <button class="btn btn-outline btn-xs" onclick="previewFile('${f.id}')">👁 ดู</button>
                <button class="btn btn-xs" onclick="downloadFile('${f.id}')">ดาวน์โหลด</button>
                ${isAdmin ? `
                    <button class="btn btn-outline btn-xs" onclick="renameFile('${f.id}','${escHtml(f.name).replace(/'/g,"\\'")}')">✏️</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteFile('${f.id}')">🗑</button>
                ` : ''}
            </div></td>`;
        tbody.appendChild(tr);
    });

    if (loadMoreBtn) {
        if (files.length === PAGE_SIZE) {
            loadMoreBtn.innerHTML = `<button class="btn btn-sm" onclick="loadMoreFiles('${section}','${folder}','${subfolder}',${page + 1})">โหลดเพิ่มเติม...</button>`;
        } else {
            loadMoreBtn.remove();
        }
    }
}

// ==================== BULK DELETE ====================
function toggleSelectAll(checkbox) {
    document.querySelectorAll('.file-checkbox').forEach(cb => { cb.checked = checkbox.checked; });
    updateBulkToolbar();
}

function updateBulkToolbar() {
    const checked = document.querySelectorAll('.file-checkbox:checked');
    const toolbar = document.getElementById('bulk-toolbar');
    const countEl = document.getElementById('selected-count');
    if (!toolbar) return;
    if (checked.length > 0) {
        toolbar.style.display = 'flex';
        countEl.textContent = `เลือก ${checked.length} ไฟล์`;
    } else {
        toolbar.style.display = 'none';
    }
    const all = document.querySelectorAll('.file-checkbox');
    const selectAll = document.getElementById('select-all-files');
    if (selectAll) {
        selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
        selectAll.checked = checked.length === all.length && all.length > 0;
    }
}

function clearSelection() {
    document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('select-all-files');
    if (selectAll) selectAll.checked = false;
    updateBulkToolbar();
}

async function deleteSelectedFiles() {
    const checked = Array.from(document.querySelectorAll('.file-checkbox:checked'));
    if (checked.length === 0) return;
    if (!confirm(`ลบ ${checked.length} ไฟล์ที่เลือกถาวร?`)) return;

    const ids = checked.map(cb => cb.value);
    toggleLoading(true, `กำลังลบ ${ids.length} ไฟล์...`);

    let done = 0, failed = 0;
    for (const id of ids) {
        try {
            const { data: f } = await window.supabaseClient.from('files').select('file_url, name').eq('id', id).single();
            if (f) {
                const fileNameInStorage = f.file_url.split('/').pop();
                await window.supabaseClient.storage.from('edms-file').remove([fileNameInStorage]);
                await window.supabaseClient.from('files').delete().eq('id', id);
                addLog('delete', currentUser.username, `ลบไฟล์: ${f.name}`);
                done++;
            }
        } catch (err) { console.error(err); failed++; }
    }

    toggleLoading(false);
    if (done > 0) showToast(`ลบสำเร็จ ${done} ไฟล์`, 'success');
    if (failed > 0) showToast(`ล้มเหลว ${failed} ไฟล์`, 'error');
    navigate(currentPage, currentFolder, currentSubfolder);
}

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('file-checkbox')) updateBulkToolbar();
});

// ==================== RENAME FILE ====================
async function renameFile(id, currentName) {
    const decoded = currentName
        .replace(/\\'/g, "'").replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const ext = decoded.split('.').pop().toLowerCase();
    const nameWithoutExt = decoded.slice(0, decoded.lastIndexOf('.'));

    showModal('แก้ไขชื่อไฟล์',
        `<div class="form-group">
            <label>ชื่อไฟล์ใหม่</label>
            <div style="display:flex;align-items:center;gap:8px;">
                <input type="text" id="rename-input" value="${escHtml(nameWithoutExt)}" style="flex:1;" placeholder="ชื่อไฟล์">
                <span style="font-size:13px;color:var(--text2);white-space:nowrap;background:var(--bg);padding:9px 12px;border:1px solid var(--border2);border-radius:var(--radius);">.${ext}</span>
            </div>
        </div>`,
        [
            { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
            { text: 'บันทึก', fn: async () => {
                const newName = document.getElementById('rename-input').value.trim();
                if (!newName) { showToast('กรุณากรอกชื่อไฟล์', 'error'); return; }
                const fullName = `${newName}.${ext}`;
                const { error } = await window.supabaseClient.from('files').update({ name: fullName }).eq('id', id);
                if (error) { showToast('แก้ไขชื่อไม่สำเร็จ: ' + error.message, 'error'); return; }
                addLog('edit', currentUser.username, `เปลี่ยนชื่อ: ${decoded} → ${fullName}`);
                closeModal();
                showToast('เปลี่ยนชื่อสำเร็จ', 'success');
                const row = document.querySelector(`tr[data-file-id="${id}"]`);
                if (row) {
                    const nameCell = row.cells[isAdmin ? 3 : 2];
                    if (nameCell) { nameCell.textContent = fullName; nameCell.title = fullName; }
                    const renameBtn = row.querySelector('[onclick^="renameFile"]');
                    if (renameBtn) renameBtn.setAttribute('onclick', `renameFile('${id}','${escHtml(fullName).replace(/'/g, "\\'")}') `);
                }
            }}
        ]
    );
    setTimeout(() => { const input = document.getElementById('rename-input'); if (input) { input.focus(); input.select(); } }, 100);
}

// ==================== CENTRAL ====================
async function renderCentral() {
    const isAdmin = currentUser.role === 'admin';
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังโหลดเอกสารส่วนกลาง...');
    const files = await getCloudFiles('central', null, null);
    let html = '';
    if (isAdmin) {
        html += `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
            <button class="btn" onclick="showUploadModal('central',null)">+ อัพโหลดไฟล์</button>
        </div>`;
    }
    html += renderFileTable(files, isAdmin, 'central', null, null);
    content.innerHTML = html;
}

// ==================== CAR / AUDIT ====================
async function renderYearFolder(section, year) {
    const isAdmin = currentUser.role === 'admin';
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังโหลดเอกสาร...');

    if (!year) {
        try {
            const { data: years, error: yErr } = await window.supabaseClient
                .from('folders').select('*').eq('section', section).order('name', { ascending: false });
            const { data: allFiles, error: fErr } = await window.supabaseClient
                .from('files').select('folder').eq('section', section);
            if (yErr || fErr) throw yErr;

            let html = '';
            if (isAdmin) {
                html += `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
                    <button class="btn" onclick="showAddFolder('${section}')">+ เพิ่มปี พ.ศ.</button>
                </div>`;
            }
            html += `<div class="folder-grid">`;
            years.forEach(y => {
                const count = allFiles.filter(f => f.folder === y.name).length;
                html += `<div class="folder-card" onclick="navigate('${section}','${y.name}')">
                    ${isAdmin ? `<button class="folder-delete" onclick="event.stopPropagation();deleteFolder('${y.id}','${y.name}','${section}')">✕</button>` : ''}
                    <div class="folder-icon">📅</div>
                    <div class="folder-name">${y.name}</div>
                    <div class="folder-count">${count} ไฟล์</div>
                </div>`;
            });
            content.innerHTML = html + `</div>`;
        } catch (err) { console.error(err); }
    } else {
        const files = await getCloudFiles(section, year);
        let html = `<div class="breadcrumb">
            <a onclick="navigate('${section}')">${section === 'car' ? 'เอกสาร CAR' : 'เอกสารการตรวจติดตาม'}</a>
            <span class="sep">›</span> <span class="current">${year}</span>
        </div>`;
        if (isAdmin) {
            html += `<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
                <button class="btn btn-sm" onclick="showUploadModal('${section}','${year}')">+ อัพโหลดไฟล์</button>
            </div>`;
        }
        html += renderFileTable(files, isAdmin, section, year, null);
        content.innerHTML = html;
    }
}

// ==================== KNOWLEDGE ====================
async function renderKnowledge(folder) {
    const isAdmin = currentUser.role === 'admin';
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังโหลดคลังความรู้...');

    if (!folder) {
        try {
            const { data: deptFolders, error: folderErr } = await window.supabaseClient
                .from('folders').select('*').eq('section', 'dept').order('name');
            const { data: allFiles } = await window.supabaseClient
                .from('files').select('folder').eq('section', 'knowledge');
            if (folderErr) throw folderErr;

            let html = `<div class="folder-grid">`;
            if (deptFolders && deptFolders.length > 0) {
                deptFolders.forEach(f => {
                    const fileCount = (allFiles || []).filter(file => file.folder === f.name).length;
                    html += `<div class="folder-card" onclick="navigate('knowledge','${f.name}')">
                        <div class="folder-icon"><i class="fa-solid fa-book"></i></div>
                        <div class="folder-name">ฝ่าย ${escHtml(f.name)}</div>
                        <div class="folder-count">${fileCount} ไฟล์</div>
                    </div>`;
                });
            } else {
                html += `<div class="empty-state">ยังไม่มีฝ่าย — ให้ Admin เพิ่มโฟลเดอร์ในเมนูเอกสารฝ่ายต่างๆ ก่อน</div>`;
            }
            content.innerHTML = html + `</div>`;
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
            console.error(err);
        }
    } else {
        const files = await getCloudFiles('knowledge', folder, null);
        let html = `<div class="breadcrumb">
            <a onclick="navigate('knowledge')">📚 คลังคู่มือ / ความรู้</a>
            <span class="sep">›</span>
            <span class="current">ฝ่าย ${escHtml(folder)}</span>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
            <button class="btn btn-sm" onclick="showUploadModal('knowledge','${folder}')">+ อัพโหลดไฟล์</button>
        </div>`;
        html += renderFileTable(files, isAdmin, 'knowledge', folder, null);
        content.innerHTML = html;
    }
}

// ==================== FOLDER MANAGEMENT ====================
function showAddFolder(section) {
    const label = section === 'dept' ? 'ชื่อฝ่าย/แผนก' : 'ปีพุทธศักราช (เช่น 2568)';
    showModal('เพิ่มโฟลเดอร์',
        `<div class="form-group">
            <label>${label}</label>
            <input type="text" id="new-folder-name" placeholder="${label}">
        </div>`,
        [
            { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
            { text: 'เพิ่ม', fn: async () => {
                const name = document.getElementById('new-folder-name').value.trim();
                if (!name) { showToast('กรุณากรอกชื่อ', 'error'); return; }
                const { error } = await window.supabaseClient.from('folders').insert([{ name, section }]);
                if (error) { showToast('เพิ่มไม่สำเร็จ หรือชื่อซ้ำ', 'error'); return; }
                closeModal();
                showToast('เพิ่มสำเร็จ', 'success');
                navigate(currentPage);
            }}
        ]
    );
}

async function deleteFolder(id, name) {
    if (!confirm(`ลบโฟลเดอร์ "${name}" ถาวร?\n(ไฟล์ภายในจะไม่ถูกลบ แต่จะหาไม่เจอ)`)) return;
    const { error } = await window.supabaseClient.from('folders').delete().eq('id', id);
    if (error) { showToast('ลบไม่สำเร็จ', 'error'); return; }
    showToast('ลบโฟลเดอร์สำเร็จ', 'success');
    navigate(currentPage);
}

// ==================== UPLOAD ====================
let pendingFiles = [];

function showUploadModal(section, folder) {
    pendingFiles = [];
    const isDocType = section === 'dept';
    const DOC_TYPES = ['FR', 'WI', 'JD'];

    let body = `<div class="watermark-note">
            <i class="fa-solid fa-file-shield"></i>ลายน้ำจะถูกประทับลงไฟล์ PDF และ PNG/JPG โดยอัตโนมัติ
        </div>
        <div style="color:#e53e3e;font-size:13px;margin:10px 0 10px 10px;font-weight:500;">
            <i class="fa-solid fa-circle-exclamation"></i> หากต้องการลบไฟล์ที่อัพโหลดโปรดแจ้งเจ้าหน้าที่ DCC จ้า
        </div>`;

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
        ondrop="handleDrop(event,'${section}','${folder || ''}')">
        <div class="upload-zone-icon">📤</div>
        <div class="upload-zone-text">คลิกหรือลากไฟล์มาวางที่นี่</div>
        <div class="upload-zone-hint">Word, Excel, PDF, PNG, JPG (เลือกได้หลายไฟล์)</div>
    </div>
    <div id="upload-file-list"></div>
    <input type="file" id="file-input-upload" multiple
        accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg" style="display:none"
        onchange="handleFileSelect(this,'${section}','${folder || ''}')">`;

    showModal('อัพโหลดไฟล์', body, [
        { text: 'ยกเลิก', cls: 'btn-outline', fn: () => { pendingFiles = []; closeModal(); } },
        { text: 'อัพโหลด', fn: () => confirmUpload(section, folder) }
    ]);
}


function handleDrop(event, section, folder) {
    event.preventDefault();
    document.getElementById('upload-zone').classList.remove('drag');
    processFiles(Array.from(event.dataTransfer.files), section, folder);
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

async function confirmUpload(section, folder) {
    if (pendingFiles.length === 0) { showToast('กรุณาเลือกไฟล์', 'error'); return; }
    const docType = document.getElementById('upload-doc-type')?.value || null;
    closeModal();

    const wmConfig = await getWatermarkConfig();
    const total = pendingFiles.length;

    for (let idx = 0; idx < pendingFiles.length; idx++) {
        const item = pendingFiles[idx];
        const fileLabel = `[${idx + 1}/${total}] ${item.name}`;
        updateProgressToast(fileLabel, 0);

        try {
            const fileData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(item.file);
            });

            updateProgressToast(fileLabel, 5);
            const safeName = item.name.replace(/[^\w\s\-_.]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_') || 'file';
            const fileName = `${Date.now()}_${safeName}`;
            const needsWatermark = ['pdf', 'png', 'jpg', 'jpeg'].includes(item.ext);
            let finalDataUrl = fileData;

            if (needsWatermark) {
                updateProgressToast(fileLabel, 10, 'กำลังประทับลายน้ำ...');
                finalDataUrl = await new Promise(resolve => {
                    if (item.ext === 'pdf') applyPdfWatermark(fileData, resolve, wmConfig);
                    else applyImageWatermark(fileData, resolve, wmConfig);
                });
            }

            updateProgressToast(fileLabel, 20, 'กำลังเตรียมไฟล์...');
            const blob = await (await fetch(finalDataUrl)).blob();

            await uploadWithProgress('edms-file', fileName, blob, (pct) => {
                updateProgressToast(fileLabel, 20 + Math.round(pct * 0.7));
            });

            updateProgressToast(fileLabel, 95, 'กำลังบันทึกข้อมูล...');
            const { data: urlData } = window.supabaseClient.storage.from('edms-file').getPublicUrl(fileName);
            await window.supabaseClient.from('files').insert([{
                name: item.name, file_url: urlData.publicUrl,
                uploader_name: currentUser.name, section, folder,
                doc_type: docType, size: blob.size
            }]);

            addLog('upload', currentUser.username, `อัปโหลด: ${item.name}`);
            updateProgressToast(fileLabel, 100, null, 'success');
            await new Promise(r => setTimeout(r, 600));

        } catch (err) {
            console.error(err);
            updateProgressToast(fileLabel, 0, 'อัปโหลดล้มเหลว', 'error');
            await new Promise(r => setTimeout(r, 1500));
        }
        removeProgressToast();
    }

    pendingFiles = [];
    navigate(currentPage, currentFolder, currentSubfolder);
}

// ==================== UPLOAD WITH PROGRESS ====================
function uploadWithProgress(bucket, fileName, blob, onProgress) {
    return new Promise((resolve, reject) => {
        const supabaseStorageUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(fileName)}`;
        const xhr = new XMLHttpRequest();
        xhr.open('POST', supabaseStorageUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${getAuthToken()}`);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
            }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        const formData = new FormData();
        formData.append('', blob, fileName);
        xhr.send(formData);
    });
}

// ==================== PROGRESS TOAST ====================
let _progressToastEl = null;

function updateProgressToast(fileName, pct, label, state) {
    if (!_progressToastEl) {
        _progressToastEl = document.createElement('div');
        _progressToastEl.className = 'toast toast-progress';
        _progressToastEl.style.cssText = 'min-width:280px;max-width:340px;padding:12px 16px;pointer-events:none;';
        document.getElementById('toast-container').appendChild(_progressToastEl);
    }
    const icon = state === 'success' ? '✅' : state === 'error' ? '❌' : '📤';
    const barColor = state === 'success' ? '#48bb78' : state === 'error' ? '#fc8181' : '#4299e1';
    const displayLabel = label || (pct < 20 ? 'กำลังเตรียมไฟล์...' : pct < 90 ? 'กำลังอัปโหลด...' : pct < 100 ? 'กำลังบันทึก...' : 'เสร็จสิ้น!');
    _progressToastEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
            <span>${icon}</span>
            <span style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;" title="${escHtml(fileName)}">${escHtml(fileName)}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">${displayLabel}</div>
        <div style="background:rgba(0,0,0,0.1);border-radius:99px;height:6px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:width 0.2s ease;"></div>
        </div>
        <div style="text-align:right;font-size:11px;font-weight:700;margin-top:4px;color:${barColor};">${pct}%</div>`;
}

function removeProgressToast() {
    if (_progressToastEl) {
        _progressToastEl.style.opacity = '0';
        _progressToastEl.style.transition = 'opacity 0.3s';
        setTimeout(() => { _progressToastEl?.remove(); _progressToastEl = null; }, 300);
    }
}

// ==================== SIGNED URL ====================
async function getSignedUrl(fileUrl) {
    const fileName = decodeURIComponent(fileUrl.split('/').pop());
    const { data, error } = await window.supabaseClient.storage
        .from('edms-file').createSignedUrl(fileName, 300);
    if (error) return fileUrl;
    return data.signedUrl;
}

// ==================== FILE PREVIEW & DOWNLOAD ====================
async function previewFile(id) {
    const { data: f } = await window.supabaseClient.from('files').select('*').eq('id', id).single();
    if (!f) { showToast('ไม่พบไฟล์', 'error'); return; }

   const folderLabel = (f.section === 'announcement' || !f.folder) ? '' : ` · ฝ่าย ${f.folder}`;
addLog('view', currentUser.username, `ดูไฟล์: ${f.name}${folderLabel}`);
    document.getElementById('preview-title').textContent = f.name;
    const frame = document.getElementById('preview-frame');
    const ext = f.name.split('.').pop().toLowerCase();

    const signedUrl = await getSignedUrl(f.file_url);
    if (['png', 'jpg', 'jpeg'].includes(ext)) {
        frame.innerHTML = `<img src="${signedUrl}" style="max-height:480px;object-fit:contain;">`;
    } else if (ext === 'pdf') {
        frame.innerHTML = `<iframe src="${signedUrl}" style="width:100%;height:100%;border:none;border-radius:6px;"></iframe>`;
    } else {
        frame.innerHTML = `<div style="text-align:center;padding:40px;">
            <div style="font-size:48px;">${getFileIcon(ext)}</div>
            <div style="margin-top:12px;">${escHtml(f.name)}</div>
            <button class="btn mt-16" onclick="downloadFile('${id}')">ดาวน์โหลด</button>
        </div>`;
    }
    document.getElementById('preview-download-btn').onclick = () => downloadFile(id);
    document.getElementById('preview-overlay').classList.add('show');
}

async function downloadFile(id) {
    const { data: f } = await window.supabaseClient.from('files').select('*').eq('id', id).single();
    if (!f) { showToast('ไม่พบไฟล์', 'error'); return; }
    const folderLabel = (f.section === 'announcement' || !f.folder) ? '' : ` · ฝ่าย ${f.folder}`;
addLog('download', currentUser.username, `ดาวน์โหลด: ${f.name}${folderLabel}`);
    try {
        showToast('⏳ กำลังดาวน์โหลด...', '');
        const signedUrl = await getSignedUrl(f.file_url);
        const response = await fetch(signedUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        showToast('ดาวน์โหลดสำเร็จ', 'success');
    } catch (err) {
        console.error(err);
        showToast('ดาวน์โหลดล้มเหลว', 'error');
    }
}

function closePreview() {
    document.getElementById('preview-overlay').classList.remove('show');
    document.getElementById('preview-frame').innerHTML = '';
}

// ==================== GLOBAL SEARCH ====================
async function globalSearch(q) {
    if (!q.trim()) return;
    const isAdmin = currentUser.role === 'admin';
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังค้นหา...');

    const { data: files, error } = await window.supabaseClient
        .from('files').select('id, name, doc_type, uploader_name, created_at, section, folder')
        .or(`name.ilike.%${q}%,folder.ilike.%${q}%,doc_type.ilike.%${q}%`);

    document.getElementById('page-title').textContent = `ผลการค้นหา: "${q}"`;
    if (error || !files || !files.length) {
        content.innerHTML = `<div class="empty-state">ไม่พบไฟล์</div>`;
    } else {
        content.innerHTML = `<div style="margin-bottom:12px;">พบ ${files.length} ไฟล์</div>` + renderFileTable(files, isAdmin);
    }
}

// ==================== USERS ====================
async function renderUsers() {
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังโหลดผู้ใช้...');
    const { data: users, error } = await window.supabaseClient.from('users').select('*').order('name');
    if (error) { showToast('เกิดข้อผิดพลาดในการโหลดผู้ใช้', 'error'); return; }

    let html = `<div class="card">
        <div class="card-header">
            <div class="card-title">👥 จัดการผู้ใช้งาน (${users.length} บัญชี)</div>
            <button class="btn btn-sm" onclick="showAddUser()">+ เพิ่มผู้ใช้</button>
        </div>
        <div class="file-table-wrap">
        <table class="file-table">
            <thead><tr>
                <th>ชื่อ</th><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>วันที่สร้าง</th><th>การดำเนินการ</th>
            </tr></thead>
            <tbody>`;
    users.forEach(u => {
        html += `<tr>
            <td>${escHtml(u.name)}</td>
            <td><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;">${escHtml(u.username)}</span></td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role === 'admin' ? 'Admin' : 'User'}</span></td>
            <td class="text-muted text-sm">${fmtDateShort(u.created_at)}</td>
            <td><div class="actions-cell">
                ${u.id !== currentUser.id
                    ? `<button class="btn btn-outline btn-xs" onclick="editUser('${u.id}')">✏️ แก้ไข</button>
                       <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">🗑 ลบ</button>`
                    : '<span class="text-muted text-sm">(บัญชีปัจจุบัน)</span>'}
            </div></td>
        </tr>`;
    });
    html += `</tbody></table></div></div>`;
    document.getElementById('page-content').innerHTML = html;
}

// ==================== USER MANAGEMENT ====================
const EDGE_FN_URL = `${supabaseUrl}/functions/v1/manage-user`;

async function callManageUser(action, payload) {
    const raw = ls(SESSION_KEY);
    let requesterId = '';
    try { requesterId = JSON.parse(raw).id; } catch { requesterId = raw; }

    const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ action, payload, requesterId })
    });
    return await res.json();
}

function showAddUser() {
    showModal('เพิ่มผู้ใช้งาน',
        `<div class="form-group"><label>ชื่อ-นามสกุล</label>
            <input type="text" id="new-u-name" placeholder="ชื่อ-นามสกุล"></div>
         <div class="form-group"><label>ชื่อผู้ใช้</label>
            <input type="text" id="new-u-user" placeholder="username"></div>
         <div class="form-group"><label>รหัสผ่าน</label>
            <input type="password" id="new-u-pass" placeholder="อย่างน้อย 4 ตัวอักษร"></div>
         <div class="form-group"><label>บทบาท</label>
             <select id="new-u-role">
                 <option value="user">User (ทั่วไป)</option>
                 <option value="admin">Admin (ผู้ดูแล)</option>
             </select>
         </div>`,
        [
            { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
            { text: 'เพิ่ม', fn: async () => {
                const name = document.getElementById('new-u-name').value.trim();
                const username = document.getElementById('new-u-user').value.trim();
                const password = document.getElementById('new-u-pass').value;
                const role = document.getElementById('new-u-role').value;
                if (!name || !username || !password) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
                if (password.length < 4) { showToast('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 'error'); return; }
                toggleLoading(true, 'กำลังเพิ่มผู้ใช้...');
                const result = await callManageUser('create', { name, username, password, role });
                toggleLoading(false);
                if (result.error) { showToast('ผิดพลาด: ' + result.error, 'error'); return; }
                addLog('create', currentUser.username, `เพิ่มผู้ใช้: ${username}`);
                closeModal();
                renderUsers();
                showToast('เพิ่มผู้ใช้สำเร็จ', 'success');
            }}
        ]
    );
}

async function editUser(id) {
    const { data: u } = await window.supabaseClient
        .from('users').select('id, name, username, role').eq('id', id).single();
    if (!u) return;

    showModal('แก้ไขผู้ใช้งาน',
        `<div class="form-group"><label>ชื่อ-นามสกุล</label>
            <input type="text" id="edit-u-name" value="${escHtml(u.name)}"></div>
         <div class="form-group"><label>รหัสผ่านใหม่ (เว้นว่างได้)</label>
            <input type="password" id="edit-u-pass"></div>
         <div class="form-group"><label>บทบาท</label>
             <select id="edit-u-role">
                 <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                 <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
             </select>
         </div>`,
        [
            { text: 'ยกเลิก', cls: 'btn-outline', fn: closeModal },
            { text: 'บันทึก', fn: async () => {
                const name = document.getElementById('edit-u-name').value.trim();
                const pass = document.getElementById('edit-u-pass').value;
                const role = document.getElementById('edit-u-role').value;
                if (!name) { showToast('กรุณากรอกชื่อ', 'error'); return; }
                toggleLoading(true, 'กำลังบันทึก...');
                const result = await callManageUser('update', { id, name, role, password: pass || null });
                toggleLoading(false);
                if (result.error) { showToast('ผิดพลาด: ' + result.error, 'error'); return; }
                addLog('edit', currentUser.username, `แก้ไขผู้ใช้: ${u.username}`);
                closeModal();
                renderUsers();
                showToast('แก้ไขสำเร็จ', 'success');
            }}
        ]
    );
}

async function deleteUser(id) {
    if (!confirm('ลบผู้ใช้นี้ถาวร?')) return;
    toggleLoading(true, 'กำลังลบ...');
    const result = await callManageUser('delete', { id });
    toggleLoading(false);
    if (result.error) { showToast('ผิดพลาด: ' + result.error, 'error'); return; }
    addLog('delete', currentUser.username, 'ลบผู้ใช้');
    renderUsers();
    showToast('ลบสำเร็จ', 'success');
}

// ==================== WATERMARK SETTINGS ====================
let _wmCache = null;
let _wmCacheTime = 0;

async function getWatermarkConfig() {
    const t = Date.now();
    if (_wmCache !== null && (t - _wmCacheTime) < 30000) return _wmCache;
    try {
        const { data: wm } = await window.supabaseClient
            .from('watermark_settings').select('*').eq('id', 'current_config').single();
        _wmCache = wm || { wm_text: '', wm_img_url: '' };
        _wmCacheTime = t;
    } catch {
        _wmCache = { wm_text: '', wm_img_url: '' };
    }
    return _wmCache;
}

async function renderWatermark() {
    const content = document.getElementById('page-content');
    content.innerHTML = showFolderLoading('กำลังดึงข้อมูลลายน้ำ...');

    const { data: wm } = await window.supabaseClient
        .from('watermark_settings').select('*').eq('id', 'current_config').single();
    const wmText = wm?.wm_text || '';
    const wmData = wm?.wm_img_url || '';

    content.innerHTML = `
    <div class="card" style="max-width:520px;">
        <div class="card-header"><div class="card-title">📄 ตั้งค่าลายน้ำส่วนกลาง</div></div>
        <p style="font-size:13px;color:var(--text2);margin-bottom:16px;">
            ลายน้ำจะถูกประทับอัตโนมัติในทุกไฟล์ PDF และรูปภาพที่อัพโหลด
        </p>
        <div class="form-group">
            <label>ข้อความลายน้ำ <span style="font-size:11px;color:var(--text2)">(เว้นว่างได้)</span></label>
            <input type="text" id="wm-text-input" value="${escHtml(wmText)}" placeholder="เช่น ลับเฉพาะ, CONFIDENTIAL">
        </div>
        <div class="form-group">
            <label>โลโก้ลายน้ำ <span style="font-size:11px;color:var(--text2)">(เว้นว่างได้)</span></label>
            <div class="upload-zone" onclick="document.getElementById('wm-file-input').click()" style="padding:20px;">
                <div class="upload-zone-text">คลิกเพื่อเลือกรูปโลโก้</div>
            </div>
            <input type="file" id="wm-file-input" accept=".png,.jpg,.jpeg" style="display:none" onchange="previewWatermarkImage(this)">
        </div>
        <div id="wm-preview-area" style="margin-bottom:16px;display:flex;align-items:center;gap:10px;">
            ${wmData
                ? `<img src="${wmData}" id="wm-img-preview" style="width:150px;max-height:60px;object-fit:contain;border:1px solid var(--border);padding:4px;border-radius:4px;">
                    <button class="btn btn-danger btn-xs" onclick="clearWatermarkPreview()">✕ ลบรูปภาพ</button>`
                : `<span style="font-size:13px;color:var(--text2)">ยังไม่มีโลโก้</span>`}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn" onclick="saveWatermarkToCloud()">💾 บันทึก</button>
            <button class="btn btn-danger btn-outline" onclick="clearAllWatermark()">🗑 ลบลายน้ำทั้งหมด</button>
        </div>
    </div>`;
}

function previewWatermarkImage(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('wm-preview-area').innerHTML =
            `<div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
                <img src="${e.target.result}" id="wm-img-preview"
                    style="width:150px;object-fit:contain;border:1px solid var(--border);padding:4px;border-radius:4px;background:#f9f9f9;">
                <button class="btn btn-danger btn-xs" onclick="clearWatermarkPreview()">✕ ลบรูปภาพ</button>
            </div>`;
    };
    reader.readAsDataURL(file);
}

function clearWatermarkPreview() {
    document.getElementById('wm-preview-area').innerHTML =
        `<span style="font-size:13px;color:var(--text2)">ยังไม่มีโลโก้</span>`;
}

async function saveWatermarkToCloud() {
    const text = document.getElementById('wm-text-input').value.trim();
    const imgElement = document.getElementById('wm-img-preview');
    let imgData = '';
    if (imgElement && imgElement.tagName === 'IMG') {
        const src = imgElement.src;
        if (src.startsWith('data:image/') || src.startsWith('http')) imgData = src;
    }

    toggleLoading(true, 'กำลังบันทึกลายน้ำลง Cloud...');
    const { error } = await window.supabaseClient.from('watermark_settings').upsert({
        id: 'current_config', wm_text: text, wm_img_url: imgData,
        updated_by: currentUser.username, updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    _wmCache = null; _wmCacheTime = 0;
    await getWatermarkConfig();
    toggleLoading(false);

    if (error) { showToast('บันทึกล้มเหลว: ' + error.message, 'error'); }
    else { showToast('บันทึกลายน้ำสำเร็จ', 'success'); addLog('edit', currentUser.username, 'แก้ไขลายน้ำส่วนกลาง'); renderWatermark(); }
}

async function clearAllWatermark() {
    if (!confirm('ลบลายน้ำทั้งหมด (ข้อความและรูปภาพ)?')) return;
    toggleLoading(true, 'กำลังลบลายน้ำ...');
    _wmCache = null; _wmCacheTime = 0;

    const { error } = await window.supabaseClient.from('watermark_settings').upsert({
        id: 'current_config', wm_text: '', wm_img_url: '',
        updated_by: currentUser.username, updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    await getWatermarkConfig();
    toggleLoading(false);

    if (error) { showToast('ลบล้มเหลว: ' + error.message, 'error'); }
    else { showToast('ลบลายน้ำสำเร็จ', 'success'); addLog('edit', currentUser.username, 'ลบลายน้ำส่วนกลาง'); renderWatermark(); }
}

// ==================== WATERMARK ENGINE ====================
async function applyPdfWatermark(dataUrl, callback, wmConfig) {
    const wm = wmConfig || await getWatermarkConfig();
    const wmText = wm?.wm_text || '';
    const wmData = wm?.wm_img_url || '';
    if (!wmData && !wmText.trim()) { callback(dataUrl); return; }

    try {
        const base64String = dataUrl.split(',')[1];
        const binaryString = atob(base64String);
        const existingPdfBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) existingPdfBytes[i] = binaryString.charCodeAt(i);

        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();

        let embeddedImage = null;
        if (wmData) {
            try {
                embeddedImage = wmData.startsWith('data:image/png')
                    ? await pdfDoc.embedPng(wmData)
                    : await pdfDoc.embedJpg(wmData);
            } catch (e) { console.error('Embed Image Error:', e); }
        }

        for (const page of pages) {
            const { width, height } = page.getSize();
            if (embeddedImage) {
                const imgDims = embeddedImage.scale(1);
                const scale = Math.min((width * 0.75) / imgDims.width, (height * 0.75) / imgDims.height);
                const w = imgDims.width * scale;
                const h = imgDims.height * scale;
                page.drawImage(embeddedImage, {
                    x: (width / 2) - (w / 2) * Math.cos(Math.PI / 6) + (h / 2) * Math.sin(Math.PI / 6),
                    y: (height / 2) - (h / 2) * Math.cos(Math.PI / 6) - (w / 2) * Math.sin(Math.PI / 6),
                    width: w, height: h, rotate: PDFLib.degrees(30), opacity: 0.08,
                });
            }
            if (wmText.trim()) {
                const canvas = document.createElement('canvas');
                canvas.width = width * 2; canvas.height = height * 2;
                const ctx = canvas.getContext('2d');
                ctx.scale(2, 2);
                drawTextWatermarkFull(ctx, width, height, wmText.trim());
                const textImgData = canvas.toDataURL('image/png');
                const embeddedText = await pdfDoc.embedPng(textImgData);
                page.drawImage(embeddedText, { x: 0, y: 0, width, height });
            }
        }
        const pdfBytes = await pdfDoc.saveAsBase64({ dataUri: true });
        callback(pdfBytes);
    } catch (err) {
        console.error('PDF Watermark Error:', err);
        callback(dataUrl);
    }
}

function applyImageWatermark(dataUrl, callback, wmConfig) {
    const applyWithConfig = (wm) => {
        const wmText = wm?.wm_text || '';
        const wmData = wm?.wm_img_url || '';
        if (!wmData && !wmText.trim()) { callback(dataUrl); return; }

        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const finish = () => {
                if (wmText.trim()) drawTextWatermarkFull(ctx, img.width, img.height, wmText.trim());
                callback(canvas.toDataURL('image/jpeg', 0.9));
            };

            if (wmData) {
                const logo = new Image();
                logo.onload = () => {
                    ctx.save();
                    ctx.globalAlpha = 0.08;
                    const scale = Math.min((img.width * 0.75) / logo.width, (img.height * 0.75) / logo.height);
                    ctx.translate(img.width / 2, img.height / 2);
                    ctx.rotate(-Math.PI / 6);
                    ctx.drawImage(logo, -(logo.width * scale) / 2, -(logo.height * scale) / 2, logo.width * scale, logo.height * scale);
                    ctx.restore();
                    finish();
                };
                logo.onerror = () => finish();
                logo.src = wmData;
            } else { finish(); }
        };
        img.onerror = () => callback(dataUrl);
    };

    if (wmConfig) applyWithConfig(wmConfig);
    else getWatermarkConfig().then(applyWithConfig);
}

function drawTextWatermarkFull(ctx, w, h, text) {
    ctx.save();
    const fontSize = Math.max(24, Math.floor(Math.min(w, h) * 0.07));
    ctx.font = `bold ${fontSize}px 'Sarabun', 'Helvetica', sans-serif`;
    ctx.fillStyle = 'rgba(150, 150, 150, 0.25)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(text, 0, 0);
    ctx.restore();
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
        setTimeout(() => { if (container.contains(toast)) container.removeChild(toast); }, 300);
    }, 3000);
}

// ==================== INIT ====================
document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
});
document.getElementById('login-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
});

checkSession().catch(console.error);
