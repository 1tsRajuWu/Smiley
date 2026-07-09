#!/usr/bin/env node
/**
 * Smiley v8 Valorant presence self-check — run: npm run v8-game-presence-check
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
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

console.log('=== Smiley v8 Game Presence Self-Check ===\n');

try {
  const out = execSync('cargo test --quiet', {
    cwd: path.join(root, 'Smiley.v8/src-tauri'),
    encoding: 'utf8',
  });
  ok('Rust unit tests (riot + catalog + assets)', /27 passed/.test(out) || /passed/.test(out));
} catch (e) {
  ok('Rust unit tests', false);
  console.error(String(e.stdout || e.stderr || e.message).slice(0, 500));
}

const catalog = require(path.join(root, 'legacy/electron-v7/electron/valorant-catalog'));
ok('HURM_Bowl → Kasbah (shared catalog)', catalog.resolveMap('/Game/Maps/HURM/HURM_Bowl/HURM_Bowl').name === 'Kasbah');
ok('RangeV2 → The Range', catalog.resolveMap('/Game/Maps/PovegliaV2/RangeV2').name === 'The Range');
ok('TDM queue hurm', catalog.queueDisplayName('hurm') === 'Team Deathmatch');

const assets = require(path.join(root, 'legacy/electron-v7/electron/game-assets'));
const JETT = 'add6443a-41bd-e414-f6ad-e58d267f4e95';
ok('Valorant V logo HTTPS', /^https:\/\//.test(assets.VALORANT_GAME_LOGO));
ok('Agent icon URL', /^https:\/\/media\.valorant-api\.com/.test(assets.valorantAgentIcon(JETT)));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
