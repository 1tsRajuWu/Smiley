// Coding sync — live Discord + UI while "Coding" activity is selected
const { createNowCodingService, codingSig } = require('./now-coding');

const CODING_ACTIVITY_ID = 'coding';
const DISCORD_TEXT_LIMIT = 128;
const PRESENCE_MIN_MS = 4000;
const RENDERER_MIN_MS = 1200;

function truncate(text, max = DISCORD_TEXT_LIMIT) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function isEnabled(cfg) {
  return cfg?.codingNowPlaying !== false;
}

function buildPresenceFromSession(session, template) {
  const fallbackState = template?.state || 'Building something cool';
  if (!session?.appName) {
    return {
      details: template?.details || 'Coding',
      state: fallbackState,
      codingSession: null,
    };
  }

  return {
    details: truncate(session.appName),
    state: truncate(session.liveLine || fallbackState),
    codingSession: session,
  };
}

function createCodingSync({ getConfig, applyCodingPresence, sendToRenderer, onSessionObserved, isPaused }) {
  let fgService = null;
  let template = null;
  let foreground = null;
  let lastSig = '';
  let lastPresenceAt = 0;
  let lastRendererAt = 0;
  let presenceInFlight = false;
  let pendingPresence = null;
  let presenceTimer = null;
  let presenceTimerToken = 0;

  function sendRenderer(session) {
    const now = Date.now();
    if (session && now - lastRendererAt < RENDERER_MIN_MS) return;
    lastRendererAt = now;
    sendToRenderer?.(session);
  }

  async function pushPresence(session, { force = false } = {}) {
    const sig = codingSig(session);
    if (!force && sig === lastSig) return;
    const now = Date.now();
    const wait = force ? 0 : Math.max(0, PRESENCE_MIN_MS - (now - lastPresenceAt));
    const run = async (nextSession, nextSig) => {
      // Do not gate on fgService — presence must apply immediately on activity select.
      if (!template || isPaused?.()) return;
      const built = buildPresenceFromSession(nextSession, template);
      const activity = {
        ...template,
        details: built.details,
        state: built.state,
        codingSession: built.codingSession,
      };
      if (presenceInFlight) {
        pendingPresence = { session: nextSession, force: true };
        return;
      }
      presenceInFlight = true;
      try {
        await applyCodingPresence(activity);
        lastSig = nextSig;
        lastPresenceAt = Date.now();
        sendRenderer(nextSession);
      } finally {
        presenceInFlight = false;
        if (pendingPresence) {
          const next = pendingPresence;
          pendingPresence = null;
          pushPresence(next.session, { force: next.force }).catch(() => {});
        }
      }
    };

    if (wait === 0) {
      if (presenceTimer) {
        clearTimeout(presenceTimer);
        presenceTimer = null;
      }
      await run(session, sig);
      return;
    }

    if (presenceTimer) clearTimeout(presenceTimer);
    pendingPresence = { session, force };
    const token = ++presenceTimerToken;
    presenceTimer = setTimeout(() => {
      presenceTimer = null;
      // Drop outdated/stale scheduled writes (e.g. user switched activity/cleared).
      if (token !== presenceTimerToken) return;
      // If sync is no longer active, avoid pushing stale presence.
      if (!template || !isEnabled(getConfig()) || isPaused?.()) return;
      const next = pendingPresence;
      pendingPresence = null;
      if (!next) return;
      pushPresence(next.session, { force: next.force }).catch(() => {});
    }, wait);
  }

  function onForeground(session) {
    foreground = session;
    if (session?.appName) onSessionObserved?.(session);
    if (!template || isPaused?.()) return;
    if (!session?.appName) {
      lastSig = '';
      sendRenderer(null);
      pushPresence(null, { force: true }).catch(() => {});
      return;
    }
    pushPresence(session).catch(() => {});
  }

  async function ensureRunning() {
    if (fgService) return;
    fgService = createNowCodingService({ onUpdate: onForeground });
    await fgService.start();
    // start() already applied the static template; only re-apply if a live editor was found.
    if (foreground?.appName) {
      await pushPresence(foreground, { force: true });
    }
  }

  function start(act) {
    if (!act || act.id !== CODING_ACTIVITY_ID) { stop(); return; }
    if (!isEnabled(getConfig())) {
      stop(false);
      template = { ...act, details: 'Coding', state: act.state || 'Building something cool' };
      return;
    }
    template = { ...act, details: 'Coding', state: act.state || 'Building something cool' };
    lastSig = '';
    foreground = null;
    // Apply static coding presence immediately (with GIF from selected activity),
    // then live-update when a coding app is detected.
    pushPresence(null, { force: true }).catch(() => {});
    ensureRunning().catch(() => {});
  }

  function stop(reset = true) {
    if (fgService) {
      const s = fgService;
      fgService = null;
      s.stop().catch(() => {});
    }
    if (presenceTimer) {
      clearTimeout(presenceTimer);
      presenceTimer = null;
    }
    pendingPresence = null;
    presenceTimerToken++;
    lastSig = '';
    foreground = null;
    if (reset) template = null;
    sendRenderer(null);
  }

  return {
    CODING_ACTIVITY_ID,
    isEnabled,
    start,
    stop,
    getTemplate: () => template,
    setBackgroundMode(background) {
      fgService?.setBackgroundMode?.(background === true);
    },
    handleConfigChange(enabled) {
      if (!template) return;
      if (enabled) ensureRunning().catch(() => {});
      else stop(false);
    },
    forceRefresh() {
      if (!template) return;
      lastSig = '';
      pushPresence(foreground, { force: true }).catch(() => {});
    },
  };
}

module.exports = { createCodingSync, CODING_ACTIVITY_ID };
