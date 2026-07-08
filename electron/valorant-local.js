// Valorant local API — pregame / core-game match data (read-only)
const { localHttpsRequest } = require('./riot-client');

const agentCache = { at: 0, map: new Map() };

async function getAgentMap() {
  if (Date.now() - agentCache.at < 86400000 && agentCache.map.size) return agentCache.map;
  try {
    const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    const data = await res.json();
    const map = new Map();
    for (const a of data?.data || []) {
      if (a?.uuid) map.set(a.uuid.toLowerCase(), a.displayName);
    }
    agentCache.map = map;
    agentCache.at = Date.now();
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
  if (!Array.isArray(players)) return null;
  return players.find((p) => p?.Subject === puuid || p?.sub === puuid) || null;
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
  return s.length >= 2 ? `${s[0]} - ${s[1]}` : null;
}

async function fetchCoreGame(lockfile, puuid) {
  const player = await localHttpsRequest(lockfile.port, `/core-game/v1/players/${puuid}`, lockfile.password);
  if (!player?.MatchID) return null;
  const match = await localHttpsRequest(lockfile.port, `/core-game/v1/matches/${player.MatchID}`, lockfile.password);
  if (!match) return null;

  const agents = await getAgentMap();
  const self = findPlayer(match.Players, puuid);
  const agent = self?.CharacterID ? agents.get(String(self.CharacterID).toLowerCase()) : null;
  const score = teamScore(match.Teams);
  const map = mapName(match.MapID);

  const parts = [agent, kda(self), score, map].filter(Boolean);
  return {
    agent, kda: kda(self), map, scoreHint: score,
    liveLine: parts.join(' · ') || null,
    inMatch: true, inGame: true,
  };
}

async function fetchPregame(lockfile, puuid) {
  const player = await localHttpsRequest(lockfile.port, `/pregame/v1/players/${puuid}`, lockfile.password);
  if (!player?.MatchID) return null;
  const match = await localHttpsRequest(lockfile.port, `/pregame/v1/matches/${player.MatchID}`, lockfile.password);
  if (!match) return null;

  const agents = await getAgentMap();
  const team = match.AllyTeam || match.Teams || [];
  const self = findPlayer(team, puuid) || findPlayer(match.AllyTeam?.Characters, puuid);
  const agent = self?.CharacterID ? agents.get(String(self.CharacterID).toLowerCase()) : null;
  const map = mapName(match.MapID);

  return {
    agent,
    map,
    mode: match.Mode || match.QueueID || null,
    liveLine: [agent && `Agent ${agent}`, map, 'Agent select'].filter(Boolean).join(' · ') || 'Agent select',
    inMatch: false, inGame: true,
  };
}

async function fetchValorantLocalExtras(lockfile, puuid, { inGame, inPregame }) {
  if (inGame) {
    const core = await fetchCoreGame(lockfile, puuid);
    if (core) return core;
  }
  if (inPregame) return fetchPregame(lockfile, puuid);
  return null;
}

module.exports = { fetchValorantLocalExtras };
