 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/app.js b/app.js
index d3097f6334db796b078d3225dae4a69c7f248054..c200134edb78be8c024061dcf0be7090a778d126 100644
--- a/app.js
+++ b/app.js
@@ -1,521 +1,367 @@
-/* ==== Dopamine App — Full JS with dynamic tasks, scheduled tasks (repeat + auto-move), planner, stats, and loud beep-only alerts ==== */
-
-/* ---------------- Program plan (edit if you want) ---------------- */
-const plan = {
-  1: { actions: ["Wake up same time", "Plan day in morning", "Walk 20 min", "Read 15 min"], rules: ["No social in morning", "Limit sugar"], journal: "Write 3 gratitudes" },
-  2: { actions: ["Wake up same time", "Priority task 1h", "Exercise 30 min", "Read 15 min"], rules: ["No screens after 10pm", "Limit caffeine"], journal: "Reflect on wins" },
-  3: { actions: ["Wake up same time", "Hardest task first", "Stretch 10 min", "Read 15 min"], rules: ["No phone in bedroom", "Avoid junk food"], journal: "Note challenges" },
-  4: { actions: ["Wake up same time", "Deep work 2h", "Exercise 30 min", "Read 15 min"], rules: ["No social during work", "Drink 2L water"], journal: "How to improve tomorrow?" }
-};
-
-/* ---------------- Persistent state ---------------- */
 const TODAY = new Date().toISOString().slice(0,10);
 const META_KEY = "dopamineMeta";
 const DATA_KEY = "dopamineData";
 const SCHEDULE_KEY = "dopamineScheduled";
+const NOTES_KEY = "dopamineNotes";
+const SETTINGS_KEY = "dopamineSettings";
 
 let meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
 let data = JSON.parse(localStorage.getItem(DATA_KEY) || "{}");
 let scheduled = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || "[]");
+let notes = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
+let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
+let currentDate = TODAY;
+let activeNoteId = null;
+const taskTimers = {};
 
 if (!meta.startDate) meta.startDate = TODAY;
 if (meta.loopWeeks === undefined) meta.loopWeeks = true;
-saveMeta();
-
-if (!data.days) data.days = {}; // { 'YYYY-MM-DD': { actions:[], rules:[], tasks:[], journal:'', mood:int, energy:int } }
-saveData();
-
-/* ---------------- Elements ---------------- */
-const weekSel = document.getElementById("weekSel");
-const dateSel = document.getElementById("dateSel");
-
-const actionsDiv = document.getElementById("actions");
-const rulesDiv = document.getElementById("rules");
-const journal = document.getElementById("journal");
-const moodBtns = document.getElementById("moodBtns");
-const energyBtns = document.getElementById("energyBtns");
-
-const tasksList = document.getElementById("tasksList");
-const addTaskBtn = document.getElementById("addTaskBtn");
-
-const schedForm = document.getElementById("schedForm");
-const schedText = document.getElementById("schedText");
-const schedDate = document.getElementById("schedDate");
-const schedTime = document.getElementById("schedTime");
-const schedMin  = document.getElementById("schedMin");
-const schedRepeat = document.getElementById("schedRepeat");
-const schedAutoStart = document.getElementById("schedAutoStart");
-const scheduledList = document.getElementById("scheduledList");
-
-const plannerGrid = document.getElementById("plannerGrid");
-
-const streakEl = document.getElementById("streak");
-const scoreEl = document.getElementById("score");
-const weekProgEl = document.getElementById("weekProg");
-const barToday = document.getElementById("barToday");
-const barWeek = document.getElementById("barWeek");
-const ringDaily = document.getElementById("ringDaily");
-const ringWeek = document.getElementById("ringWeek");
-
-const startDateLabel = document.getElementById("startDateLabel");
-const resetStartBtn   = document.getElementById("resetStartBtn");
-const loopToggle      = document.getElementById("loopToggle");
-
-/* ---------------- Dark mode ---------------- */
-document.getElementById("darkToggle").addEventListener("click", () => {
-  document.body.classList.toggle("dark");
-  localStorage.setItem("dopamineDark", document.body.classList.contains("dark"));
-});
-if (localStorage.getItem("dopamineDark") === "true") document.body.classList.add("dark");
+if (!data.days) data.days = {};
+settings = {
+  autostartChain: !!settings.autostartChain,
+  quickCapture: settings.quickCapture !== false,
+  zenMode: !!settings.zenMode,
+  heatmap: settings.heatmap !== false,
+  haptics: !!settings.haptics,
+  lastTimerTaskId: null,
+  ...settings
+};
 
-/* ---------------- Week selector ---------------- */
-["Auto", 1, 2, 3, 4].forEach(w => {
-  const opt = document.createElement("option");
-  opt.value = String(w); opt.textContent = String(w);
-  weekSel.appendChild(opt);
-});
-const WEEK_MODE_KEY = "dopamineWeekMode";
-weekSel.value = localStorage.getItem(WEEK_MODE_KEY) || "Auto";
-weekSel.onchange = () => { localStorage.setItem(WEEK_MODE_KEY, weekSel.value); render(); };
+const plan = {
+  1: { actions: ["Wake up same time", "Plan day in morning", "Walk 20 min"], rules: ["No social in morning", "Limit sugar"] },
+  2: { actions: ["Priority task 1h", "Exercise 30 min", "Read 15 min"], rules: ["No screens after 10pm", "Limit caffeine"] },
+  3: { actions: ["Hardest task first", "Stretch 10 min", "Read 15 min"], rules: ["No phone in bedroom", "Avoid junk food"] },
+  4: { actions: ["Deep work 2h", "Exercise 30 min", "Read 15 min"], rules: ["No social during work", "Drink 2L water"] }
+};
 
-/* ---------------- Date init ---------------- */
-let currentDate = TODAY;
-dateSel.value = currentDate;
-dateSel.addEventListener("change", () => { currentDate = dateSel.value; stopAllTaskTimers(); render(); });
+const $ = (id) => document.getElementById(id);
+["Auto",1,2,3,4].forEach(w => { const opt = document.createElement("option"); opt.value=String(w); opt.textContent=String(w); $("weekSel").appendChild(opt); });
+$("weekSel").value = localStorage.getItem("dopamineWeekMode") || "Auto";
+$("dateSel").value = currentDate;
 
-/* ---------------- Helpers ---------------- */
 function saveMeta(){ localStorage.setItem(META_KEY, JSON.stringify(meta)); }
 function saveData(){ localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
 function saveScheduled(){ localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduled)); }
-function daysBetween(a, b){ return Math.floor((new Date(b) - new Date(a)) / 86400000); }
+function saveNotes(){ localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }
+function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
+function getDay(key){ if (!data.days[key]) data.days[key] = {actions:[],rules:[],tasks:[],points:0}; return data.days[key]; }
+
 function getAutoWeek(dateStr){
-  const d = daysBetween(meta.startDate, dateStr);
-  const weekIndex = Math.max(0, Math.floor(d / 7));  // 0..∞
-  return meta.loopWeeks ? (weekIndex % 4) + 1 : Math.min(4, weekIndex + 1);
-}
-function getDay(key){
-  if (!data.days[key]) data.days[key] = { actions:[], rules:[], tasks:[], journal:"", mood:null, energy:null };
-  return data.days[key];
+  const d = Math.floor((new Date(dateStr) - new Date(meta.startDate))/86400000);
+  const weekIndex = Math.max(0, Math.floor(d / 7));
+  return meta.loopWeeks ? (weekIndex % 4)+1 : Math.min(4, weekIndex+1);
 }
 
-/* ---------------- Render ---------------- */
-function render(){
-  // Settings
-  startDateLabel.textContent = meta.startDate;
-  loopToggle.checked = !!meta.loopWeeks;
+function buzz(pattern = [35]){ if (settings.haptics && navigator.vibrate) navigator.vibrate(pattern); }
+async function notify(title, body){
+  if (Notification.permission !== "granted") return;
+  const reg = await navigator.serviceWorker?.getRegistration();
+  if (reg?.showNotification) reg.showNotification(title, { body });
+}
 
-  // Compute week for view
-  const weekNum = (weekSel.value === "Auto") ? getAutoWeek(currentDate) : parseInt(weekSel.value,10);
-  if (weekSel.value === "Auto") weekSel.options[0].textContent = `Auto (Week ${weekNum})`; else weekSel.options[0].textContent = "Auto";
+function updateZen(){ document.body.classList.toggle("zen", settings.zenMode); }
+function applySettingsToUI(){
+  $("autostartChainToggle").checked = settings.autostartChain;
+  $("quickCaptureToggle").checked = settings.quickCapture;
+  $("zenToggle").checked = settings.zenMode;
+  $("heatmapToggle").checked = settings.heatmap;
+  $("hapticsToggle").checked = settings.haptics;
+  $("quickCaptureBtn").style.display = settings.quickCapture ? "block" : "none";
+  $("heatmap").style.display = settings.heatmap ? "grid" : "none";
+  updateZen();
+}
 
+function render(){
   const dayData = getDay(currentDate);
-
-  // Actions
-  actionsDiv.innerHTML = "";
-  plan[weekNum].actions.forEach((txt, i)=>{
-    const lbl = document.createElement("label");
-    const cb = document.createElement("input");
-    cb.type = "checkbox";
-    cb.checked = !!dayData.actions[i];
-    cb.addEventListener("change", ()=>{ dayData.actions[i] = cb.checked; saveData(); updateStats(); });
-    lbl.appendChild(cb); lbl.appendChild(document.createTextNode(txt));
-    actionsDiv.appendChild(lbl);
-  });
-
-  // Rules
-  rulesDiv.innerHTML = "";
-  plan[weekNum].rules.forEach((txt, i)=>{
-    const lbl = document.createElement("label");
-    const cb = document.createElement("input");
-    cb.type = "checkbox";
-    cb.checked = !!dayData.rules[i];
-    cb.addEventListener("change", ()=>{ dayData.rules[i] = cb.checked; saveData(); updateStats(); });
-    lbl.appendChild(cb); lbl.appendChild(document.createTextNode(txt));
-    rulesDiv.appendChild(lbl);
-  });
-
-  // Journal
-  journal.value = dayData.journal || "";
-  journal.oninput = ()=>{ dayData.journal = journal.value; saveData(); };
-
-  // Mood & Energy
-  renderMoodEnergy(dayData);
-
-  // Tasks & Scheduled & Planner
+  $("startDateLabel").textContent = meta.startDate;
+  $("loopToggle").checked = !!meta.loopWeeks;
   renderTasks(dayData);
   renderScheduled();
   renderPlanner();
-
-  // Stats/Badges
+  renderNotes();
   updateStats();
-  renderBadges();
-}
-
-function renderMoodEnergy(dayData){
-  moodBtns.innerHTML = ""; energyBtns.innerHTML = "";
-  for (let i=1;i<=5;i++){
-    const m = document.createElement("button");
-    m.textContent = `😊${i}`;
-    if (dayData.mood === i) m.style.background = "orange";
-    m.onclick = ()=>{ dayData.mood = i; saveData(); render(); };
-    moodBtns.appendChild(m);
-
-    const e = document.createElement("button");
-    e.textContent = `⚡${i}`;
-    if (dayData.energy === i) e.style.background = "orange";
-    e.onclick = ()=>{ dayData.energy = i; saveData(); render(); };
-    energyBtns.appendChild(e);
-  }
+  applySettingsToUI();
 }
 
-/* ---------------- Dynamic Tasks ---------------- */
-const taskTimers = {}; // {index:{intervalId}}
-function stopAllTaskTimers(){ Object.values(taskTimers).forEach(t=>clearInterval(t.intervalId)); for (const k in taskTimers) delete taskTimers[k]; }
-
 function renderTasks(dayData){
-  tasksList.innerHTML = "";
-  dayData.tasks.forEach((t, i) => {
-    const row = document.createElement("div");
-    row.className = "task-row";
-
-    const chk = document.createElement("input");
-    chk.type = "checkbox";
-    chk.checked = !!t.done;
-    chk.onchange = ()=>{ t.done = chk.checked; saveData(); updateStats(); };
-
-    const txt = document.createElement("input");
-    txt.type = "text"; txt.placeholder = `Task ${i+1}`; txt.value = t.text || "";
+  const box = $("tasksList"); box.innerHTML = "";
+  dayData.tasks.forEach((t, i)=>{
+    const row = document.createElement("div"); row.className = "task-row";
+    row.innerHTML = `<input type="checkbox" ${t.done?"checked":""}><input type="text" value="${(t.text||"").replace(/"/g,"&quot;")}" placeholder="Action task"><input type="number" min="1" value="${t.min||25}"><button>Start</button><button>Stop</button><button>Complete</button><div class="task-countdown" id="taskCD${i}"></div>`;
+    const [chk, txt, mins, startBtn, stopBtn, doneBtn] = row.children;
+    chk.onchange = ()=>{ t.done = chk.checked; if (t.done) {dayData.points=(dayData.points||0)+10; buzz();} saveData(); updateStats(); };
     txt.oninput = ()=>{ t.text = txt.value; saveData(); };
-
-    const mins = document.createElement("input");
-    mins.type = "number"; mins.min = "1"; mins.value = t.min ?? 25;
-    mins.onchange = ()=>{ const v = parseInt(mins.value,10); t.min = (isNaN(v)||v<=0)?25:v; saveData(); };
-
-    const start = document.createElement("button");
-    start.textContent = "Start";
-    start.onclick = ()=> startTaskTimer(i, t.min ?? 25, t.text);
-
-    const stop = document.createElement("button");
-    stop.textContent = "Stop";
-    stop.onclick = ()=> stopTaskTimer(i);
-
-    const cd = document.createElement("div");
-    cd.id = `taskCD${i}`; cd.className = "task-countdown";
-
-    row.append(chk, txt, mins, start, stop, cd);
-    tasksList.appendChild(row);
+    mins.onchange = ()=>{ t.min = parseInt(mins.value,10) || 25; saveData(); };
+    startBtn.onclick = ()=> startTaskTimer(i, t.min || 25, t.text || `Task ${i+1}`);
+    stopBtn.onclick = ()=> stopTaskTimer(i);
+    doneBtn.onclick = ()=>{ t.done = true; chk.checked = true; saveData(); updateStats(); startNextTask(i+1); buzz([20,20,20]); };
+    box.appendChild(row);
   });
-
-  addTaskBtn.onclick = ()=>{ dayData.tasks.push({ text:"", min:25, done:false }); saveData(); renderTasks(dayData); updateStats(); };
 }
 
-/* ---------------- Audio: high-pitched beep (no MP3) ---------------- */
-/* You can tweak these defaults if you want a different alarm sound.
-   - BEEP_DURATION_SEC: how long the alarm lasts
-   - BEEP_FREQUENCY_HZ: pitch (higher = sharper)
-   - BEEP_VOLUME: 0.0 .. 1.0 (be careful with hearing)
-*/
-const BEEP_DURATION_SEC = 3;      // <- change this to 4, 5, etc. if you want longer
-const BEEP_FREQUENCY_HZ = 1000;   // <- change pitch (e.g., 800, 1200)
-const BEEP_VOLUME = 0.6;          // <- louder than default; lower if too harsh
-
-function playBeep(seconds = BEEP_DURATION_SEC){
-  const ctx = new (window.AudioContext || window.webkitAudioContext)();
-  const osc = ctx.createOscillator();
-  const gain = ctx.createGain();
-
-  osc.type = "square";               // square is more piercing than sine
-  osc.frequency.value = BEEP_FREQUENCY_HZ;
-  gain.gain.setValueAtTime(BEEP_VOLUME, ctx.currentTime);
-
-  osc.connect(gain).connect(ctx.destination);
-
-  // Optional: make it "pulse" on/off during the duration (more alarm-like)
-  const pulse = 0.3; // seconds on, then off
-  const total = Math.max(0.5, seconds);
-  for (let t = 0; t < total; t += pulse * 2) {
-    gain.gain.setValueAtTime(BEEP_VOLUME, ctx.currentTime + t);
-    gain.gain.setValueAtTime(0.0,           ctx.currentTime + t + pulse);
-  }
-
-  osc.start();
-  osc.stop(ctx.currentTime + total);
+function startNextTask(nextIndex){
+  if (!settings.autostartChain) return;
+  const day = getDay(currentDate);
+  const next = day.tasks[nextIndex];
+  if (next && !next.done) startTaskTimer(nextIndex, next.min || 25, next.text || `Task ${nextIndex+1}`);
 }
 
-/* ---------------- Per-task timer ---------------- */
 function startTaskTimer(index, minutes, label){
   stopTaskTimer(index);
   const end = Date.now() + Math.max(1, minutes) * 60000;
-  const cdId = `taskCD${index}`;
-
-  const tick = ()=>{
+  let preAlertSent = false;
+  taskTimers[index] = setInterval(async ()=>{
     const left = end - Date.now();
-    const el = document.getElementById(cdId);
+    const el = document.getElementById(`taskCD${index}`);
     if (!el) return;
+    if (!preAlertSent && left <= 120000) { preAlertSent = true; notify("FocusTasks", `${label}: 2 minutes left`); }
     if (left <= 0){
-      clearInterval(taskTimers[index]?.intervalId);
-      el.textContent = "⏰";
-      playBeep();                      // <-- plays the loud 3s beep by default
-      delete taskTimers[index];
+      clearInterval(taskTimers[index]); delete taskTimers[index]; el.textContent = "⏰";
+      notify("FocusTasks", `${label} finished`); buzz([90,30,90]);
+      startNextTask(index+1);
       return;
     }
     const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
     el.textContent = `${m}:${String(s).padStart(2,"0")}`;
-  };
-
-  taskTimers[index] = { intervalId: setInterval(tick, 250) };
-  tick();
-}
-function stopTaskTimer(index){
-  if (taskTimers[index]) { clearInterval(taskTimers[index].intervalId); delete taskTimers[index]; }
-  const el = document.getElementById(`taskCD${index}`); if (el) el.textContent = "";
+  }, 250);
 }
+function stopTaskTimer(index){ if (taskTimers[index]) { clearInterval(taskTimers[index]); delete taskTimers[index]; } const el = document.getElementById(`taskCD${index}`); if (el) el.textContent = ""; }
 
-/* ---------------- Scheduled tasks: add, render, repeat, auto-move ---------------- */
-schedForm.addEventListener("submit", (e)=>{
+$("addTaskBtn").onclick = ()=>{ const day = getDay(currentDate); day.tasks.push({text:"",min:25,done:false}); saveData(); renderTasks(day); };
+
+$("schedForm").addEventListener("submit", (e)=>{
   e.preventDefault();
-  const text = (schedText.value||"").trim();
-  const date = schedDate.value, time = schedTime.value;
-  const min = parseInt(schedMin.value,10) || 25;
-  const repeat = schedRepeat.value || "none";
-  const autoStart = !!schedAutoStart.checked;
-  if (!text || !date || !time) return alert("Please fill title, date, and time.");
-  const whenIso = new Date(`${date}T${time}:00`).toISOString();
-  scheduled.push({ id: (crypto.randomUUID? crypto.randomUUID(): String(Date.now())), text, when: whenIso, min, repeat, autoStart });
-  saveScheduled(); schedForm.reset(); renderScheduled(); renderPlanner();
+  const text = $("schedText").value.trim(); const date = $("schedDate").value; const time = $("schedTime").value;
+  if (!text || !date || !time) return alert("Please fill title/date/time");
+  scheduled.push({id: crypto.randomUUID?.() || String(Date.now()), text, when: new Date(`${date}T${time}:00`).toISOString(), min: parseInt($("schedMin").value,10)||25, repeat: $("schedRepeat").value, autoStart: $("schedAutoStart").checked});
+  saveScheduled(); e.target.reset(); renderScheduled(); renderPlanner();
 });
 
-function renderScheduled(){
-  scheduled.sort((a,b)=> new Date(a.when)-new Date(b.when));
-  scheduledList.innerHTML = "";
-  if (!scheduled.length) { scheduledList.innerHTML = "<div class='mut'>No upcoming tasks.</div>"; return; }
-
-  scheduled.forEach((t, i)=>{
-    const row = document.createElement("div");
-    row.className = "sched-row";
-
-    const title = document.createElement("input"); title.type="text"; title.value = t.text;
-    title.oninput = ()=>{ t.text = title.value; saveScheduled(); renderPlanner(); };
-
-    const date = document.createElement("input"); date.type="date"; date.value = new Date(t.when).toISOString().slice(0,10);
-    date.onchange = ()=>{ const d = date.value; const tm = new Date(t.when).toISOString().slice(11,16); t.when = new Date(`${d}T${tm}:00`).toISOString(); saveScheduled(); renderScheduled(); renderPlanner(); };
-
-    const time = document.createElement("input"); time.type="time"; time.value = new Date(t.when).toISOString().slice(11,16);
-    time.onchange = ()=>{ const d = new Date(t.when).toISOString().slice(0,10); const tm = time.value; t.when = new Date(`${d}T${tm}:00`).toISOString(); saveScheduled(); renderScheduled(); renderPlanner(); };
-
-    const mins = document.createElement("input"); mins.type="number"; mins.min="1"; mins.value=t.min;
-    mins.onchange = ()=>{ t.min = parseInt(mins.value,10)||25; saveScheduled(); };
-
-    const del = document.createElement("button"); del.textContent="Del";
-    del.onclick = ()=>{ scheduled = scheduled.filter(x=>x!==t); saveScheduled(); renderScheduled(); renderPlanner(); };
-
-    row.append(title, date, time, mins, del);
-    scheduledList.appendChild(row);
-  });
-}
-
 function nextOccurrence(iso, repeat){
   const d = new Date(iso);
   if (repeat === "daily") d.setDate(d.getDate()+1);
   else if (repeat === "weekly") d.setDate(d.getDate()+7);
-  else if (repeat === "weekdays"){
-    do { d.setDate(d.getDate()+1); } while ([0,6].includes(d.getDay())); // skip Sun(0) & Sat(6)
-  } else return null;
+  else if (repeat === "weekdays") { do { d.setDate(d.getDate()+1);} while ([0,6].includes(d.getDay())); }
+  else if (repeat === "monthly") d.setMonth(d.getMonth()+1);
+  else if (repeat === "every3") d.setDate(d.getDate()+3);
+  else return null;
   return d.toISOString();
 }
 
-function moveScheduled(t){
-  const key = new Date().toISOString().slice(0,10);
-  const day = getDay(key);
-  day.tasks.push({ text: t.text, min: t.min, done:false });
-  saveData();
-
-  // Auto-start only if we're viewing today (so the countdown shows in UI)
-  if (t.autoStart && currentDate === key) {
-    const idx = day.tasks.length - 1;
-    startTaskTimer(idx, t.min, t.text);
-  }
-
-  // Reschedule if repeating, otherwise remove
+function sendScheduledToToday(t){
+  const day = getDay(TODAY);
+  day.tasks.push({text:t.text,min:t.min,done:false});
+  const idx = day.tasks.length - 1;
+  if (t.autoStart) startTaskTimer(idx, t.min, t.text);
   const next = nextOccurrence(t.when, t.repeat);
-  if (next) { t.when = next; } else { scheduled = scheduled.filter(x=>x!==t); }
-  saveScheduled(); renderTasks(day); renderScheduled(); renderPlanner(); updateStats();
+  if (next) t.when = next; else scheduled = scheduled.filter(s=>s.id!==t.id);
+  saveData(); saveScheduled(); render();
 }
 
-/* background sweeper (every 30s and when tab wakes) */
-function checkScheduledDue(){
-  const now = Date.now();
-  const due = scheduled.filter(t => new Date(t.when).getTime() <= now);
-  due.forEach(moveScheduled);
+function snooze(t, kind){
+  const d = new Date(t.when);
+  if (kind === "10m") d.setMinutes(d.getMinutes()+10);
+  if (kind === "1h") d.setHours(d.getHours()+1);
+  if (kind === "tomorrow") d.setDate(d.getDate()+1);
+  t.when = d.toISOString(); saveScheduled(); renderScheduled(); renderPlanner();
+}
+
+function renderScheduled(){
+  const box = $("scheduledList"); box.innerHTML = "";
+  scheduled.sort((a,b)=>new Date(a.when)-new Date(b.when));
+  if (!scheduled.length) { box.innerHTML = `<div class='mut'>No upcoming tasks.</div>`; return; }
+  scheduled.forEach(t=>{
+    const row = document.createElement("div"); row.className = "sched-row";
+    const dt = new Date(t.when);
+    row.innerHTML = `<input type='text' value="${(t.text||"").replace(/"/g,"&quot;")}"/><input type='date' value='${dt.toISOString().slice(0,10)}'/><input type='time' value='${dt.toISOString().slice(11,16)}'/><input type='number' min='1' value='${t.min||25}'/><button>Today</button><button>+10m</button><button>+1h</button><button>Tomorrow</button><button>Del</button>`;
+    const [title,date,time,mins,todayBtn,s10,s1,tom,del] = row.children;
+    title.oninput=()=>{t.text=title.value; saveScheduled(); renderPlanner();};
+    date.onchange=()=>{t.when = new Date(`${date.value}T${time.value}:00`).toISOString(); saveScheduled(); renderPlanner();};
+    time.onchange=()=>{t.when = new Date(`${date.value}T${time.value}:00`).toISOString(); saveScheduled(); renderPlanner();};
+    mins.onchange=()=>{t.min=parseInt(mins.value,10)||25; saveScheduled();};
+    todayBtn.onclick=()=>sendScheduledToToday(t);
+    s10.onclick=()=>snooze(t,"10m"); s1.onclick=()=>snooze(t,"1h"); tom.onclick=()=>snooze(t,"tomorrow");
+    del.onclick=()=>{scheduled=scheduled.filter(s=>s.id!==t.id); saveScheduled(); render();};
+    box.appendChild(row);
+  });
 }
-setInterval(checkScheduledDue, 30000);
-document.addEventListener("visibilitychange", ()=>{ if (!document.hidden) checkScheduledDue(); });
 
-/* ---------------- Weekly planner (next 7 days) ---------------- */
 function renderPlanner(){
-  const map = {};
-  const today = new Date();
-  for (let i=0;i<7;i++){ const d = new Date(today); d.setDate(today.getDate()+i); const key = d.toISOString().slice(0,10); map[key]={date:d,items:[]}; }
-  scheduled.forEach(t=>{ const key = new Date(t.when).toISOString().slice(0,10); if (map[key]) map[key].items.push(t); });
-
-  plannerGrid.innerHTML = "";
-  Object.keys(map).sort().forEach(key=>{
-    const bucket = map[key];
+  const g = $("plannerGrid"); g.innerHTML = "";
+  for (let i=0;i<7;i++){
+    const d = new Date(); d.setDate(d.getDate()+i); const key = d.toISOString().slice(0,10);
+    const dayItems = scheduled.filter(t=>new Date(t.when).toISOString().slice(0,10)===key);
     const col = document.createElement("div"); col.className = "planner-day";
-    const h4 = document.createElement("h4");
-    const d = bucket.date;
-    const dayName = d.toLocaleDateString(undefined,{weekday:"short"});
-    h4.textContent = `${dayName} ${d.getDate()}/${d.getMonth()+1}`;
-    col.appendChild(h4);
-    if (!bucket.items.length){
-      const e = document.createElement("div"); e.className="mut"; e.textContent="—"; col.appendChild(e);
-    } else {
-      bucket.items.sort((a,b)=> new Date(a.when)-new Date(b.when));
-      bucket.items.forEach(t=>{
-        const tm = new Date(t.when).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
-        const item = document.createElement("div"); item.className="plan-item";
-        item.innerHTML = `• ${t.text} <small>(${tm}, ${t.min}m${t.autoStart?" • auto":""}${t.repeat!=="none"?" • "+t.repeat:""})</small>`;
-        col.appendChild(item);
-      });
-    }
-    plannerGrid.appendChild(col);
-  });
+    col.innerHTML = `<h4>${d.toLocaleDateString(undefined,{weekday:"short"})}</h4>`;
+    if (!dayItems.length) col.innerHTML += `<div class='mut'>—</div>`;
+    dayItems.forEach(item=>{ col.innerHTML += `<div class='plan-item'>• ${item.text} <small>${new Date(item.when).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>`; });
+    g.appendChild(col);
+  }
 }
 
-/* ---------------- Stats / badges ---------------- */
 function updateStats(){
   const day = getDay(currentDate);
   const checks = (day.actions||[]).concat(day.rules||[]);
-  // Include tasks in day score as well (done vs total)
-  const tasksTotal = (day.tasks||[]).length, tasksDone = (day.tasks||[]).filter(t=>t.done).length;
-  const habitTotal = checks.length, habitDone = checks.filter(Boolean).length;
-
-  const total = tasksTotal + habitTotal;
-  const done  = tasksDone + habitDone;
-  const dayPercent = total ? Math.round(100 * done / total) : 0;
-
-  scoreEl.textContent = `${dayPercent}%`;
-  barToday.style.width = `${dayPercent}%`;
-  ringDaily.setAttribute("stroke-dasharray", `${dayPercent*2.2},220`);
-
-  // Week %
-  const wk = (weekSel.value === "Auto") ? getAutoWeek(currentDate) : parseInt(weekSel.value,10);
-  const allDates = Object.keys(data.days).sort();
-  const sameWeekDates = allDates.filter(d => (getAutoWeek(d)===wk));
-  let sum = 0, count = 0;
-  sameWeekDates.forEach(d=>{
-    const dd = data.days[d];
-    const c = (dd.actions||[]).concat(dd.rules||[]);
-    const tTot = (dd.tasks||[]).length, tDone = (dd.tasks||[]).filter(x=>x.done).length;
-    const hTot = c.length, hDone = c.filter(Boolean).length;
-    const tot = tTot + hTot;
-    if (tot>0){ sum += ( (tDone+hDone)/tot ); count++; }
-  });
-  const weekPercent = count ? Math.round(100 * sum / count) : 0;
-  weekProgEl.textContent = `${weekPercent}%`;
-  barWeek.style.width = `${weekPercent}%`;
-  ringWeek.setAttribute("stroke-dasharray", `${weekPercent*2.2},220`);
-
-  // Streak: count consecutive days (backwards) where ALL day items completed
-  let streak = 0; let cur = new Date(currentDate);
-  while(true){
-    const key = cur.toISOString().slice(0,10);
-    const dd = data.days[key];
-    if (!dd) break;
-    const c = (dd.actions||[]).concat(dd.rules||[]);
-    const allHabitsOk = c.length===0 ? true : c.every(Boolean);
-    const allTasksOk  = (dd.tasks||[]).length===0 ? true : dd.tasks.every(t=>t.done);
-    if (allHabitsOk && allTasksOk){ streak++; cur.setDate(cur.getDate()-1); } else break;
+  const tasks = day.tasks||[];
+  const done = tasks.filter(t=>t.done).length + checks.filter(Boolean).length;
+  const total = tasks.length + checks.length;
+  const dayPercent = total ? Math.round((done/total)*100) : 0;
+  $("score").textContent = `${dayPercent}%`;
+  $("barToday").style.width = `${dayPercent}%`;
+
+  let wDone=0,wTotal=0;
+  Object.entries(data.days).forEach(([k,dd])=>{ if (getAutoWeek(k)===getAutoWeek(currentDate)) { const ch=(dd.actions||[]).concat(dd.rules||[]); wDone += (dd.tasks||[]).filter(t=>t.done).length + ch.filter(Boolean).length; wTotal += (dd.tasks||[]).length + ch.length; } });
+  const wPct = wTotal ? Math.round((wDone/wTotal)*100) : 0;
+  $("weekProg").textContent = `${wPct}%`; $("barWeek").style.width = `${wPct}%`;
+
+  let streak = 0; const d = new Date();
+  while(true){ const key=d.toISOString().slice(0,10); const v=data.days[key]; if (!v) break; const t=v.tasks||[]; if (t.length && t.every(x=>x.done)) { streak++; d.setDate(d.getDate()-1); } else break; }
+  $("streak").textContent = streak;
+  const points = Object.values(data.days).reduce((sum,dd)=>sum + (dd.points||0), 0);
+  $("points").textContent = points;
+  renderHeatmap();
+}
+
+function renderHeatmap(){
+  const hm = $("heatmap"); hm.innerHTML = "";
+  for (let i=20;i>=0;i--){
+    const d = new Date(); d.setDate(d.getDate()-i); const key=d.toISOString().slice(0,10); const dd=data.days[key];
+    const done=(dd?.tasks||[]).filter(t=>t.done).length||0; const total=(dd?.tasks||[]).length||0; const ratio=total?done/total:0;
+    const cell = document.createElement("div"); cell.className="hm-cell"; cell.title=key;
+    cell.style.opacity = 0.2 + ratio*0.8; hm.appendChild(cell);
   }
-  streakEl.textContent = streak;
 }
 
-function renderBadges(){
-  const s = parseInt(streakEl.textContent||"0",10);
-  const badgesDiv = document.getElementById("badges");
-  badgesDiv.innerHTML = "";
-  if (s >= 7) badgesDiv.innerHTML += `<span class="pill">🏅 7-day streak</span>`;
-  // 4-week finisher: 28 days complete
-  const totalCompleteDays = Object.keys(data.days).filter(k=>{
-    const v = data.days[k];
-    const c = (v.actions||[]).concat(v.rules||[]);
-    const allHabitsOk = c.length===0 ? false : c.every(Boolean);
-    const allTasksOk  = (v.tasks||[]).length===0 ? false : v.tasks.every(t=>t.done);
-    return allHabitsOk && allTasksOk;
-  }).length;
-  if (totalCompleteDays >= 28) badgesDiv.innerHTML += `<span class="pill">🏆 4-week finisher</span>`;
+function renderNotes(){
+  const list = $("notesList"); list.innerHTML = "";
+  notes.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned));
+  notes.forEach(n=>{
+    const btn = document.createElement("button"); btn.className = `note-item ${activeNoteId===n.id?"active":""}`;
+    btn.textContent = `${n.pinned?"📌 ":""}${n.folder?`[${n.folder}] `:""}${n.title||"Untitled"}`;
+    btn.onclick = ()=>{ activeNoteId=n.id; $("noteBody").value=n.body||""; renderNotes(); };
+    btn.oncontextmenu = (e)=>{ e.preventDefault(); n.pinned = !n.pinned; saveNotes(); renderNotes(); };
+    list.appendChild(btn);
+  });
 }
 
-/* ---------------- Generic timer (bottom section) ---------------- */
-let timerInt;
-const timerDisplay = document.getElementById("timerDisplay");
-document.getElementById("stopTimer").onclick = ()=>{ clearInterval(timerInt); timerDisplay.textContent=""; };
+$("newNoteBtn").onclick = ()=>{
+  const n = { id: crypto.randomUUID?.() || String(Date.now()), folder: $("noteFolder").value.trim(), title: $("noteTitle").value.trim() || "New note", body:"", pinned:false };
+  notes.push(n); activeNoteId = n.id; saveNotes(); renderNotes();
+};
+$("noteBody").addEventListener("input", ()=>{
+  const n = notes.find(x=>x.id===activeNoteId); if (!n) return; n.body = $("noteBody").value; saveNotes();
+});
+$("noteBody").addEventListener("keydown", (e)=>{
+  if (e.key === "/") {
+    setTimeout(()=>{
+      const body = $("noteBody").value;
+      if (body.endsWith("/h2")) $("noteBody").value = body.replace(/\/h2$/,"\n## Heading\n");
+      if (body.endsWith("/check")) $("noteBody").value = body.replace(/\/check$/,"\n- [ ] Item\n");
+      if (body.endsWith("/div")) $("noteBody").value = body.replace(/\/div$/,"\n---\n");
+      const n = notes.find(x=>x.id===activeNoteId); if (n) { n.body = $("noteBody").value; saveNotes(); }
+    }, 0);
+  }
+});
+$("toggleSprintBtn").onclick = ()=> document.body.classList.toggle("sprint");
 
 function startTimer(mins){
   const end = Date.now() + mins*60000;
-  clearInterval(timerInt);
-  timerInt = setInterval(()=>{
-    const left = end - Date.now();
-    if (left <= 0){
-      clearInterval(timerInt);
-      timerDisplay.textContent = "⏰ Time's up!";
-      playBeep(); // loud 3s beep
-    } else {
-      const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
-      timerDisplay.textContent = `${m}:${String(s).padStart(2,"0")}`;
-    }
+  clearInterval(window.breakTimer);
+  window.breakTimer = setInterval(()=>{
+    const left = end-Date.now();
+    if (left<=0){ clearInterval(window.breakTimer); $("timerDisplay").textContent = "⏰ Done"; buzz([60]); return; }
+    $("timerDisplay").textContent = `Break ${Math.floor(left/60000)}:${String(Math.floor((left%60000)/1000)).padStart(2,"0")}`;
   }, 250);
 }
-function startCustom(){
-  const n = parseInt(document.getElementById("customMins").value,10);
-  if (n>0) startTimer(n);
-}
+document.querySelectorAll(".breakBtn").forEach(btn => btn.onclick = ()=> startTimer(parseInt(btn.dataset.min,10)));
 
-/* ---------------- Settings actions ---------------- */
-resetStartBtn?.addEventListener("click", ()=>{
-  meta.startDate = TODAY; saveMeta(); render();
-  alert("Start date reset to today. Auto week will compute from now.");
-});
-loopToggle?.addEventListener("change", ()=>{
-  meta.loopWeeks = loopToggle.checked; saveMeta(); render();
-});
+$("quickCaptureBtn").onclick = ()=>{
+  const title = prompt("Quick Capture task title:");
+  if (!title) return;
+  const day = getDay(TODAY); day.tasks.push({text:title,min:25,done:false}); saveData(); render();
+};
+
+$("notifyBtn").onclick = async ()=>{ await Notification.requestPermission(); alert(`Notifications: ${Notification.permission}`); };
 
-/* ---------------- Export / Import ---------------- */
-function exportJSON(){
-  const payload = { meta, data, scheduled };
-  const a = document.createElement("a");
-  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
-  a.download = "dopamine-data.json"; a.click();
+$("exportIcsBtn").onclick = ()=>{
+  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//FocusTasks//EN"];
+  scheduled.forEach((t,i)=>{ const start = new Date(t.when); const end = new Date(start.getTime() + (t.min||25)*60000); const f=(d)=>d.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z"; lines.push("BEGIN:VEVENT",`UID:${t.id||i}@focustasks`,`DTSTAMP:${f(new Date())}`,`DTSTART:${f(start)}`,`DTEND:${f(end)}`,`SUMMARY:${t.text}`,"END:VEVENT"); });
+  lines.push("END:VCALENDAR");
+  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], {type:"text/calendar"})); a.download = "focustasks-upcoming.ics"; a.click();
+};
+
+async function deriveKey(passphrase, salt){
+  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
+  return crypto.subtle.deriveKey({name:"PBKDF2", salt, iterations:120000, hash:"SHA-256"}, baseKey, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
 }
-function exportCSV(){
-  const rows = [["Date","Actions Done","Rules Done","Mood","Energy","Tasks Done/Total","Journal"]];
-  Object.keys(data.days).sort().forEach(d=>{
-    const v = data.days[d];
-    const actionsDone = (v.actions||[]).filter(Boolean).length;
-    const rulesDone   = (v.rules||[]).filter(Boolean).length;
-    const tDone = (v.tasks||[]).filter(x=>x.done).length;
-    const tTotal= (v.tasks||[]).length;
-    rows.push([d, actionsDone, rulesDone, v.mood||"", v.energy||"", `${tDone}/${tTotal}`, JSON.stringify(v.journal||"")]);
-  });
-  const a = document.createElement("a");
-  a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}));
-  a.download = "dopamine-data.csv"; a.click();
+async function encryptPayload(payload, passphrase){
+  const iv = crypto.getRandomValues(new Uint8Array(12)); const salt = crypto.getRandomValues(new Uint8Array(16));
+  const key = await deriveKey(passphrase, salt);
+  const cipher = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, new TextEncoder().encode(JSON.stringify(payload)));
+  return JSON.stringify({v:1, iv:Array.from(iv), salt:Array.from(salt), c:Array.from(new Uint8Array(cipher))});
 }
-document.getElementById("importFile").onchange = function(){
-  const file = this.files[0]; if(!file) return;
-  const fr = new FileReader();
-  fr.onload = (e)=>{
-    try{
-      const obj = JSON.parse(e.target.result);
-      if (obj.meta) meta = obj.meta;
-      if (obj.data) data = obj.data; else if (obj.days) data = { days: obj.days }; // older format support
-      if (obj.scheduled) scheduled = obj.scheduled;
-      saveMeta(); saveData(); saveScheduled(); render();
-    } catch(err){ alert("Invalid JSON file"); }
-  };
-  fr.readAsText(file);
+async function decryptPayload(blobText, passphrase){
+  const obj = JSON.parse(blobText); const iv = new Uint8Array(obj.iv); const salt = new Uint8Array(obj.salt); const c = new Uint8Array(obj.c);
+  const key = await deriveKey(passphrase, salt);
+  const plain = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, c);
+  return JSON.parse(new TextDecoder().decode(plain));
+}
+
+$("exportEncryptedBtn").onclick = async ()=>{
+  const pass = prompt("Passphrase for encrypted backup (.ftb):"); if (!pass) return;
+  const payload = {meta,data,scheduled,notes,settings};
+  const ftb = await encryptPayload(payload, pass);
+  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ftb], {type:"application/octet-stream"})); a.download="focustasks-backup.ftb"; a.click();
+};
+
+window.exportJSON = function(){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify({meta,data,scheduled,notes,settings},null,2)],{type:"application/json"})); a.download="focustasks-data.json"; a.click(); };
+window.exportCSV = function(){ const rows=[["Date","Tasks Done","Tasks Total"]]; Object.keys(data.days).sort().forEach(k=>{ const t=data.days[k].tasks||[]; rows.push([k,t.filter(x=>x.done).length,t.length]);}); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"})); a.download="focustasks-data.csv"; a.click(); };
+
+$("importFile").onchange = async function(){
+  const file = this.files[0]; if (!file) return;
+  const text = await file.text();
+  try {
+    let obj;
+    if (file.name.endsWith(".ftb")) { const pass = prompt("Passphrase to restore backup:"); if (!pass) return; obj = await decryptPayload(text, pass); }
+    else obj = JSON.parse(text);
+    meta = obj.meta || meta; data = obj.data || data; scheduled = obj.scheduled || scheduled; notes = obj.notes || notes; settings = {...settings, ...(obj.settings||{})};
+    saveMeta(); saveData(); saveScheduled(); saveNotes(); saveSettings(); render();
+  } catch { alert("Import failed. Check file/passphrase."); }
+};
+
+async function webDavRequest(method, path, body){
+  const url = $("davUrl").value.trim().replace(/\/$/,"") + "/" + path;
+  const auth = btoa(`${$("davUser").value}:${$("davPass").value}`);
+  const resp = await fetch(url, {method, headers:{Authorization:`Basic ${auth}`}, body});
+  return resp;
+}
+$("davTestBtn").onclick = async ()=>{ try { const r = await webDavRequest("PROPFIND", "", null); alert(r.ok ? "WebDAV OK" : `WebDAV failed ${r.status}`);} catch (e) { alert(`WebDAV error: ${e.message}`);} };
+$("davSyncBtn").onclick = async ()=>{
+  try {
+    const payload = JSON.stringify({meta,data,scheduled,notes,settings});
+    const put = await webDavRequest("PUT", "focustasks-sync.json", payload);
+    if (!put.ok) throw new Error(`PUT ${put.status}`);
+    const get = await webDavRequest("GET", "focustasks-sync.json");
+    if (get.ok) { const remote = await get.json(); meta=remote.meta||meta; data=remote.data||data; scheduled=remote.scheduled||scheduled; notes=remote.notes||notes; settings={...settings,...(remote.settings||{})}; saveMeta(); saveData(); saveScheduled(); saveNotes(); saveSettings(); render(); }
+    alert("Sync complete");
+  } catch(e){ alert(`Sync failed: ${e.message}`); }
 };
 
-/* ---------------- Kick things off ---------------- */
+function checkScheduledDue(){ const now = Date.now(); scheduled.filter(t=>new Date(t.when).getTime()<=now).forEach(sendScheduledToToday); }
+setInterval(checkScheduledDue, 30000);
+
+$("weekSel").onchange = ()=>{ localStorage.setItem("dopamineWeekMode", $("weekSel").value); render(); };
+$("dateSel").onchange = ()=>{ currentDate = $("dateSel").value; render(); };
+$("darkToggle").onclick = ()=>{ document.body.classList.toggle("dark"); localStorage.setItem("dopamineDark", document.body.classList.contains("dark")); };
+if (localStorage.getItem("dopamineDark") === "true") document.body.classList.add("dark");
+
+$("resetStartBtn").onclick = ()=>{ meta.startDate = TODAY; saveMeta(); render(); };
+$("loopToggle").onchange = ()=>{ meta.loopWeeks = $("loopToggle").checked; saveMeta(); };
+$("autostartChainToggle").onchange = ()=>{ settings.autostartChain = $("autostartChainToggle").checked; saveSettings(); };
+$("quickCaptureToggle").onchange = ()=>{ settings.quickCapture = $("quickCaptureToggle").checked; saveSettings(); applySettingsToUI(); };
+$("zenToggle").onchange = ()=>{ settings.zenMode = $("zenToggle").checked; saveSettings(); applySettingsToUI(); };
+$("heatmapToggle").onchange = ()=>{ settings.heatmap = $("heatmapToggle").checked; saveSettings(); applySettingsToUI(); };
+$("hapticsToggle").onchange = ()=>{ settings.haptics = $("hapticsToggle").checked; saveSettings(); };
+
 render();
 checkScheduledDue();
 
EOF
)
