// ═══════════════════════════════════════════════════════════════════════
// Music sync — instant Discord + UI updates while "Listening to music"
// ═══════════════════════════════════════════════════════════════════════
const { createNowPlayingService, trackMetaSignature, getLiveProgress } = require('./now-playing');

const LISTENING_ACTIVITY_ID = 'listening';
const DISCORD_TEXT_LIMIT = 128;
const artworkCache = new Map();

function truncate(text, max = DISCORD_TEXT_LIMIT) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatClock(ms) {
  const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function isMusicSyncEnabled(config) {
  return config?.musicNowPlaying !== false;
}

function buildMusicTimestamps(track) {
  if (!track?.isPlaying || !track.durationMs) return null;
  const { progressMs, durationMs } = getLiveProgress(track);
  if (durationMs <= 0) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const progressSec = Math.floor(progressMs / 1000);
  const durationSec = Math.floor(durationMs / 1000);
  return {
    startTimestamp: nowSec - progressSec,
    endTimestamp: nowSec - progressSec + durationSec,
  };
}

function createMusicSync({
  getConfig,
  applyPresence,
  sendToRenderer,
  updateTrayMenu,
  isPaused,
}) {
  let service = null;
  let activityTemplate = null;
  let lastMetaSignature = '';
  let artworkRequestId = 0;
  let lastArtworkKey = '';

  async function fetchItunesArtwork(title, artist) {
    const cacheKey = `${title}\0${artist}`.toLowerCase();
    if (artworkCache.has(cacheKey)) return artworkCache.get(cacheKey);

    try {
      const term = encodeURIComponent([title, artist].filter(Boolean).join(' '));
      const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`);
      if (!res.ok) return null;
      const data = await res.json();
      const url = data?.results?.[0]?.artworkUrl100?.replace('100x100bb', '600x600bb') || null;
      artworkCache.set(cacheKey, url);
      return url;
    } catch {
      artworkCache.set(cacheKey, null);
      return null;
    }
  }

  function getArtworkCacheKey(track) {
    if (!track?.title) return '';
    return `${track.title}\0${track.artist || ''}`.toLowerCase();
  }

  function getCachedArtwork(track) {
    const key = getArtworkCacheKey(track);
    if (!key || !artworkCache.has(key)) return null;
    return artworkCache.get(key);
  }

  async function resolveArtwork(track, config) {
    if (config?.musicNowPlayingAlbumArt === false || !track?.title || !track.isPlaying) return null;
    if (track.artworkUrl) return track.artworkUrl;
    return fetchItunesArtwork(track.title, track.artist);
  }

  function buildPresenceActivity(track, artworkUrl) {
    const base = activityTemplate;
    if (!base) return null;

    if (!track?.title) {
      return {
        ...base,
        details: 'Listening to music',
        state: base.state || 'Shows your song 🎵',
        musicTrack: null,
        musicTimestamps: null,
      };
    }

    const artist = track.artist ? truncate(track.artist) : '';
    const album = track.album ? truncate(track.album) : '';
    const { progressMs, durationMs } = getLiveProgress(track);
    const timeLabel = durationMs > 0
      ? `${formatClock(progressMs)} / ${formatClock(durationMs)}`
      : formatClock(progressMs);

    let state;
    if (!track.isPlaying) {
      state = artist
        ? `Paused · ${timeLabel} · ${artist}`
        : `Paused · ${timeLabel}`;
    } else if (artist && album) {
      state = truncate(`${artist} — ${album} · ${timeLabel}`);
    } else if (artist) {
      state = truncate(`by ${artist} · ${timeLabel}`);
    } else {
      state = truncate(timeLabel);
    }

    const activity = {
      ...base,
      details: truncate(track.title),
      state,
      largeImageText: truncate(album || artist || track.title),
      musicTrack: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        device: track.device,
        isPlaying: track.isPlaying,
        progressMs,
        durationMs,
        updatedAt: track.updatedAt,
        artworkUrl: artworkUrl || track.artworkUrl || null,
      },
      musicTimestamps: buildMusicTimestamps(track),
    };

    if (artworkUrl) {
      activity.discordImageUrl = artworkUrl;
      activity.largeImageUrl = artworkUrl;
    }

    return activity;
  }

  async function pushPresence(track, artworkUrl) {
    const activity = buildPresenceActivity(track, artworkUrl);
    if (!activity) return;
    await applyPresence(activity);
    sendToRenderer?.(track, artworkUrl || getCachedArtwork(track));
    updateTrayMenu?.();
  }

  async function handleTrackUpdate(track) {
    if (!activityTemplate || isPaused?.()) return;

    const metaSig = trackMetaSignature(track);
    const metaChanged = metaSig !== lastMetaSignature;
    if (metaChanged) lastMetaSignature = metaSig;

    const config = getConfig();
    const cacheKey = getArtworkCacheKey(track);
    let artworkUrl = track?.artworkUrl || getCachedArtwork(track);

    if (metaChanged) {
      await pushPresence(track, artworkUrl);

      if (config?.musicNowPlayingAlbumArt === false || !track?.title || !track.isPlaying) return;
      if (artworkUrl) return;

      const requestId = ++artworkRequestId;
      lastArtworkKey = cacheKey;
      resolveArtwork(track, config).then((url) => {
        if (requestId !== artworkRequestId || !url) return;
        if (lastArtworkKey !== cacheKey) return;
        pushPresence(track, url).catch(() => {});
      }).catch(() => {});
      return;
    }

    sendToRenderer?.(track, artworkUrl);
  }

  function ensureRunning() {
    if (service) {
      service.stop().catch(() => {});
      service = null;
    }
    service = createNowPlayingService({
      onUpdate: handleTrackUpdate,
      pollIntervalMs: 500,
    });
    service.start().catch((err) => {
      console.warn('[music-sync] failed to start:', err.message);
    });
  }

  function start(templateActivity) {
    if (!templateActivity || templateActivity.id !== LISTENING_ACTIVITY_ID) {
      stop();
      return;
    }
    if (!isMusicSyncEnabled(getConfig())) {
      stop(false);
      activityTemplate = { ...templateActivity };
      return;
    }

    activityTemplate = {
      ...templateActivity,
      details: 'Listening to music',
      state: templateActivity.state || 'Shows your song 🎵',
    };
    lastMetaSignature = '';
    lastArtworkKey = '';
    ensureRunning();
  }

  function stop(resetTemplate = true) {
    if (service) {
      service.stop().catch(() => {});
      service = null;
    }
    lastMetaSignature = '';
    lastArtworkKey = '';
    artworkRequestId += 1;
    if (resetTemplate) activityTemplate = null;
    sendToRenderer?.(null, null);
  }

  function getTemplate() {
    return activityTemplate;
  }

  function getCurrentTrackLabel() {
    const track = activityTemplate?.musicTrack;
    if (!track?.title) return null;
    const { progressMs, durationMs } = getLiveProgress(track);
    const time = durationMs > 0
      ? `${formatClock(progressMs)} / ${formatClock(durationMs)}`
      : formatClock(progressMs);
    const base = track.artist ? `${track.title} — ${track.artist}` : track.title;
    return `${base} (${time})`;
  }

  return {
    LISTENING_ACTIVITY_ID,
    isMusicSyncEnabled,
    start,
    stop,
    getTemplate,
    getCurrentTrackLabel,
    handleConfigChange(enabled) {
      if (!activityTemplate) return;
      if (enabled) ensureRunning();
      else stop(false);
    },
  };
}

module.exports = { createMusicSync, LISTENING_ACTIVITY_ID, formatClock, getLiveProgress };
