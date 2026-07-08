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
    const agent = o.showAgent !== false ? session.agent : null;
    // details: agent + map; state: score · party · mode · kda · rank (agent already on details)
    // Deathmatch FFA only — "Team Deathmatch" must still show team score + KDA
    const q = String(session.queueId || session.modeKey || '').toLowerCase();
    const modeStr = String(session.mode || '');
    const isDm = (q === 'deathmatch' || (/death\s*match/i.test(modeStr) && !/team/i.test(modeStr)))
      && !/hurm|onefa|team/i.test(q);
    const detailLine = joinParts([agent, map]);
    const showKda = o.showKda && session.kda && !(isDm && session.scoreHint);
    const ingameParts = [
      agent && !detailLine ? agent : null,
      o.showScore && session.scoreHint,
      party,
      mode,
      showKda ? session.kda : null,
      rank,
    ];
    return {
      details: truncate(detailLine || map || session.title || 'Valorant'),
      state: truncate(joinParts(ingameParts) || session.liveLine || fallbackState),
    };
  }

  if (phase === 'pregame' || session.inPregame) {
    const map = o.showMapArt !== false ? session.map : null;
    const agent = o.showAgent !== false ? session.agent : null;
    // e.g. details "Jett · Agent Select" / state "Competitive · Lotus · Solo"
    // or details "Agent Select" when agent not locked yet
    return {
      details: truncate(joinParts([agent, 'Agent Select']) || 'Agent Select'),
      state: truncate(joinParts([
        mode,
        map,
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
 * Soft parse status from a native window title (Steam / generic).
 * Local/safe only — no memory reads. CS2 usually exposes no map here.
 */
function parseWindowHints(session) {
  const raw = String(session?.windowTitle || '').trim();
  const title = String(session?.title || '').trim();
  const isCs2 = /^counter-strike/i.test(title)
    || session?.steamAppId === 730
    || session?.knownGameId === 'cs2';

  if (!raw) {
    return { map: null, mode: null, status: isCs2 || session?.steamAppId ? 'Playing' : null };
  }

  if (/\b(main\s*menu|in\s*lobby|^\s*lobby\s*$)\b/i.test(raw) && !/\bin\s*match\b/i.test(raw)) {
    return { map: null, mode: null, status: 'In menu' };
  }

  // CS2's native window title is almost always just the product name — no public map
  // without GSI/kernel cheats. Show "Playing" rather than catalog fluff.
  if (isCs2 && (/^counter-strike\s*2?$/i.test(raw) || /^cs2$/i.test(raw))) {
    return { map: null, mode: null, status: 'Playing' };
  }

  if (!title) return { map: null, mode: null, status: null };

  let rest = raw;
  const stripped = rest.replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[|–\\-:]\\s*`, 'i'), '').trim();
  if (stripped && stripped.toLowerCase() !== title.toLowerCase()) rest = stripped;
  else if (raw.toLowerCase() === title.toLowerCase()) {
    return { map: null, mode: null, status: 'Playing' };
  }

  let mode = null;
  if (/\b(competitive|premier|wingman|deathmatch|casual|arms race|demolition|retakes?)\b/i.test(rest)) {
    mode = rest.match(/\b(competitive|premier|wingman|deathmatch|casual|arms race|demolition|retakes?)\b/i)?.[1];
    if (mode) mode = mode.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const mapCand = rest
    .replace(/\b(competitive|premier|wingman|deathmatch|casual|arms race|demolition|retakes?)\b/gi, '')
    .replace(/[|–\-:/]+/g, ' ')
    .trim();
  const map = mapCand && mapCand.length >= 2 && mapCand.length <= 40 && !/^playing$/i.test(mapCand)
    ? mapCand
    : null;
  return { map, mode, status: map || mode ? null : 'Playing' };
}

function steamPhaseLabel(session, hints) {
  if (session.inMatch || session.phase === 'match') return 'In match';
  if (session.inLobby || session.phase === 'lobby') return 'In lobby';
  if (session.inQueue || session.phase === 'queue') return 'In queue';
  if (hints?.status) return hints.status;
  if (session.steamAppId || session.launcher === 'Steam') return 'Playing';
  return null;
}

function buildSteamOrWindowPresence(session, opts, fallbackState) {
  const hints = parseWindowHints(session);
  const map = session.map || hints.map;
  const mode = (opts.showMode !== false && (session.mode || hints.mode)) || null;
  const phaseLabel = steamPhaseLabel(session, hints);
  const details = truncate(session.title || map || 'Gaming');
  // Prefer game title on details; put phase + mode on state (Discord state line).
  const state = truncate(joinParts([
    phaseLabel && phaseLabel !== 'Playing' ? phaseLabel : null,
    mode,
    opts.showScore !== false && session.scoreHint,
    opts.showParty !== false && partyDisplay(session.party, session.partySize),
    map && map !== details ? map : null,
    !phaseLabel || phaseLabel === 'Playing'
      ? (mode || session.scoreHint || map ? null : 'Playing')
      : null,
  ]) || session.liveLine || phaseLabel || fallbackState || 'Playing');
  return { details, state };
}

function buildPresenceLines(session, fallbackState = 'Playing', options = {}) {
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
  // Live game sessions should never ship catalog fluff ("In the zone") as status
  const liveFallback = fallbackState === 'In the zone' ? 'Playing' : (fallbackState || 'Playing');

  if (provider === 'riot-valorant') {
    return buildValorantPresence(session, options, liveFallback);
  }

  if (provider === 'riot-lol') {
    const o = normalizeGamingPresenceOptions(options);
    const details = truncate(session.champ || 'League of Legends');
    const state = truncate(joinParts([
      o.showKda && session.kda,
      session.gameTime,
      o.showMode && session.mode,
      session.inMatch ? 'In game' : null,
    ]) || session.liveLine || liveFallback);
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
      ]) || session.liveLine || (session.inLobby ? 'In lobby' : 'Playing')),
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
      ]) || session.liveLine || (session.inLobby ? 'In lobby' : 'Playing')),
    };
  }

  if (provider === 'roblox') {
    return {
      details: truncate(session.experience || session.server || 'Roblox'),
      state: truncate(joinParts([
        session.inMatch ? 'In experience' : 'Playing',
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
  return buildSteamOrWindowPresence(session, o, liveFallback);
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
    steamArtworkUrl: session.steamArtworkUrl || null,
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

  // Catalog default "In the zone" is for idle Gaming only — live sessions use Playing
  const fallbackState = template.state === 'In the zone' ? 'Playing' : (template.state || 'Playing');
  const lines = buildPresenceLines(session, fallbackState, opts);
  const artworkUrl = resolveGameArtwork(session, opts);
  const smallImageUrl = resolveSmallImage(session, opts);
  const largeImageText = truncate(resolveLargeImageText(session) || lines.details);

  const activity = {
    ...template,
    details: lines.details,
    state: lines.state,
    largeImageText,
    smallImageText: session.agent || session.rankTier || session.rank
      || (session.steamAppId ? 'Steam' : undefined)
      || (session.launcher && session.launcher !== 'Steam' ? session.launcher : undefined),
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
  parseWindowHints,
  steamPhaseLabel,
  buildPresenceLines,
  buildPresenceFromSession,
  buildGameSessionPayload,
};
