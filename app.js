// ==========================
//   CONFIG / STATE
// ==========================
const dateSel = document.getElementById("dateSel");
const weekNum = document.getElementById("weekNum");
const tasksList = document.getElementById("tasksList");
const scheduledList = document.getElementById("scheduledList");

let data = JSON.parse(localStorage.getItem("dopamineData") || "{}");
const todayStr = () => new Date().toISOString().slice(0,10);

const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
let taskTimers = {}; // running timers

// ==========================
//   INIT
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  if (!data.startDate) data.startDate = todayStr();
  if (!data.currentWeek) data.currentWeek = 1;
  if (!data.scheduledTasks) data.scheduledTasks = [];

  autoAdvanceWeek();
  render();
  setInterval(checkScheduledTasks, 30000); // every 30 sec
});

// ==========================
//   SAVE & LOAD
// ==========================
function saveData() {
  localStorage.setItem("dopamineData", JSON.stringify(data));
}

function getDay(dateStr) {
  if (!data.days) data.days = {};
  if (!data.days[dateStr]) {
    data.days[dateStr] = { tasks: [], completed: [] };
  }
  return data.days[dateStr];
}

function saveDay(dayObj) {
  data.days[dateSel.value] = dayObj;
  saveData();
}

// ==========================
//   WEEK AUTO-ADVANCE
// ==========================
function autoAdvanceWeek() {
  const start = new Date(data.startDate);
  const now = new Date();
  const diffDays = Math.floor((now - start) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  if (week > data.currentWeek) {
    data.currentWeek = week;
    saveData();
  }
  weekNum.textContent = data.currentWeek;
}

// ==========================
//   RENDER UI
// ==========================
function render() {
  const dayData = getDay(todayStr());
  dateSel.value = todayStr();
  renderTasks(dayData);
  renderScheduled();
}

function renderTasks(dayData) {
  tasksList.innerHTML = "";
  dayData.tasks.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "task-row";

    const txt = document.createElement("input");
    txt.type = "text";
    txt.placeholder = `Task ${i+1}`;
    txt.value = t.text || "";
    txt.oninput = () => { t.text = txt.value; saveDay(dayData); };

    const mins = document.createElement("input");
    mins.type = "number"; mins.min = "1"; mins.value = t.min || 25;
    mins.onchange = () => { t.min = parseInt(mins.value,10) || 25; saveDay(dayData); };

    const startBtn = document.createElement("button");
    startBtn.textContent = "Start";
    startBtn.onclick = () => startTaskTimer(i, t.min, t.text);

    const stopBtn = document.createElement("button");
    stopBtn.textContent = "Stop";
    stopBtn.onclick = () => stopTaskTimer(i);

    const cd = document.createElement("div");
    cd.id = `taskCD${i}`; cd.className = "task-countdown";

    row.append(txt, mins, startBtn, stopBtn, cd);
    tasksList.appendChild(row);
  });

  // Add Task button
  const addBtn = document.createElement("button");
  addBtn.textContent = "+ Add Task";
  addBtn.onclick = () => {
    dayData.tasks.push({ text: "", min: 25 });
    saveDay(dayData);
    renderTasks(dayData);
  };
  tasksList.appendChild(addBtn);
}

function renderScheduled() {
  scheduledList.innerHTML = "";
  data.scheduledTasks.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "task-row";

    const txt = document.createElement("input");
    txt.type = "text"; txt.value = t.text || "";
    txt.oninput = () => { t.text = txt.value; saveData(); };

    const date = document.createElement("input");
    date.type = "datetime-local";
    date.value = t.time || "";
    date.onchange = () => { t.time = date.value; saveData(); };

    const mins = document.createElement("input");
    mins.type = "number"; mins.min = "1"; mins.value = t.min || 25;
    mins.onchange = () => { t.min = parseInt(mins.value,10) || 25; saveData(); };

    const delBtn = document.createElement("button");
    delBtn.textContent = "Del";
    delBtn.onclick = () => { data.scheduledTasks.splice(i,1); saveData(); renderScheduled(); };

    row.append(txt, date, mins, delBtn);
    scheduledList.appendChild(row);
  });

  const addBtn = document.createElement("button");
  addBtn.textContent = "+ Add Scheduled Task";
  addBtn.onclick = () => {
    data.scheduledTasks.push({ text: "", time: "", min: 25 });
    saveData();
    renderScheduled();
  };
  scheduledList.appendChild(addBtn);
}

// ==========================
//   TIMERS
// ==========================
function startTaskTimer(index, minutes, label){
  stopTaskTimer(index);
  const end = Date.now() + Math.max(1, minutes) * 60000;
  const cdId = `taskCD${index}`;

  const tick = () => {
    const left = end - Date.now();
    const el = document.getElementById(cdId);
    if (!el) { clearInterval(taskTimers[index]?.intervalId); return; }
    if (left <= 0) {
      clearInterval(taskTimers[index].intervalId);
      el.textContent = "⏰";
      unlockAudio();
      playLoudAlarm(3000); // 3 sec
      notifyUser(label ? `Finished: ${label}` : "Task finished");
      delete taskTimers[index];
      return;
    }
    const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
    el.textContent = `${m}:${String(s).padStart(2,"0")}`;
  };

  taskTimers[index] = { end, intervalId: setInterval(tick, 250) };
  tick();
}

function stopTaskTimer(index){
  if (taskTimers[index]) {
    clearInterval(taskTimers[index].intervalId);
    delete taskTimers[index];
  }
  const el = document.getElementById(`taskCD${index}`);
  if (el) el.textContent = "";
}

// ==========================
//   SCHEDULED TASK CHECK
// ==========================
function checkScheduledTasks() {
  const now = new Date();
  let moved = false;

  data.scheduledTasks = data.scheduledTasks.filter(t => {
    if (t.time && new Date(t.time) <= now) {
      const today = getDay(todayStr());
      today.tasks.push({ text: t.text, min: t.min });
      saveDay(today);
      notifyUser(`Scheduled task moved: ${t.text}`);
      moved = true;
      return false; // remove from scheduled list
    }
    return true;
  });

  if (moved) {
    saveData();
    render();
  }
}

// ==========================
//   NOTIFICATIONS
// ==========================
function notifyUser(msg) {
  if ("Notification" in window && Notification.permission === "granted") {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification("⏰ Task Alert", {
          body: msg,
          icon: "icons/icon-192.png",
          badge: "icons/icon-192.png"
        });
      });
    } else {
      new Notification("⏰ Task Alert", { body: msg });
    }
  }
}

// ==========================
//   ALARM SOUND
// ==========================
function playLoudAlarm(durationMs = 3000) {
  try {
    const audio = new Audio("sounds/alarm.mp3");
    audio.volume = 1.0;
    audio.loop = true;
    audio.play().catch(err => {
      console.warn("Alarm playback blocked:", err);
      playBeep();
    });

    if (!isiOS && navigator.vibrate) {
      navigator.vibrate([500, 200, 500]);
    }

    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, durationMs);

  } catch (err) {
    console.error("Alarm error:", err);
    playBeep();
  }
}

// ==========================
//   AUDIO UNLOCK + BEEP Fallback
// ==========================
function unlockAudio(){
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

function playBeep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}
