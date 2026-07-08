// Foreground game detection — throttled for low-end PCs
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const MAC_JXA = path.join(__dirname, 'now-gaming-mac.jxa.js');
const POLL_MS = process.platform === 'darwin' ? 8000 : 5000;
const MAC_TIMEOUT_MS = 3500;
const MAC_BACKOFF_MAX_MS = 60000;

const IGNORED = new Set([
  'electron', 'smiley', 'discord', 'discordcanary', 'code', 'cursor', 'finder', 'explorer',
  'chrome', 'google chrome', 'firefox', 'safari', 'spotify', 'music', 'terminal', 'iterm2',
  'steam', 'epicgameslauncher', 'riot client', 'riotclientux', 'riot client ux',
]);

function humanize(v) {
  return String(v || '').replace(/\.(exe|app)$/i, '').replace(/[_-]+/g, ' ').trim();
}

function normalizeGame(raw) {
  if (!raw) return null;
  const processName = humanize(raw.processName);
  const key = processName.toLowerCase();
  if (!processName || IGNORED.has(key) || /smiley/i.test(processName)) return null;

  let title = String(raw.windowTitle || '').trim();
  if (!title || title.toLowerCase() === key) title = processName;
  title = title.replace(/\s*[-–|]\s*(Riot Client|VALORANT)$/i, '').trim() || processName;

  return { title, processName, windowTitle: raw.windowTitle || '', updatedAt: Date.now() };
}

function gameSig(g) {
  if (!g) return '';
  return [g.title, g.processName, g.windowTitle].join('\0');
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
    return normalizeGame({ processName, windowTitle });
  } catch { return null; }
}

async function pollLinux() {
  const script = `id=$(xdotool getactivewindow 2>/dev/null); [ -z "$id" ] && exit 0
title=$(xdotool getwindowname "$id" 2>/dev/null); pid=$(xdotool getwindowpid "$id" 2>/dev/null)
name=$(ps -p "$pid" -o comm= 2>/dev/null); printf '%s|%s' "$name" "$title"`;
  try {
    const { stdout } = await execFileAsync('bash', ['-lc', script], { timeout: 4000 });
    const [processName, windowTitle] = String(stdout || '').trim().split('|');
    return normalizeGame({ processName, windowTitle });
  } catch { return null; }
}

async function pollRawForeground() {
  if (process.platform === 'darwin') {
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
      return { processName, windowTitle: windowTitle || '' };
    } catch { return null; }
  }
  if (process.platform === 'linux') {
    const script = `id=$(xdotool getactivewindow 2>/dev/null); [ -z "$id" ] && exit 0
title=$(xdotool getwindowname "$id" 2>/dev/null); pid=$(xdotool getwindowpid "$id" 2>/dev/null)
name=$(ps -p "$pid" -o comm= 2>/dev/null); printf '%s|%s' "$name" "$title"`;
    try {
      const { stdout } = await execFileAsync('bash', ['-lc', script], { timeout: 4000 });
      const [processName, windowTitle] = String(stdout || '').trim().split('|');
      return { processName, windowTitle: windowTitle || '' };
    } catch { return null; }
  }
  return null;
}

async function pollForeground() {
  const raw = await pollRawForeground();
  if (raw === undefined) return undefined;
  return normalizeGame(raw);
}

function createNowGamingService({ onUpdate } = {}) {
  if (process.env.SMILEY_DISABLE_NOW_GAMING === '1') {
    return { async start() {}, async stop() {} };
  }

  let timer = null;
  let running = false;
  let lastSig = '';

  const emit = (game) => {
    const sig = gameSig(game);
    if (sig === lastSig) return;
    lastSig = sig;
    onUpdate?.(game);
  };

  const tick = async () => {
    if (!running) return;
    try {
      const game = await pollForeground();
      if (game !== undefined) emit(game);
    } catch (_) {}
    const delay = POLL_MS + (process.platform === 'darwin' ? macBackoff : 0);
    timer = setTimeout(tick, delay);
  };

  return {
    async start() {
      if (running) return;
      running = true;
      lastSig = '';
      const game = await pollForeground();
      if (game !== undefined) emit(game);
      timer = setTimeout(tick, POLL_MS);
    },
    async stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
      killMacChild();
      macFailures = 0;
      macBackoff = 0;
      lastSig = '';
    },
  };
}

module.exports = { createNowGamingService, pollForeground, pollRawForeground, normalizeGame, gameSig };
