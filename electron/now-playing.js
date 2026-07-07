// ═══════════════════════════════════════════════════════════════════════
// Now playing — system media detection (Spotify, Apple Music, YT Music, …)
// macOS: lightweight JXA poll (MediaRemote). Avoids rapid osascript / AppleScript.
// ═══════════════════════════════════════════════════════════════════════
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const MAC_JXA_FILENAME = 'now-playing-mac.jxa.js';

function resolveMacJxaScriptPath() {
  const candidates = [
    path.join(__dirname, MAC_JXA_FILENAME),
  ];
  if (process.resourcesPath) {
    candidates.unshift(path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'electron',
      MAC_JXA_FILENAME,
    ));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const MAC_JXA_SCRIPT = resolveMacJxaScriptPath();

/** macOS: each osascript spawn loads MediaRemote — low frequency avoids system freezes. */
const DEFAULT_POLL_MS = process.platform === 'darwin' ? 15000 : 3000;
const MIN_POLL_MS = process.platform === 'darwin' ? 12000 : 1500;
const MAC_OSASCRIPT_TIMEOUT_MS = 3500;
const MAC_POLL_BACKOFF_MAX_MS = 60000;

const NATIVE_PACKAGES = {
  win32: [
    'node-nowplaying-win32-x64-msvc',
    'node-nowplaying-win32-arm64-msvc',
  ],
  linux: [
    'node-nowplaying-linux-x64-gnu',
    'node-nowplaying-linux-arm64-gnu',
    'node-nowplaying-linux-x64-musl',
    'node-nowplaying-linux-arm64-musl',
  ],
};

function tryLoadBinding(candidatePath) {
  if (!candidatePath || !fs.existsSync(candidatePath)) return null;
  try {
    const binding = require(candidatePath);
    if (binding?.NowPlaying) return binding.NowPlaying;
  } catch (_) {}
  return null;
}

function loadNativeNowPlaying() {
  if (process.platform === 'darwin') return null;

  const candidates = [];
  const bundledDir = path.join(__dirname, 'native');
  if (fs.existsSync(bundledDir)) {
    for (const file of fs.readdirSync(bundledDir)) {
      if (file.endsWith('.node')) candidates.push(path.join(bundledDir, file));
    }
  }

  const packages = NATIVE_PACKAGES[process.platform] || [];
  for (const pkgName of packages) {
    try {
      const pkgJson = require.resolve(`${pkgName}/package.json`);
      const dir = path.dirname(pkgJson);
      const nodeFile = fs.readdirSync(dir).find((f) => f.endsWith('.node'));
      if (nodeFile) candidates.push(path.join(dir, nodeFile));
    } catch (_) {}
  }

  for (const candidate of candidates) {
    const loaded = tryLoadBinding(candidate);
    if (loaded) return loaded;
  }
  return null;
}

function normalizeArtist(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ').trim();
  if (typeof value === 'string') return value.trim();
  return '';
}

function normalizeTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = String(raw.title || raw.trackName || raw.name || '').trim();
  const artist = normalizeArtist(raw.artist || raw.artists);
  const album = String(raw.album || '').trim();
  const isPlaying = raw.isPlaying !== false
    && raw.status !== 'Paused'
    && raw.playerState !== 'Paused';
  const device = String(raw.device || raw.source || raw.app || '').trim() || null;
  let artworkUrl = null;

  const thumb = raw.thumbnail || raw.artworkUrl || raw.artwork;
  if (typeof thumb === 'string' && /^https?:\/\//i.test(thumb)) {
    artworkUrl = thumb;
  }
  if (!artworkUrl && typeof raw.url === 'string' && /^https?:\/\//i.test(raw.url)) {
    artworkUrl = raw.url;
  }

  if (!title && !artist) return null;

  const elapsedSec = Number(raw.elapsedSeconds ?? raw.elapsed ?? 0);
  const durationSec = Number(raw.durationSeconds ?? raw.duration ?? 0);
  let progressMs = Number(raw.progressMs || raw.trackProgress) || 0;
  let durationMs = Number(raw.durationMs || raw.trackDuration) || 0;
  if (!progressMs && elapsedSec > 0) progressMs = Math.round(elapsedSec * 1000);
  if (!durationMs && durationSec > 0) durationMs = Math.round(durationSec * 1000);

  return {
    title: title || 'Unknown track',
    artist,
    album,
    isPlaying,
    device,
    artworkUrl,
    progressMs,
    durationMs,
    updatedAt: Date.now(),
    playbackRate: Number(raw.playbackRate) || (isPlaying ? 1 : 0),
  };
}

function getLiveProgress(track) {
  if (!track) return { progressMs: 0, durationMs: 0 };
  const durationMs = Math.max(0, Number(track.durationMs) || 0);
  const base = Math.max(0, Number(track.progressMs) || 0);
  if (!track.isPlaying) return { progressMs: base, durationMs };
  const age = Math.max(0, Date.now() - (Number(track.updatedAt) || Date.now()));
  const rate = Number(track.playbackRate) || 1;
  return {
    progressMs: durationMs > 0
      ? Math.min(durationMs, base + Math.round(age * rate))
      : base + Math.round(age * rate),
    durationMs,
  };
}

function trackSignature(track) {
  if (!track) return '';
  return [
    track.title,
    track.artist,
    track.album,
    track.isPlaying ? '1' : '0',
    track.device || '',
    Math.floor((track.progressMs || 0) / 1000),
  ].join('\0');
}

function trackMetaSignature(track) {
  if (!track) return '';
  return [
    track.title,
    track.artist,
    track.album,
    track.isPlaying ? '1' : '0',
    track.device || '',
  ].join('\0');
}

let macPollInFlight = false;
let macPollChild = null;
let macPollFailures = 0;
let macPollBackoffMs = 0;
let macJxaScriptSource = null;

function readMacJxaScriptSource() {
  if (macJxaScriptSource) return macJxaScriptSource;
  for (const candidate of [
    MAC_JXA_SCRIPT,
    path.join(__dirname, MAC_JXA_FILENAME),
  ]) {
    try {
      if (fs.existsSync(candidate)) {
        macJxaScriptSource = fs.readFileSync(candidate, 'utf8');
        return macJxaScriptSource;
      }
    } catch (_) {}
  }
  return null;
}

function macPollDelayMs(baseMs) {
  if (process.platform !== 'darwin') return baseMs;
  return baseMs + macPollBackoffMs;
}

function noteMacPollResult(track) {
  if (process.platform !== 'darwin') return;
  if (track === undefined) {
    macPollFailures = Math.min(macPollFailures + 1, 12);
    macPollBackoffMs = Math.min(MAC_POLL_BACKOFF_MAX_MS, macPollFailures * 5000);
    return;
  }
  macPollFailures = 0;
  macPollBackoffMs = 0;
}

function killMacPollChild() {
  if (!macPollChild) return;
  try {
    macPollChild.kill('SIGKILL');
  } catch (_) {}
  macPollChild = null;
  macPollInFlight = false;
}

function runMacOsascript({ args, stdin, timeoutMs = MAC_OSASCRIPT_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const child = spawn('osascript', args, {
      stdio: [stdin ? 'pipe' : 'ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 65536) {
        try { child.kill('SIGKILL'); } catch (_) {}
        finish(null);
      }
    });

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) {}
      finish(null);
    }, timeoutMs);

    child.on('error', () => {
      clearTimeout(timer);
      finish(null);
    });

    child.on('close', () => {
      clearTimeout(timer);
      finish(String(stdout || '').trim() || null);
    });

    if (stdin) {
      child.stdin.on('error', () => {});
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

function pollMacJXA() {
  const script = readMacJxaScriptSource();
  if (!script) return Promise.resolve(null);
  if (macPollInFlight) return Promise.resolve(undefined);

  macPollInFlight = true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      macPollInFlight = false;
      if (macPollChild === child) macPollChild = null;
      resolve(value);
    };

    const child = spawn('osascript', ['-l', 'JavaScript', '-'], {
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    });
    macPollChild = child;

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 65536) {
        killMacPollChild();
        finish(null);
      }
    });

    const timer = setTimeout(() => {
      killMacPollChild();
      finish(null);
    }, MAC_OSASCRIPT_TIMEOUT_MS);

    child.on('error', () => {
      clearTimeout(timer);
      finish(null);
    });

    child.on('close', () => {
      clearTimeout(timer);
      const line = String(stdout || '').trim();
      if (!line) {
        finish(null);
        return;
      }
      try {
        finish(normalizeTrack(JSON.parse(line)));
      } catch {
        finish(null);
      }
    });

    child.stdin.on('error', () => {});
    child.stdin.write(script);
    child.stdin.end();
  });
}

const MAC_APPLESCRIPT_POLL = `
on run
  set delim to "|"
  try
    if application "Music" is running then
      tell application "Music"
        set ps to player state as string
        if ps is in {"playing", "paused"} then
          set t to current track
          set elapsed to player position
          set dur to duration of t
          return (name of t) & delim & (artist of t) & delim & (album of t) & delim & "Music" & delim & ps & delim & elapsed & delim & dur
        end if
      end tell
    end if
  end try
  try
    if application "Spotify" is running then
      tell application "Spotify"
        set ps to player state as string
        if ps is in {"playing", "paused"} then
          set t to current track
          return (name of t) & delim & (artist of t) & delim & (album of t) & delim & "Spotify" & delim & ps & delim & "0" & delim & "0"
        end if
      end tell
    end if
  end try
  return ""
end run
`;

async function pollMacAppleScript() {
  const line = await runMacOsascript({
    args: ['-e', MAC_APPLESCRIPT_POLL],
    timeoutMs: MAC_OSASCRIPT_TIMEOUT_MS,
  });
  if (!line) return null;
  const parts = String(line).split('|');
  const [title, artist, album, device, status, elapsed, duration] = parts;
  if (!title) return null;
  const elapsedSec = Number(elapsed) || 0;
  const durationSec = Number(duration) || 0;
  return normalizeTrack({
    title,
    artist,
    album,
    device,
    isPlaying: status === 'playing',
    elapsedSeconds: elapsedSec,
    durationSeconds: durationSec,
    playbackRate: status === 'playing' ? 1 : 0,
  });
}

async function pollMacNowPlaying() {
  const jxaTrack = await pollMacJXA();
  if (jxaTrack === undefined) return undefined;
  if (jxaTrack?.title) return jxaTrack;
  const fallback = await pollMacAppleScript();
  return fallback;
}

let linuxPollInFlight = false;
let winPollInFlight = false;

async function pollLinuxPlayerctl() {
  if (linuxPollInFlight) return undefined;
  linuxPollInFlight = true;
  try {
    const script = "playerctl -s metadata --format '{{playerName}}|{{status}}|{{title}}|{{artist}}|{{album}}' 2>/dev/null | head -1";
    const { stdout } = await execFileAsync('bash', ['-lc', script], { timeout: 4000 });
    const line = String(stdout || '').trim();
    if (!line) return null;
    const [device, status, title, artist, album] = line.split('|');
    if (!title) return null;
    return normalizeTrack({
      title,
      artist,
      album,
      device,
      isPlaying: status === 'Playing',
    });
  } catch {
    return null;
  } finally {
    linuxPollInFlight = false;
  }
}

async function pollWindowsMedia() {
  if (winPollInFlight) return undefined;
  winPollInFlight = true;
  try {
    const ps = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$session = $manager.GetCurrentSession()
if ($null -eq $session) { exit 0 }
$props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.MediaProperties.MusicDisplayProperties])
$playback = $session.GetPlaybackInfo()
$status = [string]$playback.PlaybackStatus
$app = $session.SourceAppUserModelId
Write-Output ($app + '|' + $status + '|' + $props.Title + '|' + $props.Artist + '|' + $props.AlbumTitle)
`;
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { timeout: 8000, windowsHide: true },
    );
    const line = String(stdout || '').trim();
    if (!line) return null;
    const [device, status, title, artist, album] = line.split('|');
    if (!title) return null;
    return normalizeTrack({
      title,
      artist,
      album,
      device,
      isPlaying: status === 'Playing',
    });
  } catch {
    return null;
  } finally {
    winPollInFlight = false;
  }
}

async function pollCurrentTrack() {
  if (process.platform === 'darwin') return pollMacNowPlaying();
  if (process.platform === 'linux') return pollLinuxPlayerctl();
  if (process.platform === 'win32') return pollWindowsMedia();
  return null;
}

function createNowPlayingService({ onUpdate, pollIntervalMs = DEFAULT_POLL_MS } = {}) {
  if (process.env.SMILEY_DISABLE_NOW_PLAYING === '1') {
    return {
      isNative: false,
      async start() {},
      async stop() {},
    };
  }

  const NativeNowPlaying = loadNativeNowPlaying();
  let nativePlayer = null;
  let pollTimer = null;
  let lastMetaSignature = '';
  let running = false;
  const pollEveryMs = Math.max(MIN_POLL_MS, pollIntervalMs || DEFAULT_POLL_MS);

  const emit = (raw) => {
    if (raw === undefined) return;
    const track = raw && typeof raw === 'object' ? normalizeTrack(raw) : null;
    const metaSig = trackMetaSignature(track);
    const metaChanged = metaSig !== lastMetaSignature;
    if (metaChanged) lastMetaSignature = metaSig;
    onUpdate?.(track);
  };

  const scheduleNextPoll = () => {
    if (!running) return;
    pollTimer = setTimeout(async () => {
      pollTimer = null;
      if (!running) return;
      try {
        const track = await pollCurrentTrack();
        noteMacPollResult(track);
        if (track !== undefined) emit(track);
      } catch (err) {
        noteMacPollResult(undefined);
        if (process.env.SMILEY_DEV) console.warn('[now-playing] poll failed:', err.message);
      }
      scheduleNextPoll();
    }, macPollDelayMs(pollEveryMs));
  };

  const startPolling = async () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    try {
      const track = await pollCurrentTrack();
      if (track !== undefined) emit(track);
    } catch (_) {}
    scheduleNextPoll();
  };

  return {
    isNative: !!NativeNowPlaying,
    async start() {
      if (running) return;
      running = true;
      lastMetaSignature = '';

      if (NativeNowPlaying) {
        try {
          nativePlayer = new NativeNowPlaying((event) => emit(event));
          await nativePlayer.subscribe();
          // Native events push track changes — avoid stacking a poll loop on top.
          return;
        } catch (err) {
          nativePlayer = null;
          console.warn('[now-playing] native subscribe failed, using polling:', err.message);
        }
      }

      await startPolling();
    },
    async stop() {
      running = false;
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      killMacPollChild();
      macPollFailures = 0;
      macPollBackoffMs = 0;
      if (nativePlayer) {
        try {
          await nativePlayer.unsubscribe();
        } catch (_) {}
        nativePlayer = null;
      }
      lastMetaSignature = '';
    },
  };
}

module.exports = {
  createNowPlayingService,
  normalizeTrack,
  trackSignature,
  trackMetaSignature,
  getLiveProgress,
  loadNativeNowPlaying,
  pollCurrentTrack,
  DEFAULT_POLL_MS,
};
