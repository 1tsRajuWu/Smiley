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
const {
  parseParty, parseValorant, flattenValorantPresence, resolveValorantPhase,
} = require(path.join(root, 'electron/game-providers/riot'));
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

function exclusiveFlags(s) {
  const flags = [s.inLobby, s.inQueue, s.inPregame, s.inMatch].filter(Boolean);
  return flags.length === 1;
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

// ── Nested presence flattening (2025+ Riot shape) ──
const nested = flattenValorantPresence({
  matchPresenceData: { sessionLoopState: 'MENUS' },
  partyPresenceData: {
    partyState: 'MATCHMAKING',
    provisioningFlow: 'Matchmaking',
    queueId: 'competitive',
    partySize: 2,
  },
});
ok('Flatten nested sessionLoopState', nested.sessionLoopState === 'MENUS');
ok('Flatten nested partyState', nested.partyState === 'MATCHMAKING');
ok('Flatten nested queueId', nested.queueId === 'competitive');

// ── Phase resolver: user failure path (lobby → queue → pregame → match) ──
const stepLobby = resolveValorantPhase({
  privateData: { sessionLoopState: 'MENUS', partyState: 'DEFAULT', queueId: 'swiftplay' },
});
ok('Step1 lobby phase', stepLobby.phase === 'lobby' && stepLobby.inLobby && exclusiveFlags(stepLobby));

const stepQueue = resolveValorantPhase({
  privateData: {
    sessionLoopState: 'MENUS',
    partyState: 'MATCHMAKING',
    provisioningFlow: 'Matchmaking',
    queueId: 'competitive',
  },
});
ok('Step2 queue via partyState', stepQueue.phase === 'queue' && stepQueue.inQueue && exclusiveFlags(stepQueue));

const stepPregame = resolveValorantPhase({
  privateData: {
    sessionLoopState: 'PREGAME',
    partyState: 'MATCHMAKING', // sticky — must NOT keep queue
    provisioningFlow: 'Matchmaking',
  },
});
ok('Step3 pregame clears sticky queue', stepPregame.phase === 'pregame' && !stepPregame.inQueue && exclusiveFlags(stepPregame));

const stepMatch = resolveValorantPhase({
  privateData: {
    sessionLoopState: 'INGAME',
    partyState: 'MATCHMAKING',
    provisioningFlow: 'Matchmaking',
  },
});
ok('Step4 match clears sticky queue', stepMatch.phase === 'match' && !stepMatch.inQueue && exclusiveFlags(stepMatch));

// Local truth overrides stale chat presence
const localOverridesStaleChat = resolveValorantPhase({
  privateData: {
    sessionLoopState: 'MENUS',
    partyState: 'MATCHMAKING',
    provisioningFlow: 'Matchmaking',
  },
  localTruth: { inMatch: true, coreGame: true },
});
ok('Local core-game wins over stale queue chat', localOverridesStaleChat.phase === 'match' && !localOverridesStaleChat.inQueue);

const localPregameWins = resolveValorantPhase({
  privateData: { sessionLoopState: 'MENUS', partyState: 'MATCHMAKING' },
  localTruth: { inPregame: true, pregame: true },
});
ok('Local pregame wins over queue chat', localPregameWins.phase === 'pregame' && !localPregameWins.inQueue);

// Sticky provisioningFlow alone in MENUS without partyState → queue (legacy flat)
ok(
  'Legacy provisioningFlow queues in MENUS',
  resolveValorantPhase({
    privateData: { sessionLoopState: 'MENUS', provisioningFlow: 'Matchmaking' },
  }).phase === 'queue',
);

// Sticky provisioningFlow must NOT queue when INGAME (the user bug)
ok(
  'Sticky provisioningFlow ignored in INGAME',
  resolveValorantPhase({
    privateData: { sessionLoopState: 'INGAME', provisioningFlow: 'Matchmaking' },
  }).phase === 'match',
);

ok(
  'Sticky provisioningFlow ignored in PREGAME',
  resolveValorantPhase({
    privateData: { sessionLoopState: 'PREGAME', provisioningFlow: 'Matchmaking' },
  }).phase === 'pregame',
);

// Overlapping flags: local match + chat queue
ok(
  'Overlapping localMatch+chatQueue → match',
  resolveValorantPhase({
    privateData: { sessionLoopState: 'MENUS', partyState: 'MATCHMAKING' },
    localTruth: { inMatch: true },
  }).phase === 'match',
);

const lobbyParsed = parseValorant({
  sessionLoopState: 'MENUS',
  queueId: 'swiftplay',
  partySize: 1,
  partyState: 'DEFAULT',
  partyOwnerMatchScoreAllyTeam: 0,
  partyOwnerMatchScoreEnemyTeam: 0,
});
ok('Lobby MENUS detected', lobbyParsed.inLobby === true && lobbyParsed.inMatch === false);
ok('Lobby exclusive flags', exclusiveFlags(lobbyParsed));
ok('Lobby no fake score', lobbyParsed.scoreHint === null);
ok('Lobby party solo', lobbyParsed.party === 'Solo');
ok('Lobby mode swiftplay', lobbyParsed.mode === 'Swiftplay');
ok('Lobby phase field', lobbyParsed.phase === 'lobby');

const queueParsed = parseValorant({
  sessionLoopState: 'MENUS',
  partyState: 'MATCHMAKING',
  provisioningFlow: 'Matchmaking',
  queueId: 'competitive',
  partySize: 2,
});
ok('Queue matchmaking detected', queueParsed.inQueue === true && !queueParsed.inLobby);
ok('Queue exclusive flags', exclusiveFlags(queueParsed));
ok('Queue phase field', queueParsed.phase === 'queue');

// Nested shape end-to-end through parseValorant
const nestedQueue = parseValorant({
  matchPresenceData: { sessionLoopState: 'MENUS' },
  partyPresenceData: {
    partyState: 'MATCHMAKING',
    provisioningFlow: 'Matchmaking',
    queueId: 'unrated',
    partySize: 3,
  },
});
ok('Nested presence → queue', nestedQueue.inQueue === true && nestedQueue.mode === 'Unrated');
ok('Nested presence party', nestedQueue.party === 'Trio');

const nestedIngameSticky = parseValorant({
  matchPresenceData: { sessionLoopState: 'INGAME', matchMap: '/Game/Maps/Ascent/Ascent' },
  partyPresenceData: {
    partyState: 'MATCHMAKING',
    provisioningFlow: 'Matchmaking',
    queueId: 'competitive',
    partySize: 2,
  },
  partyOwnerMatchScoreAllyTeam: 5,
  partyOwnerMatchScoreEnemyTeam: 3,
});
ok('Nested INGAME not stuck in queue', nestedIngameSticky.inMatch && !nestedIngameSticky.inQueue);
ok('Nested INGAME score', nestedIngameSticky.scoreHint === '5-3');

// Local truth merged into parseValorant
const withLocal = parseValorant(
  { sessionLoopState: 'MENUS', partyState: 'MATCHMAKING', queueId: 'swiftplay' },
  { inMatch: true, agent: 'Jett', agentId: 'add6443a-41bd-e414-f6ad-e58d267f4e95', map: 'Ascent', scoreHint: '2-1' },
);
ok('parseValorant local overrides to match', withLocal.phase === 'match' && withLocal.agent === 'Jett' && !withLocal.inQueue);

const lobbySession = {
  provider: 'riot-valorant',
  title: 'Valorant',
  mode: 'Swiftplay',
  queueId: 'swiftplay',
  party: 'Solo',
  partySize: 1,
  phase: 'lobby',
  inLobby: true,
  inMatch: false,
  inPregame: false,
  inQueue: false,
};
const lobbyLines = buildPresenceLines(lobbySession);
ok('Lobby details = Valorant', lobbyLines.details === 'Valorant');
ok('Lobby state no score', !lobbyLines.state.includes('0-0'));
ok('Lobby state has mode+party', lobbyLines.state.includes('Swiftplay') && lobbyLines.state.includes('Solo') && lobbyLines.state.includes('In lobby'));
ok('Lobby not Queue', !lobbyLines.state.includes('Queue'));

const queueSession = {
  provider: 'riot-valorant',
  title: 'Valorant',
  mode: 'Competitive',
  queueId: 'competitive',
  party: 'Duo',
  partySize: 2,
  phase: 'queue',
  inQueue: true,
  inLobby: false,
  inMatch: false,
  inPregame: false,
};
const queueLines = buildPresenceLines(queueSession);
ok('Queue spelling = Queue', queueLines.state.includes('Queue') && !queueLines.state.includes('Queuing'));
ok('Queue state format', queueLines.state.includes('Competitive') && queueLines.state.includes('2-Stack'));

const pregameSession = {
  provider: 'riot-valorant',
  title: 'Valorant',
  map: 'Haven',
  mapId: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047',
  mode: 'Swiftplay',
  queueId: 'swiftplay',
  party: 'Duo',
  partySize: 2,
  phase: 'pregame',
  inPregame: true,
  inMatch: false,
  inLobby: false,
  inQueue: false,
};
const pregameLines = buildPresenceLines(pregameSession);
ok('Pregame details = map', pregameLines.details === 'Haven');
ok('Pregame state agent select', pregameLines.state.includes('Agent Select') && !pregameLines.state.includes('0-0'));
ok('Pregame not Queue', !pregameLines.state.includes('Queue'));

const lobbyArt = buildPresenceFromSession(lobbySession, { category: 'gaming', state: 'In the zone' });
ok('Lobby large = Valorant logo', lobbyArt.discordImageUrl?.includes('96bd3920-4f36-d026-2b28-c683eb0bcac5'));
ok('Lobby small = mode icon', lobbyArt.smallImageUrl?.includes('/gamemodes/5d0f264b'));

const pregameArt = buildPresenceFromSession(pregameSession, { category: 'gaming', state: 'In the zone' });
ok('Pregame large = Valorant logo', pregameArt.discordImageUrl?.includes('96bd3920-4f36-d026-2b28-c683eb0bcac5'));
ok('Pregame small = map icon', pregameArt.smallImageUrl?.includes('/maps/'));
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
  phase: 'match',
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
ok('In-match not Queue', !valLines.state.includes('Queue') && !valLines.state.includes('Queuing'));

// Sequential transition presence strings (user bug path)
const seq = [
  parseValorant({ sessionLoopState: 'MENUS', partyState: 'DEFAULT', queueId: 'swiftplay', partySize: 1 }),
  parseValorant({ sessionLoopState: 'MENUS', partyState: 'MATCHMAKING', provisioningFlow: 'Matchmaking', queueId: 'swiftplay', partySize: 1 }),
  parseValorant({ sessionLoopState: 'PREGAME', partyState: 'MATCHMAKING', provisioningFlow: 'Matchmaking', queueId: 'swiftplay', partySize: 1 }, { inPregame: true, map: 'Haven' }),
  parseValorant({ sessionLoopState: 'INGAME', partyState: 'MATCHMAKING', provisioningFlow: 'Matchmaking', queueId: 'swiftplay', partySize: 1 }, { inMatch: true, agent: 'Jett', map: 'Haven', scoreHint: '1-0' }),
];
const seqLines = seq.map((s) => buildPresenceLines(s).state);
ok('Seq lobby', seqLines[0].includes('In lobby') && !seqLines[0].includes('Queue'));
ok('Seq queue', seqLines[1].includes('Queue') && !seqLines[1].includes('In lobby'));
ok('Seq agent select', seqLines[2].includes('Agent Select') && !seqLines[2].includes('Queue'));
ok('Seq in match', seqLines[3].includes('Jett') && !seqLines[3].includes('Queue'));

const noRankOpts = normalizeGamingPresenceOptions({ showRank: false });
const noRankLines = buildPresenceLines(valSession, 'In the zone', noRankOpts);
ok('Rank toggle off', !noRankLines.state.includes('Immortal'));

ok('LoL champion icon', assets.lolChampionIcon('Jinx')?.includes('Jinx'));
ok('Steam header', assets.steamHeader(730)?.includes('730'));
ok('Party labels', assets.partyLabel(2) === 'Duo' && assets.partyLabel(5) === 'Full stack');

// Other games must not get Valorant Queue/Lobby labels
const fortniteLines = buildPresenceLines({
  provider: 'fortnite', title: 'Fortnite', mode: 'Battle Royale', party: 'Duo',
});
ok('Fortnite no Queue label', !fortniteLines.state.includes('Queue') && !fortniteLines.state.includes('In lobby'));

const owLines = buildPresenceLines({
  provider: 'overwatch', title: 'Overwatch 2', map: 'Oasis', mode: 'Control', scoreHint: '1-0',
});
ok('Overwatch no Queue label', !owLines.state.includes('Queue') && !owLines.state.includes('Agent Select'));

const lolLines = buildPresenceLines({
  provider: 'riot-lol', title: 'League of Legends', champ: 'Jinx', kda: '3/1/4', inMatch: true, mode: 'Ranked Solo',
});
ok('LoL no Valorant lobby/queue', !lolLines.state.includes('In lobby') && !lolLines.state.includes('Queue') && !lolLines.state.includes('Agent Select'));

const activity = buildPresenceFromSession(valSession, { category: 'gaming', state: 'In the zone' });
ok('Presence has discordImageUrl', /^https:\/\//.test(activity.discordImageUrl));
ok('Presence large = Valorant logo', activity.discordImageUrl.includes('96bd3920-4f36-d026-2b28-c683eb0bcac5'));
ok('Presence small = agent icon', activity.smallImageUrl?.includes('/agents/'));
ok('Presence largeImageText = game title', activity.largeImageText === 'Valorant');
ok('Presence payload phase', activity.gameSession?.phase === 'match');

const sanitized = sanitizeGameSession({
  title: 'Valorant',
  party: 'Duo',
  puuid: 'secret-should-not-appear',
  agent: 'Jett',
  token: 'leak',
  phase: 'queue',
  inQueue: true,
  smallImageUrl: 'https://media.valorant-api.com/agents/x/displayicon.png',
});
ok('Sanitize strips puuid', !('puuid' in sanitized));
ok('Sanitize keeps inQueue', sanitized.inQueue === true);
ok('Sanitize keeps phase', sanitized.phase === 'queue');
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
