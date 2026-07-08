// Game providers — merge Riot local API + foreground window detection
const { lookupSteamMetadata } = require('../game-api');
const { resolveGameArtwork, resolveSmallImage } = require('../game-assets');
const { buildPresenceLines } = require('../presence-builder');
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
    session.title, session.provider, session.details, session.state,
    session.liveLine, session.scoreHint, session.map, session.mode,
    session.kda, session.agent, session.champ, session.party, session.rank,
    session.phase || '',
    session.inMatch ? '1' : '0',
    session.inPregame ? '1' : '0',
    session.inLobby ? '1' : '0',
    session.inQueue ? '1' : '0',
    resolveGameArtwork(session),
    resolveSmallImage(session),
  ].join('\0');
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

function mergeForegroundWithSession(session, foreground) {
  if (session?.inMatch || !foreground?.title) return session;
  const fg = enrichForeground(foreground);
  if (!fg) return session;
  const riotSession = session?.provider?.startsWith('riot-');
  if (riotSession) {
    if (fg.provider !== 'window') {
      return { ...session, ...fg, title: fg.title || session.title, provider: session.provider };
    }
    return session;
  }
  if (!session?.inGame || isRiotGameProcess(foreground.processName) || fg.provider !== 'window') {
    return session ? { ...session, ...fg, title: fg.title || session.title } : fg;
  }
  return session || fg;
}

async function resolveLiveGameSession(foreground, { lastSteamKey = '', getConfig, fetchRank } = {}) {
  let session = null;
  const presenceOpts = getConfig?.()?.gamingPresenceOptions;

  if (isLockfileAvailable()) {
    try {
      const riot = await getRiotLiveSession({ fetchRank });
      if (riot?.inMatch) {
        session = riot;
      } else if (riot && (riot.inGame || isRiotGameProcess(foreground?.processName) || !foreground?.title)) {
        session = riot;
      }
    } catch (_) {}
  }

  session = mergeForegroundWithSession(session, foreground);

  if (!session?.title) return { session: null, steamKey: lastSteamKey };

  let meta = null;
  const steamKey = session.title.toLowerCase();
  if (steamKey !== lastSteamKey) {
    try { meta = await lookupSteamMetadata(session.title); } catch (_) {}
    if (meta) {
      session = {
        ...session,
        artworkUrl: session.artworkUrl || meta.artworkUrl,
        tags: session.tags || meta.tags,
        metascore: session.metascore || meta.metascore,
        steamAppId: session.steamAppId || meta.steamAppId,
      };
    }
  }

  const lines = buildPresenceLines(session, 'In the zone', presenceOpts);
  session.details = lines.details;
  session.state = lines.state;
  session.liveLine = lines.state;
  session.artworkUrl = resolveGameArtwork(session, presenceOpts);
  session.smallImageUrl = resolveSmallImage(session, presenceOpts);
  return { session, steamKey };
}

function getRiotPollMs(session) {
  return session?.inMatch ? RIOT_POLL_MATCH_MS : RIOT_POLL_MENU_MS;
}

module.exports = {
  resolveLiveGameSession,
  mergeForegroundWithSession,
  sessionSignature,
  getRiotPollMs,
  RIOT_POLL_MENU_MS,
};
