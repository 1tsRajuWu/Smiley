#!/usr/bin/env node
/**
 * Sync app version from root package.json to every platform surface.
 * Run from repo root: npm run sync:version
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const version = require(path.join(ROOT, 'package.json')).version;

function patchFile(filePath, patchFn) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  skip (missing): ${path.relative(ROOT, filePath)}`);
    return;
  }
  const before = fs.readFileSync(filePath, 'utf8');
  const after = patchFn(before);
  if (after === before) {
    console.log(`  · ${path.relative(ROOT, filePath)} (already v${version})`);
    return;
  }
  fs.writeFileSync(filePath, after);
  console.log(`  ✓ ${path.relative(ROOT, filePath)} → v${version}`);
}

console.log(`Syncing all platforms to v${version}…`);

patchFile(path.join(ROOT, 'src/index.html'), (html) =>
  html.replace(/(<span class="footer-version" id="footerVersion">Smiley v)[\d.]+(<\/span>)/, `$1${version}$2`)
);

const mobilePkgPath = path.join(ROOT, 'mobile/package.json');
patchFile(mobilePkgPath, (json) => {
  const pkg = JSON.parse(json);
  pkg.version = version;
  pkg.description = `Smiley v${version} — Capacitor companion for Android & iOS`;
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

execFileSync('node', ['mobile/scripts/build-www.js'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('node', ['mobile/scripts/configure-native.js'], { cwd: ROOT, stdio: 'inherit' });

console.log(`Done — all platforms at v${version}.`);
