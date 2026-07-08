#!/usr/bin/env node
/**
 * Lightweight game-assets / Steam logo self-check — run: node scripts/game-assets-check.js
 * Keeps URLs small (capsules / 128px); never asserts bundled binaries.
 */
const path = require('path');
const root = path.join(__dirname, '..');
const assets = require(path.join(root, 'electron/game-assets'));
const {
  lookupSteamMetadata, resolveSteamAppIdAlias, validateImageUrl, pickValidatedSteamArtwork,
} = require(path.join(root, 'electron/game-api'));
const { buildPresenceFromSession } = require(path.join(root, 'electron/presence-builder'));

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

async function main() {
  console.log('=== Smiley Game Assets Self-Check ===\n');

  ok('Valorant GAME_LOGO is 128×128', assets.VALORANT_GAME_LOGO.includes('128x128'));
  ok('Valorant logo HTTP reachable', await validateImageUrl(assets.VALORANT_GAME_LOGO));
  ok('CS2 alias AppID', resolveSteamAppIdAlias('cs2') === 730);
  ok('CS2 capsule URL shape', assets.steamCapsule(730) === `${assets.STEAM_CDN}/730/capsule_231x87.jpg`);
  ok('CS2 candidates light-first', assets.steamArtworkCandidates(730)[0].includes('capsule_231x87'));
  ok('No library_600x900 as first choice', !assets.steamArtworkCandidates(730)[0].includes('library_600x900'));

  const cs2Meta = await lookupSteamMetadata('Counter-Strike 2');
  ok('Steam lookup CS2 AppID', cs2Meta?.steamAppId === 730);
  ok('Steam lookup CS2 artwork is capsule/header (light)', !!cs2Meta?.artworkUrl
    && /capsule_|header\.jpg/i.test(cs2Meta.artworkUrl)
    && !/library_hero|library_600x900/i.test(cs2Meta.artworkUrl));
  ok('Steam CS2 artwork validates', cs2Meta?.artworkUrl && await validateImageUrl(cs2Meta.artworkUrl));

  const picked = await pickValidatedSteamArtwork(730);
  ok('pickValidatedSteamArtwork(730)', !!picked && picked.includes('/730/'));
  ok('Picked art not spinner', !assets.isSpinnerFallbackUrl(picked));

  const activity = buildPresenceFromSession({
    provider: 'window',
    title: 'Counter-Strike 2',
    steamAppId: 730,
    steamArtworkUrl: picked || assets.steamCapsule(730),
  }, { category: 'gaming', state: 'Playing' });
  ok('CS2 payload large_image HTTPS', /^https:\/\//.test(activity.discordImageUrl || ''));
  ok('CS2 payload not spinner', !/loading-gif/i.test(activity.discordImageUrl || ''));

  const val = buildPresenceFromSession({
    provider: 'riot-valorant',
    title: 'Valorant',
    phase: 'lobby',
    inLobby: true,
    queueId: 'swiftplay',
    mode: 'Swiftplay',
  }, { category: 'gaming', state: 'In the zone' });
  ok('Valorant large_image still 128 V logo', val.discordImageUrl === assets.VALORANT_GAME_LOGO);

  const unknown = assets.resolveGameArtwork({ title: 'ZzNopeNoSteam' });
  ok('Unknown → Smiley logo', unknown === assets.SMILEY_LOGO);
  ok('Smiley logo validates', await validateImageUrl(assets.SMILEY_LOGO));

  // Agent displayicon stays remote URL-only (256² CDN — no bundling)
  const agent = assets.valorantAgentIcon('add6443a-41bd-e414-f6ad-e58d267f4e95');
  ok('Agent icon is media.valorant-api.com displayicon', agent?.includes('media.valorant-api.com') && agent.endsWith('displayicon.png'));

  console.log(`\nResult: ${pass}/${pass + fail} checks passed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
