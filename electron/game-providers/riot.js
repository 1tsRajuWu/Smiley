// Riot games — Valorant + LoL via local client API
const { readLockfile, getSelfPresence, localHttpsPort2999 } = require('../riot-client');
const { fetchValorantLocalExtras } = require('../valorant-local');
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

function parseValorant(privateData) {
  if (!privateData) return null;
  const loop = String(privateData.sessionLoopState || privateData.partyOwnerSessionLoopState || '').toUpperCase();
  const provisioning = String(
    privateData.provisioningFlow || privateData.partyOwnerProvisioningFlow || '',
  ).toUpperCase();
  const inMatch = loop === 'INGAME';
  const inPregame = loop === 'PREGAME';
  const inQueue = !inMatch && !inPregame && (
    provisioning === 'MATCHMAKING'
    || provisioning === 'MATCHMAKINGREADYCHK'
    || loop === 'MATCHMAKING'
  );
  const inLobby = !inMatch && !inPregame && !inQueue && (
    loop === 'MENUS' || loop === 'FRONTEND' || loop === ''
  );
  const queueId = String(privateData.queueId || privateData.partyOwnerQueueId || '').trim();
  const map = mapPathToName(privateData.partyOwnerMatchMap || privateData.matchMap);
  const mode = queueName(queueId);
  const partySize = parsePartySize(privateData);
  const party = partySize ? partyLabel(partySize) : null;
  const ally = Number(privateData.partyOwnerMatchScoreAllyTeam ?? privateData.partyOwnerMatchCurrentTeamRoundScore);
  const enemy = Number(privateData.partyOwnerMatchScoreEnemyTeam);
  const scoreHint = inMatch && Number.isFinite(ally) && Number.isFinite(enemy) ? `${ally}-${enemy}` : null;

  return {
    provider: 'riot-valorant',
    title: 'Valorant',
    map,
    mode,
    modeKey: queueId,
    queueId,
    scoreHint,
    party,
    partySize,
    inGame: inMatch || inPregame || inQueue,
    inMatch,
    inPregame,
    inLobby,
    inQueue,
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
    let session = parseValorant(self.privateData) || {
      provider: 'riot-valorant',
      title: 'Valorant',
      launcher: 'Riot Games',
      updatedAt: Date.now(),
    };
    if (session.inGame || session.inPregame) {
      const extras = await fetchValorantLocalExtras(lockfile, self.puuid, {
        inGame: session.inMatch,
        inPregame: session.inPregame,
      });
      if (extras) {
        session = {
          ...session,
          ...extras,
          scoreHint: extras.scoreHint || session.scoreHint,
          modeKey: session.queueId,
          inMatch: extras.inMatch ?? session.inMatch,
        };
      }
    }
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

module.exports = { getRiotLiveSession, isRiotGameProcess, parseParty, parseValorant };
