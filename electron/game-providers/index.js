// Game providers — merge Riot local API + foreground window detection
const { lookupSteamMetadata } = require('../game-api');
const { getRiotLiveSession, isRiotGameProcess } = require('./riot');
const { enrichMinecraft } = require('./minecraft');
const { enrichFortnite } = require('./fortnite');
const { enrichOverwatch } = require('./overwatch');
const { enrichRoblox } = require('./roblox');
const { isLockfileAvailable } = require('../riot-client');

const RIOT_POLL_MENU_MS = 5000;
const RIOT_POLL_MATCH_MS = 4000;

const FOREGROUND_ENRICHERS = [enrichFortnite, enrichOverwatch, enrichRoblox, enrichMinecraft];

function sessionSignature(session) {
  if (!session) return '';
  return [
    session.title, session.provider, session.liveLine, session.scoreHint,
    session.map, session.mode, session.kda, session.agent, session.champ,
    session.inMatch ? '1' : '0',
  ].join('\0');
}

function buildStateLine(session, fallback) {
  if (session?.liveLine) return session.liveLine;
  const parts = [session?.agent, session?.map, session?.mode, session?.champ, session?.kda,
    session?.scoreHint && `Score ${session.scoreHint}`, session?.server].filter(Boolean);
  return parts.length ? parts.join(' · ') : (fallback || 'In the zone');
}

function enrichForeground(foreground) {
  if (!foreground?.title) return null;
  for (const fn of FOREGROUND_ENRICHERS) {
    const hit = fn(foreground);
    if (hit) return { ...hit, processName: foreground.processName, windowTitle: foreground.windowTitle };
  }
  return {
    provider: 'window',
    title: foreground.title,
    processName: foreground.processName,
    windowTitle: foreground.windowTitle,
    updatedAt: foreground.updatedAt || Date.now(),
  };
}

async function resolveLiveGameSession(foreground, { lastSteamKey = '' } = {}) {
  let session = null;

  if (isLockfileAvailable()) {
    try {
      const riot = await getRiotLiveSession();
      if (riot?.inMatch) {
        session = riot;
      } else if (riot && (riot.inGame || isRiotGameProcess(foreground?.processName) || !foreground?.title)) {
        session = riot;
      }
    } catch (_) {}
  }

  if (!session?.inMatch && foreground?.title) {
    const fg = enrichForeground(foreground);
    if (fg && (!session?.inGame || isRiotGameProcess(foreground.processName) || fg.provider !== 'window')) {
      session = session ? { ...session, ...fg, title: fg.title || session.title, liveLine: fg.liveLine || session.liveLine } : fg;
    } else if (!session) {
      session = fg;
    }
  }

  if (!session?.title) return { session: null, steamKey: lastSteamKey };

  let meta = null;
  const steamKey = session.title.toLowerCase();
  if (steamKey !== lastSteamKey) {
    try { meta = await lookupSteamMetadata(session.title); } catch (_) {}
    if (meta && !session.artworkUrl) {
      session = {
        ...session,
        artworkUrl: meta.artworkUrl,
        tags: meta.tags,
        metascore: meta.metascore,
        steamAppId: meta.steamAppId,
      };
    }
  }

  session.liveLine = buildStateLine(session);
  return { session, steamKey };
}

function getRiotPollMs(session) {
  return session?.inMatch ? RIOT_POLL_MATCH_MS : RIOT_POLL_MENU_MS;
}

module.exports = {
  resolveLiveGameSession,
  sessionSignature,
  buildStateLine,
  getRiotPollMs,
  RIOT_POLL_MENU_MS,
};
