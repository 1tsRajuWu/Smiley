// Game providers — merge Riot local API + foreground window detection
const { lookupSteamMetadata, resolveSteamAppIdAlias, validateImageUrl } = require('../game-api');
const {
  resolveGameArtwork, resolveSmallImage, steamCapsule, SMILEY_LOGO, GAME_LOGOS,
} = require('../game-assets');
const { buildPresenceLines } = require('../presence-builder');
const { getRiotLiveSession, isRiotGameProcess } = require('./riot');
const { enrichMinecraft } = require('./minecraft');
const { enrichFortnite } = require('./fortnite');
const { enrichOverwatch } = require('./overwatch');
const { enrichRoblox } = require('./roblox');
const { isLockfileAvailable } = require('../riot-client');

const RIOT_POLL_MENU_MS = 3000;
const RIOT_POLL_TRANSITION_MS = 2000;
const RIOT_POLL_MATCH_MS = 2500;

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

/** Sticky or focused non-Riot game (e.g. CS2) beats a stale Valorant/LoL lobby session. */
function shouldPreferForegroundOverRiot(session, foreground) {
  if (!foreground?.title) return false;
  if (isRiotGameProcess(foreground.processName)) return false;
  if (!session?.provider?.startsWith('riot-')) return false;
  if (session.inMatch) return false;
  return true;
}

function enrichForeground(foreground) {
  if (!foreground?.title) return null;
  for (const fn of FOREGROUND_ENRICHERS) {
    const hit = fn(foreground);
    if (hit) return { ...hit, processName: foreground.processName, windowTitle: foreground.windowTitle };
  }
  const base = {
    provider: 'window',
    title: foreground.title,
    processName: foreground.processName,
    windowTitle: foreground.windowTitle,
    knownGameId: foreground.knownGameId || null,
    steamAppId: foreground.steamAppId || null,
    steamArtworkUrl: foreground.steamArtworkUrl || null,
    launcher: foreground.launcher || null,
    updatedAt: foreground.updatedAt || Date.now(),
  };
  return attachSteamAlias(base);
}

/** Sync AppID + capsule from alias table (no network) so first RPC isn't empty. */
function attachSteamAlias(session) {
  if (!session || (session.provider && session.provider !== 'window')) return session;
  if (session.steamAppId) {
    const capsule = steamCapsule(session.steamAppId);
    return {
      ...session,
      steamArtworkUrl: session.steamArtworkUrl || capsule,
      artworkUrl: session.artworkUrl || capsule,
    };
  }
  const queries = [session.knownGameId, session.processName, session.title].filter(Boolean);
  for (const q of queries) {
    const id = resolveSteamAppIdAlias(q);
    if (!id) continue;
    const capsule = steamCapsule(id);
    return {
      ...session,
      steamAppId: id,
      steamArtworkUrl: session.steamArtworkUrl || capsule,
      artworkUrl: session.artworkUrl || capsule,
      launcher: session.launcher || 'Steam',
    };
  }
  return session;
}

function mergeForegroundWithSession(session, foreground) {
  if (session?.inMatch || !foreground?.title) return session;
  const fg = enrichForeground(foreground);
  if (!fg) return session;
  const riotSession = session?.provider?.startsWith('riot-');
  if (riotSession) {
    if (shouldPreferForegroundOverRiot(session, foreground)) return fg;
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

  const skipRiotForForeground = foreground?.title && !isRiotGameProcess(foreground?.processName);

  if (isLockfileAvailable() && !skipRiotForForeground) {
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

  // Also try processName for Steam AppID aliases (e.g. cs2.exe → 730).
  // Always re-apply from cache on every poll — sessions are rebuilt from foreground
  // each tick, so skipping when steamKey === lastSteamKey dropped AppID/artwork and
  // left Discord on Smiley logo + vague "In the zone".
  const steamKey = [session.title, session.processName, session.knownGameId]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join('|');
  const needsSteam = !session.provider || session.provider === 'window';
  if (needsSteam) {
    session = attachSteamAlias(session);
    let meta = null;
    const queries = [session.title, session.processName, session.knownGameId].filter(Boolean);
    for (const q of queries) {
      try { meta = await lookupSteamMetadata(q); } catch (_) { meta = null; }
      if (meta?.steamAppId) break;
    }
    if (meta) {
      session = {
        ...session,
        artworkUrl: meta.artworkUrl || session.artworkUrl,
        steamArtworkUrl: meta.steamArtworkUrl || meta.artworkUrl || session.steamArtworkUrl || null,
        tags: session.tags?.length ? session.tags : (meta.tags || []),
        metascore: session.metascore || meta.metascore,
        steamAppId: session.steamAppId || meta.steamAppId,
        launcher: session.launcher || 'Steam',
      };
    }
  }

  // Prefer real Playing status over template fluff for live game sessions
  const lines = buildPresenceLines(session, 'Playing', presenceOpts);
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
  if (!session) return RIOT_POLL_MENU_MS;
  if (session.inMatch) return RIOT_POLL_MATCH_MS;
  if (session.inQueue || session.inPregame) return RIOT_POLL_TRANSITION_MS;
  return RIOT_POLL_MENU_MS;
}

module.exports = {
  resolveLiveGameSession,
  mergeForegroundWithSession,
  shouldPreferForegroundOverRiot,
  attachSteamAlias,
  sessionSignature,
  getRiotPollMs,
  RIOT_POLL_MENU_MS,
};
