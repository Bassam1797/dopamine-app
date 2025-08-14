// Dopamine Plan Upgraded app.js
// Local storage-based, offline-first habit & focus tracker with scheduling, timers, charts, badges, and push notifications

// --- CONFIGURATION ---
const PLAN = {
  weeks: {
    1: {
      actions: [
        "Wake up at the same time",
        "Morning sunlight 5+ min",
        "Movement / exercise",
        "Protein-rich breakfast",
        "Plan your day",
        "Mindful social media limit"
      ],
      rules: [
        "No caffeine after 2pm",
        "Bedtime routine start at 10pm",
        "No phone in bed",
        "Max 2h recreational screen time"
      ],
      journalPrompt: "Reflect on how your energy feels today."
    },
    2: {
      actions: [
        "Add 5 min meditation",
        "Track one habit in detail",
        "Go for a 20 min walk",
        "Increase protein by 10g",
        "Check schedule before lunch",
        "Limit news consumption"
      ],
      rules: [
        "No snacking after 8pm",
        "Wind down lights at 9:30pm",
        "Avoid multitasking"
      ],
      journalPrompt: "What felt easier this week compared to last?"
    },
    3: {
      actions: [
        "Deep work block AM",
        "Add 5 min gratitude journaling",
        "Cold exposure or brisk walk",
        "Social connection call or chat",
        "One task from 'important not urgent'"
      ],
      rules: [
        "No eating while watching videos",
        "Limit evening phone use",
        "Review tomorrow's tasks before bed"
      ],
      journalPrompt: "What positive changes have you noticed?"
    },
    4: {
      actions: [
        "Review all 4 weeks' wins",
        "Refine habits you keep",
        "Plan long-term structure",
        "Test one new productivity tool",
        "Do something playful"
      ],
      rules: [
        "Protect non-negotiable sleep",
        "Limit processed sugar",
        "Weekly planning session"
      ],
      journalPrompt: "What’s your plan after this program?"
    }
  }
};

// --- STATE ---
let state = JSON.parse(localStorage.getItem("dopamineState") || "{}");

// Ensure defaults
if (!state.days) state.days = {};
if (!state.pin) state.pin = "";
if (!state.dark) state.dark = false;
if (!state.badges) state.badges = [];

// --- DOM ---
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
const meNowEl = document.getElementById("meNow");
const ringDaily = document.getElementById("ringDaily");
const ringWeek = document.getElementById("ringWeek");
const pixelGrid = document.getElementById("pixelGrid");
const dailyChart = document.getElementById("dailyChart");
const badgesDiv = document.getElementById("badges");
const start25 = document.getElementById("start25");
const start45 = document.getElementById("start45");
const start60 = document.getElementById("start60");
const startCustom = document.getElementById("startCustom");
const stopTimer = document.getElementById("stopTimer");
const focusStatus = document.getElementById("focusStatus");
const focusCountdown = document.getElementById("focusCountdown");
const remind5 = document.getElementById("remind5");
const addCal5 = document.getElementById("addCal5");
const subscribePush = document.getElementById("subscribePush");
const schedulePush5 = document.getElementById("schedulePush5");
const completeBtn = document.getElementById("completeBtn");
const darkToggle = document.getElementById("darkToggle");
const lock = document.getElementById("lock");
const pinInput = document.getElementById("pinInput");
const pinSubmit = document.getElementById("pinSubmit");
const pinMsg = document.getElementById("pinMsg");
const exportBtn = document.getElementById("exportBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const importBtn = document.getElementById("importBtn");
const filePicker = document.getElementById("filePicker");

// --- UTILS ---
function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function saveState() {
  localStorage.setItem("dopamineState", JSON.stringify(state));
}
function getWeekForDate(date) {
  // Auto week logic: start week 1 at first day
  let firstDate = Object.keys(state.days).sort()[0] || todayStr();
  let diff = Math.floor((new Date(date) - new Date(firstDate)) / (1000 * 60 * 60 * 24));
  return Math.min(4, Math.floor(diff / 7) + 1);
}

// --- RENDER ---
function renderDay(date) {
  let weekNum = weekSel.value === "auto" ? getWeekForDate(date) : parseInt(weekSel.value);
  let plan = PLAN.weeks[weekNum];
  actionsDiv.innerHTML = "";
  plan.actions.forEach((act, i) => {
    let id = `a${i}`;
    let checked = state.days[date]?.actions?.[i] || false;
    actionsDiv.innerHTML += `<label><input type="checkbox" data-action="${i}" ${checked ? "checked" : ""}> ${act}</label>`;
  });
  rulesDiv.innerHTML = "";
  plan.rules.forEach((rule, i) => {
    let id = `r${i}`;
    let checked = state.days[date]?.rules?.[i] || false;
    rulesDiv.innerHTML += `<label><input type="checkbox" data-rule="${i}" ${checked ? "checked" : ""}> ${rule}</label>`;
  });
  journalPrompt.textContent = plan.journalPrompt;
  journalBox.value = state.days[date]?.journal || "";
  charCount.textContent = journalBox.value.length;
  if (state.days[date]?.mood && state.days[date]?.energy) {
    meNowEl.textContent = `M${state.days[date].mood}/E${state.days[date].energy}`;
  } else {
    meNowEl.textContent = "—";
  }
  updateStats();
}

// --- EVENTS ---
todayBtn.onclick = () => {
  dateSel.value = todayStr();
  renderDay(todayStr());
};
dateSel.onchange = () => {
  renderDay(dateSel.value);
};
actionsDiv.onchange = (e) => {
  if (e.target.dataset.action !== undefined) {
    let date = dateSel.value || todayStr();
    state.days[date] = state.days[date] || {};
    state.days[date].actions = state.days[date].actions || [];
    state.days[date].actions[e.target.dataset.action] = e.target.checked;
    saveState();
    updateStats();
  }
};
rulesDiv.onchange = (e) => {
  if (e.target.dataset.rule !== undefined) {
    let date = dateSel.value || todayStr();
    state.days[date] = state.days[date] || {};
    state.days[date].rules = state.days[date].rules || [];
    state.days[date].rules[e.target.dataset.rule] = e.target.checked;
    saveState();
    updateStats();
  }
};
journalBox.oninput = () => {
  let date = dateSel.value || todayStr();
  state.days[date] = state.days[date] || {};
  state.days[date].journal = journalBox.value;
  charCount.textContent = journalBox.value.length;
  saveState();
};
clearJournalBtn.onclick = () => {
  journalBox.value = "";
  journalBox.dispatchEvent(new Event("input"));
};

// Mood/Energy
document.querySelectorAll("[data-mood]").forEach(btn => {
  btn.onclick = () => {
    let date = dateSel.value || todayStr();
    state.days[date] = state.days[date] || {};
    state.days[date].mood = parseInt(btn.dataset.mood);
    saveState();
    renderDay(date);
  };
});
document.querySelectorAll("[data-energy]").forEach(btn => {
  btn.onclick = () => {
    let date = dateSel.value || todayStr();
    state.days[date] = state.days[date] || {};
    state.days[date].energy = parseInt(btn.dataset.energy);
    saveState();
    renderDay(date);
  };
});

// Complete day
completeBtn.onclick = () => {
  let date = dateSel.value || todayStr();
  state.days[date] = state.days[date] || {};
  state.days[date].complete = true;
  saveState();
  updateStats();
  awardBadges();
};

// Stats
function updateStats() {
  let dates = Object.keys(state.days).sort();
  let streak = 0, maxStreak = 0;
  let prev = null;
  dates.forEach(d => {
    if (state.days[d].complete) {
      if (!prev || new Date(d) - new Date(prev) === 86400000) {
        streak++;
      } else {
        streak = 1;
      }
      maxStreak = Math.max(maxStreak, streak);
      prev = d;
    }
  });
  streakEl.textContent = streak;
  // Score
  let date = dateSel.value || todayStr();
  let day = state.days[date] || {};
  let totalChecks = (day.actions || []).filter(x => x).length + (day.rules || []).filter(x => x).length;
  let totalItems = (PLAN.weeks[getWeekForDate(date)].actions.length + PLAN.weeks[getWeekForDate(date)].rules.length);
  let pct = totalItems ? Math.round(totalChecks / totalItems * 100) : 0;
  scoreEl.textContent = pct + "%";
  weekProgEl.textContent = Math.min(100, pct) + "%";
  ringDaily.setAttribute("stroke-dasharray", `${pct},100`);
  ringWeek.setAttribute("stroke-dasharray", `${pct},100`);
}

// Badges
function awardBadges() {
  let totalDays = Object.keys(state.days).length;
  if (totalDays >= 7 && !state.badges.includes("Week1")) {
    state.badges.push("Week1");
  }
  saveState();
  badgesDiv.innerHTML = state.badges.map(b => `<span class="pill">${b}</span>`).join("");
}

// --- INIT ---
dateSel.value = todayStr();
renderDay(todayStr());
updateStats();
awardBadges();
