(() => {
  'use strict';

  const APP = 'AI Face Recognition Attendance System';
  const STORAGE = 'aifras-demo-v2';
  const routes = ['dashboard','students','recognition','attendance','reports','settings'];

  const seedStudents = [];
  const seedActivities = [];
  const seedAttendance = [];

  const state = loadState();
  let stream = null;
  let registrationStream = null;
  let sessionStartedAt = null;
  let sessionTimer = null;

  function loadState() {
    try { const raw=localStorage.getItem(STORAGE); if(raw) return JSON.parse(raw); } catch (_) {}
    return {loggedIn:false,role:'Admin',user:'Administrator',theme:'light',students:[],attendance:[],activities:[]};
  }
  function save() { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  const API='/api';
  async function apiFetch(path,options={}){
    const r=await fetch(API+path,options); const t=await r.text(); let d={};
    try{d=t?JSON.parse(t):{};}catch(_){d={detail:t};}
    if(!r.ok)throw new Error(d.detail||d.message||`Request failed (${r.status})`);
    return d;
  }
  async function syncBackendData(){
    const [students,attendance,activities]=await Promise.all([apiFetch('/students'),apiFetch('/attendance'),apiFetch('/activities')]);
    state.students=students; state.attendance=attendance; state.activities=activities;
  }
  async function backendHealth(){return apiFetch('/health');}
 { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function initials(name) { return name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
  function today() { return new Date().toISOString().slice(0,10); }
  function fmtDate(d) { const x=new Date(d+'T00:00:00'); return x.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
  function nowTime() { return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }
  function canManage() { return state.role === 'Admin'; }
  function navIcon(type) {
    const paths={
      dashboard:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
      students:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      recognition:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M15 10h3M15 14h3"/>',
      attendance:'<path d="M6 3v4M18 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="m8 14 2 2 5-5"/>',
      reports:'<path d="M4 19V5M4 19h17M8 16v-4M12 16V8M16 16V6M20 16v-3"/>',
      settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 3.5 11H3.3a2 2 0 0 1 0-4h.2A2 2 0 0 0 5 3.6l-.1-.1A2 2 0 1 1 7.7.7l.1.1A2 2 0 0 0 11.2 0h.2a2 2 0 0 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 23 7h.2a2 2 0 0 1 0 4H23a2 2 0 0 0-1.4 3.4Z"/>',
      menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
      sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
      moon:'<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z"/>',
      search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      arrow:'<path d="m9 18 6-6-6-6"/>',
      back:'<path d="m15 18-6-6 6-6"/>',
      camera:'<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
      check:'<path d="m5 12 4 4L19 6"/>',
      trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
      edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      logout:'<path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/>'
    };
    return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type]||''}</svg>`;
  }

  function logoMarkup(light=false) {
    return `<div class="logo"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 3.5c6.4 0 11.5 4.7 11.5 10.7 0 8.2-5.1 14.3-11.5 14.3S4.5 22.4 4.5 14.2C4.5 8.2 9.6 3.5 16 3.5Z" stroke="${light?'white':'currentColor'}" stroke-width="1.8"/><path d="M10.5 13.2c1.3-1.5 3.2-2.3 5.5-2.3s4.2.8 5.5 2.3M11.2 17.5h.1M20.7 17.5h.1M12.7 22c2.1 1.2 4.5 1.2 6.6 0" stroke="${light?'white':'currentColor'}" stroke-width="1.8" stroke-linecap="round"/></svg></div>`;
  }

  function loginView() {
    return `<div class="login-page">
      <section class="login-visual">
        <div class="brand">${logoMarkup(true)}<span>${APP}</span></div>
        <div class="login-copy">
          <div class="feature-pill" style="display:inline-block;margin-bottom:18px">AI-powered attendance platform</div>
          <h1>Attendance that works at the speed of your classroom.</h1>
          <p>Real-time face recognition, dependable attendance records, and a professional workflow designed for educational institutions.</p>
          <div class="login-features"><span class="feature-pill">Face recognition</span><span class="feature-pill">Live attendance</span><span class="feature-pill">Attendance analytics</span><span class="feature-pill">Role-based access</span></div>
        </div>
        <div style="color:rgba(255,255,255,.5);font-size:11px">Secure institutional attendance workspace</div>
      </section>
      <section class="login-panel">
        <form class="login-card" id="loginForm">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:22px">${logoMarkup(false)}<div><strong style="font-size:13px">AI Attendance</strong><div style="font-size:10px;color:var(--muted)">Institutional workspace</div></div></div>
          <h2>Welcome back</h2>
          <p class="sub">Sign in to continue to your attendance workspace.</p>
          <div class="field" style="margin-bottom:14px"><label for="loginUser">Email or username</label><input class="input" id="loginUser" autocomplete="username" placeholder="you@institution.edu" required></div>
          <div class="field" style="margin-bottom:14px"><label for="loginPass">Password</label><input class="input" id="loginPass" type="password" autocomplete="current-password" placeholder="Enter your password" minlength="4" required></div>
          <div class="field" style="margin-bottom:20px"><label for="loginRole">Role</label><select class="select" id="loginRole"><option>Admin</option><option>Faculty</option></select></div>
          <button class="btn btn-primary" style="width:100%;height:44px" type="submit">Sign in</button>
          <p id="loginError" style="color:var(--danger);font-size:11px;margin:12px 0 0;min-height:16px"></p>
          <div style="margin-top:22px;padding:11px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;color:var(--muted);font-size:10px">Frontend demo: use any non-empty username and a password of 4+ characters.</div>
        </form>
      </section>
    </div>`;
  }

  function shell(view, title, subtitle) {
    const active=view;
    return `<div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">${logoMarkup(false)}<div class="brand-name">AI Attendance<small>Face Recognition System</small></div></div>
        <div class="nav-scroll">
          <div class="nav-group"><div class="nav-label">Overview</div>${navItem('dashboard','Dashboard',active)}</div>
          <div class="nav-group"><div class="nav-label">Management</div>${navItem('students','Students',active)}</div>
          <div class="nav-group"><div class="nav-label">Attendance</div>${navItem('recognition','Live Recognition',active)}${navItem('attendance','Attendance Register',active)}${navItem('reports','Reports',active)}</div>
          <div class="nav-group nav-system-note"><div class="nav-label">System</div><div class="sidebar-note"><span class="status-dot"></span><div><strong>Recognition ready</strong><small>System health is available from your profile.</small></div></div></div>
        </div>
        <div class="sidebar-footer"><div class="user-mini"> <div class="avatar">${initials(state.user)}</div><div class="user-info"><strong>${esc(state.user)}</strong><span>${esc(state.role)}</span></div></div></div>
      </aside>
      <div class="mobile-overlay" id="mobileOverlay"></div>
      <main class="main">
        <header class="topbar">
          <div class="top-left"><button class="icon-btn" id="sidebarToggle" aria-label="Toggle navigation">${navIcon('menu')}</button><div class="page-heading"><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div></div>
          <div class="top-actions">
            <div class="status-chip"><span class="status-dot"></span> Recognition engine ready</div>
            <button class="icon-btn" id="themeToggle" aria-label="Toggle theme">${navIcon(state.theme==='dark'?'sun':'moon')}</button>
            <div class="profile-wrap"><button class="profile-btn" id="profileToggle"><span class="avatar">${initials(state.user)}</span><span class="profile-name">${esc(state.user)}</span></button><div class="dropdown" id="profileMenu"><button data-route="settings">${navIcon('settings')} Settings</button><button id="menuTheme">${navIcon(state.theme==='dark'?'sun':'moon')} Switch theme</button><button class="danger" id="menuLogout">${navIcon('logout')} Logout</button></div></div>
          </div>
        </header>
        <section class="content" id="viewRoot"></section>
      </main>
    </div>`;
  }
  function navItem(route,label,active) { return `<button class="nav-item ${route===active?'active':''}" data-route="${route}">${navIcon(route)}<span class="nav-text">${label}</span></button>`; }

  function dashboard() {
    const total=state.students.length;
    const todayKey=today();
    const todayRows=state.attendance.filter(a=>a[0]===todayKey && a[6]==='Present');
    const presentIds=[...new Set(todayRows.map(a=>a[1]))];
    const present=presentIds.length;
    const avg=total?Math.round(state.students.reduce((sum,s)=>sum+(Number(s.attendance)||0),0)/total):0;

    // REAL DATA ONLY: never show invented attendance values.
    const trendDays=[];
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const key=d.toISOString().slice(0,10);
      const label=d.toLocaleDateString(undefined,{weekday:'short'});
      const rows=state.attendance.filter(a=>a[0]===key);
      const uniquePresent=new Set(rows.filter(a=>a[6]==='Present').map(a=>a[1])).size;
      trendDays.push({key,label,value:uniquePresent});
    }
    const hasTrend=trendDays.some(x=>x.value>0);
    const maxValue=Math.max(...trendDays.map(x=>x.value),1);
    const w=900,h=220,pad=25,step=(w-pad*2)/6;
    const y=v=>pad+(maxValue-v)/maxValue*(h-pad*2);
    const coords=trendDays.map((v,i)=>`${pad+i*step},${y(v.value)}`).join(' ');
    const area=`${pad},${h-pad} ${coords} ${pad+6*step},${h-pad}`;

    const classMap={};
    state.attendance.forEach(a=>{
      const key=`${a[3]} — ${a[4]}`;
      if(!classMap[key]) classMap[key]={present:new Set(),total:new Set()};
      classMap[key].total.add(a[1]);
      if(a[6]==='Present') classMap[key].present.add(a[1]);
    });
    const classRows=Object.entries(classMap).map(([name,v])=>({name,pct:v.total.size?Math.round(v.present.size/v.total.size*100):0}));

    const trendCard=hasTrend
      ? `<div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line class="chart-grid" x1="25" y1="30" x2="875" y2="30"/><line class="chart-grid" x1="25" y1="110" x2="875" y2="110"/><line class="chart-grid" x1="25" y1="190" x2="875" y2="190"/><polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${coords}"/>${trendDays.map((v,i)=>`<circle class="chart-dot" cx="${pad+i*step}" cy="${y(v.value)}" r="4"/>`).join('')}</svg></div><div style="display:flex;justify-content:space-between;color:var(--muted);font-size:10px">${trendDays.map(x=>`<span>${esc(x.label)}</span>`).join('')}</div>`
      : `<div class="empty" style="padding:48px 20px">No attendance trend data yet.<br><small>Real attendance will appear here after students are registered and attendance is marked.</small></div>`;

    const classCard=classRows.length
      ? classRows.map(x=>`<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px"><strong>${esc(x.name)}</strong><span>${x.pct}%</span></div><div class="progress"><span style="width:${x.pct}%"></span></div></div>`).join('')
      : `<div class="empty" style="padding:48px 20px">No class attendance data yet.<br><small>This section will populate from real attendance records.</small></div>`;

    return `<div class="page-title"><div><h1>Dashboard</h1><p>Good to see you, ${esc(state.user.split(' ')[0])}. Here's today's attendance overview.</p></div><div class="actions"><button class="btn btn-primary" data-route="recognition">${navIcon('camera')} Start Attendance</button></div></div>
      <div class="grid grid-4" style="margin-bottom:16px"><div class="card stat-card"><div class="stat-top"><span class="stat-label">Total Students</span><span class="stat-icon">${navIcon('students')}</span></div><div class="stat-value">${total}</div><span class="stat-note">Registered in the system</span></div><div class="card stat-card"><div class="stat-top"><span class="stat-label">Today's Attendance</span><span class="stat-icon">${navIcon('attendance')}</span></div><div class="stat-value">${Math.round((present/Math.max(total,1))*100)}%</div><span class="stat-note">Based on today's real records</span></div><div class="card stat-card"><div class="stat-top"><span class="stat-label">Present Today</span><span class="stat-icon">${navIcon('check')}</span></div><div class="stat-value">${present}</div><span class="stat-note">Actually recognized present</span></div><div class="card stat-card"><div class="stat-top"><span class="stat-label">Average Attendance</span><span class="stat-icon">${navIcon('reports')}</span></div><div class="stat-value">${avg}%</div><span class="stat-note">Across real attendance records</span></div></div>
      <div class="grid grid-2" style="margin-bottom:16px"><div class="card card-pad"><div class="section-head"><div><h2>Attendance trend</h2><p>Recent daily attendance performance</p></div><span class="badge ${hasTrend?'badge-success':'badge-neutral'}">${hasTrend?'Live data':'No data yet'}</span></div>${trendCard}</div>
      <div class="card card-pad"><div class="section-head"><div><h2>Class-wise attendance</h2><p>Calculated from real attendance records</p></div><button class="btn btn-secondary" data-route="reports">View reports</button></div><div style="display:grid;gap:15px">${classCard}</div></div></div>
      <div class="grid grid-2"><div class="card card-pad"><div class="section-head"><div><h2>Today's attendance</h2><p>Live summary from active records</p></div><button class="btn btn-secondary" data-route="attendance">Open register</button></div><div class="kpi-row"><div class="kpi"><strong>${present}</strong><span>Present</span></div><div class="kpi"><strong>${Math.max(total-present,0)}</strong><span>Absent</span></div><div class="kpi"><strong>${total}</strong><span>Total</span></div><div class="kpi"><strong>${Math.round((present/Math.max(total,1))*100)}%</strong><span>Attendance</span></div></div></div><div class="card card-pad"><div class="section-head"><div><h2>Recent activity</h2><p>Important system events</p></div></div><div class="activity">${state.activities.slice(0,5).map(a=>`<div class="activity-item"><div class="activity-icon">${navIcon(a[0].includes('Attendance')?'attendance':a[0].includes('Face')?'recognition':a[0].includes('Student')?'students':'settings')}</div><div><strong>${esc(a[1])}</strong><span>${esc(a[2])}</span></div></div>`).join('') || '<div class="empty" style="padding:20px">No activity yet.</div>'}</div></div></div>`;
  }

  function students() {
    const manage = canManage();
    return `<div class="page-title"><div><h1>Students</h1><p>Manage registered students and their face profiles.</p></div><div class="actions">${manage?'<button class="btn btn-primary" id="addStudent">'+navIcon('plus')+' Add Student</button>':''}</div></div>
      <div class="card" style="margin-bottom:16px"><div class="student-toolbar"><div class="field" style="min-width:260px;flex:2"><label>Search students</label><div style="position:relative"><span style="position:absolute;left:11px;top:11px;color:var(--muted)">${navIcon('search')}</span><input id="studentSearch" class="input" style="padding-left:38px" placeholder="Name, ID, roll number..."/></div></div><div class="field"><label>Class</label><select id="studentClass" class="select"><option value="">All classes</option><option>BSc AI</option><option>BSc Cybersecurity</option><option>BSc Data Science</option></select></div><div class="field"><label>Division</label><select id="studentDivision" class="select"><option value="">All divisions</option><option>A</option><option>B</option></select></div><div class="field"><label>Face status</label><select id="studentFace" class="select"><option value="">All</option><option value="yes">Registered</option><option value="no">Not registered</option></select></div><div class="view-toggle"><button class="active" id="tableViewBtn">Table</button><button id="gridViewBtn">Grid</button></div></div></div>
      <div id="studentResults"></div>`;
  }
  function personAvatar(s, sizeClass='avatar') {
    return s.photo ? `<div class="${sizeClass} photo-avatar"><img src="${esc(s.photo)}" alt="${esc(s.name)} profile photo"></div>` : `<div class="${sizeClass}">${initials(s.name)}</div>`;
  }

  function studentRows(list) {
    if (!list.length) return `<div class="card"><div class="empty"><div class="empty-icon">${navIcon('students')}</div><h3>No students found</h3><p>Try changing your search or filters${canManage()?' or add a new student.':''}</p>${canManage()?'<button class="btn btn-primary" id="emptyAdd">Add Student</button>':''}</div></div>`;
    return `<div class="card table-wrap"><table><thead><tr><th>Student</th><th>ID / Roll No.</th><th>Class</th><th>Division</th><th>Face</th><th>Attendance</th><th>Actions</th></tr></thead><tbody>${list.map(s=>`<tr><td><div class="person">${personAvatar(s,'avatar')}<div><strong>${esc(s.name)}</strong><span>${esc(s.email)}</span></div></div></td><td>${esc(s.id)}</td><td>${esc(s.cls)}</td><td>${esc(s.division)}</td><td>${s.face?'<span class="badge badge-success">● Registered</span>':'<span class="badge badge-warning">● Not registered</span>'}</td><td><strong>${s.attendance}%</strong></td><td><div class="actions"><button class="icon-btn" title="View" data-view-student="${esc(s.id)}">${navIcon('arrow')}</button>${canManage()?`<button class="icon-btn" title="Edit" data-edit-student="${esc(s.id)}">${navIcon('edit')}</button><button class="icon-btn" title="Delete" data-delete-student="${esc(s.id)}">${navIcon('trash')}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`;
  }
  function studentCards(list) { return list.length?`<div class="student-grid">${list.map(s=>`<div class="card student-card"><div class="student-top">${personAvatar(s,'big-avatar')} ${s.face?'<span class="badge badge-success">Registered</span>':'<span class="badge badge-warning">Not registered</span>'}</div><h3>${esc(s.name)}</h3><p>${esc(s.id)} · ${esc(s.cls)} — ${esc(s.division)}</p><div class="student-meta"><div><span>Attendance</span><strong>${s.attendance}%</strong></div><div><span>Present</span><strong>${s.present}</strong></div><div><span>Absent</span><strong>${s.absent}</strong></div><div><span>Face</span><strong>${s.face?'Ready':'Required'}</strong></div></div><div class="actions"><button class="btn btn-secondary" style="flex:1" data-view-student="${esc(s.id)}">View</button>${canManage()?`<button class="icon-btn" data-edit-student="${esc(s.id)}">${navIcon('edit')}</button>`:''}</div></div>`).join('')}</div>`:`<div class="card"><div class="empty"><h3>No students found</h3><p>Try changing your search or filters.</p></div></div>`; }

  function recognition() {
    return `<div class="page-title"><div><h1>Live Recognition</h1><p>Start a session for the <strong>current physical room</strong>. Room is saved per session, so tomorrow's room can be different.</p></div><div class="actions"><span class="badge badge-success" id="engineBadge">● Recognition Engine Ready</span></div></div>
      <div class="recognition-grid"><div class="card camera-card"><div class="camera-stage" id="cameraStage"><video id="cameraVideo" autoplay muted playsinline></video><div class="camera-overlay"></div><div class="scan-frame" id="scanFrame"><div class="scan-corner"></div></div><div class="recognition-state"><span class="camera-chip" id="cameraState">Camera idle</span><span class="camera-chip" id="modelState">Model ready</span></div><div class="camera-result" id="cameraResult"><strong>Ready to start</strong><span>Choose today's class details and confirm the physical room.</span></div></div><div style="padding:15px;display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-secondary" id="cameraRetry">Retry Camera</button><button class="btn btn-primary" id="startSession">Start Camera</button></div></div>
      <div class="side-stack"><div class="card card-pad"><div class="section-head"><div><h2>Session details</h2><p>Room is intentionally selected for every session.</p></div></div><div class="filters" style="display:grid"><div class="field"><label>Class</label><select id="sessionClass" class="select"><option>BSc AI</option><option>BSc Cybersecurity</option><option>BSc Data Science</option></select></div><div class="field"><label>Division</label><select id="sessionDivision" class="select"><option>A</option><option>B</option></select></div><div class="field"><label>Subject</label><select id="sessionSubject" class="select"><option>Artificial Intelligence</option><option>Machine Learning</option><option>Python Programming</option></select></div><div class="field"><label>Current room *</label><input id="sessionRoom" class="input" placeholder="e.g. Room 4" autocomplete="off"></div><label class="room-confirm"><input type="checkbox" id="roomConfirm"><span>I confirm this is the physical room for this session.</span></label><div class="room-note">Room 4 today and Room 5 tomorrow is supported. The system never treats a room as permanent for a class.</div><div class="kpi-row"><div class="kpi"><strong id="presentCount">0</strong><span>Present</span></div><div class="kpi"><strong id="absentCount">${state.students.length}</strong><span>Absent</span></div></div></div></div><div class="card card-pad"><div class="section-head"><div><h2>Recently recognized</h2><p>Duplicate protection is active</p></div></div><div class="recents" id="recentRecognized"><div class="empty" style="padding:30px 10px"><div class="empty-icon">${navIcon('recognition')}</div><h3>No recognition yet</h3><p>Start the camera to begin.</p></div></div></div><div class="card card-pad"><div class="section-head"><div><h2>Session</h2><p id="sessionStatus">Not started</p></div><div style="display:flex;align-items:center;gap:10px"><span class="session-timer" id="sessionTimer">00:00</span><button class="btn btn-primary" id="recognizeNow" disabled>Recognize Now</button><button class="btn btn-danger" id="endSession" disabled>End Attendance</button></div></div></div></div></div>`;
  }

  function attendance() {
    return `<div class="page-title"><div><h1>Attendance Register</h1><p>Search and review saved attendance records.</p></div></div>
      <div class="card card-pad" style="margin-bottom:16px"><div class="section-head"><div><h2>Filters</h2><p>Date range is the primary filter.</p></div><button class="btn btn-secondary" id="clearAttendanceFilters">Clear</button></div><div class="filters"><div class="field"><label>From date</label><input id="attFrom" class="input" type="date" value="${today()}"/></div><div class="field"><label>To date</label><input id="attTo" class="input" type="date" value="${today()}"/></div><div class="field"><label>Class</label><select id="attClass" class="select"><option value="">All classes</option><option>BSc AI</option><option>BSc Cybersecurity</option><option>BSc Data Science</option></select></div><div class="field"><label>Division</label><select id="attDivision" class="select"><option value="">All divisions</option><option>A</option><option>B</option></select></div><div class="field"><label>Subject</label><select id="attSubject" class="select"><option value="">All subjects</option><option>Artificial Intelligence</option><option>Machine Learning</option><option>Python Programming</option></select></div><div class="field"><label>Student</label><input id="attStudent" class="input" placeholder="Name or ID"/></div><div class="field"><label>Room</label><input id="attRoom" class="input" placeholder="e.g. Room 4"></div><div class="field"><label>Status</label><select id="attStatus" class="select"><option value="">All</option><option>Present</option><option>Absent</option></select></div></div></div><div id="attendanceResults"></div>`;
  }
  function attendanceTable(list) {
    const total=list.length, p=list.filter(x=>x[6]==='Present').length, a=total-p;
    return `<div class="grid grid-4" style="margin-bottom:16px"><div class="card stat-card"><span class="stat-label">Records</span><div class="stat-value">${total}</div></div><div class="card stat-card"><span class="stat-label">Present</span><div class="stat-value">${p}</div></div><div class="card stat-card"><span class="stat-label">Absent</span><div class="stat-value">${a}</div></div><div class="card stat-card"><span class="stat-label">Attendance</span><div class="stat-value">${total?Math.round(p/total*100):0}%</div></div></div><div class="card table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Division</th><th>Subject</th><th>Room</th><th>Status</th><th>Time</th></tr></thead><tbody>${list.map(x=>`<tr><td>${fmtDate(x[0])}</td><td><div class="person"><div class="avatar">${initials(x[2])}</div><strong>${esc(x[2])}</strong></div></td><td>${esc(x[3])}</td><td>${esc(x[4])}</td><td>${esc(x[5])}</td><td>${esc(x[8]||'—')}</td><td>${x[6]==='Present'?'<span class="badge badge-success">● Present</span>':'<span class="badge badge-danger">● Absent</span>'}</td><td>${esc(x[7])}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function reports() {
    return `<div class="page-title"><div><h1>Reports</h1><p>Filter attendance records and review performance without leaving the application.</p></div></div>
      <div class="card report-hero" style="margin-bottom:16px"><div class="section-head"><div><h2>Attendance report</h2><p>Use any combination of filters to refine the results.</p></div><span class="badge badge-neutral">View only</span></div><div class="filters"><div class="field"><label>From date</label><input id="repFrom" class="input" type="date" value="${today()}"/></div><div class="field"><label>To date</label><input id="repTo" class="input" type="date" value="${today()}"/></div><div class="field"><label>Student</label><input id="repStudent" class="input" placeholder="Name or ID"/></div><div class="field"><label>Course / Class</label><select id="repClass" class="select"><option value="">All classes</option><option>BSc AI</option><option>BSc Cybersecurity</option><option>BSc Data Science</option></select></div><div class="field"><label>Division</label><select id="repDivision" class="select"><option value="">All divisions</option><option>A</option><option>B</option></select></div><div class="field"><label>Subject</label><select id="repSubject" class="select"><option value="">All subjects</option><option>Artificial Intelligence</option><option>Machine Learning</option><option>Python Programming</option></select></div><div class="field"><label>Room</label><input id="repRoom" class="input" placeholder="e.g. Room 4"></div><div class="field"><label>Status</label><select id="repStatus" class="select"><option value="">All</option><option>Present</option><option>Absent</option></select></div><button class="btn btn-secondary" id="clearReports">Clear</button></div></div><div class="grid grid-2" style="margin-bottom:16px"><div class="card card-pad"><div class="section-head"><div><h2>Recently marked present</h2><p>Most recent successful recognitions</p></div></div><div id="recentPresent" class="recent-present"></div></div><div class="card card-pad"><div class="section-head"><div><h2>Filtered summary</h2><p>Updates as you change filters</p></div></div><div class="kpi-row" id="reportKpis"></div></div></div><div id="reportResults"></div>`;
  }

  function settings() {
    return `<div class="page-title"><div><h1>Settings</h1><p>Account, appearance, recognition health and attendance-session preferences.</p></div></div><div class="settings-shell"><div class="settings-overview card"><div class="settings-profile">${personAvatar({name:state.user},'settings-avatar')}<div><strong>${esc(state.user)}</strong><span>${esc(state.role)} · AI Attendance workspace</span></div></div><div class="settings-health"><span class="status-dot"></span><div><strong>Recognition engine ready</strong><small>DeepFace / FaceNet backend connection will plug into this status.</small></div></div></div><div class="settings-grid"><div class="card settings-nav"><button class="settings-tab active" data-settings-tab="account">${navIcon('students')} Account</button><button class="settings-tab" data-settings-tab="appearance">${navIcon('sun')} Appearance</button><button class="settings-tab" data-settings-tab="recognition">${navIcon('recognition')} Recognition</button><button class="settings-tab" data-settings-tab="session">${navIcon('attendance')} Attendance sessions</button><button class="settings-tab" data-settings-tab="security">${navIcon('settings')} Security</button></div><div class="card card-pad" id="settingsPanel"></div></div></div>`;
  }

  function viewStudentModal(id) {
    const s=state.students.find(x=>x.id===id); if(!s)return;
    const records=state.attendance.filter(x=>x[1]===id).sort((a,b)=>b[0].localeCompare(a[0]));
    openModal(`<div class="modal"><div class="modal-head"><div><h2>${esc(s.name)}</h2><div style="color:var(--muted);font-size:10px">${esc(s.id)} · ${esc(s.cls)} — ${esc(s.division)}</div></div><button class="icon-btn" data-close-modal>×</button></div><div class="modal-body"><div style="display:flex;gap:16px;align-items:center;margin-bottom:18px">${s.photo?`<div class="big-avatar photo-avatar" style="width:76px;height:76px;border-radius:18px"><img src="${esc(s.photo)}" alt="${esc(s.name)} profile photo"></div>`:`<div class="big-avatar" style="width:76px;height:76px;border-radius:18px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;font-size:23px;font-weight:800">${initials(s.name)}</div>`}<div><span class="badge ${s.face?'badge-success':'badge-warning'}">${s.face?'Face Registered':'Face Not Registered'}</span><h3 style="margin:8px 0 2px;font-size:18px">${s.name}</h3><p style="margin:0;color:var(--muted);font-size:11px">${esc(s.email)} · ${esc(s.phone)}</p></div></div><div class="kpi-row" style="margin-bottom:18px"><div class="kpi"><strong>${s.attendance}%</strong><span>Attendance</span></div><div class="kpi"><strong>${s.present}</strong><span>Present</span></div><div class="kpi"><strong>${s.absent}</strong><span>Absent</span></div><div class="kpi"><strong>${s.present+s.absent}</strong><span>Total classes</span></div></div><div class="section-head"><div><h2>Attendance register</h2><p>Student-wise history</p></div></div><div class="table-wrap"><table style="min-width:700px"><thead><tr><th>Date</th><th>Subject</th><th>Class</th><th>Room</th><th>Status</th><th>Time</th></tr></thead><tbody>${records.length?records.map(x=>`<tr><td>${fmtDate(x[0])}</td><td>${esc(x[5])}</td><td>${esc(x[3])} — ${esc(x[4])}</td><td>${esc(x[8]||'—')}</td><td>${x[6]==='Present'?'<span class="badge badge-success">Present</span>':'<span class="badge badge-danger">Absent</span>'}</td><td>${esc(x[7])}</td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--muted)">No attendance records found.</td></tr>'}</tbody></table></div></div><div class="modal-foot">${canManage()?`<button class="btn btn-secondary" data-edit-student="${esc(s.id)}">Edit Student</button><button class="btn btn-secondary" data-face-update="${esc(s.id)}">Update Face</button><button class="btn btn-danger" data-delete-student="${esc(s.id)}">Delete Student</button>`:''}<button class="btn btn-primary" data-close-modal>Close</button></div></div>`);
  }

  function addEditModal(id=null){
    if(!canManage())return;const s=id?state.students.find(x=>x.id===id):null,existingPhoto=s?.photo||'';
    openModal(`<form class="modal" id="studentForm"><div class="modal-head"><div><h2>${s?'Edit student':'Add student'}</h2><div style="color:var(--muted);font-size:10px">${s?'Update student information and face registration.':'Create a student and register a real face embedding.'}</div></div><button type="button" class="icon-btn" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid"><div class="field"><label>Student Name *</label><input class="input" name="name" required value="${esc(s?.name||'')}"></div><div class="field"><label>Student ID / Roll Number *</label><input class="input" name="id" required value="${esc(s?.id||'')}" ${s?'readonly':''}></div><div class="field"><label>Class *</label><select class="select" name="cls"><option ${s?.cls==='BSc AI'||!s?'selected':''}>BSc AI</option><option ${s?.cls==='BSc Cybersecurity'?'selected':''}>BSc Cybersecurity</option><option ${s?.cls==='BSc Data Science'?'selected':''}>BSc Data Science</option></select></div><div class="field"><label>Division / Section *</label><select class="select" name="division"><option ${s?.division==='A'||!s?'selected':''}>A</option><option ${s?.division==='B'?'selected':''}>B</option></select></div><div class="field"><label>Email</label><input class="input" type="email" name="email" value="${esc(s?.email||'')}"></div><div class="field"><label>Phone Number</label><input class="input" name="phone" value="${esc(s?.phone||'')}"></div><div class="field full"><div class="face-registration face-registration-live"><div class="section-head"><div><h2>Face Registration</h2><p>Capture one clear frame. The backend validates the face and creates the DeepFace / FaceNet embedding.</p></div><span class="badge ${s?.face?'badge-success':'badge-warning'}" id="faceStatusBadge">${s?.face?'Registered':'Required'}</span></div><div class="registration-grid"><div class="registration-camera"><video id="registrationVideo" autoplay muted playsinline></video><div class="registration-placeholder" id="registrationPlaceholder">${navIcon('camera')}<strong>Camera not started</strong><span>Start the camera to capture the face.</span></div><div class="registration-guide"><span></span><small>Position one face inside the frame</small></div></div><div class="registration-side"><div class="captured-photo" id="capturedPhoto">${existingPhoto?`<img src="${esc(existingPhoto)}" alt="${esc(s.name)} profile photo">`:`<div class="captured-placeholder">${navIcon('camera')}<span>Profile photo preview</span></div>`}</div><div class="registration-actions"><button type="button" class="btn btn-secondary" id="startRegistrationCamera">${navIcon('camera')} Start camera</button><button type="button" class="btn btn-primary" id="captureFace" disabled>Capture face</button></div><label class="upload-fallback"><span>Or upload a passport-size photo</span><input id="profilePhoto" type="file" accept="image/jpeg,image/png"></label><div class="validation-list" id="validationList"><div class="validation-item">○ Waiting for face capture</div></div></div></div><div class="embedding-state"><span class="embedding-dot"></span><div><strong>Real embedding pipeline</strong><small>Capture → FastAPI → DeepFace / FaceNet → database</small></div></div></div></div></div></div><div class="modal-foot"><button type="button" class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" type="submit">${s?'Save changes':'Create student'}</button></div></form>`);
    const video=document.getElementById('registrationVideo'),placeholder=document.getElementById('registrationPlaceholder'),preview=document.getElementById('capturedPhoto'),validation=document.getElementById('validationList'),captureBtn=document.getElementById('captureFace'),startBtn=document.getElementById('startRegistrationCamera'),fileInput=document.getElementById('profilePhoto');
    let blob=null;
    const show=async b=>{blob=b;const r=new FileReader();r.onload=e=>{preview.innerHTML=`<img src="${esc(e.target.result)}" alt="Captured profile photo">`;};r.readAsDataURL(b);validation.innerHTML='<div class="validation-item">◷ Backend validation will happen on submit.</div>';};
    const stop=()=>{if(registrationStream){registrationStream.getTracks().forEach(t=>t.stop());registrationStream=null;}captureBtn.disabled=true;};
    startBtn.addEventListener('click',async()=>{try{registrationStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:720}},audio:false});video.srcObject=registrationStream;video.style.display='block';placeholder.style.display='none';captureBtn.disabled=false;startBtn.textContent='Camera active';validation.innerHTML='<div class="validation-item ok">✓ Live camera ready</div><div class="validation-item">○ Position one face inside the guide</div>';}catch(err){validation.innerHTML='<div class="validation-item bad">✕ Camera unavailable. Use the upload fallback.</div>';}});
    captureBtn.addEventListener('click',()=>{if(!registrationStream||video.readyState<2)return;const c=document.createElement('canvas');c.width=video.videoWidth||720;c.height=video.videoHeight||720;c.getContext('2d').drawImage(video,0,0,c.width,c.height);c.toBlob(show,'image/jpeg',0.88);});
    fileInput.addEventListener('change',()=>{const f=fileInput.files?.[0];if(f)show(f);});
    document.getElementById('studentForm').addEventListener('submit',async e=>{
      e.preventDefault();const fd=new FormData(e.currentTarget),name=fd.get('name').trim(),sid=fd.get('id').trim();
      try{
        if(!s&&!blob){validation.innerHTML='<div class="validation-item bad">✕ Capture or upload a face image first.</div>';return;}
        if(s){
          await apiFetch('/students/'+encodeURIComponent(s.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,cls:fd.get('cls'),division:fd.get('division'),email:fd.get('email').trim(),phone:fd.get('phone').trim()})});
          if(blob){const f=new FormData();f.append('image',blob,'face.jpg');await apiFetch('/students/'+encodeURIComponent(s.id)+'/face',{method:'POST',body:f});}
        }else{
          const f=new FormData();f.append('student_id',sid);f.append('name',name);f.append('cls',fd.get('cls'));f.append('division',fd.get('division'));f.append('email',fd.get('email').trim());f.append('phone',fd.get('phone').trim());f.append('image',blob,'face.jpg');await apiFetch('/students',{method:'POST',body:f});
        }
        stop();closeModal();await syncBackendData();render();
      }catch(err){validation.innerHTML=`<div class="validation-item bad">✕ ${esc(err.message)}</div>`;}
    });
  }

  function updateFaceModal(id){
    if(!canManage())return;const s=state.students.find(x=>x.id===id);if(!s)return;
    openModal(`<form class="modal" id="faceUpdateForm"><div class="modal-head"><div><h2>Update face registration</h2><div style="color:var(--muted);font-size:10px">${esc(s.name)} · ${esc(s.id)}</div></div><button type="button" class="icon-btn" data-close-modal>×</button></div><div class="modal-body"><div class="current-face-row"><div>${s.photo?`<img src="${esc(s.photo)}" alt="Current face" class="current-face-photo">`:`<div class="big-avatar">${initials(s.name)}</div>`}</div><div><span class="badge badge-success">Registered</span><strong>Current profile face</strong><small>New capture replaces the existing FaceNet embedding.</small></div></div><div class="face-registration face-registration-live"><div class="registration-grid"><div class="registration-camera"><video id="updateVideo" autoplay muted playsinline></video><div class="registration-placeholder" id="updatePlaceholder">${navIcon('camera')}<strong>Camera not started</strong><span>Start the camera to replace the face.</span></div><div class="registration-guide"><span></span><small>Position one face inside the frame</small></div></div><div class="registration-side"><div class="captured-photo" id="updateCaptured"><div class="captured-placeholder">${navIcon('camera')}<span>New face preview</span></div></div><div class="registration-actions"><button type="button" class="btn btn-secondary" id="startUpdateCamera">${navIcon('camera')} Start camera</button><button type="button" class="btn btn-primary" id="captureUpdateFace" disabled>Capture face</button></div><label class="upload-fallback"><span>Or upload a new passport-size photo</span><input id="updatePhoto" type="file" accept="image/jpeg,image/png"></label><div id="updateValidation" class="validation-list"><div class="validation-item">○ Waiting for new face</div></div></div></div></div><div class="error-box" style="margin-top:14px">The backend validates the new image and generates the replacement FaceNet embedding.</div></div><div class="modal-foot"><button type="button" class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" type="submit">Validate & Replace Face</button></div></form>`);
    const video=document.getElementById('updateVideo'),placeholder=document.getElementById('updatePlaceholder'),preview=document.getElementById('updateCaptured'),validation=document.getElementById('updateValidation'),capture=document.getElementById('captureUpdateFace'),startBtn=document.getElementById('startUpdateCamera'),file=document.getElementById('updatePhoto');
    let blob=null;const stop=()=>{if(registrationStream){registrationStream.getTracks().forEach(t=>t.stop());registrationStream=null;}capture.disabled=true;};
    const setBlob=b=>{blob=b;const r=new FileReader();r.onload=e=>preview.innerHTML=`<img src="${esc(e.target.result)}" alt="New face preview">`;r.readAsDataURL(b);validation.innerHTML='<div class="validation-item">◷ Backend will validate the new face.</div>';};
    startBtn.addEventListener('click',async()=>{try{registrationStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:720}},audio:false});video.srcObject=registrationStream;video.style.display='block';placeholder.style.display='none';capture.disabled=false;startBtn.textContent='Camera active';}catch(err){validation.innerHTML='<div class="validation-item bad">✕ Camera unavailable. Use the upload fallback.</div>';}});
    capture.addEventListener('click',()=>{if(!registrationStream||video.readyState<2)return;const c=document.createElement('canvas');c.width=video.videoWidth||720;c.height=video.videoHeight||720;c.getContext('2d').drawImage(video,0,0,c.width,c.height);c.toBlob(setBlob,'image/jpeg',0.88);});
    file.addEventListener('change',()=>{const f=file.files?.[0];if(f)setBlob(f);});
    document.getElementById('faceUpdateForm').addEventListener('submit',async e=>{e.preventDefault();if(!blob){validation.innerHTML='<div class="validation-item bad">✕ Capture or upload a new face first.</div>';return;}try{const f=new FormData();f.append('image',blob,'face.jpg');await apiFetch('/students/'+encodeURIComponent(s.id)+'/face',{method:'POST',body:f});stop();closeModal();await syncBackendData();render();}catch(err){validation.innerHTML=`<div class="validation-item bad">✕ ${esc(err.message)}</div>`;}});
  }

  async function deleteStudent(id){
    if(!canManage())return;const s=state.students.find(x=>x.id===id);if(!s)return;
    if(!confirm(`Delete ${s.name}? This removes the student's face embedding and attendance records.`))return;
    try{await apiFetch('/students/'+encodeURIComponent(id),{method:'DELETE'});await syncBackendData();render();}catch(err){alert(err.message);}
  }


  function openModal(html){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modalBackdrop">${html}</div>`);document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',closeModal));document.getElementById('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal();});}
  function closeModal(){if(registrationStream){registrationStream.getTracks().forEach(t=>t.stop());registrationStream=null;}document.getElementById('modalBackdrop')?.remove();}

  function setupStudents(){let current='table';const update=()=>{const q=(document.getElementById('studentSearch')?.value||'').toLowerCase();const cls=document.getElementById('studentClass')?.value||'';const div=document.getElementById('studentDivision')?.value||'';const face=document.getElementById('studentFace')?.value||'';const list=state.students.filter(s=>(!q||`${s.name} ${s.id} ${s.cls} ${s.division}`.toLowerCase().includes(q))&&(!cls||s.cls===cls)&&(!div||s.division===div)&&(!face||(face==='yes'?s.face:!s.face)));document.getElementById('studentResults').innerHTML=current==='table'?studentRows(list):studentCards(list);};
    ['studentSearch','studentClass','studentDivision','studentFace'].forEach(id=>document.getElementById(id)?.addEventListener('input',update));document.getElementById('tableViewBtn')?.addEventListener('click',()=>{current='table';document.getElementById('tableViewBtn').classList.add('active');document.getElementById('gridViewBtn').classList.remove('active');update();});document.getElementById('gridViewBtn')?.addEventListener('click',()=>{current='grid';document.getElementById('gridViewBtn').classList.add('active');document.getElementById('tableViewBtn').classList.remove('active');update();});document.getElementById('addStudent')?.addEventListener('click',()=>addEditModal());document.getElementById('emptyAdd')?.addEventListener('click',()=>addEditModal());update();}

  function filterAttendance(prefix){const from=document.getElementById(prefix+'From')?.value||'';const to=document.getElementById(prefix+'To')?.value||'';const student=(document.getElementById(prefix+'Student')?.value||'').toLowerCase();const cls=document.getElementById(prefix+'Class')?.value||'';const div=document.getElementById(prefix+'Division')?.value||'';const sub=document.getElementById(prefix+'Subject')?.value||'';const room=(document.getElementById(prefix+'Room')?.value||'').toLowerCase();const status=document.getElementById(prefix+'Status')?.value||'';return state.attendance.filter(x=>(!from||x[0]>=from)&&(!to||x[0]<=to)&&(!student||`${x[1]} ${x[2]}`.toLowerCase().includes(student))&&(!cls||x[3]===cls)&&(!div||x[4]===div)&&(!sub||x[5]===sub)&&(!room||String(x[8]||'').toLowerCase().includes(room))&&(!status||x[6]===status));}
  function setupAttendance(){const update=()=>{document.getElementById('attendanceResults').innerHTML=attendanceTable(filterAttendance('att'));};['attFrom','attTo','attClass','attDivision','attSubject','attStudent','attRoom','attStatus'].forEach(id=>document.getElementById(id)?.addEventListener('input',update));document.getElementById('clearAttendanceFilters')?.addEventListener('click',()=>{['attClass','attDivision','attSubject','attStudent','attRoom','attStatus'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('attFrom').value='';document.getElementById('attTo').value='';update();});update();}
  function setupReports(){const update=()=>{const list=filterAttendance('rep');const p=list.filter(x=>x[6]==='Present').length;document.getElementById('reportKpis').innerHTML=`<div class="kpi"><strong>${list.length}</strong><span>Records</span></div><div class="kpi"><strong>${p}</strong><span>Present</span></div><div class="kpi"><strong>${list.length-p}</strong><span>Absent</span></div><div class="kpi"><strong>${list.length?Math.round(p/list.length*100):0}%</strong><span>Attendance</span></div>`;document.getElementById('reportResults').innerHTML=attendanceTable(list);};['repFrom','repTo','repStudent','repClass','repDivision','repSubject','repRoom','repStatus'].forEach(id=>document.getElementById(id)?.addEventListener('input',update));document.getElementById('clearReports')?.addEventListener('click',()=>{['repStudent','repClass','repDivision','repSubject','repRoom','repStatus'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('repFrom').value='';document.getElementById('repTo').value='';update();});const recent=state.attendance.filter(x=>x[6]==='Present').slice(0,4);document.getElementById('recentPresent').innerHTML=recent.length?recent.map(x=>`<div class="person"><div class="avatar">${initials(x[2])}</div><div><strong>${esc(x[2])}</strong><span>${fmtDate(x[0])} · ${esc(x[5])}</span></div></div>`).join(''):'<div class="empty" style="grid-column:1/-1;padding:20px">No recent recognitions.</div>';update();}

  async function startCamera(){
    const video=document.getElementById('cameraVideo'); if(!video)return;
    const room=document.getElementById('sessionRoom')?.value.trim(), confirmed=document.getElementById('roomConfirm')?.checked;
    if(!room){document.getElementById('cameraResult').innerHTML='<strong>Room required</strong><span>Enter the physical room for this session.</span>';return;}
    if(!confirmed){document.getElementById('cameraResult').innerHTML='<strong>Confirm the room</strong><span>Confirm the selected physical room.</span>';return;}
    try{
      const h=await backendHealth();
      if(!h.model_ready){document.getElementById('cameraResult').innerHTML=`<strong>AI model not ready</strong><span>${esc(h.error||'Start the backend after installation.')}</span>`;return;}
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
      video.srcObject=stream; sessionStartedAt=Date.now();
      document.getElementById('cameraState').textContent='Camera active';
      document.getElementById('scanFrame').classList.add('active');
      document.getElementById('cameraResult').innerHTML='<strong>Camera ready</strong><span>Press “Recognize Now” to analyze one frame. No continuous upload is running.</span>';
      document.getElementById('startSession').disabled=true; document.getElementById('cameraRetry').disabled=true;
      document.getElementById('recognizeNow').disabled=false; document.getElementById('endSession').disabled=false;
      document.getElementById('sessionRoom').disabled=true; document.getElementById('roomConfirm').disabled=true;
      document.getElementById('sessionStatus').textContent=`Session active · ${esc(room)}`;
      sessionTimer=setInterval(()=>{const el=document.getElementById('sessionTimer');if(!el||!sessionStartedAt)return;const sec=Math.floor((Date.now()-sessionStartedAt)/1000);el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;},1000);
    }catch(err){document.getElementById('cameraState').textContent='Camera unavailable';document.getElementById('cameraResult').innerHTML=`<strong>Camera access unavailable</strong><span>${esc(err.message)}</span>`;}
  }
  async function recognizeCurrentFrame(){
    const video=document.getElementById('cameraVideo'),btn=document.getElementById('recognizeNow'); if(!video||!stream)return;
    if(video.readyState<2){document.getElementById('cameraResult').innerHTML='<strong>Camera not ready</strong><span>Wait a moment and try again.</span>';return;}
    btn.disabled=true; document.getElementById('cameraResult').innerHTML='<strong>Analyzing one frame…</strong><span>DeepFace → FaceNet → embedding comparison.</span>';
    try{
      const c=document.createElement('canvas'); c.width=video.videoWidth||1280;c.height=video.videoHeight||720;c.getContext('2d').drawImage(video,0,0,c.width,c.height);
      const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',0.88)); const f=new FormData();
      f.append('image',blob,'attendance.jpg'); f.append('subject',document.getElementById('sessionSubject')?.value||'Artificial Intelligence'); f.append('room',document.getElementById('sessionRoom')?.value||'');
      const r=await apiFetch('/recognize',{method:'POST',body:f});
      if(r.recognized){
        const s=r.student,recent=document.getElementById('recentRecognized');
        if(![...recent.querySelectorAll('[data-rec-id]')].some(x=>x.getAttribute('data-rec-id')===s.id)){
          const row=document.createElement('div');row.className='recent';row.setAttribute('data-rec-id',s.id);
          row.innerHTML=`${personAvatar(s,'avatar')}<div><strong>${esc(s.name)}</strong><span>Recognized · ${esc(r.message)} · ${nowTime()}</span></div><span class="badge badge-success" style="margin-left:auto">${esc(r.message)}</span>`;
          if(recent.querySelector('.empty'))recent.innerHTML='';recent.prepend(row);
        }
        const count=[...recent.querySelectorAll('[data-rec-id]')].length;document.getElementById('presentCount').textContent=count;document.getElementById('absentCount').textContent=Math.max(0,state.students.length-count);
        document.getElementById('cameraResult').innerHTML=`<strong>${esc(s.name)} · ${esc(r.message)} ✓</strong><span>FaceNet distance ${esc(r.distance)} · confidence ${esc(r.confidence)}%.</span>`;
        await syncBackendData();
      }else document.getElementById('cameraResult').innerHTML='<strong>Unknown Face · Not Registered</strong><span>No registered embedding passed the cosine-distance threshold.</span>';
    }catch(err){document.getElementById('cameraResult').innerHTML=`<strong>Recognition error</strong><span>${esc(err.message)}</span>`;}
    finally{btn.disabled=false;}
  }

  function stopCamera(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}clearInterval(sessionTimer);sessionTimer=null;sessionStartedAt=null;const b=document.getElementById('recognizeNow');if(b)b.disabled=true;}
  function setupRecognition(){
    document.getElementById('startSession')?.addEventListener('click',startCamera);
    document.getElementById('cameraRetry')?.addEventListener('click',startCamera);
    document.getElementById('recognizeNow')?.addEventListener('click',recognizeCurrentFrame);
    document.getElementById('endSession')?.addEventListener('click',endSession);
    backendHealth().then(h=>{const b=document.getElementById('engineBadge');if(b){b.className=h.model_ready?'badge badge-success':'badge badge-warning';b.textContent=h.model_ready?'● Recognition Engine Ready':'● Recognition Engine Offline';}const m=document.getElementById('modelState');if(m)m.textContent=h.model_ready?'Model ready':'Model unavailable';}).catch(()=>{});
  }

  function endSession(){const present=[...document.querySelectorAll('#recentRecognized [data-rec-id]')].map(x=>x.getAttribute('data-rec-id'));const cls=document.getElementById('sessionClass').value,div=document.getElementById('sessionDivision').value,sub=document.getElementById('sessionSubject').value,room=document.getElementById('sessionRoom').value.trim();if(!room){alert('Room is required before ending the session.');return;}stopCamera();const absent=state.students.filter(s=>!present.includes(s.id));openModal(`<div class="modal"><div class="modal-head"><div><h2>Review attendance</h2><div style="color:var(--muted);font-size:10px">${esc(cls)} — ${esc(div)} · ${esc(sub)} · ${esc(room)}</div></div><button class="icon-btn" data-close-modal>×</button></div><div class="modal-body"><div class="kpi-row" style="margin-bottom:18px"><div class="kpi"><strong>${state.students.length}</strong><span>Total</span></div><div class="kpi"><strong>${present.length}</strong><span>Present</span></div><div class="kpi"><strong>${absent.length}</strong><span>Absent</span></div><div class="kpi"><strong>${Math.round(present.length/Math.max(state.students.length,1)*100)}%</strong><span>Attendance</span></div></div><div class="review-room"><span>Session room</span><strong>${esc(room)}</strong><small>Saved with this attendance session only.</small></div><div class="grid grid-2"><div><h3 style="font-size:13px">Present</h3><div style="display:grid;gap:7px">${present.map(id=>{const s=state.students.find(x=>x.id===id);return `<div class="recent">${personAvatar(s,'avatar')}<div><strong>${esc(s.name)}</strong><span>${esc(s.id)}</span></div><span class="badge badge-success" style="margin-left:auto">Present</span></div>`}).join('')}</div></div><div><h3 style="font-size:13px">Absent</h3><div style="display:grid;gap:7px">${absent.map(s=>`<div class="recent">${personAvatar(s,'avatar')}<div><strong>${esc(s.name)}</strong><span>${esc(s.id)}</span></div><span class="badge badge-danger" style="margin-left:auto">Absent</span></div>`).join('')}</div></div></div></div><div class="modal-foot"><button class="btn btn-secondary" data-close-modal>Discard session</button><button class="btn btn-primary" id="confirmSaveAttendance">Confirm & Save Attendance</button></div></div>`);document.getElementById('confirmSaveAttendance').addEventListener('click',()=>{const date=today(),time=nowTime();state.students.forEach(s=>{const isPresent=present.includes(s.id);state.attendance.unshift([date,s.id,s.name,cls,div,sub,isPresent?'Present':'Absent',isPresent?time:'—',room]);if(isPresent){s.present++;}else{s.absent++;}s.attendance=Math.round((s.present/(s.present+s.absent))*100);});state.activities.unshift(['Attendance completed',`${sub} session completed · ${present.length} present · ${absent.length} absent · ${room}`,time]);save();closeModal();render();});}

  function setupSettings(){const panel=document.getElementById('settingsPanel');if(!panel)return;const renderTab=(tab)=>{document.querySelectorAll('[data-settings-tab]').forEach(x=>x.classList.toggle('active',x.dataset.settingsTab===tab));if(tab==='account'){panel.innerHTML=`<h2>Account</h2><p class="settings-intro">Your signed-in identity for this attendance workspace.</p><div class="form-grid"><div class="field"><label>Display name</label><input class="input" id="settingName" value="${esc(state.user)}"></div><div class="field"><label>Role</label><input class="input" value="${esc(state.role)}" disabled></div><div class="field full"><label>Login identity</label><input class="input" value="${esc(state.user)}" disabled></div></div><div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-primary" id="saveSettings">Save changes</button></div>`;document.getElementById('saveSettings').addEventListener('click',()=>{const n=document.getElementById('settingName').value.trim();if(n){state.user=n;save();render();}});}else if(tab==='appearance'){panel.innerHTML=`<h2>Appearance</h2><p class="settings-intro">Keep the interface comfortable across day and night use.</p><div class="setting-row"><div><strong>Theme</strong><p>Switch between the light and dark interface.</p></div><label class="switch"><input id="themeSwitch" type="checkbox" ${state.theme==='dark'?'checked':''}><span></span></label></div>`;document.getElementById('themeSwitch').addEventListener('change',e=>{state.theme=e.target.checked?'dark':'light';save();applyTheme();render();});}else if(tab==='recognition'){panel.innerHTML=`<h2>Recognition</h2><p class="settings-intro">AI recognition health and registered face information.</p><div class="setting-row"><div><strong>Recognition engine</strong><p>DeepFace / FaceNet backend status is checked from the local FastAPI server.</p></div><span class="badge badge-success">Ready for API</span></div><div class="setting-row"><div><strong>Registered faces</strong><p>Students with an active face registration.</p></div><strong>${state.students.filter(s=>s.face).length}</strong></div><div class="setting-row"><div><strong>Unknown-face policy</strong><p>Faces below the configured recognition threshold are never marked present.</p></div><span class="badge badge-neutral">Strict</span></div>`;}else if(tab==='session'){panel.innerHTML=`<h2>Attendance sessions</h2><p class="settings-intro">Room assignment is session-specific so classes can move between rooms without stale configuration.</p><div class="setting-row"><div><strong>Room handling</strong><p>Faculty must enter and confirm the physical room every time a camera session starts.</p></div><span class="badge badge-success">Required</span></div><div class="setting-row"><div><strong>Duplicate attendance</strong><p>A student can be marked present only once per session.</p></div><span class="badge badge-success">Protected</span></div><div class="setting-row"><div><strong>Final review</strong><p>Attendance is reviewed before it is permanently saved.</p></div><span class="badge badge-success">Required</span></div>`;}else{panel.innerHTML=`<h2>Security</h2><p class="settings-intro">Session and password controls for the signed-in user.</p><div class="setting-row"><div><strong>Password</strong><p>Password changes will connect to the authentication API.</p></div><button class="btn btn-secondary" id="changePassword">Change password</button></div><div class="setting-row"><div><strong>Current session</strong><p>Signed in as ${esc(state.user)}.</p></div><button class="btn btn-danger" id="securityLogout">Logout</button></div>`;document.getElementById('securityLogout').addEventListener('click',logout);}};document.querySelectorAll('[data-settings-tab]').forEach(b=>b.addEventListener('click',()=>renderTab(b.dataset.settingsTab)));renderTab('account');}

  function setupGlobal(){document.body.onclick=globalActionHandler;document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>{const r=el.dataset.route;if(r){location.hash=r;closeMenus();}}));document.getElementById('sidebarToggle')?.addEventListener('click',()=>{const sb=document.getElementById('sidebar');if(window.innerWidth<=900){sb.classList.toggle('mobile-open');document.getElementById('mobileOverlay')?.classList.toggle('show');}else{sb.classList.toggle('collapsed');localStorage.setItem('sidebarCollapsed',sb.classList.contains('collapsed'));}});document.getElementById('mobileOverlay')?.addEventListener('click',()=>{document.getElementById('sidebar')?.classList.remove('mobile-open');document.getElementById('mobileOverlay')?.classList.remove('show');});document.getElementById('themeToggle')?.addEventListener('click',toggleTheme);document.getElementById('profileToggle')?.addEventListener('click',()=>document.getElementById('profileMenu')?.classList.toggle('open'));document.getElementById('menuTheme')?.addEventListener('click',toggleTheme);document.getElementById('menuLogout')?.addEventListener('click',logout);if(localStorage.getItem('sidebarCollapsed')==='true')document.getElementById('sidebar')?.classList.add('collapsed');}
  function globalActionHandler(e){const v=e.target.closest('[data-view-student]');if(v){viewStudentModal(v.dataset.viewStudent);return;}const ed=e.target.closest('[data-edit-student]');if(ed){addEditModal(ed.dataset.editStudent);return;}const del=e.target.closest('[data-delete-student]');if(del){deleteStudent(del.dataset.deleteStudent);return;}const fu=e.target.closest('[data-face-update]');if(fu){updateFaceModal(fu.dataset.faceUpdate);}}
  function closeMenus(){document.getElementById('profileMenu')?.classList.remove('open');document.getElementById('sidebar')?.classList.remove('mobile-open');document.getElementById('mobileOverlay')?.classList.remove('show');}
  function toggleTheme(){state.theme=state.theme==='dark'?'light':'dark';save();applyTheme();render();}
  function applyTheme(){document.documentElement.dataset.theme=state.theme;}
  function logout(){stopCamera();state.loggedIn=false;save();location.hash='';render();}

  async function render(){
    applyTheme();
    const root=document.getElementById('app');
    if(!state.loggedIn){
      root.innerHTML=loginView();
      document.getElementById('loginForm').addEventListener('submit',e=>{
        e.preventDefault();
        const u=document.getElementById('loginUser').value.trim(),p=document.getElementById('loginPass').value,er=document.getElementById('loginError');
        if(!u||p.length<4){er.textContent='Enter a valid username and a password of at least 4 characters.';return;}
        state.loggedIn=true;state.user=u;state.role=document.getElementById('loginRole').value;save();
        location.hash='dashboard';render();
      });
      return;
    }
    try{
      await syncBackendData();
    }catch(err){
      root.innerHTML=`<div style="padding:40px;font-family:Arial"><h2>Backend unavailable</h2><p>${esc(err.message)}</p><p>Start the FastAPI server with <code>.venv\\Scripts\\python.exe backend\\main.py</code>.</p></div>`;
      return;
    }
    const route=location.hash.replace('#/','').replace('#','')||'dashboard';
    const r=routes.includes(route)?route:'dashboard';
    const meta={
      dashboard:['Dashboard','Overview of today’s attendance and system activity'],
      students:['Students','Student records and face registration'],
      recognition:['Live Recognition','Real-time face recognition attendance'],
      attendance:['Attendance Register','Search and review saved attendance'],
      reports:['Reports','Filtered attendance insights'],
      settings:['Settings','Workspace and account preferences']
    }[r];
    root.innerHTML=shell(r,...meta);
    const vr=document.getElementById('viewRoot');
    vr.innerHTML=r==='dashboard'?dashboard():r==='students'?students():r==='recognition'?recognition():r==='attendance'?attendance():r==='reports'?reports():settings();
    setupGlobal();
    if(r==='students')setupStudents();
    if(r==='recognition')setupRecognition();
    if(r==='attendance')setupAttendance();
    if(r==='reports')setupReports();
    if(r==='settings')setupSettings();
  }

  window.addEventListener('hashchange',()=>{stopCamera();render();});
  window.addEventListener('beforeunload',stopCamera);
  render();
})();
