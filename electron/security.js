/**
 * Smiley security layer — AES-256-GCM, device-bound keys, E2EE exports, encrypted user files.
 * OS keychain (Electron safeStorage) is intentionally not used — it triggers a macOS login
 * keychain prompt on launch. Local encryption uses scrypt-derived device-bound keys (v3).
 * See SECURITY.md for the full threat model.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ALG = 'aes-256-gcm';
const IV_BYTES = 16;
const KEY_BYTES = 32;

const SALT_V1 = 'smiley-salt-v1';
const SALT_V3 = 'smiley-salt-v3-e2ee';
const EXPORT_KDF_SALT = 'smiley-export-e2ee-v1';
const APP_ID = 'com.smiley.rpc';
const MASTER_KEY_FILE = 'master-key.enc';
const ENCRYPTED_FILE_EXT = '.senc';

const SCRYPT_EXPORT_V1 = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SCRYPT_EXPORT_V2 = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

let masterKey = null;
let keychainActive = false;
let userDataPathRef = null;
/** Cached derived keys — scrypt is expensive; never run it per file read. */
let cachedKeys = null;
let cachedKeysForPath = null;
let lazyEncryptQueue = Promise.resolve();

function clearKeyCache() {
  cachedKeys = null;
  cachedKeysForPath = null;
}

function buildKeyCache(userDataPath) {
  if (cachedKeys && cachedKeysForPath === userDataPath) return cachedKeys;
  const keys = [
    { v: 3, key: deriveDeviceKeyV3(userDataPath) },
    { v: 1, key: deriveDeviceKeyV1(userDataPath) },
  ];
  if (isKeychainActive()) keys.unshift({ v: 4, key: masterKey });
  cachedKeys = keys;
  cachedKeysForPath = userDataPath;
  return keys;
}

function getLocalEncryptionKeys(userDataPath) {
  return buildKeyCache(userDataPath);
}

function getPrimaryLocalKey(userDataPath) {
  const keys = buildKeyCache(userDataPath);
  return keys[0];
}

function getKeyForVersion(userDataPath, version) {
  const keys = buildKeyCache(userDataPath);
  return keys.find((k) => k.v === version) || keys[0];
}
/**
 * Initialize local encryption. Uses device-bound scrypt keys (v3) only — never touches
 * OS keychain / safeStorage (avoids macOS "Smiley Safe Storage" password prompt on launch).
 */
function initSecurity(userDataPath) {
  userDataPathRef = userDataPath;
  masterKey = null;
  keychainActive = false;
  clearKeyCache();

  if (!userDataPath) return { keychain: false };

  buildKeyCache(userDataPath);
  return { keychain: false };
}

/**
 * Legacy OS keychain format — intentionally not migrated (avoids keychain prompt).
 * Reads an existing master-key.enc via safeStorage only when the file is already present;
 * never creates new keychain entries. Not called on startup.
 */
function tryLoadLegacyKeychainMasterKey(userDataPath, safeStorage) {
  if (!userDataPath || !safeStorage?.isEncryptionAvailable?.()) return false;
  const keyPath = path.join(userDataPath, MASTER_KEY_FILE);
  if (!fs.existsSync(keyPath)) return false;
  try {
    const blob = fs.readFileSync(keyPath);
    const decoded = safeStorage.decryptString(blob);
    const key = Buffer.from(decoded, 'base64');
    if (key.length !== KEY_BYTES) return false;
    masterKey = key;
    keychainActive = true;
    clearKeyCache();
    buildKeyCache(userDataPath);
    return true;
  } catch (e) {
    console.warn('[security] Legacy keychain master key unavailable:', e.message);
    masterKey = null;
    keychainActive = false;
    clearKeyCache();
    return false;
  }
}

function isKeychainActive() {
  return keychainActive && masterKey?.length === KEY_BYTES;
}

function deriveDeviceKeyV1(userDataPath) {
  return crypto.scryptSync(userDataPath, SALT_V1, KEY_BYTES);
}

function deriveDeviceKeyV3(userDataPath) {
  const entropy = [
    userDataPath,
    os.hostname(),
    os.platform(),
    os.arch(),
    APP_ID,
  ].join('\0');
  return crypto.scryptSync(entropy, SALT_V3, KEY_BYTES, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function deriveExportKey(passphrase, saltHex, kdfVersion = 2) {
  const salt = Buffer.from(saltHex, 'hex');
  const params = kdfVersion >= 2 ? SCRYPT_EXPORT_V2 : SCRYPT_EXPORT_V1;
  return crypto.scryptSync(
    String(passphrase),
    Buffer.concat([Buffer.from(EXPORT_KDF_SALT), salt]),
    KEY_BYTES,
    params,
  );
}

function aesEncryptBuffer(buffer, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    data: encrypted.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function aesDecryptBuffer(envelope, key) {
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const data = Buffer.from(envelope.data, 'base64');
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function aesEncrypt(plainText, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return {
    iv: iv.toString('base64'),
    data: encrypted,
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function aesDecrypt(envelope, key) {
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  let decrypted = decipher.update(envelope.data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptJson(plainObj, userDataPath, { version } = {}) {
  try {
    const json = JSON.stringify(plainObj);
    const primary = version
      ? getLocalEncryptionKeys(userDataPath).find((k) => k.v === version) || getPrimaryLocalKey(userDataPath)
      : getPrimaryLocalKey(userDataPath);
    const { iv, data, tag } = aesEncrypt(json, primary.key);
    return { v: primary.v, alg: ALG, iv, data, tag };
  } catch (e) {
    console.error('[security.encryptJson]', e.message);
    return { v: 0, data: JSON.stringify(plainObj) };
  }
}

function decryptJson(envelope, userDataPath, { tryLegacyKeychain, safeStorage } = {}) {
  try {
    if (!envelope || typeof envelope !== 'object') return {};
    if (envelope.v === 2) {
      if (tryLegacyKeychain && safeStorage && tryLoadLegacyKeychainMasterKey(userDataPath, safeStorage)) {
        for (const { key } of getLocalEncryptionKeys(userDataPath)) {
          try {
            const decrypted = aesDecrypt(envelope, key);
            return JSON.parse(decrypted);
          } catch (_) {}
        }
      }
      return { __keychainMigration: true };
    }
    if (envelope.v === 0) return JSON.parse(envelope.data || '{}');

    const order = envelope.v === 1
      ? [getKeyForVersion(userDataPath, 1)]
      : envelope.v === 3
        ? [getKeyForVersion(userDataPath, 3), getKeyForVersion(userDataPath, 4), getKeyForVersion(userDataPath, 1)]
        : envelope.v === 4
          ? [getKeyForVersion(userDataPath, 4), getKeyForVersion(userDataPath, 3), getKeyForVersion(userDataPath, 1)]
          : getLocalEncryptionKeys(userDataPath);

    for (const { key } of order) {
      try {
        const decrypted = aesDecrypt(envelope, key);
        return JSON.parse(decrypted);
      } catch (_) {}
    }
    return {};
  } catch (e) {
    console.error('[security.decryptJson]', e.message);
    return {};
  }
}

function writeSecureJson(filePath, plainObj, userDataPath) {
  const envelope = encryptJson(plainObj, userDataPath);
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(envelope, null, 2));
  fs.renameSync(tmpPath, filePath);
  return envelope;
}

function readSecureJson(filePath, userDataPath, { allowLegacyPlaintext = false } = {}) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.v === 'number' && parsed.alg === ALG) {
      return decryptJson(parsed, userDataPath);
    }
    if (allowLegacyPlaintext && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (_) {}

  if (allowLegacyPlaintext && /^[0-9a-f-]{36}$/i.test(raw)) {
    return raw;
  }
  return null;
}

function migratePlaintextFile(plainPath, securePath, userDataPath, transform) {
  if (!fs.existsSync(plainPath)) return false;
  try {
    const raw = fs.readFileSync(plainPath, 'utf8').trim();
    let value = raw;
    if (transform) {
      value = transform(raw);
    } else {
      try {
        value = JSON.parse(raw);
      } catch (_) {
        value = raw;
      }
    }
    if (value === null || value === undefined) return false;
    writeSecureJson(securePath, typeof value === 'string' ? { value } : value, userDataPath);
    fs.unlinkSync(plainPath);
    return true;
  } catch (e) {
    console.error('[security.migratePlaintextFile]', plainPath, e.message);
    return false;
  }
}

function encryptExport(plainObj, passphrase) {
  const salt = crypto.randomBytes(16);
  const kdfVersion = 2;
  const key = deriveExportKey(passphrase, salt.toString('hex'), kdfVersion);
  const json = JSON.stringify(plainObj);
  const { iv, data, tag } = aesEncrypt(json, key);
  return {
    v: 1,
    type: 'smiley-export',
    alg: ALG,
    kdf: 'scrypt',
    kdfVersion,
    salt: salt.toString('hex'),
    iv,
    data,
    tag,
    exportedAt: new Date().toISOString(),
  };
}

function decryptExport(envelope, passphrase) {
  if (!envelope || envelope.type !== 'smiley-export' || !envelope.salt) {
    throw new Error('Not a Smiley encrypted export');
  }
  const kdfVersion = envelope.kdfVersion || 1;
  const key = deriveExportKey(passphrase, envelope.salt, kdfVersion);
  const decrypted = aesDecrypt(envelope, key);
  const parsed = JSON.parse(decrypted);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid export payload');
  }
  return parsed;
}

function mimeFromExt(ext) {
  const map = {
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  return map[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

function isEncryptedFileEnvelope(parsed) {
  return parsed && parsed.type === 'smiley-file' && parsed.alg === ALG && parsed.data;
}

function writeEncryptedBinaryFile(filePath, buffer, userDataPath, meta = {}) {
  const primary = getPrimaryLocalKey(userDataPath);
  const { iv, data, tag } = aesEncryptBuffer(buffer, primary.key);
  const envelope = {
    v: 1,
    type: 'smiley-file',
    alg: ALG,
    keyVersion: primary.v,
    iv,
    data,
    tag,
    mime: meta.mime || 'application/octet-stream',
    origExt: meta.origExt || path.extname(filePath),
  };
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(envelope));
  fs.renameSync(tmp, filePath);
  return envelope;
}

function readEncryptedBinaryFile(filePath, userDataPath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath);
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (isEncryptedFileEnvelope(parsed)) {
      const tryOrder = [];
      if (parsed.keyVersion) tryOrder.push(getKeyForVersion(userDataPath, parsed.keyVersion));
      for (const entry of getLocalEncryptionKeys(userDataPath)) {
        if (!tryOrder.some((k) => k.key === entry.key)) tryOrder.push(entry);
      }
      for (const { key } of tryOrder) {
        try {
          const buffer = aesDecryptBuffer(parsed, key);
          return {
            buffer,
            mime: parsed.mime || 'application/octet-stream',
            origExt: parsed.origExt || '',
          };
        } catch (_) {}
      }
      return null;
    }
  } catch (_) {}
  const ext = path.extname(filePath);
  scheduleLazyMediaEncryption(filePath, userDataPath);
  return { buffer: raw, mime: mimeFromExt(ext), origExt: ext, legacy: true };
}

function scheduleLazyMediaEncryption(plainPath, userDataPath) {
  if (!plainPath || plainPath.endsWith(ENCRYPTED_FILE_EXT)) return;
  lazyEncryptQueue = lazyEncryptQueue.then(() => new Promise((resolve) => {
    setImmediate(() => {
      try {
        migratePlainMediaFile(plainPath, userDataPath);
      } catch (_) {}
      resolve();
    });
  }));
}

function encryptedMediaName(baseName) {
  const safe = String(baseName || 'file').replace(/\.senc$/i, '');
  return safe.endsWith(ENCRYPTED_FILE_EXT) ? safe : `${safe}${ENCRYPTED_FILE_EXT}`;
}

function migratePlainMediaFile(plainPath, userDataPath) {
  if (!fs.existsSync(plainPath)) return null;
  if (plainPath.endsWith(ENCRYPTED_FILE_EXT)) return plainPath;
  try {
    const buffer = fs.readFileSync(plainPath);
    const ext = path.extname(plainPath);
    const destPath = `${plainPath}${ENCRYPTED_FILE_EXT}`;
    writeEncryptedBinaryFile(destPath, buffer, userDataPath, { mime: mimeFromExt(ext), origExt: ext });
    secureUnlink(plainPath);
    return destPath;
  } catch (e) {
    console.warn('[security.migratePlainMediaFile]', plainPath, e.message);
    return plainPath;
  }
}

function migrateMediaDirectory(dir, userDataPath) {
  if (!dir || !fs.existsSync(dir)) return 0;
  let migrated = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    try {
      if (!fs.statSync(full).isFile()) continue;
      if (name.endsWith(ENCRYPTED_FILE_EXT)) continue;
      scheduleLazyMediaEncryption(full, userDataPath);
      migrated += 1;
    } catch (_) {}
  }
  return migrated;
}

function encryptSecret(value, userDataPath) {
  return encryptJson({ value: String(value) }, userDataPath);
}

function decryptSecret(envelope, userDataPath) {
  const obj = decryptJson(envelope, userDataPath);
  return obj?.value ? String(obj.value) : null;
}

function secureUnlink(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.isFile() && stat.size > 0 && stat.size < 1024 * 1024) {
      fs.writeFileSync(filePath, crypto.randomBytes(stat.size));
    }
    fs.unlinkSync(filePath);
  } catch (_) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

function isTlsUrl(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

const SENSITIVE_KEY_RE = /(?:^|_)(token|password|passwd|secret|credential|api[_-]?key|auth|bearer|session|cookie|private[_-]?key|access[_-]?token|refresh[_-]?token|discord[_-]?(?:token|secret|password)|bot[_-]?token|user[_-]?token|client[_-]?secret)(?:$|_)/i;
const SENSITIVE_VALUE_RE = /^(?:mfa\.[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,})$/;

function isSensitiveKey(key) {
  if (typeof key !== 'string') return false;
  const k = key.trim();
  if (!k) return false;
  if (SENSITIVE_KEY_RE.test(k)) return true;
  const lower = k.toLowerCase();
  return lower === 'username'
    || lower === 'email'
    || lower === 'clientid'
    || lower === 'client_id'
    || lower === 'discordusername'
    || lower === 'discord_username';
}

function looksLikeSecretValue(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 20) return false;
  return SENSITIVE_VALUE_RE.test(v);
}

function stripSensitiveFields(value, depth = 0) {
  if (depth > 10) return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripSensitiveFields(item, depth + 1))
      .filter((item) => !looksLikeSecretValue(item));
  }
  if (!value || typeof value !== 'object') {
    return looksLikeSecretValue(value) ? undefined : value;
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    const cleaned = stripSensitiveFields(child, depth + 1);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

function sanitizeNowPlayingTrack(track) {
  if (!track || typeof track !== 'object') return null;
  const progressMs = Math.max(0, Math.min(Number(track.progressMs) || 0, 86400000));
  const durationMs = Math.max(0, Math.min(Number(track.durationMs) || 0, 86400000));
  return {
    title: typeof track.title === 'string' ? track.title.slice(0, 256) : '',
    artist: typeof track.artist === 'string' ? track.artist.slice(0, 256) : '',
    album: typeof track.album === 'string' ? track.album.slice(0, 256) : '',
    isPlaying: track.isPlaying !== false,
    device: typeof track.device === 'string' ? track.device.slice(0, 64) : null,
    progressMs,
    durationMs,
    updatedAt: Number.isFinite(Number(track.updatedAt)) ? Number(track.updatedAt) : Date.now(),
    playbackRate: Number.isFinite(Number(track.playbackRate)) ? Number(track.playbackRate) : 1,
    artworkUrl: typeof track.artworkUrl === 'string' && /^https:\/\//i.test(track.artworkUrl)
      ? track.artworkUrl.slice(0, 2048)
      : null,
  };
}

/** Never expose to renderer — main-process Riot reads only */
const GAME_SESSION_DENIED_KEYS = new Set([
  'puuid', 'cid', 'subject', 'password', 'lockfile', 'token', 'accessToken', 'refreshToken',
  'gameName', 'gameTag', 'game_name', 'game_tag', 'private', 'privateData', 'authorization',
]);

function sanitizeGameSession(session) {
  if (!session || typeof session !== 'object') return null;
  for (const key of GAME_SESSION_DENIED_KEYS) {
    if (key in session) {
      console.warn('[security] blocked sensitive gameSession field:', key);
    }
  }
  const tags = Array.isArray(session.tags)
    ? session.tags
      .filter((tag) => typeof tag === 'string')
      .map((tag) => tag.slice(0, 48))
      .slice(0, 5)
    : [];
  return {
    title: typeof session.title === 'string' ? session.title.slice(0, 256) : '',
    processName: typeof session.processName === 'string' ? session.processName.slice(0, 128) : '',
    windowTitle: typeof session.windowTitle === 'string' ? session.windowTitle.slice(0, 256) : '',
    launcher: typeof session.launcher === 'string' ? session.launcher.slice(0, 64) : null,
    scoreHint: typeof session.scoreHint === 'string' ? session.scoreHint.slice(0, 32) : null,
    metascore: typeof session.metascore === 'string' ? session.metascore.slice(0, 8) : null,
    tags,
    steamAppId: Number.isFinite(Number(session.steamAppId)) ? Number(session.steamAppId) : null,
    provider: typeof session.provider === 'string' ? session.provider.slice(0, 32) : null,
    map: typeof session.map === 'string' ? session.map.slice(0, 64) : null,
    mode: typeof session.mode === 'string' ? session.mode.slice(0, 64) : null,
    champ: typeof session.champ === 'string' ? session.champ.slice(0, 48) : null,
    agent: typeof session.agent === 'string' ? session.agent.slice(0, 48) : null,
    kda: typeof session.kda === 'string' ? session.kda.slice(0, 24) : null,
    rank: typeof session.rank === 'string' ? session.rank.slice(0, 48) : null,
    party: typeof session.party === 'string' ? session.party.slice(0, 24) : null,
    experience: typeof session.experience === 'string' ? session.experience.slice(0, 128) : null,
    playMode: typeof session.playMode === 'string' ? session.playMode.slice(0, 32) : null,
    trackerKd: typeof session.trackerKd === 'string' ? session.trackerKd.slice(0, 16) : null,
    gameTime: typeof session.gameTime === 'string' ? session.gameTime.slice(0, 16) : null,
    server: typeof session.server === 'string' ? session.server.slice(0, 128) : null,
    liveLine: typeof session.liveLine === 'string' ? session.liveLine.slice(0, 256) : null,
    inMatch: session.inMatch === true,
    updatedAt: Number.isFinite(Number(session.updatedAt)) ? Number(session.updatedAt) : Date.now(),
    artworkUrl: typeof session.artworkUrl === 'string' && /^https:\/\//i.test(session.artworkUrl)
      ? session.artworkUrl.slice(0, 2048)
      : null,
  };
}

function sanitizeActivitySnapshot(activity) {
  if (!activity || typeof activity !== 'object') return null;
  const safe = {
    id: typeof activity.id === 'string' ? activity.id.slice(0, 64) : undefined,
    details: typeof activity.details === 'string' ? activity.details.slice(0, 128) : undefined,
    state: typeof activity.state === 'string' ? activity.state.slice(0, 128) : undefined,
    largeImageText: typeof activity.largeImageText === 'string' ? activity.largeImageText.slice(0, 128) : undefined,
    category: typeof activity.category === 'string' ? activity.category.slice(0, 32) : undefined,
    emoji: typeof activity.emoji === 'string' ? activity.emoji.slice(0, 8) : undefined,
  };
  if (activity.musicTrack) {
    safe.musicTrack = sanitizeNowPlayingTrack(activity.musicTrack);
  }
  if (activity.gameSession) {
    safe.gameSession = sanitizeGameSession(activity.gameSession);
  }
  if (Array.isArray(activity.buttons)) {
    safe.buttons = activity.buttons.slice(0, 2).map((btn) => {
      if (!btn || typeof btn !== 'object') return null;
      const label = typeof btn.label === 'string' ? btn.label.slice(0, 32) : '';
      const url = typeof btn.url === 'string' ? btn.url.slice(0, 2048) : '';
      return label && url ? { label, url } : null;
    }).filter(Boolean);
  }
  return stripSensitiveFields(safe);
}

function redactForLog(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (looksLikeSecretValue(value)) return '[REDACTED]';
    return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  }
  if (typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value, (key, v) => {
      if (isSensitiveKey(key) || looksLikeSecretValue(v)) return '[REDACTED]';
      return v;
    }));
  } catch {
    return '[REDACTED]';
  }
}

function createIpcRateLimiter(limitsByChannel = {}) {
  const buckets = new Map();
  return {
    check(channel) {
      const ms = limitsByChannel[channel];
      if (!ms) return true;
      const now = Date.now();
      const last = buckets.get(channel) || 0;
      if (now - last < ms) return false;
      buckets.set(channel, now);
      return true;
    },
  };
}

module.exports = {
  ALG,
  ENCRYPTED_FILE_EXT,
  MASTER_KEY_FILE,
  initSecurity,
  tryLoadLegacyKeychainMasterKey,
  isKeychainActive,
  deriveDeviceKeyV1,
  deriveDeviceKeyV3,
  encryptJson,
  decryptJson,
  writeSecureJson,
  readSecureJson,
  migratePlaintextFile,
  encryptExport,
  decryptExport,
  encryptSecret,
  decryptSecret,
  secureUnlink,
  isTlsUrl,
  isSensitiveKey,
  stripSensitiveFields,
  sanitizeNowPlayingTrack,
  sanitizeGameSession,
  sanitizeActivitySnapshot,
  redactForLog,
  writeEncryptedBinaryFile,
  readEncryptedBinaryFile,
  encryptedMediaName,
  migratePlainMediaFile,
  migrateMediaDirectory,
  clearKeyCache,
  scheduleLazyMediaEncryption,
  mimeFromExt,
  createIpcRateLimiter,
};
