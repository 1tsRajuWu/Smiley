// Unified Discord Rich Presence from live game sessions
const { resolveGameArtwork, resolveLargeImageText } = require('./game-assets');

const DISCORD_TEXT_LIMIT = 128;

function truncate(t, max = DISCORD_TEXT_LIMIT) {
  const v = String(t || '').trim();
  return v.length <= max ? v : `${v.slice(0, max - 1)}…`;
}

function joinParts(parts) {
  return parts.filter(Boolean).join(' · ');
}

/**
 * Build details (primary line) and state (live stats) from session.
 * details = identity (map, champ, experience) — never mode-only concatenations.
 */
function buildPresenceLines(session, fallbackState = 'In the zone') {
  if (!session) {
    return { details: 'Gaming', state: fallbackState };
  }

  if (session.details && session.state) {
    return {
      details: truncate(session.details),
      state: truncate(session.state),
    };
  }

  const provider = session.provider || 'window';

  if (provider === 'riot-valorant') {
    const details = truncate(session.map || 'Valorant');
    const state = truncate(joinParts([
      session.agent,
      session.kda,
      session.scoreHint,
      session.mode,
      session.party,
    ]) || session.liveLine || fallbackState);
    return { details, state };
  }

  if (provider === 'riot-lol') {
    const details = truncate(session.champ || 'League of Legends');
    const state = truncate(joinParts([
      session.kda,
      session.gameTime,
      session.mode,
      session.inMatch ? 'In game' : null,
    ]) || session.liveLine || fallbackState);
    return { details, state };
  }

  if (provider === 'fortnite') {
    return {
      details: truncate('Fortnite'),
      state: truncate(joinParts([
        session.mode,
        session.party,
        session.placement && `#${session.placement}`,
      ]) || session.liveLine || 'Playing'),
    };
  }

  if (provider === 'overwatch') {
    return {
      details: truncate(session.map || 'Overwatch 2'),
      state: truncate(joinParts([
        session.mode,
        session.scoreHint,
        session.party,
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

  // Steam / generic window
  const details = truncate(session.title || 'Gaming');
  const state = truncate(joinParts([
    session.scoreHint && `Score ${session.scoreHint}`,
    session.launcher,
    session.mode,
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
    gameTime: session.gameTime,
    party: session.party,
    server: session.server,
    experience: session.experience,
    playMode: session.playMode,
    liveLine: lines.state,
    provider: session.provider,
    inMatch: session.inMatch === true,
    artworkUrl: session.artworkUrl || null,
    tags: session.tags || [],
    metascore: session.metascore || null,
    steamAppId: session.steamAppId || null,
    updatedAt: session.updatedAt || Date.now(),
  };
}

/**
 * Build full Discord activity from template + live session.
 */
function buildPresenceFromSession(session, template, { alwaysUseArtwork = true } = {}) {
  if (!template) return null;

  if (!session?.title) {
    return {
      ...template,
      details: 'Gaming',
      state: template.state || 'In the zone',
      gameSession: null,
    };
  }

  const lines = buildPresenceLines(session, template.state || 'In the zone');
  const artworkUrl = resolveGameArtwork(session);
  const largeImageText = truncate(resolveLargeImageText(session) || lines.details);

  const activity = {
    ...template,
    details: lines.details,
    state: lines.state,
    largeImageText,
    gameSession: buildGameSessionPayload(session, lines),
  };

  if (alwaysUseArtwork && artworkUrl) {
    activity.discordImageUrl = artworkUrl;
    activity.largeImageUrl = artworkUrl;
  }

  return activity;
}

module.exports = {
  DISCORD_TEXT_LIMIT,
  truncate,
  buildPresenceLines,
  buildPresenceFromSession,
  buildGameSessionPayload,
};
