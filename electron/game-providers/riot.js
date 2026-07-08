// Riot games — Valorant + LoL via local client API
const { readLockfile, getSelfPresence, localHttpsPort2999 } = require('../riot-client');
const { fetchValorantLocalExtras } = require('../valorant-local');

const VALORANT_QUEUES = {
  competitive: 'Competitive', unrated: 'Unrated', swiftplay: 'Swiftplay',
  deathmatch: 'Deathmatch', spikeRush: 'Spike Rush', custom: 'Custom',
};
const VALORANT_ART = 'https://media.valorant-api.com/Agents/Jett/displayicon.png';
const LOL_ART = 'https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png';

function mapPathToName(p) {
  const last = String(p || '').split('/').filter(Boolean).pop();
  return last ? last.replace(/([a-z])([A-Z])/g, '$1 $2') : null;
}

function queueName(id) {
  const k = String(id || '').trim();
  return VALORANT_QUEUES[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2') || null;
}

function parseValorant(privateData) {
  if (!privateData) return null;
  const loop = String(privateData.sessionLoopState || privateData.partyOwnerSessionLoopState || '').toUpperCase();
  const inGame = loop === 'INGAME';
  const inPregame = loop === 'PREGAME';
  const map = mapPathToName(privateData.partyOwnerMatchMap || privateData.matchMap);
  const mode = queueName(privateData.queueId || privateData.partyOwnerQueueId);
  const ally = Number(privateData.partyOwnerMatchScoreAllyTeam ?? privateData.partyOwnerMatchCurrentTeamRoundScore);
  const enemy = Number(privateData.partyOwnerMatchScoreEnemyTeam);
  const scoreHint = Number.isFinite(ally) && Number.isFinite(enemy) ? `${ally} - ${enemy}` : null;

  let liveLine = null;
  if (inGame) liveLine = [map, mode, scoreHint].filter(Boolean).join(' · ') || 'In match';
  else if (inPregame) liveLine = [map, mode, 'Agent select'].filter(Boolean).join(' · ') || 'Agent select';
  else if (loop !== 'MENUS' && loop !== 'FRONTEND') liveLine = mode || 'In client';

  return {
    provider: 'riot-valorant',
    title: 'Valorant',
    map, mode, scoreHint, liveLine,
    inGame: inGame || inPregame,
    inMatch: inGame,
    inPregame,
    launcher: 'Riot Games',
    artworkUrl: VALORANT_ART,
    updatedAt: Date.now(),
  };
}

function parseLol(privateData) {
  if (!privateData) return null;
  const status = String(privateData.gameStatus || privateData.gamestatus || '').toLowerCase();
  const inGame = status === 'ingame';
  const mode = privateData.gameQueueConfigId ? `Queue ${privateData.gameQueueConfigId}` : null;
  let liveLine = null;
  if (inGame) liveLine = mode ? `${mode} · In game` : 'In game';
  else if (status === 'champselect') liveLine = 'Champ select';
  else if (status === 'inqueue') liveLine = 'In queue';

  return {
    provider: 'riot-lol', title: 'League of Legends', mode, liveLine,
    inGame: inGame || status === 'champselect' || status === 'inqueue',
    inMatch: inGame, launcher: 'Riot Games', artworkUrl: LOL_ART, updatedAt: Date.now(),
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
  const parts = [champ, kda, gameTime].filter(Boolean);
  return { champ, kda, gameTime, liveLine: parts.join(' · ') || null, inMatch: true };
}

async function getRiotLiveSession() {
  const lockfile = readLockfile();
  if (!lockfile) return null;

  const self = await getSelfPresence(lockfile);
  if (!self?.product) return null;

  if (self.product === 'valorant') {
    let session = parseValorant(self.privateData) || {
      provider: 'riot-valorant', title: 'Valorant', liveLine: 'In client',
      launcher: 'Riot Games', artworkUrl: VALORANT_ART, updatedAt: Date.now(),
    };
    if (session.inGame || session.inPregame) {
      const extras = await fetchValorantLocalExtras(lockfile, self.puuid, {
        inGame: session.inMatch,
        inPregame: session.inPregame,
      });
      if (extras) {
        const parts = [extras.agent, extras.kda, extras.scoreHint || session.scoreHint, extras.map || session.map, session.mode].filter(Boolean);
        session = {
          ...session, ...extras,
          scoreHint: extras.scoreHint || session.scoreHint,
          liveLine: parts.join(' · ') || extras.liveLine || session.liveLine,
          inMatch: extras.inMatch ?? session.inMatch,
        };
      }
    }
    return session;
  }

  if (self.product === 'league_of_legends') {
    let session = parseLol(self.privateData) || {
      provider: 'riot-lol', title: 'League of Legends', liveLine: 'In client',
      launcher: 'Riot Games', artworkUrl: LOL_ART, updatedAt: Date.now(),
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

module.exports = { getRiotLiveSession, isRiotGameProcess };
