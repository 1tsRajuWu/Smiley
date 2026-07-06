// ═══════════════════════════════════════════════════════════════════════
// Now playing — system media detection (Spotify, Apple Music, YT Music, …)
// Uses platform-native bindings when available; shell fallbacks otherwise.
// ═══════════════════════════════════════════════════════════════════════
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const NATIVE_PACKAGES = {
  darwin: ['node-nowplaying-darwin-universal'],
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

function loadNativeNowPlaying() {
  const packages = NATIVE_PACKAGES[process.platform];
  if (!packages) return null;

  for (const pkgName of packages) {
    try {
      const pkgJson = require.resolve(`${pkgName}/package.json`);
      const dir = path.dirname(pkgJson);
      const nodeFile = fs.readdirSync(dir).find((f) => f.endsWith('.node'));
      if (!nodeFile) continue;
      const binding = require(path.join(dir, nodeFile));
      if (binding?.NowPlaying) return binding.NowPlaying;
    } catch (_) {}
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
  const isPlaying = raw.isPlaying !== false && raw.status !== 'Paused' && raw.playerState !== 'Paused';
  const device = String(raw.device || raw.source || raw.app || '').trim() || null;
  let artworkUrl = null;

  const thumb = raw.thumbnail || raw.artworkUrl || raw.artwork;
  if (typeof thumb === 'string') {
    if (thumb.startsWith('https://') || thumb.startsWith('http://')) {
      artworkUrl = thumb;
    }
  }
  if (!artworkUrl && typeof raw.url === 'string' && /^https?:\/\//i.test(raw.url)) {
    artworkUrl = raw.url;
  }

  if (!title && !artist) return null;

  return {
    title: title || 'Unknown track',
    artist,
    album,
    isPlaying,
    device,
    artworkUrl,
    progressMs: Number(raw.trackProgress || raw.progressMs) || 0,
    durationMs: Number(raw.trackDuration || raw.durationMs) || 0,
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
  ].join('\0');
}

async function pollMacAppleScript() {
  const script = `
    set output to ""
    try
      tell application "System Events"
        set spotifyRunning to exists (processes where name is "Spotify")
        set musicRunning to exists (processes where name is "Music")
      end tell
      if spotifyRunning then
        tell application "Spotify"
          if player state is playing then
            set t to current track
            set output to "Spotify|" & name of t & "|" & artist of t & "|" & album of t & "|playing"
          end if
        end tell
      end if
      if output is "" and musicRunning then
        tell application "Music"
          if player state is playing then
            set t to current track
            set output to "Music|" & name of t & "|" & artist of t & "|" & album of t & "|playing"
          end if
        end tell
      end if
    end try
    return output
  `;

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 4000 });
    const line = String(stdout || '').trim();
    if (!line) return null;
    const [source, title, artist, album, status] = line.split('|');
    return normalizeTrack({
      title,
      artist,
      album,
      source,
      device: source,
      isPlaying: status === 'playing',
    });
  } catch {
    return null;
  }
}

async function pollLinuxPlayerctl() {
  const script = `playerctl -s metadata --format '{{playerName}}|{{status}}|{{title}}|{{artist}}|{{album}}' 2>/dev/null | head -1`;
  try {
    const { stdout } = await execFileAsync('bash', ['-lc', script], { timeout: 4000 });
    const line = String(stdout || '').trim();
    if (!line) return null;
    const [device, status, title, artist, album] = line.split('|');
    if (status !== 'Playing') return null;
    return normalizeTrack({ title, artist, album, device, isPlaying: true });
  } catch {
    return null;
  }
}

async function pollWindowsMedia() {
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
if ($playback.PlaybackStatus -ne 'Playing') { exit 0 }
$app = $session.SourceAppUserModelId
Write-Output ($app + '|' + $props.Title + '|' + $props.Artist + '|' + $props.AlbumTitle)
`;
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { timeout: 8000, windowsHide: true },
    );
    const line = String(stdout || '').trim();
    if (!line) return null;
    const [device, title, artist, album] = line.split('|');
    return normalizeTrack({ title, artist, album, device, isPlaying: true });
  } catch {
    return null;
  }
}

async function pollFallbackTrack() {
  if (process.platform === 'darwin') return pollMacAppleScript();
  if (process.platform === 'linux') return pollLinuxPlayerctl();
  if (process.platform === 'win32') return pollWindowsMedia();
  return null;
}

function createNowPlayingService({ onUpdate, pollIntervalMs = 3000 } = {}) {
  const NativeNowPlaying = loadNativeNowPlaying();
  let nativePlayer = null;
  let pollTimer = null;
  let lastSignature = '';
  let running = false;

  const emit = (raw) => {
    const track = normalizeTrack(raw);
    const sig = trackSignature(track);
    if (sig === lastSignature) return;
    lastSignature = sig;
    onUpdate?.(track);
  };

  const pollOnce = async () => {
    if (!running) return;
    try {
      const track = await pollFallbackTrack();
      emit(track);
    } catch (_) {}
  };

  return {
    isNative: !!NativeNowPlaying,
    async start() {
      if (running) return;
      running = true;
      lastSignature = '';

      if (NativeNowPlaying) {
        try {
          nativePlayer = new NativeNowPlaying((event) => emit(event));
          await nativePlayer.subscribe();
          return;
        } catch (err) {
          nativePlayer = null;
          if (process.env.SMILEY_DEV) console.warn('[now-playing] native subscribe failed:', err.message);
        }
      }

      await pollOnce();
      pollTimer = setInterval(pollOnce, pollIntervalMs);
    },
    async stop() {
      running = false;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (nativePlayer) {
        try {
          await nativePlayer.unsubscribe();
        } catch (_) {}
        nativePlayer = null;
      }
      lastSignature = '';
    },
  };
}

module.exports = {
  createNowPlayingService,
  normalizeTrack,
  trackSignature,
};
