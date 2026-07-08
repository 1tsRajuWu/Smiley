// Unified Discord Rich Presence from live game sessions
const {
  resolveGameArtwork, resolveSmallImage, resolveLargeImageText,
} = require('./game-assets');

const DISCORD_TEXT_LIMIT = 128;

const DEFAULT_GAMING_PRESENCE_OPTIONS = {
  showMode: true,
  showParty: true,
  showAgent: true,
  showScore: true,
  showRank: true,
  showMapArt: true,
  showElapsed: true,
  showKda: true,
};

function normalizeGamingPresenceOptions(opts) {
  const base = { ...DEFAULT_GAMING_PRESENCE_OPTIONS, ...(opts || {}) };
  return Object.fromEntries(
    Object.keys(DEFAULT_GAMING_PRESENCE_OPTIONS).map((k) => [k, base[k] !== false]),
  );
}

function truncate(t, max = DISCORD_TEXT_LIMIT) {
  const v = String(t || '').trim();
  return v.length <= max ? v : `${v.slice(0, max - 1)}…`;
}

function joinParts(parts) {
  return parts.filter(Boolean).join(' · ');
}

function partyDisplay(party, partySize) {
  const n = Number(partySize);
  if (Number.isFinite(n) && n >= 2) return `${n}-Stack`;
  const p = String(party || '').trim();
  if (!p) return null;
  if (/^\d+-stack$/i.test(p)) return p;
  const stackMap = { Duo: '2-Stack', Trio: '3-Stack', Quad: '4-Stack', 'Full stack': '5-Stack' };
  return stackMap[p] || p;
}

/**
 * Valorant Discord/UI lines — phase flags are mutually exclusive from resolveValorantPhase.
 * Priority: match > agent select > queue > lobby (never show Queue while match/pregame).
 */
function buildValorantPresence(session, opts, fallbackState) {
  const o = normalizeGamingPresenceOptions(opts);
  const mode = o.showMode ? session.mode : null;
  const party = o.showParty ? partyDisplay(session.party, session.partySize) : null;
  const rank = o.showRank ? session.rank : null;
  const phase = session.phase
    || (session.inMatch ? 'match'
      : session.inPregame ? 'pregame'
        : session.inQueue ? 'queue'
          : session.inLobby ? 'lobby'
            : null);

  if (phase === 'match' || session.inMatch) {
    const map = o.showMapArt !== false ? session.map : null;
    const ingameParts = [
      o.showAgent && session.agent,
      o.showScore && session.scoreHint,
      party,
      o.showKda && session.kda,
      rank,
    ];
    return {
      details: truncate(map || session.title || 'Valorant'),
      state: truncate(joinParts(ingameParts) || session.liveLine || fallbackState),
    };
  }

  if (phase === 'pregame' || session.inPregame) {
    const map = o.showMapArt !== false ? session.map : null;
    return {
      details: truncate(map || session.title || 'Valorant'),
      state: truncate(joinParts([
        mode,
        'Agent Select',
        party,
      ]) || fallbackState),
    };
  }

  if (phase === 'queue' || session.inQueue) {
    return {
      details: truncate(session.title || 'Valorant'),
      state: truncate(joinParts(['Queue', mode, party]) || fallbackState),
    };
  }

  return {
    details: truncate(session.title || 'Valorant'),
    state: truncate(joinParts([mode, party, 'In lobby']) || fallbackState),
  };
}

/**
 * Build details (primary line) and state (live stats) from session.
 */
function buildPresenceLines(session, fallbackState = 'In the zone', options = {}) {
  if (!session) {
    return { details: 'Gaming', state: fallbackState };
  }

  if (session.details && session.state && !session.provider) {
    return {
      details: truncate(session.details),
      state: truncate(session.state),
    };
  }

  const provider = session.provider || 'window';

  if (provider === 'riot-valorant') {
    return buildValorantPresence(session, options, fallbackState);
  }

  if (provider === 'riot-lol') {
    const o = normalizeGamingPresenceOptions(options);
    const details = truncate(session.champ || 'League of Legends');
    const state = truncate(joinParts([
      o.showKda && session.kda,
      session.gameTime,
      o.showMode && session.mode,
      session.inMatch ? 'In game' : null,
    ]) || session.liveLine || fallbackState);
    return { details, state };
  }

  if (provider === 'fortnite') {
    const o = normalizeGamingPresenceOptions(options);
    return {
      details: truncate('Fortnite'),
      state: truncate(joinParts([
        o.showMode && session.mode,
        o.showParty && session.party,
        session.placement && `#${session.placement}`,
      ]) || session.liveLine || 'Playing'),
    };
  }

  if (provider === 'overwatch') {
    const o = normalizeGamingPresenceOptions(options);
    return {
      details: truncate(session.map || 'Overwatch 2'),
      state: truncate(joinParts([
        o.showMode && session.mode,
        o.showScore && session.scoreHint,
        o.showParty && session.party,
      ]) || session.liveLine || 'Playing'),
    };
  }

  if (provider === 'roblox') {
    return {
      details: truncate(session.experience || session.server || 'Roblox'),
      state: truncate(joinParts([
        session.inMatch ? 'Playing' : null,
        session.server && session.server !== session.experience ? session.server : null,
      ]) || session.liveLine || 'Playing'),
    };
  }

  if (provider === 'minecraft') {
    return {
      details: truncate(session.server || 'Minecraft'),
      state: truncate(joinParts([
        session.playMode,
        session.version,
      ]) || session.liveLine || 'Playing'),
    };
  }

  const o = normalizeGamingPresenceOptions(options);
  const details = truncate(session.title || 'Gaming');
  const state = truncate(joinParts([
    o.showScore && session.scoreHint && `Score ${session.scoreHint}`,
    session.launcher,
    o.showMode && session.mode,
  ]) || session.liveLine || fallbackState);
  return { details, state };
}

function buildGameSessionPayload(session, lines) {
  return {
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
    rank: session.rank,
    rankTier: session.rankTier,
    rankRR: session.rankRR,
    gameTime: session.gameTime,
    party: session.party,
    partySize: session.partySize,
    server: session.server,
    experience: session.experience,
    playMode: session.playMode,
    liveLine: lines.state,
    provider: session.provider,
    phase: session.phase || null,
    inMatch: session.inMatch === true,
    inPregame: session.inPregame === true,
    inLobby: session.inLobby === true,
    inQueue: session.inQueue === true,
    matchStartAt: session.matchStartAt || null,
    artworkUrl: session.artworkUrl || null,
    smallImageUrl: session.smallImageUrl || null,
    tags: session.tags || [],
    metascore: session.metascore || null,
    steamAppId: session.steamAppId || null,
    updatedAt: session.updatedAt || Date.now(),
  };
}

/**
 * Build full Discord activity from template + live session.
 */
function buildPresenceFromSession(session, template, {
  alwaysUseArtwork = true,
  gamingPresenceOptions = null,
} = {}) {
  if (!template) return null;

  const opts = gamingPresenceOptions || DEFAULT_GAMING_PRESENCE_OPTIONS;

  if (!session?.title) {
    return {
      ...template,
      details: 'Gaming',
      state: template.state || 'In the zone',
      gameSession: null,
    };
  }

  const lines = buildPresenceLines(session, template.state || 'In the zone', opts);
  const artworkUrl = resolveGameArtwork(session, opts);
  const smallImageUrl = resolveSmallImage(session, opts);
  const largeImageText = truncate(resolveLargeImageText(session) || lines.details);

  const activity = {
    ...template,
    details: lines.details,
    state: lines.state,
    largeImageText,
    smallImageText: session.agent || session.rankTier || session.rank || undefined,
    gameSession: buildGameSessionPayload({
      ...session,
      artworkUrl,
      smallImageUrl,
    }, lines),
  };

  if (alwaysUseArtwork && artworkUrl) {
    activity.discordImageUrl = artworkUrl;
    activity.largeImageUrl = artworkUrl;
  }
  if (smallImageUrl) {
    activity.smallImageUrl = smallImageUrl;
  }
  if (session.matchStartAt && opts.showElapsed !== false && session.inMatch) {
    activity.matchStartAt = session.matchStartAt;
  }

  return activity;
}

module.exports = {
  DISCORD_TEXT_LIMIT,
  DEFAULT_GAMING_PRESENCE_OPTIONS,
  normalizeGamingPresenceOptions,
  truncate,
  joinParts,
  partyDisplay,
  buildPresenceLines,
  buildPresenceFromSession,
  buildGameSessionPayload,
};
