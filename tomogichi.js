// ═══════════════════════════════════════════════
// TOMOGICHI WEB — Cybertronian Squad Manager
// Faithful port of the Qt/C++ Tomogichi app
// + Agora bridge adapter for Teletraan communication
// + Money plan feature
// ═══════════════════════════════════════════════

var BRIDGE_URL = 'http://localhost:9191';
var state = null;
var activePage = 'guild';
var pageStack = [];
var activeStatsTab = 'skills';
var activeSettingsTab = 'tasks';
var timerInterval = null;
var timerStartTime = 0;
var timerPlannedMin = 0;
var timerPersonId = '';
var timerSkillName = '';
var lastCmdLine = 0;
var cmdResults = {};
var pollTimer = null;
var lockTimer = null;
var charMode = 'pet';  // 'pet' | 'cybertronian'
var currentTheme = 'dark';  // 'dark' | 'light' | 'colorful'
var shopEnabled = true;

// ── Character definitions (matches make_riff/reef/pitch/rain in engine.cpp) ──
var CHAR_DEFS = {
  riff:  {name:'Riff',  role:'Designer',  skills:[
    {name:'drawing',  is_main:true},
    {name:'sewing',   is_main:false},
    {name:'lefthand', is_main:false},
  ], altMode:'Concept Car', altColors:['#C0C0C0','#00D4FF'], cyberGlyph:'🏎'},
  reef:  {name:'Reef',  role:'Architect', skills:[
    {name:'3d-model',  is_main:true},
    {name:'linux',     is_main:false},
    {name:'anatomy',   is_main:false},
  ], altMode:'All-Terrain Vehicle', altColors:['#2a2a2a','#FF6600'], cyberGlyph:'🚙'},
  pitch: {name:'Pitch', role:'Athlete',   skills:[
    {name:'dance',    is_main:true},
    {name:'driving',  is_main:false},
    {name:'kendama',  is_main:false},
  ], altMode:'Sport Bike', altColors:['#0a0a0a','#FF0000'], cyberGlyph:'🏍'},
  rain:  {name:'Rain',  role:'Regulator', skills:[
    {name:'massage',     is_main:true},
    {name:'ferment',     is_main:false},
    {name:'meditation',  is_main:false},
  ], altMode:'Fighter Jet', altColors:['#2a0a4a','#00FFCC'], cyberGlyph:'✈'},
};

// ── Mood words (25, matching real app) ──
var MOOD_WORDS = [
  {word:'happy',emoji:'😊'},{word:'sad',emoji:'😢'},{word:'tired',emoji:'😴'},
  {word:'energetic',emoji:'⚡'},{word:'anxious',emoji:'😰'},{word:'calm',emoji:'😌'},
  {word:'focused',emoji:'🎯'},{word:'distracted',emoji:'😵'},{word:'motivated',emoji:'💪'},
  {word:'lazy',emoji:'🦥'},{word:'creative',emoji:'🎨'},{word:'blocked',emoji:'🚧'},
  {word:'grateful',emoji:'🙏'},{word:'frustrated',emoji:'😤'},{word:'peaceful',emoji:'🕊️'},
  {word:'restless',emoji:'🔄'},{word:'excited',emoji:'🤩'},{word:'bored',emoji:'🥱'},
  {word:'hopeful',emoji:'🌟'},{word:'drained',emoji:'🪫'},{word:'curious',emoji:'🤔'},
  {word:'overwhelmed',emoji:'🌊'},{word:'content',emoji:'😌'},{word:'proud',emoji:'🏆'},
  {word:'lonely',emoji:'💔'},
];

// ── Cross-bonus rules (8 directional, +5% at level 10) ──
var CROSS_BONUS_RULES = [
  {from_p:'riff',  from_s:'drawing',     to_p:'reef',  to_s:'3d-model'},
  {from_p:'reef',  from_s:'3d-model',    to_p:'riff',  to_s:'drawing'},
  {from_p:'pitch', from_s:'dance',       to_p:'rain',  to_s:'meditation'},
  {from_p:'rain',  from_s:'meditation',  to_p:'riff',  to_s:'lefthand'},
  {from_p:'rain',  from_s:'massage',     to_p:'reef',  to_s:'anatomy'},
  {from_p:'reef',  from_s:'anatomy',     to_p:'rain',  to_s:'massage'},
  {from_p:'reef',  from_s:'linux',       to_p:'pitch', to_s:'driving'},
  {from_p:'pitch', from_s:'kendama',     to_p:'riff',  to_s:'sewing'},
];

// ── Achievement definitions (16 badges) ──
var ACHIEVEMENTS = [
  {id:'first_practice',name:'First Step',icon:'👣',check:function(s){return s.practice_log.length>=1;}},
  {id:'hour_1',name:'One Hour Club',icon:'⏱',check:function(s){return totalMinutes(s)>=60;}},
  {id:'hour_10',name:'Dedicated',icon:'🔥',check:function(s){return totalMinutes(s)>=600;}},
  {id:'hour_50',name:'Master in Making',icon:'💎',check:function(s){return totalMinutes(s)>=3000;}},
  {id:'streak_3',name:'Momentum',icon:'📿',check:function(s){return currentStreak(s)>=3;}},
  {id:'streak_7',name:'Weekly Warrior',icon:'⚔',check:function(s){return currentStreak(s)>=7;}},
  {id:'streak_30',name:'Unstoppable',icon:'👑',check:function(s){return currentStreak(s)>=30;}},
  {id:'all_four',name:'Full Party',icon:'🎭',check:function(s){return practicedTodayCount(s)===4;}},
  {id:'level_5_any',name:'Apprentice',icon:'⭐',check:function(s){return anySkillLevel(s,5);}},
  {id:'level_10_any',name:'Artisan',icon:'🌟',check:function(s){return anySkillLevel(s,10);}},
  {id:'level_20_any',name:'Maestro',icon:'✨',check:function(s){return anySkillLevel(s,20);}},
  {id:'coins_100',name:'Collector',icon:'🪙',check:function(s){return s.master.coins>=100;}},
  {id:'coins_1000',name:'Treasurer',icon:'💰',check:function(s){return s.master.coins>=1000;}},
  // daily_7 intentionally skipped (matches C++ comment)
  {id:'challenge_5',name:'Challenger',icon:'🏆',check:function(s){return completedChallenges(s)>=5;}},
  {id:'challenge_20',name:'Overachiever',icon:'🎪',check:function(s){return completedChallenges(s)>=20;}},
];

// ── Shop items ──
var SHOP_ITEMS = [
  {id:'entropy_reset',name:'Entropy Reset',cost:50,desc:'Reset entropy to 0'},
  {id:'xp_boost',name:'XP Boost',cost:20,desc:'Next practice gives 1.5× XP'},
  {id:'skip_day',name:'Skip Day',cost:30,desc:'Reduce entropy by 5 and skip today\'s auto-update'},
  {id:'custom_title',name:'Custom Title',cost:100,desc:'Set a custom title for a character'},
  {id:'coins_double',name:'Coin Doubler',cost:40,desc:'Next completed challenge gives 2× coins'},
];

// ── Titles ──
var TITLES = [
  {maxLevel:4,name:'Novice'},{maxLevel:9,name:'Apprentice'},{maxLevel:14,name:'Artisan'},
  {maxLevel:19,name:'Expert'},{maxLevel:24,name:'Maestro'},{maxLevel:999,name:'Grandmaster'},
];

// ═══════════════════════════════════════════════
// GAME ENGINE — matches engine.cpp logic
// ═══════════════════════════════════════════════

function minutesToXp(m) { return Math.floor((m * 100) / 60); }
function skillLevel(xp) { return Math.floor(Math.sqrt(xp / 100)); }
function xpForLevel(L) { return L * L * 100; }
function xpProgressPct(xp) {
  var lvl = skillLevel(xp);
  var cur = xpForLevel(lvl);
  var next = xpForLevel(lvl + 1);
  if (next <= cur) return 100;
  return Math.floor(((xp - cur) * 100) / (next - cur));
}
function titleForLevel(level) {
  for (var i = 0; i < TITLES.length; i++) {
    if (level <= TITLES[i].maxLevel) return TITLES[i].name;
  }
  return 'Grandmaster';
}
function personLevel(person) {
  if (!person.skills || person.skills.length === 0) return 0;
  var mainLvl = 0, secLvl = 0, secCount = 0;
  for (var i = 0; i < person.skills.length; i++) {
    var s = person.skills[i];
    if (s.archived) continue;
    var lvl = skillLevel(s.xp || 0);
    if (s.is_main) mainLvl = lvl;
    else { secLvl += lvl; secCount++; }
  }
  var weight = 0.50 + secCount * 0.25;
  if (weight === 0) return 0;
  return Math.floor((mainLvl * 0.50 + secLvl * 0.25) / weight);
}
function guildLevel() {
  if (!state || !state.persons) return 0;
  var sum = 0;
  for (var i = 0; i < state.persons.length; i++) sum += personLevel(state.persons[i]);
  return Math.floor(sum / state.persons.length);
}
function totalMinutes(s) {
  var total = 0;
  for (var i = 0; i < s.practice_log.length; i++) total += s.practice_log[i].minutes || 0;
  return total;
}
function totalXP(s) {
  var total = 0;
  for (var i = 0; i < s.persons.length; i++) {
    for (var j = 0; j < s.persons[i].skills.length; j++) {
      total += s.persons[i].skills[j].xp || 0;
    }
  }
  return total;
}
function currentStreak(s) {
  // Count consecutive days with at least one practice entry
  var days = {};
  for (var i = 0; i < s.practice_log.length; i++) {
    var d = (s.practice_log[i].time || '').substring(0, 10);
    if (d) days[d] = true;
  }
  var streak = 0;
  var dt = new Date();
  while (true) {
    var iso = dt.toISOString().substring(0, 10);
    if (days[iso]) { streak++; dt.setDate(dt.getDate() - 1); }
    else break;
  }
  return streak;
}
function practicedTodayCount(s) {
  var today = new Date().toISOString().substring(0, 10);
  var persons = {};
  for (var i = 0; i < s.practice_log.length; i++) {
    var entry = s.practice_log[i];
    if ((entry.time || '').substring(0, 10) === today) {
      persons[entry.person] = true;
    }
  }
  return Object.keys(persons).length;
}
function anySkillLevel(s, targetLevel) {
  for (var i = 0; i < s.persons.length; i++) {
    for (var j = 0; j < s.persons[i].skills.length; j++) {
      if (skillLevel(s.persons[i].skills[j].xp || 0) >= targetLevel) return true;
    }
  }
  return false;
}
function completedChallenges(s) {
  var count = 0;
  for (var i = 0; i < s.master.challenges.length; i++) {
    if (s.master.challenges[i].completed) count++;
  }
  return count;
}
function charMood(lastPracticeTs) {
  if (!lastPracticeTs) return {emoji:'💔',text:'lonely',level:3};
  var last = new Date(lastPracticeTs);
  var days = Math.floor((Date.now() - last.getTime()) / 86400000);
  if (days <= 1) return {emoji:'😊',text:'happy',level:0};
  if (days <= 3) return {emoji:'😐',text:'neutral',level:1};
  if (days <= 7) return {emoji:'😢',text:'sad',level:2};
  return {emoji:'💔',text:'lonely',level:3};
}
function skillWarmth(lastPracticeTs) {
  if (!lastPracticeTs) return 'cold';
  var last = new Date(lastPracticeTs);
  var days = Math.floor((Date.now() - last.getTime()) / 86400000);
  if (days <= 2) return 'warm';
  if (days <= 5) return 'cool';
  return 'cold';
}
function lastPracticeForSkill(personId, skillName) {
  if (!state) return null;
  for (var i = state.practice_log.length - 1; i >= 0; i--) {
    var e = state.practice_log[i];
    if (e.person === personId && e.skill === skillName) return e.time;
  }
  return null;
}
function lastPracticeForPerson(personId) {
  if (!state) return null;
  for (var i = state.practice_log.length - 1; i >= 0; i--) {
    if (state.practice_log[i].person === personId) return state.practice_log[i].time;
  }
  return null;
}
function practicedToday(personId) {
  var today = new Date().toISOString().substring(0, 10);
  if (!state) return false;
  for (var i = 0; i < state.practice_log.length; i++) {
    if (state.practice_log[i].person === personId &&
        (state.practice_log[i].time || '').substring(0, 10) === today) return true;
  }
  return false;
}

// ── Entropy/sync update (runs once per day) ──
function updateEntropySync() {
  if (!state) return;
  var now = new Date();
  var lastUpdate = state.master.entropy_updated ? new Date(state.master.entropy_updated) : null;
  // Check if already updated today
  if (lastUpdate &&
      lastUpdate.getFullYear() === now.getFullYear() &&
      lastUpdate.getMonth() === now.getMonth() &&
      lastUpdate.getDate() === now.getDate()) {
    return;  // already updated today
  }
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var practicedPersons = {};
  var rainPracticedRegulating = false;
  var rainPracticedRecently = false;
  for (var i = 0; i < state.practice_log.length; i++) {
    var e = state.practice_log[i];
    var eTime = new Date(e.time).getTime();
    if (eTime >= todayStart) {
      practicedPersons[e.person] = true;
      if (e.person === 'rain' && (e.skill === 'meditation' || e.skill === 'ferment' || e.skill === 'massage')) {
        rainPracticedRegulating = true;
      }
    }
    if (e.person === 'rain' && eTime >= (Date.now() - 3 * 86400000)) {
      rainPracticedRecently = true;
    }
  }
  var count = Object.keys(practicedPersons).length;
  state.master.team_sync = Math.floor((count * 100) / 4);
  if (count === 0) {
    state.master.entropy = Math.min(100, (state.master.entropy || 0) + 5);
  } else if (!rainPracticedRecently) {
    state.master.entropy = Math.min(100, (state.master.entropy || 0) + 10);
  }
  if (rainPracticedRegulating) {
    state.master.entropy = Math.max(0, (state.master.entropy || 0) - 5);
  }
  state.master.entropy_updated = now.toISOString().substring(0, 19);
}
function xpMultiplier() {
  var ent = state.master.entropy || 0;
  var sync = state.master.team_sync || 0;
  return (1.0 - ent / 200.0) * (1.0 + sync / 200.0);
}

// ── Cross-bonus application ──
function applyCrossBonuses(personId, skillName, oldLevel, newLevel) {
  if (oldLevel >= 10 || newLevel < 10) return;
  for (var i = 0; i < CROSS_BONUS_RULES.length; i++) {
    var r = CROSS_BONUS_RULES[i];
    if (r.from_p === personId && r.from_s === skillName) {
      var target = findPerson(r.to_p);
      if (target) {
        var targetSkill = findSkill(target, r.to_s);
        if (targetSkill) {
          targetSkill.bonus = (targetSkill.bonus || 1.0) + 0.05;
          if (!state.cross_bonuses) state.cross_bonuses = [];
          var bonusStr = r.from_p + '/' + r.from_s + '->' + r.to_p + '/' + r.to_s;
          if (state.cross_bonuses.indexOf(bonusStr) < 0) {
            state.cross_bonuses.push(bonusStr);
          }
        }
      }
    }
  }
}

// ── Achievement check ──
function checkAchievements() {
  if (!state.master.achievements) state.master.achievements = [];
  var unlocked = {};
  for (var i = 0; i < state.master.achievements.length; i++) {
    unlocked[state.master.achievements[i].id] = true;
  }
  for (var j = 0; j < ACHIEVEMENTS.length; j++) {
    var ach = ACHIEVEMENTS[j];
    if (unlocked[ach.id]) continue;
    if (ach.check(state)) {
      state.master.achievements.push({
        id: ach.id, name: ach.name, description: '', icon: ach.icon,
        unlocked: true, unlocked_at: new Date().toISOString().substring(0, 19)
      });
    }
  }
}

// ── Practice logging (stopTimer) ──
function logPractice(personId, skillName, minutes, effect, notes) {
  var person = findPerson(personId);
  if (!person) return;
  var skill = findSkill(person, skillName);
  if (!skill) return;
  var oldLevel = skillLevel(skill.xp || 0);
  var baseXp = minutesToXp(minutes);
  var bonusXp = Math.floor(baseXp * ((skill.bonus || 1.0) - 1.0));
  var totalXp = baseXp + bonusXp;
  totalXp = Math.floor(totalXp * xpMultiplier());
  if (state.master.xp_boost) {
    totalXp = Math.floor(totalXp * 1.5);
    state.master.xp_boost = false;
  }
  skill.xp = (skill.xp || 0) + totalXp;
  skill.last = new Date().toISOString().substring(0, 19);
  var newLevel = skillLevel(skill.xp);
  applyCrossBonuses(personId, skillName, oldLevel, newLevel);
  state.practice_log.push({
    person: personId, skill: skillName, minutes: minutes,
    time: new Date().toISOString().substring(0, 19),
    effect: effect || 'neutral', notes: notes || ''
  });
  if (state.practice_log.length > 500) state.practice_log = state.practice_log.slice(-500);
  updateEntropySync();
  checkAchievements();
  updateChallenges(personId, skillName);
}

// ── Challenge progress ──
function updateChallenges(personId, skillName) {
  for (var i = 0; i < state.master.challenges.length; i++) {
    var ch = state.master.challenges[i];
    if (ch.completed) continue;
    if (ch.person && ch.person !== personId) continue;
    if (ch.skill && ch.skill !== skillName) continue;
    ch.current_count = (ch.current_count || 0) + 1;
    if (ch.current_count >= ch.target_count) {
      ch.completed = true;
      var reward = ch.coin_reward || 0;
      if (state.master.coins_double) {
        reward *= 2;
        state.master.coins_double = false;
      }
      state.master.coins = (state.master.coins || 0) + reward;
      showCoinToast(reward);
    }
  }
  checkAchievements();
}

// ── Helpers ──
function findPerson(id) {
  for (var i = 0; i < state.persons.length; i++) {
    if (state.persons[i].id === id) return state.persons[i];
  }
  return null;
}
function findSkill(person, name) {
  for (var i = 0; i < person.skills.length; i++) {
    if (person.skills[i].name === name) return person.skills[i];
  }
  return null;
}

// ═══════════════════════════════════════════════
// DEFAULT STATE (matches default_state() in engine.cpp)
// ═══════════════════════════════════════════════

function makeDefaultState() {
  var persons = [];
  for (var id in CHAR_DEFS) {
    var def = CHAR_DEFS[id];
    var skills = def.skills.map(function(s) {
      return {name: s.name, xp: 0, is_main: s.is_main, bonus: 1.0, last: null, archived: false};
    });
    persons.push({id: id, name: def.name, role: def.role, skills: skills, archived_skills: []});
  }
  return {
    persons: persons,
    cross_bonuses: [],
    master: {
      tasks: [],
      birthdays: [],
      next_task_id: 1,
      coins: 0,
      daily_reset: null,
      entropy: 0,
      team_sync: 0,
      entropy_updated: null,
      xp_boost: false,
      coins_double: false,
      onboarding_seen: false,
      theme: 0,
      daily_todos: [],
      calendar: [],
      challenges: [],
      achievements: [],
      skill_todos: [],
      mood_log: [],
      diary_log: [],
      locked_until: null,
      shop_enabled: true,
      finance: {
        monthly_income: 0,
        currency: 'EUR',
        expenses: [],
        savings_goals: [],
      },
    },
    practice_log: [],
  };
}

// ═══════════════════════════════════════════════
// STATE PERSISTENCE (reads/writes state.json via bridge)
// ═══════════════════════════════════════════════

async function bridgeRead(filename) {
  try {
    var res = await fetch(BRIDGE_URL + '/read/' + encodeURIComponent(filename));
    if (!res.ok) return null;
    return await res.text();
  } catch(e) { return null; }
}
async function bridgeWrite(filename, content) {
  try {
    var res = await fetch(BRIDGE_URL + '/write/' + encodeURIComponent(filename), {
      method: 'POST', body: content
    });
    return res.ok;
  } catch(e) { return false; }
}
async function bridgeAppend(filename, line) {
  try {
    var res = await fetch(BRIDGE_URL + '/append/' + encodeURIComponent(filename), {
      method: 'POST', body: line + '\n'
    });
    return res.ok;
  } catch(e) { return false; }
}

async function loadState() {
  var raw = await bridgeRead('state.json');
  if (raw && raw.trim()) {
    try {
      state = JSON.parse(raw);
      state = mergeDefaults(state, makeDefaultState());
    } catch(e) {
      console.error('State parse error:', e);
      // Try .bak
      var bak = await bridgeRead('state.json.bak');
      if (bak && bak.trim()) {
        try { state = JSON.parse(bak); state = mergeDefaults(state, makeDefaultState()); }
        catch(e2) { state = makeDefaultState(); }
      } else {
        state = makeDefaultState();
      }
    }
  } else {
    state = makeDefaultState();
    await saveState();
  }
  shopEnabled = state.master.shop_enabled !== false;
  currentTheme = ['dark','light','colorful'][state.master.theme || 0] || 'dark';
  applyTheme(currentTheme);
  updateEntropySync();
  await saveState();
  // Load command results
  var resultsRaw = await bridgeRead('agora-results.json');
  if (resultsRaw && resultsRaw.trim()) {
    try { cmdResults = JSON.parse(resultsRaw); } catch(e) { cmdResults = {}; }
  }
  // Count existing commands
  var cmdsRaw = await bridgeRead('agora-commands.jsonl');
  if (cmdsRaw) {
    var lines = cmdsRaw.trim().split('\n').filter(function(l){return l.trim();});
    lastCmdLine = lines.length;
  }
  updateConnStatus('ok', 'connected');
  // Show onboarding if first run
  if (!state.master.onboarding_seen && state.practice_log.length === 0) {
    document.getElementById('onboarding-overlay').classList.remove('hidden');
  }
  renderAll();
  checkLock();
}

async function saveState() {
  if (!state) return;
  await bridgeWrite('state.json', JSON.stringify(state, null, 2));
  // Also export to agora-state.json for Teletraan
  await exportAgoraState();
}

function mergeDefaults(s, d) {
  for (var k in d) {
    if (!d.hasOwnProperty(k)) continue;
    if (s[k] === undefined) s[k] = JSON.parse(JSON.stringify(d[k]));
    else if (typeof d[k] === 'object' && !Array.isArray(d[k]) && d[k] !== null) {
      mergeDefaults(s[k], d[k]);
    }
  }
  return s;
}

// ═══════════════════════════════════════════════
// AGORA BRIDGE ADAPTER
// Exports state.json → agora-state.json (with rendered section)
// Polls agora-commands.jsonl → applies commands → writes results
// ═══════════════════════════════════════════════

async function exportAgoraState() {
  if (!state) return;
  var agoraState = JSON.parse(JSON.stringify(state));
  // Add rendered section (what teletraan expects)
  agoraState.rendered = computeRendered();
  // Also include finance in the export so AI can see it
  await bridgeWrite('agora-state.json', JSON.stringify(agoraState, null, 2));
}

function computeRendered() {
  var now = new Date();
  var today = now.toISOString().substring(0, 10);
  var dow = now.getDay();
  var todaySchedule = [];
  if (state.master.calendar) {
    for (var i = 0; i < state.master.calendar.length; i++) {
      var slot = state.master.calendar[i];
      if (slot.day === dow) {
        todaySchedule.push({
          start: pad(slot.hour) + ':' + pad(slot.minute),
          end: pad(slot.hour + 1) + ':00',
          label: slot.label || '',
          is_override: false
        });
      }
    }
  }
  todaySchedule.sort(function(a, b) { return a.start.localeCompare(b.start); });
  var todayTodos = (state.master.daily_todos || []).map(function(t) {
    return {text: t.text, done: !!t.done};
  });
  var week = [];
  for (var d = 0; d < 7; d++) {
    var dt = new Date(now);
    dt.setDate(now.getDate() - now.getDay() + d);
    var iso = dt.toISOString().substring(0, 10);
    var dDow = dt.getDay();
    var dSched = [];
    if (state.master.calendar) {
      for (var j = 0; j < state.master.calendar.length; j++) {
        if (state.master.calendar[j].day === dDow) {
          var s = state.master.calendar[j];
          dSched.push({start: pad(s.hour) + ':' + pad(s.minute), end: pad(s.hour + 1) + ':00', label: s.label || '', is_override: false});
        }
      }
    }
    week.push({dow: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dDow], iso: iso, schedule: dSched, todos: []});
  }
  return {
    today_iso: today,
    week_label: 'Week ' + getWeekNumber(),
    today_schedule: todaySchedule,
    today_todos: todayTodos,
    week: week,
    finance: state.master.finance || {monthly_income: 0, expenses: [], savings_goals: []},
  };
}

function pad(n) { return String(n || 0).padStart(2, '0'); }
function getWeekNumber() {
  var d = new Date();
  var onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

// ── Poll agora-commands.jsonl for AI commands ──
async function pollCommands() {
  var raw = await bridgeRead('agora-commands.jsonl');
  if (!raw || !raw.trim()) return;
  var lines = raw.trim().split('\n');
  if (lines.length <= lastCmdLine) return;
  var newLines = lines.slice(lastCmdLine);
  lastCmdLine = lines.length;
  for (var i = 0; i < newLines.length; i++) {
    var line = newLines[i].trim();
    if (!line) continue;
    try {
      var cmd = JSON.parse(line);
      await applyCommand(cmd);
    } catch(e) {
      console.error('Command parse error:', e, line);
    }
  }
  await saveState();
  renderAll();
}

async function applyCommand(cmd) {
  var result = {status: 'applied', ts: new Date().toISOString().substring(0, 19)};
  try {
    switch(cmd.action) {
      case 'diary_add':
        state.master.diary_log = state.master.diary_log || [];
        state.master.diary_log.unshift({text: cmd.payload.text, time: new Date().toISOString().substring(0, 19)});
        if (state.master.diary_log.length > 100) state.master.diary_log = state.master.diary_log.slice(0, 100);
        break;
      case 'todo_add':
        state.master.daily_todos = state.master.daily_todos || [];
        state.master.daily_todos.push({text: cmd.payload.text, done: false});
        break;
      case 'schedule_add_override':
        state.master.calendar = state.master.calendar || [];
        state.master.calendar.push({
          day: new Date(cmd.payload.start_date).getDay(),
          hour: cmd.payload.start_hour || 0,
          minute: cmd.payload.start_minute || 0,
          person: 'master', skill: '',
          label: cmd.payload.label || 'Event'
        });
        break;
      case 'mood_log':
        state.master.mood_log = state.master.mood_log || [];
        state.master.mood_log.push({word: cmd.payload.word, time: new Date().toISOString().substring(0, 19)});
        if (state.master.mood_log.length > 100) state.master.mood_log = state.master.mood_log.slice(-100);
        break;
      case 'lock_app':
        var hours = cmd.payload.duration_hours || 1;
        state.master.locked_until = new Date(Date.now() + hours * 3600000).toISOString();
        showLock(hours);
        break;
      case 'challenge_add':
        state.master.challenges = state.master.challenges || [];
        state.master.challenges.push({
          id: 'chal_' + Date.now(),
          description: cmd.payload.description || '',
          person: cmd.payload.person || '',
          skill: cmd.payload.skill || '',
          target_count: cmd.payload.target_count || 1,
          target_days: cmd.payload.target_days || 7,
          coin_reward: cmd.payload.coin_reward || 10,
          current_count: 0,
          completed: false,
          started: new Date().toISOString().substring(0, 19)
        });
        break;
      case 'challenge_delete':
        var desc = (cmd.payload.description || '').toLowerCase();
        state.master.challenges = (state.master.challenges || []).filter(function(c) {
          return (c.description || '').toLowerCase().indexOf(desc) < 0;
        });
        break;
      case 'milestone_add':
        state.master.achievements = state.master.achievements || [];
        state.master.achievements.push({
          id: cmd.payload.id, name: cmd.payload.name,
          description: cmd.payload.description, icon: cmd.payload.icon,
          unlocked: false, unlocked_at: null,
          custom: true
        });
        break;
      case 'milestone_unlock':
        state.master.achievements = state.master.achievements || [];
        for (var m of state.master.achievements) {
          if (m.id === cmd.payload.id) { m.unlocked = true; m.unlocked_at = new Date().toISOString().substring(0, 19); }
        }
        break;
      case 'milestone_delete':
        state.master.achievements = (state.master.achievements || []).filter(function(m) {
          return m.id !== cmd.payload.id || !m.custom;
        });
        break;
      default:
        result.status = 'failed';
        result.error = 'Unknown action: ' + cmd.action;
    }
  } catch(e) {
    result.status = 'failed';
    result.error = e.message;
  }
  cmdResults[cmd.id] = result;
  await bridgeWrite('agora-results.json', JSON.stringify(cmdResults, null, 2));
  addCmdFeedEntry(cmd, result);
}

// ═══════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════

function startTimer(personId, skillName, plannedMin) {
  haptic(20);
  // If a timer is already running, just cancel it silently (don't show effect picker —
  // we're switching to a new practice, not ending the old one). The old practice is lost.
  // This matches the Qt app's auto-stop-previous behavior.
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerStartTime = Date.now();
  timerPlannedMin = plannedMin || 30;
  timerPersonId = personId;
  timerSkillName = skillName;
  document.getElementById('timer-chip').classList.remove('hidden');
  showTimerPage();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 500);
  updateTimerDisplay();
}

function updateTimerDisplay() {
  var elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
  var mins = Math.floor(elapsed / 60);
  var secs = elapsed % 60;
  var display = pad(mins) + ':' + pad(secs);
  var chipEl = document.getElementById('timer-chip-display');
  if (chipEl) chipEl.textContent = '⏱ ' + display;
  var timerEl = document.getElementById('timer-display');
  if (timerEl) {
    timerEl.textContent = display;
    if (timerPlannedMin > 0 && mins > timerPlannedMin) {
      timerEl.style.color = 'var(--red)';
    } else {
      timerEl.style.color = '';
    }
  }
  var skillEl = document.getElementById('timer-skill');
  if (skillEl) {
    var p = CHAR_DEFS[timerPersonId];
    skillEl.textContent = (p ? p.name : timerPersonId) + ' · ' + timerSkillName;
  }
  var plannedEl = document.getElementById('timer-planned');
  if (plannedEl) {
    plannedEl.textContent = timerPlannedMin > 0 ? 'Planned: ' + timerPlannedMin + ' min' : 'Free practice';
  }
}

function stopTimer() {
  haptic([20,40,20]);
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
  var elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
  var minutes = Math.max(1, Math.round(elapsed / 60));
  // Hide timer chip
  document.getElementById('timer-chip').classList.add('hidden');
  // Pop timer page first (so when effect overlay closes, we're back on Guild)
  if (pageStack.length > 0) popPage();
  // Show effect picker
  var p = CHAR_DEFS[timerPersonId];
  var personName = p ? p.name : timerPersonId;
  document.getElementById('effect-title').textContent = personName + ' practiced ' + timerSkillName + ' for ' + minutes + 'm. How do you feel?';
  document.getElementById('effect-notes').value = '';
  document.getElementById('effect-overlay').classList.remove('hidden');
  // Store pending practice info
  window._pendingPractice = {personId: timerPersonId, skillName: timerSkillName, minutes: minutes};
}

function cancelTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  document.getElementById('timer-chip').classList.add('hidden');
  popPage();
}

function logEffect(effect) {
  haptic(15);
  var notes = document.getElementById('effect-notes').value.trim();
  logEffectWithNotes(effect, notes);
}
function toggleEffectNotes() {
  var ta = document.getElementById('effect-notes');
  var btn = document.getElementById('effect-notes-toggle');
  if (ta.classList.contains('hidden')) {
    ta.classList.remove('hidden');
    btn.textContent = '− Hide notes';
    ta.focus();
  } else {
    ta.classList.add('hidden');
    btn.textContent = '+ Add notes (optional)';
    ta.value = '';
  }
}
function logEffectWithNotes(forceEffect, forceNotes) {
  var effect = forceEffect || 'neutral';
  var notes = forceNotes !== undefined ? forceNotes : document.getElementById('effect-notes').value.trim();
  if (window._pendingPractice) {
    var pp = window._pendingPractice;
    logPractice(pp.personId, pp.skillName, pp.minutes, effect, notes);
    window._pendingPractice = null;
    saveState();
    renderAll();
  }
  document.getElementById('effect-overlay').classList.add('hidden');
  document.getElementById('effect-notes').value = '';
  // Reset notes toggle state for next time
  var ta = document.getElementById('effect-notes');
  var btn = document.getElementById('effect-notes-toggle');
  if (ta) ta.classList.add('hidden');
  if (btn) btn.textContent = '+ Add notes (optional)';
}

// ═══════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════

function renderAll() {
  if (!state) return;
  renderGuild();
  renderToday();
  renderStats();
  renderMoney();
  renderSettings();
}

function renderGuild() {
  document.getElementById('guild-level').textContent = 'Guild Level ' + guildLevel();
  var coinsEl = document.getElementById('guild-coins');
  coinsEl.textContent = '💰 ' + (state.master.coins || 0);
  coinsEl.style.display = shopEnabled ? '' : 'none';
  // Boosts
  var boostsEl = document.getElementById('boosts-row');
  boostsEl.innerHTML = '';
  if (state.master.xp_boost) {
    boostsEl.innerHTML += '<span class="boost-badge xp">⚡ XP Boost active</span>';
  }
  if (state.master.coins_double) {
    boostsEl.innerHTML += '<span class="boost-badge coins">🪙 2× Coins active</span>';
  }
  // Neglect warning
  var neglectEl = document.getElementById('neglect-banner');
  var mostNeglected = findMostNeglected();
  if (mostNeglected) {
    neglectEl.textContent = '💔 ' + mostNeglected.name + ' needs practice! (' + mostNeglected.days + 'd idle)';
    neglectEl.classList.remove('hidden');
  } else {
    neglectEl.classList.add('hidden');
  }
  // Entropy + sync
  var ent = state.master.entropy || 0;
  var sync = state.master.team_sync || 0;
  document.getElementById('entropy-val').textContent = ent + '/100';
  document.getElementById('entropy-bar').style.width = Math.min(100, ent) + '%';
  document.getElementById('sync-val').textContent = sync + '%';
  var syncBar = document.getElementById('sync-bar');
  syncBar.style.width = Math.min(100, sync) + '%';
  syncBar.className = 'meter-fill sync' + (sync < 50 ? ' low' : sync < 75 ? ' medium' : '');
  // Quick stats
  var weekMin = 0, todayMin = 0;
  var now = new Date();
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (var i = 0; i < state.practice_log.length; i++) {
    var e = state.practice_log[i];
    var t = new Date(e.time).getTime();
    if (t >= weekStart.getTime()) weekMin += e.minutes || 0;
    if (t >= todayStart) todayMin += e.minutes || 0;
  }
  document.getElementById('quick-stats').innerHTML =
    '<span>This week: ' + (weekMin / 60).toFixed(1) + 'h</span>' +
    '<span>Today: ' + todayMin + 'm</span>' +
    '<span>Total: ' + totalXP(state) + ' XP</span>';
  // Today's practice (last 3)
  var tpEl = document.getElementById('today-practice');
  var recent = state.practice_log.slice(-3).reverse();
  if (recent.length === 0) {
    tpEl.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">No practice yet today</div>';
  } else {
    tpEl.innerHTML = recent.map(function(e) {
      var emoji = {energized:'🔋',neutral:'😐',tired:'😮‍💨',drained:'🪫'}[e.effect] || '';
      return '<div style="font-size:.72em;padding:2px 0;color:var(--txt-dim)">  ' + e.person + ' ' + e.skill + ' ' + e.minutes + 'm ' + emoji + '</div>';
    }).join('');
  }
  // Character cards
  var cardsEl = document.getElementById('char-cards');
  cardsEl.innerHTML = '';
  cardsEl.className = 'char-cards';
  for (var pi = 0; pi < state.persons.length; pi++) {
    var p = state.persons[pi];
    var def = CHAR_DEFS[p.id];
    var lvl = personLevel(p);
    var title = titleForLevel(lvl);
    var mainSkill = p.skills.find(function(s){return s.is_main && !s.archived;});
    var mood = charMood(lastPracticeForPerson(p.id));
    var glyph = charMode === 'cybertronian' ? (def.cyberGlyph || '🤖') : mood.emoji;
    var practiced = practicedToday(p.id);
    var card = document.createElement('div');
    card.className = 'char-card ' + p.id;
    card.onclick = function(pid) { return function() { showPersonPage(pid); }; }(p.id);
    card.innerHTML =
      '<span class="glyph">' + glyph + '</span>' +
      '<div class="info">' +
        '<div class="name">' + p.name + (practiced ? ' <span class="practiced">✓</span>' : '') + '</div>' +
        '<div class="role">' + p.role + '</div>' +
        '<div class="level">Lvl ' + lvl + ' · ' + title + '</div>' +
        (mainSkill ? '<div class="main-skill">▶ ' + mainSkill.name + '</div>' : '') +
      '</div>' +
      '<button class="quick-start" onclick="event.stopPropagation();startTimer(\'' + p.id + '\',\'' + (mainSkill ? mainSkill.name : '') + '\',30)">▶</button>';
    cardsEl.appendChild(card);
  }
  // Achievements row — show unlocked as full-color, locked as dimmed
  var achEl = document.getElementById('ach-row');
  var achCountEl = document.getElementById('ach-count');
  if (achEl) {
    var unlocked = {};
    var achList = state.master.achievements || [];
    for (var ui = 0; ui < achList.length; ui++) {
      // Milestones (created via tool) have .unlocked flag; auto-achievements have no flag (always-on once unlocked_at set)
      if (achList[ui].unlocked !== false) unlocked[achList[ui].id] = true;
    }
    // Also include achievements that pass their check() function — they're "live"
    var unlockedCount = 0;
    var html = '';
    for (var ai = 0; ai < ACHIEVEMENTS.length; ai++) {
      var ach = ACHIEVEMENTS[ai];
      var isUnlocked = unlocked[ach.id] || (ach.check && ach.check(state));
      if (isUnlocked) unlockedCount++;
      html += '<span class="ach-badge' + (isUnlocked ? '' : ' locked') + '" title="' + escapeHtml(ach.name) + '">' + ach.icon + '</span>';
    }
    // Append custom milestones (not in ACHIEVEMENTS list)
    for (var mi = 0; mi < achList.length; mi++) {
      var m = achList[mi];
      var isKnown = ACHIEVEMENTS.some(function(a) { return a.id === m.id; });
      if (isKnown) continue;
      if (m.unlocked) unlockedCount++;
      html += '<span class="ach-badge' + (m.unlocked ? '' : ' locked') + '" title="' + escapeHtml(m.description || m.id) + '">🏆</span>';
    }
    achEl.innerHTML = html;
    if (achCountEl) achCountEl.textContent = unlockedCount + '/' + (ACHIEVEMENTS.length + (achList.length - ACHIEVEMENTS.filter(function(a) { return achList.some(function(m) { return m.id === a.id; }); }).length));
  }
}

function findMostNeglected() {
  var worst = null;
  for (var i = 0; i < state.persons.length; i++) {
    var p = state.persons[i];
    var last = lastPracticeForPerson(p.id);
    if (!last) {
      if (!worst || worst.days < 999) worst = {name: p.name, days: 999};
    } else {
      var days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      if (days >= 2 && (!worst || days > worst.days)) worst = {name: p.name, days: days};
    }
  }
  return (worst && worst.days >= 2) ? worst : null;
}

function renderToday() {
  var now = new Date();
  var monthName = now.toLocaleDateString('en-US', {month:'long', year:'numeric'});
  document.getElementById('today-month').textContent = '📅 ' + monthName;
  // Heatmap
  var hmEl = document.getElementById('heatmap');
  hmEl.innerHTML = '';
  var year = now.getFullYear(), month = now.getMonth();
  var firstDay = new Date(year, month, 1);
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var startDow = (firstDay.getDay() + 6) % 7;  // Mon=0
  // Practice minutes per day this month
  var dayMinutes = {};
  for (var i = 0; i < state.practice_log.length; i++) {
    var e = state.practice_log[i];
    var d = (e.time || '').substring(0, 10);
    if (d.substring(0, 7) === now.toISOString().substring(0, 7)) {
      dayMinutes[d] = (dayMinutes[d] || 0) + (e.minutes || 0);
    }
  }
  // Weekday headers
  var dows = ['M','T','W','T','F','S','S'];
  for (var h = 0; h < 7; h++) {
    var hd = document.createElement('div');
    hd.className = 'hm-cell hm-empty';
    hd.style.cssText = 'font-size:.75em;color:var(--txt-dim);background:transparent';
    hd.textContent = dows[h];
    hmEl.appendChild(hd);
  }
  // Empty cells before day 1
  for (var s = 0; s < startDow; s++) {
    var e = document.createElement('div');
    e.className = 'hm-cell hm-empty';
    hmEl.appendChild(e);
  }
  // Day cells
  var todayIso = now.toISOString().substring(0, 10);
  for (var day = 1; day <= daysInMonth; day++) {
    var iso = new Date(year, month, day).toISOString().substring(0, 10);
    var mins = dayMinutes[iso] || 0;
    var level = mins >= 90 ? 3 : mins >= 30 ? 2 : mins >= 1 ? 1 : 0;
    var cell = document.createElement('div');
    cell.className = 'hm-cell level-' + level + (iso === todayIso ? ' today' : '');
    cell.textContent = day;
    cell.title = iso + ': ' + mins + ' min';
    hmEl.appendChild(cell);
  }
  // Today's schedule
  var schedEl = document.getElementById('today-schedule');
  var todayDow = now.getDay();
  var todaySlots = (state.master.calendar || []).filter(function(s) { return s.day === todayDow; });
  if (todaySlots.length === 0) {
    schedEl.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">No schedule today</div>';
  } else {
    schedEl.innerHTML = todaySlots.map(function(s) {
      return '<div class="schedule-item"><span class="schedule-time">' + pad(s.hour) + ':' + pad(s.minute) + '</span><span class="schedule-label">' + escapeHtml(s.label || '') + '</span></div>';
    }).join('');
  }
  // Daily todos
  var todoEl = document.getElementById('daily-todos');
  var todos = state.master.daily_todos || [];
  var doneCount = todos.filter(function(t) { return t.done; }).length;
  document.getElementById('task-count').textContent = doneCount + '/' + todos.length;
  if (todos.length === 0) {
    todoEl.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">No tasks today</div>';
  } else {
    todoEl.innerHTML = '';
    for (var ti = 0; ti < todos.length; ti++) {
      var t = todos[ti];
      var div = document.createElement('div');
      div.className = 'todo-item';
      div.innerHTML = '<div class="todo-check ' + (t.done ? 'done' : '') + '"></div><span class="todo-text ' + (t.done ? 'done' : '') + '">' + escapeHtml(t.text) + '</span><button class="todo-delete" onclick="event.stopPropagation()">✕</button>';
      (function(t, div) {
        div.onclick = function() {
          t.done = !t.done;
          saveState();
          renderAll();
        };
        div.querySelector('.todo-delete').onclick = function(e) {
          e.stopPropagation();
          state.master.daily_todos = state.master.daily_todos.filter(function(x) { return x !== t; });
          saveState();
          renderAll();
        };
      })(t, div);
      todoEl.appendChild(div);
    }
  }
  // Today's diary entries (shown in Diary section on Today page)
  var tdEl = document.getElementById('today-diary');
  if (tdEl) {
    var todayPrefix = now.toISOString().substring(0, 10);
    var todayDiary = (state.master.diary_log || []).filter(function(d) {
      return (d.time || '').substring(0, 10) === todayPrefix;
    });
    if (todayDiary.length === 0) {
      tdEl.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">No entries today</div>';
    } else {
      tdEl.innerHTML = todayDiary.map(function(d) {
        return '<div style="font-size:.75em;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--txt-dim);font-size:.85em">' + (d.time || '').substring(11, 16) + '</span> ' + escapeHtml(d.text || '') + '</div>';
      }).join('');
    }
  }
  // Birthdays
  var bdEl = document.getElementById('birthdays');
  var bdays = state.master.birthdays || [];
  if (bdays.length === 0) {
    bdEl.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">No birthdays</div>';
  } else {
    bdEl.innerHTML = bdays.map(function(b) {
      // [FIX] Use real Date arithmetic instead of 30-day-month approximation.
      // Old code: (bm - nowM) * 30 + (bd - nowD) — wraps badly across year boundaries.
      var parts = (b.date || '').split('-');
      var bm = parseInt(parts[0]) || 0, bd = parseInt(parts[1]) || 0;
      if (bm < 1 || bm > 12 || bd < 1 || bd > 31) return '';
      var nowYear = now.getFullYear();
      // Try this year's birthday first; if already past, use next year's
      var bdayThisYear = new Date(nowYear, bm - 1, bd);
      var diffMs = bdayThisYear.getTime() - now.getTime();
      var daysAway = Math.round(diffMs / 86400000);
      if (daysAway < -1) {
        // Birthday was earlier this year — compute next year's
        bdayThisYear = new Date(nowYear + 1, bm - 1, bd);
        daysAway = Math.round((bdayThisYear.getTime() - now.getTime()) / 86400000);
      }
      var emoji = daysAway === 0 ? '🎂' : daysAway <= 3 && daysAway >= 0 ? '🔔' : '';
      var color = daysAway === 0 ? 'var(--red)' : (daysAway >= 0 && daysAway <= 3) ? 'var(--amber)' : 'var(--txt-dim)';
      // Show upcoming (next 30 days) + today; hide far-future and far-past
      if (daysAway > 30) return '';
      return '<div style="font-size:.75em;padding:4px 0;color:' + color + '">' + emoji + ' ' + escapeHtml(b.name) + ' — ' + escapeHtml(b.date) + (daysAway === 0 ? ' TODAY!' : daysAway > 0 ? ' (in ' + daysAway + 'd)' : '') + '</div>';
    }).join('') || '<div style="color:var(--txt-dim);font-size:.85em">No upcoming birthdays</div>';
  }
  // Recommendation
  var recEl = document.getElementById('recommendation');
  var neglected = findMostNeglected();
  if (neglected) {
    recEl.textContent = '💡 Focus: ' + neglected.name + ' (' + neglected.days + 'd idle)';
  } else {
    recEl.textContent = '💡 All good. Keep the rhythm!';
  }
}

function renderStats() {
  var el = document.getElementById('stats-content');
  if (activeStatsTab === 'skills') {
    var html = '';
    for (var pi = 0; pi < state.persons.length; pi++) {
      var p = state.persons[pi];
      for (var si = 0; si < p.skills.length; si++) {
        var s = p.skills[si];
        if (s.archived) continue;
        var counts = {energized:0, neutral:0, tired:0, drained:0};
        for (var ei = 0; ei < state.practice_log.length; ei++) {
          var e = state.practice_log[ei];
          if (e.person === p.id && e.skill === s.name && counts[e.effect] !== undefined) {
            counts[e.effect]++;
          }
        }
        html += '<div class="skill-stat-row">' +
          '<span class="person">' + p.name + '</span><span class="skill">' + s.name + (s.is_main ? ' ★' : '') + '</span>' +
          '<div class="effect-counters">' +
            '<span class="effect-counter">🔋 ' + counts.energized + '</span>' +
            '<span class="effect-counter">😐 ' + counts.neutral + '</span>' +
            '<span class="effect-counter">😮‍💨 ' + counts.tired + '</span>' +
            '<span class="effect-counter">🪫 ' + counts.drained + '</span>' +
          '</div></div>';
      }
    }
    el.innerHTML = html || '<div style="color:var(--txt-dim);font-size:.85em">No skill stats yet</div>';
  } else if (activeStatsTab === 'time') {
    var buckets = [
      {name:'Morning (6-12)', start:6, end:12, counts:{energized:0,neutral:0,tired:0,drained:0}},
      {name:'Afternoon (12-18)', start:12, end:18, counts:{energized:0,neutral:0,tired:0,drained:0}},
      {name:'Evening (18-24)', start:18, end:24, counts:{energized:0,neutral:0,tired:0,drained:0}},
      {name:'Night (0-6)', start:0, end:6, counts:{energized:0,neutral:0,tired:0,drained:0}},
    ];
    for (var i = 0; i < state.practice_log.length; i++) {
      var e = state.practice_log[i];
      var h = new Date(e.time).getHours();
      for (var b = 0; b < buckets.length; b++) {
        if (h >= buckets[b].start && h < buckets[b].end) {
          if (buckets[b].counts[e.effect] !== undefined) buckets[b].counts[e.effect]++;
          break;
        }
      }
    }
    el.innerHTML = buckets.map(function(b) {
      var total = b.counts.energized + b.counts.neutral + b.counts.tired + b.counts.drained;
      return '<div class="skill-stat-row"><span class="person">' + b.name + ' (' + total + ')</span>' +
        '<div class="effect-counters">' +
          '<span class="effect-counter">🔋 ' + b.counts.energized + '</span>' +
          '<span class="effect-counter">😐 ' + b.counts.neutral + '</span>' +
          '<span class="effect-counter">😮‍💨 ' + b.counts.tired + '</span>' +
          '<span class="effect-counter">🪫 ' + b.counts.drained + '</span>' +
        '</div></div>';
    }).join('');
  } else if (activeStatsTab === 'chains') {
    var pairs = {};
    for (var ci = 1; ci < state.practice_log.length; ci++) {
      var prev = state.practice_log[ci - 1];
      var curr = state.practice_log[ci];
      var dt = new Date(curr.time).getTime() - new Date(prev.time).getTime();
      if (dt > 6 * 3600000) continue;
      var key = prev.skill + ' → ' + curr.skill;
      if (!pairs[key]) pairs[key] = {energized:0, total:0};
      pairs[key].total++;
      if (curr.effect === 'energized') pairs[key].energized++;
    }
    var pairArr = Object.keys(pairs).map(function(k) {
      var p = pairs[k];
      p.name = k;
      p.energizedPct = p.total >= 2 ? Math.round(p.energized * 100 / p.total) : 0;
      return p;
    }).filter(function(p) { return p.total >= 2; }).sort(function(a, b) { return b.energizedPct - a.energizedPct; });
    if (pairArr.length === 0) {
      el.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">Need at least 2 same-day practices to show chains</div>';
    } else {
      el.innerHTML = pairArr.map(function(p) {
        return '<div class="week-pie-row"><span style="min-width:120px">' + p.name + '</span>' +
          '<div class="week-pie-bar" style="width:' + p.energizedPct + '%;background:var(--green)"></div>' +
          '<span>' + p.energizedPct + '% (' + p.total + '×)</span></div>';
      }).join('');
    }
  } else if (activeStatsTab === 'history') {
    var hist = state.practice_log.slice(-50).reverse();
    if (hist.length === 0) {
      el.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">No practice history yet</div>';
    } else {
      el.innerHTML = hist.map(function(e) {
        var emoji = {energized:'🔋',neutral:'😐',tired:'😮‍💨',drained:'🪫'}[e.effect] || '';
        var dateStr = (e.time || '').substring(5, 16).replace('T', ' ');
        return '<div class="history-row">' +
          '<span class="history-date">' + dateStr + '</span>' +
          '<span class="history-person">' + e.person + '</span>' +
          '<span>' + e.skill + '</span>' +
          '<span class="history-minutes">' + e.minutes + 'm</span>' +
          '<span>' + emoji + (e.notes ? ' 📝' : '') + '</span>' +
        '</div>';
      }).join('');
    }
  } else if (activeStatsTab === 'week') {
    var now = new Date();
    var weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    var personMin = {};
    var totalWeek = 0;
    for (var wi = 0; wi < state.persons.length; wi++) personMin[state.persons[wi].id] = 0;
    for (var wi2 = 0; wi2 < state.practice_log.length; wi2++) {
      var e = state.practice_log[wi2];
      if (new Date(e.time) >= weekStart) {
        if (personMin[e.person] !== undefined) personMin[e.person] += e.minutes || 0;
        totalWeek += e.minutes || 0;
      }
    }
    var colors = ['var(--red)', 'var(--blue)', 'var(--green-mid)', 'var(--purple)'];
    var html = '';
    for (var wi3 = 0; wi3 < state.persons.length; wi3++) {
      var p = state.persons[wi3];
      var mins = personMin[p.id] || 0;
      var pct = totalWeek > 0 ? Math.round(mins * 100 / totalWeek) : 0;
      var h = Math.floor(mins / 60), m = mins % 60;
      html += '<div class="week-pie-row"><span style="min-width:60px">' + p.name + '</span>' +
        '<div class="week-pie-bar" style="width:' + pct + '%;background:' + colors[wi3 % 4] + '"></div>' +
        '<span>' + pct + '% (' + h + 'h ' + m + 'm)</span></div>';
    }
    html += '<div style="font-size:.85em;color:var(--blue);margin-top:8px">Total this week: ' + (totalWeek / 60).toFixed(1) + 'h</div>';
    el.innerHTML = html;
  }
}

function renderMoney() {
  var fin = state.master.finance || {monthly_income:0, expenses:[], savings_goals:[]};
  var now = new Date();
  var monthPrefix = now.toISOString().substring(0, 7);
  var monthExpenses = (fin.expenses || []).filter(function(e) { return (e.date || '').substring(0, 7) === monthPrefix; });
  var totalExp = monthExpenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
  var income = fin.monthly_income || 0;
  var balance = income - totalExp;
  var cur = fin.currency || 'EUR';
  var sym = cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur + ' ';
  document.getElementById('money-income').textContent = sym + income.toFixed(2);
  document.getElementById('money-expenses').textContent = sym + totalExp.toFixed(2);
  var balEl = document.getElementById('money-balance');
  balEl.textContent = sym + balance.toFixed(2);
  balEl.style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('monthly-summary').textContent = now.toLocaleDateString('en-US', {month:'long'});
  // Burn-down
  var burnPct = income > 0 ? Math.min(100, (totalExp / income) * 100) : 0;
  var burnEl = document.getElementById('burn-down');
  burnEl.innerHTML = '<div class="burn-fill" style="width:' + burnPct + '%"></div>' +
    '<div class="burn-label">' + burnPct.toFixed(0) + '% of monthly income spent</div>';
  // Category breakdown
  var catTotals = {};
  for (var i = 0; i < monthExpenses.length; i++) {
    var cat = monthExpenses[i].category || 'other';
    catTotals[cat] = (catTotals[cat] || 0) + (parseFloat(monthExpenses[i].amount) || 0);
  }
  var catEl = document.getElementById('category-breakdown');
  var catMax = Math.max.apply(null, Object.values(catTotals).concat([1]));
  var catHtml = '';
  for (var cat in catTotals) {
    var pct = (catTotals[cat] / catMax) * 100;
    catHtml += '<div class="category-bar"><span class="category-name">' + cat + '</span>' +
      '<div class="category-bar-fill" style="width:' + pct + '%"></div>' +
      '<span class="category-amount">' + sym + catTotals[cat].toFixed(2) + '</span></div>';
  }
  catEl.innerHTML = catHtml || '<div style="color:var(--txt-dim);font-size:.85em">No expenses this month</div>';
  // Recent expenses
  var recentExp = (fin.expenses || []).slice(-10).reverse();
  var expEl = document.getElementById('recent-expenses');
  if (recentExp.length === 0) {
    expEl.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">No expenses logged</div>';
  } else {
    expEl.innerHTML = recentExp.map(function(e) {
      return '<div class="expense-row"><span class="expense-date">' + (e.date || '').substring(5) + '</span>' +
        '<span class="expense-desc">' + escapeHtml(e.description || e.category || '') + '</span>' +
        '<span class="expense-amount">' + sym + (parseFloat(e.amount) || 0).toFixed(2) + '</span></div>';
    }).join('');
  }
  // Savings goals
  var goalsEl = document.getElementById('savings-goals');
  var goals = fin.savings_goals || [];
  if (goals.length === 0) {
    goalsEl.innerHTML = '<div style="color:var(--txt-dim);font-size:.85em">No savings goals</div>';
  } else {
    goalsEl.innerHTML = goals.map(function(g, idx) {
      var pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
      return '<div class="savings-goal"><div class="goal-name">' + escapeHtml(g.name) + '</div>' +
        '<div class="goal-progress"><div class="goal-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="goal-meta"><span>' + sym + (g.current || 0).toFixed(0) + ' / ' + sym + (g.target || 0).toFixed(0) + '</span>' +
        '<span>' + (g.deadline || '') + '</span></div></div>';
    }).join('');
  }
}

function renderSettings() {
  var el = document.getElementById('settings-content');
  if (activeSettingsTab === 'tasks') {
    var tasks = state.master.tasks || [];
    el.innerHTML = '<div style="margin-bottom:8px"><input type="text" id="new-task-input" placeholder="New task..." style="background:var(--bg);color:var(--txt);border:1px solid var(--border);border-radius:6px;padding:6px;width:70%"><button class="shop-buy" onclick="addTask()" style="margin-left:4px">Add</button></div>' +
      tasks.map(function(t) {
        return '<div class="todo-item"><div class="todo-check ' + (t.done ? 'done' : '') + '"></div><span class="todo-text ' + (t.done ? 'done' : '') + '">' + escapeHtml(t.text) + '</span><button class="todo-delete" onclick="deleteTask(' + t.id + ')">✕</button></div>';
      }).join('') || '<div style="color:var(--txt-dim);font-size:.85em">No tasks</div>';
    (function() {
      var checks = el.querySelectorAll('.todo-check');
      for (var i = 0; i < checks.length; i++) {
        (function(t, check) {
          check.parentElement.onclick = function() {
            t.done = !t.done;
            saveState();
            renderSettings();
          };
        })(tasks[i], checks[i]);
      }
    })();
  } else if (activeSettingsTab === 'challenges') {
    var chs = state.master.challenges || [];
    el.innerHTML = '<button class="btn-add" onclick="showModal(\'challenge\')">+ Add Challenge</button>' +
      chs.map(function(ch, idx) {
        return '<div class="challenge-card"><div class="challenge-desc">⚔ ' + escapeHtml(ch.description) + '</div>' +
          '<div class="challenge-meta">' +
            '<span class="challenge-progress">' + (ch.current_count || 0) + '/' + ch.target_count + '</span>' +
            '<span>' + (ch.person || 'any') + ' · ' + (ch.skill || 'any') + '</span>' +
            '<span class="challenge-reward">+' + ch.coin_reward + '💰</span>' +
          '</div></div>';
      }).join('') || '<div style="color:var(--txt-dim);font-size:.85em">No challenges</div>';
  } else if (activeSettingsTab === 'journal') {
    // Mood chips
    var moodHtml = '<div class="mood-grid">';
    for (var mi = 0; mi < MOOD_WORDS.length; mi++) {
      var m = MOOD_WORDS[mi];
      moodHtml += '<div class="mood-chip" onclick="logMood(\'' + m.word + '\')">' + m.emoji + ' ' + m.word + '</div>';
    }
    moodHtml += '</div>';
    // Mood history
    var moods = (state.master.mood_log || []).slice(-10).reverse();
    moodHtml += '<div class="section-title">Mood History</div>';
    if (moods.length === 0) moodHtml += '<div style="color:var(--txt-dim);font-size:.85em">No moods logged</div>';
    else moodHtml += moods.map(function(m) {
      var emoji = (MOOD_WORDS.find(function(mw) { return mw.word === m.word; }) || {}).emoji || '';
      return '<div style="font-size:.85em;padding:2px 0">' + (m.time || '').substring(0, 16).replace('T', ' ') + ' ' + emoji + ' ' + m.word + '</div>';
    }).join('');
    // Diary
    moodHtml += '<div class="section-title">Diary</div>';
    var diary = state.master.diary_log || [];
    if (diary.length > 0) {
      moodHtml += diary.slice(0, 5).map(function(d) {
        return '<div style="font-size:.85em;padding:4px 0;border-bottom:1px solid var(--border)"><div style="color:var(--txt-dim);font-size:.85em">' + (d.time || '').substring(0, 16).replace('T',' ') + '</div><div>' + escapeHtml(d.text || '') + '</div></div>';
      }).join('');
    }
    moodHtml += '<textarea id="diary-input" placeholder="What happened today?" style="background:var(--bg);color:var(--txt);border:1px solid var(--border);border-radius:6px;padding:8px;width:100%;min-height:60px;font-family:inherit;font-size:.8em;margin-top:4px"></textarea>' +
      '<button class="shop-buy" onclick="addDiary()">Save Entry</button>';
    el.innerHTML = moodHtml;
  } else if (activeSettingsTab === 'archive') {
    var html = '';
    for (var pi = 0; pi < state.persons.length; pi++) {
      var p = state.persons[pi];
      var archived = p.archived_skills || [];
      if (archived.length > 0) {
        html += '<div class="section-title">' + p.name + '</div>';
        html += archived.map(function(s) {
          return '<div style="font-size:.75em;padding:4px 0">' + s.name + ' (lvl ' + skillLevel(s.xp || 0) + ', ' + (s.xp || 0) + ' XP) <button class="shop-buy" onclick="restoreSkill(\'' + p.id + '\',\'' + s.name + '\')">↩ Restore</button></div>';
        }).join('');
      }
    }
    el.innerHTML = html || '<div style="color:var(--txt-dim);font-size:.85em">No archived skills</div>';
  } else if (activeSettingsTab === 'shop') {
    if (!shopEnabled) {
      el.innerHTML = '<div style="color:var(--txt-dim);font-size:.8em;text-align:center;padding:20px">Shop disabled. Enable in System tab.</div>';
      return;
    }
    var coins = state.master.coins || 0;
    el.innerHTML = '<div style="font-size:1.2em;color:var(--coins);font-weight:bold;margin-bottom:10px">💰 ' + coins + ' coins</div>' +
      SHOP_ITEMS.map(function(item) {
        return '<div class="shop-item"><div class="shop-item-name">' + item.name + '<div style="font-size:.8em;color:var(--txt-dim)">' + item.desc + '</div></div>' +
          '<span class="shop-item-cost">' + item.cost + '💰</span>' +
          '<button class="shop-buy" onclick="buyShopItem(\'' + item.id + '\')" ' + (coins < item.cost ? 'disabled' : '') + '>Buy</button></div>';
      }).join('');
  } else if (activeSettingsTab === 'birthdays') {
    var bdays = state.master.birthdays || [];
    el.innerHTML = bdays.map(function(b, idx) {
      return '<div style="font-size:.75em;padding:4px 0">🎂 ' + escapeHtml(b.name) + ' — ' + escapeHtml(b.date) + ' <button class="todo-delete" onclick="deleteBirthday(' + idx + ')">✕</button></div>';
    }).join('') + '<div style="margin-top:8px"><input type="text" id="bday-name" placeholder="Name" style="background:var(--bg);color:var(--txt);border:1px solid var(--border);border-radius:6px;padding:4px;margin-bottom:4px;width:60%"><input type="text" id="bday-date" placeholder="MM-DD" style="background:var(--bg);color:var(--txt);border:1px solid var(--border);border-radius:6px;padding:4px;width:30%"><button class="shop-buy" onclick="addBirthday()">Add</button></div>';
  } else if (activeSettingsTab === 'system') {
    el.innerHTML =
      '<div style="font-size:.75em;padding:8px 0;border-bottom:1px solid var(--border)"><strong>Theme:</strong> ' +
        '<select id="theme-select" onchange="setTheme(this.value)" style="background:var(--bg);color:var(--txt);border:1px solid var(--border);border-radius:4px;padding:4px">' +
          '<option value="dark"' + (currentTheme === 'dark' ? ' selected' : '') + '>Dark (sci-fi)</option>' +
          '<option value="light"' + (currentTheme === 'light' ? ' selected' : '') + '>Light (mobile)</option>' +
          '<option value="colorful"' + (currentTheme === 'colorful' ? ' selected' : '') + '>Colorful (game)</option>' +
        '</select></div>' +
      '<div style="font-size:.75em;padding:8px 0;border-bottom:1px solid var(--border)"><strong>Character mode:</strong> ' +
        '<select id="charmode-select" onchange="setCharMode(this.value)" style="background:var(--bg);color:var(--txt);border:1px solid var(--border);border-radius:4px;padding:4px">' +
          '<option value="pet"' + (charMode === 'pet' ? ' selected' : '') + '>Pet (Tamagotchi)</option>' +
          '<option value="cybertronian"' + (charMode === 'cybertronian' ? ' selected' : '') + '>Cybertronian (alt-modes)</option>' +
        '</select></div>' +
      '<div style="font-size:.75em;padding:8px 0;border-bottom:1px solid var(--border)"><label><input type="checkbox" id="shop-toggle" ' + (shopEnabled ? 'checked' : '') + ' onchange="toggleShop(this.checked)"> Enable coin economy (shop)</label></div>' +
      '<div style="font-size:.75em;padding:8px 0;border-bottom:1px solid var(--border)"><button class="shop-buy" onclick="saveState()">💾 Save State</button></div>' +
      '<div style="font-size:.75em;padding:8px 0;border-bottom:1px solid var(--border)"><button class="shop-buy" onclick="exportCsv()">📋 Export CSV</button></div>' +
      '<div style="font-size:.75em;padding:8px 0;border-bottom:1px solid var(--border)"><button class="shop-buy" onclick="toggleStateInspector()">🔍 State Inspector</button></div>' +
      '<div style="font-size:.75em;padding:8px 0;border-bottom:1px solid var(--border)"><button class="shop-buy" onclick="toggleCmdFeed()">📡 AI Command Feed</button></div>' +
      '<div style="font-size:.75em;padding:8px 0;border-bottom:1px solid var(--border)"><button class="shop-buy" onclick="triggerEmergency()">⚡ Emergency Flag</button></div>' +
      '<div style="font-size:.85em;color:var(--txt-dim);padding:8px 0;text-align:center">Tomogichi Web v0.1 — faithful port</div>';
  }
}

// ═══════════════════════════════════════════════
// PAGE NAVIGATION
// ═══════════════════════════════════════════════

function switchTab(pageName) {
  activePage = pageName;
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].dataset.page === pageName);
  }
  var pages = document.querySelectorAll('.page');
  for (var j = 0; j < pages.length; j++) {
    pages[j].classList.remove('active');
  }
  document.getElementById('page-' + pageName).classList.add('active');
  if (pageName === 'guild') renderGuild();
  if (pageName === 'today') renderToday();
  if (pageName === 'stats') renderStats();
  if (pageName === 'money') renderMoney();
  if (pageName === 'settings') renderSettings();
}

function showPersonPage(personId) {
  var p = findPerson(personId);
  if (!p) return;
  var def = CHAR_DEFS[personId];
  var lvl = personLevel(p);
  var title = titleForLevel(lvl);
  var mood = charMood(lastPracticeForPerson(personId));
  var glyph = charMode === 'cybertronian' ? (def.cyberGlyph || '🤖') : mood.emoji;
  document.getElementById('person-name').textContent = p.name + ' · ' + p.role;
  var detailEl = document.getElementById('person-detail');
  var html = '<div class="person-header"><span class="person-glyph">' + glyph + '</span>' +
    '<div><div style="font-size:1em;font-weight:bold">' + p.name + '</div>' +
    '<div style="font-size:.85em;color:var(--txt-dim)">' + p.role + ' · Lvl ' + lvl + ' ' + title + ' · ' + totalPersonXP(p) + ' XP</div></div></div>';
  html += '<div class="section-title">Skills</div>';
  for (var i = 0; i < p.skills.length; i++) {
    var s = p.skills[i];
    if (s.archived) continue;
    var sLvl = skillLevel(s.xp || 0);
    var pct = xpProgressPct(s.xp || 0);
    var warmth = skillWarmth(s.last);
    var lastStr = s.last ? s.last.substring(0, 10) : 'never';
    var daysAgo = s.last ? Math.floor((Date.now() - new Date(s.last).getTime()) / 86400000) : 999;
    html += '<div class="skill-row' + (s.is_main ? ' main' : '') + '">' +
      '<span class="skill-name' + (s.is_main ? ' main' : '') + '">' + s.name + '</span>' +
      '<span class="skill-level">lvl ' + sLvl + '</span>' +
      '<div class="skill-bar"><div class="skill-bar-fill ' + warmth + '" style="width:' + pct + '%"></div></div>' +
      '<span style="font-size:.85em;color:' + (daysAgo >= 6 ? 'var(--grey)' : daysAgo >= 3 ? 'var(--amber)' : 'var(--green)') + '">' + (daysAgo === 999 ? 'never' : daysAgo + 'd ago') + '</span>' +
      '<div class="skill-actions">' +
        '<button onclick="startTimer(\'' + p.id + '\',\'' + s.name + '\',30)">▶</button>' +
      '</div></div>';
  }
  html += '<button class="btn-add" onclick="showModal(\'skill\',{personId:\'' + p.id + '\'})">+ Add Skill</button>';
  detailEl.innerHTML = html;
  pushPage('person');
}

function totalPersonXP(person) {
  var total = 0;
  for (var i = 0; i < person.skills.length; i++) {
    if (!person.skills[i].archived) total += person.skills[i].xp || 0;
  }
  return total;
}

function showTimerPage() {
  pushPage('timer');
}
function pushPage(pageName) {
  pageStack.push(activePage);
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var el = document.getElementById('page-' + pageName);
  if (el) el.classList.add('active');
}
function popPage() {
  var prev = pageStack.pop() || 'guild';
  activePage = prev;
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var el = document.getElementById('page-' + prev);
  if (el) el.classList.add('active');
  // Update tab bar
  var tabs = document.querySelectorAll('.tab');
  for (var j = 0; j < tabs.length; j++) {
    tabs[j].classList.toggle('active', tabs[j].dataset.page === prev);
  }
}

function switchStatsTab(tab) {
  activeStatsTab = tab;
  var tabs = document.querySelectorAll('#stats-tabs .sub-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].textContent.toLowerCase().indexOf(tab) >= 0);
  renderStats();
}
function switchSettingsTab(tab) {
  activeSettingsTab = tab;
  var tabs = document.querySelectorAll('#settings-tabs .sub-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].textContent.toLowerCase() === tab.toLowerCase());
  }
  // Hide shop tab if disabled
  if (!shopEnabled && tab === 'shop') { switchSettingsTab('tasks'); return; }
  renderSettings();
}

// ═══════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════

function logMood(word) {
  state.master.mood_log = state.master.mood_log || [];
  state.master.mood_log.push({word: word, time: new Date().toISOString().substring(0, 19)});
  saveState();
  renderSettings();
  showToast('Mood: ' + word);
}
function addDiary() {
  var text = (document.getElementById('diary-input') || {}).value || '';
  text = text.trim();
  if (!text) return;
  state.master.diary_log = state.master.diary_log || [];
  state.master.diary_log.unshift({text: text, time: new Date().toISOString().substring(0, 19)});
  saveState();
  renderSettings();
  showToast('Diary entry saved');
}
function addDiaryFromToday() {
  var ta = document.getElementById('today-diary-input');
  var text = ta ? ta.value.trim() : '';
  if (!text) return;
  state.master.diary_log = state.master.diary_log || [];
  state.master.diary_log.unshift({text: text, time: new Date().toISOString().substring(0, 19)});
  saveState();
  ta.value = '';
  renderToday();
  showToast('Diary entry saved');
}
function addTask() {
  var text = (document.getElementById('new-task-input') || {}).value || '';
  text = text.trim();
  if (!text) return;
  state.master.tasks = state.master.tasks || [];
  state.master.tasks.push({id: state.master.next_task_id || 1, text: text, done: false, created: new Date().toISOString().substring(0, 19)});
  state.master.next_task_id = (state.master.next_task_id || 1) + 1;
  saveState();
  renderSettings();
}
function deleteTask(id) {
  state.master.tasks = (state.master.tasks || []).filter(function(t) { return t.id !== id; });
  saveState();
  renderSettings();
}
function addBirthday() {
  var name = (document.getElementById('bday-name') || {}).value || '';
  var date = (document.getElementById('bday-date') || {}).value || '';
  name = name.trim(); date = date.trim();
  if (!name || !date) return;
  state.master.birthdays = state.master.birthdays || [];
  state.master.birthdays.push({name: name, date: date});
  saveState();
  renderSettings();
}
function deleteBirthday(idx) {
  state.master.birthdays.splice(idx, 1);
  saveState();
  renderSettings();
}
function buyShopItem(itemId) {
  haptic(25);
  var item = SHOP_ITEMS.find(function(i) { return i.id === itemId; });
  if (!item) return;
  if ((state.master.coins || 0) < item.cost) { showToast('Not enough coins!'); return; }
  state.master.coins -= item.cost;
  switch(item.id) {
    case 'entropy_reset': state.master.entropy = 0; break;
    case 'xp_boost': state.master.xp_boost = true; break;
    case 'skip_day': state.master.entropy = Math.max(0, (state.master.entropy || 0) - 5); state.master.entropy_updated = new Date().toISOString().substring(0, 19); break;
    case 'custom_title':
      var pid = prompt('Person (riff/reef/pitch/rain):');
      if (!pid) { state.master.coins += item.cost; return; }
      var title = prompt('Custom title:');
      if (!title) { state.master.coins += item.cost; return; }
      var p = findPerson(pid);
      if (p) p.title = title;
      break;
    case 'coins_double': state.master.coins_double = true; break;
  }
  saveState();
  renderAll();
  showToast('Bought: ' + item.name);
}
function toggleShop(enabled) {
  shopEnabled = enabled;
  state.master.shop_enabled = enabled;
  document.getElementById('shop-tab').style.display = enabled ? '' : 'none';
  saveState();
  renderAll();
}
function restoreSkill(personId, skillName) {
  var p = findPerson(personId);
  if (!p) return;
  for (var i = 0; i < (p.archived_skills || []).length; i++) {
    if (p.archived_skills[i].name === skillName) {
      var s = p.archived_skills.splice(i, 1)[0];
      s.archived = false;
      p.skills.push(s);
      saveState();
      renderSettings();
      return;
    }
  }
}
function exportCsv() {
  var csv = 'date,time,person,skill,minutes,effect\n';
  for (var i = 0; i < state.practice_log.length; i++) {
    var e = state.practice_log[i];
    var parts = (e.time || '').split('T');
    csv += parts[0] + ',' + (parts[1] || '') + ',' + e.person + ',' + e.skill + ',' + e.minutes + ',' + e.effect + '\n';
  }
  var blob = new Blob([csv], {type: 'text/csv'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'practice_log.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
}

// ── Theme + char mode ──
function applyTheme(name) {
  currentTheme = name;
  document.body.className = 'theme-' + name + ' char-' + charMode;
  state.master.theme = {dark:0, light:1, colorful:2}[name] || 0;
}
function setTheme(name) {
  applyTheme(name);
  saveState();
}
function setCharMode(mode) {
  charMode = mode;
  document.body.className = 'theme-' + currentTheme + ' char-' + charMode;
  saveState();
  renderAll();
}

// ── Emergency ──
async function triggerEmergency() {
  var msg = prompt('Emergency message (or leave empty):');
  if (msg === null) return;
  var content = msg || 'Emergency triggered from Tomogichi Web at ' + new Date().toISOString();
  await bridgeWrite('agora-emergency.flag', content);
  showToast('Emergency flag set');
}

// ── Lock ──
function showLock(hours) {
  document.getElementById('lock-overlay').classList.remove('hidden');
  document.getElementById('lock-msg').textContent = 'App locked for ' + hours + 'h focus block.';
  checkLock();
}
function checkLock() {
  if (!state || !state.master.locked_until) {
    document.getElementById('lock-overlay').classList.add('hidden');
    return;
  }
  var until = new Date(state.master.locked_until);
  if (until <= new Date()) {
    state.master.locked_until = null;
    document.getElementById('lock-overlay').classList.add('hidden');
    saveState();
    return;
  }
  document.getElementById('lock-overlay').classList.remove('hidden');
  var remaining = until - new Date();
  var h = Math.floor(remaining / 3600000);
  var m = Math.floor((remaining % 3600000) / 60000);
  document.getElementById('lock-remaining').textContent = 'Remaining: ' + h + 'h ' + m + 'm';
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(checkLock, 1000);
}

// ── Onboarding ──
function dismissOnboarding() {
  state.master.onboarding_seen = true;
  saveState();
  document.getElementById('onboarding-overlay').classList.add('hidden');
}

// ── Toast ──
// Haptic feedback — uses Vibration API on mobile (harmless on desktop, no-op if unsupported)
function haptic(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch(e) {}
}

function showToast(msg) {
  haptic(30);
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:var(--bg-mid);color:var(--txt);padding:10px 18px;border-radius:8px;border:1px solid var(--border);font-size:.85em;z-index:50;box-shadow:0 2px 8px rgba(0,0,0,.3)';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 2500);
}
function showCoinToast(amount) {
  var el = document.getElementById('coin-toast');
  document.getElementById('coin-toast-text').textContent = '🏆 +' + amount + ' 💰';
  el.classList.remove('hidden');
  setTimeout(function() { el.classList.add('hidden'); }, 2500);
}

// ── Modals ──
function showModal(type, opts) {
  opts = opts || {};
  var overlay = document.getElementById('modal-overlay');
  var title = document.getElementById('modal-title');
  var body = document.getElementById('modal-body');
  var ok = document.getElementById('modal-ok');
  if (type === 'todo') {
    title.textContent = 'Add Daily Task';
    body.innerHTML = '<input type="text" id="modal-input" placeholder="Task text...">';
    ok.textContent = 'Add';
    ok.onclick = function() {
      var text = document.getElementById('modal-input').value.trim();
      if (!text) return;
      state.master.daily_todos.push({text: text, done: false});
      saveState(); renderAll(); closeModal();
    };
  } else if (type === 'schedule') {
    title.textContent = 'Add Schedule';
    body.innerHTML = '<select id="modal-day"><option value="0">Sun</option><option value="1">Mon</option><option value="2">Tue</option><option value="3">Wed</option><option value="4">Thu</option><option value="5">Fri</option><option value="6">Sat</option></select>' +
      '<input type="number" id="modal-hour" placeholder="Hour (0-23)" min="0" max="23">' +
      '<input type="number" id="modal-minute" placeholder="Minute (0-59)" min="0" max="59">' +
      '<input type="text" id="modal-label" placeholder="Event label...">';
    ok.textContent = 'Add';
    ok.onclick = function() {
      var day = parseInt(document.getElementById('modal-day').value);
      var hour = parseInt(document.getElementById('modal-hour').value) || 0;
      var minute = parseInt(document.getElementById('modal-minute').value) || 0;
      var label = document.getElementById('modal-label').value.trim();
      if (!label) return;
      state.master.calendar.push({day: day, hour: hour, minute: minute, person: 'master', skill: '', label: label});
      saveState(); renderAll(); closeModal();
    };
  } else if (type === 'challenge') {
    title.textContent = 'Add Challenge';
    body.innerHTML = '<input type="text" id="modal-desc" placeholder="Challenge description...">' +
      '<select id="modal-person"><option value="">any</option><option value="riff">Riff</option><option value="reef">Reef</option><option value="pitch">Pitch</option><option value="rain">Rain</option></select>' +
      '<input type="number" id="modal-target" placeholder="Target count" value="7">' +
      '<input type="number" id="modal-days" placeholder="Days" value="7">' +
      '<input type="number" id="modal-reward" placeholder="Coin reward" value="50">';
    ok.textContent = 'Add';
    ok.onclick = function() {
      var desc = document.getElementById('modal-desc').value.trim();
      if (!desc) return;
      state.master.challenges.push({
        id: 'chal_' + Date.now(), description: desc,
        person: document.getElementById('modal-person').value,
        skill: '', target_count: parseInt(document.getElementById('modal-target').value) || 1,
        target_days: parseInt(document.getElementById('modal-days').value) || 7,
        coin_reward: parseInt(document.getElementById('modal-reward').value) || 10,
        current_count: 0, completed: false,
        started: new Date().toISOString().substring(0, 19)
      });
      saveState(); renderSettings(); closeModal();
    };
  } else if (type === 'skill') {
    title.textContent = 'Add Skill to ' + (findPerson(opts.personId) || {}).name;
    body.innerHTML = '<input type="text" id="modal-input" placeholder="Skill name...">' +
      '<label><input type="checkbox" id="modal-main"> Main skill (★)</label>';
    ok.textContent = 'Add';
    ok.onclick = function() {
      var name = document.getElementById('modal-input').value.trim();
      if (!name) return;
      var p = findPerson(opts.personId);
      if (!p) return;
      var isMain = document.getElementById('modal-main').checked;
      if (isMain) {
        for (var i = 0; i < p.skills.length; i++) p.skills[i].is_main = false;
      }
      p.skills.push({name: name, xp: 0, is_main: isMain, bonus: 1.0, last: null, archived: false});
      saveState(); showPersonPage(opts.personId); closeModal();
    };
  } else if (type === 'expense') {
    title.textContent = 'Add Expense';
    var fin = state.master.finance || {};
    body.innerHTML = '<input type="date" id="modal-date">' +
      '<input type="number" id="modal-amount" placeholder="Amount" step="0.01">' +
      '<select id="modal-category"><option value="food">Food</option><option value="rent">Rent</option><option value="transport">Transport</option><option value="entertainment">Entertainment</option><option value="health">Health</option><option value="education">Education</option><option value="savings">Savings</option><option value="other">Other</option></select>' +
      '<input type="text" id="modal-desc" placeholder="Description (optional)">';
    document.getElementById('modal-date').value = new Date().toISOString().substring(0, 10);
    ok.textContent = 'Add';
    ok.onclick = function() {
      var date = document.getElementById('modal-date').value;
      var amount = parseFloat(document.getElementById('modal-amount').value) || 0;
      var category = document.getElementById('modal-category').value;
      var desc = document.getElementById('modal-desc').value.trim();
      if (!date || amount <= 0) return;
      if (!state.master.finance) state.master.finance = {monthly_income:0, currency:'EUR', expenses:[], savings_goals:[]};
      state.master.finance.expenses.push({date: date, amount: amount, category: category, description: desc});
      saveState(); renderMoney(); closeModal();
    };
  } else if (type === 'income') {
    title.textContent = 'Set Monthly Income';
    var fin2 = state.master.finance || {};
    body.innerHTML = '<input type="number" id="modal-amount" placeholder="Monthly income" step="0.01" value="' + (fin2.monthly_income || 0) + '">' +
      '<select id="modal-currency"><option value="EUR">EUR €</option><option value="USD">USD $</option><option value="GBP">GBP £</option></select>';
    ok.textContent = 'Save';
    ok.onclick = function() {
      var amount = parseFloat(document.getElementById('modal-amount').value) || 0;
      var currency = document.getElementById('modal-currency').value;
      if (!state.master.finance) state.master.finance = {monthly_income:0, currency:'EUR', expenses:[], savings_goals:[]};
      state.master.finance.monthly_income = amount;
      state.master.finance.currency = currency;
      saveState(); renderMoney(); closeModal();
    };
  } else if (type === 'goal') {
    title.textContent = 'Add Savings Goal';
    body.innerHTML = '<input type="text" id="modal-name" placeholder="Goal name (e.g. Emergency fund)">' +
      '<input type="number" id="modal-target" placeholder="Target amount" step="0.01">' +
      '<input type="number" id="modal-current" placeholder="Current amount" step="0.01" value="0">' +
      '<input type="date" id="modal-deadline">';
    ok.textContent = 'Add';
    ok.onclick = function() {
      var name = document.getElementById('modal-name').value.trim();
      var target = parseFloat(document.getElementById('modal-target').value) || 0;
      var current = parseFloat(document.getElementById('modal-current').value) || 0;
      var deadline = document.getElementById('modal-deadline').value;
      if (!name || target <= 0) return;
      if (!state.master.finance) state.master.finance = {monthly_income:0, currency:'EUR', expenses:[], savings_goals:[]};
      state.master.finance.savings_goals.push({name: name, target: target, current: current, deadline: deadline});
      saveState(); renderMoney(); closeModal();
    };
  }
  overlay.classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ── Testing tools ──
function toggleCmdFeed() {
  document.getElementById('cmd-feed').classList.toggle('open');
}
function toggleStateInspector() {
  var el = document.getElementById('state-overlay');
  if (el.classList.contains('hidden')) {
    document.getElementById('state-textarea').value = JSON.stringify(state, null, 2);
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}
async function saveStateFromTextarea() {
  try {
    state = JSON.parse(document.getElementById('state-textarea').value);
    await saveState();
    renderAll();
    showToast('State updated');
    toggleStateInspector();
  } catch(e) {
    alert('JSON parse error: ' + e.message);
  }
}
async function reloadState() {
  await loadState();
  document.getElementById('state-textarea').value = JSON.stringify(state, null, 2);
}
async function resetState() {
  if (!confirm('Reset state to defaults?')) return;
  state = makeDefaultState();
  await saveState();
  document.getElementById('state-textarea').value = JSON.stringify(state, null, 2);
  renderAll();
}
function addCmdFeedEntry(cmd, result) {
  var container = document.getElementById('cmd-entries');
  if (container.children.length === 1 && container.children[0].style.color === 'var(--txt-dim)') {
    container.innerHTML = '';
  }
  var entry = document.createElement('div');
  entry.className = 'cmd-entry';
  var ts = cmd.ts || new Date().toISOString().substring(0, 19);
  entry.innerHTML =
    '<div class="cmd-ts">' + ts + '</div>' +
    '<div class="cmd-action">' + cmd.action + '</div>' +
    '<div class="cmd-payload">' + JSON.stringify(cmd.payload, null, 2).substring(0, 200) + '</div>' +
    '<span class="cmd-status ' + result.status + '">' + result.status + '</span>';
  container.insertBefore(entry, container.firstChild);
  if (!document.getElementById('cmd-feed').classList.contains('open')) {
    document.getElementById('cmd-feed').classList.add('open');
  }
}

// ── Connection status ──
function updateConnStatus(status, msg) {
  var dot = document.getElementById('conn-dot');
  var text = document.getElementById('conn-text');
  var refresh = document.getElementById('conn-refresh');
  dot.className = 'dot ' + status;
  text.textContent = msg;
  // Show manual refresh button whenever we're connected (status=ok)
  if (refresh) refresh.classList.toggle('visible', status === 'ok');
}
function manualRefresh() {
  if (!state) { init(); return; }
  loadState().then(function() {
    renderAll();
    showToast('State refreshed');
  }).catch(function(e) {
    showToast('Refresh failed: ' + (e.message || e));
  });
}

// ── Utilities ──
function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

async function init() {
  // Check bridge connection
  try {
    var res = await fetch(BRIDGE_URL + '/ping');
    if (!res.ok) throw new Error('Bridge error');
    var data = await res.json();
    updateConnStatus('ok', data.dir ? data.dir.split('/').pop() : 'connected');
  } catch(e) {
    updateConnStatus('err', 'no bridge');
    document.querySelector('.app').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)">' +
      '<h2 style="margin-bottom:10px">BRIDGE NOT RUNNING</h2>' +
      '<p style="font-size:.8em;color:var(--txt-dim)">Start bridge.py first:</p>' +
      '<pre style="font-size:.85em;margin-top:10px;color:var(--blue)">python3 bridge.py ~/.local/share/tomogichi-qt/</pre>' +
      '<p style="font-size:.85em;color:var(--txt-dim);margin-top:10px">Then open http://localhost:9191/tomogichi.html</p></div>';
    return;
  }
  await loadState();
  // Start polling for AI commands every 2s
  pollTimer = setInterval(pollCommands, 2000);
  checkLock();
  // Swipe between tabs (left/right swipe on page-stack)
  initSwipeNav();
}

// Swipe navigation between tabs
function initSwipeNav() {
  var stack = document.querySelector('.page-stack');
  if (!stack) return;
  var startX = 0, startY = 0, startT = 0;
  stack.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
  }, {passive: true});
  stack.addEventListener('touchend', function(e) {
    if (!startX) return;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    var dt = Date.now() - startT;
    startX = 0;
    // Only horizontal swipes, > 60px, < 500ms, horizontal >> vertical
    if (dt > 500) return;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    var tabs = ['guild', 'today', 'stats', 'money', 'settings'];
    var idx = tabs.indexOf(activePage);
    if (idx < 0) return;
    if (dx > 0 && idx > 0) {
      // Swipe right → previous tab
      switchTab(tabs[idx - 1]);
      haptic(15);
    } else if (dx < 0 && idx < tabs.length - 1) {
      // Swipe left → next tab
      switchTab(tabs[idx + 1]);
      haptic(15);
    }
  }, {passive: true});
}

window.addEventListener('load', init);
