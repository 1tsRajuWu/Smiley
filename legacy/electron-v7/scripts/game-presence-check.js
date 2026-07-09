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
const { mergeForegroundWithSession, shouldPreferForegroundOverRiot, sessionSignature } = require(path.join(root, 'electron/game-providers'));
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

const JETT_ID = 'add6443a-41bd-e414-f6ad-e58d267f4e95';
const VAL_LOGO = assets.VALORANT_GAME_LOGO || assets.GAME_LOGOS['riot-valorant'];

ok('Valorant agent icon HTTPS', /^https:\/\//.test(assets.valorantAgentIcon(JETT_ID)));
ok('Valorant mode icon swiftplay', assets.valorantModeIcon('swiftplay')?.includes('5d0f264b-4ebe-cc63-c147-809e1374484b'));
ok('Valorant rank icon', assets.valorantRankIcon(21)?.includes('/competitivetiers/'));
ok('Valorant GAME_LOGOS is brand V logo', VAL_LOGO?.includes('cmsassets.rgpub.io') && VAL_LOGO.includes('cbf4460132cdfeb2a97fad5f9dd25ba0bc058f76'));
ok('Valorant logo is NOT gamemode/map UUID', !VAL_LOGO?.includes('/gamemodes/') && !VAL_LOGO?.includes('/maps/'));
ok('Valorant partySize parsed', parseParty({ partySize: 3 }) === 'Trio');
ok('Valorant partySize solo', parseParty({ partySize: 1 }) === 'Solo');
ok('Valorant partyMembers fallback', parseParty({ partyMembers: ['a', 'b'] }) === 'Duo');
ok('partySizeMax not used as current size', parseParty({ partySizeMax: 5 }) === null);
ok('partyDisplay 2-Stack', partyDisplay('Duo', 2) === '2-Stack');

// AllyTeam.Players CharacterID extraction (user bug: agent missing)
const {
  findPlayer, pregamePlayerList, coreGamePlayerList, characterIdOf, pickAgentId,
  playersArray, mergeAgentFields,
} = require(path.join(root, 'electron/valorant-local'));
const { agentDisplayName } = require(path.join(root, 'electron/valorant-catalog'));
const pregameMatchShape = {
  MapID: '/Game/Maps/Lotus/Lotus',
  AllyTeam: {
    Players: [
      { Subject: 'puuid-me', CharacterID: JETT_ID },
      { Subject: 'puuid-other', CharacterID: '00000000-0000-0000-0000-000000000000' },
    ],
  },
};
ok('Pregame AllyTeam.Players flattened', pregamePlayerList(pregameMatchShape).length === 2);
ok('Pregame findPlayer by Subject', findPlayer(pregamePlayerList(pregameMatchShape), 'puuid-me')?.CharacterID === JETT_ID);
ok('characterIdOf ignores empty UUID', characterIdOf({ CharacterID: '00000000-0000-0000-0000-000000000000' }) === null);
ok('characterIdOf reads CharacterID', characterIdOf({ CharacterID: JETT_ID }) === JETT_ID);
ok('characterIdOf reads AgentID', characterIdOf({ AgentID: JETT_ID }) === JETT_ID);
ok('characterIdOf reads PlayerIdentity.CharacterID', characterIdOf({
  PlayerIdentity: { Subject: 'x', CharacterID: JETT_ID },
}) === JETT_ID);
ok('characterIdOf reads Character string UUID', characterIdOf({ Character: JETT_ID }) === JETT_ID);
ok('playersArray from puuid-keyed object', playersArray({
  'puuid-me': { Subject: 'puuid-me', CharacterID: JETT_ID },
}).length === 1);
ok('findPlayer in object-shaped Players', findPlayer({
  'puuid-me': { Subject: 'puuid-me', CharacterID: JETT_ID },
}, 'puuid-me')?.CharacterID === JETT_ID);
ok('coreGamePlayerList uses Players object map', coreGamePlayerList({
  Players: { me: { Subject: 'me', CharacterID: JETT_ID } },
}).length === 1);
ok('pregame Teams[] fallback', pregamePlayerList({
  Teams: [{ Players: [{ Subject: 'puuid-me', CharacterID: JETT_ID }] }],
}).length === 1);
ok('pregame EnemyTeam.Players', pregamePlayerList({
  EnemyTeam: { Players: [{ Subject: 'puuid-me', CharacterID: JETT_ID }] },
}).length === 1);
ok('pickAgentId prefers match row then player endpoint', pickAgentId(
  { CharacterID: '00000000-0000-0000-0000-000000000000' },
  { CharacterID: JETT_ID },
) === JETT_ID);
ok('mergeAgentFields fills core from pregame', (() => {
  const merged = mergeAgentFields(
    { inMatch: true, agent: null, agentId: null, map: 'Ascent' },
    { inPregame: true, agent: 'Jett', agentId: JETT_ID },
  );
  return merged.agent === 'Jett' && merged.agentId === JETT_ID && merged.map === 'Ascent';
})());
ok('mergeAgentFields keeps core agent when present', mergeAgentFields(
  { agent: 'Reyna', agentId: 'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc' },
  { agent: 'Jett', agentId: JETT_ID },
).agent === 'Reyna');
ok('Offline agentDisplayName Jett', agentDisplayName(JETT_ID) === 'Jett');
ok('Agent label from agentId only', (() => {
  const { valorantAgentLabel } = require(path.join(root, 'electron/presence-builder'));
  return valorantAgentLabel({ agentId: JETT_ID }, { showAgent: true }) === 'Jett';
})());
ok('showAgent false hides agent label', (() => {
  const { valorantAgentLabel } = require(path.join(root, 'electron/presence-builder'));
  return valorantAgentLabel({ agent: 'Jett', agentId: JETT_ID }, { showAgent: false }) === null;
})());
ok('normalizeGamingPresenceOptions showAgent default on', normalizeGamingPresenceOptions({}).showAgent === true);
ok('In-match details from agentId only', (() => {
  const lines = buildPresenceLines({
    provider: 'riot-valorant',
    title: 'Valorant',
    inMatch: true,
    phase: 'match',
    agentId: JETT_ID,
    map: 'Ascent',
    mode: 'Competitive',
    queueId: 'competitive',
  });
  return lines.details.includes('Jett') && lines.details.includes('Ascent');
})());

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
ok('Pregame details = Agent Select', pregameLines.details === 'Agent Select');
ok('Pregame state has mode+map', pregameLines.state.includes('Swiftplay') && pregameLines.state.includes('Haven'));
ok('Pregame not Queue', !pregameLines.state.includes('Queue'));

const pregameWithAgent = {
  ...pregameSession,
  agent: 'Jett',
  agentId: JETT_ID,
  map: 'Lotus',
  mode: 'Competitive',
  queueId: 'competitive',
};
const pregameAgentLines = buildPresenceLines(pregameWithAgent);
ok('Pregame+agent details', pregameAgentLines.details === 'Jett · Agent Select');
ok('Pregame+agent state', pregameAgentLines.state.includes('Competitive') && pregameAgentLines.state.includes('Lotus'));

const lobbyArt = buildPresenceFromSession(lobbySession, { category: 'gaming', state: 'In the zone' });
ok('Lobby large = Valorant brand logo', lobbyArt.discordImageUrl === VAL_LOGO || lobbyArt.discordImageUrl?.includes('cbf4460132cdfeb2a97fad5f9dd25ba0bc058f76'));
ok('Lobby large not map/mode art', !lobbyArt.discordImageUrl?.includes('/maps/') && !lobbyArt.discordImageUrl?.includes('/gamemodes/'));
ok('Lobby small = mode icon', lobbyArt.smallImageUrl?.includes('/gamemodes/5d0f264b'));

const pregameArt = buildPresenceFromSession(pregameSession, { category: 'gaming', state: 'In the zone' });
ok('Pregame large = Valorant brand logo', pregameArt.discordImageUrl?.includes('cbf4460132cdfeb2a97fad5f9dd25ba0bc058f76'));
ok('Pregame large not map', !pregameArt.discordImageUrl?.includes('/maps/'));
ok('Pregame small = map icon', pregameArt.smallImageUrl?.includes('/maps/'));
ok('Pregame agent small image when agentId', (() => {
  const a = buildPresenceFromSession(pregameWithAgent, { category: 'gaming', state: 'In the zone' });
  return a.smallImageUrl?.includes(`/agents/${JETT_ID}`);
})());

const valSession = {
  provider: 'riot-valorant',
  title: 'Valorant',
  map: 'Ascent',
  agent: 'Jett',
  agentId: JETT_ID,
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
ok('In-match details has agent+map', valLines.details.includes('Jett') && valLines.details.includes('Ascent'));
ok('In-match state has score+party+mode', valLines.state.includes('8-6') && valLines.state.includes('2-Stack') && valLines.state.includes('Swiftplay'));
ok('In-match agent not omitted', valLines.details.includes('Jett') || valLines.state.includes('Jett'));
ok('Valorant rank in state', valLines.state.includes('Immortal 2'));
ok('In-match not Queue', !valLines.state.includes('Queue') && !valLines.state.includes('Queuing'));

// Sequential transition presence strings (user bug path)
const seq = [
  parseValorant({ sessionLoopState: 'MENUS', partyState: 'DEFAULT', queueId: 'swiftplay', partySize: 1 }),
  parseValorant({ sessionLoopState: 'MENUS', partyState: 'MATCHMAKING', provisioningFlow: 'Matchmaking', queueId: 'swiftplay', partySize: 1 }),
  parseValorant({ sessionLoopState: 'PREGAME', partyState: 'MATCHMAKING', provisioningFlow: 'Matchmaking', queueId: 'swiftplay', partySize: 1 }, { inPregame: true, map: 'Haven', agent: 'Jett', agentId: JETT_ID }),
  parseValorant({ sessionLoopState: 'INGAME', partyState: 'MATCHMAKING', provisioningFlow: 'Matchmaking', queueId: 'swiftplay', partySize: 1 }, { inMatch: true, agent: 'Jett', agentId: JETT_ID, map: 'Haven', scoreHint: '1-0' }),
];
const seqLines = seq.map((s) => buildPresenceLines(s));
ok('Seq lobby', seqLines[0].state.includes('In lobby') && !seqLines[0].state.includes('Queue'));
ok('Seq queue', seqLines[1].state.includes('Queue') && !seqLines[1].state.includes('In lobby'));
ok('Seq agent select', seqLines[2].details.includes('Agent Select') && seqLines[2].details.includes('Jett') && !seqLines[2].state.includes('Queue'));
ok('Seq in match', (seqLines[3].details.includes('Jett') || seqLines[3].state.includes('Jett')) && !seqLines[3].state.includes('Queue'));

const noRankOpts = normalizeGamingPresenceOptions({ showRank: false });
const noRankLines = buildPresenceLines(valSession, 'In the zone', noRankOpts);
ok('Rank toggle off', !noRankLines.state.includes('Immortal'));

ok('LoL champion icon', assets.lolChampionIcon('Jinx')?.includes('Jinx'));
ok('Steam header', assets.steamHeader(730)?.includes('730'));
ok('Steam CS2 capsule (light)', assets.steamCapsule(730)?.includes('/730/capsule_231x87.jpg'));
ok('Steam artwork prefers capsule not library_600x900', assets.steamArtworkCandidates(730)[0]?.includes('capsule_231x87'));
ok('Steam logo alias returns capsule not logo.png', assets.steamLogo(730)?.includes('capsule_231x87'));
ok('Party labels', assets.partyLabel(2) === 'Duo' && assets.partyLabel(5) === 'Full stack');
ok('Gaming fallback is Smiley logo (not spinner)', assets.GAMING_FALLBACK === assets.SMILEY_LOGO && !/loading-gif/i.test(assets.GAMING_FALLBACK));
ok('Valorant logo is 128×128 CDN', VAL_LOGO.includes('128x128') && VAL_LOGO.includes('cmsassets.rgpub.io'));
ok('Unknown game artwork → Smiley logo', assets.resolveGameArtwork({ provider: 'window', title: 'TotallyUnknownGameXYZ' }) === assets.SMILEY_LOGO);
ok('CS2 session with AppID → capsule URL', assets.resolveGameArtwork({ provider: 'window', title: 'Counter-Strike 2', steamAppId: 730 })?.includes('/730/capsule_231x87.jpg'));
ok('Spinner URL detector', assets.isSpinnerFallbackUrl('https://media.tenor.com/On7kvXhzml4AAAAi/loading-gif.gif'));

const {
  matchKnownGame, isIgnoredProcess, findKnownGamesInProcessList, pickStickyGame, normalizeGame, gameSig,
  isProcessRunningForGame, isRiotProviderProcessRunning,
} = require(path.join(root, 'electron/now-gaming'));
ok('Known game matches cs2', matchKnownGame('cs2')?.id === 'cs2');
ok('Known game matches VALORANT-Win64-Shipping', matchKnownGame('VALORANT-Win64-Shipping')?.id === 'valorant');
ok('Discord ignored for gaming clear', isIgnoredProcess('Discord') && isIgnoredProcess('Google Chrome'));
ok('CS2 not ignored', !isIgnoredProcess('cs2'));
ok('Process scan finds CS2+Valorant', findKnownGamesInProcessList(['Discord', 'cs2', 'chrome', 'VALORANT-Win64-Shipping']).length === 2);
ok('Sticky prefers last CS2 when Discord focused', pickStickyGame(
  findKnownGamesInProcessList(['Discord', 'cs2', 'chrome']),
  'cs2',
)?.title === 'Counter-Strike 2');
ok('Sticky sole running game', pickStickyGame(findKnownGamesInProcessList(['Discord', 'cs2']), '')?.knownGameId === 'cs2');
ok('Sticky multi-game no preference → null (keep caller)', pickStickyGame(
  findKnownGamesInProcessList(['cs2', 'dota2']),
  '',
) === null);
ok('Normalize Discord → null', normalizeGame({ processName: 'Discord', windowTitle: 'friends' }) === null);
ok('Normalize CS2 title', normalizeGame({ processName: 'cs2', windowTitle: '' })?.title === 'Counter-Strike 2');
ok('gameSig ignores sticky vs focused thrash', gameSig({ title: 'Counter-Strike 2', processName: 'cs2', sticky: true })
  === gameSig({ title: 'Counter-Strike 2', processName: 'cs2', sticky: false }));
ok('Process running detects cs2', isProcessRunningForGame(['Discord', 'cs2'], { processName: 'cs2', knownGameId: 'cs2' }));
ok('Process gone clears sticky CS2', !isProcessRunningForGame(['Discord', 'chrome'], { processName: 'cs2', knownGameId: 'cs2' }));
ok('Valorant process required for riot-valorant', isRiotProviderProcessRunning(['VALORANT-Win64-Shipping', 'RiotClientServices'], 'riot-valorant'));
ok('Riot Client alone is not Valorant running', !isRiotProviderProcessRunning(['RiotClientServices', 'Discord'], 'riot-valorant'));
ok('Idle template strips live game artwork', (() => {
  const cleared = buildPresenceFromSession(null, {
    category: 'gaming',
    state: 'In the zone',
    details: 'Counter-Strike 2',
    discordImageUrl: 'https://cdn.steam/730/capsule.jpg',
    smallImageUrl: 'https://cdn.steam/mark.png',
    gameSession: { title: 'Counter-Strike 2' },
  });
  return cleared.details === 'Gaming'
    && cleared.gameSession === null
    && !cleared.discordImageUrl
    && !cleared.smallImageUrl;
})());

const { resolveSteamAppIdAlias, STEAM_APP_ALIASES } = require(path.join(root, 'electron/game-api'));
ok('CS2 alias → AppID 730', resolveSteamAppIdAlias('cs2') === 730 && resolveSteamAppIdAlias('Counter-Strike 2') === 730);
ok('Alias table has CS2', STEAM_APP_ALIASES.cs2 === 730);

const cs2Art = buildPresenceFromSession({
  provider: 'window',
  title: 'Counter-Strike 2',
  processName: 'cs2',
  knownGameId: 'cs2',
  steamAppId: 730,
  steamArtworkUrl: assets.steamCapsule(730),
  launcher: 'Steam',
}, { category: 'gaming', state: 'In the zone' });
ok('CS2 presence large_image is Steam capsule', cs2Art.discordImageUrl?.includes('capsule_231x87.jpg') && cs2Art.discordImageUrl.includes('730'));
ok('CS2 presence not spinner', !/loading-gif/i.test(cs2Art.discordImageUrl || ''));
ok('CS2 details = game title', cs2Art.details === 'Counter-Strike 2');
ok('CS2 state is Playing (not In the zone)', cs2Art.state === 'Playing');
ok('CS2 not vague zone fluff', !/in the zone/i.test(cs2Art.state || ''));
ok('CS2 small_image has Steam mark', cs2Art.smallImageUrl === assets.STEAM_MARK
  || /steamstatic\.com.*\/753\//.test(cs2Art.smallImageUrl || ''));

const cs2LobbyArt = buildPresenceFromSession({
  provider: 'window',
  title: 'Counter-Strike 2',
  steamAppId: 730,
  steamArtworkUrl: assets.steamCapsule(730),
  inLobby: true,
  phase: 'lobby',
}, { category: 'gaming', state: 'In the zone' });
ok('CS2 lobby state In lobby', cs2LobbyArt.state === 'In lobby');
ok('CS2 lobby still capsule', cs2LobbyArt.discordImageUrl?.includes('/730/capsule_231x87.jpg'));

const cs2MatchArt = buildPresenceFromSession({
  provider: 'window',
  title: 'Counter-Strike 2',
  steamAppId: 730,
  steamArtworkUrl: assets.steamCapsule(730),
  inMatch: true,
  phase: 'match',
  mode: 'Competitive',
}, { category: 'gaming', state: 'In the zone' });
ok('CS2 match In match + mode', cs2MatchArt.state.includes('In match') && cs2MatchArt.state.includes('Competitive'));

const cs2Norm = normalizeGame({ processName: 'cs2', windowTitle: '' });
ok('CS2 normalize attaches AppID 730', cs2Norm?.steamAppId === 730);
ok('CS2 normalize attaches Steam capsule', cs2Norm?.steamArtworkUrl?.includes('/730/capsule'));
ok('CS2 normalize branded title', cs2Norm?.title === 'Counter-Strike 2');

const unknownArt = buildPresenceFromSession({
  provider: 'window',
  title: 'SomeIndieNoSteamMatch',
}, { category: 'gaming', state: 'In the zone' });
ok('Unknown game large_image = Smiley logo (no spinner)', unknownArt.discordImageUrl === assets.SMILEY_LOGO);
ok('Unknown game not loading-gif', !/loading-gif|On7kvXhzml4/i.test(unknownArt.discordImageUrl || ''));
ok('Unknown game state Playing not zone', unknownArt.state === 'Playing');

// Other games must not get Valorant Queue/Lobby labels
const fortniteLines = buildPresenceLines({
  provider: 'fortnite', title: 'Fortnite', mode: 'Battle Royale', party: 'Duo',
});
ok('Fortnite no Queue label', !fortniteLines.state.includes('Queue'));
ok('Fortnite details = Fortnite', fortniteLines.details === 'Fortnite');
ok('Fortnite state has mode+party', fortniteLines.state.includes('Battle Royale') && fortniteLines.state.includes('Duo'));

const fortniteArt = buildPresenceFromSession({
  provider: 'fortnite', title: 'Fortnite', mode: 'Battle Royale', party: 'Duo', inMatch: true,
}, { category: 'gaming', state: 'In the zone' });
ok('Fortnite large_image is Twitch CDN', fortniteArt.discordImageUrl === assets.GAME_LOGOS.fortnite
  && /jtvnw\.net/.test(fortniteArt.discordImageUrl || ''));
ok('Fortnite state not In the zone', fortniteArt.state !== 'In the zone');
ok('GAME_LOGOS fortnite/ow/roblox/minecraft are Twitch', [
  assets.GAME_LOGOS.fortnite,
  assets.GAME_LOGOS.overwatch,
  assets.GAME_LOGOS.roblox,
  assets.GAME_LOGOS.minecraft,
].every((u) => /static-cdn\.jtvnw\.net/.test(u || '')));

const owLines = buildPresenceLines({
  provider: 'overwatch', title: 'Overwatch 2', map: 'Oasis', mode: 'Control', scoreHint: '1-0',
});
ok('Overwatch no Queue label', !owLines.state.includes('Queue') && !owLines.state.includes('Agent Select'));
ok('Overwatch presence logo Twitch', buildPresenceFromSession(
  { provider: 'overwatch', title: 'Overwatch 2', map: 'Oasis', mode: 'Control' },
  { category: 'gaming', state: 'Playing' },
).discordImageUrl === assets.GAME_LOGOS.overwatch);

const lolLines = buildPresenceLines({
  provider: 'riot-lol', title: 'League of Legends', champ: 'Jinx', kda: '3/1/4', inMatch: true, mode: 'Ranked Solo',
});
ok('LoL no Valorant lobby/queue', !lolLines.state.includes('In lobby') && !lolLines.state.includes('Queue') && !lolLines.state.includes('Agent Select'));

const activity = buildPresenceFromSession(valSession, { category: 'gaming', state: 'In the zone' });
ok('Presence has discordImageUrl', /^https:\/\//.test(activity.discordImageUrl));
ok('Presence large = brand V logo URL', activity.discordImageUrl.includes('cbf4460132cdfeb2a97fad5f9dd25ba0bc058f76'));
ok('Presence large NOT map/mode', !activity.discordImageUrl.includes('/maps/') && !activity.discordImageUrl.includes('/gamemodes/'));
ok('Presence small = agent icon', activity.smallImageUrl?.includes(`/agents/${JETT_ID}`));
ok('Presence largeImageText = game title', activity.largeImageText === 'Valorant');
ok('Presence smallImageText = agent', activity.smallImageText === 'Jett');
ok('Presence payload phase', activity.gameSession?.phase === 'match');
ok('Presence details has agent', activity.details.includes('Jett'));

// Screenshot regression: Ascent + 2-0 Solo must include agent when CharacterID known
const screenshotReg = buildPresenceFromSession({
  provider: 'riot-valorant',
  title: 'Valorant',
  map: 'Ascent',
  mapId: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319',
  agent: 'Jett',
  agentId: JETT_ID,
  scoreHint: '2-0',
  party: 'Solo',
  partySize: 1,
  mode: 'Competitive',
  queueId: 'competitive',
  phase: 'match',
  inMatch: true,
}, { category: 'gaming', state: 'In the zone' });
ok('Screenshot regression agent in text', screenshotReg.details.includes('Jett') || screenshotReg.state.includes('Jett'));
ok('Screenshot regression score+party', screenshotReg.state.includes('2-0') && (screenshotReg.state.includes('Solo') || screenshotReg.state.includes('1-Stack')));
ok('Screenshot regression large is V logo', screenshotReg.discordImageUrl?.includes('cbf4460132cdfeb2a97fad5f9dd25ba0bc058f76'));
ok('Screenshot regression small is agent', screenshotReg.smallImageUrl?.includes('/agents/'));

const sanitized = sanitizeGameSession({
  title: 'Valorant',
  party: 'Duo',
  puuid: 'secret-should-not-appear',
  agent: 'Jett',
  agentId: JETT_ID,
  token: 'leak',
  phase: 'queue',
  inQueue: true,
  smallImageUrl: 'https://media.valorant-api.com/agents/x/displayicon.png',
});
ok('Sanitize strips puuid', !('puuid' in sanitized));
ok('Sanitize keeps inQueue', sanitized.inQueue === true);
ok('Sanitize keeps phase', sanitized.phase === 'queue');
ok('Sanitize keeps agent', sanitized.agent === 'Jett');
ok('Sanitize keeps agentId', sanitized.agentId === JETT_ID.toLowerCase());
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

// CS2 foreground must beat stale Valorant lobby (user bug: playing CS but not updating)
const cs2Foreground = {
  title: 'Counter-Strike 2',
  processName: 'cs2',
  knownGameId: 'cs2',
  steamAppId: 730,
  steamArtworkUrl: assets.steamCapsule(730),
  launcher: 'Steam',
  focused: true,
};
ok('CS2 beats Valorant lobby merge', mergeForegroundWithSession(riotLobby, cs2Foreground)?.title === 'Counter-Strike 2');
ok('CS2 merge provider window', mergeForegroundWithSession(riotLobby, cs2Foreground)?.provider === 'window');
ok('CS2 merge keeps AppID 730', mergeForegroundWithSession(riotLobby, cs2Foreground)?.steamAppId === 730);
ok('Sticky CS2 beats Valorant queue', mergeForegroundWithSession(
  { ...riotLobby, inQueue: true, phase: 'queue', inLobby: false },
  { ...cs2Foreground, focused: false, sticky: true },
)?.title === 'Counter-Strike 2');
ok('Valorant in-match kept when alt-tabbed', mergeForegroundWithSession(
  { provider: 'riot-valorant', title: 'Valorant', inMatch: true, phase: 'match', map: 'Ascent' },
  { title: 'Discord', processName: 'Discord', focused: false },
)?.provider === 'riot-valorant');
ok('shouldPreferForeground CS2 over lobby', shouldPreferForegroundOverRiot(riotLobby, cs2Foreground) === true);
ok('shouldPreferForeground not for Valorant proc', shouldPreferForegroundOverRiot(riotLobby, {
  title: 'VALORANT', processName: 'VALORANT', focused: true,
}) === false);

const cs2Session = mergeForegroundWithSession(riotLobby, cs2Foreground);
const cs2Sig = sessionSignature(cs2Session);
const valSig = sessionSignature(riotLobby);
ok('CS2 session sig differs from Valorant lobby', cs2Sig !== valSig && cs2Sig.includes('Counter-Strike 2'));
ok('macOS Counter-Strike 2 process name', matchKnownGame('Counter-Strike 2')?.id === 'cs2');
ok('macOS normalize Counter-Strike 2', normalizeGame({ processName: 'Counter-Strike 2', windowTitle: '' })?.knownGameId === 'cs2');

// Dota 2 / other Steam games share the same foreground-over-riot path
const dotaFg = { title: 'Dota 2', processName: 'dota2', knownGameId: 'dota2', focused: true };
ok('Dota 2 beats Valorant lobby', mergeForegroundWithSession(riotLobby, dotaFg)?.title === 'Dota 2');

// ── Map / mode catalog (DM, TDM, new maps, alternate queues) ──
const catalog = require(path.join(root, 'electron/valorant-catalog'));
const { mapName: localMapName } = require(path.join(root, 'electron/valorant-local'));

ok('Map Summit via Plummet path', catalog.resolveMap('/Game/Maps/Plummet/Plummet').name === 'Summit');
ok('Map Lotus via Jam path', catalog.resolveMap('/Game/Maps/Jam/Jam').name === 'Lotus');
ok('Map District via HURM_Alley', catalog.resolveMap('/Game/Maps/HURM/HURM_Alley/HURM_Alley').name === 'District');
ok('Map Kasbah via HURM_Bowl', catalog.resolveMap('/Game/Maps/HURM/HURM_Bowl/HURM_Bowl').name === 'Kasbah');
ok('Map Glitch via HURM_HighTide', catalog.resolveMap('/Game/Maps/HURM/HURM_HighTide/HURM_HighTide').name === 'Glitch');
ok('Map Corrode via Rook', catalog.resolveMap('/Game/Maps/Rook/Rook').name === 'Corrode');
ok('Unknown map UUID keeps uuid mapId', (() => {
  const u = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const r = catalog.resolveMap(u);
  return r.uuid === u && r.mapId === u && r.name === null;
})());
ok('Unknown map path graceful fallback', (() => {
  const r = catalog.resolveMap('/Game/Maps/FutureMap/FutureMap_V2');
  return r.name && /Future/i.test(r.name) && !r.uuid;
})());
ok('local mapName matches catalog', localMapName('/Game/Maps/Plummet/Plummet') === 'Summit');

ok('Queue hurm = Team Deathmatch', catalog.queueDisplayName('hurm') === 'Team Deathmatch');
ok('Queue onefa legacy = Team Deathmatch', catalog.queueDisplayName('onefa') === 'Team Deathmatch');
ok('Queue fortcollins = Retake', catalog.queueDisplayName('fortcollins') === 'Retake');
ok('Queue spikerush = Spike Rush', catalog.queueDisplayName('spikerush') === 'Spike Rush');
ok('Queue ggteam = Escalation', catalog.queueDisplayName('ggteam') === 'Escalation');
ok('Mode icon hurm', assets.valorantModeIcon('hurm')?.includes('e086db66-47fd-e791-ca81-06a645ac7661'));
ok('Mode icon deathmatch', assets.valorantModeIcon('deathmatch')?.includes('a8790ec5-4237-f2f0-e93b-08a8e89865b2'));
ok('Map icon Summit UUID', assets.valorantMapIcon('summit')?.includes('756da597-416b-c0f2-f47b-afbdf28670bc'));
ok('Map icon HURM District path', assets.valorantMapIcon('/Game/Maps/HURM/HURM_Alley/HURM_Alley')?.includes('690b3ed2'));

// Deathmatch session — no fake round score, agent + map, Solo, kills scoreHint
const dmParsed = parseValorant(
  {
    sessionLoopState: 'INGAME',
    partyState: 'DEFAULT',
    queueId: 'deathmatch',
    partySize: 1,
    matchMap: '/Game/Maps/Ascent/Ascent',
    partyOwnerMatchScoreAllyTeam: 2,
    partyOwnerMatchScoreEnemyTeam: 0,
  },
  {
    inMatch: true,
    agent: 'Jett',
    agentId: JETT_ID,
    map: 'Ascent',
    mapId: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319',
    queueId: 'deathmatch',
    kda: '14/7/2',
    scoreHint: '14 kills',
  },
);
ok('DM phase match', dmParsed.phase === 'match' && dmParsed.inMatch);
ok('DM mode Deathmatch', dmParsed.mode === 'Deathmatch');
ok('DM map Ascent', dmParsed.map === 'Ascent');
ok('DM no fake round score', dmParsed.scoreHint === '14 kills' && !/^\d+-\d+$/.test(dmParsed.scoreHint));
ok('DM Solo party', dmParsed.party === 'Solo' && dmParsed.partySize === 1);
ok('DM agent present', dmParsed.agent === 'Jett');
const dmLines = buildPresenceLines(dmParsed);
ok('DM details agent+map', dmLines.details.includes('Jett') && dmLines.details.includes('Ascent'));
ok('DM state has kills+mode', dmLines.state.includes('14 kills') && dmLines.state.includes('Deathmatch'));
ok('DM state has Solo', dmLines.state.includes('Solo'));
ok('DM not Queue', !dmLines.state.includes('Queue'));
const dmArt = buildPresenceFromSession(dmParsed, { category: 'gaming', state: 'In the zone' });
ok('DM small = agent', dmArt.smallImageUrl?.includes(`/agents/${JETT_ID}`));

// Team Deathmatch session — hurm queue + HURM map
const tdmParsed = parseValorant(
  {
    sessionLoopState: 'INGAME',
    partyState: 'DEFAULT',
    queueId: 'hurm',
    partySize: 3,
    matchMap: '/Game/Maps/HURM/HURM_Bowl/HURM_Bowl',
    partyOwnerMatchScoreAllyTeam: 62,
    partyOwnerMatchScoreEnemyTeam: 48,
  },
  {
    inMatch: true,
    agent: 'Sage',
    agentId: '569fdd95-4d10-43ab-ca70-79becc265df1',
    map: 'Kasbah',
    mapId: '12452a9d-48c3-0b02-e7eb-0381c3520404',
    queueId: 'hurm',
    scoreHint: '62-48',
    kda: '9/5/3',
  },
);
ok('TDM phase match', tdmParsed.phase === 'match');
ok('TDM mode Team Deathmatch', tdmParsed.mode === 'Team Deathmatch');
ok('TDM map Kasbah (not HURM_Bowl)', tdmParsed.map === 'Kasbah');
ok('TDM team score', tdmParsed.scoreHint === '62-48');
ok('TDM Trio', tdmParsed.party === 'Trio');
const tdmLines = buildPresenceLines(tdmParsed);
ok('TDM details agent+map', tdmLines.details.includes('Sage') && tdmLines.details.includes('Kasbah'));
ok('TDM state score+mode', tdmLines.state.includes('62-48') && tdmLines.state.includes('Team Deathmatch'));
ok('TDM not Queue / not Unknown', !tdmLines.state.includes('Queue') && !tdmLines.state.includes('Unknown'));

// TDM without localTruth still resolves HURM map path from chat
const tdmChatOnly = parseValorant({
  sessionLoopState: 'INGAME',
  queueId: 'hurm',
  partySize: 1,
  matchMap: '/Game/Maps/HURM/HURM_Alley/HURM_Alley',
  partyOwnerMatchScoreAllyTeam: 10,
  partyOwnerMatchScoreEnemyTeam: 8,
});
ok('TDM chat-only map District', tdmChatOnly.map === 'District');
ok('TDM chat-only mode', tdmChatOnly.mode === 'Team Deathmatch');
ok('TDM chat-only score from presence', tdmChatOnly.scoreHint === '10-8');

// Spike Rush alternate mode
const spikeParsed = parseValorant(
  {
    sessionLoopState: 'INGAME',
    queueId: 'spikerush',
    partySize: 2,
    matchMap: '/Game/Maps/Rook/Rook',
    partyOwnerMatchScoreAllyTeam: 3,
    partyOwnerMatchScoreEnemyTeam: 1,
  },
  {
    inMatch: true,
    agent: 'Jett',
    agentId: JETT_ID,
    map: 'Corrode',
    mapId: '1c18ab1f-420d-0d8b-71d0-77ad3c439115',
    scoreHint: '3-1',
  },
);
ok('Spike Rush mode', spikeParsed.mode === 'Spike Rush');
ok('Spike Rush map Corrode', spikeParsed.map === 'Corrode');
const spikeLines = buildPresenceLines(spikeParsed);
ok('Spike Rush presence', spikeLines.details.includes('Corrode') && spikeLines.state.includes('Spike Rush'));

// Swiftplay still works (regression)
ok('Swiftplay queue name', catalog.queueDisplayName('swiftplay') === 'Swiftplay');

// Unknown/new map UUID during match — graceful, no crash, mode still resolves
const unknownMapParsed = parseValorant(
  {
    sessionLoopState: 'INGAME',
    queueId: 'competitive',
    partySize: 1,
    matchMap: '/Game/Maps/BrandNew/BrandNew',
  },
  {
    inMatch: true,
    agent: 'Jett',
    agentId: JETT_ID,
    map: catalog.resolveMap('/Game/Maps/BrandNew/BrandNew').name,
    mapId: '/Game/Maps/BrandNew/BrandNew',
    scoreHint: '1-0',
  },
);
ok('Unknown map keeps friendly name', unknownMapParsed.map && /Brand/i.test(unknownMapParsed.map));
ok('Unknown map competitive mode ok', unknownMapParsed.mode === 'Competitive');
const unknownLines = buildPresenceLines(unknownMapParsed);
ok('Unknown map presence builds', unknownLines.details.includes('Jett') && unknownLines.state.includes('Competitive'));

// Summit on Deathmatch (new competitive/DM map)
const summitDm = parseValorant(
  {
    sessionLoopState: 'INGAME',
    queueId: 'deathmatch',
    partySize: 1,
    matchMap: '/Game/Maps/Plummet/Plummet',
  },
  {
    inMatch: true,
    agent: 'Reyna',
    agentId: 'a3bfb853-43b2-6972-40fc-e153f8558cab',
    map: 'Summit',
    mapId: '756da597-416b-c0f2-f47b-afbdf28670bc',
    scoreHint: '8 kills',
    queueId: 'deathmatch',
  },
);
ok('Summit DM map', summitDm.map === 'Summit');
ok('Summit DM no round score', summitDm.scoreHint === '8 kills');
const summitArt = buildPresenceFromSession(summitDm, { category: 'gaming', state: 'In the zone' });
ok('Summit map icon via uuid', summitArt.smallImageUrl?.includes('/agents/') || assets.valorantMapIcon(summitDm.mapId)?.includes('756da597'));

// ── Core-game score fixtures (TDM NumPoints / DM kills / spike RoundScore) ──
const {
  matchQueueId,
  matchScoreHint,
  teamScore,
  teamScoreFromPlayers,
} = require(path.join(root, 'electron/valorant-local'));

// Regression: ModeID "TeamDeathmatch" contains substring "deathmatch" — must be hurm
ok('ModeID TeamDeathmatch → hurm', matchQueueId({
  ModeID: '/Game/GameModes/TeamDeathmatch/TeamDeathmatch_PrimaryAsset',
}) === 'hurm');
ok('ModeID Deathmatch path → deathmatch', matchQueueId({
  ModeID: '/Game/GameModes/Deathmatch/Deathmatch_PrimaryAsset',
}) === 'deathmatch');
ok('QueueID hurm wins', matchQueueId({ QueueID: 'hurm', ModeID: '/Game/GameModes/Bomb/Bomb_PrimaryAsset' }) === 'hurm');
ok('catalog TeamDeathmatch is TDM not FFA', catalog.isTeamDeathmatchQueue('TeamDeathmatch') && !catalog.isDeathmatchQueue('TeamDeathmatch'));
ok('catalog deathmatch is FFA', catalog.isDeathmatchQueue('deathmatch') && !catalog.isTeamDeathmatchQueue('deathmatch'));

// TDM core-game shape: Teams[].NumPoints (ally first via self TeamID)
const tdmMatch = {
  QueueID: 'hurm',
  ModeID: '/Game/GameModes/TeamDeathmatch/TeamDeathmatch_PrimaryAsset',
  MapID: '/Game/Maps/HURM/HURM_Bowl/HURM_Bowl',
  Teams: [
    { TeamID: 'Red', NumPoints: 48 },
    { TeamID: 'Blue', NumPoints: 62 },
  ],
  Players: [
    { Subject: 'me', TeamID: 'Blue', CharacterID: JETT_ID, Stats: { Kills: 9, Deaths: 5, Assists: 3 } },
    { Subject: 'a', TeamID: 'Blue', Stats: { Kills: 20, Deaths: 8, Assists: 1 } },
    { Subject: 'b', TeamID: 'Red', Stats: { Kills: 15, Deaths: 10, Assists: 2 } },
    { Subject: 'c', TeamID: 'Red', Stats: { Kills: 12, Deaths: 11, Assists: 0 } },
  ],
};
const tdmSelf = tdmMatch.Players[0];
ok('TDM queue from match', matchQueueId(tdmMatch) === 'hurm');
ok('TDM NumPoints ally-first', matchScoreHint(tdmMatch, tdmSelf, 'hurm') === '62-48');
ok('TDM teamScore respects TeamID', teamScore(tdmMatch.Teams, 'Blue') === '62-48');

// TDM without Teams[] — sum player kills by side
const tdmNoTeams = { ...tdmMatch, Teams: undefined };
ok('TDM kills-sum fallback', teamScoreFromPlayers(tdmNoTeams.Players, 'Blue') === '29-27');
ok('TDM matchScoreHint kills-sum', matchScoreHint(tdmNoTeams, tdmSelf, 'hurm') === '29-27');

// Full parse: localTruth null score + chat presence → still show TDM score (not swallowed as DM)
const tdmModeIdOnly = parseValorant(
  {
    sessionLoopState: 'INGAME',
    partyState: 'DEFAULT',
    queueId: 'hurm',
    partySize: 2,
    matchMap: '/Game/Maps/HURM/HURM_Bowl/HURM_Bowl',
    partyOwnerMatchScoreAllyTeam: 71,
    partyOwnerMatchScoreEnemyTeam: 55,
  },
  {
    inMatch: true,
    agent: 'Jett',
    agentId: JETT_ID,
    map: 'Kasbah',
    queueId: 'hurm',
    // local core-game often has no live Teams score mid-match
    scoreHint: null,
    kda: '9/5/3',
  },
);
ok('TDM chat score when local null', tdmModeIdOnly.scoreHint === '71-55');
ok('TDM not FFA kills', !/kills/i.test(tdmModeIdOnly.scoreHint));
const tdmRich = buildPresenceLines(tdmModeIdOnly);
ok('TDM ValShy state has score+party+mode', tdmRich.state.includes('71-55')
  && tdmRich.state.includes('Team Deathmatch')
  && tdmRich.state.includes('2-Stack'));
ok('TDM details agent+map', tdmRich.details.includes('Jett') && tdmRich.details.includes('Kasbah'));

// Misclassified localTruth (legacy): ModeID was parsed as deathmatch — chat queueId hurm must still win score
const tdmRecovered = parseValorant(
  {
    sessionLoopState: 'INGAME',
    queueId: 'hurm',
    partySize: 1,
    matchMap: '/Game/Maps/HURM/HURM_Alley/HURM_Alley',
    partyOwnerMatchScoreAllyTeam: 40,
    partyOwnerMatchScoreEnemyTeam: 33,
  },
  {
    inMatch: true,
    agent: 'Sage',
    agentId: '569fdd95-4d10-43ab-ca70-79becc265df1',
    map: 'District',
    queueId: 'deathmatch', // legacy bug: TeamDeathmatch ModeID → deathmatch
    scoreHint: '9 kills',
    kda: '9/5/3',
  },
);
ok('TDM recovers score via chat queueId', tdmRecovered.scoreHint === '40-33');
ok('TDM mode still Team Deathmatch', tdmRecovered.mode === 'Team Deathmatch');

// FFA Deathmatch core-game: kills only, ignore Teams RoundScore noise
const dmMatch = {
  QueueID: 'deathmatch',
  ModeID: '/Game/GameModes/Deathmatch/Deathmatch_PrimaryAsset',
  Teams: [
    { TeamID: 'Blue', RoundScore: 2 },
    { TeamID: 'Red', RoundScore: 0 },
  ],
  Players: [
    { Subject: 'me', TeamID: 'me', Stats: { Kills: 14, Deaths: 7, Assists: 2 } },
  ],
};
ok('DM score is kills not rounds', matchScoreHint(dmMatch, dmMatch.Players[0], 'deathmatch') === '14 kills');

// Spike / Comp: RoundScore ally-enemy
const spikeMatch = {
  QueueID: 'competitive',
  Teams: [
    { TeamID: 'Blue', RoundScore: 8 },
    { TeamID: 'Red', RoundScore: 6 },
  ],
  Players: [
    { Subject: 'me', TeamID: 'Blue', Stats: { Kills: 12, Deaths: 9, Assists: 4 } },
  ],
};
ok('Comp RoundScore', matchScoreHint(spikeMatch, spikeMatch.Players[0], 'competitive') === '8-6');
const compParsed = parseValorant(
  {
    sessionLoopState: 'INGAME',
    queueId: 'competitive',
    partySize: 5,
    matchMap: '/Game/Maps/Ascent/Ascent',
    partyOwnerMatchScoreAllyTeam: 8,
    partyOwnerMatchScoreEnemyTeam: 6,
  },
  {
    inMatch: true,
    agent: 'Jett',
    agentId: JETT_ID,
    map: 'Ascent',
    queueId: 'competitive',
    scoreHint: '8-6',
    kda: '12/9/4',
  },
);
const compLines = buildPresenceLines(compParsed);
ok('Comp Discord has score·party·mode', compLines.state.includes('8-6')
  && compLines.state.includes('5-Stack')
  && compLines.state.includes('Competitive'));
ok('Comp details agent·map', compLines.details === 'Jett · Ascent' || (compLines.details.includes('Jett') && compLines.details.includes('Ascent')));

console.log(`\nResult: ${pass}/${pass + fail} checks passed`);
process.exit(fail > 0 ? 1 : 0);
