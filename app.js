/* ==== Dopamine App – Full JS with Auto-Week, Settings, and iOS-safe Timer Alerts ==== */

/* ---------- Program plan (edit as you wish) ---------- */
const plan = {
  1: { actions: ["Wake up at same time", "Plan day in morning", "Walk 20 min", "Read 15 min"], rules: ["No social media in morning", "Limit sugar"], journal: "Write 3 things you're grateful for" },
  2: { actions: ["Wake up at same time", "Work on priority task 1h", "Exercise 30 min", "Read 15 min"], rules: ["No screens after 10pm", "Limit caffeine"], journal: "Reflect on your wins" },
  3: { actions: ["Wake up at same time", "Do hardest task first", "Stretch 10 min", "Read 15 min"], rules: ["No phone in bedroom", "Avoid junk food"], journal: "Note any challenges today" },
  4: { actions: ["Wake up at same time", "Deep work 2h", "Exercise 30 min", "Read 15 min"], rules: ["No social media during work", "Drink 2L water"], journal: "How can tomorrow be better?" }
};

/* ---------- Persistent state ---------- */
let data = JSON.parse(localStorage.getItem("dopamineData") || "{}"); // daily records
const TODAY = new Date().toISOString().slice(0,10);

/* Meta (start date, loop flag) */
const META_KEY = "dopamineMeta";
let meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
if (!meta.startDate) { meta.startDate = TODAY; }
if (meta.loopWeeks === undefined) { meta.loopWeeks = true; }
saveMeta();

function saveMeta(){ localStorage.setItem(META_KEY, JSON.stringify(meta)); }
function saveData(){ localStorage.setItem("dopamineData", JSON.stringify(data)); }

/* ---------- Elements ---------- */
const weekSel = document.getElementById("weekSel");
const dateSel = document.getElementById("dateSel");
const actionsDiv = document.getElementById("actions");
const rulesDiv = document.getElementById("rules");
const journal = document.getElementById("journal");
const streakEl = document.getElementById("streak");
const scoreEl = document.getElementById("score");
const weekProgEl = document.getElementById("weekProg");
const barToday = document.getElementById("barToday");
const barWeek = document.getElementById("barWeek");
const ringDaily = document.getElementById("ringDaily");
const ringWeek = document.getElementById("ringWeek");
const badgesDiv = document.getElementById("badges");
const moodBtns = document.getElementById("moodBtns");
const energyBtns = document.getElementById("energyBtns");
const timerDisplay = document.getElementById("timerDisplay");

const startDateLabel = document.getElementById("startDateLabel");
const resetStartBtn   = document.getElementById("resetStartBtn");
const loopToggle      = document.getElementById("loopToggle");

/* ---------- Week selector (persist choice) ---------- */
["Auto", 1, 2, 3, 4].forEach(w => {
  const opt = document.createElement("option");
  opt.value = String(w);
  opt.textContent = String(w);
  weekSel.appendChild(opt);
});
const WEEK_MODE_KEY = "dopamineWeekMode";
weekSel.value = localStorage.getItem(WEEK_MODE_KEY) || "Auto";
weekSel.onchange = () => { localStorage.setItem(WEEK_MODE_KEY, weekSel.value); render(); };

/* ---------- Date init ---------- */
let currentDate = TODAY;
dateSel.value = currentDate;
dateSel.addEventListener("change", () => { currentDate = dateSel.value; render(); });

/* ---------- Dark mode ---------- */
document.getElementById("darkToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("dopamineDark", document.body.classList.contains("dark"));
});
if (localStorage.getItem("dopamineDark") === "true") document.body.classList.add("dark");

/* ---------- Auto-week helpers ---------- */
function daysBetween(a, b){ return Math.floor((new Date(b) - new Date(a)) / 86400000); }
function getAutoWeek(dateStr){
  const d = daysBetween(meta.startDate, dateStr);
  const weekIndex = Math.max(0, Math.floor(d / 7));  // 0..∞
  return meta.loopWeeks ? (weekIndex % 4) + 1 : Math.min(4, weekIndex + 1);
}

/* ---------- Render ---------- */
function render(){
  // Settings panel
  startDateLabel.textContent = meta.startDate;
  loopToggle.checked = !!meta.loopWeeks;

  // compute week
  const weekNum = (weekSel.value === "Auto") ? getAutoWeek(currentDate) : parseInt(weekSel.value,10);
  if (weekSel.value === "Auto") weekSel.options[0].textContent = `Auto (Week ${weekNum})`; else weekSel.options[0].textContent = "Auto";

  const dayData = data[currentDate] || { actions: [], rules: [], journal: "", mood: null, energy: null };

  // actions
  actionsDiv.innerHTML = "";
  plan[weekNum].actions.forEach((txt, i)=>{
    const lbl = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!dayData.actions[i];
    cb.addEventListener("change", ()=>{ dayData.actions[i] = cb.checked; saveDay(dayData); });
    lbl.appendChild(cb); lbl.appendChild(document.createTextNode(txt));
    actionsDiv.appendChild(lbl);
  });

  // rules
  rulesDiv.innerHTML = "";
  plan[weekNum].rules.forEach((txt, i)=>{
    const lbl = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!dayData.rules[i];
    cb.addEventListener("change", ()=>{ dayData.rules[i] = cb.checked; saveDay(dayData); });
    lbl.appendChild(cb); lbl.appendChild(document.createTextNode(txt));
    rulesDiv.appendChild(lbl);
  });

  // journal
  journal.value = dayData.journal || "";
  journal.oninput = ()=>{ dayData.journal = journal.value; saveDay(dayData); };

  // mood / energy
  moodBtns.innerHTML = ""; energyBtns.innerHTML = "";
  for (let i=1;i<=5;i++){
    const m = document.createElement("button");
    m.textContent = `😊${i}`;
    if (dayData.mood === i) m.style.background = "orange";
    m.onclick = ()=>{ dayData.mood = i; saveDay(dayData); render(); };
    moodBtns.appendChild(m);

    const e = document.createElement("button");
    e.textContent = `⚡${i}`;
    if (dayData.energy === i) e.style.background = "orange";
    e.onclick = ()=>{ dayData.energy = i; saveDay(dayData); render(); };
    energyBtns.appendChild(e);
  }

  updateStats();
  renderBadges();
}

function saveDay(dayData){ data[currentDate] = dayData; saveData(); updateStats(); }

/* ---------- Stats, streak, badges ---------- */
function updateStats(){
  const day = data[currentDate] || {};
  const checks = (day.actions||[]).concat(day.rules||[]);
  const score = checks.length ? Math.round(100 * checks.filter(Boolean).length / checks.length) : 0;
  scoreEl.textContent = `${score}%`;
  if (barToday) barToday.style.width = `${score}%`;
  ringDaily.setAttribute("stroke-dasharray", `${score*2.2},220`);

  // week average for selected/auto week
  const wk = (weekSel.value === "Auto") ? getAutoWeek(currentDate) : parseInt(weekSel.value,10);
  const dates = Object.keys(data).sort().filter(d => (weekSel.value==="Auto" ? getAutoWeek(d)===wk : true));
  const avg = dates.length ? Math.round(100 * dates.reduce((acc,d)=>{
    const c = (data[d].actions||[]).concat((data[d].rules||[]));
    return acc + (c.length ? (c.filter(Boolean).length / c.length) : 0);
  },0) / dates.length) : 0;
  weekProgEl.textContent = `${avg}%`;
  if (barWeek) barWeek.style.width = `${avg}%`;
  ringWeek.setAttribute("stroke-dasharray", `${avg*2.2},220`);

  // streak (consecutive days with all items checked)
  const allDates = Object.keys(data).sort();
  let streak = 0;
  for (let i = allDates.length-1; i>=0; i--){
    const d = allDates[i];
    const c = (data[d].actions||[]).concat(data[d].rules||[]);
    if (c.length && c.every(Boolean)) streak++; else break;
  }
  streakEl.textContent = streak;
}

function renderBadges(){
  badgesDiv.innerHTML = "";
  // 7-day streak
  const s = parseInt(streakEl.textContent || "0", 10);
  if (s >= 7) badgesDiv.innerHTML += `<span class="pill">🏅 7-day streak</span>`;

  // perfect week
  const wk = (weekSel.value === "Auto") ? getAutoWeek(currentDate) : parseInt(weekSel.value,10);
  const weekDates = Object.keys(data).filter(d=> (getAutoWeek(d)===wk));
  const weekPerfect = weekDates.every(d=>{
    const c = (data[d].actions||[]).concat(data[d].rules||[]);
    return c.length && c.every(Boolean);
  });
  if (weekPerfect && weekDates.length) badgesDiv.innerHTML += `<span class="pill">🌟 Perfect Week</span>`;

  // 28 completions
  const totalComplete = Object.values(data).filter(v=>{
    const c = (v.actions||[]).concat(v.rules||[]);
    return c.length && c.every(Boolean);
  }).length;
  if (totalComplete >= 28) badgesDiv.innerHTML += `<span class="pill">🏆 4-week finisher</span>`;
}

/* ---------- Mark complete & clear journal ---------- */
document.getElementById("markComplete").onclick = ()=>{
  const wk = (weekSel.value === "Auto") ? getAutoWeek(currentDate) : parseInt(weekSel.value,10);
  const d = data[currentDate] || { actions: [], rules: [], journal: "", mood:null, energy:null };
  d.actions = plan[wk].actions.map(()=>true);
  d.rules   = plan[wk].rules.map(()=>true);
  saveDay(d); render();
};
document.getElementById("clearJournal").onclick = ()=>{
  const d = data[currentDate] || {};
  d.journal = ""; saveDay(d); journal.value = "";
};

/* ---------- Export / Import ---------- */
function exportJSON(){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"}));
  a.download = "dopamine-data.json"; a.click();
}
function exportCSV(){
  const rows = [["Date","Actions Done","Rules Done","Mood","Energy","Journal"]];
  Object.keys(data).forEach(d=>{
    rows.push([d,(data[d].actions||[]).filter(Boolean).length,(data[d].rules||[]).filter(Boolean).length,data[d].mood||"",data[d].energy||"",JSON.stringify(data[d].journal||"")]);
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}));
  a.download = "dopamine-data.csv"; a.click();
}
document.getElementById("importFile").onchange = function(){
  const file = this.files[0]; if(!file) return;
  const fr = new FileReader();
  fr.onload = (e)=>{ data = JSON.parse(e.target.result); saveData(); render(); };
  fr.readAsText(file);
};

/* ---------- Audio unlock + beep (iOS-safe) ---------- */
let audioCtx;
function unlockAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function playBeep(freq = 880, ms = 350) {
  if (!audioCtx) return; // must call unlockAudio() from a user gesture first
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  o.connect(g);
  g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, now + ms/1000);
  o.start(now);
  o.stop(now + ms/1000 + 0.05);
}

/* ---------- Timer with alerts ---------- */
let timerInt;
function startTimer(mins){
  // Unlock audio on user gesture (required by iOS)
  unlockAudio();

  const end = Date.now() + mins*60*1000;
  clearInterval(timerInt);
  timerInt = setInterval(()=>{
    const left = end - Date.now();
    if (left <= 0){
      clearInterval(timerInt);
      timerDisplay.textContent = "⏰ Time's up!";

      // Sound (double-chime)
      playBeep(880, 280);
      setTimeout(()=>playBeep(660, 280), 120);

      // Vibration (Android; iOS will simply ignore)
      if (navigator.vibrate) navigator.vibrate(300);

      // Try showing a notification via SW (works if PWA installed and permission granted)
      if ("Notification" in window && Notification.permission === "granted") {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification("⏰ Focus block finished", {
              body: "Nice work. Take a short break or start another block.",
              icon: "icons/icon-192.png",
              badge: "icons/icon-192.png"
            }).catch(()=>{});
          });
        } else {
          try { new Notification("⏰ Focus block finished"); } catch {}
        }
      }
    } else {
      const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
      timerDisplay.textContent = `${m}:${String(s).padStart(2,"0")}`;
    }
  }, 250);
}
function startCustom(){
  const n = parseInt(document.getElementById("customMins").value,10);
  if (n>0) startTimer(n);
}
document.getElementById("stopTimer").onclick = ()=>{ clearInterval(timerInt); timerDisplay.textContent=""; };

/* ---------- Notifications (request once) ---------- */
if ("Notification" in window && Notification.permission === "default") {
  // Safe to call on load; iOS PWAs will show a system prompt
  Notification.requestPermission().catch(()=>{});
}

/* ---------- Settings actions ---------- */
resetStartBtn?.addEventListener("click", ()=>{
  meta.startDate = TODAY; saveMeta(); render();
  alert("Start date reset to today. Auto week will compute from now.");
});
loopToggle?.addEventListener("change", ()=>{
  meta.loopWeeks = loopToggle.checked; saveMeta(); render();
});

/* ---------- Init ---------- */
render();

/* ---------- PWA: service worker ---------- */
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("service-worker.js").catch(()=>{});
}
