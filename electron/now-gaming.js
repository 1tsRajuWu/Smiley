// Game detection — foreground preferred, sticky when alt-tabbed (process still running)
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const MAC_JXA = path.join(__dirname, 'now-gaming-mac.jxa.js');
const POLL_MS = process.platform === 'darwin' ? 8000 : 5000;
const BACKGROUND_POLL_MS = process.platform === 'darwin' ? 20000 : 12000;
const MAC_TIMEOUT_MS = 3500;
const MAC_BACKOFF_MAX_MS = 60000;
const PROCESS_SCAN_TIMEOUT_MS = 4000;

/** Apps that must never clear gaming presence when focused. */
const IGNORED = new Set([
  'electron', 'smiley', 'discord', 'discordcanary', 'discordptb', 'code', 'cursor',
  'finder', 'explorer', 'chrome', 'google chrome', 'firefox', 'safari', 'edge',
  'microsoft edge', 'brave', 'arc', 'spotify', 'music', 'terminal', 'iterm2',
  'steam', 'steamwebhelper', 'epicgameslauncher', 'epic games launcher',
  'riot client', 'riotclientux', 'riot client ux', 'riotclientservices',
  'system settings', 'system preferences', 'dock', 'windowserver', 'loginwindow',
]);

/**
 * Known game processes — detected even when out of focus.
 * `title` is the Discord details fallback; Steam AppID aliases live in game-api.
 */
const KNOWN_GAMES = [
  { id: 'cs2', title: 'Counter-Strike 2', match: /^(cs2|csgo)$/i },
  { id: 'valorant', title: 'Valorant', match: /^valorant(-win64-shipping)?$/i },
  { id: 'lol', title: 'League of Legends', match: /^(league of legends|leagueclient|leagueclientux)$/i },
  { id: 'fortnite', title: 'Fortnite', match: /^fortnite(client-win64-shipping)?$/i },
  { id: 'overwatch', title: 'Overwatch 2', match: /^overwatch$/i },
  { id: 'roblox', title: 'Roblox', match: /^roblox(playerbeta)?$/i },
  { id: 'minecraft', title: 'Minecraft', match: /^minecraft(launcher|javaw)?$/i },
  { id: 'dota2', title: 'Dota 2', match: /^dota2$/i },
  { id: 'tf2', title: 'Team Fortress 2', match: /^(tf_win64|hl2)$/i },
  { id: 'gta5', title: 'Grand Theft Auto V', match: /^(gta5|gtav|playgtav)$/i },
  { id: 'apex', title: 'Apex Legends', match: /^(r5apex|r5apex_dx12)$/i },
  { id: 'pubg', title: 'PUBG', match: /^(tslgame|pubg)$/i },
  { id: 'rust', title: 'Rust', match: /^(rustclient|rust)$/i },
  { id: 'eldenring', title: 'ELDEN RING', match: /^eldenring$/i },
  { id: 'helldivers2', title: 'Helldivers 2', match: /^helldivers2$/i },
  { id: 'destiny2', title: 'Destiny 2', match: /^destiny2$/i },
  { id: 'warframe', title: 'Warframe', match: /^(warframe\.x64|warframe)$/i },
  { id: 'rocketleague', title: 'Rocket League', match: /^rocketleague$/i },
  { id: 'cyberpunk', title: 'Cyberpunk 2077', match: /^cyberpunk2077$/i },
  { id: 'valheim', title: 'Valheim', match: /^valheim$/i },
  { id: 'stardew', title: 'Stardew Valley', match: /^stardew ?valley|stardewvalley$/i },
  { id: 'amongus', title: 'Among Us', match: /^among.?us$/i },
  { id: 'hades', title: 'Hades', match: /^hades2?$/i },
  { id: 'terraria', title: 'Terraria', match: /^terraria$/i },
];

function humanize(v) {
  return String(v || '').replace(/\.(exe|app)$/i, '').replace(/[_-]+/g, ' ').trim();
}

function isIgnoredProcess(processName) {
  const key = humanize(processName).toLowerCase();
  if (!key) return true;
  if (IGNORED.has(key) || /smiley/i.test(key)) return true;
  // Browser / chat helpers
  if (/chrome|firefox|safari|discord|spotify|slack|zoom|teams/i.test(key) && !/counter-strike/i.test(key)) {
    if (IGNORED.has(key) || /helper|gpu|crashpad|renderer/i.test(key)) return true;
  }
  return false;
}

function matchKnownGame(processName) {
  const key = humanize(processName).toLowerCase().replace(/\s+/g, '');
  const spaced = humanize(processName).toLowerCase();
  for (const g of KNOWN_GAMES) {
    if (g.match.test(humanize(processName)) || g.match.test(key) || g.match.test(spaced)) {
      return g;
    }
  }
  // Loose includes for Compound names
  for (const g of KNOWN_GAMES) {
    if (g.id === 'cs2' && /\bcs2\b|counter.?strike/i.test(spaced)) return g;
    if (g.id === 'valorant' && /valorant/i.test(spaced)) return g;
    if (g.id === 'fortnite' && /fortnite/i.test(spaced)) return g;
    if (g.id === 'overwatch' && /overwatch/i.test(spaced)) return g;
    if (g.id === 'roblox' && /roblox/i.test(spaced)) return g;
    if (g.id === 'minecraft' && /minecraft/i.test(spaced)) return g;
  }
  return null;
}

function normalizeGame(raw) {
  if (!raw) return null;
  const processName = humanize(raw.processName);
  const key = processName.toLowerCase();
  if (!processName || isIgnoredProcess(processName)) return null;

  let title = String(raw.windowTitle || '').trim();
  if (!title || title.toLowerCase() === key) {
    const known = matchKnownGame(processName);
    title = known?.title || processName;
  }
  title = title.replace(/\s*[-–|]\s*(Riot Client|VALORANT)$/i, '').trim() || processName;

  const known = matchKnownGame(processName);
  return {
    title,
    processName,
    windowTitle: raw.windowTitle || '',
    knownGameId: known?.id || null,
    focused: raw.focused !== false,
    sticky: raw.sticky === true,
    updatedAt: Date.now(),
  };
}

function gameSig(g) {
  if (!g) return '';
  // Sticky vs focused with same process shouldn't thrash Discord presence.
  return [g.title, g.processName, g.knownGameId || ''].join('\0');
}

function processKey(g) {
  if (!g?.processName) return '';
  return String(g.processName).toLowerCase();
}

let macInFlight = false;
let macChild = null;
let macFailures = 0;
let macBackoff = 0;

function killMacChild() {
  if (!macChild) return;
  try { macChild.kill('SIGKILL'); } catch (_) {}
  macChild = null;
  macInFlight = false;
}

async function pollMac() {
  if (!fs.existsSync(MAC_JXA)) return null;
  if (macInFlight) return undefined;

  macInFlight = true;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      macInFlight = false;
      if (macChild) macChild = null;
      resolve(v);
    };

    const child = spawn('osascript', ['-l', 'JavaScript', MAC_JXA], { stdio: ['ignore', 'pipe', 'ignore'] });
    macChild = child;
    let out = '';
    child.stdout.on('data', (c) => { out += c; if (out.length > 65536) { killMacChild(); finish(null); } });
    child.on('error', () => { macFailures++; macBackoff = Math.min(MAC_BACKOFF_MAX_MS, macFailures * 5000); finish(null); });
    child.on('close', () => {
      macFailures = 0;
      macBackoff = 0;
      const line = out.trim();
      if (!line) { finish(null); return; }
      try { finish(normalizeGame(JSON.parse(line))); } catch { finish(null); }
    });
    setTimeout(() => { killMacChild(); macFailures++; macBackoff = Math.min(MAC_BACKOFF_MAX_MS, macFailures * 5000); finish(null); }, MAC_TIMEOUT_MS);
  });
}

async function pollWin() {
  const ps = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class W32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder t, int c);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
}
"@
$h=[W32]::GetForegroundWindow(); if($h -eq [IntPtr]::Zero){exit 0}
$t=New-Object System.Text.StringBuilder 512; [void][W32]::GetWindowText($h,$t,512)
$p=0; [void][W32]::GetWindowThreadProcessId($h,[ref]$p)
$proc=Get-Process -Id $p -EA SilentlyContinue; if(!$proc){exit 0}
Write-Output ($proc.ProcessName+'|'+$t.ToString())
`;
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], { timeout: 8000 });
    const [processName, windowTitle] = String(stdout || '').trim().split('|');
    return normalizeGame({ processName, windowTitle, focused: true });
  } catch { return null; }
}

async function pollLinux() {
  const script = `id=$(xdotool getactivewindow 2>/dev/null); [ -z "$id" ] && exit 0
title=$(xdotool getwindowname "$id" 2>/dev/null); pid=$(xdotool getwindowpid "$id" 2>/dev/null)
name=$(ps -p "$pid" -o comm= 2>/dev/null); printf '%s|%s' "$name" "$title"`;
  try {
    const { stdout } = await execFileAsync('bash', ['-lc', script], { timeout: 4000 });
    const [processName, windowTitle] = String(stdout || '').trim().split('|');
    return normalizeGame({ processName, windowTitle, focused: true });
  } catch { return null; }
}

/** Fast mac frontmost app — no Accessibility TCC required. */
async function pollMacLsAppInfo() {
  try {
    const { stdout: asnOut } = await execFileAsync('lsappinfo', ['front'], { timeout: 1500 });
    const asn = String(asnOut || '').trim();
    if (!asn) return null;
    const { stdout: infoOut } = await execFileAsync(
      'lsappinfo',
      ['info', '-only', 'name,bundleid', asn],
      { timeout: 1500 },
    );
    const info = String(infoOut || '');
    const nameMatch = info.match(/"?LSDisplayName"?\s*=\s*"([^"]*)"/i);
    const bundleMatch = info.match(/"?CFBundleIdentifier"?\s*=\s*"([^"]*)"/i);
    const processName = (nameMatch?.[1] || '').trim();
    const bundleId = (bundleMatch?.[1] || '').trim();
    if (!processName && !bundleId) return null;
    return { processName: processName || bundleId, bundleId, windowTitle: '', focused: true };
  } catch {
    return null;
  }
}

async function pollMacJxaRaw() {
  if (!fs.existsSync(MAC_JXA)) return null;
  if (macInFlight) return undefined;
  macInFlight = true;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      macInFlight = false;
      if (macChild) macChild = null;
      resolve(v);
    };
    const child = spawn('osascript', ['-l', 'JavaScript', MAC_JXA], { stdio: ['ignore', 'pipe', 'ignore'] });
    macChild = child;
    let out = '';
    child.stdout.on('data', (c) => { out += c; if (out.length > 65536) { killMacChild(); finish(null); } });
    child.on('error', () => { macFailures++; macBackoff = Math.min(MAC_BACKOFF_MAX_MS, macFailures * 5000); finish(null); });
    child.on('close', () => {
      macFailures = 0;
      macBackoff = 0;
      const line = out.trim();
      if (!line) { finish(null); return; }
      try { finish(JSON.parse(line)); } catch { finish(null); }
    });
    setTimeout(() => { killMacChild(); macFailures++; macBackoff = Math.min(MAC_BACKOFF_MAX_MS, macFailures * 5000); finish(null); }, MAC_TIMEOUT_MS);
  });
}

async function pollRawForeground() {
  if (process.platform === 'darwin') {
    const ls = await pollMacLsAppInfo();
    if (ls?.processName) {
      const jxa = await pollMacJxaRaw();
      if (jxa && jxa !== undefined) {
        const sameApp = (!jxa.bundleId || !ls.bundleId || jxa.bundleId === ls.bundleId)
          || (jxa.processName && ls.processName
            && String(jxa.processName).toLowerCase() === String(ls.processName).toLowerCase());
        if (sameApp && jxa.windowTitle) {
          return {
            ...ls,
            windowTitle: jxa.windowTitle,
            processName: jxa.processName || ls.processName,
            focused: true,
          };
        }
        if (/^(smiley|electron)$/i.test(ls.processName)
          && jxa.processName
          && !/^(smiley|electron)$/i.test(jxa.processName)) {
          return { ...jxa, focused: true };
        }
      }
      return ls;
    }
    const jxa = await pollMacJxaRaw();
    return jxa ? { ...jxa, focused: true } : jxa;
  }
  if (process.platform === 'win32') {
    const ps = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class W32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder t, int c);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
}
"@
$h=[W32]::GetForegroundWindow(); if($h -eq [IntPtr]::Zero){exit 0}
$t=New-Object System.Text.StringBuilder 512; [void][W32]::GetWindowText($h,$t,512)
$p=0; [void][W32]::GetWindowThreadProcessId($h,[ref]$p)
$proc=Get-Process -Id $p -EA SilentlyContinue; if(!$proc){exit 0}
Write-Output ($proc.ProcessName+'|'+$t.ToString())
`;
    try {
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], { timeout: 8000 });
      const [processName, windowTitle] = String(stdout || '').trim().split('|');
      return { processName, windowTitle: windowTitle || '', focused: true };
    } catch { return null; }
  }
  if (process.platform === 'linux') {
    const script = `id=$(xdotool getactivewindow 2>/dev/null); [ -z "$id" ] && exit 0
title=$(xdotool getwindowname "$id" 2>/dev/null); pid=$(xdotool getwindowpid "$id" 2>/dev/null)
name=$(ps -p "$pid" -o comm= 2>/dev/null); printf '%s|%s' "$name" "$title"`;
    try {
      const { stdout } = await execFileAsync('bash', ['-lc', script], { timeout: 4000 });
      const [processName, windowTitle] = String(stdout || '').trim().split('|');
      return { processName, windowTitle: windowTitle || '', focused: true };
    } catch { return null; }
  }
  return null;
}

/**
 * Lightweight running-process name list (no window titles).
 * Used only when foreground is Discord/Chrome/etc.
 */
async function listRunningProcessNames() {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const { stdout } = await execFileAsync(
        'ps',
        ['-A', '-o', 'comm='],
        { timeout: PROCESS_SCAN_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
      );
      return String(stdout || '')
        .split('\n')
        .map((l) => path.basename(l.trim()))
        .filter(Boolean);
    }
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-Command', '(Get-Process -EA SilentlyContinue | Select-Object -ExpandProperty ProcessName) -join "`n"'],
        { timeout: PROCESS_SCAN_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
      );
      return String(stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}

function findKnownGamesInProcessList(names) {
  const hits = [];
  const seen = new Set();
  for (const name of names) {
    const known = matchKnownGame(name);
    if (!known || seen.has(known.id)) continue;
    // Skip League Client alone if we already prefer VALORANT shipping — keep all unique ids
    seen.add(known.id);
    hits.push({
      processName: humanize(name),
      known,
      title: known.title,
      windowTitle: '',
    });
  }
  return hits;
}

/**
 * Pick sticky game when focus is on Discord/browser.
 * Prefer previously sticky process if still running; else sole known game; else null (keep caller sticky).
 */
function pickStickyGame(runningHits, preferredProcessKey) {
  if (!runningHits.length) return null;
  if (preferredProcessKey) {
    const pref = runningHits.find((h) => processKey(h) === preferredProcessKey
      || h.known?.id && preferredProcessKey.includes(h.known.id));
    if (pref) {
      return normalizeGame({
        processName: pref.processName,
        windowTitle: pref.windowTitle,
        focused: false,
        sticky: true,
      });
    }
  }
  if (runningHits.length === 1) {
    const only = runningHits[0];
    return normalizeGame({
      processName: only.processName,
      windowTitle: only.windowTitle,
      focused: false,
      sticky: true,
    });
  }
  // Multiple games + no preference: don't guess — caller keeps last sticky if still valid
  return null;
}

async function pollForeground() {
  const raw = await pollRawForeground();
  if (raw === undefined) return undefined;
  return normalizeGame(raw);
}

/**
 * Resolve the active game for presence:
 * 1. Focused known / normalizeable game wins.
 * 2. If focus is ignored (Discord/Chrome), stick to last game while its process runs.
 * 3. If no last game, adopt the sole running known game.
 * 4. Switching games: focusing a different known game switches immediately.
 */
async function resolveActiveGame(lastGame = null) {
  const fg = await pollForeground();
  if (fg === undefined) return undefined; // mac poll in-flight

  if (fg) {
    // Focused game (or any non-ignored app treated as game candidate)
    return { ...fg, focused: true, sticky: false };
  }

  // Foreground is Discord / Chrome / Steam overlay / etc. — keep gaming presence.
  const names = await listRunningProcessNames();
  const hits = findKnownGamesInProcessList(names);

  if (lastGame?.processName) {
    const stillThere = names.some((n) => {
      const h = humanize(n).toLowerCase();
      const last = processKey(lastGame);
      if (h === last) return true;
      if (lastGame.knownGameId && matchKnownGame(n)?.id === lastGame.knownGameId) return true;
      return false;
    });
    if (stillThere) {
      return {
        ...lastGame,
        focused: false,
        sticky: true,
        updatedAt: Date.now(),
      };
    }
  }

  const picked = pickStickyGame(hits, processKey(lastGame));
  return picked;
}

function createNowGamingService({ onUpdate } = {}) {
  if (process.env.SMILEY_DISABLE_NOW_GAMING === '1') {
    return { async start() {}, async stop() {}, setBackgroundMode() {} };
  }

  let timer = null;
  let running = false;
  let lastSig = '';
  let lastGame = null;
  let backgroundMode = false;

  const pollDelay = () =>
    (backgroundMode ? BACKGROUND_POLL_MS : POLL_MS) + (process.platform === 'darwin' ? macBackoff : 0);

  const emit = (game) => {
    const sig = gameSig(game);
    if (sig === lastSig) return;
    lastSig = sig;
    lastGame = game;
    onUpdate?.(game);
  };

  const tick = async () => {
    if (!running) return;
    try {
      const game = await resolveActiveGame(lastGame);
      if (game !== undefined) emit(game);
    } catch (_) {}
    timer = setTimeout(tick, pollDelay());
  };

  return {
    async start() {
      if (running) return;
      running = true;
      lastSig = '';
      lastGame = null;
      const game = await resolveActiveGame(null);
      if (game !== undefined) emit(game);
      timer = setTimeout(tick, pollDelay());
    },
    async stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
      killMacChild();
      macFailures = 0;
      macBackoff = 0;
      lastSig = '';
      lastGame = null;
    },
    setBackgroundMode(background) {
      backgroundMode = background === true;
    },
  };
}

module.exports = {
  createNowGamingService,
  pollForeground,
  pollRawForeground,
  normalizeGame,
  gameSig,
  resolveActiveGame,
  matchKnownGame,
  isIgnoredProcess,
  listRunningProcessNames,
  findKnownGamesInProcessList,
  pickStickyGame,
  KNOWN_GAMES,
  IGNORED,
};
