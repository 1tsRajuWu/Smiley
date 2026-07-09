#!/usr/bin/env node
/**
 * Build + sign a silent UI live patch from src/ into docs/site/live/.
 *
 * Inputs:
 *   - src/** (html/css/js/assets)
 *   - build/live-patch-private.pem  OR  env SMILEY_LIVE_PATCH_PRIVATE_KEY
 *   - package.json version → minAppVersion (override with MIN_APP_VERSION)
 *
 * Outputs (under docs/site/live/):
 *   manifest.json, bundle.zip, bundle.zip.sig
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs', 'site', 'live');
const PUBLIC_BASE = 'https://1tsrajuwu.github.io/Smiley/live';

const ALLOWED_EXT = new Set([
  '.html', '.css', '.js', '.json',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf',
]);

const SKIP_NAMES = new Set(['styles.css', 'README.md']);

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, base, out);
      continue;
    }
    if (SKIP_NAMES.has(entry.name)) continue;
    if (entry.name.endsWith('.map')) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) continue;
    out.push({
      full,
      rel: path.relative(base, full).split(path.sep).join('/'),
    });
  }
  return out;
}

function loadPrivateKey() {
  const fromEnv = process.env.SMILEY_LIVE_PATCH_PRIVATE_KEY;
  if (fromEnv && fromEnv.trim()) {
    return crypto.createPrivateKey(fromEnv.trim());
  }
  const pemPath = path.join(ROOT, 'build', 'live-patch-private.pem');
  if (!fs.existsSync(pemPath)) {
    throw new Error(
      'Missing live-patch private key. Set SMILEY_LIVE_PATCH_PRIVATE_KEY or create build/live-patch-private.pem'
    );
  }
  return crypto.createPrivateKey(fs.readFileSync(pemPath, 'utf8'));
}

function zipFiles(files, zipPath) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  const staging = fs.mkdtempSync(path.join(require('os').tmpdir(), 'smiley-live-'));
  try {
    for (const file of files) {
      const dest = path.join(staging, file.rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file.full, dest);
    }
    if (process.platform === 'win32') {
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Compress-Archive -Path (Join-Path '${staging.replace(/'/g, "''")}' '*') -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
        ],
        { stdio: 'inherit' }
      );
    } else {
      // Store paths relative to staging root (index.html at zip root)
      execFileSync('zip', ['-qr', zipPath, '.'], { cwd: staging, stdio: 'inherit' });
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function main() {
  if (!fs.existsSync(SRC)) throw new Error('src/ missing');
  const files = walk(SRC);
  if (!files.some((f) => f.rel === 'index.html')) {
    throw new Error('src/index.html is required in the live patch');
  }
  if (!files.some((f) => f.rel === 'renderer.js')) {
    throw new Error('src/renderer.js is required in the live patch');
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const minAppVersion = String(process.env.MIN_APP_VERSION || pkg.version).trim();
  const now = new Date();
  const patchVersion =
    process.env.PATCH_VERSION ||
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}.${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;

  fs.mkdirSync(OUT, { recursive: true });
  const zipPath = path.join(OUT, 'bundle.zip');
  zipFiles(files, zipPath);

  const zipBytes = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash('sha256').update(zipBytes).digest('hex');
  const privateKey = loadPrivateKey();
  const signature = crypto.sign(null, Buffer.from(sha256, 'utf8'), privateKey).toString('base64');

  fs.writeFileSync(path.join(OUT, 'bundle.zip.sig'), `${signature}\n`);

  const manifest = {
    patchVersion,
    minAppVersion,
    sha256,
    signature,
    fileCount: files.length,
    createdAt: now.toISOString(),
    bundle: 'bundle.zip',
    bundleUrl: `${PUBLIC_BASE}/bundle.zip`,
    signatureUrl: `${PUBLIC_BASE}/bundle.zip.sig`,
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // Tiny README for browsers hitting the folder
  fs.writeFileSync(
    path.join(OUT, 'README.md'),
    '# Smiley live UI patches\n\nSigned UI overlays for installed Smiley apps. Verified client-side with ed25519.\n'
  );

  console.log(`Live UI patch ${patchVersion}`);
  console.log(`  files: ${files.length}`);
  console.log(`  minAppVersion: ${minAppVersion}`);
  console.log(`  sha256: ${sha256}`);
  console.log(`  out: ${path.relative(ROOT, OUT)}`);
}

main();
