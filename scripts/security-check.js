#!/usr/bin/env node
/**
 * Smiley security self-check — run: npm run security-check
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const s = require(path.join(root, 'electron/security'));

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

console.log('=== Smiley Security Self-Check ===\n');

const dirty = {
  theme: 'dark',
  discordToken: 'mfa.fakeToken123456789012345',
  username: 'testuser',
  token: 'NzayNjA4OTU4NDc5MTQ2MjQ4.GaA.BcD',
  nested: { password: 'secret', ok: true },
};
const clean = s.stripSensitiveFields(dirty);
ok('Strips discordToken', !('discordToken' in clean));
ok('Strips username', !('username' in clean));
ok('Strips token', !('token' in clean));
ok('Keeps safe fields', clean.theme === 'dark');

const ud = path.join(os.tmpdir(), `smiley-sec-${Date.now()}`);
fs.mkdirSync(ud, { recursive: true });

s.initSecurity(ud);
ok('Device-bound key only (no keychain)', !s.isKeychainActive());
const localPayload = { secret: 'settings', favorites: ['a'] };
const encLocal = s.encryptJson(localPayload, ud);
ok('Local encrypt uses v3', encLocal.v === 3 && encLocal.iv && encLocal.tag);
const decLocal = s.decryptJson(encLocal, ud);
ok('Local decrypt roundtrip', decLocal.secret === 'settings');

const mockSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.from(`enc:${plain}`),
  decryptString: (buf) => String(buf).replace(/^enc:/, ''),
};
const ud2 = path.join(os.tmpdir(), `smiley-sec-kc-${Date.now()}`);
fs.mkdirSync(ud2, { recursive: true });
const legacyKey = require('crypto').randomBytes(32);
const legacyBlob = mockSafeStorage.encryptString(legacyKey.toString('base64'));
fs.writeFileSync(path.join(ud2, 'master-key.enc'), legacyBlob);
s.initSecurity(ud2);
ok('Fresh init skips keychain even if master-key.enc exists', !s.isKeychainActive());
ok('Legacy keychain read (opt-in)', s.tryLoadLegacyKeychainMasterKey(ud2, mockSafeStorage));
ok('Legacy keychain mode active after opt-in load', s.isKeychainActive());
const encKc = s.encryptJson({ x: 1 }, ud2);
ok('After legacy load, encrypt prefers v4', encKc.v === 4);
ok('Legacy v4 decrypt', s.decryptJson(encKc, ud2).x === 1);

const exp = s.encryptExport({ theme: 'ocean' }, 'test-passphrase-12345');
ok('E2EE export envelope', exp.type === 'smiley-export' && exp.kdfVersion >= 2);
ok('E2EE export decrypt', s.decryptExport(exp, 'test-passphrase-12345').theme === 'ocean');
let blocked = false;
try {
  s.decryptExport(exp, 'wrong-passphrase');
} catch {
  blocked = true;
}
ok('Wrong export passphrase blocked', blocked);

const bin = Buffer.from('GIF89a-test');
const filePath = path.join(ud, 'test.gif.senc');
s.writeEncryptedBinaryFile(filePath, bin, ud, { mime: 'image/gif', origExt: '.gif' });
const read = s.readEncryptedBinaryFile(filePath, ud);
ok('Encrypted binary file roundtrip', read && read.buffer.equals(bin));

const track = s.sanitizeNowPlayingTrack({
  title: 'Song',
  artist: 'Artist',
  token: 'leak',
  artworkUrl: 'http://insecure',
});
ok('Music track strips secrets', !track.token && track.artworkUrl === null);

ok('HTTPS enforced helper', s.isTlsUrl('https://example.com') && !s.isTlsUrl('http://example.com'));

fs.rmSync(ud, { recursive: true, force: true });
fs.rmSync(ud2, { recursive: true, force: true });

console.log(`\nResult: ${pass}/${pass + fail} checks passed`);
process.exit(fail > 0 ? 1 : 0);
