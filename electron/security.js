/**
 * Smiley security layer — AES-256-GCM encryption for local data and exports.
 * See SECURITY.md for the full threat model and E2EE scope.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

const ALG = 'aes-256-gcm';
const IV_BYTES = 16;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

const SALT_V1 = 'smiley-salt-v1';
const SALT_V3 = 'smiley-salt-v3-e2ee';
const EXPORT_KDF_SALT = 'smiley-export-e2ee-v1';
const APP_ID = 'com.smiley.rpc';

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
  return crypto.scryptSync(entropy, SALT_V3, KEY_BYTES, { N: 16384, r: 8, p: 1 });
}

function deriveExportKey(passphrase, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(String(passphrase), Buffer.concat([Buffer.from(EXPORT_KDF_SALT), salt]), KEY_BYTES, {
    N: 16384,
    r: 8,
    p: 1,
  });
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

function encryptJson(plainObj, userDataPath, { version = 3 } = {}) {
  try {
    const json = JSON.stringify(plainObj);
    const key = version === 1 ? deriveDeviceKeyV1(userDataPath) : deriveDeviceKeyV3(userDataPath);
    const { iv, data, tag } = aesEncrypt(json, key);
    return { v: version, alg: ALG, iv, data, tag };
  } catch (e) {
    console.error('[security.encryptJson]', e.message);
    return { v: 0, data: JSON.stringify(plainObj) };
  }
}

function decryptJson(envelope, userDataPath) {
  try {
    if (!envelope || typeof envelope !== 'object') return {};
    if (envelope.v === 2) return { __keychainMigration: true };
    if (envelope.v === 0) return JSON.parse(envelope.data || '{}');

    const tryVersions = envelope.v === 1
      ? [{ v: 1, key: deriveDeviceKeyV1(userDataPath) }]
      : [{ v: 3, key: deriveDeviceKeyV3(userDataPath) }, { v: 1, key: deriveDeviceKeyV1(userDataPath) }];

    for (const { key } of tryVersions) {
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
  const envelope = encryptJson(plainObj, userDataPath, { version: 3 });
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
  const key = deriveExportKey(passphrase, salt.toString('hex'));
  const json = JSON.stringify(plainObj);
  const { iv, data, tag } = aesEncrypt(json, key);
  return {
    v: 1,
    type: 'smiley-export',
    alg: ALG,
    kdf: 'scrypt',
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
  const key = deriveExportKey(passphrase, envelope.salt);
  const decrypted = aesDecrypt(envelope, key);
  const parsed = JSON.parse(decrypted);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid export payload');
  }
  return parsed;
}

function encryptSecret(value, userDataPath) {
  return encryptJson({ value: String(value) }, userDataPath, { version: 3 });
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

/** Key names that must never be stored, exported, or forwarded over IPC. */
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

module.exports = {
  ALG,
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
  sanitizeActivitySnapshot,
  redactForLog,
};
