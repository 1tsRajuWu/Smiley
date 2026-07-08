#!/usr/bin/env node
/**
 * Game presence self-check — run: npm run game-presence-check
 */
const path = require('path');

const root = path.join(__dirname, '..');
const assets = require(path.join(root, 'electron/game-assets'));
const { buildPresenceLines, buildPresenceFromSession } = require(path.join(root, 'electron/presence-builder'));
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
ok('Valorant mode icon swiftplay', /^https:\/\//.test(assets.valorantModeIcon('swiftplay')));
ok('LoL champion icon', assets.lolChampionIcon('Jinx')?.includes('Jinx'));
ok('Steam header', assets.steamHeader(730)?.includes('730'));
ok('Party labels', assets.partyLabel(2) === 'Duo' && assets.partyLabel(5) === 'Full stack');

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
  inMatch: true,
};
const valLines = buildPresenceLines(valSession);
ok('Valorant details = map', valLines.details === 'Ascent');
ok('Valorant state has agent+score+mode', valLines.state.includes('Jett') && valLines.state.includes('8-6') && valLines.state.includes('Swiftplay'));
ok('Valorant details not mode-only', !valLines.details.includes('Swiftplay'));

const lolSession = {
  provider: 'riot-lol',
  title: 'League of Legends',
  champ: 'Ahri',
  kda: '3/1/7',
  gameTime: '12:34',
  mode: 'Ranked Solo',
  inMatch: true,
};
const lolLines = buildPresenceLines(lolSession);
ok('LoL details = champ', lolLines.details === 'Ahri');
ok('LoL state has kda', lolLines.state.includes('3/1/7'));

const fnSession = { provider: 'fortnite', title: 'Fortnite', mode: 'Battle Royale', party: 'Solo', placement: 12 };
const fnLines = buildPresenceLines(fnSession);
ok('Fortnite details', fnLines.details === 'Fortnite');
ok('Fortnite state', fnLines.state.includes('Battle Royale') && fnLines.state.includes('#12'));

const rbxSession = { provider: 'roblox', title: 'Roblox', experience: 'Adopt Me!', server: 'Adopt Me!', inMatch: true };
const rbxLines = buildPresenceLines(rbxSession);
ok('Roblox details = experience', rbxLines.details === 'Adopt Me!');

const activity = buildPresenceFromSession(valSession, { category: 'gaming', state: 'In the zone' });
ok('Presence has discordImageUrl', /^https:\/\//.test(activity.discordImageUrl));
ok('Presence agent image priority', activity.discordImageUrl.includes('/agents/'));

const sanitized = sanitizeGameSession({
  title: 'Valorant',
  party: 'Duo',
  puuid: 'secret-should-not-appear',
  agent: 'Jett',
  token: 'leak',
});
ok('Sanitize strips puuid', !('puuid' in sanitized));
ok('Sanitize strips token', !('token' in sanitized));
ok('Sanitize keeps party', sanitized.party === 'Duo');

console.log(`\nResult: ${pass}/${pass + fail} checks passed`);
process.exit(fail > 0 ? 1 : 0);
