#!/usr/bin/env node
/**
 * Generate ed25519 keypair for silent UI live patches.
 *
 * Public key → build/live-patch-public.pem (commit this)
 * Private key → build/live-patch-private.pem (NEVER commit)
 *
 * Then add the private PEM as GitHub Actions secret:
 *   gh secret set SMILEY_LIVE_PATCH_PRIVATE_KEY < build/live-patch-private.pem
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pubPath = path.join(ROOT, 'build', 'live-patch-public.pem');
const privPath = path.join(ROOT, 'build', 'live-patch-private.pem');

fs.mkdirSync(path.dirname(pubPath), { recursive: true });

if (fs.existsSync(pubPath) && !process.argv.includes('--force')) {
  console.error('Public key already exists. Pass --force to rotate (requires re-shipping the app).');
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });

console.log(`Wrote ${path.relative(ROOT, pubPath)} (commit)`);
console.log(`Wrote ${path.relative(ROOT, privPath)} (gitignore + GH secret only)`);
console.log('');
console.log('Upload secret:');
console.log('  gh secret set SMILEY_LIVE_PATCH_PRIVATE_KEY < build/live-patch-private.pem');
