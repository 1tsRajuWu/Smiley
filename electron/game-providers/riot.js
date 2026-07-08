// Riot games — Valorant + LoL via local client API
const { readLockfile, getSelfPresence, localHttpsPort2999 } = require('../riot-client');
const { fetchValorantLocalTruth } = require('../valorant-local');
const { partyLabel } = require('../game-assets');

const VALORANT_QUEUES = {
  competitive: 'Competitive',
  unrated: 'Unrated',
  swiftplay: 'Swiftplay',
  deathmatch: 'Deathmatch',
  spikeRush: 'Spike Rush',
  ggteam: 'Spike Rush',
  escalation: 'Escalation',
  replication: 'Replication',
  snowball: 'Snowball Fight',
  custom: 'Custom',
  newmap: 'New Map',
  premier: 'Premier',
  onefa: 'Team Deathmatch',
};

const LOL_QUEUE_NAMES = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
};

/** partyState values that mean the party is actively queueing. */
const QUEUE_PARTY_STATES = new Set([
  'MATCHMAKING',
  'STARTING_MATCHMAKING',
  'MATCHMAKINGREADYCHK',
  'MATCHMAKING_READY_CHECK',
]);

/**
 * Riot private presence may be flat (legacy) or nested under
 * matchPresenceData / partyPresenceData / playerPresenceData (2025+).
 * Flatten once so every reader uses one shape.
 */
function flattenValorantPresence(privateData) {
  if (!privateData || typeof privateData !== 'object') return null;
  const match = privateData.matchPresenceData || {};
  const party = privateData.partyPresenceData || {};
  const player = privateData.playerPresenceData || {};
  return {
    ...privateData,
    sessionLoopState: privateData.sessionLoopState
      ?? match.sessionLoopState
      ?? privateData.partyOwnerSessionLoopState,
    partyOwnerSessionLoopState: privateData.partyOwnerSessionLoopState
      ?? match.partyOwnerSessionLoopState
      ?? match.sessionLoopState,
    provisioningFlow: privateData.provisioningFlow
      ?? party.provisioningFlow
      ?? match.provisioningFlow,
    partyOwnerProvisioningFlow: privateData.partyOwnerProvisioningFlow
      ?? party.partyOwnerProvisioningFlow
      ?? party.provisioningFlow,
    partyState: privateData.partyState ?? party.partyState,
    queueId: privateData.queueId ?? party.queueId ?? privateData.partyOwnerQueueId,
    partyOwnerQueueId: privateData.partyOwnerQueueId ?? party.queueId,
    partySize: privateData.partySize ?? party.partySize,
    partyOwnerPartySize: privateData.partyOwnerPartySize ?? party.partySize,
    partyMembers: privateData.partyMembers ?? party.partyMembers ?? party.partyMemberUUIDs,
    partyMemberUUIDs: privateData.partyMemberUUIDs ?? party.partyMemberUUIDs,
    partyOwnerMatchMap: privateData.partyOwnerMatchMap ?? match.partyOwnerMatchMap ?? match.matchMap,
    matchMap: privateData.matchMap ?? match.matchMap,
    partyOwnerMatchScoreAllyTeam: privateData.partyOwnerMatchScoreAllyTeam
      ?? match.partyOwnerMatchScoreAllyTeam,
    partyOwnerMatchScoreEnemyTeam: privateData.partyOwnerMatchScoreEnemyTeam
      ?? match.partyOwnerMatchScoreEnemyTeam,
    partyOwnerMatchCurrentTeamRoundScore: privateData.partyOwnerMatchCurrentTeamRoundScore
      ?? match.partyOwnerMatchCurrentTeamRoundScore,
    accountLevel: privateData.accountLevel ?? player.accountLevel,
  };
}

function mapPathToName(p) {
  const last = String(p || '').split('/').filter(Boolean).pop();
  return last ? last.replace(/([a-z])([A-Z])/g, '$1 $2') : null;
}

function queueName(id) {
  const k = String(id || '').trim();
  return VALORANT_QUEUES[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2') || null;
}

function lolQueueName(id) {
  const n = Number(id);
  return LOL_QUEUE_NAMES[n] || (Number.isFinite(n) ? `Queue ${n}` : null);
}

function parsePartySize(privateData) {
  if (!privateData) return null;
  let size = Number(privateData.partySize);
  if (!Number.isFinite(size) || size < 1) {
    size = Number(privateData.partyOwnerPartySize);
  }
  if (!Number.isFinite(size) || size < 1) {
    const members = privateData.partyMembers || privateData.partyMemberUUIDs;
    if (Array.isArray(members) && members.length) size = members.length;
  }
  return Number.isFinite(size) && size >= 1 ? size : null;
}

function parseParty(privateData) {
  const size = parsePartySize(privateData);
  return size ? partyLabel(size) : null;
}

function upper(v) {
  return String(v || '').trim().toUpperCase();
}

/**
 * Canonical Valorant phase — single source of truth, mutually exclusive flags.
 *
 * Priority (highest wins):
 *   1. Local core-game → match
 *   2. Local pregame   → agent select
 *   3. Chat loop INGAME / PREGAME
 *   4. partyState matchmaking (while still MENUS) → queue
 *   5. MENUS / FRONTEND / empty → lobby
 *
 * Never leave inQueue=true when match/pregame is confirmed.
 * Do NOT treat sticky provisioningFlow=Matchmaking as queue once past MENUS.
 */
function resolveValorantPhase({ privateData, localTruth } = {}) {
  const data = flattenValorantPresence(privateData) || {};
  const loop = upper(data.sessionLoopState || data.partyOwnerSessionLoopState);
  const partyState = upper(data.partyState);
  const local = localTruth || {};

  let phase = 'lobby';

  if (local.inMatch === true || local.coreGame === true) {
    phase = 'match';
  } else if (local.inPregame === true || local.pregame === true) {
    phase = 'pregame';
  } else if (loop === 'INGAME') {
    phase = 'match';
  } else if (loop === 'PREGAME') {
    phase = 'pregame';
  } else if (
    (loop === 'MENUS' || loop === 'FRONTEND' || loop === '' || loop === 'MATCHMAKING')
    && (
      QUEUE_PARTY_STATES.has(partyState)
      || loop === 'MATCHMAKING'
      || partyState === 'LEAVING_MATCHMAKING'
    )
  ) {
    // Prefer partyState for queue — provisioningFlow stays "Matchmaking"
    // through agent select / early match and must not sticky-queue us.
    phase = 'queue';
  } else if (
    // Fallback: provisioning only while clearly still in menus AND not past matchmaking start.
    (loop === 'MENUS' || loop === 'FRONTEND' || loop === '')
    && !partyState
    && ['MATCHMAKING', 'MATCHMAKINGREADYCHK'].includes(upper(data.provisioningFlow || data.partyOwnerProvisioningFlow))
  ) {
    phase = 'queue';
  } else {
    phase = 'lobby';
  }

  return {
    phase,
    inMatch: phase === 'match',
    inPregame: phase === 'pregame',
    inQueue: phase === 'queue',
    inLobby: phase === 'lobby',
    loop,
    partyState,
  };
}

function parseValorant(privateData, localTruth = null) {
  const data = flattenValorantPresence(privateData);
  if (!data && !localTruth) return null;

  const resolved = resolveValorantPhase({ privateData: data, localTruth });
  const queueId = String(data?.queueId || data?.partyOwnerQueueId || '').trim();
  const map = localTruth?.map || mapPathToName(data?.partyOwnerMatchMap || data?.matchMap);
  const mode = queueName(queueId) || (localTruth?.mode ? queueName(localTruth.mode) : null) || localTruth?.mode || null;
  const partySize = parsePartySize(data);
  const party = partySize ? partyLabel(partySize) : null;
  const ally = Number(data?.partyOwnerMatchScoreAllyTeam ?? data?.partyOwnerMatchCurrentTeamRoundScore);
  const enemy = Number(data?.partyOwnerMatchScoreEnemyTeam);
  const scoreHint = resolved.inMatch && (
    localTruth?.scoreHint
    || (Number.isFinite(ally) && Number.isFinite(enemy) ? `${ally}-${enemy}` : null)
  );

  return {
    provider: 'riot-valorant',
    title: 'Valorant',
    phase: resolved.phase,
    map,
    mapId: localTruth?.mapId || null,
    mode,
    modeKey: queueId,
    queueId,
    scoreHint: scoreHint || null,
    party,
    partySize,
    agent: localTruth?.agent || null,
    agentId: localTruth?.agentId || null,
    kda: localTruth?.kda || null,
    inGame: resolved.inMatch || resolved.inPregame || resolved.inQueue,
    inMatch: resolved.inMatch,
    inPregame: resolved.inPregame,
    inLobby: resolved.inLobby,
    inQueue: resolved.inQueue,
    launcher: 'Riot Games',
    updatedAt: Date.now(),
  };
}

function parseLol(privateData) {
  if (!privateData) return null;
  const status = String(privateData.gameStatus || privateData.gamestatus || '').toLowerCase();
  const inGame = status === 'ingame';
  const qid = privateData.gameQueueConfigId ?? privateData.queueId;
  const mode = lolQueueName(qid);

  return {
    provider: 'riot-lol',
    title: 'League of Legends',
    mode,
    inGame: inGame || status === 'champselect' || status === 'inqueue',
    inMatch: inGame,
    launcher: 'Riot Games',
    updatedAt: Date.now(),
  };
}

async function lolLiveStats() {
  const [player, stats] = await Promise.all([
    localHttpsPort2999('/liveclientdata/activeplayer'),
    localHttpsPort2999('/liveclientdata/gamestats'),
  ]);
  if (!player) return null;
  const k = Number(player.scores?.kills);
  const d = Number(player.scores?.deaths);
  const a = Number(player.scores?.assists);
  const kda = [k, d, a].every(Number.isFinite) ? `${k}/${d}/${a}` : null;
  const champ = player.championName || null;
  const t = Number(stats?.gameTime);
  const gameTime = Number.isFinite(t) && t > 0
    ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : null;
  return { champ, kda, gameTime, inMatch: true };
}

async function getRiotLiveSession({ fetchRank } = {}) {
  const lockfile = readLockfile();
  if (!lockfile) return null;

  const self = await getSelfPresence(lockfile);
  if (!self?.product) return null;

  if (self.product === 'valorant') {
    // Always probe local pregame/core-game — chat presence lags and nesting can miss phase.
    const localTruth = self.puuid
      ? await fetchValorantLocalTruth(lockfile, self.puuid)
      : null;

    let session = parseValorant(self.privateData, localTruth) || {
      provider: 'riot-valorant',
      title: 'Valorant',
      launcher: 'Riot Games',
      phase: 'lobby',
      inLobby: true,
      inMatch: false,
      inPregame: false,
      inQueue: false,
      updatedAt: Date.now(),
    };

    if (fetchRank && self.puuid) {
      try {
        const rankData = await fetchRank(self.puuid);
        if (rankData) session = { ...session, ...rankData };
      } catch (_) {}
    }
    return session;
  }

  if (self.product === 'league_of_legends') {
    let session = parseLol(self.privateData) || {
      provider: 'riot-lol',
      title: 'League of Legends',
      launcher: 'Riot Games',
      updatedAt: Date.now(),
    };
    if (session.inMatch) {
      const live = await lolLiveStats();
      if (live) session = { ...session, ...live, scoreHint: live.kda };
    }
    return session;
  }
  return null;
}

function isRiotGameProcess(name) {
  const n = String(name || '').toLowerCase();
  return n.includes('valorant') || n.includes('league') || n.includes('riot');
}

module.exports = {
  getRiotLiveSession,
  isRiotGameProcess,
  parseParty,
  parseValorant,
  flattenValorantPresence,
  resolveValorantPhase,
};
