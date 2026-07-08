// ═══════════════════════════════════════════════════════════════════════
// Music sync — instant Discord + UI updates while "Listening to music"
// ═══════════════════════════════════════════════════════════════════════
const {
  createNowPlayingService,
  trackMetaSignature,
  pollCurrentTrack,
  DEFAULT_POLL_MS,
} = require('./now-playing');

const LISTENING_ACTIVITY_ID = 'listening';
const DISCORD_TEXT_LIMIT = 128;
/** UI progress refresh — meta changes are always immediate. */
const RENDERER_PROGRESS_MIN_MS = 2000;
/** Skip identical Discord RPC payloads within this window. */
const PRESENCE_DEDUP_MS = 2500;
/** Progress-only Discord updates (same song) — keep RPC light. */
const PRESENCE_PROGRESS_MIN_MS = 8000;
const artworkCache = new Map();

function truncate(text, max = DISCORD_TEXT_LIMIT) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function isMusicSyncEnabled(config) {
  return config?.musicNowPlaying !== false;
}

function presenceSignature(activity) {
  if (!activity) return '';
  const track = activity.musicTrack;
  if (!track?.title) return `${activity.details}\0${activity.state}`;
  return [
    track.title,
    track.artist,
    track.album,
    track.isPlaying ? '1' : '0',
    track.device || '',
    activity.discordImageUrl || activity.largeImageUrl || '',
  ].join('\0');
}

function createMusicSync({
  getConfig,
  applyMusicPresence,
  sendToRenderer,
  onTrackObserved,
  isPaused,
}) {
  let service = null;
  let activityTemplate = null;
  let lastMetaSignature = '';
  let artworkRequestId = 0;
  let lastRendererPushAt = 0;
  let lastTrack = null;
  let presenceSeq = 0;
  let lastPresenceSig = '';
  let lastPresencePushAt = 0;
  let uiActive = true;
  let backgroundMode = false;

  function sendRendererUpdate(track, artworkUrl, { force = false, progressOnly = false } = {}) {
    const now = Date.now();
    if (!track) {
      lastTrack = null;
      lastRendererPushAt = now;
      if (uiActive) sendToRenderer?.(null, null);
      return;
    }
    lastTrack = track;
    if (!uiActive && !force) return;
    if (!force) {
      if (progressOnly && now - lastRendererPushAt < RENDERER_PROGRESS_MIN_MS) return;
      if (!progressOnly && now - lastRendererPushAt < 80) return;
    }
    lastRendererPushAt = now;
    sendToRenderer?.(track, artworkUrl || getCachedArtwork(track));
  }

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
      };
    }

    const artist = track.artist ? truncate(track.artist) : '';
    const album = track.album ? truncate(track.album) : '';

    let state;
    if (!track.isPlaying) {
      state = artist ? `Paused · ${artist}` : 'Paused';
    } else if (artist && album) {
      state = truncate(`${artist} — ${album}`);
    } else if (artist) {
      state = truncate(`by ${artist}`);
    } else {
      state = base.state || 'Shows your song 🎵';
    }

    const activity = {
      ...base,
      id: LISTENING_ACTIVITY_ID,
      details: truncate(track.title),
      state,
      largeImageText: truncate(album || artist || track.title),
      musicTrack: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        device: track.device,
        isPlaying: track.isPlaying,
        progressMs: track.progressMs,
        durationMs: track.durationMs,
        updatedAt: track.updatedAt,
        artworkUrl: artworkUrl || track.artworkUrl || null,
      },
    };

    if (artworkUrl) {
      activity.discordImageUrl = artworkUrl;
      activity.largeImageUrl = artworkUrl;
    }

    return activity;
  }

  function pushPresence(track, artworkUrl, { progressOnly = false } = {}) {
    const activity = buildPresenceActivity(track, artworkUrl);
    if (!activity) return;
    const now = Date.now();
    const sig = presenceSignature(activity);
    if (sig === lastPresenceSig && now - lastPresencePushAt < PRESENCE_DEDUP_MS) return;
    if (progressOnly && now - lastPresencePushAt < PRESENCE_PROGRESS_MIN_MS) return;
    lastPresenceSig = sig;
    lastPresencePushAt = now;
    const seq = ++presenceSeq;
    applyMusicPresence(activity).catch(() => {});
    return seq;
  }

  async function handleTrackUpdate(track) {
    if (!activityTemplate || isPaused?.()) return;

    const metaSig = trackMetaSignature(track);
    const metaChanged = metaSig !== lastMetaSignature;
    if (metaChanged) lastMetaSignature = metaSig;
    if (metaChanged) onTrackObserved?.(track || null);

    const config = getConfig();
    const artworkUrl = track?.artworkUrl || getCachedArtwork(track);

    sendRendererUpdate(track, artworkUrl, { force: metaChanged, progressOnly: !metaChanged });

    if (!metaChanged) {
      pushPresence(track, artworkUrl || null, { progressOnly: true });
      return;
    }

    // Text/details update immediately — never wait for artwork or in-flight RPC.
    pushPresence(track, artworkUrl || null);

    if (config?.musicNowPlayingAlbumArt === false || !track?.title || !track.isPlaying) return;
    if (artworkUrl) return;

    const requestId = ++artworkRequestId;
    const metaAtRequest = metaSig;
    resolveArtwork(track, config).then((url) => {
      if (requestId !== artworkRequestId || !url) return;
      if (trackMetaSignature(track) !== metaAtRequest) return;
      pushPresence(track, url);
    }).catch(() => {});
  }

  let stoppingPromise = null;

  async function ensureRunning() {
    if (service) return;
    if (stoppingPromise) {
      try { await stoppingPromise; } catch (_) {}
    }
    if (service) return;
    const next = createNowPlayingService({
      onUpdate: handleTrackUpdate,
      pollIntervalMs: DEFAULT_POLL_MS,
    });
    service = next;
    try {
      await next.start();
    } catch (err) {
      if (service === next) service = null;
      console.warn('[music-sync] failed to start:', err.message);
    }
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

    const templateOnlyUpdate = activityTemplate?.id === LISTENING_ACTIVITY_ID;
    activityTemplate = {
      ...templateActivity,
      details: 'Listening to music',
      state: templateActivity.state || 'Shows your song 🎵',
    };
    if (!templateOnlyUpdate) {
      lastMetaSignature = '';
    } else if (lastTrack?.title) {
      pushPresence(lastTrack, getCachedArtwork(lastTrack) || lastTrack.artworkUrl || null);
    }
    ensureRunning()
      .then(async () => {
        try {
          const track = await pollCurrentTrack();
          if (track !== undefined) await handleTrackUpdate(track);
        } catch (_) {}
      })
      .catch(() => {});
  }

  function stop(resetTemplate = true) {
    const active = service;
    service = null;
    presenceSeq += 1;
    if (active) {
      stoppingPromise = active.stop().catch(() => {}).finally(() => {
        if (stoppingPromise) stoppingPromise = null;
      });
    }
    lastMetaSignature = '';
    lastTrack = null;
    artworkRequestId += 1;
    if (resetTemplate) activityTemplate = null;
    sendRendererUpdate(null, null);
  }

  function getTemplate() {
    return activityTemplate;
  }

  function getCurrentTrackLabel() {
    const track = lastTrack || activityTemplate?.musicTrack;
    if (!track?.title) return null;
    return track.artist ? `${track.title} — ${track.artist}` : track.title;
  }

  function getCurrentTrack() {
    return lastTrack;
  }

  return {
    LISTENING_ACTIVITY_ID,
    isMusicSyncEnabled,
    start,
    stop,
    getTemplate,
    getCurrentTrack,
    getCurrentTrackLabel,
    setUiActive(active) {
      const next = active !== false;
      if (uiActive === next) return;
      uiActive = next;
      if (uiActive && lastTrack) {
        sendRendererUpdate(lastTrack, getCachedArtwork(lastTrack) || lastTrack.artworkUrl || null, { force: true });
      }
    },
    setBackgroundMode(background) {
      const next = background === true;
      if (backgroundMode === next) return;
      backgroundMode = next;
      service?.setBackgroundMode?.(next);
    },
    handleConfigChange(enabled) {
      if (!activityTemplate) return;
      if (enabled) ensureRunning().catch(() => {});
      else stop(false);
    },
  };
}

module.exports = { createMusicSync, LISTENING_ACTIVITY_ID };
