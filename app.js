// ---- Content model for the 4-week plan ----
const PLAN = {
  1: {
    actionsDesc: "Identify drains, set baseline, add a daily low-stim ‘dopamine break’.",
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
    prompt: "When did I feel most focused today? Least focused?"
  },
  2: {
    actionsDesc: "Replace random spikes with intentional ones; add time-boxing.",
    actions: [
      "2–4 time-boxed focus blocks (25–45 min + 5–10 min break)",
      "Give yourself one small ‘treat’ after a meaningful task",
      "10-min brain-boost (read, learn, puzzle)"
    ],
    rules: [
      "No phone for first hour after waking",
      "High-sugar snacks out of sight; healthy ones visible"
    ],
    prompt: "What’s one thing I’m proud I controlled today?"
  },
  3: {
    actionsDesc: "Push sustained focus and recover faster.",
    actions: [
      "Morning: review top 3 priorities",
      "One 60-min deep work block (single task, no interruptions)",
      "Mid-day recharge (walk, stretch, or meditate 10–15 min)"
    ],
    rules: [
      "One full evening this week without screens",
      "No caffeine after 14:00 to protect sleep"
    ],
    prompt: "What helped me focus longest today?"
  },
  4: {
    actionsDesc: "Lock it in with habit stacking and review.",
    actions: [
      "Habit stack (e.g., journal after breakfast, stretch after lunch)",
      "Weekly review (Sun 10–15 min) to set next week goals",
      "Write one gratitude for non-instant rewards"
    ],
    rules: [
      "Pick 2 habits to keep permanently",
      "Remove 1 distraction source entirely"
    ],
    prompt: "How have focus, mood, and energy changed this month?"
  }
};

// ---- Helpers ----
const $ = sel => document.querySelector(sel);
const todayISO = () => new Date().toISOString().slice(0,10);
const keyFor = (dateISO) => `dopamine:${dateISO}`;
const getState = (dateISO) => JSON.parse(localStorage.getItem(keyFor(dateISO)) || '{}');
const setState = (dateISO, obj) => localStorage.setItem(keyFor(dateISO), JSON.stringify(obj));
const weekOfDate = () => parseInt($("#weekSel").value,10);

// ---- UI init ----
function buildChecklist(container, items, checked=[]) {
  container.innerHTML = "";
  items.forEach((txt, i) => {
    const id = `${container.id}-${i}`;
    const wrap = document.createElement('label');
    wrap.innerHTML = `<input type="checkbox" id="${id}"><div>${txt}</div>`;
    container.appendChild(wrap);
    $("#"+id).checked = !!checked[i];
    $("#"+id).addEventListener('change', save);
  });
}

function load(dateISO){
  const week = weekOfDate();
  const data = getState(dateISO);
  $("#actionsDesc").textContent = PLAN[week].actionsDesc;
  buildChecklist($("#actions"), PLAN[week].actions, data.actions);
  buildChecklist($("#rules"), PLAN[week].rules, data.rules);
  $("#journalPrompt").textContent = PLAN[week].prompt;
  $("#journalBox").value = data.journal || "";
  $("#charCount").textContent = (data.journal||"").length;
  calcStats(dateISO);
  hintSaved();
}

function save(){
  const dateISO = $("#dateSel").value;
  const week = weekOfDate();
  const actions = PLAN[week].actions.map((_,i)=> $("#actions-"+i).checked);
  const rules   = PLAN[week].rules.map((_,i)=> $("#rules-"+i).checked);
  const journal = $("#journalBox").value;
  const complete = actions.filter(Boolean).length / PLAN[week].actions.length >= 0.75 ? true : (getState(dateISO).complete || false);
  setState(dateISO, { week, actions, rules, journal, complete });
  $("#charCount").textContent = journal.length;
  calcStats(dateISO);
  hintSaved();
}

function calcStats(dateISO){
  const data = getState(dateISO);
  const week = weekOfDate();
  const actions = data.actions || [];
  const score = Math.round(100 * (actions.filter(Boolean).length || 0) / PLAN[week].actions.length);
  $("#score").textContent = isFinite(score) ? score+"%" : "0%";

  // week progress for current calendar week, filtered by selected week number
  let completed=0,total=0;
  for(let j=0;j<7;j++){
    const n = new Date($("#dateSel").value);
    n.setDate(n.getDate()-((n.getDay()+6)%7)+j); // Mon..Sun of current calendar week
    const k = keyFor(n.toISOString().slice(0,10));
    const s = JSON.parse(localStorage.getItem(k)||'{}');
    if(s && s.week===week){ total++; if(s.complete) completed++; }
  }
  const wp = total? Math.round(100*completed/total):0;
  $("#weekProg").textContent = wp+"%";

  // streak (consecutive completed days back from selected date)
  let streak=0;
  for(let back=0;back<365;back++){
    const d = new Date(dateISO); d.setDate(d.getDate()-back);
    const s = getState(d.toISOString().slice(0,10));
    if(s.complete) streak++; else break;
  }
  $("#streak").textContent = streak;
}

function hintSaved(){
  const el = $("#saveHint");
  el.textContent = "Saved";
  el.style.opacity = 1;
  setTimeout(()=>{el.style.opacity=.6; el.textContent="Autosaved";}, 900);
}

// ---- Breathing / timers ----
let breatheTimer=null, fiveTimer=null;
function startBox(){
  clearTimers();
  const phases = ["Inhale 4","Hold 4","Exhale 4","Hold 4"];
  let p=0, t=4;
  $("#coach").textContent = "Box breathing started.";
  tick();
  function tick(){
    $("#coach").textContent = phases[p];
    $("#timer").textContent = t.toString().padStart(2,"0");
    if(--t<0){ p=(p+1)%4; t=4; }
    breatheTimer = setTimeout(tick,1000);
  }
}
function fiveMin(){
  clearTimers();
  let s=5*60;
  const go=()=>{ $("#coach").textContent="5-minute reset in progress";
    $("#timer").textContent = `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
    if(s--<=0){ clearTimers(); $("#coach").textContent="Done. Note how you feel."; }
    else fiveTimer=setTimeout(go,1000);
  }; go();
}
function clearTimers(){ if(breatheTimer){clearTimeout(breatheTimer)} if(fiveTimer){clearTimeout(fiveTimer)} $("#timer").textContent=""; }

// ---- Export / Import ----
function exportData(){
  const all = {};
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    if(k && k.startsWith("dopamine:")) all[k]=JSON.parse(localStorage.getItem(k));
  }
  const blob = new Blob([JSON.stringify(all,null,2)],{type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "dopamine-data.json";
  a.click();
}
function importData(file){
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const obj = JSON.parse(e.target.result);
      Object.entries(obj).forEach(([k,v])=>{
        if(k.startsWith("dopamine:")) localStorage.setItem(k,JSON.stringify(v));
      });
      load($("#dateSel").value);
      alert("Import successful.");
    }catch(err){ alert("Import failed: "+err.message); }
  };
  reader.readAsText(file);
}

// ---- Wiring ----
window.addEventListener('load',()=>{
  // date controls
  $("#dateSel").value = todayISO();
  $("#todayBtn").addEventListener('click',()=>{ $("#dateSel").value=todayISO(); load($("#dateSel").value); });
  $("#dateSel").addEventListener('change',()=> load($("#dateSel").value));
  $("#weekSel").addEventListener('change',()=> { save(); load($("#dateSel").value); });

  // journal
  $("#journalBox").addEventListener('input', save);
  $("#clearJournal").addEventListener('click',()=>{ $("#journalBox").value=""; save(); });

  // tools
  $("#boxStart").addEventListener('click', startBox);
  $("#groundBtn").addEventListener('click', ()=> {
    clearTimers();
    $("#coach").innerHTML = "Name 5 things you <b>see</b>, 4 you <b>feel</b>, 3 you <b>hear</b>, 2 you <b>smell</b>, 1 you <b>taste</b>.";
  });
  $("#fiveBtn").addEventListener('click', fiveMin);

  // complete
  $("#completeBtn").addEventListener('click', ()=>{
    const d = $("#dateSel").value;
    const s = getState(d);
    s.complete = true; setState(d,s); calcStats(d); hintSaved();
  });

  // data
  $("#exportBtn").addEventListener('click', exportData);
  $("#importBtn").addEventListener('click', ()=> $("#filePicker").click());
  $("#filePicker").addEventListener('change', e=> importData(e.target.files[0]));

  // service worker
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js'); }

  load($("#dateSel").value);
});
