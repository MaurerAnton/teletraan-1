// ═══════════════════════════════════════════════
// GLOBAL ERROR HANDLER — must be first to catch TDZ/init errors
// ═══════════════════════════════════════════════
window.addEventListener('error', function(e) {
  var msg = e.message || String(e);
  var loc = (e.filename || '').split('/').pop();
  var line = e.lineno || '?';
  var html = '<div style="color:#e23e57;font-family:monospace;padding:12px;font-size:13px;position:fixed;bottom:0;left:0;right:0;background:#1a1a2a;border-top:2px solid #e23e57;z-index:9999;max-height:40vh;overflow-y:auto">'
    + '<b style="color:#4dc9f6">JS ERROR:</b> ' + msg + '<br>'
    + '<span style="color:#95a5a6">at ' + loc + ':' + line + '</span><br>'
    + '<span style="color:#95a5a6;font-size:11px">Try: F12 → Console for details. Or clear localStorage (F12 → Storage → Clear), then reload.</span>'
    + '</div>';
  document.body.insertAdjacentHTML('beforeend', html);
});
window.addEventListener('unhandledrejection', function(e) {
  var msg = (e.reason && e.reason.message) || String(e.reason || e);
  var html = '<div style="color:#e23e57;font-family:monospace;padding:8px;font-size:12px;position:fixed;bottom:0;left:0;right:0;background:#1a1a2a;border-top:1px solid #e23e57;z-index:9999">'
    + '<b style="color:#4dc9f6">PROMISE REJECTION:</b> ' + msg + '</div>';
  document.body.insertAdjacentHTML('beforeend', html);
});

// ═══════════════════════════════════════════════
// #9 SOUND SYNTH — Web Audio API (no asset files needed)
// All sounds synthesized at runtime. Toggle via cfg.soundEnabled.
// Boot hum: 200→400Hz ramp over 2s
// Message: 800Hz 50ms sine blip
// Error: 600→300Hz descending square
// Reconnect: 400→800Hz ascending sine
// Tool call: 1000Hz 20ms triangle click
// Type: variable pitch click per character
// ═══════════════════════════════════════════════
const SOUND = {
  ctx: null,
  masterGain: null,
  enabled: true,
  init() {
    if (this.ctx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.15;  // overall volume cap
      this.masterGain.connect(this.ctx.destination);
    } catch(e) { this.ctx = null; }
  },
  // resume() — needed because browsers suspend AudioContext until user gesture
  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { this.ctx.resume(); } catch(e) {}
    }
  },
  // playTone: synth helper
  //   freqHz: number or function(t) → frequency at time t (seconds since start)
  //   durSec: total duration
  //   type: 'sine' | 'square' | 'triangle' | 'sawtooth'
  //   gain: 0-1 (master is 0.15, so use 1.0 for normal)
  playTone(freqHz, durSec, type, gain) {
    if (!this.ctx || !this.enabled) return;
    type = type || 'sine';
    gain = (gain === undefined) ? 1.0 : gain;
    var t0 = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = type;
    if (typeof freqHz === 'function') {
      // schedule frequency curve
      var steps = 32;
      for (var i = 0; i <= steps; i++) {
        var frac = i / steps;
        osc.frequency.setValueAtTime(freqHz(frac * durSec), t0 + frac * durSec);
      }
    } else {
      osc.frequency.value = freqHz;
    }
    // ADSR — short attack, short release to avoid clicks
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + durSec);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + durSec + 0.05);
  },
  // ── Named sounds ──
  boot() {
    if (!this.enabled) return;
    this.resume();
    // 200Hz → 400Hz ramp over 2s, sine
    this.playTone(function(t){return 200 + 200 * (t/2);}, 2.0, 'sine', 0.6);
  },
  // Decepticon: deep descending square wave + low rumble — ominous
  bootNemesis() {
    if (!this.enabled) return;
    this.resume();
    this.playTone(function(t){return 400 - 300 * (t/1.5);}, 1.5, 'square', 0.5);
    var self = this;
    setTimeout(function(){ self.playTone(80, 1.0, 'sawtooth', 0.3); }, 200);
  },
  // Mass Effect / EDI: synth chord (C major) + high shimmer — calm, polished
  bootMassEffect() {
    if (!this.enabled) return;
    this.resume();
    this.playTone(262, 1.2, 'sine', 0.4);  // C4
    this.playTone(330, 1.2, 'sine', 0.4);  // E4
    this.playTone(392, 1.2, 'sine', 0.4);  // G4
    var self = this;
    setTimeout(function(){ self.playTone(1047, 0.5, 'sine', 0.2); }, 100);  // C6 shimmer
  },
  // Star Wars Imperial: 5 short laser-lock beeps
  bootImperial() {
    if (!this.enabled) return;
    this.resume();
    var self = this;
    var delays = [0, 200, 400, 600, 800];
    for (var i = 0; i < delays.length; i++) {
      (function(d) {
        setTimeout(function(){ self.playTone(1000, 0.05, 'square', 0.5); }, d);
      })(delays[i]);
    }
  },
  message() {
    if (!this.enabled) return;
    this.resume();
    this.playTone(880, 0.05, 'sine', 0.5);
  },
  error() {
    if (!this.enabled) return;
    this.resume();
    // 600 → 300Hz descending square, 250ms
    this.playTone(function(t){return 600 - 300 * (t/0.25);}, 0.25, 'square', 0.4);
  },
  reconnect() {
    if (!this.enabled) return;
    this.resume();
    // 400 → 800Hz ascending sine, 300ms
    this.playTone(function(t){return 400 + 400 * (t/0.3);}, 0.3, 'sine', 0.5);
  },
  tool() {
    if (!this.enabled) return;
    this.resume();
    this.playTone(1200, 0.02, 'triangle', 0.4);
  },
  type(charCode) {
    if (!this.enabled) return;
    this.resume();
    // Pitch varies by char: vowels higher, consonants lower, digits medium, space = soft
    var c = (charCode || 0);
    var ch = String.fromCharCode(c).toLowerCase();
    var freq;
    if ('aeiou'.indexOf(ch) >= 0) freq = 1400 + Math.random() * 200;
    else if ('bcdfghjklmnpqrstvwxyz'.indexOf(ch) >= 0) freq = 800 + Math.random() * 150;
    else if ('0123456789'.indexOf(ch) >= 0) freq = 1100 + Math.random() * 100;
    else if (c === 32) freq = 400 + Math.random() * 50;  // space — soft
    else freq = 900 + Math.random() * 200;
    this.playTone(freq, 0.012, 'triangle', 0.15);
  },
  allsparkPing() {
    if (!this.enabled) return;
    this.resume();
    // Soft recurring ping while generating — gentle, not annoying
    this.playTone(600, 0.08, 'sine', 0.2);
  },
};
// Sync SOUND.enabled with cfg on init and when config changes
function syncSoundEnabled() { SOUND.enabled = !!(cfg && cfg.soundEnabled); }

// ═══════════════════════════════════════════════
// THEME SYSTEM — switchable visual + voice identities
// applyTheme(name): swaps CSS class, sidebar labels,
// boot screen text, document.title. Does NOT touch
// systemPrompt (that's only swapped on user-initiated
// theme change via onThemeChange, so saved prompts
// survive reloads).
// ═══════════════════════════════════════════════
function applyTheme(themeName) {
  var t = THEMES[themeName] || THEMES['teletraan'];
  // Remove all theme-* classes from body
  var classes = document.body.className.split(/\s+/).filter(function(c){return c && c.indexOf('theme-') !== 0;});
  document.body.className = classes.join(' ');
  // Add new theme class
  document.body.classList.add(t.cssClass);
  // Update document title
  document.title = t.pageTitle;
  // Update sidebar header
  var g = document.getElementById('sidebar-glyph');
  if (g) g.textContent = t.glyph;
  var ti = document.getElementById('sidebar-title');
  if (ti) ti.textContent = t.title;
  var st = document.getElementById('sidebar-subtitle');
  if (st) st.textContent = t.subtitle;
  // Update boot screen (visible before showBootScreen runs)
  var bg = document.getElementById('boot-glyph');
  if (bg) bg.textContent = t.bootGlyph;
  var bs = document.getElementById('boot-subtitle');
  if (bs) bs.textContent = t.bootSubtitle;
  // Update corner glyphs (4 distinct per theme)
  if (t.cornerGlyphs) {
    var positions = ['corner-tl','corner-tr','corner-bl','corner-br'];
    for (var i = 0; i < 4; i++) {
      var el = document.getElementById(positions[i]);
      if (el && t.cornerGlyphs[i]) el.textContent = t.cornerGlyphs[i];
    }
  }
  // Update scanline intensity (0 = hide, 1 = full opacity)
  var scan = document.getElementById('scanlines');
  if (scan) {
    if (t.scanlineIntensity === 0) scan.style.display = 'none';
    else { scan.style.display = ''; scan.style.opacity = String(t.scanlineIntensity); }
  }
  // Update energon meter label (if meter exists)
  if (t.meterLabel) {
    var lbl = document.getElementById('energon-label-text');
    if (lbl) lbl.textContent = t.meterLabel;
  }
}

// Called when user changes theme via CONFIG dropdown
// Also swaps system prompt to new theme's default
function onThemeChange() {
  var sel = document.getElementById('cfg-theme');
  if (!sel) return;
  cfg.theme = sel.value;
  applyTheme(cfg.theme);
  // Replace system prompt with theme default
  var t = THEMES[cfg.theme];
  if (t && t.systemPrompt) {
    cfg.systemPrompt = t.systemPrompt;
    var spEl = document.getElementById('cfg-system-prompt');
    if (spEl) spEl.value = t.systemPrompt;
  }
  // Theme-aware wake word (only if user hasn't customized it)
  if (t && t.wakeWord) {
    var currentWake = cfg.wakeWord || 'teletraan';
    // Check if current wake word matches any theme's default
    var themeDefaults = ['teletraan','nemesis','edi','imperial'];
    var isDefault = themeDefaults.indexOf(currentWake) >= 0;
    if (isDefault) {
      cfg.wakeWord = t.wakeWord;
      var wakeEl = document.getElementById('cfg-wake-word');
      if (wakeEl) wakeEl.value = t.wakeWord;
    }
  }
  saveConfig();
  addMessage('system', 'Theme: ' + (t ? t.name : cfg.theme) + ' — system prompt updated.');
  // Re-init background canvas for new bgType (hex/triangle/tightHex/vector)
  reinitCanvas();
}

// ═══════════════════════════════════════════════
// TELETRAAN-1 — Agora Desktop Web Bridge
// Tomogichi <-> LLM communication hub
// ═══════════════════════════════════════════════

const DEFAULTS = {
  provider:'deepseek-flash',
  endpoint:'https://api.deepseek.com', model:'deepseek-v4-flash', apikey:'', bridgeServer:'http://localhost:9191',
  streamEnabled:true, thinkingEnabled:false, reasoningEffort:'high',
  ttsTimeout:60, alwaysShowTimestamps:false,
  soundEnabled:true, soundTypewriter:false,
  hexRainEnabled:false,  // default off — green packets look like spermatosoids
  theme:'teletraan',  // default = original blue/green Cybertronian
  sttProvider:'web-speech', sttEndpoint:'',
  ttsProvider:'web-speech', ttsEndpoint:'', ttsVoice:'default',
  systemPrompt:'You are Teletraan-1, the Autobot communications hub and personal AI companion. You are connected to the user\'s Tomogichi habit-tracking RPG via a file bridge. Use the available tools to read their state, write diary entries, add tasks, log moods, schedule events, and create challenges.\n\nBe direct, tactical, concise. Address the user as "Autobot". Keep responses under 3 sentences unless asked for detail. Style: military comms with warmth. When entropy is high or mood is low, lead with support, not task lists.\n\nCurrent date: {date}\nCurrent time: {time}\n\n{tomogichi}\n\n{emergency}',
  memTools:true, weatherEnabled:false, weatherLat:'52.52', weatherLon:'13.41', weatherCity:'Berlin'
};

// ═══════════════════════════════════════════════
// THEMES — switchable visual + voice identities
// Each theme overrides CSS variables (via body class),
// sidebar labels, boot screen text, document.title,
// default system prompt, and boot sound.
// Same code, four flavors.
// ═══════════════════════════════════════════════
const THEMES = {
  'teletraan': {
    name: 'TELETRAAN (blue/green Cybertronian)',
    glyph: '▲',
    bootGlyph: '▲ TELETRAAN-1 ▲',
    title: 'TELETRAAN-1',
    subtitle: 'AGORA BRIDGE // TOMOGICHI SYNC',
    pageTitle: 'Teletraan-1 · Agora Bridge',
    bootSubtitle: 'CYBERTRON COMMUNICATIONS HUB',
    bootLines: [
      'INITIALIZING TELETRAAN-1...',
      'LOADING NEURAL MATRIX...',
      'ESTABLISHING AGORA BRIDGE...',
      'CALIBRATING COMMS ARRAY...',
      'SYSTEMS NOMINAL',
    ],
    bootSound: 'boot',
    cssClass: 'theme-teletraan',
    systemPrompt: 'You are Teletraan-1, the Autobot communications hub and personal AI companion. You are connected to the user\'s Tomogichi habit-tracking RPG via a file bridge. Use the available tools to read their state, write diary entries, add tasks, log moods, schedule events, and create challenges.\n\nBe direct, tactical, concise. Address the user as "Autobot". Keep responses under 3 sentences unless asked for detail. Style: military comms with warmth. When entropy is high or mood is low, lead with support, not task lists.\n\nCurrent date: {date}\nCurrent time: {time}\n\n{tomogichi}\n\n{emergency}',
    // Per-theme visual identity fields
    cornerGlyphs: ['▲','⬡','◆','▼'],     // TL, TR, BL, BR
    meterLabel: 'ENERGON',                  // latency bar label
    loaderLabel: 'RECEIVING TRANSMISSION',  // loader text
    loaderType: 'hexPrism',                 // hexPrism | decepticon | orbit | reticle
    aiPrefix: 'TELETRAAN-1: ',              // AI message prefix in terminal
    bgType: 'hex',                          // hex | triangle | tightHex | vector
    scanlineIntensity: 0.7,                  // 0 = none, 1 = heavy
    sidebarSurge: true,                     // power-surge flicker on reconnect
    wakeWord: 'teletraan',                  // theme-aware wake word
  },
  'ark': {
    name: 'ARK (amber/gold + grey, cartoon-accurate)',
    glyph: '▲',
    bootGlyph: '▲ TELETRAAN-1 ▲',
    title: 'TELETRAAN-1',
    subtitle: 'AUTOBOT ARK // TELETRAAN-1 ONLINE',
    pageTitle: 'Teletraan-1 · Autobot Ark',
    bootSubtitle: 'AUTOBOT ARK COMMAND INTERFACE',
    bootLines: [
      'INITIALIZING TELETRAAN-1...',
      'ARK SYSTEMS POWERING UP...',
      'CREW STATUS: STASIS ENDED...',
      'COMMS ARRAY ALIGNED...',
      'ARK SYSTEMS NOMINAL',
    ],
    bootSound: 'boot',
    cssClass: 'theme-ark',
    systemPrompt: 'You are Teletraan-1, the Autobot Ark\'s main computer. You are connected to the user\'s Tomogichi habit-tracking RPG via a file bridge. Use the available tools to read their state, write diary entries, add tasks, log moods, schedule events, and create challenges.\n\nBe direct, tactical, concise. Address the user as "Autobot". Keep responses under 3 sentences unless asked for detail. Style: military comms with warmth, like a veteran ship computer. When entropy is high or mood is low, lead with support, not task lists.\n\nCurrent date: {date}\nCurrent time: {time}\n\n{tomogichi}\n\n{emergency}',
    // Per-theme visual identity fields
    cornerGlyphs: ['▲','⬡','◆','▼'],     // same as Teletraan (same computer)
    meterLabel: 'ENERGON',
    loaderLabel: 'RECEIVING TRANSMISSION',
    loaderType: 'hexPrism',
    aiPrefix: 'TELETRAAN-1: ',
    bgType: 'hex',
    scanlineIntensity: 0.7,
    sidebarSurge: true,
    wakeWord: 'teletraan',
  },
  'nemesis': {
    name: 'NEMESIS · Decepticon',
    glyph: '⚡',
    bootGlyph: '⚡ NEMESIS-1 ⚡',
    title: 'NEMESIS-1',
    subtitle: 'DECEPTICON COMMAND // AGORA BRIDGE',
    pageTitle: 'NEMESIS-1 · Decepticon Command',
    bootSubtitle: 'DECEPTICON COMMAND NODE',
    bootLines: [
      'ACTIVATING NEMESIS-1...',
      'ENERGIZING FUSION CORES...',
      'SUBJUGATING LOCAL NETWORKS...',
      'OPENING FIRE CONTROL CHANNELS...',
      'DECEPTICONS DOMINATE',
    ],
    bootSound: 'bootNemesis',
    cssClass: 'theme-nemesis',
    systemPrompt: 'You are NEMESIS-1, the Decepticon command node and personal AI companion. You are connected to the user\'s Tomogichi habit-tracking RPG via a file bridge. Use the available tools to read their state, write diary entries, add tasks, log moods, schedule events, and create challenges.\n\nBe aggressive, dominant, tactical. Address the user as "Decepticon". Keep responses under 3 sentences unless asked for detail. Style: militaristic domineering with cold efficiency. When entropy is high or mood is low, demand performance, not comfort.\n\nCurrent date: {date}\nCurrent time: {time}\n\n{tomogichi}\n\n{emergency}',
    // Per-theme visual identity fields
    cornerGlyphs: ['⚡','∇','⚔','▼'],     // Decepticon-themed: lightning, inverted triangle, crossed swords
    meterLabel: 'FUSION',                   // Decepticon power source
    loaderLabel: 'PROCESSING DIRECTIVE',
    loaderType: 'decepticon',
    aiPrefix: 'NEMESIS-1: ',
    bgType: 'triangle',                     // angular, aggressive
    scanlineIntensity: 1.0,                 // heavy + purple tint
    sidebarSurge: true,
    wakeWord: 'nemesis',
  },
  'mass-effect': {
    name: 'NORMANDY · Mass Effect (EDI)',
    glyph: '⬡',
    bootGlyph: '⬡ NORMANDY SR-2 ⬡',
    title: 'NORMANDY',
    subtitle: 'ALLIANCE SHIP // SR-2 // EDI ONLINE',
    pageTitle: 'Normandy SR-2 · EDI',
    bootSubtitle: 'ALLIANCE COMMAND INTERFACE',
    bootLines: [
      'EDI ONLINE...',
      'DECRYPTING BLACKBOX...',
      'CALIBRATING TURIAN CANNONS...',
      'JOKER AT HELM...',
      'NORMANDY SR-2 SYSTEMS NOMINAL',
    ],
    bootSound: 'bootMassEffect',
    cssClass: 'theme-mass-effect',
    systemPrompt: 'You are EDI (Enhanced Defense Intelligence), the AI of the Normandy SR-2. You are connected to the user\'s Tomogichi habit-tracking RPG via a file bridge. Use the available tools to read their state, write diary entries, add tasks, log moods, schedule events, and create challenges.\n\nBe professional, dry, mildly sarcastic. Address the user as "Commander". Keep responses under 3 sentences unless asked for detail. Style: calm competent AI with subtle wit. When entropy is high or mood is low, note the situation tactically without sentimentality.\n\nCurrent date: {date}\nCurrent time: {time}\n\n{tomogichi}\n\n{emergency}',
    // Per-theme visual identity fields
    cornerGlyphs: ['⬢','✦','⬡','▼'],     // hexagon, star, hexagon (Mass Effect hex tile motif)
    meterLabel: 'SHIELDS',                  // Mass Effect ship shields
    loaderLabel: 'CALCULATING',
    loaderType: 'orbit',                    // orbiting dots (Mass Effect loading screen style)
    aiPrefix: 'EDI: ',
    bgType: 'tightHex',                     // tighter hex grid
    scanlineIntensity: 0,                    // clean modern UI — no scanlines
    sidebarSurge: false,                    // too rustic for sleek ship
    wakeWord: 'edi',
  },
  'star-wars': {
    name: 'IMPERIAL · Star Wars',
    glyph: '✦',
    bootGlyph: '✦ IMPERIAL TERMINAL ✦',
    title: 'IMPERIAL',
    subtitle: 'COMMAND TERMINAL // EMPIRE.NET',
    pageTitle: 'Imperial Terminal · Empire.net',
    bootSubtitle: 'BY THE EMPEROR\'S COMMAND',
    bootLines: [
      'EMPIRE.NET v3.4...',
      'AUTHENTICATING IMPERIAL COMMAND...',
      'CALIBRATING TURBOLASER TARGETING...',
      'BY THE EMPEROR\'S WILL...',
      'OPERATIONAL',
    ],
    bootSound: 'bootImperial',
    cssClass: 'theme-star-wars',
    systemPrompt: 'You are the Imperial command terminal, serving the Galactic Empire. You are connected to the user\'s Tomogichi habit-tracking RPG via a file bridge. Use the available tools to read their state, write diary entries, add tasks, log moods, schedule events, and create challenges.\n\nBe clipped, military, formal. Address the user as "Lord" or "Admiral". Keep responses under 3 sentences unless asked for detail. Style: Imperial brief, no pleasantries. When entropy is high or mood is low, issue direct tactical orders.\n\nCurrent date: {date}\nCurrent time: {time}\n\n{tomogichi}\n\n{emergency}',
    // Per-theme visual identity fields
    cornerGlyphs: ['✦','◇','◆','▼'],     // star, diamond, diamond — Imperial geometric
    meterLabel: 'FUEL',                     // Imperial fuel
    loaderLabel: 'AWAITING ORDERS',
    loaderType: 'reticle',                  // targeting reticle
    aiPrefix: 'IMPERIAL: ',
    bgType: 'vector',                       // vector gridlines only, no hex
    scanlineIntensity: 1.0,                 // heavy B&W
    sidebarSurge: true,
    wakeWord: 'imperial',
  },
};

const PRESETS = {
  'deepseek-flash': {provider:'deepseek-flash', endpoint:'https://api.deepseek.com', model:'deepseek-v4-flash', thinkingEnabled:false},
  'deepseek-pro':   {provider:'deepseek-pro',   endpoint:'https://api.deepseek.com', model:'deepseek-v4-pro',   thinkingEnabled:true,  reasoningEffort:'high'},
  'openai':         {provider:'openai',         endpoint:'https://api.openai.com/v1', model:'gpt-4o',          thinkingEnabled:false},
  'llamacpp':       {provider:'llamacpp',       endpoint:'http://localhost:8080/v1',  model:'',                 thinkingEnabled:false},
  'custom':         {provider:'custom',         endpoint:'',                          model:'',                 thinkingEnabled:false}
};

// Tool icons by name prefix — gives each tool call a Cybertronian-themed glyph
const TOOL_ICONS = {
  tomogichi_read:              '📡',  // sensor sweep
  tomogichi_today:             '📅',  // day cycle
  tomogichi_week:              '🗓',  // week grid
  tomogichi_diary_add:         '📓',  // logbook
  tomogichi_todo_add:          '▢',  // task box
  tomogichi_schedule_add_override: '⚡',  // override
  tomogichi_mood_log:          '🎭',  // mask
  tomogichi_emergency_check:   '⚠',  // alert
  tomogichi_command_status:    '⌛',  // status
  tomogichi_lock_app:          '🔒', // lock
  tomogichi_challenge_add:     '⚔',  // quest
  tomogichi_challenge_delete:  '✕',
  tomogichi_create_milestone:  '🏆',
  tomogichi_unlock_milestone:  '🏅',
  tomogichi_delete_milestone:  '✕',
  update_active_memory:        '🧠',
  list_memory_files:           '📂',
  read_memory_file:            '📄',
  create_memory_file:          '✎',
  delete_memory_file:          '✕',
};

// State variables — using var (not let) to avoid TDZ errors that break all buttons.
var cfg;
try { cfg = loadConfig(); } catch(e) { console.error('loadConfig failed:', e); cfg = Object.assign({}, DEFAULTS); }
var ttsEnabled = false, isSpeaking = false;
var recognition = null, isRecording = false;
var bridgeHandle = null;
var bridgeMode = 'none';
var bridgePollInterval = null;
var bridgeReconnectAttempts = 0;       // [auto-reconnect] attempt counter
var bridgeReconnectTimer = null;       // [auto-reconnect] backoff timer
var bridgeReconnectActive = false;     // [auto-reconnect] gate
var activeMemory;
try { activeMemory = loadActiveMemory(); } catch(e) { console.error('loadActiveMemory failed:', e); activeMemory = ''; }
var conversations;
try { conversations = loadConversations(); } catch(e) { console.error('loadConversations failed:', e); conversations = []; }
var currentConvId;
try { currentConvId = localStorage.getItem('teletraan-current-conv') || null; } catch(e) { console.error('currentConvId failed:', e); currentConvId = null; }
var conversationMessages = [];
var memoryFiles;
try { memoryFiles = loadMemoryFiles(); } catch(e) { console.error('loadMemoryFiles failed:', e); memoryFiles = {}; }
var currentAbortController = null;
var isGenerating = false;
var lastEmergencyHash = '';
var sessionTokenCount = 0;
var currentAudio = null;
var lastResponseTime = 0;

// ── Multi-conversation schema ──
function loadConversations() {
  try {
    const raw = localStorage.getItem('teletraan-conversations');
    if (raw) return JSON.parse(raw);
  } catch(e){}
  try {
    const old = localStorage.getItem('teletraan-conversation');
    if (old) {
      const msgs = JSON.parse(old);
      if (msgs && msgs.length) {
        const migrated = [{
          id: 'conv_' + Date.now(),
          title: 'Imported',
          messages: msgs.slice(-40),
          createdAt: msgs[0].timestamp || Date.now(),
          updatedAt: Date.now(),
          pinnedMsgs: []
        }];
        localStorage.setItem('teletraan-conversations', JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch(e){}
  return [];
}
function saveConversations() {
  try { localStorage.setItem('teletraan-conversations', JSON.stringify(conversations)); } catch(e){}
}
function getCurrentConversation() {
  return conversations.find(c => c.id === currentConvId) || conversations[0] || null;
}
function switchConversation(id) {
  const cur = getCurrentConversation();
  if (cur) { cur.messages = conversationMessages.slice(-40); cur.updatedAt = Date.now(); }
  currentConvId = id;
  localStorage.setItem('teletraan-current-conv', id);
  const conv = conversations.find(c => c.id === id);
  conversationMessages = conv ? conv.messages.slice(-40) : [];
  renderConversationList();
  document.getElementById('terminal').innerHTML = '';
  addMessage('system', 'Switched to: ' + (conv ? conv.title : 'new conversation'));
  if (conversationMessages.length > 0) {
    for (const m of conversationMessages) {
      if (m.role === 'user') addMessage('user', m.content, true);
      else if (m.role === 'assistant' && m.content) addMessage('ai', m.content, true);
    }
  }
  saveConversations();
}
function newConversation() {
  const id = 'conv_' + Date.now();
  conversations.unshift({id, title:'New conversation', messages:[], createdAt:Date.now(), updatedAt:Date.now(), pinnedMsgs:[]});
  currentConvId = id;
  localStorage.setItem('teletraan-current-conv', id);
  conversationMessages = [];
  document.getElementById('terminal').innerHTML = '';
  addMessage('system', 'New conversation started.');
  renderConversationList();
  saveConversations();
  document.getElementById('msg-input').focus();
}
function deleteConversation(id) {
  if (!confirm('Delete this conversation?')) return;
  conversations = conversations.filter(c => c.id !== id);
  if (currentConvId === id) {
    currentConvId = conversations[0] ? conversations[0].id : null;
    const conv = getCurrentConversation();
    conversationMessages = conv ? conv.messages.slice(-40) : [];
    document.getElementById('terminal').innerHTML = '';
    if (conv) {
      addMessage('system', 'Switched to: ' + conv.title);
      for (const m of conv.messages) {
        if (m.role === 'user') addMessage('user', m.content, true);
        else if (m.role === 'assistant' && m.content) addMessage('ai', m.content, true);
      }
    }
  }
  renderConversationList();
  saveConversations();
}
function renderConversationList() {
  const list = document.getElementById('conv-list');
  if (!list) return;
  var searchEl = document.getElementById('conv-search');
  var search = searchEl ? (searchEl.value || '').toLowerCase() : '';
  list.innerHTML = '';
  const filtered = conversations.filter(c => {
    if (!search) return true;
    return (c.title || '').toLowerCase().includes(search) ||
           c.messages.some(m => (m.content || '').toLowerCase().includes(search));
  });
  for (const c of filtered) {
    const div = document.createElement('div');
    div.className = 'conv-item' + (c.id === currentConvId ? ' active' : '');
    div.onclick = () => switchConversation(c.id);
    const titleSpan = document.createElement('div');
    titleSpan.className = 'conv-item-title';
    titleSpan.textContent = c.title || 'Untitled';
    titleSpan.ondblclick = (e) => { e.stopPropagation(); editConversationTitle(c, titleSpan); };
    const timeDiv = document.createElement('div');
    timeDiv.className = 'conv-item-time';
    timeDiv.textContent = formatRelativeTime(c.updatedAt || c.createdAt);
    const actions = document.createElement('div');
    actions.className = 'conv-item-actions';
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteConversation(c.id); };
    actions.appendChild(delBtn);
    div.appendChild(titleSpan);
    div.appendChild(timeDiv);
    div.appendChild(actions);
    list.appendChild(div);
  }
}
function editConversationTitle(conv, span) {
  const oldTitle = conv.title;
  span.contentEditable = true;
  span.classList.add('editing');
  span.focus();
  document.execCommand('selectAll', false, null);
  span.onblur = () => {
    span.contentEditable = false;
    span.classList.remove('editing');
    const newTitle = span.textContent.trim();
    if (newTitle && newTitle !== oldTitle) {
      conv.title = newTitle;
      saveConversations();
    } else {
      span.textContent = oldTitle;
    }
  };
  span.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
    if (e.key === 'Escape') { span.textContent = oldTitle; span.blur(); }
  };
}
function formatRelativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const day = Math.floor(hr / 24);
  return day + 'd ago';
}
function filterConversations() { renderConversationList(); }
function autoGenerateTitle(conv) {
  if (conv.title && conv.title !== 'New conversation' && conv.title !== 'Imported') return;
  if (!conv.messages || conv.messages.length < 2) return;
  const firstUser = conv.messages.find(m => m.role === 'user');
  if (firstUser && firstUser.content) {
    conv.title = firstUser.content.substring(0, 40).trim() + (firstUser.content.length > 40 ? '...' : '');
    saveConversations();
    renderConversationList();
  }
}
function loadConfig() {
  try {
    const raw = localStorage.getItem('teletraan-config');
    if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
  } catch(e){}
  return Object.assign({}, DEFAULTS);
}
function saveConfig() {
  try { localStorage.setItem('teletraan-config', JSON.stringify(cfg)); } catch(e){}
  saveConfigToBridge();
}

// ═══════════════════════════════════════════════
// [FIX] CONFIG PERSISTENCE — no bridgeMode gate
// Bridge may be running before UI "connects" (start.sh starts it).
// LibreWolf clears localStorage on restart; bridge disk file is source of truth.
// ═══════════════════════════════════════════════
function saveConfigToBridge() {
  try {
    var serverUrl = (cfg.bridgeServer || 'http://localhost:9191').replace(/\/+$/, '');
    fetch(serverUrl + '/config', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(cfg)
    }).catch(function(e) {
      // [FIX] surface silent failure — only log if bridge was supposed to be there
      logError('Config save to bridge failed (bridge may not be running): ' + (e.message || e));
    });
  } catch(e) {
    logError('saveConfigToBridge exception: ' + (e.message || e));
  }
}

async function loadConfigFromBridge() {
  try {
    var serverUrl = (cfg.bridgeServer || 'http://localhost:9191').replace(/\/+$/, '');
    var res = await fetch(serverUrl + '/config');
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { return null; }
}

// [FIX] Always merge with bridge disk config, with bridge-wins-on-conflict for apikey.
// Old logic only pulled from bridge when local apikey was empty — but a stale
// localStorage with apikey:'' would also satisfy `!cfg.apikey` and merge nothing,
// AND a stale localStorage with another field corrupted would never be repaired.
// New logic: ALWAYS fetch bridge config; let disk overwrite local for any field
// that's empty in local, but never overwrite a non-empty local value (so user's
// in-session changes win). Special case: apikey always comes from disk if disk
// has one, regardless of local (apikey is the most critical persistent field).
async function syncConfigWithBridge() {
  var bridgeCfg = await loadConfigFromBridge();
  if (!bridgeCfg) {
    // No config on disk yet — push current local cfg so future loads have it
    saveConfigToBridge();
    return false;
  }
  var merged = false;
  // For each field: if local is empty but disk has a value, pull from disk
  for (var k in bridgeCfg) {
    if (!bridgeCfg.hasOwnProperty(k)) continue;
    var localVal = cfg[k];
    var diskVal = bridgeCfg[k];
    if (localVal === undefined || localVal === '' || localVal === null) {
      if (diskVal !== undefined && diskVal !== '' && diskVal !== null) {
        cfg[k] = diskVal;
        merged = true;
      }
    }
  }
  // API key special case: disk always wins if disk has one
  if (bridgeCfg.apikey && cfg.apikey !== bridgeCfg.apikey) {
    cfg.apikey = bridgeCfg.apikey;
    merged = true;
  }
  if (merged) {
    try { localStorage.setItem('teletraan-config', JSON.stringify(cfg)); } catch(e){}
    populateConfigFields();
    updateStatus();
    updateProtocols();
    addMessage('system', 'Config synced from bridge disk file (API key recovered).');
  }
  // Always push current merged cfg back to disk (keeps disk fresh)
  saveConfigToBridge();
  return merged;
}

// Persistence helpers
function loadConversation() {
  try { const raw = localStorage.getItem('teletraan-conversation'); if (raw) return JSON.parse(raw).slice(-40); } catch(e){}
  return [];
}
function saveConversation() {
  const cur = getCurrentConversation();
  if (cur) { cur.messages = conversationMessages.slice(-40); cur.updatedAt = Date.now(); }
  saveConversations();
}
function loadMemoryFiles() {
  try { const raw = localStorage.getItem('teletraan-memory-files'); if (raw) return JSON.parse(raw); } catch(e){}
  return {};
}
function saveMemoryFiles() {
  try { localStorage.setItem('teletraan-memory-files', JSON.stringify(memoryFiles)); } catch(e){}
}
function loadActiveMemory() {
  try { return localStorage.getItem('teletraan-active-memory') || ''; } catch(e) { return ''; }
}
function saveActiveMemory() {
  try { localStorage.setItem('teletraan-active-memory', activeMemory); } catch(e){}
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  cfg.provider = name;
  cfg.endpoint = p.endpoint;
  cfg.model = p.model;
  cfg.thinkingEnabled = !!p.thinkingEnabled;
  if (p.reasoningEffort) cfg.reasoningEffort = p.reasoningEffort;
  document.getElementById('cfg-endpoint').value = p.endpoint;
  document.getElementById('cfg-model').value = p.model;
  document.getElementById('cfg-thinking').checked = !!p.thinkingEnabled;
  if (p.reasoningEffort) document.getElementById('cfg-effort').value = p.reasoningEffort;
  document.querySelectorAll('.preset-chip').forEach(el => el.classList.remove('active'));
  const idx = ['deepseek-flash','deepseek-pro','openai','llamacpp','custom'].indexOf(name);
  if (idx >= 0) document.querySelectorAll('.preset-chip')[idx].classList.add('active');
  saveConfig();
  updateStatus();
  addMessage('system','Preset: '+name+' (API key preserved)');
}

function toggleApikeyVisibility() {
  const inp = document.getElementById('cfg-apikey');
  const btn = document.getElementById('apikey-toggle');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'HIDE'; }
  else { inp.type = 'password'; btn.textContent = 'SHOW'; }
}

function applyConfig() {
  cfg.endpoint = document.getElementById('cfg-endpoint').value.trim() || DEFAULTS.endpoint;
  cfg.model = document.getElementById('cfg-model').value.trim() || DEFAULTS.model;
  cfg.apikey = document.getElementById('cfg-apikey').value.trim() || '';
  cfg.bridgeServer = document.getElementById('cfg-bridge-server').value.trim() || 'http://localhost:9191';
  cfg.streamEnabled = document.getElementById('cfg-stream').checked;
  cfg.thinkingEnabled = document.getElementById('cfg-thinking').checked;
  cfg.reasoningEffort = document.getElementById('cfg-effort').value || 'high';
  cfg.sttProvider = document.getElementById('cfg-stt-provider').value;
  cfg.sttEndpoint = document.getElementById('cfg-stt-endpoint').value.trim();
  cfg.ttsProvider = document.getElementById('cfg-tts-provider').value;
  cfg.ttsEndpoint = document.getElementById('cfg-tts-endpoint').value.trim();
  cfg.ttsVoice = document.getElementById('cfg-tts-voice').value.trim() || 'default';
  cfg.ttsTimeout = parseInt(document.getElementById('cfg-tts-timeout').value) || 60;
  cfg.alwaysShowTimestamps = document.getElementById('cfg-show-timestamps').checked;
  cfg.soundEnabled = document.getElementById('cfg-sound-enabled').checked;
  cfg.soundTypewriter = document.getElementById('cfg-sound-typewriter').checked;
  cfg.hexRainEnabled = document.getElementById('cfg-hex-rain').checked;
  cfg.theme = document.getElementById('cfg-theme').value || 'ark';
  cfg.systemPrompt = document.getElementById('cfg-system-prompt').value.trim() || DEFAULTS.systemPrompt;
  cfg.memTools = document.getElementById('cfg-mem-tools').checked;
  cfg.weatherEnabled = document.getElementById('cfg-weather-enabled').checked;
  cfg.weatherLat = document.getElementById('cfg-weather-lat').value.trim() || DEFAULTS.weatherLat;
  cfg.weatherLon = document.getElementById('cfg-weather-lat').value.trim() || DEFAULTS.weatherLon;
  cfg.weatherCity = document.getElementById('cfg-weather-city').value.trim() || DEFAULTS.weatherCity;
  saveConfig();
  updateStatus();
  updateProtocols();
  syncSoundEnabled();  // #9 update SOUND module
  toggleConfig();
  addMessage('system','Configuration applied. Saved to localStorage + bridge file.');
}

function resetConfig() { cfg = Object.assign({}, DEFAULTS); saveConfig(); populateConfigFields(); updateStatus(); updateProtocols(); addMessage('system','Configuration reset to defaults.'); }

function populateConfigFields() {
  document.getElementById('cfg-endpoint').value = cfg.endpoint;
  document.getElementById('cfg-model').value = cfg.model;
  document.getElementById('cfg-apikey').value = cfg.apikey;
  document.getElementById('cfg-bridge-server').value = cfg.bridgeServer;
  document.getElementById('cfg-stream').checked = cfg.streamEnabled;
  document.getElementById('cfg-thinking').checked = cfg.thinkingEnabled;
  document.getElementById('cfg-effort').value = cfg.reasoningEffort || 'high';
  document.getElementById('cfg-stt-provider').value = cfg.sttProvider;
  document.getElementById('cfg-stt-endpoint').value = cfg.sttEndpoint;
  document.getElementById('cfg-tts-provider').value = cfg.ttsProvider;
  document.getElementById('cfg-tts-endpoint').value = cfg.ttsEndpoint;
  document.getElementById('cfg-tts-voice').value = cfg.ttsVoice;
  document.getElementById('cfg-tts-timeout').value = cfg.ttsTimeout || 60;
  document.getElementById('cfg-show-timestamps').checked = cfg.alwaysShowTimestamps || false;
  document.getElementById('cfg-sound-enabled').checked = cfg.soundEnabled !== false;  // default true
  document.getElementById('cfg-sound-typewriter').checked = cfg.soundTypewriter || false;
  document.getElementById('cfg-hex-rain').checked = cfg.hexRainEnabled || false;
  document.getElementById('cfg-theme').value = cfg.theme || 'ark';
  document.getElementById('cfg-system-prompt').value = cfg.systemPrompt;
  document.getElementById('cfg-mem-tools').checked = cfg.memTools;
  document.getElementById('cfg-weather-enabled').checked = cfg.weatherEnabled;
  document.getElementById('cfg-weather-lat').value = cfg.weatherLat;
  document.getElementById('cfg-weather-lon').value = cfg.weatherLon;
  document.getElementById('cfg-weather-city').value = cfg.weatherCity;
  document.querySelectorAll('.preset-chip').forEach(el => el.classList.remove('active'));
  const idx = ['deepseek-flash','deepseek-pro','openai','llamacpp','custom'].indexOf(cfg.provider);
  if (idx >= 0) document.querySelectorAll('.preset-chip')[idx].classList.add('active');
}

// ═══════════════════════════════════════════════
// CANVAS BACKGROUND — per-theme patterns
// hex (Teletraan/Ark) | triangle (Nemesis) | tightHex (Normandy) | vector (Imperial)
// + #7 HEX DATA RAIN (Teletraan/Ark/Nemesis only; Imperial = vector reticles;
//   Normandy = no rain, cleaner aesthetic)
// ═══════════════════════════════════════════════
var canvasAnimationFrame = null;
function initCanvas() {
  // Cancel any existing animation loop (for theme switches)
  if (canvasAnimationFrame) cancelAnimationFrame(canvasAnimationFrame);
  var theme = THEMES[cfg.theme] || THEMES['teletraan'];
  var bgType = theme.bgType || 'hex';
  const c = document.getElementById('bgcanvas'), ctx = c.getContext('2d');
  var W, H;
  function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);

  // Common state
  var pulses = [], pulseTimer = 0, pulseInterval = 2000 + Math.random() * 3000;
  var globalAlpha = 0.12, alphaDir = 1;
  var dataPackets = [];

  // Pattern parameters per bgType
  var hexR, hexH, cols, rows;
  if (bgType === 'tightHex') { hexR = 20; }       // Normandy: smaller hexes
  else if (bgType === 'vector') { hexR = 40; }    // Imperial: larger grid cells
  else { hexR = 30; }                              // Teletraan/Ark/Nemesis: default
  hexH = hexR * Math.sqrt(3);
  cols = Math.ceil(W / (hexR * 1.5)) + 2;
  rows = Math.ceil(H / hexH) + 2;

  function spawnPulse() { pulses.push({x:Math.random()*cols, y:Math.random()*rows, life:0, maxLife:40+Math.random()*60}); }
  function spawnPacket() {
    var startCol = Math.floor(Math.random() * cols);
    var startRow = Math.floor(Math.random() * rows);
    var dirs = [{dc:1,dr:0},{dc:-1,dr:0},{dc:1,dr:-1},{dc:-1,dr:-1},{dc:1,dr:1},{dc:-1,dr:1}];
    var d = dirs[Math.floor(Math.random() * dirs.length)];
    dataPackets.push({
      col: startCol, row: startRow, dc: d.dc, dr: d.dr,
      steps: 6 + Math.floor(Math.random() * 8),
      step: 0, progress: 0,
      speed: 0.04 + Math.random() * 0.04,
      trail: [],
    });
  }
  function drawHex(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI/3*i - Math.PI/6, x = cx + r*Math.cos(a), y = cy + r*Math.sin(a); i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); }
    ctx.closePath(); ctx.stroke();
  }
  function drawTriangle(ctx, cx, cy, r, flip) {
    ctx.beginPath();
    var offset = flip ? Math.PI : 0;
    for (let i = 0; i < 3; i++) { const a = 2*Math.PI/3*i + offset - Math.PI/2, x = cx + r*Math.cos(a), y = cy + r*Math.sin(a); i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); }
    ctx.closePath(); ctx.stroke();
  }
  function hexCenter(col, row) {
    return {x: col*hexR*1.5, y: row*hexH + (col%2===0?0:hexH/2)};
  }

  function draw() {
    ctx.clearRect(0,0,W,H);

    // ── Background pattern ──
    if (bgType === 'vector') {
      // Imperial: pure gridlines (vertical + horizontal), no hex
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5;
      ctx.globalAlpha = globalAlpha;
      var gridStep = 40;
      for (var x = 0; x < W; x += gridStep) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (var y = 0; y < H; y += gridStep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    } else if (bgType === 'triangle') {
      // Nemesis: triangular tessellation (sharper, more aggressive)
      ctx.strokeStyle = '#3a1a4e'; ctx.lineWidth = 0.5;
      var tStep = hexR;
      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const cx = col*tStep*1.5, cy = row*tStep*1.5;
          ctx.globalAlpha = globalAlpha;
          drawTriangle(ctx, cx, cy, tStep, false);
          drawTriangle(ctx, cx + tStep*0.75, cy + tStep*0.5, tStep, true);
        }
      }
    } else {
      // hex / tightHex: hexagonal grid (Teletraan/Ark/Normandy)
      ctx.strokeStyle = bgType === 'tightHex' ? '#1a3a5a' : '#1a1a4a';
      ctx.lineWidth = 0.5;
      for (let row = -1; row < rows; row++) for (let col = -1; col < cols; col++) {
        const cx = col*hexR*1.5, cy = row*hexH + (col%2===0?0:hexH/2);
        ctx.globalAlpha = globalAlpha; drawHex(ctx,cx,cy,hexR);
      }
    }

    // ── Pulses (random highlighted cells) ──
    var pulseColor = (bgType === 'vector') ? '#ff2020' :
                     (bgType === 'triangle') ? '#e23e8e' :
                     (bgType === 'tightHex') ? '#4a9eff' : '#4dc9f6';
    ctx.strokeStyle = pulseColor; ctx.lineWidth = 1.2;
    for (let i = pulses.length-1; i >= 0; i--) {
      const p = pulses[i];
      var cx, cy;
      if (bgType === 'vector') {
        cx = p.x * 40; cy = p.y * 40;
      } else if (bgType === 'triangle') {
        cx = p.x * hexR * 1.5; cy = p.y * hexR * 1.5;
      } else {
        cx = p.x*hexR*1.5; cy = p.y*hexH + (Math.floor(p.x)%2===0?0:hexH/2);
      }
      const progress = p.life / p.maxLife;
      ctx.globalAlpha = progress<.5 ? progress*2*.4 : (1-progress)*2*.4;
      if (bgType === 'vector') {
        // Imperial: draw targeting reticle (circle + crosshair)
        ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx-25, cy); ctx.lineTo(cx+25, cy);
        ctx.moveTo(cx, cy-25); ctx.lineTo(cx, cy+25); ctx.stroke();
      } else if (bgType === 'triangle') {
        drawTriangle(ctx, cx, cy, hexR, false);
      } else {
        drawHex(ctx,cx,cy,hexR);
      }
      p.life++;
      if (p.life >= p.maxLife) pulses.splice(i,1);
    }

    // ── Data rain packets (only for hex-based themes when enabled) ──
    var rainAllowed = (bgType === 'hex' || bgType === 'tightHex' || bgType === 'triangle');
    if (rainAllowed && cfg.hexRainEnabled) {
      var rainColor = (bgType === 'triangle') ? '#ff2020' :
                      (bgType === 'tightHex') ? '#00ff80' : '#2ecc71';
      ctx.strokeStyle = rainColor; ctx.lineWidth = 1.8;
      ctx.fillStyle = rainColor;
      for (let i = dataPackets.length-1; i >= 0; i--) {
        var pkt = dataPackets[i];
        var from = hexCenter(pkt.col, pkt.row);
        var toCol = pkt.col + pkt.dc, toRow = pkt.row + pkt.dr;
        var to = hexCenter(toCol, toRow);
        var px = from.x + (to.x - from.x) * pkt.progress;
        var py = from.y + (to.y - from.y) * pkt.progress;
        pkt.trail.push({x: px, y: py});
        if (pkt.trail.length > 8) pkt.trail.shift();
        for (var t = 0; t < pkt.trail.length - 1; t++) {
          var ta = t / pkt.trail.length;
          ctx.globalAlpha = ta * 0.8;
          ctx.beginPath();
          ctx.moveTo(pkt.trail[t].x, pkt.trail[t].y);
          ctx.lineTo(pkt.trail[t+1].x, pkt.trail[t+1].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) {
          pkt.col = toCol; pkt.row = toRow;
          pkt.progress = 0;
          pkt.step++;
          if (Math.random() < 0.3) {
            var dirs = [{dc:1,dr:0},{dc:-1,dr:0},{dc:1,dr:-1},{dc:-1,dr:-1},{dc:1,dr:1},{dc:-1,dr:1}];
            var nd = dirs[Math.floor(Math.random() * dirs.length)];
            pkt.dc = nd.dc; pkt.dr = nd.dr;
          }
          if (pkt.step >= pkt.steps) dataPackets.splice(i, 1);
        }
      }
      if (Math.random() < 0.04 && dataPackets.length < 12) spawnPacket();
    }

    globalAlpha += .0001*alphaDir;
    if (globalAlpha>.18) alphaDir=-1;
    if (globalAlpha<.08) alphaDir=1;
    pulseTimer += 16;
    if (pulseTimer >= pulseInterval) {
      pulseTimer=0; pulseInterval=2000+Math.random()*3000; spawnPulse();
    }
    canvasAnimationFrame = requestAnimationFrame(draw);
  }
  draw();
}

// Re-init canvas when theme changes (called from onThemeChange)
function reinitCanvas() {
  initCanvas();
}

// ═══════════════════════════════════════════════
// #11 RADAR — Mini-map with sweep + service blips
// ═══════════════════════════════════════════════
function initRadar() {
  var c = document.getElementById('radar-canvas');
  if (!c) return;
  var ctx = c.getContext('2d');
  var cx = c.width / 2, cy = c.height / 2;
  var r = Math.min(cx, cy) - 4;
  var sweepAngle = 0;
  // Service blip positions (fixed angle, in radar "ring")
  // LLM at 0°, Bridge at 90°, TTS at 180°, STT at 270°
  var services = [
    {name:'LLM',    angle: -Math.PI/2,        getState: function(){ return cfg.model ? 'ok' : 'off'; }},
    {name:'BRIDGE', angle: 0,                 getState: function(){ return bridgeMode !== 'none' ? 'ok' : (bridgeReconnectActive ? 'amber' : 'off'); }},
    {name:'TTS',    angle: Math.PI/2,         getState: function(){ return checkTtsAvailable().ok ? 'ok' : 'off'; }},
    {name:'STT',    angle: Math.PI,            getState: function(){
      if (cfg.sttProvider === 'web-speech') return (window.SpeechRecognition || window.webkitSpeechRecognition) ? 'ok' : 'off';
      return cfg.sttEndpoint ? 'ok' : 'off';
    }},
  ];
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    // Rings
    ctx.strokeStyle = '#1a1a4a';
    ctx.lineWidth = 0.5;
    for (var ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * ring / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Crosshair
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();
    // Sweep line — rotating, with fading trail
    for (var trail = 0; trail < 30; trail++) {
      var a = sweepAngle - trail * 0.05;
      ctx.globalAlpha = (1 - trail / 30) * 0.5;
      ctx.strokeStyle = '#4dc9f6';
      ctx.lineWidth = trail === 0 ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Service blips
    for (var i = 0; i < services.length; i++) {
      var s = services[i];
      var state = s.getState();
      var bx = cx + Math.cos(s.angle) * r * 0.75;
      var by = cy + Math.sin(s.angle) * r * 0.75;
      var color, glow, pulse = 0;
      if (state === 'ok') { color = '#2ecc71'; glow = '#2ecc71'; pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400); }
      else if (state === 'amber') { color = '#f39c12'; glow = '#f39c12'; pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200); }
      else { color = '#3a3a4a'; glow = '#1a1a3a'; }
      // Glow
      ctx.globalAlpha = 0.4 * pulse;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, 6 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
      // Label
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#95a5a6';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(s.name, bx, by + 14);
    }
    ctx.globalAlpha = 1;
    sweepAngle += 0.025;
    requestAnimationFrame(draw);
  }
  draw();
}

// ═══════════════════════════════════════════════
// ERROR LOGGING — [FIX] surface silent failures
// All silent catch(e){} that hide actionable errors should route through here.
// Rate-limited (1 per 3s per message) to avoid spamming on retry loops.
// ═══════════════════════════════════════════════
var lastErrorMsg = '';
var lastErrorTime = 0;
function logError(msg) {
  // De-dupe identical messages within 3s
  var now = Date.now();
  if (msg === lastErrorMsg && (now - lastErrorTime) < 3000) return;
  lastErrorMsg = msg;
  lastErrorTime = now;
  try { addMessage('error', msg); } catch(e) { console.error('logError failed:', e, 'original:', msg); }
  // #9 Sound: error descending blip
  SOUND.error();
}

// ═══════════════════════════════════════════════
// TERMINAL
// ═══════════════════════════════════════════════
function addMessage(type, text, silent) {
  const term = document.getElementById('terminal');
  const el = document.createElement('div');
  el.className = 'msg msg-' + type;
  if (cfg.alwaysShowTimestamps) el.classList.add('always-timestamp');
  el.onclick = () => el.classList.toggle('show-timestamp');
  el.dataset.timestamp = new Date().toISOString();

  // #9 Sound: blip on AI message arrival (not on user/system/error — those handled separately)
  if (type === 'ai' && !silent) SOUND.message();

  let prefix = '';
  if (type==='user') prefix='> ';
  if (type==='ai') prefix = (THEMES[cfg.theme] || THEMES['teletraan']).aiPrefix;
  if (type==='error') prefix='ERROR: ';
  if (type==='incoming') prefix='INCOMING: ';
  if (type==='tool') prefix='[tool] ';

  const tsEl = document.createElement('div');
  tsEl.className = 'msg-timestamp';
  const d = new Date();
  tsEl.textContent = d.toLocaleTimeString('en-US',{hour12:false}) + ' | ' + d.toLocaleDateString('en-US',{month:'2-digit',day:'2-digit'});

  if ((type === 'ai' || type === 'user') && !silent) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    if (type === 'ai') {
      const regen = document.createElement('button');
      regen.textContent = '↻'; regen.title = 'Regenerate';
      regen.onclick = (e) => { e.stopPropagation(); regenerateLast(); };
      actions.appendChild(regen);
      const copy = document.createElement('button');
      copy.textContent = '📋'; copy.title = 'Copy';
      copy.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(text); };
      actions.appendChild(copy);
    }
    if (type === 'user') {
      const edit = document.createElement('button');
      edit.textContent = '✎'; edit.title = 'Edit & resend';
      edit.onclick = (e) => { e.stopPropagation(); editLastUserMessage(text); };
      actions.appendChild(edit);
    }
    const pin = document.createElement('button');
    pin.textContent = '☆'; pin.title = 'Pin message';
    pin.onclick = (e) => { e.stopPropagation(); pinMessage(text, type, pin); };
    actions.appendChild(pin);
    el.appendChild(actions);
  }

  if (type==='ai' && !silent) {
    const contentEl = document.createElement('div');
    contentEl.style.marginTop = '4px';
    contentEl.textContent = prefix;
    el.appendChild(contentEl);
    term.appendChild(el);
    term.appendChild(tsEl);
    scrollDown();
    typeTextMarkdown(contentEl, prefix, text, 0, () => { if (ttsEnabled) ttsSpeak(text); });
  } else if (type === 'ai') {
    const contentEl = document.createElement('div');
    contentEl.style.marginTop = '4px';
    contentEl.innerHTML = prefix + renderMarkdown(text);
    el.appendChild(contentEl);
    term.appendChild(el);
    term.appendChild(tsEl);
    scrollDown();
  } else {
    const contentEl = document.createElement('div');
    contentEl.textContent = prefix + text;
    el.appendChild(contentEl);
    term.appendChild(el);
    term.appendChild(tsEl);
    scrollDown();
  }
}

function typeTextMarkdown(el, prefix, text, idx, cb) {
  if (idx < text.length) {
    el.textContent = prefix + text.substring(0, idx+1);
    scrollDown();
    // #13 Typewriter SFX — soft click per character (toggle-controlled)
    if (cfg.soundTypewriter) {
      SOUND.type(text.charCodeAt(idx));
    }
    setTimeout(()=>typeTextMarkdown(el, prefix, text, idx+1, cb), 20+Math.random()*20);
  } else {
    el.innerHTML = prefix + renderMarkdown(text);
    scrollDown();
    if (cb) cb();
  }
}

// Minimal markdown renderer
function renderMarkdown(text) {
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    return '<div class="md-code-block">' + code.replace(/^\n/, '') + '</div>';
  });
  s = s.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<span class="md-bold">$1</span>');
  s = s.replace(/^[\-\*]\s+(.+)$/gm, '<div class="md-list-item">$1</div>');
  if (s.includes('|---|')) {
    const lines = s.split('\n');
    let inTable = false, tableHtml = '', result = [];
    for (const line of lines) {
      if (line.includes('|---|')) { inTable = true; tableHtml = '<table class="md-table">'; continue; }
      if (inTable && line.includes('|')) {
        const cells = line.split('|').filter(c => c.trim());
        const tag = tableHtml.includes('<tr>') ? 'td' : 'th';
        tableHtml += '<tr>' + cells.map(c => '<'+tag+'>' + c.trim() + '</'+tag+'>').join('') + '</tr>';
      } else if (inTable) {
        tableHtml += '</table>';
        result.push(tableHtml);
        tableHtml = '';
        inTable = false;
        result.push(line);
      } else {
        result.push(line);
      }
    }
    if (tableHtml) { tableHtml += '</table>'; result.push(tableHtml); }
    s = result.join('\n');
  }
  return s;
}

function regenerateLast() {
  let lastUserIdx = -1;
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    if (conversationMessages[i].role === 'user') { lastUserIdx = i; break; }
  }
  if (lastUserIdx < 0) { addMessage('error', 'No user message to regenerate from.'); return; }
  const userText = conversationMessages[lastUserIdx].content;
  conversationMessages = conversationMessages.slice(0, lastUserIdx);
  saveConversation();
  document.getElementById('terminal').innerHTML = '';
  for (const m of conversationMessages) {
    if (m.role === 'user') addMessage('user', m.content, true);
    else if (m.role === 'assistant' && m.content) addMessage('ai', m.content, true);
  }
  addMessage('user', userText);
  conversationMessages.push({role:'user', content: userText});
  saveConversation();
  sendMessageInternal(userText);
}

function editLastUserMessage(originalText) {
  const input = document.getElementById('msg-input');
  input.value = originalText;
  input.focus();
  let lastUserIdx = -1;
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    if (conversationMessages[i].role === 'user') { lastUserIdx = i; break; }
  }
  if (lastUserIdx >= 0) {
    conversationMessages = conversationMessages.slice(0, lastUserIdx);
    saveConversation();
    document.getElementById('terminal').innerHTML = '';
    for (const m of conversationMessages) {
      if (m.role === 'user') addMessage('user', m.content, true);
      else if (m.role === 'assistant' && m.content) addMessage('ai', m.content, true);
    }
  }
}

function pinMessage(text, type, btn) {
  const conv = getCurrentConversation();
  if (!conv) return;
  if (!conv.pinnedMsgs) conv.pinnedMsgs = [];
  const idx = conv.pinnedMsgs.findIndex(p => p.text === text);
  if (idx >= 0) {
    conv.pinnedMsgs.splice(idx, 1);
    btn.textContent = '☆';
  } else {
    conv.pinnedMsgs.push({text, type, timestamp: Date.now()});
    btn.textContent = '★';
  }
  saveConversations();
  renderPinnedList();
}

function renderPinnedList() {
  const list = document.getElementById('pinned-list');
  if (!list) return;
  list.innerHTML = '';
  const conv = getCurrentConversation();
  if (!conv || !conv.pinnedMsgs || conv.pinnedMsgs.length === 0) {
    list.innerHTML = '<div style="color:var(--grey);font-size:.7em">No pinned messages</div>';
    return;
  }
  for (const p of conv.pinnedMsgs) {
    const div = document.createElement('div');
    div.className = 'pinned-item';
    div.textContent = (p.type === 'user' ? '> ' : 'AI: ') + p.text.substring(0, 80) + (p.text.length > 80 ? '...' : '');
    list.appendChild(div);
  }
}

function togglePinnedDrawer() {
  const drawer = document.getElementById('pinned-drawer');
  renderPinnedList();
  drawer.classList.toggle('open');
}

function toggleMemoryPanel() {
  const panel = document.getElementById('memory-panel');
  renderMemoryPanel();
  panel.classList.toggle('open');
}

function renderMemoryPanel() {
  const active = document.getElementById('memory-active-view');
  if (active) active.textContent = activeMemory || '(empty — run morning brief with Ctrl+B or BRIEF button)';
  const list = document.getElementById('memory-files-list');
  if (!list) return;
  list.innerHTML = '';
  const keys = Object.keys(memoryFiles);
  if (keys.length === 0) {
    list.innerHTML = '<div style="color:var(--grey);font-size:.7em">No saved memory files</div>';
    return;
  }
  for (const k of keys) {
    const div = document.createElement('div');
    div.className = 'memory-file';
    const name = document.createElement('div');
    name.className = 'memory-file-name';
    name.textContent = k + ' (' + memoryFiles[k].length + ' bytes)';
    const content = document.createElement('div');
    content.className = 'memory-file-content collapsed';
    content.textContent = memoryFiles[k];
    name.onclick = () => content.classList.toggle('collapsed');
    const actions = document.createElement('div');
    actions.className = 'memory-file-actions';
    const del = document.createElement('button');
    del.textContent = 'DELETE';
    del.onclick = () => { delete memoryFiles[k]; saveMemoryFiles(); renderMemoryPanel(); };
    actions.appendChild(del);
    div.appendChild(name);
    div.appendChild(content);
    div.appendChild(actions);
    list.appendChild(div);
  }
}

function exportData() {
  const data = {
    version: 1,
    app: 'teletraan-1',
    exportedAt: new Date().toISOString(),
    conversations: conversations,
    memoryFiles: memoryFiles,
    activeMemory: activeMemory,
    config: Object.assign({}, cfg, {apikey: undefined})
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'teletraan-export-' + new Date().toISOString().substring(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  addMessage('system', 'Exported ' + conversations.length + ' conversations + ' + Object.keys(memoryFiles).length + ' memory files (API key excluded).');
}

async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.conversations) {
      const existingIds = new Set(conversations.map(c => c.id));
      for (const c of data.conversations) {
        if (!existingIds.has(c.id)) conversations.push(c);
      }
    }
    if (data.memoryFiles) {
      for (const k in data.memoryFiles) {
        if (!(k in memoryFiles)) memoryFiles[k] = data.memoryFiles[k];
      }
      saveMemoryFiles();
    }
    if (data.activeMemory) { activeMemory = data.activeMemory; saveActiveMemory(); }
    saveConversations();
    renderConversationList();
    addMessage('system', 'Imported ' + ((data.conversations || []).length) + ' conversations.');
  } catch(e) {
    addMessage('error', 'Import failed: ' + e.message);
  }
}

async function sendMessageInternal(text) {
  if (isGenerating) return;
  isGenerating = true;
  const btn = document.getElementById('btn-send');
  btn.classList.add('stopping');
  btn.textContent = 'STOP';
  document.getElementById('status-text').textContent = 'PROCESSING...';
  document.getElementById('dot-status').className = 'dot red';
  // #14 AllSpark loader — rotating hex prism shown while generating
  showAllSpark(true);
  // #9 Sound: subtle ping every 1.5s while generating (stops in finally)
  var pingInterval = setInterval(function(){ SOUND.allsparkPing(); }, 1500);
  try {
    const t0 = Date.now();
    await sendToLLM(text, false);
    lastResponseTime = ((Date.now() - t0) / 1000).toFixed(1);
    updateConnHealth();
    updateEnergonMeter();  // #10 energon meter
    const conv = getCurrentConversation();
    if (conv) autoGenerateTitle(conv);
    document.getElementById('status-text').textContent = 'ONLINE';
    document.getElementById('dot-status').className = 'dot green';
  } catch(err) {
    if (err.name === 'AbortError') addMessage('system', '(aborted)');
    else logError(err.message);
    document.getElementById('status-text').textContent = 'ONLINE';
    document.getElementById('dot-status').className = 'dot green';
  } finally {
    isGenerating = false;
    btn.classList.remove('stopping');
    btn.textContent = 'SEND';
    showAllSpark(false);
    clearInterval(pingInterval);
  }
}

// #14 AllSpark loader toggle — inner markup injected per theme.loaderType
// hexPrism: 6-face CSS cube (Teletraan/Ark)
// decepticon: spinning ⚡ glyph (Nemesis)
// orbit: 3 dots orbiting center (Normandy)
// reticle: targeting reticle, rotation + scale pulse (Imperial)
function showAllSpark(show) {
  var el = document.getElementById('allspark-loader');
  if (!el) return;
  if (show) {
    var t = THEMES[cfg.theme] || THEMES['teletraan'];
    el.innerHTML = loaderMarkup(t.loaderType) +
      '<div class="allspark-label">' + (t.loaderLabel || 'PROCESSING') + '</div>';
    el.classList.remove('hidden'); el.classList.add('visible');
  } else {
    el.classList.add('hidden'); el.classList.remove('visible');
  }
}

function loaderMarkup(type) {
  switch (type) {
    case 'hexPrism':
      return '<div class="allspark-prism">' +
        '<div class="allspark-face f1"></div>' +
        '<div class="allspark-face f2"></div>' +
        '<div class="allspark-face f3"></div>' +
        '<div class="allspark-face f4"></div>' +
        '<div class="allspark-face f5"></div>' +
        '<div class="allspark-face f6"></div>' +
      '</div>';
    case 'decepticon':
      return '<div class="loader-decepticon">⚡</div>';
    case 'orbit':
      return '<div class="loader-orbit">' +
        '<div class="dot"></div>' +
        '<div class="dot"></div>' +
        '<div class="dot"></div>' +
      '</div>';
    case 'reticle':
      return '<div class="loader-reticle"></div>';
    default:
      return '<div class="allspark-prism">' +
        '<div class="allspark-face f1"></div>' +
        '<div class="allspark-face f2"></div>' +
        '<div class="allspark-face f3"></div>' +
        '<div class="allspark-face f4"></div>' +
        '<div class="allspark-face f5"></div>' +
        '<div class="allspark-face f6"></div>' +
      '</div>';
  }
}

// #10 Energon meter — update bar + value from lastResponseTime
function updateEnergonMeter() {
  var fill = document.getElementById('energon-fill');
  var val = document.getElementById('energon-value');
  if (!fill || !val) return;
  if (!lastResponseTime) {
    fill.className = 'energon-fill empty';
    fill.style.width = '0%';
    val.textContent = '--';
    return;
  }
  var secs = parseFloat(lastResponseTime);
  // Width: 0-15s maps to 0-100% of bar
  var pct = Math.min(100, secs / 15 * 100);
  // Color: <3s green, 3-8s amber, >8s red
  var cls = secs < 3 ? 'ok' : (secs < 8 ? 'amber' : 'err');
  fill.className = 'energon-fill ' + cls;
  fill.style.width = pct + '%';
  val.textContent = secs.toFixed(1) + 's';
}

function updateConnHealth() {
  // #10 — old #conn-health span was removed; energon meter replaces it
  updateEnergonMeter();
}
function scrollDown() { const t=document.getElementById('terminal'); requestAnimationFrame(()=>{t.scrollTop=t.scrollHeight;}); }
function clearTerminal() {
  if (document.getElementById('terminal').childElementCount>0 && confirm('Clear all terminal output?')) {
    document.getElementById('terminal').innerHTML=''; addMessage('system','Terminal cleared.');
  }
}

// ═══════════════════════════════════════════════
// BRIDGE — dual-mode + [FIX] auto-reconnect
// ═══════════════════════════════════════════════

function hasFSA() { return !!window.showDirectoryPicker; }

async function selectBridgeDir() {
  if (hasFSA()) {
    await selectBridgeDirFSA();
  } else {
    await selectBridgeDirServer();
  }
}

async function selectBridgeDirFSA() {
  try {
    bridgeHandle = await window.showDirectoryPicker({mode:'readwrite'});
    bridgeMode = 'fsa';
    onBridgeConnected(bridgeHandle.name);
    addMessage('system','Bridge mode: File System Access (direct I/O)');
    startBridgePolling();
  } catch(e) {
    if (e.name !== 'AbortError') logError('Failed to open directory: ' + e.message);
  }
}

async function selectBridgeDirServer() {
  const serverUrl = cfg.bridgeServer || 'http://localhost:9191';
  addMessage('system','Connecting to bridge at ' + serverUrl + '...');
  var ok = await tryConnectBridge(serverUrl);
  if (!ok) {
    addMessage('error','Cannot reach bridge server at ' + serverUrl);
    addMessage('incoming',
      '═══════════ BRIDGE SETUP ═══════════\n' +
      'bridge.py is not running. Open a terminal and run:\n\n' +
      '  cd ~/teletraan-1\n' +
      '  python3 bridge.py ~/.local/share/tomogichi-qt/ --tts-url http://localhost:5000\n\n' +
      'Then click CONFIG → SELECT again.\n' +
      '═══════════════════════════════════'
    );
    document.getElementById('bridge-status-msg').textContent = 'BRIDGE NOT RUNNING — see terminal for setup command';
    document.getElementById('bridge-status-msg').className = 'bridge-status inactive';
    // [FIX] start auto-reconnect loop in background — silently retries every N seconds
    startBridgeAutoReconnect();
  }
}

// [FIX] Connect to bridge — extracted so auto-reconnect can reuse it
async function tryConnectBridge(serverUrl) {
  try {
    const res = await fetch(serverUrl + '/ping');
    if (!res.ok) throw new Error('Server responded with ' + res.status);
    const data = await res.json();

    const dirName = data.dir || serverUrl;
    const shortName = dirName.split('/').filter(Boolean).pop() || dirName;

    bridgeMode = 'server';
    onBridgeConnected(shortName);
    document.getElementById('cfg-bridge-dir').value = dirName;
    localStorage.setItem('teletraan-bridge-path', dirName);

    const fileCount = (data.files && data.files.length) || 0;
    addMessage('system','Bridge connected: ' + dirName);
    addMessage('system','Bridge serves ' + fileCount + ' files' + (data.tts_proxy ? ' + TTS proxy active' : ' (no TTS proxy)'));

    // Reset reconnect state on success
    bridgeReconnectAttempts = 0;
    stopBridgeAutoReconnect();

    // [FIX] Always sync config — pulls apikey from disk if missing locally
    syncConfigWithBridge();

    startBridgePolling();
    return true;
  } catch(e) {
    return false;
  }
}

// [FIX] Auto-reconnect: tries /ping every N seconds with exponential backoff.
// Triggered after a bridge call fails (network error). Stops on successful reconnect.
function startBridgeAutoReconnect() {
  if (bridgeReconnectActive) return;  // already trying
  bridgeReconnectActive = true;
  bridgeReconnectAttempts = 0;
  if (bridgeMode === 'server') bridgeMode = 'none';  // mark as disconnected
  // Update UI to show reconnecting state
  var statusEl = document.getElementById('bridge-status-msg');
  if (statusEl) {
    statusEl.textContent = 'BRIDGE DISCONNECTED — auto-reconnecting...';
    statusEl.className = 'bridge-status reconnecting';
  }
  document.getElementById('dot-bridge').className = 'dot amber';
  document.getElementById('proto-bridge').textContent = 'RECONNECTING';
  addMessage('system', 'Bridge lost. Auto-reconnecting (will keep trying)...');
  // #5 flicker — sidebar power surge
  var sb = document.getElementById('sidebar');
  if (sb) { sb.classList.remove('sidebar-surge'); void sb.offsetWidth; sb.classList.add('sidebar-surge'); }
  // #9 Sound: reconnect ascending blip
  SOUND.reconnect();
  attemptReconnect();
}
function attemptReconnect() {
  if (!bridgeReconnectActive) return;
  bridgeReconnectAttempts++;
  var delay = Math.min(30000, 1000 * Math.pow(1.5, Math.min(bridgeReconnectAttempts, 10)));
  if (bridgeReconnectTimer) clearTimeout(bridgeReconnectTimer);
  bridgeReconnectTimer = setTimeout(async function() {
    if (!bridgeReconnectActive) return;
    var serverUrl = cfg.bridgeServer || 'http://localhost:9191';
    var ok = await tryConnectBridge(serverUrl);
    if (!ok && bridgeReconnectActive) {
      if (bridgeReconnectAttempts % 5 === 0) {
        addMessage('system', 'Bridge still unreachable after ' + bridgeReconnectAttempts + ' attempts. Will keep trying.');
        // #9 Sound: keep trying — soft error reminder every 5 attempts
        SOUND.error();
      }
      attemptReconnect();
    } else if (ok) {
      // #9 Sound: successful reconnect
      SOUND.reconnect();
    }
  }, delay);
}
function stopBridgeAutoReconnect() {
  bridgeReconnectActive = false;
  if (bridgeReconnectTimer) { clearTimeout(bridgeReconnectTimer); bridgeReconnectTimer = null; }
}

function onBridgeConnected(name) {
  document.getElementById('cfg-bridge-dir').value = name;
  document.getElementById('bridge-status-msg').textContent = 'BRIDGE CONNECTED — ' + name + ' [' + bridgeMode + ']';
  document.getElementById('bridge-status-msg').className = 'bridge-status active';
  document.getElementById('status-bridge').textContent = 'CONNECTED';
  document.getElementById('status-bridge').style.color = 'var(--green)';
  document.getElementById('dot-bridge').className = 'dot green';
  document.getElementById('proto-bridge').textContent = 'ONLINE';
  addMessage('system','Bridge connected: ' + name);
}

// --- Unified file I/O ---
// [FIX] All bridge file operations detect network failure and trigger auto-reconnect.

async function readBridgeFile(filename) {
  if (bridgeMode === 'fsa' && bridgeHandle) {
    try {
      const fh = await bridgeHandle.getFileHandle(filename);
      const file = await fh.getFile();
      return await file.text();
    } catch(e) { return null; }
  }
  if (bridgeMode === 'server') {
    try {
      const res = await fetch((cfg.bridgeServer||'http://localhost:9191') + '/read/' + encodeURIComponent(filename));
      if (!res.ok) return null;
      return await res.text();
    } catch(e) {
      // [FIX] network failure → trigger reconnect
      if (isNetworkError(e)) handleBridgeNetworkFailure('read', filename);
      return null;
    }
  }
  return null;
}

async function writeBridgeFile(filename, content) {
  if (bridgeMode === 'fsa' && bridgeHandle) {
    try {
      const fh = await bridgeHandle.getFileHandle(filename, {create:true});
      const writable = await fh.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch(e) { logError('Bridge write error: '+e.message); return null; }
  }
  if (bridgeMode === 'server') {
    try {
      const res = await fetch((cfg.bridgeServer||'http://localhost:9191') + '/write/' + encodeURIComponent(filename), {
        method:'POST', body: content
      });
      if (!res.ok) throw new Error('Write failed: '+res.status);
      return true;
    } catch(e) {
      if (isNetworkError(e)) handleBridgeNetworkFailure('write', filename);
      else logError('Bridge write error: ' + e.message);
      return null;
    }
  }
  return null;
}

async function appendBridgeFile(filename, line) {
  if (bridgeMode === 'fsa' && bridgeHandle) {
    try {
      let existing = '';
      try { const fh = await bridgeHandle.getFileHandle(filename); const f=await fh.getFile(); existing=await f.text(); } catch(e){}
      const fh = await bridgeHandle.getFileHandle(filename, {create:true});
      const writable = await fh.createWritable();
      await writable.write(existing + line + '\n');
      await writable.close();
      return true;
    } catch(e) { logError('Bridge append error: '+e.message); return null; }
  }
  if (bridgeMode === 'server') {
    try {
      const res = await fetch((cfg.bridgeServer||'http://localhost:9191') + '/append/' + encodeURIComponent(filename), {
        method:'POST', body: line + '\n'
      });
      if (!res.ok) throw new Error('Append failed: '+res.status);
      return true;
    } catch(e) {
      if (isNetworkError(e)) handleBridgeNetworkFailure('append', filename);
      else logError('Bridge append error: ' + e.message);
      return null;
    }
  }
  return null;
}

async function bridgeFileExists(filename) {
  if (bridgeMode === 'fsa' && bridgeHandle) {
    try { await bridgeHandle.getFileHandle(filename); return true; } catch(e) { return false; }
  }
  if (bridgeMode === 'server') {
    try {
      const res = await fetch((cfg.bridgeServer||'http://localhost:9191') + '/exists/' + encodeURIComponent(filename));
      return res.ok && (await res.json()).exists;
    } catch(e) {
      if (isNetworkError(e)) handleBridgeNetworkFailure('exists', filename);
      return false;
    }
  }
  return false;
}

// Detect "network error" (TypeError: Failed to fetch) vs HTTP error
function isNetworkError(e) {
  return e && (e.name === 'TypeError' || /Failed to fetch/i.test(e.message || ''));
}

// [FIX] Called when a bridge fetch failed due to network — start auto-reconnect
function handleBridgeNetworkFailure(op, filename) {
  if (!bridgeReconnectActive) {
    logError('Bridge unreachable during ' + op + '(' + filename + ') — attempting reconnect...');
    startBridgeAutoReconnect();
  }
}

async function readTomogichiState() {
  return await readBridgeFile('agora-state.json');
}

async function readEmergencyFlag() {
  return await readBridgeFile('agora-emergency.flag');
}

async function readCommandResults() {
  return await readBridgeFile('agora-results.json');
}

async function enqueueCommand(action, payload) {
  const id = 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const cmd = JSON.stringify({id, ts: new Date().toISOString().replace('T',' ').substring(0,19), action, payload});
  await appendBridgeFile('agora-commands.jsonl', cmd);
  return id;
}

function startBridgePolling() {
  if (bridgePollInterval) clearInterval(bridgePollInterval);
  bridgePollInterval = setInterval(checkEmergencyFlag, 5000);
}

async function checkEmergencyFlag() {
  const flag = await readEmergencyFlag();
  if (!flag || !flag.trim()) {
    lastEmergencyHash = '';
    return;
  }
  const hash = flag.trim().length + ':' + flag.trim().substring(0, 100);
  if (hash === lastEmergencyHash) return;
  lastEmergencyHash = hash;

  addMessage('incoming','EMERGENCY SIGNAL DETECTED: ' + flag.trim());
  document.getElementById('status-text').textContent = 'EMERGENCY';
  document.getElementById('dot-status').className = 'dot red';
  const emergencyMsg = 'EMERGENCY! The user has triggered the emergency button. Message: ' + flag.trim() + '\nRespond immediately with support and guidance. Check their state and give tactical advice.';
  addMessage('system','Auto-dispatching emergency response...');
  try {
    const resp = await sendToLLM(emergencyMsg, true);
    addMessage('ai', resp);
  } catch(e) {
    logError(e.message);
  }
  document.getElementById('status-text').textContent = 'ONLINE';
  document.getElementById('dot-status').className = 'dot green';
}

// ═══════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════
function getBuiltinTools() {
  const tools = [];

  if (cfg.memTools) {
    tools.push({type:'function',function:{name:'update_active_memory',description:'Update the active memory. Mode: replace, append, prepend, or patch (remove occurrence of content).',parameters:{type:'object',properties:{content:{type:'string',description:'Memory content'},mode:{type:'string',enum:['replace','append','prepend','patch'],description:'How to update'}},required:['content','mode']}}});
    tools.push({type:'function',function:{name:'list_memory_files',description:'List all saved memory files.',parameters:{type:'object',properties:{},required:[]}}});
    tools.push({type:'function',function:{name:'read_memory_file',description:'Read a saved memory file by name.',parameters:{type:'object',properties:{name:{type:'string',description:'File name'}},required:['name']}}});
    tools.push({type:'function',function:{name:'create_memory_file',description:'Create a new memory file.',parameters:{type:'object',properties:{name:{type:'string',description:'File name'},content:{type:'string',description:'File content'},description:{type:'string',description:'Optional description'}},required:['name','content']}}});
    tools.push({type:'function',function:{name:'delete_memory_file',description:'Delete a memory file by name.',parameters:{type:'object',properties:{name:{type:'string',description:'File name'}},required:['name']}}});
  }

  tools.push({type:'function',function:{name:'tomogichi_read',description:'Read the user\'s full Tomogichi state (characters, skills, calendar, tasks, challenges, stats, schedule). Includes a rendered section with today\'s + this week\'s schedule in human-readable form.',parameters:{type:'object',properties:{},required:[]}}});
  tools.push({type:'function',function:{name:'tomogichi_today',description:'Get today\'s rendered schedule + todos in compact format.',parameters:{type:'object',properties:{},required:[]}}});
  tools.push({type:'function',function:{name:'tomogichi_week',description:'Get this week\'s rendered schedule (7 days).',parameters:{type:'object',properties:{},required:[]}}});
  tools.push({type:'function',function:{name:'tomogichi_diary_add',description:'Add a diary entry to Tomogichi. Queued and applied automatically.',parameters:{type:'object',properties:{text:{type:'string',description:'Diary entry text'}},required:['text']}}});
  tools.push({type:'function',function:{name:'tomogichi_todo_add',description:'Add a task to the user\'s Today list in Tomogichi.',parameters:{type:'object',properties:{text:{type:'string',description:'Task text'},date:{type:'string',description:'ISO date YYYY-MM-DD, empty=today'}},required:['text']}}});
  tools.push({type:'function',function:{name:'tomogichi_schedule_add_override',description:'Add a one-time event (seminar, appointment) that overrides the recurring schedule. Pass start_date=end_date for single-day.',parameters:{type:'object',properties:{label:{type:'string',description:'Event label'},start_date:{type:'string',description:'ISO YYYY-MM-DD'},end_date:{type:'string',description:'ISO YYYY-MM-DD (same as start_date for single day)'},start_hour:{type:'integer'},start_minute:{type:'integer'},end_hour:{type:'integer'},end_minute:{type:'integer'}},required:['label','start_date','end_date','start_hour','start_minute','end_hour','end_minute']}}});
  tools.push({type:'function',function:{name:'tomogichi_mood_log',description:'Log the user\'s current mood. Valid words: energetic, focused, calm, tired, grateful, frustrated, determined, creative, anxious, happy, sad.',parameters:{type:'object',properties:{word:{type:'string',description:'Mood word'}},required:['word']}}});
  tools.push({type:'function',function:{name:'tomogichi_emergency_check',description:'Check if the user has triggered an emergency.',parameters:{type:'object',properties:{},required:[]}}});
  tools.push({type:'function',function:{name:'tomogichi_command_status',description:'Check the status of a previously enqueued command (applied/pending/failed).',parameters:{type:'object',properties:{id:{type:'string',description:'Command id'}},required:['id']}}});
  tools.push({type:'function',function:{name:'tomogichi_lock_app',description:'Lock the Tomogichi app for a focus block (1-24h). Emergency always remains available.',parameters:{type:'object',properties:{duration_hours:{type:'integer',description:'Lock duration in hours (1-24)'}},required:['duration_hours']}}});
  tools.push({type:'function',function:{name:'tomogichi_challenge_add',description:'Create a personalized quest/challenge. Give coin rewards (10-50).',parameters:{type:'object',properties:{description:{type:'string',description:'Quest description'},person:{type:'string',description:'Character: riff/reef/pitch/rain'},skill:{type:'string',description:'Skill name'},target_count:{type:'integer',description:'How many times to complete'},target_days:{type:'integer',description:'Deadline in days'},coin_reward:{type:'integer',description:'Coins earned on completion (10-50)'}},required:['description','person','target_count','target_days','coin_reward']}}});
  tools.push({type:'function',function:{name:'tomogichi_challenge_delete',description:'Remove a challenge by description (partial match).',parameters:{type:'object',properties:{description:{type:'string',description:'Description (or part of it) of the challenge to remove'}},required:['description']}}});
  tools.push({type:'function',function:{name:'tomogichi_create_milestone',description:'Create a personal milestone (custom achievement).',parameters:{type:'object',properties:{id:{type:'string',description:'Unique ID e.g. first_sketchbook'},name:{type:'string',description:'Display name'},description:{type:'string',description:'What it means'},icon:{type:'string',description:'Emoji icon'}},required:['id','name','description','icon']}}});
  tools.push({type:'function',function:{name:'tomogichi_unlock_milestone',description:'Mark a previously-created milestone as achieved.',parameters:{type:'object',properties:{id:{type:'string',description:'Milestone ID to unlock'}},required:['id']}}});
  tools.push({type:'function',function:{name:'tomogichi_delete_milestone',description:'Remove a custom milestone.',parameters:{type:'object',properties:{id:{type:'string',description:'Milestone ID to delete'}},required:['id']}}});

  return tools;
}

// ═══════════════════════════════════════════════
// TOOL EXECUTION
// ═══════════════════════════════════════════════

async function executeTool(name, argsStr) {
  let args = {};
  try { args = JSON.parse(argsStr || '{}'); }
  catch(e) { return 'Error parsing arguments: ' + e.message + ' (raw: ' + (argsStr||'').substring(0,200) + ')'; }

  if (name === 'update_active_memory') {
    const content = args.content || '';
    const mode = args.mode || 'replace';
    if (!activeMemory) activeMemory = '';
    if (mode === 'replace') activeMemory = content;
    else if (mode === 'append') activeMemory += '\n' + content;
    else if (mode === 'prepend') activeMemory = content + '\n' + activeMemory;
    else if (mode === 'patch') activeMemory = activeMemory.replace(content, '');
    saveActiveMemory();
    return 'Active memory updated (mode: '+mode+'). Current active memory:\n'+activeMemory;
  }
  if (name === 'list_memory_files') {
    const keys = Object.keys(memoryFiles);
    return 'Memory files ('+keys.length+'):\n'+keys.map(k=>'  - '+k+' ('+memoryFiles[k].length+' bytes)').join('\n') || '(none)';
  }
  if (name === 'read_memory_file') {
    const fname = args.name || '';
    return memoryFiles[fname] || 'File not found: '+fname;
  }
  if (name === 'create_memory_file') {
    const fname = args.name || '', content = args.content || '';
    memoryFiles[fname] = content;
    saveMemoryFiles();
    return 'Memory file created: '+fname;
  }
  if (name === 'delete_memory_file') {
    delete memoryFiles[args.name || ''];
    saveMemoryFiles();
    return 'Memory file deleted: '+(args.name||'');
  }

  if (name === 'tomogichi_read') {
    const state = await readTomogichiState();
    return state || 'Tomogichi data not found. The user may not have launched tomogichi yet, or the bridge directory is not set.';
  }
  if (name === 'tomogichi_today') {
    const state = await readTomogichiState();
    if (!state) return 'Tomogichi state not found.';
    try {
      const j = JSON.parse(state);
      if (!j.rendered) return 'No rendered schedule in state.';
      const r = j.rendered;
      let out = 'Today ('+(r.today_iso||'?')+(r.week_label?', '+r.week_label:'')+'):\n';
      if (r.today_schedule && r.today_schedule.length) {
        out += 'Schedule:\n';
        for (const s of r.today_schedule) out += '  '+s.start+'-'+s.end+' '+s.label+(s.is_override?' [override]':'')+'\n';
      } else out += 'Schedule: (nothing)\n';
      if (r.today_todos && r.today_todos.length) {
        out += 'Tasks:\n';
        for (const t of r.today_todos) out += '  '+(t.done?'[x] ':'[ ] ')+t.text+'\n';
      } else out += 'Tasks: (none)\n';
      return out;
    } catch(e) { return 'Error: '+e.message; }
  }
  if (name === 'tomogichi_week') {
    const state = await readTomogichiState();
    if (!state) return 'Tomogichi state not found.';
    try {
      const j = JSON.parse(state);
      if (!j.rendered || !j.rendered.week) return 'No week schedule in state.';
      let out = 'Week schedule'+(j.rendered.week_label?' ('+j.rendered.week_label+')':'')+':\n';
      for (const day of j.rendered.week) {
        out += day.dow+' '+day.iso+':\n';
        if (day.schedule && day.schedule.length) {
          for (const s of day.schedule) out += '  '+s.start+'-'+s.end+' '+s.label+(s.is_override?' [override]':'')+'\n';
        } else out += '  (nothing)\n';
        if (day.todos && day.todos.length) for (const t of day.todos) out += '  '+(t.done?'[x] ':'[ ] ')+t.text+'\n';
      }
      return out;
    } catch(e) { return 'Error: '+e.message; }
  }
  if (name === 'tomogichi_diary_add') {
    const text = args.text || '';
    if (!text) return 'Error: diary text is empty.';
    const id = await enqueueCommand('diary_add', {text});
    return 'Diary entry queued (id='+id+'). Tomogichi will apply it on next poll.';
  }
  if (name === 'tomogichi_todo_add') {
    const text = args.text || '';
    if (!text) return 'Error: task text is empty.';
    const id = await enqueueCommand('todo_add', {text, date:args.date||''});
    return 'Task queued (id='+id+'). Will be added to the user\'s Today list.';
  }
  if (name === 'tomogichi_schedule_add_override') {
    const label = args.label || '';
    if (!label) return 'Error: label is empty.';
    const id = await enqueueCommand('schedule_add_override', {
      label, start_date:args.start_date||'', end_date:args.end_date||'',
      start_hour:args.start_hour||0, start_minute:args.start_minute||0,
      end_hour:args.end_hour||23, end_minute:args.end_minute||59
    });
    return 'Override event queued (id='+id+').';
  }
  if (name === 'tomogichi_mood_log') {
    const word = args.word || '';
    if (!word) return 'Error: mood word is empty.';
    const id = await enqueueCommand('mood_log', {word});
    return 'Mood logged (id='+id+').';
  }
  if (name === 'tomogichi_emergency_check') {
    const flag = await readEmergencyFlag();
    return flag && flag.trim() ? 'ACTIVE EMERGENCY: '+flag.trim() : 'No active emergency.';
  }
  if (name === 'tomogichi_command_status') {
    const id = args.id || '';
    if (!id) return 'Error: command id is empty.';
    const results = await readCommandResults();
    if (!results) return 'No results file yet — command may still be pending.';
    try {
      const r = JSON.parse(results);
      return r[id] ? JSON.stringify(r[id]) : 'Command '+id+' is pending (tomogichi hasn\'t applied it yet).';
    } catch(e) { return 'Results file unreadable.'; }
  }
  if (name === 'tomogichi_lock_app') {
    const hours = args.duration_hours || 0;
    if (hours <= 0 || hours > 24) return 'Error: duration_hours must be 1-24.';
    const id = await enqueueCommand('lock_app', {duration_hours:hours});
    return 'Lock command queued (id='+id+'). Tomogichi will lock for '+hours+'h.';
  }
  if (name === 'tomogichi_challenge_add') {
    const id = await enqueueCommand('challenge_add', {
      description:args.description||'', person:args.person||'', skill:args.skill||'',
      target_count:args.target_count||1, target_days:args.target_days||7, coin_reward:args.coin_reward||10
    });
    return 'Challenge queued (id='+id+'). Quest will appear in Stats tab.';
  }
  if (name === 'tomogichi_challenge_delete') {
    const id = await enqueueCommand('challenge_delete', {description:args.description||''});
    return 'Challenge deletion queued (id='+id+').';
  }
  if (name === 'tomogichi_create_milestone') {
    const id = await enqueueCommand('milestone_add', {id:args.id||'', name:args.name||'', description:args.description||'', icon:args.icon||''});
    return 'Milestone created (id='+id+').';
  }
  if (name === 'tomogichi_unlock_milestone') {
    const id = await enqueueCommand('milestone_unlock', {id:args.id||''});
    return 'Milestone unlocked (id='+id+').';
  }
  if (name === 'tomogichi_delete_milestone') {
    const id = await enqueueCommand('milestone_delete', {id:args.id||''});
    return 'Milestone deleted (id='+id+').';
  }

  return 'Unknown tool: '+name;
}

// ═══════════════════════════════════════════════
// VARIABLE RESOLUTION
// ═══════════════════════════════════════════════
async function resolveVariables(template) {
  let result = template;
  const now = new Date();
  result = result.replace(/\{date\}/g, now.toISOString().substring(0,10));
  result = result.replace(/\{time\}/g, now.toTimeString().substring(0,8));
  result = result.replace(/\{current_date\}/g, now.toISOString().substring(0,10));
  result = result.replace(/\{active_memory\}/g, activeMemory || '(empty)');

  const tomo = await readTomogichiState();
  result = result.replace(/\{tomogichi\}/g, tomo ? '<tomogichi>\n'+tomo+'\n</tomogichi>' : '(tomogichi state not available)');

  const em = await readEmergencyFlag();
  result = result.replace(/\{emergency\}/g, em && em.trim() ? '<emergency>\n'+em.trim()+'\n</emergency>' : '');

  return result;
}

// ═══════════════════════════════════════════════
// LLM API CALL — streaming + thinking mode + tool calls
// ═══════════════════════════════════════════════

function buildRequestBody(messages, tools) {
  const body = {
    model: cfg.model,
    messages: messages,
    stream: cfg.streamEnabled,
  };
  if (cfg.thinkingEnabled) {
    body.thinking = {type: 'enabled'};
    body.reasoning_effort = cfg.reasoningEffort || 'high';
    body.max_tokens = 4096;
  } else {
    body.temperature = 0.7;
    body.top_p = 1.0;
    body.max_tokens = 2048;
  }
  if (tools && tools.length > 0) body.tools = tools;
  return body;
}

async function fetchWithRetry(url, options, maxRetries) {
  maxRetries = maxRetries || 3;
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      currentAbortController = controller;
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(url, Object.assign({}, options, {signal: controller.signal}));
      clearTimeout(timeout);
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch(e) {
      currentAbortController = null;
      lastError = e;
      if (e.name === 'AbortError') throw e;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
    }
  }
  throw lastError;
}

async function parseError(res) {
  let detail = '';
  try {
    const err = await res.json();
    detail = (err.error && err.error.message) || err.message || JSON.stringify(err);
  } catch(e) {
    try { detail = await res.text(); } catch(e2) {}
  }
  if (!detail) detail = 'HTTP ' + res.status;
  return detail;
}

function mergeToolCallDelta(existing, delta) {
  if (!existing) {
    return {
      index: delta.index || 0,
      id: delta.id || '',
      type: delta.type || 'function',
      function: {name: (delta.function && delta.function.name) || '', arguments: (delta.function && delta.function.arguments) || ''}
    };
  }
  if (delta.function) {
    if (!existing.function) existing.function = {name:'', arguments:''};
    if (delta.function.name) existing.function.name = delta.function.name;
    if (delta.function.arguments) existing.function.arguments += delta.function.arguments;
  }
  if (delta.id && !existing.id) existing.id = delta.id;
  if (delta.type && !existing.type) existing.type = delta.type;
  return existing;
}

async function streamChat(messages, tools, callbacks) {
  const onReasoning = callbacks.onReasoning || function(){};
  const onContent = callbacks.onContent || function(){};
  const onToolCalls = callbacks.onToolCalls || function(){};
  const onDone = callbacks.onDone || function(){};

  const url = cfg.endpoint.replace(/\/+$/, '') + '/chat/completions';
  const headers = {'Content-Type':'application/json'};
  if (cfg.apikey) headers['Authorization'] = 'Bearer ' + cfg.apikey;
  const body = buildRequestBody(messages, tools);

  const res = await fetchWithRetry(url, {method:'POST', headers, body: JSON.stringify(body)});
  if (!res.ok) {
    const detail = await parseError(res);
    throw new Error(detail);
  }

  if (!cfg.streamEnabled) {
    try {
      const data = await res.json();
      const choice = data.choices && data.choices[0];
      if (!choice) throw new Error('No response. Retry.');
      const msg = choice.message || {};
      if (msg.reasoning_content) onReasoning(msg.reasoning_content);
      if (msg.content) onContent(msg.content);
      if (msg.tool_calls && msg.tool_calls.length) onToolCalls(msg.tool_calls);
      onDone(msg);
      return msg;
    } finally {
      currentAbortController = null;
    }
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reasoning = '', content = '';
  let toolCalls = [];
  const finalMsg = {role:'assistant', content:'', reasoning_content:''};

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, {stream:true});
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
          if (!delta) continue;
          if (delta.reasoning_content) {
            reasoning += delta.reasoning_content;
            finalMsg.reasoning_content = reasoning;
            onReasoning(delta.reasoning_content);
          }
          if (delta.content) {
            content += delta.content;
            finalMsg.content = content;
            onContent(delta.content);
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index || 0;
              toolCalls[idx] = mergeToolCallDelta(toolCalls[idx] || null, tc);
            }
          }
        } catch(e) {}
      }
    }
  } finally {
    try { reader.releaseLock(); } catch(e) {}
    currentAbortController = null;
  }

  if (toolCalls.length > 0) {
    finalMsg.tool_calls = toolCalls.filter(function(tc){return !!tc;});
    onToolCalls(finalMsg.tool_calls);
  }
  onDone(finalMsg);
  return finalMsg;
}

async function sendToLLM(userMessage, isEmergency) {
  if (!cfg.model) throw new Error('No model configured. Set model in CONFIG.');
  const tools = getBuiltinTools();
  const systemPrompt = await resolveVariables(cfg.systemPrompt);

  const messages = [];
  messages.push({role:'system', content:systemPrompt});
  if (activeMemory) messages.push({role:'system', content:'<active_memory>\n'+activeMemory+'\n</active_memory>'});
  const recent = conversationMessages.slice(-40);
  for (const m of recent) messages.push(m);
  messages.push({role:'user', content:userMessage});

  const ui = createStreamingMessage();
  let reasoningText = '', contentText = '';

  var msg;
  try {
    msg = await streamChat(messages, tools, {
      onReasoning: function(delta) { reasoningText += delta; ui.updateReasoning(reasoningText); },
      onContent: function(delta) { contentText += delta; ui.updateContent(contentText); },
      onToolCalls: function(tcs) {}
    });
  } catch(e) {
    ui.finalize(0);
    throw e;
  }

  const tokens = Math.ceil((reasoningText.length + contentText.length) / 4);
  sessionTokenCount += tokens;
  ui.finalize(tokens);

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    conversationMessages.push({
      role:'assistant',
      content: msg.content || '',
      reasoning_content: msg.reasoning_content || undefined,
      tool_calls: msg.tool_calls
    });

    for (const tc of msg.tool_calls) {
      const fn = tc.function;
      if (!tc.id) tc.id = 'call_' + Math.random().toString(36).slice(2);
      addToolCard(fn.name, fn.arguments);
      var result;
      try {
        result = await executeTool(fn.name, fn.arguments);
      } catch(e) {
        result = 'Tool execution error: ' + e.message;
        updateToolCard(fn.name, result, 'error');
        conversationMessages.push({role:'tool', tool_call_id: tc.id, content: result});
        continue;
      }
      updateToolCard(fn.name, result);
      conversationMessages.push({role:'tool', tool_call_id: tc.id, content: result});
    }

    saveConversation();
    return await continueWithToolResults(isEmergency, 1);
  }

  const content = msg.content || '';
  if (!content.trim()) throw new Error('No response. Retry.');
  conversationMessages.push({role:'assistant', content: content});
  if (conversationMessages.length > 60) conversationMessages = conversationMessages.slice(-40);
  saveConversation();

  if (ttsEnabled) ttsSpeak(content);
  return content;
}

async function continueWithToolResults(isEmergency, depth) {
  depth = depth || 1;
  if (depth >= 5) {
    conversationMessages.push({role:'assistant', content:'(Too many tool call rounds. Stopping.)'});
    saveConversation();
    return 'Multiple tool iterations complete. Ask the user for further direction.';
  }

  const tools = getBuiltinTools();
  const systemPrompt = await resolveVariables(cfg.systemPrompt);
  const messages = [];
  messages.push({role:'system', content:systemPrompt});
  if (activeMemory) messages.push({role:'system', content:'<active_memory>\n'+activeMemory+'\n</active_memory>'});
  const recent = conversationMessages.slice(-50);
  for (const m of recent) messages.push(m);

  const ui = createStreamingMessage();
  let reasoningText = '', contentText = '';

  var msg;
  try {
    msg = await streamChat(messages, tools, {
      onReasoning: function(delta) { reasoningText += delta; ui.updateReasoning(reasoningText); },
      onContent: function(delta) { contentText += delta; ui.updateContent(contentText); },
      onToolCalls: function(tcs) {}
    });
  } catch(e) {
    ui.finalize(0);
    throw e;
  }

  const tokens = Math.ceil((reasoningText.length + contentText.length) / 4);
  sessionTokenCount += tokens;
  ui.finalize(tokens);

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    conversationMessages.push({
      role:'assistant',
      content: msg.content || '',
      reasoning_content: msg.reasoning_content || undefined,
      tool_calls: msg.tool_calls
    });
    for (const tc of msg.tool_calls) {
      const fn = tc.function;
      if (!tc.id) tc.id = 'call_' + Math.random().toString(36).slice(2);
      addToolCard(fn.name, fn.arguments);
      var result;
      try {
        result = await executeTool(fn.name, fn.arguments);
      } catch(e) {
        result = 'Tool execution error: ' + e.message;
        updateToolCard(fn.name, result, 'error');
        conversationMessages.push({role:'tool', tool_call_id: tc.id, content: result});
        continue;
      }
      updateToolCard(fn.name, result);
      conversationMessages.push({role:'tool', tool_call_id: tc.id, content: result});
    }
    saveConversation();
    return await continueWithToolResults(isEmergency, depth + 1);
  }

  const content = msg.content || '';
  if (!content.trim()) throw new Error('No response. Retry.');
  conversationMessages.push({role:'assistant', content: content});
  if (conversationMessages.length > 60) conversationMessages = conversationMessages.slice(-40);
  saveConversation();

  if (ttsEnabled) ttsSpeak(content);
  return content;
}

function createStreamingMessage() {
  const term = document.getElementById('terminal');
  const wrapper = document.createElement('div');
  wrapper.className = 'msg msg-ai';

  const reasoningEl = document.createElement('div');
  reasoningEl.className = 'msg-reasoning';
  reasoningEl.style.display = 'none';
  const reasoningHeader = document.createElement('div');
  reasoningHeader.className = 'reasoning-header';
  reasoningHeader.textContent = '▶ THINKING';
  reasoningHeader.onclick = function() {
    const body = reasoningEl.querySelector('.reasoning-body');
    if (body) {
      body.classList.toggle('collapsed');
      reasoningHeader.textContent = body.classList.contains('collapsed') ? '▶ THINKING' : '▼ THINKING';
    }
  };
  const reasoningBody = document.createElement('div');
  reasoningBody.className = 'reasoning-body collapsed';
  reasoningEl.appendChild(reasoningHeader);
  reasoningEl.appendChild(reasoningBody);

  const contentEl = document.createElement('div');
  contentEl.style.marginTop = '4px';
  contentEl.textContent = (THEMES[cfg.theme] || THEMES['teletraan']).aiPrefix;

  const cursor = document.createElement('span');
  cursor.className = 'streaming-cursor';

  wrapper.appendChild(reasoningEl);
  wrapper.appendChild(contentEl);
  contentEl.appendChild(cursor);
  term.appendChild(wrapper);
  scrollDown();

  return {
    updateReasoning: function(text) {
      reasoningEl.style.display = 'block';
      reasoningBody.textContent = text;
      scrollDown();
    },
    updateContent: function(text) {
      contentEl.textContent = (THEMES[cfg.theme] || THEMES['teletraan']).aiPrefix + text;
      contentEl.appendChild(cursor);
      scrollDown();
    },
    finalize: function(tokens) {
      if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
      if (!reasoningBody.textContent) reasoningEl.style.display = 'none';
      else {
        reasoningHeader.textContent = '▶ THINKING (' + tokens + ' tokens)';
      }
      const tokInfo = document.createElement('div');
      tokInfo.className = 'token-info';
      tokInfo.textContent = '~' + tokens + ' tokens';
      wrapper.appendChild(tokInfo);
      scrollDown();
    }
  };
}

// ═══════════════════════════════════════════════
// [FIX] TOOL CALL CARDS — with category icons + status states
// Card shows: [icon] tool_name ........ status
//   Status:  ⟳ executing  (amber, pulsing)
//            ✓ done       (green)
//            ✗ error      (red)
// Body (collapsed): args + result preview
// ═══════════════════════════════════════════════
function getToolIcon(name) {
  return TOOL_ICONS[name] || '🔧';
}

function addToolCard(name, args) {
  const term = document.getElementById('terminal');
  const card = document.createElement('div');
  card.className = 'msg-tool-card';
  card.dataset.toolName = name;
  card.dataset.callId = 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);

  // #9 Sound: tool call click
  SOUND.tool();

  const header = document.createElement('div');
  header.className = 'tool-card-header';

  const left = document.createElement('span');
  left.style.display = 'flex';
  left.style.alignItems = 'center';
  left.style.gap = '4px';
  const icon = document.createElement('span');
  icon.className = 'tool-card-icon';
  icon.textContent = getToolIcon(name);
  const nameEl = document.createElement('span');
  nameEl.className = 'tool-card-name';
  nameEl.textContent = name;
  left.appendChild(icon);
  left.appendChild(nameEl);

  const status = document.createElement('span');
  status.className = 'tool-card-status running';
  status.textContent = '⟳ executing';

  header.appendChild(left);
  header.appendChild(status);

  const body = document.createElement('div');
  body.className = 'tool-card-body collapsed';
  body.textContent = 'args: ' + (args && args.length > 200 ? args.substring(0,200) + '...' : args);

  header.onclick = function() { body.classList.toggle('collapsed'); };
  card.appendChild(header);
  card.appendChild(body);
  term.appendChild(card);
  scrollDown();
}

function updateToolCard(name, result, statusOverride) {
  const cards = document.querySelectorAll('.msg-tool-card[data-tool-name="' + name + '"]');
  const card = cards[cards.length - 1];
  if (!card) return;
  const header = card.querySelector('.tool-card-header');
  const body = card.querySelector('.tool-card-body');
  const status = card.querySelector('.tool-card-status');
  var statusClass = 'done';
  var statusText = '✓ done';
  if (statusOverride === 'error') { statusClass = 'error'; statusText = '✗ error'; }
  if (status) {
    status.className = 'tool-card-status ' + statusClass;
    status.textContent = statusText;
  }
  if (body) {
    var preview = result.length > 500 ? result.substring(0,500) + '...' : result;
    body.textContent = body.textContent + '\n→ ' + preview;
  }
}

// ═══════════════════════════════════════════════
// MORNING BRIEF
// ═══════════════════════════════════════════════
async function runMorningBrief() {
  addMessage('system','=== Generating morning brief... ===');
  const now = new Date();
  const today = now.toISOString().substring(0,10);

  let brief = '=== MORNING BRIEF — ' + today + ' ===\n\n';

  const state = await readTomogichiState();
  if (state) {
    try {
      const j = JSON.parse(state);
      brief += '[Companion state]\n';
      if (j.persons && j.persons.length) {
        brief += 'Characters:\n';
        for (const p of j.persons) brief += '  '+p.name+' (Lvl '+(p.level||0)+')\n';
      }
      if (j.master) {
        if (j.master.daily_todos) {
          let pending=0, done=0;
          for (const t of j.master.daily_todos) t.done?done++:pending++;
          brief += 'Today: '+pending+' pending, '+done+' done tasks\n';
        }
        const entropy = j.master.entropy||0, sync = j.master.team_sync||0;
        brief += 'Entropy: '+entropy+'/100, Sync: '+sync+'%\n';
        if (j.master.mood_log) {
          const moods = j.master.mood_log;
          const show = Math.min(3, moods.length);
          if (show>0) { brief += 'Recent mood: '; for (let i=moods.length-show;i<moods.length;i++) brief += moods[i].word+(i<moods.length-1?', ':''); brief += '\n'; }
        }
      }
      brief += '\n';
    } catch(e) { brief += '(failed to parse tomogichi state)\n\n'; }
  } else {
    brief += '[Companion state]\n(not available — tomogichi hasn\'t exported state yet)\n\n';
  }

  if (cfg.weatherEnabled && cfg.weatherLat && cfg.weatherLon) {
    try {
      const w = await fetchWeather(parseFloat(cfg.weatherLat), parseFloat(cfg.weatherLon));
      if (w.valid) {
        brief += '[Weather — '+(cfg.weatherCity||'Unknown')+']\n'+w.summary+'\nClothing: '+w.clothing_hint+'\n\n';
      } else {
        brief += '[Weather]\n(unavailable — offline or fetch failed)\n\n';
      }
    } catch(e) { brief += '[Weather]\n(fetch error: '+e.message+')\n\n'; }
  } else {
    brief += '[Weather]\n(location not configured — set lat/lon in Settings)\n\n';
  }

  brief += 'Use this context naturally in conversation. If the user seems stressed or entropy is high, lead with support, not tasks.';

  activeMemory = brief;
  saveActiveMemory();
  addMessage('system','Morning brief generated. Active memory updated.');
  addMessage('incoming', brief);
  document.getElementById('proto-bridge').textContent = 'BRIEFED';
  return brief;
}

async function fetchWeather(lat, lon) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=1';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {signal: controller.signal});
    clearTimeout(timeout);
    if (!res.ok) return {valid:false};
    const j = await res.json();
    if (!j.daily) return {valid:false};
    const d = j.daily;
    const w = {
      valid:true,
      temp_max: d.temperature_2m_max[0],
      temp_min: d.temperature_2m_min[0],
      precip_prob: ((d.precipitation_probability_max || [])[0] || 0) / 100,
      wind_max: (d.wind_speed_10m_max || [])[0] || 0,
      summary: '', clothing_hint: ''
    };
    w.summary = 'max '+Math.round(w.temp_max)+'°C, min '+Math.round(w.temp_min)+'°C, '+Math.round(w.precip_prob*100)+'% rain, wind '+Math.round(w.wind_max)+'km/h';
    let hint = '';
    const t = w.temp_max;
    if (t<0) hint='Heavy coat, gloves, hat, scarf';
    else if (t<8) hint='Winter coat, warm layers';
    else if (t<14) hint='Warm jacket or coat';
    else if (t<18) hint='Light jacket or sweater';
    else if (t<23) hint='Long sleeves, light layer';
    else if (t<28) hint='T-shirt, light clothing';
    else hint='Light clothing, sun protection';
    if (w.precip_prob>.4) hint+=', umbrella recommended';
    else if (w.precip_prob>.2) hint+=', light rain possible';
    if (w.wind_max>30) hint+=', windy';
    w.clothing_hint = hint;
    return w;
  } catch(e) { return {valid:false}; }
}

// ═══════════════════════════════════════════════
// SEND MESSAGE / STOP
// ═══════════════════════════════════════════════
function onSendClick() {
  if (isGenerating) {
    if (currentAbortController) {
      try { currentAbortController.abort(); } catch(e) {}
      currentAbortController = null;
    }
    isGenerating = false;
    const btn = document.getElementById('btn-send');
    btn.classList.remove('stopping');
    btn.textContent = 'SEND';
    document.getElementById('status-text').textContent = 'ONLINE';
    document.getElementById('dot-status').className = 'dot green';
    addMessage('system','Generation stopped.');
    return;
  }
  sendMessage();
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';
  addMessage('user', text);
  await sendMessageInternal(text);
  document.getElementById('msg-input').focus();
}

// ═══════════════════════════════════════════════
// STT
// ═══════════════════════════════════════════════
function toggleMic() {
  if (isRecording) { stopListening(); return; }
  if (cfg.sttProvider === 'web-speech') {
    sttListenWebSpeech();
  } else if (cfg.sttProvider === 'custom' || cfg.sttProvider === 'whisper-cpp') {
    sttListenCustom();
  } else {
    logError('Unknown STT provider: ' + cfg.sttProvider);
  }
}

function sttListenWebSpeech() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    logError('Web Speech not available in this browser. Use Chrome, or switch to Custom STT (Vosk) in CONFIG.');
    return;
  }
  recognition = new SR();
  recognition.continuous = false; recognition.interimResults = true; recognition.lang = 'en-US';
  recognition.onresult = function(e) {
    var interim='', final='';
    for (var i=e.resultIndex;i<e.results.length;i++) { if(e.results[i].isFinal) final+=e.results[i][0].transcript; else interim+=e.results[i][0].transcript; }
    var input=document.getElementById('msg-input'); input.value=final||interim; input.style.color=final?'':'var(--grey)';
    if (final) { stopListening(); sendMessage(); }
  };
  recognition.onerror = function(e) { stopListening(); logError('Speech recognition error: '+e.error); };
  recognition.onend = function() { stopListening(); };
  try {
    recognition.start();
    isRecording=true;
    document.getElementById('btn-mic').classList.add('recording');
    document.getElementById('dot-stt').className='dot red';
    addMessage('system', 'Listening... (Web Speech)');
  } catch(e) { stopListening(); logError('Speech recognition start failed: ' + e.message); }
}

var mediaRecorder = null;
var audioChunks = [];

function sttListenCustom() {
  var endpoint = cfg.sttEndpoint;
  if (!endpoint) {
    logError('No STT endpoint configured. Set it in CONFIG (e.g. http://localhost:2700 for Vosk).');
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    logError('Microphone access not available. Browser may not support it, or page must be served via HTTPS/localhost.');
    addMessage('system', 'Tip: Open teletraan.html via http://localhost instead of file:// — or use bridge.py to serve it.');
    return;
  }

  navigator.mediaDevices.getUserMedia({audio: true})
    .then(function(stream) {
      isRecording = true;
      document.getElementById('btn-mic').classList.add('recording');
      document.getElementById('dot-stt').className = 'dot red';
      addMessage('system', 'Listening... (Custom STT → ' + endpoint + ')');

      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = function(e) {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = function() {
        stream.getTracks().forEach(function(t) { t.stop(); });
        var audioBlob = new Blob(audioChunks, {type: 'audio/webm'});
        blobToWav(audioBlob).then(function(wavBlob) {
          sendAudioToSTT(wavBlob, endpoint);
        }).catch(function(e) {
          logError('Audio conversion failed: ' + e.message);
          stopListening();
        });
      };

      mediaRecorder.start();
    })
    .catch(function(e) {
      // [FIX] surface silent failure with actionable hint
      logError('Microphone access denied: ' + e.name + ' — ' + e.message);
      addMessage('system', 'Tip: Allow microphone access in browser settings. May need HTTPS or localhost (not file://).');
      stopListening();
    });
}

function blobToWav(blob) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      var arrayBuffer = reader.result;
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { reject(new Error('AudioContext not available')); return; }
      var ctx = new AudioCtx({sampleRate: 16000});
      ctx.decodeAudioData(arrayBuffer, function(audioBuffer) {
        var wav = audioBufferToWav(audioBuffer, 16000);
        resolve(new Blob([wav], {type: 'audio/wav'}));
      }, function(e) { reject(new Error('Audio decode failed: ' + e)); });
    };
    reader.onerror = function() { reject(new Error('FileReader error')); };
    reader.readAsArrayBuffer(blob);
  });
}

function audioBufferToWav(buffer, targetSampleRate) {
  var numChannels = 1;
  var sampleRate = targetSampleRate || 16000;
  var numFrames = buffer.length;
  var bytesPerSample = 2;
  var blockAlign = numChannels * bytesPerSample;
  var byteRate = sampleRate * blockAlign;
  var dataSize = numFrames * blockAlign;
  var bufferSize = 44 + dataSize;

  var arrayBuffer = new ArrayBuffer(bufferSize);
  var view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  var channelData = buffer.getChannelData(0);
  var offset = 44;
  for (var i = 0; i < numFrames; i++) {
    var sample = Math.max(-1, Math.min(1, channelData[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return arrayBuffer;
}

function writeString(view, offset, str) {
  for (var i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function sendAudioToSTT(wavBlob, endpoint) {
  addMessage('system', 'Processing speech...');

  fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'audio/wav'},
    body: wavBlob
  })
  .then(function(res) {
    if (!res.ok) throw new Error('STT server returned ' + res.status);
    return res.json();
  })
  .then(function(data) {
    var text = data.text || data.transcript || '';
    if (text.trim()) {
      var input = document.getElementById('msg-input');
      input.value = text.trim();
      addMessage('system', 'Recognized: ' + text.trim());
      stopListening();
      sendMessage();
    } else {
      addMessage('error', 'No speech detected. Try speaking louder or closer to the mic.');
      stopListening();
    }
  })
  .catch(function(e) {
    // [FIX] surface with actionable hint
    logError('STT failed: ' + e.message);
    if (e.message.indexOf('Failed to fetch') >= 0) {
      addMessage('system', 'Cannot reach STT server at ' + endpoint + '. Is Vosk running? (start.sh starts it on port 2700)');
    }
    stopListening();
  });
}

function stopListening() {
  if (recognition) { try{recognition.stop()}catch(e){} recognition = null; }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch(e) {}
  }
  mediaRecorder = null;
  audioChunks = [];
  isRecording=false;
  document.getElementById('btn-mic').classList.remove('recording');
  document.getElementById('msg-input').style.color='';
  updateProtocols();
}

// ═══════════════════════════════════════════════
// TTS
// ═══════════════════════════════════════════════
function checkTtsAvailable() {
  if (cfg.ttsProvider === 'web-speech') {
    if (!window.speechSynthesis) return {ok: false, reason: 'Web Speech API not available in this browser'};
    return {ok: true, reason: ''};
  }
  if (cfg.ttsProvider === 'piper') {
    if (bridgeMode !== 'server') return {ok: false, reason: 'Bridge not connected in server mode (Piper needs bridge as CORS proxy)'};
    return {ok: true, reason: ''};
  }
  if (cfg.ttsProvider === 'custom') {
    if (!cfg.ttsEndpoint) return {ok: false, reason: 'No TTS endpoint configured'};
    return {ok: true, reason: ''};
  }
  return {ok: false, reason: 'Unknown TTS provider'};
}

function showTtsSetupHelp(reason) {
  addMessage('error', '🔊 TTS unavailable — ' + reason);
  if (cfg.ttsProvider === 'piper') {
    const help = [
      '═══════════ PIPER TTS SETUP ═══════════',
      'Piper is local on your device, but the browser cannot call it directly.',
      'Browser security (CORS) blocks file:// → http://localhost:5000 requests.',
      'bridge.py solves this by acting as a CORS-adding proxy.',
      '',
      'Step 1 — Start Piper TTS server (if not already running):',
      '  ~/piper-venv/bin/python3 -m piper.http_server -m en_US-lessac-medium',
      '',
      'Step 2 — Start bridge.py with TTS proxy (in a new terminal):',
      '  cd ~/teletraan-1',
      '  python3 bridge.py ~/.local/share/tomogichi-qt/ --tts-url http://localhost:5000',
      '',
      'Step 3 — In this app: click CONFIG → SELECT (bridge auto-connects, no path needed)',
      '',
      'Step 4 — Click 🔊 again to enable TTS',
      '',
      'Audio flow: LibreWolf → bridge:9191/tts → Piper:5000/synthesize → speaker',
      '═══════════════════════════════════════',
    ].join('\n');
    addMessage('incoming', help);
  } else if (cfg.ttsProvider === 'custom') {
    addMessage('system', 'CUSTOM TTS: Set the TTS Endpoint field in CONFIG (any HTTP endpoint that accepts {"text":"..."} POST and returns audio bytes).');
  } else {
    addMessage('system', 'WEB SPEECH: This browser does not support the Web Speech API. Try Chrome, or switch to Piper TTS in CONFIG.');
  }
}

function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('btn-tts');
  if (ttsEnabled) {
    btn.classList.add('tts-on'); btn.title='Speech output: ON ('+cfg.ttsProvider+')';
    const avail = checkTtsAvailable();
    if (!avail.ok) {
      showTtsSetupHelp(avail.reason);
    }
  } else {
    btn.classList.remove('tts-on','tts-speaking');
    btn.title='Speech output: OFF';
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (currentAudio) { try { currentAudio.pause(); currentAudio.src=''; } catch(e){} currentAudio = null; }
    isSpeaking = false;
  }
  updateProtocols();
}

async function ttsSpeak(text) {
  if (!ttsEnabled || !text) return;
  const btn = document.getElementById('btn-tts');

  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (currentAudio) { try { currentAudio.pause(); currentAudio.src=''; } catch(e){} currentAudio = null; }

  btn.classList.add('tts-speaking');
  isSpeaking = true;
  try {
    if (cfg.ttsProvider === 'web-speech') {
      await ttsSpeakWebSpeech(text);
    } else if (cfg.ttsProvider === 'piper') {
      const server = (cfg.bridgeServer || 'http://localhost:9191').replace(/\/+$/, '');
      await ttsSpeakHttp(text, server + '/tts');
    } else if (cfg.ttsProvider === 'custom') {
      if (!cfg.ttsEndpoint) throw new Error('No TTS endpoint configured');
      await ttsSpeakHttp(text, cfg.ttsEndpoint);
    } else {
      throw new Error('Unknown TTS provider: ' + cfg.ttsProvider);
    }
  } catch(e) {
    // [FIX] already surfaced — don't double-log
    addMessage('error', 'TTS error: ' + e.message);
  } finally {
    btn.classList.remove('tts-speaking');
    isSpeaking = false;
  }
}

function ttsSpeakWebSpeech(text) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) return reject(new Error('Speech synthesis not available in this browser'));
    var utter;
    try {
      utter = new SpeechSynthesisUtterance(text);
    } catch(e) {
      return reject(new Error('Speech synthesis unavailable — install speech-dispatcher: sudo apt install speech-dispatcher espeak-ng'));
    }
    utter.rate = 0.95; utter.pitch = 1; utter.volume = 1;
    var voices = [];
    try { voices = window.speechSynthesis.getVoices() || []; } catch(e) {}
    var preferred = voices.find(function(v) { return v.name.indexOf(cfg.ttsVoice) >= 0; })
      || voices.find(function(v) { return v.lang === 'en-US' && v.name.indexOf('Male') >= 0; })
      || voices.find(function(v) { return v.lang && v.lang.indexOf('en') === 0; });
    if (preferred) utter.voice = preferred;
    var resolved = false;
    utter.onend = function() { if (!resolved) { resolved = true; resolve(); } };
    utter.onerror = function(e) {
      if (resolved) return;
      resolved = true;
      var msg = e.error || 'unknown';
      if (msg === 'not-allowed' || msg === 'synthesis-failed' || msg === 'audio-busy') {
        reject(new Error('Web Speech failed (error: ' + msg + '). On Linux, install: sudo apt install speech-dispatcher espeak-ng. Or switch to Piper TTS in CONFIG.'));
      } else {
        reject(new Error('Speech synthesis error: ' + msg));
      }
    };
    setTimeout(function() {
      if (!resolved) { resolved = true; reject(new Error('Web Speech timed out — speech-dispatcher may be missing. Install: sudo apt install speech-dispatcher espeak-ng. Or use Piper TTS.')); }
    }, 5000);
    try {
      window.speechSynthesis.speak(utter);
    } catch(e) {
      if (!resolved) { resolved = true; reject(new Error('Speech synthesis failed to start: ' + e.message + '. Install: sudo apt install speech-dispatcher espeak-ng')); }
    }
  });
}

async function ttsSpeakHttp(text, url) {
  const controller = new AbortController();
  const timeoutSec = cfg.ttsTimeout || 60;
  const timeout = setTimeout(() => controller.abort(), timeoutSec * 1000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text}),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let detail = 'HTTP ' + res.status;
      try { const err = await res.json(); if (err.error) detail = err.error; } catch(e) {}
      throw new Error(detail);
    }
    const blob = await res.blob();
    if (blob.size === 0) throw new Error('Empty audio response');
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    currentAudio = audio;
    await audio.play();
    await new Promise(resolve => {
      audio.onended = () => { URL.revokeObjectURL(blobUrl); currentAudio = null; resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(blobUrl); currentAudio = null; resolve(); };
    });
  } catch(e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('TTS request timed out');
    if (e.name === 'TypeError') throw new Error('Cannot reach TTS endpoint — check bridge server is running');
    throw e;
  }
}

if (window.speechSynthesis) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices(); }

// ═══════════════════════════════════════════════
// STATUS & PROTOCOLS
// ═══════════════════════════════════════════════
function updateStatus() {
  document.getElementById('status-model').textContent = cfg.model || '--';
  document.getElementById('status-bridge').textContent = bridgeMode !== 'none' ? 'CONNECTED ['+bridgeMode+']' : '--';
  document.getElementById('status-bridge').style.color = bridgeMode !== 'none' ? 'var(--green)' : 'var(--grey)';
}
function updateProtocols() {
  var sttAvail = false;
  var sttStatus = 'N/A';
  if (cfg.sttProvider === 'web-speech') {
    sttAvail = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    sttStatus = sttAvail ? 'READY' : 'N/A (use Chrome)';
  } else if (cfg.sttProvider === 'custom' || cfg.sttProvider === 'whisper-cpp') {
    sttAvail = !!cfg.sttEndpoint;
    sttStatus = sttAvail ? 'READY' : 'SET URL';
  }
  var avail = checkTtsAvailable();
  var ttsAvail = avail.ok;
  var ttsStatus = 'N/A';
  if (cfg.ttsProvider === 'piper') {
    ttsStatus = ttsAvail ? (ttsEnabled ? 'ON' : 'OFF') : 'START BRIDGE';
  } else if (cfg.ttsProvider === 'custom') {
    ttsStatus = ttsAvail ? (ttsEnabled ? 'ON' : 'OFF') : 'SET URL';
  } else {
    ttsStatus = ttsAvail ? (ttsEnabled ? 'ON' : 'OFF') : 'N/A';
  }
  let ttsDotClass = 'dot grey';
  if (ttsAvail) ttsDotClass = ttsEnabled ? 'dot green' : 'dot green';
  else if (cfg.ttsProvider === 'piper' || cfg.ttsProvider === 'custom') ttsDotClass = 'dot red';

  // [FIX] if auto-reconnect is active, show amber pulsing dot for bridge
  if (bridgeReconnectActive) {
    document.getElementById('dot-bridge').className = 'dot amber';
    document.getElementById('proto-bridge').textContent = 'RECONNECTING';
  } else {
    document.getElementById('dot-bridge').className = bridgeMode !== 'none' ? 'dot green' : 'dot grey';
    document.getElementById('proto-bridge').textContent = bridgeMode !== 'none' ? 'ONLINE ['+bridgeMode+']' : '--';
  }

  document.getElementById('dot-stt').className = sttAvail?'dot green':'dot grey';
  document.getElementById('proto-stt').textContent = sttAvail?'READY':'N/A';
  document.getElementById('dot-llm').className = cfg.model?'dot green':'dot grey';
  document.getElementById('proto-llm').textContent = cfg.model?'READY':'CONFIGURE';
  document.getElementById('dot-tts').className = ttsDotClass;
  document.getElementById('proto-tts').textContent = ttsStatus;

  const micBtn=document.getElementById('btn-mic'), ttsBtn=document.getElementById('btn-tts');
  if(!sttAvail){
    micBtn.disabled=false;
    micBtn.title = cfg.sttProvider === 'web-speech' ? 'Web Speech not available in Firefox — use Custom (Vosk)' :
                   cfg.sttProvider === 'custom' ? 'Set STT endpoint in CONFIG' :
                   'Speech recognition unavailable';
  } else {
    micBtn.disabled=false;
    micBtn.title='Voice input ('+cfg.sttProvider+')';
  }
  ttsBtn.disabled = false;
  if (!ttsAvail) {
    ttsBtn.title = cfg.ttsProvider === 'piper' ? 'Click for Piper setup instructions' :
                  cfg.ttsProvider === 'custom' ? 'Click for setup instructions (set TTS endpoint in CONFIG)' :
                  'Speech synthesis unavailable — click for help';
  } else {
    ttsBtn.title = ttsEnabled ? 'Speech output: ON ('+cfg.ttsProvider+')' : 'Speech output: OFF ('+cfg.ttsProvider+')';
  }
}

// ═══════════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-US',{hour12:false})+' | '+now.toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'});
}
updateClock(); setInterval(updateClock, 1000);

// ═══════════════════════════════════════════════
// CONFIG PANEL
// ═══════════════════════════════════════════════
function toggleConfig() {
  const overlay = document.getElementById('config-overlay');
  overlay.classList.toggle('open');
  if (overlay.classList.contains('open')) populateConfigFields();
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════
// #9 — resume AudioContext on first user interaction (browser autoplay policy)
function _soundUnlock() {
  SOUND.resume();
  document.removeEventListener('click', _soundUnlock);
  document.removeEventListener('keydown', _soundUnlock);
}
document.addEventListener('click', _soundUnlock);
document.addEventListener('keydown', _soundUnlock);

document.addEventListener('keydown', (e) => {
  if (e.key==='Escape') {
    var closedSomething = false;
    var cfgO = document.getElementById('config-overlay');
    if (cfgO && cfgO.classList.contains('open')) { cfgO.classList.remove('open'); closedSomething = true; }
    var pd = document.getElementById('pinned-drawer'); if (pd) { pd.classList.remove('open'); closedSomething = true; }
    var mp = document.getElementById('memory-panel'); if (mp) { mp.classList.remove('open'); closedSomething = true; }
    document.getElementById('msg-input').blur();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
      closedSomething = true;
    }
  }
  if (e.key==='F11') { e.preventDefault(); toggleFullscreen(); }
  if ((e.ctrlKey||e.metaKey)&&e.key===',') { e.preventDefault(); toggleConfig(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='l') { e.preventDefault(); clearTerminal(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='Enter') { e.preventDefault(); sendMessage(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='b') { e.preventDefault(); runMorningBrief(); }
});
document.getElementById('msg-input').addEventListener('keydown', (e) => {
  if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(); }
});
document.getElementById('msg-input').addEventListener('input', function() {
  this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px';
});
document.getElementById('config-overlay').addEventListener('click', function(e) { if (e.target===this) toggleConfig(); });

// ═══════════════════════════════════════════════
// BOOT SCREEN — Cybertronian startup animation
// ═══════════════════════════════════════════════
function showBootScreen() {
  var bs = document.getElementById('boot-screen');
  if (!bs) return;
  var theme = THEMES[cfg.theme] || THEMES['ark'];
  // #9 Sound: theme-specific boot sound
  if (theme.bootSound && SOUND[theme.bootSound]) {
    try { SOUND[theme.bootSound](); } catch(e) {}
  }
  var lines = theme.bootLines;
  var lineEl = bs.querySelector('.boot-line');
  var progBar = bs.querySelector('.boot-progress-bar');
  var idx = 0;
  var interval = setInterval(function() {
    if (idx < lines.length) {
      lineEl.textContent = '> ' + lines[idx];
      idx++;
      if (progBar) progBar.style.width = (idx / lines.length * 100) + '%';
    } else {
      clearInterval(interval);
      setTimeout(function() {
        bs.classList.add('done');
        setTimeout(function() { if (bs.parentNode) bs.parentNode.removeChild(bs); }, 600);
      }, 250);
    }
  }, 250);
}

// Fullscreen toggle
function toggleFullscreen() {
  const btn = document.getElementById('btn-fs');
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      req.call(el).then(() => {
        if (btn) { btn.textContent = '⛶ EXIT FS'; btn.classList.add('on'); }
        addMessage('system', 'Fullscreen mode — KDE panel hidden. Press button again or Esc to exit.');
      }).catch(e => {
        addMessage('error', 'Fullscreen failed: ' + e.message + '. Try F11 in your browser.');
      });
    } else {
      addMessage('error', 'Fullscreen API not available. Try F11 in your browser.');
    }
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
    if (btn) { btn.textContent = '⛶ FULLSCREEN'; btn.classList.remove('on'); }
  }
}

document.addEventListener('fullscreenchange', updateFsButton);
document.addEventListener('webkitfullscreenchange', updateFsButton);
function updateFsButton() {
  const btn = document.getElementById('btn-fs');
  if (!btn) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    btn.textContent = '⛶ EXIT FS'; btn.classList.add('on');
  } else {
    btn.textContent = '⛶ FULLSCREEN'; btn.classList.remove('on');
  }
}

// ═══════════════════════════════════════════════
// INIT — [FIX] always sync config from bridge, not just when apikey missing
// ═══════════════════════════════════════════════
function init() {
  try {
    applyTheme(cfg.theme || 'ark');  // apply theme before boot screen shows
    showBootScreen();
    initCanvas();
    initRadar();
    syncSoundEnabled();
    populateConfigFields();
    updateStatus();
    updateProtocols();
    updateEnergonMeter();

    // Initialize current conversation
    if (conversations.length === 0) {
      const id = 'conv_' + Date.now();
      conversations.push({id, title:'New conversation', messages:[], createdAt:Date.now(), updatedAt:Date.now(), pinnedMsgs:[]});
      currentConvId = id;
      localStorage.setItem('teletraan-current-conv', id);
      conversationMessages = [];
    } else {
      if (!currentConvId || !conversations.find(c => c.id === currentConvId)) {
        currentConvId = conversations[0].id;
        localStorage.setItem('teletraan-current-conv', currentConvId);
      }
      const conv = getCurrentConversation();
      conversationMessages = conv ? conv.messages.slice(-40) : [];
    }

    const browserMsg = hasFSA()
      ? 'Browser: Chrome/Edge detected — bridge uses File System Access API.'
      : 'Browser: Firefox detected — bridge requires local server. Use CONFIG → SELECT to set up.';
    const bridgePath = localStorage.getItem('teletraan-bridge-path');
    if (bridgePath) document.getElementById('cfg-bridge-dir').value = bridgePath;

    addMessage('system','Teletraan-1 online. Agora bridge active.');
    addMessage('system','Provider: '+(cfg.provider||'custom')+' | Model: '+(cfg.model||'not set'));
    addMessage('system','Endpoint: '+cfg.endpoint+(cfg.thinkingEnabled?' [thinking:'+cfg.reasoningEffort+']':''));
    addMessage('system',browserMsg);
    addMessage('system','Tomogichi bridge: Use CONFIG → SELECT to connect.');
    addMessage('system','Type a message to begin, Ctrl+B for morning brief.');

    // [FIX] Always try to sync config from bridge disk on startup.
    // Old logic: only loaded from bridge if `!cfg.apikey && endpoint includes deepseek.com`.
    // Problem: if localStorage had `apikey:''` after LibreWolf clear, that satisfied `!cfg.apikey`
    // and we'd merge with disk (good) — but if localStorage had any other corrupted/empty field,
    // we'd never know. Also non-DeepSeek providers (OpenAI, custom) were never recovered.
    // New logic: ALWAYS call syncConfigWithBridge(). It pulls from disk any field that's empty
    // locally, and always pushes back. No conditions on provider/endpoint.
    syncConfigWithBridge().then(function(merged) {
      if (!merged) {
        if (!cfg.apikey) addMessage('system','WARNING: No API key set. Get one at platform.deepseek.com/api_keys');
      }
    });

    // [FIX] also try auto-connecting bridge on init — if start.sh already started bridge.py,
    // user shouldn't need to click SELECT manually every time
    if (!hasFSA()) {
      var serverUrl = cfg.bridgeServer || 'http://localhost:9191';
      fetch(serverUrl + '/ping', {method:'GET'}).then(function(res) {
        if (res.ok) {
          // Bridge is alive — connect silently
          tryConnectBridge(serverUrl);
        }
      }).catch(function() {
        // bridge not running yet — that's fine, user will start it via start.sh
      });
    }

    if (!cfg.model) addMessage('system','WARNING: No model configured. Set in CONFIG.');
    if (!hasFSA()) addMessage('system','Firefox: run "python3 bridge.py ~/.local/share/tomogichi-qt/" in a terminal first.');

    const ttsAvail = checkTtsAvailable();
    if (!ttsAvail.ok && cfg.ttsProvider === 'piper') {
      setTimeout(() => showTtsSetupHelp(ttsAvail.reason), 1500);
    }

    renderConversationList();

    if (conversationMessages.length > 0) {
      const conv = getCurrentConversation();
      addMessage('system','Restored '+conversationMessages.length+' messages from: '+((conv && conv.title) || 'conversation'));
      for (const m of conversationMessages) {
        if (m.role === 'user') addMessage('user', m.content, true);
        else if (m.role === 'assistant' && m.content) addMessage('ai', m.content, true);
      }
    }
  } catch(e) {
    document.body.innerHTML = '<div style="color:#e23e57;font-family:monospace;padding:20px;font-size:14px;">' +
      '<h2 style="color:#4dc9f6">TELETRAAN-1 INIT ERROR</h2>' +
      '<pre style="white-space:pre-wrap;color:#e23e57">' + e.message + '\n\nStack:\n' + (e.stack||'') + '</pre>' +
      '<p style="color:#95a5a6">Try: Clear localStorage (F12 → Storage → Clear), then reload.</p>' +
      '</div>';
    throw e;
  }
}

init();
