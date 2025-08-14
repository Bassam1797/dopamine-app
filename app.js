// ===================== Dopamine Plan — App Logic =====================

// ---- Program Content (edit freely) ----
const PLAN = {
  1: {
    actions: [
      "Fixed wake-up + sunlight + water + 5–10 min movement",
      "5-min dopamine audit (top 3 distractions)",
      "One 15–20 min low-stim break (walk/stretch/breathing)",
      "Journal reflection (focus high/low moments)"
    ],
    rules: [
      "Social media in 2 fixed windows only",
      "Replace one unhelpful habit with a neutral one"
    ],
    journalPrompt: "When did I feel most focused today? Least focused?"
  },
  2: {
    actions: [
      "2–4 time-boxed focus blocks (25–45 min + 5–10 min break)",
      "Reward: small treat after a meaningful task",
      "10-min brain-boost (read/learn/puzzle)"
    ],
    rules: ["No phone for first hour after waking", "Healthy snacks visible, sugar out of sight"],
    journalPrompt: "What’s one thing I controlled well today?"
  },
  3: {
    actions: [
      "Morning: review top 3 priorities",
      "One 60-min deep work block (single task)",
      "Mid-day recharge (walk/stretch/meditate 10–15 min)"
    ],
    rules: ["One full evening this week without screens", "No caffeine after 14:00"],
    journalPrompt: "What helped me focus longest today?"
  },
  4: {
    actions: [
      "Habit stack (journal after breakfast, stretch after lunch, etc.)",
      "Weekly review (Sun, 10–15 min) to set next week goals",
      "Write one gratitude for non-instant rewards"
    ],
    rules: ["Pick 2 habits to keep permanently", "Remove 1 distraction source entirely"],
    journalPrompt: "How have focus, mood, and energy changed this month?"
  }
};

// ---- State (private, local-only) ----
let state = JSON.parse(localStorage.getItem("dopamineState") || "{}");
if (!state.days) state.days = {};    // { "YYYY-MM-DD": {actions:[bool], rules:[bool], journal:"", mood:1-5, energy:1-5, complete:true} }
if (!state.badges) state.badges = []; // ["Week1", "PerfectWeek", ...]

// ---- DOM ----
const weekSel = document.getElementById("weekSel");
const dateSel = document.getElementById("dateSel");
const todayBtn = document.getElementById("todayBtn");

const actionsDiv = document.getElementById("actions");
const actionsDesc = document.getElementById("actionsDesc");
const rulesDiv = document.getElementById("rules");

const journalBox = document.getElementById("journalBox");
const journalPrompt = document.getElementById("journalPrompt");
const charCount = document.getElementById("charCount");
const clearJournalBtn = document.getElementById("clearJournal");

const streakEl = document.getElementById("streak");
const scoreEl = document.getElementById("score");
const weekProgEl = document.getElementById("weekProg");
const barToday = document.getElementById("barToday");
const barWeek = document.getElementById("barWeek");
const ringDaily = document.getElementById("ringDaily");
const ringWeek = document.getElementById("ringWeek");

const meNowEl = document.getElementById("meNow");

const start25 = document.getElementById("start25");
const start45 = document.getElementById("start45");
const start60 = document.getElementById("start60");
const customMin = document.getElementById("customMin");
const startCustomBtn = document.getElementById("startCustomBtn");
const stopTimerBtn = document.getElementById("stopTimer");
const focusStatus = document.getElementById("focusStatus");
const focusCountdown = document.getElementById("focusCountdown");

const completeBtn = document.getElementById("completeBtn");
const badgesDiv = document.getElementById("badgesList");

const darkToggle = document.getElementById("darkToggle");

const exportBtn = document.getElementById("exportBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const importBtn = document.getElementById("importBtn");
const filePicker = document.getElementById("filePicker");

// ---- Utils ----
const yyyy_mm_dd = (d) => new Date(d).toISOString().slice(0,10);
const todayStr = () => yyyy_mm_dd(new Date());
function save() { localStorage.setItem("dopamineState", JSON.stringify(state)); }

function getAutoWeek(date) {
  // Use earliest recorded date as cycle start; else treat today as start.
  const first = Object.keys(state.days).sort()[0] || todayStr();
  const delta = Math.floor((new Date(date) - new Date(first)) / 86400000); // days
  return Math.max(1, Math.min(4, Math.floor(delta / 7) + 1));
}
function currentWeek(date) {
  return weekSel.value === "auto" ? getAutoWeek(date) : parseInt(weekSel.value, 10);
}

function setBar(el, pct) { if (el) el.style.width = Math.max(0, Math.min(100, pct)) + "%"; }

function dayPercent(date) {
  const wk = currentWeek(date);
  const plan = PLAN[wk];
  const d = state.days[date] || {};
  const checks = (d.actions || []).filter(Boolean).length + (d.rules || []).filter(Boolean).length;
  const total = plan.actions.length + plan.rules.length;
  return total ? Math.round(100 * checks / total) : 0;
}

function weekAverageFor(date) {
  // Monday..Sunday containing `date`
  const base = new Date(date);
  const day = (base.getDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(base); monday.setDate(base.getDate() - day);
  let sum = 0, count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const key = yyyy_mm_dd(d);
    const pct = dayPercent(key);
    sum += pct; count++;
  }
  return count ? Math.round(sum / count) : 0;
}

// ---- Render Day ----
function renderDay(date) {
  const w = currentWeek(date);
  const plan = PLAN[w];

  // actions/rules
  actionsDiv.innerHTML = "";
  actionsDesc.textContent = {
    1: "Identify drains, set baseline, add a daily low-stim ‘dopamine break’.",
    2: "Replace random spikes with intentional ones; add time-boxing.",
    3: "Push sustained focus and recover faster.",
    4: "Lock it in with habit stacking and review."
  }[w];

  plan.actions.forEach((txt, i) => {
    const checked = state.days[date]?.actions?.[i] || false;
    const row = document.createElement("label");
    row.innerHTML = `<input type="checkbox" data-action="${i}" ${checked ? "checked":""}> ${txt}`;
    actionsDiv.appendChild(row);
  });

  rulesDiv.innerHTML = "";
  plan.rules.forEach((txt, i) => {
    const checked = state.days[date]?.rules?.[i] || false;
    const row = document.createElement("label");
    row.innerHTML = `<input type="checkbox" data-rule="${i}" ${checked ? "checked":""}> ${txt}`;
    rulesDiv.appendChild(row);
  });

  // journal
  journalPrompt.textContent = plan.journalPrompt;
  journalBox.value = state.days[date]?.journal || "";
  charCount.textContent = journalBox.value.length;

  // mood/energy badge text
  const d = state.days[date] || {};
  meNowEl.textContent = (d.mood && d.energy) ? `M${d.mood}/E${d.energy}` : "—";

  // bind change handlers (delegated)
  actionsDiv.onchange = (e) => {
    if (e.target.matches("[data-action]")) {
      const idx = parseInt(e.target.dataset.action, 10);
      state.days[date] = state.days[date] || {};
      state.days[date].actions = state.days[date].actions || [];
      state.days[date].actions[idx] = e.target.checked;
      save(); updateStats();
    }
  };
  rulesDiv.onchange = (e) => {
    if (e.target.matches("[data-rule]")) {
      const idx = parseInt(e.target.dataset.rule, 10);
      state.days[date] = state.days[date] || {};
      state.days[date].rules = state.days[date].rules || [];
      state.days[date].rules[idx] = e.target.checked;
      save(); updateStats();
    }
  };

  updateStats(); renderBadges();
}

// ---- Stats / Badges ----
function updateStats() {
  // Streak
  const dates = Object.keys(state.days).sort();
  let streak = 0, prev = null;
  dates.forEach(d => {
    if (state.days[d].complete) {
      if (!prev || (new Date(d) - new Date(prev) === 86400000)) streak++;
      else streak = 1;
      prev = d;
    }
  });
  streakEl.textContent = streak;

  const date = dateSel.value || todayStr();
  const todayPct = dayPercent(date);
  const weekAvg = weekAverageFor(date);

  scoreEl.textContent = `${todayPct}%`;
  weekProgEl.textContent = `${weekAvg}%`;
  setBar(barToday, todayPct);
  setBar(barWeek, weekAvg);
  ringDaily.setAttribute("stroke-dasharray", `${todayPct},100`);
  ringWeek.setAttribute("stroke-dasharray", `${weekAvg},100`);
}

function renderBadges() {
  const out = [];

  // 7-day streak badge
  let streak = 0, prev = null;
  Object.keys(state.days).sort().forEach(d=>{
    if (state.days[d].complete) {
      if (!prev || (new Date(d)-new Date(prev)===86400000)) streak++;
      else streak = 1;
      prev = d;
    }
  });
  if (streak >= 7) out.push("🏅 7-Day Streak");

  // Perfect week badge (Mon..Sun all completed)
  const today = dateSel.value || todayStr();
  const base = new Date(today); const day = (base.getDay()+6)%7;
  const monday = new Date(base); monday.setDate(base.getDate() - day);
  let all = true;
  for (let i=0;i<7;i++){
    const k = yyyy_mm_dd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()+i));
    if (!(state.days[k] && state.days[k].complete)) { all = false; break; }
  }
  if (all) out.push("🏅 Perfect Week");

  // 28 completions (cycle)
  let totalComplete = 0;
  Object.values(state.days).forEach(v=>{ if(v.complete) totalComplete++; });
  if (totalComplete >= 28) out.push("🏅 Full 4-Week Cycle");

  badgesDiv.innerHTML = out.map(b=>`<span class="pill">${b}</span>`).join("") || "<span class='mut'>No badges yet.</span>";
}

// ---- Journal & Mood/Energy ----
journalBox.oninput = () => {
  const date = dateSel.value || todayStr();
  state.days[date] = state.days[date] || {};
  state.days[date].journal = journalBox.value;
  charCount.textContent = journalBox.value.length;
  save();
};
document.querySelectorAll("[data-mood]").forEach(btn=>{
  btn.onclick = () => {
    const date = dateSel.value || todayStr();
    state.days[date] = state.days[date] || {};
    state.days[date].mood = parseInt(btn.dataset.mood,10);
    save(); renderDay(date);
  };
});
document.querySelectorAll("[data-energy]").forEach(btn=>{
  btn.onclick = () => {
    const date = dateSel.value || todayStr();
    state.days[date] = state.days[date] || {};
    state.days[date].energy = parseInt(btn.dataset.energy,10);
    save(); renderDay(date);
  };
});
clearJournalBtn.onclick = () => { journalBox.value = ""; journalBox.dispatchEvent(new Event("input")); };

// ---- Focus Timer ----
let timerId = null, remain = 0;
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.65);
    navigator.vibrate?.(200);
  } catch {}
}
function startFocus(min) {
  stopFocus();
  remain = Math.max(1, min) * 60;
  focusStatus.textContent = `Focus started: ${min} min`;
  tick();
  function tick(){
    const m = Math.floor(remain/60), s = remain%60;
    focusCountdown.textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    if (remain <= 0) {
      focusStatus.textContent = "Block complete!";
      focusCountdown.textContent = "00:00";
      beep();
      return;
    }
    remain--; timerId = setTimeout(tick, 1000);
  }
}
function stopFocus() {
  if (timerId) clearTimeout(timerId);
  timerId = null; remain = 0;
  focusStatus.textContent = "Timer stopped.";
  focusCountdown.textContent = "";
}

start25.onclick = () => startFocus(25);
start45.onclick = () => startFocus(45);
start60.onclick = () => startFocus(60);
startCustomBtn.onclick = () => {
  const n = parseInt(customMin.value,10);
  if (!n || n<=0) return alert("Enter minutes > 0");
  startFocus(n);
};
stopTimerBtn.onclick = stopFocus;

// ---- Complete Day ----
completeBtn.onclick = () => {
  const date = dateSel.value || todayStr();
  state.days[date] = state.days[date] || {};
  state.days[date].complete = true;
  save(); updateStats(); renderBadges();
};

// ---- Export / Import ----
exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "dopamine-data.json"; a.click();
};
exportCsvBtn.onclick = () => {
  const rows = [["date","week","actions_checked","actions_total","rules_checked","rules_total","score","complete","mood","energy","journal_chars"]];
  Object.keys(state.days).sort().forEach(date=>{
    const wk = currentWeek(date);
    const plan = PLAN[wk];
    const d = state.days[date];
    const ac = (d.actions||[]).filter(Boolean).length;
    const rc = (d.rules||[]).filter(Boolean).length;
    const score = Math.round(100*(ac+rc)/(plan.actions.length+plan.rules.length));
    rows.push([date,wk,ac,plan.actions.length,rc,plan.rules.length,score,!!d.complete,d.mood||"",d.energy||"", (d.journal||"").length]);
  });
  const csv = rows.map(r=>r.join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="dopamine-data.csv"; a.click();
};
importBtn.onclick = () => filePicker.click();
filePicker.onchange = (e) => {
  const file = e.target.files[0]; if(!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try { state = JSON.parse(fr.result); save(); renderDay(dateSel.value||todayStr()); alert("Import successful."); }
    catch (err) { alert("Import failed: "+err.message); }
  };
  fr.readAsText(file);
};

// ---- Controls ----
todayBtn.onclick = () => { dateSel.value = todayStr(); renderDay(dateSel.value); };
dateSel.onchange = () => renderDay(dateSel.value);
weekSel.onchange = () => renderDay(dateSel.value);

// ---- Dark mode (persisted) ----
const THEME_KEY = "dopamineTheme";
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") document.body.classList.add("dark");
})();
darkToggle.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
};

// ---- Init ----
dateSel.value = todayStr();
renderDay(dateSel.value);

// Service worker (optional, if present)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(()=>{});
}
