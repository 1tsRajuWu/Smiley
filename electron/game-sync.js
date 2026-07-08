// Game sync — live Discord + UI while Gaming activity selected (performance-tuned)
const { createNowGamingService } = require('./now-gaming');
const {
  resolveLiveGameSession, sessionSignature, getRiotPollMs,
} = require('./game-providers');
const { buildPresenceFromSession } = require('./presence-builder');

const GAMING_CATEGORY = 'gaming';
const PRESENCE_MIN_MS = 5000;
const PRESENCE_MATCH_MS = 3000;
const RENDERER_MIN_MS = 1500;

function isEnabled(cfg) {
  return cfg?.gamingNowPlaying !== false;
}

function createGameSync({ getConfig, applyGamePresence, sendToRenderer, onSessionObserved, isPaused }) {
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
  let lastArtworkKey = '';
  let lastResolvedSession = null;
  let matchStartAt = null;

  function sendRenderer(session) {
    const now = Date.now();
    if (session && now - lastRendererAt < RENDERER_MIN_MS) return;
    lastRendererAt = now;
    sendToRenderer?.(session);
  }

  function buildActivity(session, meta) {
    const cfg = getConfig() || {};
    const useCover = cfg.gamingNowPlayingCoverArt !== false;
    const presenceOpts = cfg.gamingPresenceOptions;
    if (session?.inMatch && !session.matchStartAt && matchStartAt) {
      session = { ...session, matchStartAt };
    }
    const activity = buildPresenceFromSession(session, template, {
      alwaysUseArtwork: true,
      gamingPresenceOptions: presenceOpts,
    });
    if (!activity) return null;

    if (activity.gameSession && meta) {
      if (!activity.gameSession.tags?.length && meta.tags) {
        activity.gameSession.tags = meta.tags;
      }
      if (!activity.gameSession.metascore && meta.metascore) {
        activity.gameSession.metascore = meta.metascore;
      }
      if (!activity.gameSession.steamAppId && meta.steamAppId) {
        activity.gameSession.steamAppId = meta.steamAppId;
      }
    }

    // UI preview may respect cover-art toggle; Discord presence always uses artwork
    const artworkKey = activity.discordImageUrl || '';
    if (!useCover && activity.gameSession) {
      activity.gameSession.artworkUrl = null;
    } else if (useCover && artworkKey !== lastArtworkKey && activity.gameSession) {
      activity.gameSession.artworkUrl = artworkKey;
      lastArtworkKey = artworkKey;
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
      const resolved = await resolveLiveGameSession(foreground, {
        lastSteamKey,
        getConfig,
        fetchRank: getConfig()?.fetchValorantRank,
      });
      let session = resolved.session;
      if (resolved.steamKey) lastSteamKey = resolved.steamKey;
      const sig = sessionSignature(session);
      if (!force && sig === lastSig) return;
      if (!session?.title) {
        matchStartAt = null;
        sendRenderer(null);
        lastResolvedSession = null;
        if (lastSig) {
          lastSig = '';
          await pushPresence(null, null, { force: true });
        }
        scheduleLivePoll(null);
        return;
      }
      if (session.inMatch && !matchStartAt) matchStartAt = Date.now();
      if (!session.inMatch) matchStartAt = null;
      if (session.inMatch && matchStartAt) {
        session = { ...session, matchStartAt };
      }
      lastResolvedSession = session;
      onSessionObserved?.(session);
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
        if (template) scheduleLivePoll(lastResolvedSession);
      });
    }, delay);
  }

  function onForeground(game) {
    foreground = game;
    refresh().then(() => scheduleLivePoll(lastResolvedSession)).catch(() => scheduleLivePoll(lastResolvedSession));
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
    lastArtworkKey = '';
    foreground = null;
    // Static gaming template immediately so Discord isn't blank while waiting for a game.
    pushPresence(null, null, { force: true }).catch(() => {});
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
    lastArtworkKey = '';
    matchStartAt = null;
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
    forceRefresh() {
      if (!template) return;
      lastSig = '';
      lastArtworkKey = '';
      refresh({ force: true }).catch(() => {});
    },
  };
}

module.exports = { createGameSync, GAMING_CATEGORY };
