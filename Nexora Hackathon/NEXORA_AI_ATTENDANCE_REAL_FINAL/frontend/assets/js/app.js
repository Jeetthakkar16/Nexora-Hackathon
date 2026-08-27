 {
 'use strict';
 const APP = 'AI Face Recognition Attendance System';
 const routes = ['dashboard','students','recognition','attendance','reports','settings'];
 const state = {
 loggedIn: true,
 role: 'Admin',
 user: 'admin',
 theme: localStorage.getItem('aifras-theme') || 'dark',
 students: [],
 attendance: [],
 activities: [],
 dashboard: null
 };
 let registrationStream = null;
 let sourceStream = null;
 let sourceType = '';
 let sourceReady = false;
 let sessionId = null;
 let recognitionBusy = false;
 let detectionBusy = false;
 let recognitionTimer = null;
 let detectionTimer = null;
 let rtspId = null;
 let sessionStartedAt = null;
 let sessionTimer = null;
 // Recognition polling interval in seconds.
 const RECOGNITION_INTERVAL = 2;
 // Current cosine-distance threshold used by recognition.
 let currentThreshold = 0.45;
 const API = '/api';
 function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
 function initials(name) { return String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || '?'; }
 function today() { return new Date().toISOString().slice(0,10); }
 function fmtDate(d) { if(!d)return '—'; const x=new Date(d+'T00:00:00'); return x.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
 function nowTime() { return new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }
 function canManage() { return state.role === 'Admin'; }
 function navIcon(type) {
 const paths={
 dashboard:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
 students:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 recognition:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M15 10h3M15 14h3"/>',
 attendance:'<path d="M6 3v4M18 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="m8 14 2 2 5-5"/>',
 reports:'<path d="M4 19V5M4 19h17M8 16v-4M12 16V8M16 16V6M20 16v-3"/>',
 settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 3.5 11H3.3a2 2 0 0 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
 moon:'<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 arrow:'<path d="m9 18 6-6-6-6"/>',
 camera:'<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
 edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
 logout:'<path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/>'
 };
 return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type]||''}</svg>`;
 }
 function logoMarkup(light=false) {
 return `<div class="logo"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 3.5c6.4 0 11.5 4.7 11.5 10.7 0 8.2-5.1 14.3-11.5 14.3S4.5 22.4 4.5 14.2C4.5 8.2 9.6 3.5 16 3.5Z" stroke="${light?'white':'currentColor'}" }
 function navItem(route,label,active){return `<button class="nav-item ${active===route?'active':''}" data-route="${route}">${navIcon(route)}<span>${label}</span></button>`;}
 function shell(view,title,subtitle){
 return `<div class="app-shell">
 <aside class="sidebar" id="sidebar">
 <div class="sidebar-brand">${logoMarkup(false)}<div class="brand-name">AI Attendance<small>Face Recognition System</small></div></div>
 <div class="nav-scroll">
 <div class="nav-group"><div class="nav-label">Overview</div>${navItem('dashboard','Dashboard',view)}</div>
 <div class="nav-group"><div class="nav-label">Management</div>${navItem('students','Students',view)}</div>
 <div class="nav-group"><div class="nav-label">Attendance</div>${navItem('recognition','Live Recognition',view)}${navItem('attendance','Attendance Register',view)}${navItem('reports','Reports',view)}</div>
 <div class="nav-group nav-system-note"><div class="nav-label">System</div><div class="sidebar-note"><span class="status-dot"></span><div><strong>Recognition ready</strong><small>Live backend status available.</small></div></di </div>
 <div class="sidebar-footer"><div class="user-mini"><div class="avatar">${initials(state.user)}</div><div class="user-info"><strong>${esc(state.user)}</strong><span>${esc(state.role)}</span></div></div></div>
 </aside>
 <div class="mobile-overlay" id="mobileOverlay"></div>
 <main class="main">
 <header class="topbar"><div class="top-left"><button class="icon-btn" id="sidebarToggle">${navIcon('menu')}</button><div class="page-heading"><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div></div>
 <div class="top-actions"><div class="status-chip"><span class="status-dot"></span> Recognition engine ready</div><button class="icon-btn" id="themeToggle">${navIcon(state.theme==='dark'?'sun':'moon')}</button>
 <div class="profile-wrap"><button class="profile-btn" id="profileToggle"><span class="avatar">${initials(state.user)}</span><span class="profile-name">${esc(state.user)}</span></button><div class="dropdown" id="profileMenu"><b </header><section class="content" id="viewRoot"></section>
 </main></div>`;
 }
 async function api(path, options={}) {
 const r=await fetch(API+path, options);
 let data=null; try{data=await r.json();}catch(_){}
 if(!r.ok) throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
 return data;
 }
 async function hydrate(){
 try{
 [state.students,state.attendance,state.activities,state.dashboard]=await Promise.all([
 api('/students'),
 api('/attendance'),
 api('/activities'),
 api('/dashboard')
 ]);
 }catch(e){console.error(e);}
 }
 function dashboard(){
 const d=state.dashboard||{total_students:0,present_today:0,attendance_today:0,average_attendance:0,classes:[],trend:[0,0,0,0,0,0,0]};
 const points=(d.trend||[]).length===7?d.trend:[0,0,0,0,0,0,0];
 const max=Math.max(1,...points), min=0, w=900,h=220,pad=25;
 const step=(w-pad*2)/(points.length-1);
 const y=v=>pad+(max-v)/(Math.max(1,max-min))*(h-pad*2);
 const coords=points.map((v,i)=>`${pad+i*step},${y(v)}`).join(' ');
 const area=`${pad},${h-pad} ${coords} ${pad+(points.length-1)*step},${h-pad}`;
 const cls=d.classes||[];
 return `<div class="page-title"><div><h1>Dashboard</h1><p>Good to see you, ${esc(state.user.split(' ')[0])}. Here's today's attendance overview.</p></div><div class="actions"><button class="btn btn-primary" data-route="recognition"> <div class="grid grid-4" style="margin-bottom:16px">
 <div class="card stat-card"><div class="stat-top"><span class="stat-label">Total Students</span><span class="stat-icon">${navIcon('students')}</span></div><div class="stat-value">${d.total_students}</div><span class="stat-note"> <div class="card stat-card"><div class="stat-top"><span class="stat-label">Today's Attendance</span><span class="stat-icon">${navIcon('attendance')}</span></div><div class="stat-value">${d.attendance_today}%</div><span class="st <div class="card stat-card"><div class="stat-top"><span class="stat-label">Present Today</span><span class="stat-icon">${navIcon('check')}</span></div><div class="stat-value">${d.present_today}</div><span class="stat-note">Recog <div class="card stat-card"><div class="stat-top"><span class="stat-label">Average Attendance</span><span class="stat-icon">${navIcon('reports')}</span></div><div class="stat-value">${d.average_attendance}%</div><span class="sta </div>
 <div class="grid grid-2" style="margin-bottom:16px">
 <div class="card card-pad"><div class="section-head"><div><h2>Attendance trend</h2><p>Recent daily attendance performance</p></div><span class="badge badge-success">${d.total_students?'Live':'No records'}</span></div>
 <div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line class="chart-grid" x1="25" y1="30" x2="875" y2="30"/><line class="chart-grid" x1="25" y1="110" x2="875" y2="110"/><line class="chart-grid" x1="25 <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:10px"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
 </div>
 <div class="card card-pad"><div class="section-head"><div><h2>Class-wise attendance</h2><p>Today's recorded attendance</p></div><button class="btn btn-secondary" data-route="reports">View reports</button></div>
 <div style="display:grid;gap:15px">${cls.length?cls.map(c=>`<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px"><strong>${esc(c.class_name)} — ${esc(c.division)}</strong><span>${c.perc </div>
 </div>
 <div class="grid grid-2"><div class="card card-pad"><div class="section-head"><div><h2>Today's attendance</h2><p>Live summary from active records</p></div><button class="btn btn-secondary" data-route="attendance">Open register</bu <div class="card card-pad"><div class="section-head"><div><h2>Recent activity</h2><p>Real system events</p></div></div><div class="activity">${state.activities.length?state.activities.slice(0,5).map(a=>`<div class="activity-item"> }
 function personAvatar(s, cls='avatar'){return s.photo?`<img class="${cls}" src="${esc(s.photo)}" alt="">`:`<div class="${cls}">${initials(s.name)}</div>`;}
 function students(){
 return `<div class="page-title"><div><h1>Students</h1><p>Manage real student records and their face profiles.</p></div><div class="actions"><button class="btn btn-primary" id="addStudent">${navIcon('plus')} Add Student</button></div <div class="card" style="margin-bottom:16px"><div class="student-toolbar"><div class="field" style="min-width:260px;flex:2"><label>Search students</label><div style="position:relative"><span style="position:absolute;left:11px;top: }
 function studentRows(list){
 if(!list.length)return `<div class="card"><div class="empty"><div class="empty-icon">${navIcon('students')}</div><h3>No students found</h3><p>Try changing your search or add a real student.</p><button class="btn btn-primary" id="emp return `<div class="card table-wrap"><table><thead><tr><th>Student</th><th>ID / Roll No.</th><th>Class</th><th>Division</th><th>Face</th><th>Attendance</th><th>Actions</th></tr></thead><tbody>${list.map(s=>`<tr><td><div class="perso }
 function studentCards(list){return list.length?`<div class="student-grid">${list.map(s=>`<div class="card student-card"><div class="student-top">${personAvatar(s,'big-avatar')} ${s.face?'<span class="badge badge-success">Registered</s function recognition(){
 return `<div class="page-title"><div><h1>Live Recognition</h1><p>Video flows continuously; recognition starts only after you start an attendance session.</p></div><div class="actions"><span class="badge badge-success" id="engineBadg <div class="recognition-grid">
 <div class="card camera-card"><div class="camera-stage" id="cameraStage">
 <video id="cameraVideo" autoplay muted playsinline></video><img id="rtspImage" style="display:none;width:100%;height:100%;object-fit:contain" alt="CCTV stream">
 <canvas id="captureCanvas" style="display:none"></canvas><div class="camera-overlay" id="faceOverlay"></div>
 <div class="scan-frame" id="scanFrame"><div class="scan-corner"></div></div>
 <div class="recognition-state"><span class="camera-chip" id="cameraState">Camera idle</span><span class="camera-chip" id="modelState">Detection idle</span></div>
 <div class="camera-result" id="cameraResult"><strong>Ready</strong><span>Select a source and start it. AI recognition begins with the attendance session.</span></div>
 </div><div style="padding:15px;display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-secondary" id="cameraRetry">Retry source</button><button class="btn btn-primary" id="startSession">Start Attendance</button></ <div class="side-stack">
 <div class="card card-pad"><div class="section-head"><div><h2>Session & source</h2><p>One session creates one duplicate-protected attendance set.</p></div></div>
 <div class="filters" style="display:grid">
 <div class="field"><label>Source</label><select id="sourceType" class="select"><option value="webcam">Laptop / browser camera</option><option value="video">Pre-recorded video</option><option value="rtsp">Authorized CCTV /  <div id="videoSourceFields" style="display:none"><div class="field"><label>Recorded classroom video</label><input id="videoFile" class="input" type="file" accept="video/*"></div><div class="field"><label>Saved recordings</ <div id="rtspSourceFields" style="display:none"><div class="field"><label>Authorized RTSP URL</label><input id="rtspUrl" class="input" placeholder="rtsp://username:password@camera-ip/..."></div></div>
 <div class="field"><label>Class</label><select id="sessionClass" class="select"><option>BSc AI</option><option>BSc Cybersecurity</option><option>BSc Data Science</option></select></div>
 <div class="field"><label>Division</label><select id="sessionDivision" class="select"><option>A</option><option>B</option></select></div>
 <div class="field"><label>Subject</label><input id="sessionSubject" class="input" placeholder="Subject"></div>
 <div class="field"><label>Current room *</label><input id="sessionRoom" class="input" placeholder="e.g. Room 4"></div>
 <div class="field"><label>Recognition threshold (cosine distance)</label><input id="threshold" class="input" type="number" min="0.20" max="0.80" step="0.01" value="0.45"><small style="display:block;margin-top:5px;color:var <label class="room-confirm"><input type="checkbox" id="roomConfirm"><span>I confirm this is the physical room for this session.</span></label>
 <div class="room-note">Detection draws boxes around every usable face. FaceNet matching and attendance marking begin only after Start Attendance.</div>
 <div class="kpi-row"><div class="kpi"><strong id="presentCount">0</strong><span>Present</span></div><div class="kpi"><strong id="notMarkedCount">${state.students.length}</strong><span>Not marked</span></div></div>
 </div>
 </div>
 <div class="card card-pad"><div class="section-head"><div><h2>Recently recognized</h2><p>Duplicate protection is active</p></div></div><div class="recents" id="recentRecognized"><div class="empty" style="padding:30px 10px"><di <div class="card card-pad"><div class="section-head"><div><h2>Session</h2><p id="sessionStatus">Not started</p></div><div style="display:flex;align-items:center;gap:10px"><span class="session-timer" id="sessionTimer">00:00</sp </div>
 </div>`;
 }
 function attendanceTable(list){
 const total=list.length,p=total,a=0;
 return `<div class="grid grid-4" style="margin-bottom:16px"><div class="card stat-card"><span class="stat-label">Records</span><div class="stat-value">${total}</div></div><div class="card stat-card"><span class="stat-label">Present< }
 function attendance(){return `<div class="page-title"><div><h1>Attendance Register</h1><p>Search and review saved attendance records.</p></div></div><div class="card card-pad" style="margin-bottom:16px"><div class="section-head"><div> function reports(){return `<div class="page-title"><div><h1>Reports</h1><p>Filter attendance records and review performance without leaving the application.</p></div></div><div class="card report-hero" style="margin-bottom:16px"><div  function addEditModal(id=null){
 const s=state.students.find(x=>x.id===id);
 const modal=document.createElement('div'); modal.id='modalBackdrop'; modal.className='modal-backdrop';
 modal.innerHTML=`<form class="modal" id="studentForm"><div class="modal-head"><div><h2>${s?'Edit student':'Add student'}</h2><div style="color:var(--muted);font-size:10px">${s?'Update real student information and face registration.' document.body.appendChild(modal);
 let capturedBlob=null; let faceValidated=!!s?.face;
 const video=modal.querySelector('#registrationVideo'), placeholder=modal.querySelector('#registrationPlaceholder'), capture=modal.querySelector('#captureFace'), file=modal.querySelector('#profilePhoto'), validation=modal.querySelect const setMsg=(text,cls='')=>validation.innerHTML=`<div class="validation-item ${cls}">${esc(text)}</div>`;
 async function validateLocal(blob){
 const fd=new FormData(); fd.append('frame',blob,'face.jpg');
 try{
 const result=await api('/detection/frame',{method:'POST',body:fd});
 if(result.faces.length!==1){badge.className='badge badge-warning';badge.textContent='Needs exactly one face';setMsg(`Detected ${result.faces.length} faces. Capture exactly one face.`,'bad');capturedBlob=null;faceValidated=false; badge.className='badge badge-success';badge.textContent='Ready';setMsg('✓ Exactly one face detected; ready for backend embedding.','ok');faceValidated=true;return true;
 }catch(e){capturedBlob=null;faceValidated=false;setMsg(e.message,'bad');return false;}
 }
 async function stopReg(){if(registrationStream){registrationStream.getTracks().forEach(t=>t.stop());registrationStream=null;}capture.disabled=true;}
 modal.querySelector('#startRegistrationCamera').onclick=async()=>{
 try{registrationStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:720}},audio:false});video.srcObject=registrationStream;video.style.display='block';placeholder.style.displa catch(e){setMsg('Camera unavailable. Use the image upload fallback.','bad');}
 };
 capture.onclick=async()=>{
 if(!registrationStream||video.readyState<2)return;
 const canvas=document.createElement('canvas');canvas.width=video.videoWidth||720;canvas.height=video.videoHeight||720;canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
 const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.88));capturedBlob=blob;preview.innerHTML=`<img src="${URL.createObjectURL(blob)}" alt="">`;setMsg('Validating captured face...');await validateLocal(blob);
 };
 file.onchange=async()=>{
 const f=file.files?.[0];if(!f)return;capturedBlob=f;preview.innerHTML=`<img src="${URL.createObjectURL(f)}" alt="">`;setMsg('Validating uploaded face...');await validateLocal(f);
 };
 modal.querySelector('#studentForm').onsubmit=async e=>{
 e.preventDefault();
 if(!s && (!capturedBlob || !faceValidated)){setMsg('Capture or upload exactly one valid face before creating the student.','bad');return;}
 if(s && capturedBlob && !faceValidated){setMsg('The new face image has not passed validation.','bad');return;}
 const fd=new FormData(e.currentTarget);if(capturedBlob)fd.append('image',capturedBlob,'face.jpg');
 try{
 const result=s?await api('/students/'+encodeURIComponent(s.id),{method:'PUT',body:fd}):await api('/students',{method:'POST',body:fd});
 await stopReg();modal.remove();await hydrate();render();
 }catch(err){setMsg(err.message,'bad');}
 };
 modal.querySelector('#closeModal').onclick=async()=>{await stopReg();modal.remove();};
 modal.querySelector('#cancelStudent').onclick=async()=>{await stopReg();modal.remove();};
 }
 function viewStudentModal(id){
 const s=state.students.find(x=>x.id===id);if(!s)return;
 const m=document.createElement('div');m.id='modalBackdrop';m.className='modal-backdrop';m.innerHTML=`<div class="modal"><div class="modal-head"><h2>${esc(s.name)}</h2><button class="icon-btn" id="closeModal">×</button></div><div cla async function deleteStudent(id){if(!confirm('Delete this student and their attendance records?'))return;try{await api('/students/'+encodeURIComponent(id),{method:'DELETE'});await hydrate();render();}catch(e){alert(e.message);}}
 function setupStudents(){
 let current='table';
 const update=()=>{const q=(document.getElementById('studentSearch')?.value||'').toLowerCase(),cls=document.getElementById('studentClass')?.value||'',div=document.getElementById('studentDivision')?.value||'',face=document.getElementB ['studentSearch','studentClass','studentDivision','studentFace'].forEach(id=>document.getElementById(id)?.addEventListener('input',update));
 document.getElementById('tableViewBtn')?.addEventListener('click',()=>{current='table';document.getElementById('tableViewBtn').classList.add('active');document.getElementById('gridViewBtn').classList.remove('active');update();});
 document.getElementById('gridViewBtn')?.addEventListener('click',()=>{current='grid';document.getElementById('gridViewBtn').classList.add('active');document.getElementById('tableViewBtn').classList.remove('active');update();});
 document.getElementById('addStudent')?.addEventListener('click',()=>addEditModal());document.getElementById('emptyAdd')?.addEventListener('click',()=>addEditModal());
 update();
 }
 function stopSource(){
 if(recognitionTimer){
 clearInterval(recognitionTimer);
 recognitionTimer=null;
 }
 if(detectionTimer){
 clearInterval(detectionTimer);
 detectionTimer=null;
 }
 if(sourceStream){
 sourceStream.getTracks().forEach(track=>track.stop());
 sourceStream=null;
 }
 const video=document.getElementById('cameraVideo');
 if(video){
 video.pause();
 if(video.srcObject){
 video.srcObject=null;
 }
 }
 if(rtspId){
 api('/rtsp/'+encodeURIComponent(rtspId)+'/stop',{method:'POST'}).catch(()=>{});
 rtspId=null;
 }
 sourceReady=false;
 recognitionBusy=false;
 detectionBusy=false;
 }
 function clearBoxes(){
 const o=document.getElementById('faceOverlay');
 if(o)o.innerHTML='';
 }
 function drawBoxes(faces,width,height,video){
 const o=document.getElementById('faceOverlay');
 if(!o)return;
 o.innerHTML='';
 const stage=document.getElementById('cameraStage');
 if(!stage)return;
 const sw=stage.clientWidth;
 const sh=stage.clientHeight;
 let dw=width||960;
 let dh=height||540;
 if(video && video.videoWidth){
 dw=video.videoWidth;
 dh=video.videoHeight;
 }
 const scale=Math.min(sw/dw,sh/dh);
 const rw=dw*scale;
 const rh=dh*scale;
 const ox=(sw-rw)/2;
 const oy=(sh-rh)/2;
 (Array.isArray(faces)?faces:[]).forEach(f=>{
 const x=Number(f.x)||0;
 const y=Number(f.y)||0;
 const w=Number(f.w)||0;
 const h=Number(f.h)||0;
 const b=document.createElement('div');
 b.style.cssText=
 `position:absolute;left:${ox+x*scale}px;top:${oy+y*scale}px;width:${w*scale}px;height:${h*scale}px;border:2px solid ${f.matched?'#63f59a':'#ffffff'};border-radius:12px;pointer-events:none;box-sizing:border-box;z-index:5;`;
 if(f.name){
 const l=document.createElement('span');
 l.textContent=
 `${f.name}${f.distance!==undefined?' · '+f.distance:''}`;
 l.style.cssText=
 'position:absolute;left:-2px;top:-24px;background:rgba(8,12,24,.9);padding:4px 7px;border-radius:6px;font-size:10px;white-space:nowrap;color:#fff;';
 b.appendChild(l);
 }
 o.appendChild(b);
 });
 }
 async function captureVideoFrame(video){
 if(!video)return null;
 if(
 video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
 !video.videoWidth ||
 !video.videoHeight
 ){
 return null;
 }
 const canvas=document.getElementById('captureCanvas');
 if(!canvas)return null;
 canvas.width=video.videoWidth;
 canvas.height=video.videoHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)return null;
 ctx.drawImage(
 video,
 0,
 0,
 canvas.width,
 canvas.height
 );
 return await new Promise(resolve=>{
 canvas.toBlob(
 blob=>resolve(blob),
 'image/jpeg',
 0.78
 );
 });
 }
 async function ensureVideoPlaying(){
 const video=document.getElementById('cameraVideo');
 if(!video){
 throw new Error('Camera video element not found.');
 }
 if(sourceType==='webcam'){
 if(!sourceStream){
 throw new Error('Camera source is not running.');
 }
 if(video.srcObject!==sourceStream){
 video.srcObject=sourceStream;
 }
 }
 if(sourceType==='video'){
 if(!video.src){
 throw new Error('No video file selected.');
 }
 }
 if(video.paused){
 try{
 await video.play();
 }catch(err){
 throw new Error(
 'Video playback could not start. Check camera permission or video source.'
 );
 }
 }
 if(!video.videoWidth || !video.videoHeight){
 await new Promise(resolve=>{
 const timeout=setTimeout(resolve,3000);
 const check=()=>{
 if(video.videoWidth && video.videoHeight){
 clearTimeout(timeout);
 resolve();
 }else{
 requestAnimationFrame(check);
 }
 };
 check();
 });
 }
 if(!video.videoWidth || !video.videoHeight){
 throw new Error('Video source has no usable frames.');
 }
 sourceReady=true;
 const cameraState=document.getElementById('cameraState');
 if(cameraState){
 cameraState.textContent=
 sourceType==='webcam'
 ? 'Camera active'
 : 'Recorded video active';
 }
 return true;
 }
 function updateThreshold(){
 const el=document.getElementById('threshold');
 if(!el)return;
 const raw=Number(el.value);
 currentThreshold=
 Number.isFinite(raw)
 ? Math.max(0.20,Math.min(0.80,raw))
 : 0.45;
 el.value=currentThreshold.toFixed(2);
 const valueEl=document.getElementById('thresholdValue');
 if(valueEl){
 valueEl.textContent=currentThreshold.toFixed(2);
 }
 }
 async function detectCurrent(){
 if(detectionBusy)return;
 if(sourceType==='rtsp')return;
 if(!sourceReady)return;
 const video=document.getElementById('cameraVideo');
 if(!video)return;
 if(
 video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
 !video.videoWidth ||
 !video.videoHeight
 ){
 return;
 }
 const blob=await captureVideoFrame(video);
 if(!blob)return;
 detectionBusy=true;
 try{
 const fd=new FormData();
 fd.append('frame',blob,'frame.jpg');
 const r=await api(
 '/detection/frame',
 {
 method:'POST',
 body:fd
 }
 );
 const faces=Array.isArray(r?.faces)
 ? r.faces
 : [];
 drawBoxes(
 faces,
 r?.width||video.videoWidth,
 r?.height||video.videoHeight,
 video
 );
 const modelState=document.getElementById('modelState');
 if(modelState){
 modelState.textContent=
 `Detection active · ${faces.length} face${faces.length===1?'':'s'}`;
 }
 }catch(e){
 const modelState=document.getElementById('modelState');
 if(modelState){
 modelState.textContent='Detection waiting';
 }
 }finally{
 detectionBusy=false;
 }
 }
 async function recognizeCurrent(){
 if(recognitionBusy)return;
 if(!sessionId)return;
 if(!sourceReady)return;
 // RTSP recognition/attendance is handled by the backend RTSP worker.
 if(sourceType==='rtsp')return;
 const video=document.getElementById('cameraVideo');
 if(!video)return;
 try{
 await ensureVideoPlaying();
 }catch(err){
 const result=document.getElementById('cameraResult');
 if(result){
 result.innerHTML=
 `<strong>Video source problem</strong><span>${esc(err.message)}</span>`;
 }
 return;
 }
 const blob=await captureVideoFrame(video);
 if(!blob)return;
 recognitionBusy=true;
 try{
 const fd=new FormData();
 fd.append(
 'session_id',
 String(sessionId)
 );
 fd.append(
 'frame',
 blob,
 'recognition.jpg'
 );
 // Send the current threshold with every frame so that
 // changing the UI threshold affects subsequent matches.
 fd.append(
 'threshold',
 Number(currentThreshold).toFixed(2)
 );
 const r=await api(
 '/recognition/frame',
 {
 method:'POST',
 body:fd
 }
 );
 if(!r || !Array.isArray(r.faces)){
 throw new Error(
 'Invalid recognition response from backend.'
 );
 }
 drawBoxes(
 r.faces,
 r.width||video.videoWidth,
 r.height||video.videoHeight,
 video
 );
 r.faces
 .filter(face=>face && face.matched)
 .forEach(addRecent);
 const modelState=document.getElementById('modelState');
 if(modelState){
 modelState.textContent=
 `Recognition active · ${r.faces.length} face${r.faces.length===1?'':'s'}`;
 }
 }catch(err){
 console.error(
 'Recognition error:',
 err
 );
 const result=document.getElementById('cameraResult');
 if(result){
 result.innerHTML=
 `<strong>Recognition warning</strong><span>${esc(err.message)}</span>`;
 }
 }finally{
 recognitionBusy=false;
 }
 }
 function addRecent(f){
 if(!f || !f.name)return;
 const el=document.getElementById('recentRecognized');
 if(!el)return;
 const key=String(f.student_id||f.name);
 if(
 el.querySelector(
 `[data-rec-id="${CSS.escape(key)}"]`
 )
 ){
 return;
 }
 if(el.querySelector('.empty')){
 el.innerHTML='';
 }
 const student=
 state.students.find(s=>String(s.id)===key) ||
 {name:f.name};
 const row=document.createElement('div');
 row.className='recent';
 row.setAttribute('data-rec-id',key);
 row.innerHTML=
 `${personAvatar(student,'avatar')}<div><strong>${esc(f.name)}</strong><span>Recognized · ${f.attendance_marked?'Present ✓':'Confirmed · waiting'}</span></div><span class="badge badge-success">${f.attendance_marked?'Present':'Match el.prepend(row);
 refreshSessionCounts();
 }
 async function refreshSessionCounts(){
 try{
 const rows=await api('/attendance');
 const todayRows=Array.isArray(rows)
 ? rows.filter(x=>x.attendance_date===today())
 : [];
 const presentCount=document.getElementById('presentCount');
 const notMarkedCount=document.getElementById('notMarkedCount');
 if(presentCount){
 presentCount.textContent=todayRows.length;
 }
 if(notMarkedCount){
 notMarkedCount.textContent=
 Math.max(
 0,
 state.students.length-todayRows.length
 );
 }
 }catch(_){}
 }
 async function startSource(){
 const sourceEl=document.getElementById('sourceType');
 if(!sourceEl)return false;
 const selectedSource=sourceEl.value;
 // Stop any previous source before starting the newly selected one.
 stopSource();
 clearBoxes();
 sourceType=selectedSource;
 sourceReady=false;
 const video=document.getElementById('cameraVideo');
 const img=document.getElementById('rtspImage');
 const cameraState=document.getElementById('cameraState');
 const modelState=document.getElementById('modelState');
 const result=document.getElementById('cameraResult');
 if(!video || !cameraState || !modelState || !result){
 return false;
 }
 try{
 // ----------------------------------------
 // WEBCAM
 // ----------------------------------------
 if(sourceType==='webcam'){
 cameraState.textContent='Requesting camera…';
 result.innerHTML=
 '<strong>Starting camera</strong><span>Waiting for browser camera permission.</span>';
 if(!navigator.mediaDevices?.getUserMedia){
 throw new Error(
 'Camera access is not supported by this browser.'
 );
 }
 sourceStream=
 await navigator.mediaDevices.getUserMedia({
 video:{
 facingMode:'user',
 width:{ideal:1280},
 height:{ideal:720}
 },
 audio:false
 });
 video.removeAttribute('src');
 video.srcObject=sourceStream;
 video.style.display='block';
 if(img){
 img.style.display='none';
 img.removeAttribute('src');
 }
 await video.play();
 await ensureVideoPlaying();
 cameraState.textContent='Camera active';
 modelState.textContent='Detection active';
 }
 // ----------------------------------------
 // PRE-RECORDED VIDEO
 // ----------------------------------------
 else if(sourceType==='video'){
 const fileInput=document.getElementById('videoFile');
 const file=fileInput?.files?.[0];
 if(!file){
 result.innerHTML=
 '<strong>Select a video</strong><span>Choose the classroom video first.</span>';
 return false;
 }
 cameraState.textContent='Loading video…';
 video.pause();
 video.srcObject=null;
 video.removeAttribute('src');
 const objectUrl=URL.createObjectURL(file);
 video.src=objectUrl;
 video.loop=false;
 video.style.display='block';
 if(img){
 img.style.display='none';
 img.removeAttribute('src');
 }
 await new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{
 reject(
 new Error('Video took too long to load.')
 );
 },10000);
 const loaded=()=>{
 clearTimeout(timeout);
 cleanup();
 resolve();
 };
 const failed=()=>{
 clearTimeout(timeout);
 cleanup();
 reject(
 new Error('The selected video cannot be played.')
 );
 };
 const cleanup=()=>{
 video.removeEventListener('loadedmetadata',loaded);
 video.removeEventListener('error',failed);
 };
 video.addEventListener('loadedmetadata',loaded,{once:true});
 video.addEventListener('error',failed,{once:true});
 });
 await video.play();
 await ensureVideoPlaying();
 cameraState.textContent='Recorded video active';
 modelState.textContent='Detection active';
 video.onended=async()=>{
 if(sessionId){
 await endSession();
 }
 };
 }
 // ----------------------------------------
 // AUTHORIZED RTSP
 // ----------------------------------------
 else if(sourceType==='rtsp'){
 const url=
 document.getElementById('rtspUrl')
 ?.value
 ?.trim();
 if(!url){
 result.innerHTML=
 '<strong>RTSP URL required</strong><span>Enter an authorized RTSP camera URL.</span>';
 return false;
 }
 video.pause();
 video.srcObject=null;
 video.removeAttribute('src');
 video.style.display='none';
 if(img){
 img.style.display='block';
 }
 cameraState.textContent='CCTV connecting…';
 modelState.textContent='Detection active';
 const r=await api(
 '/rtsp/start',
 {
 method:'POST',
 headers:{
 'Content-Type':'application/json'
 },
 body:JSON.stringify({
 url
 })
 }
 );
 if(!r?.stream_id){
 throw new Error(
 'RTSP backend did not return a stream ID.'
 );
 }
 rtspId=r.stream_id;
 sourceReady=true;
 cameraState.textContent='CCTV active';
 pollRtsp();
 }
 else{
 throw new Error('Unknown video source.');
 }
 sourceReady=true;
 document
 .getElementById('scanFrame')
 ?.classList
 .add('active');
 result.innerHTML=
 '<strong>Source ready</strong><span>Face detection is active. Start Attendance to enable recognition.</span>';
 // Detection is only a preview/face-localization step.
 // Recognition begins after an attendance session is created.
 if(sourceType!=='rtsp'){
 if(detectionTimer){
 clearInterval(detectionTimer);
 }
 detectionTimer=
 setInterval(
 detectCurrent,
 1500
 );
 await detectCurrent();
 }
 return true;
 }catch(err){
 console.error(
 'Source startup error:',
 err
 );
 sourceReady=false;
 cameraState.textContent='Source unavailable';
 modelState.textContent='Detection idle';
 result.innerHTML=
 `<strong>Source error</strong><span>${esc(err.message)}</span>`;
 if(sourceStream){
 sourceStream
 .getTracks()
 .forEach(track=>track.stop());
 sourceStream=null;
 }
 return false;
 }
 }
 async function pollRtsp(){
 if(!rtspId)return;
 const activeId=rtspId;
 try{
 const r=await api(
 '/rtsp/'+encodeURIComponent(activeId)+'/frame'
 );
 if(
 activeId!==rtspId ||
 !r
 ){
 return;
 }
 if(r.ok){
 const img=document.getElementById('rtspImage');
 if(img && r.image){
 img.src=r.image;
 }
 const faces=
 Array.isArray(r.faces)
 ? r.faces
 : [];
 drawBoxes(
 faces,
 r.width||960,
 r.height||540,
 null
 );
 const modelState=
 document.getElementById('modelState');
 if(modelState){
 modelState.textContent=
 sessionId
 ? `Recognition active · ${faces.length} face${faces.length===1?'':'s'}`
 : `Detection active · ${faces.length} face${faces.length===1?'':'s'}`;
 }
 }
 }catch(err){
 const modelState=
 document.getElementById('modelState');
 if(modelState && rtspId===activeId){
 modelState.textContent='CCTV connection waiting';
 }
 }
 if(rtspId===activeId){
 setTimeout(pollRtsp,500);
 }
 }
 async function beginSession(){
 updateThreshold();
 const room=
 document.getElementById('sessionRoom')
 ?.value
 ?.trim()||'';
 const confirmation=
 document.getElementById('roomConfirm');
 if(!room){
 const result=document.getElementById('cameraResult');
 if(result){
 result.innerHTML=
 '<strong>Room required</strong><span>Enter the physical room before starting attendance.</span>';
 }
 return;
 }
 if(!confirmation?.checked){
 const result=document.getElementById('cameraResult');
 if(result){
 result.innerHTML=
 '<strong>Room confirmation required</strong><span>Confirm the physical classroom before starting attendance.</span>';
 }
 return;
 }
 // sourceType alone does NOT mean the source is running.
 // sourceReady confirms that a usable source actually exists.
 if(!sourceReady){
 const started=await startSource();
 if(!started){
 return;
 }
 }
 // Verify an actual playable frame before creating the session.
 if(sourceType!=='rtsp'){
 try{
 await ensureVideoPlaying();
 }catch(err){
 const result=document.getElementById('cameraResult');
 if(result){
 result.innerHTML=
 `<strong>Video not ready</strong><span>${esc(err.message)}</span>`;
 }
 return;
 }
 }
 try{
 const r=await api(
 '/sessions',
 {
 method:'POST',
 headers:{
 'Content-Type':'application/json'
 },
 body:JSON.stringify({
 class_name:
 document.getElementById('sessionClass').value,
 division:
 document.getElementById('sessionDivision').value,
 subject:
 document.getElementById('sessionSubject')
 .value
 .trim()||'Untitled Lecture',
 room,
 source_type:
 sourceType,
 threshold:
 currentThreshold
 })
 }
 );
 if(!r?.session_id){
 throw new Error(
 'Backend did not return a session ID.'
 );
 }
 sessionId=r.session_id;
 sessionStartedAt=Date.now();
 if(detectionTimer){
 clearInterval(detectionTimer);
 detectionTimer=null;
 }
 // RTSP must be restarted with the session ID so that
 // the backend worker can mark attendance for this session.
 if(sourceType==='rtsp' && rtspId){
 const oldRtspId=rtspId;
 await api(
 '/rtsp/'+encodeURIComponent(oldRtspId)+'/stop',
 {
 method:'POST'
 }
 );
 const url=
 document.getElementById('rtspUrl')
 .value
 .trim();
 const rr=await api(
 '/rtsp/start',
 {
 method:'POST',
 headers:{
 'Content-Type':'application/json'
 },
 body:JSON.stringify({
 url,
 session_id:sessionId
 })
 }
 );
 if(!rr?.stream_id){
 throw new Error(
 'RTSP session worker could not be started.'
 );
 }
 rtspId=rr.stream_id;
 pollRtsp();
 }
 document.getElementById(
 'startSession'
 ).disabled=true;
 document.getElementById(
 'cameraRetry'
 ).disabled=true;
 document.getElementById(
 'endSession'
 ).disabled=false;
 document.getElementById(
 'sessionStatus'
 ).textContent='Session active';
 document.getElementById(
 'cameraResult'
 ).innerHTML=
 '<strong>AI recognition active</strong><span>FaceNet matching and duplicate-protected attendance are active.</span>';
 document.getElementById(
 'modelState'
 ).textContent='Recognition active';
 if(recognitionTimer){
 clearInterval(recognitionTimer);
 }
 recognitionTimer=
 setInterval(
 recognizeCurrent,
 RECOGNITION_INTERVAL*1000
 );
 // Perform the first recognition immediately.
 await recognizeCurrent();
 await refreshSessionCounts();
 sessionTimer=
 setInterval(
 ()=>{
 const e=
 document.getElementById('sessionTimer');
 if(!e)return;
 const sec=
 Math.floor(
 (Date.now()-sessionStartedAt)/1000
 );
 e.textContent=
 `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
 },
 1000
 );
 }catch(e){
 console.error(
 'Session creation error:',
 e
 );
 sessionId=null;
 if(recognitionTimer){
 clearInterval(recognitionTimer);
 recognitionTimer=null;
 }
 document.getElementById(
 'startSession'
 ).disabled=false;
 document.getElementById(
 'cameraResult'
 ).innerHTML=
 `<strong>Session error</strong><span>${esc(e.message)}</span>`;
 }
 }
 async function endSession(){
 const endingSessionId=sessionId;
 if(endingSessionId){
 try{
 await api(
 '/sessions/end',
 {
 method:'POST',
 headers:{
 'Content-Type':'application/json'
 },
 body:JSON.stringify({
 session_id:endingSessionId
 })
 }
 );
 }catch(_){}
 }
 if(sessionTimer){
 clearInterval(sessionTimer);
 sessionTimer=null;
 }
 sessionId=null;
 sessionStartedAt=null;
 stopSource();
 const startButton=document.getElementById('startSession');
 const retryButton=document.getElementById('cameraRetry');
 const endButton=document.getElementById('endSession');
 const status=document.getElementById('sessionStatus');
 const result=document.getElementById('cameraResult');
 const modelState=document.getElementById('modelState');
 if(startButton){
 startButton.disabled=false;
 }
 if(retryButton){
 retryButton.disabled=false;
 }
 if(endButton){
 endButton.disabled=true;
 }
 if(status){
 status.textContent='Ended';
 }
 if(modelState){
 modelState.textContent='Detection idle';
 }
 if(result){
 result.innerHTML=
 '<strong>Attendance ended</strong><span>Saved records remain available in Attendance Register.</span>';
 }
 }
 function setupRecognition(){
 const source=document.getElementById('sourceType');
 const vf=document.getElementById('videoSourceFields');
 const rf=document.getElementById('rtspSourceFields');
 const syncSourceFields=()=>{
 const value=source?.value||'webcam';
 if(vf){
 vf.style.display=value==='video'?'block':'none';
 }
 if(rf){
 rf.style.display=value==='rtsp'?'block':'none';
 }
 };
 source.onchange=()=>{
 sourceType=source.value;
 stopSource();
 clearBoxes();
 syncSourceFields();
 const cameraState=document.getElementById('cameraState');
 const modelState=document.getElementById('modelState');
 const result=document.getElementById('cameraResult');
 const scanFrame=document.getElementById('scanFrame');
 if(cameraState){
 cameraState.textContent='Source idle';
 }
 if(modelState){
 modelState.textContent='Detection idle';
 }
 if(result){
 result.innerHTML=
 '<strong>Ready</strong><span>Start the selected source to begin face detection.</span>';
 }
 if(scanFrame){
 scanFrame.classList.remove('active');
 }
 };
 syncSourceFields();
 const threshold=document.getElementById('threshold');
 if(threshold){
 threshold.addEventListener('input',updateThreshold);
 threshold.addEventListener('change',updateThreshold);
 updateThreshold();
 }
 document.getElementById('cameraRetry').onclick=async()=>{
 if(sessionId){
 return;
 }
 await startSource();
 };
 document.getElementById('startSession').onclick=
 async()=>{
 const button=document.getElementById('startSession');
 if(!button)return;
 button.disabled=true;
 try{
 // Always ensure that the selected source is actually running.
 if(!sourceReady){
 const started=await startSource();
 if(!started){
 return;
 }
 }
 await beginSession();
 }finally{
 // Re-enable only when a session was not successfully created.
 if(!sessionId){
 button.disabled=false;
 }
 }
 };
 document.getElementById('endSession').onclick=endSession;
 document.getElementById('videoFile').onchange=async()=>{
 if(source.value==='video' && !sessionId){
 await startSource();
 }
 };
 document.getElementById('rtspUrl').addEventListener(
 'change',
 async()=>{
 if(
 source.value==='rtsp' &&
 document.getElementById('rtspUrl').value.trim() &&
 !sessionId
 ){
 await startSource();
 }
 }
 );
 document.getElementById('rtspUrl').addEventListener(
 'blur',
 async()=>{
 if(
 source.value==='rtsp' &&
 document.getElementById('rtspUrl').value.trim() &&
 !rtspId &&
 !sessionId
 ){
 await startSource();
 }
 }
 );
 api('/recordings')
 .then(list=>{
 if(!Array.isArray(list))return;
 const saved=
 document.getElementById('savedRecording');
 if(!saved)return;
 list.forEach(x=>{
 const o=document.createElement('option');
 o.value=x.filename;
 o.textContent=x.filename;
 saved.appendChild(o);
 });
 })
 .catch(()=>{});
 }
 async function getAttendanceFilters(prefix){
 const q=id=>document.getElementById(prefix+id)?.value||'';
 const params=new URLSearchParams({from_date:q('From'),to_date:q('To'),class_name:q('Class'),division:q('Division'),subject:q('Subject'),student:q('Student'),room:q('Room'),status:q('Status')});
 return api('/attendance?'+params.toString());
 }
 async function setupAttendance(){const update=async()=>{try{const list=await getAttendanceFilters('att');document.getElementById('attendanceResults').innerHTML=attendanceTable(list);}catch(e){document.getElementById('attendanceResults async function setupReports(){const update=async()=>{try{const list=await getAttendanceFilters('rep');const p=list.length;document.getElementById('reportKpis').innerHTML=`<div class="kpi"><strong>${list.length}</strong><span>Records</ function settings(){return `<div class="page-title"><div><h1>Settings</h1><p>Recognition configuration and account preferences.</p></div></div><div class="settings-shell"><div class="settings-overview card"><div class="settings-profil function setupGlobal(){
 document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>{location.hash='#'+b.dataset.route;}));
 document.getElementById('sidebarToggle')?.addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
 document.getElementById('themeToggle')?.addEventListener('click',toggleTheme);
 document.getElementById('profileToggle')?.addEventListener('click',()=>document.getElementById('profileMenu').classList.toggle('open'));
 document.getElementById('menuTheme')?.addEventListener('click',toggleTheme);
 document.getElementById('menuLogout')?.addEventListener('click',()=>{state.loggedIn=false;render();});
 // Action handling is delegated once globally below; do not register it per render.
 }
 function globalActionHandler(e){
 const v=e.target.closest?.('[data-view-student]'), ed=e.target.closest?.('[data-edit-student]'), del=e.target.closest?.('[data-delete-student]');
 if(v)viewStudentModal(v.dataset.viewStudent); else if(ed)addEditModal(ed.dataset.editStudent); else if(del)deleteStudent(del.dataset.deleteStudent);
 const menu=document.getElementById('profileMenu');if(menu&&!e.target.closest('#profileToggle')&&!e.target.closest('#profileMenu'))menu.classList.remove('open');
 }
 function toggleTheme(){state.theme=state.theme==='dark'?'light':'dark';localStorage.setItem('aifras-theme',state.theme);applyTheme();}
 function applyTheme(){document.documentElement.dataset.theme=state.theme;}
 document.addEventListener('click', globalActionHandler);
 async function render(){
 applyTheme();await hydrate();
 const root=document.getElementById('app');const r=routes.includes(location.hash.replace('#/','').replace('#',''))?location.hash.replace('#/','').replace('#',''):'dashboard';
 const meta={dashboard:['Dashboard','Overview of today’s attendance and system activity'],students:['Students','Student records and face registration'],recognition:['Live Recognition','Real-time face recognition attendance'],attendan root.innerHTML=shell(r,...meta);const vr=document.getElementById('viewRoot');vr.innerHTML=r==='dashboard'?dashboard():r==='students'?students():r==='recognition'?recognition():r==='attendance'?attendance():r==='reports'?reports():se setupGlobal();if(r==='students')setupStudents();if(r==='recognition')setupRecognition();if(r==='attendance')setupAttendance();if(r==='reports')setupReports();
 }
 window.addEventListener('hashchange',async()=>{
 if(sessionId){
 await endSession();
 }else{
 stopSource();
 }
 if(sessionTimer){
 clearInterval(sessionTimer);
 sessionTimer=null;
 }
 render();
 });
 window.addEventListener('beforeunload',()=>{stopSource();});
 render();
})();