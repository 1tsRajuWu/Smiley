// ═══════════════════════════════════════════════════════════════════════
// macOS MediaRemote stream — event-driven now playing (mediaremote-adapter)
// Same approach as Music Presence: perl + framework stream, not JXA polling.
// ═══════════════════════════════════════════════════════════════════════
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ADAPTER_DIRNAME = 'mediaremote-adapter';
const PERL_BIN = '/usr/bin/perl';
const STREAM_ARGS = ['stream', '--no-artwork'];
const TEST_TIMEOUT_MS = 8000;
const STREAM_RESTART_MS = 1500;

const BUNDLE_APP_NAMES = {
  'com.apple.Music': 'Music',
  'com.spotify.client': 'Spotify',
  'com.google.Chrome': 'Chrome',
  'company.thebrowser.Browser': 'Arc',
  'com.brave.Browser': 'Brave',
  'com.microsoft.edgemac': 'Edge',
  'com.apple.Safari': 'Safari',
  'com.tidal.desktop': 'TIDAL',
  'com.amazon.music': 'Amazon Music',
  'com.deezer.Deezer': 'Deezer',
};

function resolveAdapterPaths() {
  const candidates = [
    path.join(__dirname, ADAPTER_DIRNAME),
  ];
  if (process.resourcesPath) {
    candidates.unshift(path.join(process.resourcesPath, 'mediaremote-adapter'));
    candidates.unshift(path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'electron',
      ADAPTER_DIRNAME,
    ));
  }

  for (const dir of candidates) {
    const frameworkPath = path.join(dir, 'MediaRemoteAdapter.framework');
    const scriptPath = path.join(dir, 'mediaremote-adapter.pl');
    if (fs.existsSync(frameworkPath) && fs.existsSync(scriptPath)) {
      return {
        dir,
        frameworkPath: path.resolve(frameworkPath),
        scriptPath: path.resolve(scriptPath),
      };
    }
  }
  return null;
}

function bundleIdToAppName(bundleId) {
  const id = String(bundleId || '').trim();
  if (!id) return null;
  if (BUNDLE_APP_NAMES[id]) return BUNDLE_APP_NAMES[id];
  const tail = id.split('.').pop();
  return tail ? tail.replace(/([a-z])([A-Z])/g, '$1 $2') : id;
}

function applyDiffPayload(state, payload, diff) {
  if (!diff) return { ...(payload || {}) };
  const next = { ...state };
  for (const [key, value] of Object.entries(payload || {})) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}

function adapterStateToTrack(state) {
  if (!state || typeof state !== 'object') return null;
  const title = String(state.title || '').trim();
  if (!title) return null;

  const isPlaying = state.playing === true;
  const elapsedSec = Number(state.elapsedTime) || 0;
  const durationSec = Number(state.duration) || 0;
  const rate = Number(state.playbackRate) || (isPlaying ? 1 : 0);
  const timestamp = state.timestamp ? String(state.timestamp) : '';
  const progressMs = timestamp && isPlaying
    ? computeLiveProgressMs(elapsedSec, timestamp, rate)
    : Math.round(elapsedSec * 1000);

  return {
    title,
    artist: String(state.artist || '').trim(),
    album: String(state.album || '').trim(),
    isPlaying,
    device: bundleIdToAppName(state.bundleIdentifier),
    progressMs,
    durationMs: Math.round(durationSec * 1000),
    updatedAt: Date.now(),
    playbackRate: rate,
    timestamp,
    bundleIdentifier: state.bundleIdentifier || null,
  };
}

function computeLiveProgressMs(elapsedSec, timestampIso, rate) {
  const base = Math.round((Number(elapsedSec) || 0) * 1000);
  const ts = Date.parse(timestampIso);
  if (!Number.isFinite(ts)) return base;
  const age = Math.max(0, Date.now() - ts);
  return base + Math.round(age * (Number(rate) || 1));
}

async function testMediaRemoteAdapter(paths) {
  if (!paths) return false;
  try {
    const { stdout } = await execFileAsync(
      PERL_BIN,
      [paths.scriptPath, paths.frameworkPath, 'get', '--no-artwork'],
      { timeout: TEST_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    );
    return String(stdout || '').trim().length > 0;
  } catch {
    return false;
  }
}

function createMacMediaRemoteStream({ onUpdate, onFatal } = {}) {
  let paths = null;
  let child = null;
  let running = false;
  let restartTimer = null;
  let state = {};
  let buffer = '';
  let lastMetaSignature = '';
  let emitTimer = null;
  let pendingTrack = undefined;

  const clearEmitTimer = () => {
    if (emitTimer) {
      clearTimeout(emitTimer);
      emitTimer = null;
    }
  };

  const trackMetaSignature = (track) => {
    if (!track) return '';
    return [
      track.title,
      track.artist,
      track.album,
      track.isPlaying ? '1' : '0',
      track.device || '',
    ].join('\0');
  };

  const flushEmit = () => {
    emitTimer = null;
    if (pendingTrack === undefined) return;
    const track = pendingTrack;
    pendingTrack = undefined;
    onUpdate?.(track);
  };

  const scheduleEmit = (track) => {
    const metaSig = trackMetaSignature(track);
    const metaChanged = metaSig !== lastMetaSignature;
    if (metaChanged) {
      lastMetaSignature = metaSig;
      clearEmitTimer();
      pendingTrack = track;
      flushEmit();
      return;
    }
    pendingTrack = track;
    if (emitTimer) return;
    emitTimer = setTimeout(flushEmit, 400);
  };

  const clearRestart = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const killChild = () => {
    if (!child) return;
    try { child.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => {
      try { child?.kill('SIGKILL'); } catch (_) {}
    }, 400);
    child = null;
  };

  const emitState = () => {
    scheduleEmit(adapterStateToTrack(state));
  };

  const handleLine = (line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (msg?.type !== 'data' || !msg.payload || typeof msg.payload !== 'object') return;

    const hasTitle = Boolean(String(msg.payload.title || state.title || '').trim());
    state = applyDiffPayload(state, msg.payload, msg.diff !== false);
    if (!hasTitle && !String(state.title || '').trim()) {
      onUpdate?.(null);
      return;
    }
    emitState();
  };

  const scheduleRestart = () => {
    if (!running) return;
    clearRestart();
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!running) return;
      spawnStream();
    }, STREAM_RESTART_MS);
  };

  const spawnStream = () => {
    if (!running || !paths) return;
    killChild();
    buffer = '';

    const args = [paths.scriptPath, paths.frameworkPath, ...STREAM_ARGS];
    child = spawn(PERL_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        handleLine(line);
      }
      if (buffer.length > 65536) buffer = buffer.slice(-32768);
    });

    child.stderr.on('data', () => {});

    child.on('error', () => {
      child = null;
      scheduleRestart();
    });

    child.on('close', (code) => {
      child = null;
      if (!running) return;
      if (code !== 0 && code !== null) onFatal?.(new Error(`mediaremote stream exited (${code})`));
      scheduleRestart();
    });
  };

  return {
    async start() {
      if (process.platform !== 'darwin') return false;
      paths = resolveAdapterPaths();
      if (!paths) return false;
      const ok = await testMediaRemoteAdapter(paths);
      if (!ok) return false;

      running = true;
      state = {};
      spawnStream();
      return true;
    },
    async stop() {
      running = false;
      clearRestart();
      clearEmitTimer();
      pendingTrack = undefined;
      lastMetaSignature = '';
      killChild();
      state = {};
      paths = null;
      buffer = '';
    },
    isRunning() {
      return running;
    },
  };
}

module.exports = {
  resolveAdapterPaths,
  testMediaRemoteAdapter,
  createMacMediaRemoteStream,
  adapterStateToTrack,
  bundleIdToAppName,
};
