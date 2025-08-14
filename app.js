/* ==== Dopamine App – Full JS ==== */

// Week data
const plan = {
  1: { actions: ["Wake up at same time", "Plan day in morning", "Walk 20 min", "Read 15 min"], rules: ["No social media in morning", "Limit sugar"], journal: "Write 3 things you're grateful for" },
  2: { actions: ["Wake up at same time", "Work on priority task 1h", "Exercise 30 min", "Read 15 min"], rules: ["No screens after 10pm", "Limit caffeine"], journal: "Reflect on your wins" },
  3: { actions: ["Wake up at same time", "Do hardest task first", "Stretch 10 min", "Read 15 min"], rules: ["No phone in bedroom", "Avoid junk food"], journal: "Note any challenges today" },
  4: { actions: ["Wake up at same time", "Deep work 2h", "Exercise 30 min", "Read 15 min"], rules: ["No social media during work", "Drink 2L water"], journal: "How can tomorrow be better?" }
};

let data = JSON.parse(localStorage.getItem("dopamineData") || "{}");
let currentDate = new Date().toISOString().split("T")[0];

// Elements
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

// Populate week selector
["Auto", 1, 2, 3, 4].forEach(w => {
  let opt = document.createElement("option");
  opt.value = w;
  opt.textContent = w;
  weekSel.appendChild(opt);
});
weekSel.value = "Auto";

// Date selector
dateSel.value = currentDate;
dateSel.addEventListener("change", () => {
  currentDate = dateSel.value;
  render();
});

// Dark mode toggle
document.getElementById("darkToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("dopamineDark", document.body.classList.contains("dark"));
});
if (localStorage.getItem("dopamineDark") === "true") {
  document.body.classList.add("dark");
}

// Render UI
function render() {
  let weekNum = weekSel.value === "Auto" ? getAutoWeek(currentDate) : parseInt(weekSel.value);
  let dayData = data[currentDate] || { actions: [], rules: [], journal: "", mood: null, energy: null };

  actionsDiv.innerHTML = "";
  rulesDiv.innerHTML = "";

  plan[weekNum].actions.forEach((a, i) => {
    let lbl = document.createElement("label");
    let cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = dayData.actions[i] || false;
    cb.addEventListener("change", () => {
      dayData.actions[i] = cb.checked;
      saveDay(dayData);
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(a));
    actionsDiv.appendChild(lbl);
  });

  plan[weekNum].rules.forEach((r, i) => {
    let lbl = document.createElement("label");
    let cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = dayData.rules[i] || false;
    cb.addEventListener("change", () => {
      dayData.rules[i] = cb.checked;
      saveDay(dayData);
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(r));
    rulesDiv.appendChild(lbl);
  });

  journal.value = dayData.journal || "";
  journal.oninput = () => { dayData.journal = journal.value; saveDay(dayData); };

  // Mood/Energy
  moodBtns.innerHTML = "";
  energyBtns.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    let mBtn = document.createElement("button");
    mBtn.textContent = `😊${i}`;
    if (dayData.mood === i) mBtn.style.background = "orange";
    mBtn.onclick = () => { dayData.mood = i; saveDay(dayData); render(); };
    moodBtns.appendChild(mBtn);

    let eBtn = document.createElement("button");
    eBtn.textContent = `⚡${i}`;
    if (dayData.energy === i) eBtn.style.background = "orange";
    eBtn.onclick = () => { dayData.energy = i; saveDay(dayData); render(); };
    energyBtns.appendChild(eBtn);
  }

  updateStats();
}

// Auto week calc
function getAutoWeek(dateStr) {
  let start = new Date(Object.keys(data)[0] || currentDate);
  let today = new Date(dateStr);
  let diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return (Math.floor(diff / 7) % 4) + 1;
}

// Save
function saveDay(dayData) {
  data[currentDate] = dayData;
  localStorage.setItem("dopamineData", JSON.stringify(data));
  updateStats();
}

// Stats
function updateStats() {
  let day = data[currentDate] || {};
  let totalChecks = (day.actions || []).concat(day.rules || []);
  let checked = totalChecks.filter(Boolean).length;
  let score = totalChecks.length ? Math.round((checked / totalChecks.length) * 100) : 0;
  scoreEl.textContent = `${score}%`;
  barToday.style.width = `${score}%`;
  ringDaily.setAttribute("stroke-dasharray", `${score * 2.2}, 220`);

  // Week progress
  let weekNum = weekSel.value === "Auto" ? getAutoWeek(currentDate) : parseInt(weekSel.value);
  let weekDates = Object.keys(data).filter(d => getAutoWeek(d) === weekNum);
  let weekScores = weekDates.map(d => {
    let c = (data[d].actions || []).concat(data[d].rules || []);
    return c.length ? c.filter(Boolean).length / c.length : 0;
  });
  let weekAvg = weekScores.length ? Math.round((weekScores.reduce((a,b)=>a+b,0)/weekScores.length)*100) : 0;
  weekProgEl.textContent = `${weekAvg}%`;
  barWeek.style.width = `${weekAvg}%`;
  ringWeek.setAttribute("stroke-dasharray", `${weekAvg * 2.2}, 220`);

  // Streak
  streakEl.textContent = calcStreak();

  // Badges
  badgesDiv.innerHTML = "";
  if (calcStreak() >= 7) badgesDiv.innerHTML += `<span class="pill">🏅 7-day streak</span>`;
  if (weekAvg === 100) badgesDiv.innerHTML += `<span class="pill">🌟 Perfect Week</span>`;
  if (Object.keys(data).length >= 28) badgesDiv.innerHTML += `<span class="pill">🏆 4-week finisher</span>`;
}

function calcStreak() {
  let dates = Object.keys(data).sort();
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    let date = dates[i];
    let c = (data[date].actions || []).concat(data[date].rules || []);
    if (c.length && c.every(Boolean)) streak++;
    else break;
  }
  return streak;
}

// Mark complete
document.getElementById("markComplete").onclick = () => {
  let dayData = data[currentDate] || { actions: [], rules: [], journal: "", mood: null, energy: null };
  dayData.actions = plan[getAutoWeek(currentDate)].actions.map(() => true);
  dayData.rules = plan[getAutoWeek(currentDate)].rules.map(() => true);
  saveDay(dayData);
  render();
};

// Clear journal
document.getElementById("clearJournal").onclick = () => {
  journal.value = "";
  let dayData = data[currentDate];
  if (dayData) { dayData.journal = ""; saveDay(dayData); }
};

// Export / Import
function exportJSON() {
  let blob = new Blob([JSON.stringify(data)], {type: "application/json"});
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url; a.download = "dopamine-data.json"; a.click();
}
function exportCSV() {
  let rows = [["Date", "Actions Done", "Rules Done", "Mood", "Energy", "Journal"]];
  Object.keys(data).forEach(d => {
    rows.push([d, (data[d].actions||[]).filter(Boolean).length, (data[d].rules||[]).filter(Boolean).length, data[d].mood, data[d].energy, JSON.stringify(data[d].journal)]);
  });
  let csv = rows.map(r => r.join(",")).join("\n");
  let blob = new Blob([csv], {type: "text/csv"});
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url; a.download = "dopamine-data.csv"; a.click();
}
document.getElementById("importFile").onchange = function() {
  let file = this.files[0];
  let reader = new FileReader();
  reader.onload = (e) => {
    data = JSON.parse(e.target.result);
    localStorage.setItem("dopamineData", JSON.stringify(data));
    render();
  };
  reader.readAsText(file);
};

// Timer
let timerInt;
function startTimer(mins) {
  let end = Date.now() + mins * 60 * 1000;
  clearInterval(timerInt);
  timerInt = setInterval(() => {
    let left = end - Date.now();
    if (left <= 0) {
      clearInterval(timerInt);
      timerDisplay.textContent = "⏰ Time's up!";
      notify("⏰ Time's up!");
      if ("vibrate" in navigator) navigator.vibrate(500);
      new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg").play();
    } else {
      let m = Math.floor(left / 60000);
      let s = Math.floor((left % 60000) / 1000);
      timerDisplay.textContent = `${m}:${s.toString().padStart(2,"0")}`;
    }
  }, 500);
}
function startCustom() {
  let mins = parseInt(document.getElementById("customMins").value);
  if (mins > 0) startTimer(mins);
}
document.getElementById("stopTimer").onclick = () => { clearInterval(timerInt); timerDisplay.textContent = ""; };

// Notifications
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}
function notify(msg) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(msg);
  }
}

// Init
render();

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(() => console.log("Service Worker Registered"));
}
