// ═══════════════════════════════════════════════════════════════════════
// Music sync — updates Discord presence while "Listening to music" is active
// ═══════════════════════════════════════════════════════════════════════
const { createNowPlayingService, trackSignature } = require('./now-playing');

const LISTENING_ACTIVITY_ID = 'listening';
const DISCORD_TEXT_LIMIT = 128;
const artworkCache = new Map();

function truncate(text, max = DISCORD_TEXT_LIMIT) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function isMusicSyncEnabled(config) {
  return config?.musicNowPlaying !== false;
}

function createMusicSync({
  getConfig,
  schedulePresenceUpdate,
  sendToRenderer,
  updateTrayMenu,
  isPaused,
}) {
  let service = null;
  let activityTemplate = null;
  let lastTrackSignature = '';
  let artworkRequestId = 0;

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

  async function resolveArtwork(track, config) {
    if (config?.musicNowPlayingAlbumArt === false || !track?.title || !track.isPlaying) return null;
    if (track.artworkUrl) return track.artworkUrl;
    if (!track.title) return null;
    return fetchItunesArtwork(track.title, track.artist);
  }

  function buildPresenceActivity(track, artworkUrl) {
    const base = activityTemplate;
    if (!base) return null;

    if (!track?.title) {
      return {
        ...base,
        details: 'Listening to music',
        state: base.state || 'Vibing 🎧',
        musicTrack: null,
      };
    }

    const artist = track.artist ? truncate(track.artist) : '';
    const album = track.album ? truncate(track.album) : '';
    let state;
    if (!track.isPlaying) {
      state = artist ? `Paused · ${artist}` : 'Paused';
    } else {
      state = artist
        ? (album ? `${artist} — ${album}` : `by ${artist}`)
        : (base.state || 'Vibing 🎧');
    }

    const activity = {
      ...base,
      details: truncate(track.title),
      state: truncate(state),
      largeImageText: album || artist || base.largeImageText || 'Music',
      musicTrack: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        device: track.device,
        isPlaying: track.isPlaying,
      },
    };

    if (artworkUrl) {
      activity.discordImageUrl = artworkUrl;
      activity.largeImageUrl = artworkUrl;
    }

    return activity;
  }

  async function handleTrackUpdate(track) {
    if (!activityTemplate || isPaused?.()) return;

    const signature = trackSignature(track);
    if (signature === lastTrackSignature) return;
    lastTrackSignature = signature;

    const config = getConfig();
    const requestId = ++artworkRequestId;
    const artworkUrl = await resolveArtwork(track, config);
    if (requestId !== artworkRequestId) return;

    const activity = buildPresenceActivity(track, artworkUrl);
    if (!activity) return;

    await schedulePresenceUpdate(activity, false);
    sendToRenderer?.(track);
    updateTrayMenu?.();
  }

  function ensureRunning() {
    if (service) return;
    service = createNowPlayingService({ onUpdate: handleTrackUpdate, pollIntervalMs: 3000 });
    service.start().catch(() => {});
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
      state: templateActivity.state || 'Vibing 🎧',
    };
    lastTrackSignature = '';
    ensureRunning();
  }

  function stop(resetTemplate = true) {
    if (service) {
      service.stop().catch(() => {});
      service = null;
    }
    lastTrackSignature = '';
    artworkRequestId += 1;
    if (resetTemplate) activityTemplate = null;
    sendToRenderer?.(null);
  }

  function getTemplate() {
    return activityTemplate;
  }

  function getCurrentTrackLabel() {
    const track = activityTemplate?.musicTrack;
    if (!track?.title) return null;
    return track.artist ? `${track.title} — ${track.artist}` : track.title;
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

module.exports = { createMusicSync, LISTENING_ACTIVITY_ID };
