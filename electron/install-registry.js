/**
 * Install registry — mandatory usage telemetry (see PRIVACY.md, ToS.md, SECURITY.md).
 * Upserts install_id, platform, version, OS, locale, timezone, and geo on each launch.
 * All requests use HTTPS (TLS). IP address is hashed server-side from request headers.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const {
  readSecureJson,
  writeSecureJson,
  migratePlaintextFile,
  isTlsUrl,
} = require('./security');

const INSTALL_ID_FILE = 'install-id';
const INSTALL_ID_SECURE = 'install-id.secure';

/** Bump when Privacy Policy / ToS change materially. */
const CONSENT_VERSION = '2026-07-09';

let registrationPromise = null;

function getRegistryConfigPath(rootDir) {
  return path.join(rootDir, 'downloads.registry.json');
}

function loadRegistryConfig(rootDir) {
  const configPath = getRegistryConfigPath(rootDir);
  if (!fs.existsSync(configPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const supabaseUrl = String(data.supabaseUrl || '').trim().replace(/\/$/, '');
    const supabaseAnonKey = String(data.supabaseAnonKey || '').trim();
    if (!supabaseUrl || !supabaseAnonKey) return null;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) return null;
    if (!isTlsUrl(supabaseUrl)) return null;
    return { supabaseUrl, supabaseAnonKey };
  } catch {
    return null;
  }
}

function getOrCreateInstallId(userDataDir) {
  const securePath = path.join(userDataDir, INSTALL_ID_SECURE);
  const legacyPath = path.join(userDataDir, INSTALL_ID_FILE);

  if (!fs.existsSync(securePath) && fs.existsSync(legacyPath)) {
    migratePlaintextFile(legacyPath, securePath, userDataDir, (raw) => {
      const id = raw.trim();
      return /^[0-9a-f-]{36}$/i.test(id) ? { value: id } : null;
    });
  }

  const stored = readSecureJson(securePath, userDataDir);
  const existing = stored?.value ? String(stored.value).trim() : '';
  if (/^[0-9a-f-]{36}$/i.test(existing)) return existing;

  const id = crypto.randomUUID();
  try {
    writeSecureJson(securePath, { value: id }, userDataDir);
    if (fs.existsSync(legacyPath)) {
      try { fs.unlinkSync(legacyPath); } catch (_) {}
    }
  } catch (_) {}
  return id;
}

function buildUserAgent({ appVersion, platform, osRelease, arch, electronVersion }) {
  const parts = [
    `Smiley/${String(appVersion || 'unknown').slice(0, 32)}`,
    `Electron/${String(electronVersion || 'unknown').slice(0, 32)}`,
    `${platform}/${String(osRelease || 'unknown').slice(0, 64)}`,
    arch ? String(arch).slice(0, 16) : null,
  ].filter(Boolean);
  return parts.join(' ').slice(0, 256);
}

function buildSupabaseHeaders(anonKey) {
  const key = String(anonKey || '').trim();
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function requestJson(url, { method = 'GET', headers = {}, body = null, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!isTlsUrl(url)) {
      reject(new Error('Registry requires HTTPS'));
      return;
    }
    const parsed = new URL(url);
    const lib = parsed.protocol === 'http:' ? http : https;
    const payload = body != null ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload != null) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = lib.request(
      url,
      { method, headers: reqHeaders, timeout },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch {
              resolve({});
            }
          } else {
            const err = new Error(`Registry HTTP ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.body = data;
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Registry timeout'));
    });
    if (payload != null) req.write(payload);
    req.end();
  });
}

function postJson(url, headers, body, method = 'POST') {
  return requestJson(url, { method, headers, body });
}

const GEO_LOOKUP_URL = 'https://ipwho.is/';

function mapGeoToRow(geo) {
  if (!geo?.success) return null;
  return {
    country_code: geo.country_code ? String(geo.country_code).slice(0, 8).toUpperCase() : null,
    region: geo.region ? String(geo.region).slice(0, 64) : (geo.region_code ? String(geo.region_code).slice(0, 16) : null),
    country_name: geo.country ? String(geo.country).slice(0, 64) : null,
    region_name: geo.region ? String(geo.region).slice(0, 64) : null,
    city: geo.city ? String(geo.city).slice(0, 64) : null,
    isp: geo.connection?.isp ? String(geo.connection.isp).slice(0, 128) : null,
    geo_timezone: geo.timezone?.id ? String(geo.timezone.id).slice(0, 64) : null,
  };
}

async function enrichInstallGeo(registry, installId, headers) {
  try {
    const geo = await requestJson(GEO_LOOKUP_URL, { timeout: 8000 });
    const patch = mapGeoToRow(geo);
    if (!patch) return { skipped: true, reason: 'geo-lookup-failed' };
    const endpoint = `${registry.supabaseUrl}/rest/v1/installs?install_id=eq.${encodeURIComponent(installId)}`;
    await postJson(endpoint, headers, patch, 'PATCH');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function buildInstallRow({
  installId, appVersion, platform, arch, osRelease, electronVersion, locale, timezone, channel,
}) {
  return {
    install_id: installId,
    platform: ['darwin', 'win32', 'linux'].includes(platform) ? platform : 'linux',
    arch: typeof arch === 'string' ? arch.slice(0, 16) : null,
    app_version: String(appVersion || 'unknown').slice(0, 32),
    os_version: typeof osRelease === 'string' ? osRelease.slice(0, 64) : null,
    electron_version: typeof electronVersion === 'string' ? electronVersion.slice(0, 32) : null,
    locale: typeof locale === 'string' ? locale.slice(0, 16) : null,
    timezone: typeof timezone === 'string' ? timezone.slice(0, 64) : null,
    channel: typeof channel === 'string' ? channel.slice(0, 32) : 'release',
    user_agent: buildUserAgent({ appVersion, platform, osRelease, arch, electronVersion }),
    consent_version: CONSENT_VERSION,
  };
}

async function upsertInstallRow(endpoint, headers, installId, row) {
  const patch = { ...row };
  delete patch.install_id;
  const patchUrl = `${endpoint}?install_id=eq.${encodeURIComponent(installId)}`;
  try {
    await postJson(endpoint, headers, row);
  } catch (err) {
    if (err.statusCode !== 409) throw err;
    await postJson(patchUrl, headers, patch, 'PATCH');
  }
}

async function registerInstall({
  rootDir, userDataDir, appVersion, platform, arch, osRelease, electronVersion, locale, timezone, channel,
}) {
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    const registry = loadRegistryConfig(rootDir);
    if (!registry) return { skipped: true, reason: 'no-registry-config' };

    const installId = getOrCreateInstallId(userDataDir);
    if (!installId) return { skipped: true, reason: 'no-install-id' };

    const row = buildInstallRow({
      installId, appVersion, platform, arch, osRelease, electronVersion, locale, timezone, channel,
    });

    const endpoint = `${registry.supabaseUrl}/rest/v1/installs`;
    const headers = { ...buildSupabaseHeaders(registry.supabaseAnonKey), Prefer: 'return=minimal' };
    try {
      await upsertInstallRow(endpoint, headers, installId, row);
      await enrichInstallGeo(registry, installId, headers);
      return { success: true, installId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  })();

  try {
    return await registrationPromise;
  } finally {
    registrationPromise = null;
  }
}

module.exports = {
  CONSENT_VERSION,
  loadRegistryConfig,
  registerInstall,
  getOrCreateInstallId,
  buildUserAgent,
  buildInstallRow,
  mapGeoToRow,
};
