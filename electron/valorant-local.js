// Valorant local API — unconditional pregame / core-game truth (read-only)
const { localHttpsRequest } = require('./riot-client');

const agentCache = { at: 0, map: new Map(), idByName: new Map() };

async function getAgentMap() {
  if (Date.now() - agentCache.at < 86400000 && agentCache.map.size) return agentCache.map;
  try {
    const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    const data = await res.json();
    const map = new Map();
    const idByName = new Map();
    for (const a of data?.data || []) {
      if (a?.uuid) {
        map.set(a.uuid.toLowerCase(), a.displayName);
        if (a.displayName) idByName.set(a.displayName.toLowerCase(), a.uuid);
      }
    }
    if (map.size) {
      agentCache.map = map;
      agentCache.idByName = idByName;
      agentCache.at = Date.now();
    }
  } catch (_) {}
  return agentCache.map;
}

function mapName(mapPath) {
  const raw = String(mapPath || '').trim();
  if (!raw) return null;
  const last = raw.split('/').filter(Boolean).pop();
  return last ? last.replace(/([a-z])([A-Z])/g, '$1 $2') : null;
}

function findPlayer(players, puuid) {
  if (!Array.isArray(players) || !puuid) return null;
  const want = String(puuid).toLowerCase();
  return players.find((p) => {
    const sub = p?.Subject || p?.subject || p?.PlayerIdentity?.Subject || p?.sub;
    return sub && String(sub).toLowerCase() === want;
  }) || null;
}

/**
 * Pregame match shape varies:
 *   AllyTeam: { Players: [...] }  ← current
 *   AllyTeam: [...]               ← legacy flat
 *   AllyTeam.Characters           ← rare
 *   Teams: [{ Players }]          ← fallback
 */
function pregamePlayerList(match) {
  const ally = match?.AllyTeam;
  if (Array.isArray(ally?.Players)) return ally.Players;
  if (Array.isArray(ally?.Characters)) return ally.Characters;
  if (Array.isArray(ally)) return ally;
  if (Array.isArray(match?.Players)) return match.Players;
  if (Array.isArray(match?.Teams)) {
    const flat = [];
    for (const t of match.Teams) {
      if (Array.isArray(t?.Players)) flat.push(...t.Players);
      else if (t && (t.Subject || t.CharacterID)) flat.push(t);
    }
    if (flat.length) return flat;
  }
  return [];
}

function characterIdOf(player) {
  if (!player || typeof player !== 'object') return null;
  const raw = player.CharacterID
    || player.CharacterId
    || player.characterID
    || player.Character?.ID
    || player.Character?.id
    || null;
  const id = raw ? String(raw).trim() : '';
  if (!id || id === '00000000-0000-0000-0000-000000000000') return null;
  return id;
}

function kda(player) {
  const k = Number(player?.Stats?.Kills ?? player?.kills);
  const d = Number(player?.Stats?.Deaths ?? player?.deaths);
  const a = Number(player?.Stats?.Assists ?? player?.assists);
  if (![k, d, a].every(Number.isFinite)) return null;
  return `${k}/${d}/${a}`;
}

function teamScore(teams) {
  if (!Array.isArray(teams) || teams.length < 2) return null;
  const s = teams.map((t) => Number(t?.RoundScore ?? t?.roundScore)).filter(Number.isFinite);
  return s.length >= 2 ? `${s[0]}-${s[1]}` : null;
}

async function resolveAgent(agentId) {
  if (!agentId) return { agent: null, agentId: null };
  const agents = await getAgentMap();
  const agent = agents.get(String(agentId).toLowerCase()) || null;
  return { agent, agentId };
}

async function fetchCoreGame(lockfile, puuid) {
  const player = await localHttpsRequest(lockfile.port, `/core-game/v1/players/${puuid}`, lockfile.password);
  if (!player?.MatchID) return null;
  const match = await localHttpsRequest(lockfile.port, `/core-game/v1/matches/${player.MatchID}`, lockfile.password);
  if (!match) return null;

  const self = findPlayer(match.Players, puuid);
  const agentId = characterIdOf(self);
  const { agent } = await resolveAgent(agentId);
  const score = teamScore(match.Teams);
  const mapId = match.MapID || null;
  const map = mapName(mapId);

  return {
    agent,
    agentId,
    kda: kda(self),
    map,
    mapId,
    scoreHint: score,
    inMatch: true,
    inPregame: false,
    coreGame: true,
    pregame: false,
  };
}

async function fetchPregame(lockfile, puuid) {
  const player = await localHttpsRequest(lockfile.port, `/pregame/v1/players/${puuid}`, lockfile.password);
  if (!player?.MatchID) return null;
  const match = await localHttpsRequest(lockfile.port, `/pregame/v1/matches/${player.MatchID}`, lockfile.password);
  if (!match) return null;

  const list = pregamePlayerList(match);
  const self = findPlayer(list, puuid)
    || findPlayer(match.AllyTeam?.Characters, puuid)
    || findPlayer(match.Players, puuid);
  const agentId = characterIdOf(self);
  const { agent } = await resolveAgent(agentId);
  const mapId = match.MapID || null;
  const map = mapName(mapId);

  return {
    agent,
    agentId,
    map,
    mapId,
    mode: match.Mode || match.QueueID || null,
    inMatch: false,
    inPregame: true,
    coreGame: false,
    pregame: true,
  };
}

/**
 * Probe local APIs unconditionally. Core-game wins over pregame.
 * Returns null only when neither endpoint has an active match.
 */
async function fetchValorantLocalTruth(lockfile, puuid) {
  if (!lockfile || !puuid) return null;
  const [core, pre] = await Promise.all([
    fetchCoreGame(lockfile, puuid),
    fetchPregame(lockfile, puuid),
  ]);
  if (core) return core;
  if (pre) return pre;
  return null;
}

/** @deprecated use fetchValorantLocalTruth — kept for any external callers */
async function fetchValorantLocalExtras(lockfile, puuid, { inGame, inPregame } = {}) {
  if (inGame) {
    const core = await fetchCoreGame(lockfile, puuid);
    if (core) return core;
  }
  if (inPregame) return fetchPregame(lockfile, puuid);
  // Even without chat flags, still probe — avoids one-phase lag.
  return fetchValorantLocalTruth(lockfile, puuid);
}

module.exports = {
  fetchValorantLocalTruth,
  fetchValorantLocalExtras,
  // exported for presence-check fixtures
  findPlayer,
  pregamePlayerList,
  characterIdOf,
};
