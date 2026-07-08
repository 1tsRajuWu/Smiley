#!/usr/bin/env node
/**
 * Game presence self-check — run: npm run game-presence-check
 */
const path = require('path');

const root = path.join(__dirname, '..');
const assets = require(path.join(root, 'electron/game-assets'));
const {
  buildPresenceLines, buildPresenceFromSession, partyDisplay, normalizeGamingPresenceOptions,
} = require(path.join(root, 'electron/presence-builder'));
const { parseParty, parseValorant } = require(path.join(root, 'electron/game-providers/riot'));
const { mergeForegroundWithSession } = require(path.join(root, 'electron/game-providers'));
const { sanitizeGameSession } = require(path.join(root, 'electron/security'));

let pass = 0;
let fail = 0;

function ok(name, cond) {
  if (cond) {
    console.log('  PASS:', name);
    pass += 1;
  } else {
    console.log('  FAIL:', name);
    fail += 1;
  }
}

console.log('=== Smiley Game Presence Self-Check ===\n');

ok('Valorant agent icon HTTPS', /^https:\/\//.test(assets.valorantAgentIcon('9338a55c-4ab7-4634-9ac9-e2e799c4f4d7')));
ok('Valorant mode icon swiftplay', assets.valorantModeIcon('swiftplay')?.includes('5d0f264b-4ebe-cc63-c147-809e1374484b'));
ok('Valorant rank icon', assets.valorantRankIcon(21)?.includes('/competitivetiers/'));
ok('Valorant partySize parsed', parseParty({ partySize: 3 }) === 'Trio');
ok('Valorant partySize solo', parseParty({ partySize: 1 }) === 'Solo');
ok('Valorant partyMembers fallback', parseParty({ partyMembers: ['a', 'b'] }) === 'Duo');
ok('partySizeMax not used as current size', parseParty({ partySizeMax: 5 }) === null);
ok('partyDisplay 2-Stack', partyDisplay('Duo', 2) === '2-Stack');

const lobbyParsed = parseValorant({
  sessionLoopState: 'MENUS',
  queueId: 'swiftplay',
  partySize: 1,
  partyOwnerMatchScoreAllyTeam: 0,
  partyOwnerMatchScoreEnemyTeam: 0,
});
ok('Lobby MENUS detected', lobbyParsed.inLobby === true && lobbyParsed.inMatch === false);
ok('Lobby no fake score', lobbyParsed.scoreHint === null);
ok('Lobby party solo', lobbyParsed.party === 'Solo');
ok('Lobby mode swiftplay', lobbyParsed.mode === 'Swiftplay');

const queueParsed = parseValorant({
  sessionLoopState: 'MENUS',
  provisioningFlow: 'Matchmaking',
  queueId: 'competitive',
  partySize: 2,
});
ok('Queue matchmaking detected', queueParsed.inQueue === true && !queueParsed.inLobby);

const lobbySession = {
  provider: 'riot-valorant',
  title: 'Valorant',
  mode: 'Swiftplay',
  queueId: 'swiftplay',
  party: 'Solo',
  partySize: 1,
  inLobby: true,
  inMatch: false,
  inPregame: false,
  inQueue: false,
};
const lobbyLines = buildPresenceLines(lobbySession);
ok('Lobby details = Valorant', lobbyLines.details === 'Valorant');
ok('Lobby state no score', !lobbyLines.state.includes('0-0'));
ok('Lobby state has mode+party', lobbyLines.state.includes('Swiftplay') && lobbyLines.state.includes('Solo') && lobbyLines.state.includes('In lobby'));

const queueSession = {
  provider: 'riot-valorant',
  title: 'Valorant',
  mode: 'Competitive',
  queueId: 'competitive',
  party: 'Duo',
  partySize: 2,
  inQueue: true,
  inLobby: false,
  inMatch: false,
  inPregame: false,
};
const queueLines = buildPresenceLines(queueSession);
ok('Queue state format', queueLines.state.includes('Queuing') && queueLines.state.includes('Competitive') && queueLines.state.includes('2-Stack'));

const pregameSession = {
  provider: 'riot-valorant',
  title: 'Valorant',
  map: 'Haven',
  mapId: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047',
  mode: 'Swiftplay',
  queueId: 'swiftplay',
  party: 'Duo',
  partySize: 2,
  inPregame: true,
  inMatch: false,
  inLobby: false,
  inQueue: false,
};
const pregameLines = buildPresenceLines(pregameSession);
ok('Pregame details = map', pregameLines.details === 'Haven');
ok('Pregame state agent select', pregameLines.state.includes('Agent Select') && !pregameLines.state.includes('0-0'));

const lobbyArt = buildPresenceFromSession(lobbySession, { category: 'gaming', state: 'In the zone' });
ok('Lobby mode image large', lobbyArt.discordImageUrl?.includes('/gamemodes/'));

const pregameArt = buildPresenceFromSession(pregameSession, { category: 'gaming', state: 'In the zone' });
ok('Pregame map image large', pregameArt.discordImageUrl?.includes('/maps/'));
ok('Pregame agent small image when agentId', (() => {
  const s = { ...pregameSession, agentId: 'add6443a-41bd-e414-f6ad-e58d267f4e95' };
  const a = buildPresenceFromSession(s, { category: 'gaming', state: 'In the zone' });
  return a.smallImageUrl?.includes('/agents/');
})());

const valSession = {
  provider: 'riot-valorant',
  title: 'Valorant',
  map: 'Ascent',
  agent: 'Jett',
  agentId: 'add6443a-41bd-e414-f6ad-e58d267f4e95',
  kda: '12/4/6',
  scoreHint: '8-6',
  mode: 'Swiftplay',
  queueId: 'swiftplay',
  party: 'Duo',
  partySize: 2,
  rank: 'Immortal 2 · 142 RR',
  inMatch: true,
  inLobby: false,
  inPregame: false,
  inQueue: false,
};
const valLines = buildPresenceLines(valSession);
ok('Valorant details = map', valLines.details === 'Ascent');
ok('Valorant state has agent+score', valLines.state.includes('Jett') && valLines.state.includes('8-6') && valLines.state.includes('2-Stack'));
ok('Valorant ingame score order', valLines.state.indexOf('Jett') < valLines.state.indexOf('8-6'));
ok('Valorant rank in state', valLines.state.includes('Immortal 2'));

const noRankOpts = normalizeGamingPresenceOptions({ showRank: false });
const noRankLines = buildPresenceLines(valSession, 'In the zone', noRankOpts);
ok('Rank toggle off', !noRankLines.state.includes('Immortal'));

ok('LoL champion icon', assets.lolChampionIcon('Jinx')?.includes('Jinx'));
ok('Steam header', assets.steamHeader(730)?.includes('730'));
ok('Party labels', assets.partyLabel(2) === 'Duo' && assets.partyLabel(5) === 'Full stack');

const activity = buildPresenceFromSession(valSession, { category: 'gaming', state: 'In the zone' });
ok('Presence has discordImageUrl', /^https:\/\//.test(activity.discordImageUrl));
ok('Presence map image large in match', activity.discordImageUrl.includes('/maps/'));
ok('Presence agent small image', activity.smallImageUrl?.includes('/agents/'));

const sanitized = sanitizeGameSession({
  title: 'Valorant',
  party: 'Duo',
  puuid: 'secret-should-not-appear',
  agent: 'Jett',
  token: 'leak',
  inQueue: true,
  smallImageUrl: 'https://media.valorant-api.com/agents/x/displayicon.png',
});
ok('Sanitize strips puuid', !('puuid' in sanitized));
ok('Sanitize keeps inQueue', sanitized.inQueue === true);
ok('Sanitize keeps smallImageUrl', sanitized.smallImageUrl?.includes('valorant-api'));

const riotLobby = {
  provider: 'riot-valorant',
  title: 'Valorant',
  mode: 'Unrated',
  inGame: false,
  inMatch: false,
};
const merged = mergeForegroundWithSession(
  riotLobby,
  { title: 'VALORANT', processName: 'VALORANT', windowTitle: 'VALORANT' },
);
ok('Riot session not overridden by window', merged?.provider === 'riot-valorant');
ok('Riot mode preserved in lobby', merged?.mode === 'Unrated');

console.log(`\nResult: ${pass}/${pass + fail} checks passed`);
process.exit(fail > 0 ? 1 : 0);
