// Game providers — merge Riot local API + foreground window detection
const { lookupSteamMetadata, validateImageUrl } = require('../game-api');
const { resolveGameArtwork, resolveSmallImage, SMILEY_LOGO, GAME_LOGOS } = require('../game-assets');
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
    session.kda, session.agent, session.agentId, session.champ, session.party, session.rank,
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
  // Also try processName for Steam AppID aliases (e.g. cs2.exe → 730)
  const steamKey = [session.title, session.processName]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join('|');
  const needsSteam = !session.provider || session.provider === 'window';
  if (needsSteam && steamKey !== lastSteamKey) {
    const queries = [session.title, session.processName].filter(Boolean);
    for (const q of queries) {
      try { meta = await lookupSteamMetadata(q); } catch (_) { meta = null; }
      if (meta?.steamAppId) break;
    }
    if (meta) {
      session = {
        ...session,
        artworkUrl: session.artworkUrl || meta.artworkUrl,
        steamArtworkUrl: meta.steamArtworkUrl || meta.artworkUrl || null,
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
  let artwork = resolveGameArtwork(session, presenceOpts);
  // Never push a 404 / spinner URL — Discord would show a broken loading image.
  // Validate Steam / generic CDN picks; known GAME_LOGOS + Valorant 128px skip re-fetch.
  const providerLogo = session.provider && GAME_LOGOS[session.provider];
  const needsValidate = artwork
    && !providerLogo
    && session.provider !== 'riot-valorant'
    && /steamstatic\.com|steam\/apps/i.test(artwork);
  if (needsValidate) {
    try {
      const ok = await validateImageUrl(artwork);
      if (!ok) artwork = SMILEY_LOGO;
    } catch (_) {
      artwork = SMILEY_LOGO;
    }
  }
  session.artworkUrl = artwork;
  session.steamArtworkUrl = session.steamArtworkUrl || (session.steamAppId ? artwork : null);
  session.smallImageUrl = resolveSmallImage(session, presenceOpts);
  return { session, steamKey: needsSteam ? steamKey : lastSteamKey };
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
