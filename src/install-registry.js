/**
 * Install registry — default-on usage tracking (see PRIVACY.md, ToS.md).
 * Upserts install_id, platform, version, user agent on each launch when enabled.
 * IP address is captured server-side by Supabase/Postgres from request headers.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const INSTALL_ID_FILE = 'install-id';

/** Bump when Privacy Policy / ToS change materially. */
const CONSENT_VERSION = '2026-07-06';

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
    return { supabaseUrl, supabaseAnonKey };
  } catch {
    return null;
  }
}

function getOrCreateInstallId(userDataDir) {
  const idPath = path.join(userDataDir, INSTALL_ID_FILE);
  try {
    if (fs.existsSync(idPath)) {
      const existing = fs.readFileSync(idPath, 'utf8').trim();
      if (/^[0-9a-f-]{36}$/i.test(existing)) return existing;
    }
  } catch (_) {}
  const id = crypto.randomUUID();
  try {
    fs.writeFileSync(idPath, id, 'utf8');
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

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'http:' ? http : https;
    const payload = JSON.stringify(body);
    const req = lib.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 15000,
      },
      (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ ok: true, status: res.statusCode });
        else reject(new Error(`Registry HTTP ${res.statusCode}`));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Registry timeout'));
    });
    req.write(payload);
    req.end();
  });
}

async function registerInstall({
  rootDir,
  userDataDir,
  appVersion,
  platform,
  arch,
  osRelease,
  electronVersion,
  shouldProceed = () => true,
}) {
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    if (!shouldProceed()) return { skipped: true, reason: 'opt-out' };

    const registry = loadRegistryConfig(rootDir);
    if (!registry) return { skipped: true, reason: 'no-registry-config' };

    const installId = getOrCreateInstallId(userDataDir);
    if (!installId) return { skipped: true, reason: 'no-install-id' };

    const row = {
      install_id: installId,
      platform: ['darwin', 'win32', 'linux'].includes(platform) ? platform : 'linux',
      arch: typeof arch === 'string' ? arch.slice(0, 16) : null,
      app_version: String(appVersion || 'unknown').slice(0, 32),
      user_agent: buildUserAgent({ appVersion, platform, osRelease, arch, electronVersion }),
      consent_version: CONSENT_VERSION,
    };

    const endpoint = `${registry.supabaseUrl}/rest/v1/installs`;
    try {
      if (!shouldProceed()) return { skipped: true, reason: 'opt-out' };
      await postJson(endpoint, {
        apikey: registry.supabaseAnonKey,
        Authorization: `Bearer ${registry.supabaseAnonKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }, row);
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
};
