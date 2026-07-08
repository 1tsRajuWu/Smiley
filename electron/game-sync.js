// Game sync — live Discord + UI while Gaming activity selected (performance-tuned)
const { createNowGamingService } = require('./now-gaming');
const {
  resolveLiveGameSession, sessionSignature, buildStateLine, getRiotPollMs,
} = require('./game-providers');

const GAMING_CATEGORY = 'gaming';
const DISCORD_TEXT_LIMIT = 128;
const PRESENCE_MIN_MS = 5000;
const PRESENCE_MATCH_MS = 3000;
const RENDERER_MIN_MS = 1500;

function truncate(t, max = DISCORD_TEXT_LIMIT) {
  const v = String(t || '').trim();
  return v.length <= max ? v : `${v.slice(0, max - 1)}…`;
}

function isEnabled(cfg) {
  return cfg?.gamingNowPlaying !== false;
}

function createGameSync({ getConfig, applyGamePresence, sendToRenderer, isPaused }) {
  let fgService = null;
  let liveTimer = null;
  let template = null;
  let foreground = null;
  let lastSig = '';
  let lastSteamKey = '';
  let lastPresenceAt = 0;
  let lastRendererAt = 0;
  let presenceInFlight = false;
  let pendingPresence = null;
  let presenceTimer = null;
  let resolveInFlight = false;
  let pendingResolve = false;
  let lastCoverKey = '';

  function sendRenderer(session) {
    const now = Date.now();
    if (session && now - lastRendererAt < RENDERER_MIN_MS) return;
    lastRendererAt = now;
    sendToRenderer?.(session);
  }

  function buildActivity(session, meta) {
    if (!template) return null;
    if (!session?.title) {
      return { ...template, details: 'Gaming', state: template.state || 'In the zone', gameSession: null };
    }
    const state = truncate(buildStateLine(session, template.state));
    const coverKey = `${session.title}\0${session.artworkUrl || ''}`;
    const useCover = getConfig()?.gamingNowPlayingCoverArt !== false && session.artworkUrl;
    const coverChanged = coverKey !== lastCoverKey;

    const activity = {
      ...template,
      details: truncate(session.title),
      state,
      largeImageText: truncate(session.map || session.agent || session.mode || session.title),
      gameSession: {
        title: session.title,
        processName: session.processName,
        windowTitle: session.windowTitle,
        launcher: session.launcher,
        scoreHint: session.scoreHint,
        map: session.map,
        mode: session.mode,
        agent: session.agent,
        champ: session.champ,
        kda: session.kda,
        server: session.server,
        liveLine: session.liveLine || state,
        provider: session.provider,
        inMatch: session.inMatch === true,
        artworkUrl: session.artworkUrl || null,
        tags: session.tags || meta?.tags || [],
        metascore: session.metascore || meta?.metascore || null,
        steamAppId: session.steamAppId || meta?.steamAppId || null,
        updatedAt: session.updatedAt || Date.now(),
      },
    };

    if (useCover && (coverChanged || !activity.discordImageUrl)) {
      activity.discordImageUrl = session.artworkUrl;
      activity.largeImageUrl = session.artworkUrl;
      lastCoverKey = coverKey;
    }

    return activity;
  }

  async function pushPresence(session, meta, { force = false } = {}) {
    const sig = sessionSignature(session);
    if (!force && sig === lastSig) return;
    const activity = buildActivity(session, meta);
    if (!activity) return;

    const minMs = session?.inMatch ? PRESENCE_MATCH_MS : PRESENCE_MIN_MS;
    const now = Date.now();
    const wait = force ? 0 : Math.max(0, minMs - (now - lastPresenceAt));

    const run = async () => {
      if (presenceInFlight) {
        pendingPresence = { session, meta, force: true };
        return;
      }
      presenceInFlight = true;
      try {
        await applyGamePresence(activity);
        lastSig = sig;
        lastPresenceAt = Date.now();
        sendRenderer(activity.gameSession);
      } finally {
        presenceInFlight = false;
        if (pendingPresence) {
          const p = pendingPresence;
          pendingPresence = null;
          pushPresence(p.session, p.meta, { force: p.force }).catch(() => {});
        }
      }
    };

    if (presenceTimer) { clearTimeout(presenceTimer); presenceTimer = null; }
    if (wait === 0) {
      await run();
    } else {
      pendingPresence = { session, meta, force };
      presenceTimer = setTimeout(() => {
        presenceTimer = null;
        const p = pendingPresence;
        pendingPresence = null;
        if (p) run().catch(() => {});
      }, wait);
    }
  }

  async function refresh({ force = false } = {}) {
    if (!template || isPaused?.()) return;
    if (resolveInFlight) { pendingResolve = true; return; }
    resolveInFlight = true;
    try {
      const { session, steamKey } = await resolveLiveGameSession(foreground, { lastSteamKey });
      if (steamKey) lastSteamKey = steamKey;
      const sig = sessionSignature(session);
      if (!force && sig === lastSig) return;
      if (!session) {
        sendRenderer(null);
        return;
      }
      let meta = null;
      await pushPresence(session, meta, { force: force || session.inMatch });
    } finally {
      resolveInFlight = false;
      if (pendingResolve) {
        pendingResolve = false;
        refresh().catch(() => {});
      }
    }
  }

  function scheduleLivePoll(session) {
    if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
    if (!template) return;
    const delay = getRiotPollMs(session);
    liveTimer = setTimeout(() => {
      liveTimer = null;
      refresh().finally(() => {
        if (template) scheduleLivePoll(foreground);
      });
    }, delay);
  }

  function onForeground(game) {
    foreground = game;
    refresh().then(() => scheduleLivePoll(game)).catch(() => scheduleLivePoll(game));
  }

  async function ensureRunning() {
    if (fgService) return;
    fgService = createNowGamingService({ onUpdate: onForeground });
    await fgService.start();
    await refresh({ force: true });
    scheduleLivePoll(null);
  }

  function start(act) {
    if (!act || act.category !== GAMING_CATEGORY) { stop(); return; }
    if (!isEnabled(getConfig())) {
      stop(false);
      template = { ...act, details: 'Gaming', state: act.state || 'In the zone' };
      return;
    }
    template = { ...act, details: 'Gaming', state: act.state || 'In the zone' };
    lastSig = '';
    lastSteamKey = '';
    lastCoverKey = '';
    foreground = null;
    ensureRunning().catch(() => {});
  }

  function stop(reset = true) {
    if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
    if (presenceTimer) { clearTimeout(presenceTimer); presenceTimer = null; }
    pendingPresence = null;
    pendingResolve = false;
    if (fgService) {
      const s = fgService;
      fgService = null;
      s.stop().catch(() => {});
    }
    lastSig = '';
    lastSteamKey = '';
    lastCoverKey = '';
    foreground = null;
    if (reset) template = null;
    sendRenderer(null);
  }

  return {
    GAMING_CATEGORY,
    isEnabled,
    start,
    stop,
    getTemplate: () => template,
    handleConfigChange(enabled) {
      if (!template) return;
      if (enabled) ensureRunning().catch(() => {});
      else stop(false);
    },
  };
}

module.exports = { createGameSync, GAMING_CATEGORY };
