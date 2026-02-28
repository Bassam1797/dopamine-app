const TODAY = new Date().toISOString().slice(0,10);
const META_KEY = "dopamineMeta";
const DATA_KEY = "dopamineData";
const SCHEDULE_KEY = "dopamineScheduled";
const NOTES_KEY = "dopamineNotes";
const SETTINGS_KEY = "dopamineSettings";

let meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
let data = JSON.parse(localStorage.getItem(DATA_KEY) || "{}");
let scheduled = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || "[]");
let notes = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
let currentDate = TODAY;
let activeNoteId = null;
const taskTimers = {};

if (!meta.startDate) meta.startDate = TODAY;
if (meta.loopWeeks === undefined) meta.loopWeeks = true;
if (!data.days) data.days = {};
settings = {
  autostartChain: !!settings.autostartChain,
  quickCapture: settings.quickCapture !== false,
  zenMode: !!settings.zenMode,
  heatmap: settings.heatmap !== false,
  haptics: !!settings.haptics,
  lastTimerTaskId: null,
  ...settings
};

const plan = {
  1: { actions: ["Wake up same time", "Plan day in morning", "Walk 20 min"], rules: ["No social in morning", "Limit sugar"] },
  2: { actions: ["Priority task 1h", "Exercise 30 min", "Read 15 min"], rules: ["No screens after 10pm", "Limit caffeine"] },
  3: { actions: ["Hardest task first", "Stretch 10 min", "Read 15 min"], rules: ["No phone in bedroom", "Avoid junk food"] },
  4: { actions: ["Deep work 2h", "Exercise 30 min", "Read 15 min"], rules: ["No social during work", "Drink 2L water"] }
};

const $ = (id) => document.getElementById(id);
["Auto",1,2,3,4].forEach(w => { const opt = document.createElement("option"); opt.value=String(w); opt.textContent=String(w); $("weekSel").appendChild(opt); });
$("weekSel").value = localStorage.getItem("dopamineWeekMode") || "Auto";
$("dateSel").value = currentDate;

function saveMeta(){ localStorage.setItem(META_KEY, JSON.stringify(meta)); }
function saveData(){ localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
function saveScheduled(){ localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduled)); }
function saveNotes(){ localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function getDay(key){ if (!data.days[key]) data.days[key] = {actions:[],rules:[],tasks:[],points:0}; return data.days[key]; }

function getAutoWeek(dateStr){
  const d = Math.floor((new Date(dateStr) - new Date(meta.startDate))/86400000);
  const weekIndex = Math.max(0, Math.floor(d / 7));
  return meta.loopWeeks ? (weekIndex % 4)+1 : Math.min(4, weekIndex+1);
}

function buzz(pattern = [35]){ if (settings.haptics && navigator.vibrate) navigator.vibrate(pattern); }
async function notify(title, body){
  if (Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg?.showNotification) reg.showNotification(title, { body });
}

function updateZen(){ document.body.classList.toggle("zen", settings.zenMode); }
function applySettingsToUI(){
  $("autostartChainToggle").checked = settings.autostartChain;
  $("quickCaptureToggle").checked = settings.quickCapture;
  $("zenToggle").checked = settings.zenMode;
  $("heatmapToggle").checked = settings.heatmap;
  $("hapticsToggle").checked = settings.haptics;
  $("quickCaptureBtn").style.display = settings.quickCapture ? "block" : "none";
  $("heatmap").style.display = settings.heatmap ? "grid" : "none";
  updateZen();
}

function render(){
  const dayData = getDay(currentDate);
  $("startDateLabel").textContent = meta.startDate;
  $("loopToggle").checked = !!meta.loopWeeks;
  renderTasks(dayData);
  renderScheduled();
  renderPlanner();
  renderNotes();
  updateStats();
  applySettingsToUI();
}

function renderTasks(dayData){
  const box = $("tasksList"); box.innerHTML = "";
  dayData.tasks.forEach((t, i)=>{
    const row = document.createElement("div"); row.className = "task-row";
    row.innerHTML = `<input type="checkbox" ${t.done?"checked":""}><input type="text" value="${(t.text||"").replace(/"/g,"&quot;")}" placeholder="Action task"><input type="number" min="1" value="${t.min||25}"><button>Start</button><button>Stop</button><button>Complete</button><div class="task-countdown" id="taskCD${i}"></div>`;
    const [chk, txt, mins, startBtn, stopBtn, doneBtn] = row.children;
    chk.onchange = ()=>{ t.done = chk.checked; if (t.done) {dayData.points=(dayData.points||0)+10; buzz();} saveData(); updateStats(); };
    txt.oninput = ()=>{ t.text = txt.value; saveData(); };
    mins.onchange = ()=>{ t.min = parseInt(mins.value,10) || 25; saveData(); };
    startBtn.onclick = ()=> startTaskTimer(i, t.min || 25, t.text || `Task ${i+1}`);
    stopBtn.onclick = ()=> stopTaskTimer(i);
    doneBtn.onclick = ()=>{ t.done = true; chk.checked = true; saveData(); updateStats(); startNextTask(i+1); buzz([20,20,20]); };
    box.appendChild(row);
  });
}

function startNextTask(nextIndex){
  if (!settings.autostartChain) return;
  const day = getDay(currentDate);
  const next = day.tasks[nextIndex];
  if (next && !next.done) startTaskTimer(nextIndex, next.min || 25, next.text || `Task ${nextIndex+1}`);
}

function startTaskTimer(index, minutes, label){
  stopTaskTimer(index);
  const end = Date.now() + Math.max(1, minutes) * 60000;
  let preAlertSent = false;
  taskTimers[index] = setInterval(async ()=>{
    const left = end - Date.now();
    const el = document.getElementById(`taskCD${index}`);
    if (!el) return;
    if (!preAlertSent && left <= 120000) { preAlertSent = true; notify("FocusTasks", `${label}: 2 minutes left`); }
    if (left <= 0){
      clearInterval(taskTimers[index]); delete taskTimers[index]; el.textContent = "⏰";
      notify("FocusTasks", `${label} finished`); buzz([90,30,90]);
      startNextTask(index+1);
      return;
    }
    const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
    el.textContent = `${m}:${String(s).padStart(2,"0")}`;
  }, 250);
}
function stopTaskTimer(index){ if (taskTimers[index]) { clearInterval(taskTimers[index]); delete taskTimers[index]; } const el = document.getElementById(`taskCD${index}`); if (el) el.textContent = ""; }

$("addTaskBtn").onclick = ()=>{ const day = getDay(currentDate); day.tasks.push({text:"",min:25,done:false}); saveData(); renderTasks(day); };

$("schedForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const text = $("schedText").value.trim(); const date = $("schedDate").value; const time = $("schedTime").value;
  if (!text || !date || !time) return alert("Please fill title/date/time");
  scheduled.push({id: crypto.randomUUID?.() || String(Date.now()), text, when: new Date(`${date}T${time}:00`).toISOString(), min: parseInt($("schedMin").value,10)||25, repeat: $("schedRepeat").value, autoStart: $("schedAutoStart").checked});
  saveScheduled(); e.target.reset(); renderScheduled(); renderPlanner();
});

function nextOccurrence(iso, repeat){
  const d = new Date(iso);
  if (repeat === "daily") d.setDate(d.getDate()+1);
  else if (repeat === "weekly") d.setDate(d.getDate()+7);
  else if (repeat === "weekdays") { do { d.setDate(d.getDate()+1);} while ([0,6].includes(d.getDay())); }
  else if (repeat === "monthly") d.setMonth(d.getMonth()+1);
  else if (repeat === "every3") d.setDate(d.getDate()+3);
  else return null;
  return d.toISOString();
}

function sendScheduledToToday(t){
  const day = getDay(TODAY);
  day.tasks.push({text:t.text,min:t.min,done:false});
  const idx = day.tasks.length - 1;
  if (t.autoStart) startTaskTimer(idx, t.min, t.text);
  const next = nextOccurrence(t.when, t.repeat);
  if (next) t.when = next; else scheduled = scheduled.filter(s=>s.id!==t.id);
  saveData(); saveScheduled(); render();
}

function snooze(t, kind){
  const d = new Date(t.when);
  if (kind === "10m") d.setMinutes(d.getMinutes()+10);
  if (kind === "1h") d.setHours(d.getHours()+1);
  if (kind === "tomorrow") d.setDate(d.getDate()+1);
  t.when = d.toISOString(); saveScheduled(); renderScheduled(); renderPlanner();
}

function renderScheduled(){
  const box = $("scheduledList"); box.innerHTML = "";
  scheduled.sort((a,b)=>new Date(a.when)-new Date(b.when));
  if (!scheduled.length) { box.innerHTML = `<div class='mut'>No upcoming tasks.</div>`; return; }
  scheduled.forEach(t=>{
    const row = document.createElement("div"); row.className = "sched-row";
    const dt = new Date(t.when);
    row.innerHTML = `<input type='text' value="${(t.text||"").replace(/"/g,"&quot;")}"/><input type='date' value='${dt.toISOString().slice(0,10)}'/><input type='time' value='${dt.toISOString().slice(11,16)}'/><input type='number' min='1' value='${t.min||25}'/><button>Today</button><button>+10m</button><button>+1h</button><button>Tomorrow</button><button>Del</button>`;
    const [title,date,time,mins,todayBtn,s10,s1,tom,del] = row.children;
    title.oninput=()=>{t.text=title.value; saveScheduled(); renderPlanner();};
    date.onchange=()=>{t.when = new Date(`${date.value}T${time.value}:00`).toISOString(); saveScheduled(); renderPlanner();};
    time.onchange=()=>{t.when = new Date(`${date.value}T${time.value}:00`).toISOString(); saveScheduled(); renderPlanner();};
    mins.onchange=()=>{t.min=parseInt(mins.value,10)||25; saveScheduled();};
    todayBtn.onclick=()=>sendScheduledToToday(t);
    s10.onclick=()=>snooze(t,"10m"); s1.onclick=()=>snooze(t,"1h"); tom.onclick=()=>snooze(t,"tomorrow");
    del.onclick=()=>{scheduled=scheduled.filter(s=>s.id!==t.id); saveScheduled(); render();};
    box.appendChild(row);
  });
}

function renderPlanner(){
  const g = $("plannerGrid"); g.innerHTML = "";
  for (let i=0;i<7;i++){
    const d = new Date(); d.setDate(d.getDate()+i); const key = d.toISOString().slice(0,10);
    const dayItems = scheduled.filter(t=>new Date(t.when).toISOString().slice(0,10)===key);
    const col = document.createElement("div"); col.className = "planner-day";
    col.innerHTML = `<h4>${d.toLocaleDateString(undefined,{weekday:"short"})}</h4>`;
    if (!dayItems.length) col.innerHTML += `<div class='mut'>—</div>`;
    dayItems.forEach(item=>{ col.innerHTML += `<div class='plan-item'>• ${item.text} <small>${new Date(item.when).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>`; });
    g.appendChild(col);
  }
}

function updateStats(){
  const day = getDay(currentDate);
  const checks = (day.actions||[]).concat(day.rules||[]);
  const tasks = day.tasks||[];
  const done = tasks.filter(t=>t.done).length + checks.filter(Boolean).length;
  const total = tasks.length + checks.length;
  const dayPercent = total ? Math.round((done/total)*100) : 0;
  $("score").textContent = `${dayPercent}%`;
  $("barToday").style.width = `${dayPercent}%`;

  let wDone=0,wTotal=0;
  Object.entries(data.days).forEach(([k,dd])=>{ if (getAutoWeek(k)===getAutoWeek(currentDate)) { const ch=(dd.actions||[]).concat(dd.rules||[]); wDone += (dd.tasks||[]).filter(t=>t.done).length + ch.filter(Boolean).length; wTotal += (dd.tasks||[]).length + ch.length; } });
  const wPct = wTotal ? Math.round((wDone/wTotal)*100) : 0;
  $("weekProg").textContent = `${wPct}%`; $("barWeek").style.width = `${wPct}%`;

  let streak = 0; const d = new Date();
  while(true){ const key=d.toISOString().slice(0,10); const v=data.days[key]; if (!v) break; const t=v.tasks||[]; if (t.length && t.every(x=>x.done)) { streak++; d.setDate(d.getDate()-1); } else break; }
  $("streak").textContent = streak;
  const points = Object.values(data.days).reduce((sum,dd)=>sum + (dd.points||0), 0);
  $("points").textContent = points;
  renderHeatmap();
}

function renderHeatmap(){
  const hm = $("heatmap"); hm.innerHTML = "";
  for (let i=20;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i); const key=d.toISOString().slice(0,10); const dd=data.days[key];
    const done=(dd?.tasks||[]).filter(t=>t.done).length||0; const total=(dd?.tasks||[]).length||0; const ratio=total?done/total:0;
    const cell = document.createElement("div"); cell.className="hm-cell"; cell.title=key;
    cell.style.opacity = 0.2 + ratio*0.8; hm.appendChild(cell);
  }
}

function renderNotes(){
  const list = $("notesList"); list.innerHTML = "";
  notes.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned));
  notes.forEach(n=>{
    const btn = document.createElement("button"); btn.className = `note-item ${activeNoteId===n.id?"active":""}`;
    btn.textContent = `${n.pinned?"📌 ":""}${n.folder?`[${n.folder}] `:""}${n.title||"Untitled"}`;
    btn.onclick = ()=>{ activeNoteId=n.id; $("noteBody").value=n.body||""; renderNotes(); };
    btn.oncontextmenu = (e)=>{ e.preventDefault(); n.pinned = !n.pinned; saveNotes(); renderNotes(); };
    list.appendChild(btn);
  });
}

$("newNoteBtn").onclick = ()=>{
  const n = { id: crypto.randomUUID?.() || String(Date.now()), folder: $("noteFolder").value.trim(), title: $("noteTitle").value.trim() || "New note", body:"", pinned:false };
  notes.push(n); activeNoteId = n.id; saveNotes(); renderNotes();
};
$("noteBody").addEventListener("input", ()=>{
  const n = notes.find(x=>x.id===activeNoteId); if (!n) return; n.body = $("noteBody").value; saveNotes();
});
$("noteBody").addEventListener("keydown", (e)=>{
  if (e.key === "/") {
    setTimeout(()=>{
      const body = $("noteBody").value;
      if (body.endsWith("/h2")) $("noteBody").value = body.replace(/\/h2$/,"\n## Heading\n");
      if (body.endsWith("/check")) $("noteBody").value = body.replace(/\/check$/,"\n- [ ] Item\n");
      if (body.endsWith("/div")) $("noteBody").value = body.replace(/\/div$/,"\n---\n");
      const n = notes.find(x=>x.id===activeNoteId); if (n) { n.body = $("noteBody").value; saveNotes(); }
    }, 0);
  }
});
$("toggleSprintBtn").onclick = ()=> document.body.classList.toggle("sprint");

function startTimer(mins){
  const end = Date.now() + mins*60000;
  clearInterval(window.breakTimer);
  window.breakTimer = setInterval(()=>{
    const left = end-Date.now();
    if (left<=0){ clearInterval(window.breakTimer); $("timerDisplay").textContent = "⏰ Done"; buzz([60]); return; }
    $("timerDisplay").textContent = `Break ${Math.floor(left/60000)}:${String(Math.floor((left%60000)/1000)).padStart(2,"0")}`;
  }, 250);
}
document.querySelectorAll(".breakBtn").forEach(btn => btn.onclick = ()=> startTimer(parseInt(btn.dataset.min,10)));

$("quickCaptureBtn").onclick = ()=>{
  const title = prompt("Quick Capture task title:");
  if (!title) return;
  const day = getDay(TODAY); day.tasks.push({text:title,min:25,done:false}); saveData(); render();
};

$("notifyBtn").onclick = async ()=>{ await Notification.requestPermission(); alert(`Notifications: ${Notification.permission}`); };

$("exportIcsBtn").onclick = ()=>{
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//FocusTasks//EN"];
  scheduled.forEach((t,i)=>{ const start = new Date(t.when); const end = new Date(start.getTime() + (t.min||25)*60000); const f=(d)=>d.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z"; lines.push("BEGIN:VEVENT",`UID:${t.id||i}@focustasks`,`DTSTAMP:${f(new Date())}`,`DTSTART:${f(start)}`,`DTEND:${f(end)}`,`SUMMARY:${t.text}`,"END:VEVENT"); });
  lines.push("END:VCALENDAR");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], {type:"text/calendar"})); a.download = "focustasks-upcoming.ics"; a.click();
};

async function deriveKey(passphrase, salt){
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2", salt, iterations:120000, hash:"SHA-256"}, baseKey, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
}
async function encryptPayload(payload, passphrase){
  const iv = crypto.getRandomValues(new Uint8Array(12)); const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, new TextEncoder().encode(JSON.stringify(payload)));
  return JSON.stringify({v:1, iv:Array.from(iv), salt:Array.from(salt), c:Array.from(new Uint8Array(cipher))});
}
async function decryptPayload(blobText, passphrase){
  const obj = JSON.parse(blobText); const iv = new Uint8Array(obj.iv); const salt = new Uint8Array(obj.salt); const c = new Uint8Array(obj.c);
  const key = await deriveKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, c);
  return JSON.parse(new TextDecoder().decode(plain));
}

$("exportEncryptedBtn").onclick = async ()=>{
  const pass = prompt("Passphrase for encrypted backup (.ftb):"); if (!pass) return;
  const payload = {meta,data,scheduled,notes,settings};
  const ftb = await encryptPayload(payload, pass);
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ftb], {type:"application/octet-stream"})); a.download="focustasks-backup.ftb"; a.click();
};

window.exportJSON = function(){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify({meta,data,scheduled,notes,settings},null,2)],{type:"application/json"})); a.download="focustasks-data.json"; a.click(); };
window.exportCSV = function(){ const rows=[["Date","Tasks Done","Tasks Total"]]; Object.keys(data.days).sort().forEach(k=>{ const t=data.days[k].tasks||[]; rows.push([k,t.filter(x=>x.done).length,t.length]);}); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"})); a.download="focustasks-data.csv"; a.click(); };

$("importFile").onchange = async function(){
  const file = this.files[0]; if (!file) return;
  const text = await file.text();
  try {
    let obj;
    if (file.name.endsWith(".ftb")) { const pass = prompt("Passphrase to restore backup:"); if (!pass) return; obj = await decryptPayload(text, pass); }
    else obj = JSON.parse(text);
    meta = obj.meta || meta; data = obj.data || data; scheduled = obj.scheduled || scheduled; notes = obj.notes || notes; settings = {...settings, ...(obj.settings||{})};
    saveMeta(); saveData(); saveScheduled(); saveNotes(); saveSettings(); render();
  } catch { alert("Import failed. Check file/passphrase."); }
};

async function webDavRequest(method, path, body){
  const url = $("davUrl").value.trim().replace(/\/$/,"") + "/" + path;
  const auth = btoa(`${$("davUser").value}:${$("davPass").value}`);
  const resp = await fetch(url, {method, headers:{Authorization:`Basic ${auth}`}, body});
  return resp;
}
$("davTestBtn").onclick = async ()=>{ try { const r = await webDavRequest("PROPFIND", "", null); alert(r.ok ? "WebDAV OK" : `WebDAV failed ${r.status}`);} catch (e) { alert(`WebDAV error: ${e.message}`);} };
$("davSyncBtn").onclick = async ()=>{
  try {
    const payload = JSON.stringify({meta,data,scheduled,notes,settings});
    const put = await webDavRequest("PUT", "focustasks-sync.json", payload);
    if (!put.ok) throw new Error(`PUT ${put.status}`);
    const get = await webDavRequest("GET", "focustasks-sync.json");
    if (get.ok) { const remote = await get.json(); meta=remote.meta||meta; data=remote.data||data; scheduled=remote.scheduled||scheduled; notes=remote.notes||notes; settings={...settings,...(remote.settings||{})}; saveMeta(); saveData(); saveScheduled(); saveNotes(); saveSettings(); render(); }
    alert("Sync complete");
  } catch(e){ alert(`Sync failed: ${e.message}`); }
};

function checkScheduledDue(){ const now = Date.now(); scheduled.filter(t=>new Date(t.when).getTime()<=now).forEach(sendScheduledToToday); }
setInterval(checkScheduledDue, 30000);

$("weekSel").onchange = ()=>{ localStorage.setItem("dopamineWeekMode", $("weekSel").value); render(); };
$("dateSel").onchange = ()=>{ currentDate = $("dateSel").value; render(); };
$("darkToggle").onclick = ()=>{ document.body.classList.toggle("dark"); localStorage.setItem("dopamineDark", document.body.classList.contains("dark")); };
if (localStorage.getItem("dopamineDark") === "true") document.body.classList.add("dark");

$("resetStartBtn").onclick = ()=>{ meta.startDate = TODAY; saveMeta(); render(); };
$("loopToggle").onchange = ()=>{ meta.loopWeeks = $("loopToggle").checked; saveMeta(); };
$("autostartChainToggle").onchange = ()=>{ settings.autostartChain = $("autostartChainToggle").checked; saveSettings(); };
$("quickCaptureToggle").onchange = ()=>{ settings.quickCapture = $("quickCaptureToggle").checked; saveSettings(); applySettingsToUI(); };
$("zenToggle").onchange = ()=>{ settings.zenMode = $("zenToggle").checked; saveSettings(); applySettingsToUI(); };
$("heatmapToggle").onchange = ()=>{ settings.heatmap = $("heatmapToggle").checked; saveSettings(); applySettingsToUI(); };
$("hapticsToggle").onchange = ()=>{ settings.haptics = $("hapticsToggle").checked; saveSettings(); };

render();
checkScheduledDue();
