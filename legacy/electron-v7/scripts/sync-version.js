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

function patchLockfile(filePath) {
  patchFile(filePath, (json) => {
    const lock = JSON.parse(json);
    lock.version = version;
    if (lock.packages?.['']) lock.packages[''].version = version;
    return `${JSON.stringify(lock, null, 2)}\n`;
  });
}

console.log(`Syncing all platforms to v${version}…`);

patchFile(path.join(ROOT, 'src/index.html'), (html) =>
  html.replace(/(<span class="footer-version" id="footerVersion">Smiley v)[\d.]+(<\/span>)/, `$1${version}$2`)
);

patchFile(path.join(ROOT, 'docs/site/index.html'), (html) =>
  html
    .replace(/(Get v)[\d.]+/g, `$1${version}`)
    .replace(/(badge badge(?:--live|-live)"><span class="pulse"><\/span>v)[\d.]+/g, `$1${version}`)
    .replace(/(meta-pill"><span class="meta-dot"[^>]*><\/span>\s*v)[\d.]+/g, `$1${version}`)
    .replace(/(<strong>v)[\d.]+(<\/strong>\s*current)/g, `$1${version}$2`)
    .replace(/(<h2>Smiley v)[\d.]+(<\/h2>)/g, `$1${version}$2`)
    .replace(/(releases\/download\/v)[\d.]+/g, `$1${version}`)
    .replace(/(Smiley-Setup-)[\d.]+(\.exe)/g, `$1${version}$2`)
    .replace(/(Smiley-)[\d.]+(-(arm64|x64)\.dmg)/g, `$1${version}$2`)
    .replace(/(Smiley-)[\d.]+(\.AppImage)/g, `$1${version}$2`)
    .replace(/(Smiley-)[\d.]+(\.deb)/g, `$1${version}$2`)
);

const mobilePkgPath = path.join(ROOT, 'mobile/package.json');
patchFile(mobilePkgPath, (json) => {
  const pkg = JSON.parse(json);
  pkg.version = version;
  pkg.description = `Smiley v${version} — Capacitor companion for Android & iOS`;
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

patchLockfile(path.join(ROOT, 'package-lock.json'));
patchLockfile(path.join(ROOT, 'mobile/package-lock.json'));

for (const doc of ['PRIVACY.md', 'ToS.md', 'SECURITY.md']) {
  patchFile(path.join(ROOT, doc), (text) =>
    text.replace(/(\*\*Raj \(@1tsRaj\)\*\* — last updated \d+ \w+ \d+ \(v)[\d.]+(\))/g, `$1${version}$2`)
  );
}

patchFile(path.join(ROOT, 'docs/INSTALL-DATABASE.md'), (text) =>
  text
    .replace(/(`app_version` \| `)[\d.]+(` \| Device)/g, `$1${version}$2`)
    .replace(/(`user_agent` \| `Smiley\/)[\d.]+( Electron\/…` \| Device)/g, `$1${version}$2`)
);

execFileSync('node', ['mobile/scripts/build-www.js'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('node', ['mobile/scripts/configure-native.js'], { cwd: ROOT, stdio: 'inherit' });

console.log(`Done — all platforms at v${version}.`);
