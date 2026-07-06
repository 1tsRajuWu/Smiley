/**
 * Anonymous install registry — legal-minimal fields only.
 * Sends once per install when user opts in (Settings → Share anonymous install count).
 * Requires downloads.registry.json at repo root (see downloads.registry.example.json).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const INSTALL_ID_FILE = 'install-id';
const REGISTERED_MARKER = '.install-registered';

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

function isInstallRegistered(userDataDir) {
  return fs.existsSync(path.join(userDataDir, REGISTERED_MARKER));
}

function markInstallRegistered(userDataDir) {
  try {
    fs.writeFileSync(path.join(userDataDir, REGISTERED_MARKER), new Date().toISOString(), 'utf8');
  } catch (_) {}
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

async function registerAnonymousInstall({
  rootDir,
  userDataDir,
  appVersion,
  platform,
  arch,
}) {
  const registry = loadRegistryConfig(rootDir);
  if (!registry) return { skipped: true, reason: 'no-registry-config' };
  if (isInstallRegistered(userDataDir)) return { skipped: true, reason: 'already-registered' };

  const installId = getOrCreateInstallId(userDataDir);
  if (!installId) return { skipped: true, reason: 'no-install-id' };

  const row = {
    install_id: installId,
    platform: ['darwin', 'win32', 'linux'].includes(platform) ? platform : 'linux',
    arch: typeof arch === 'string' ? arch.slice(0, 16) : null,
    app_version: String(appVersion || 'unknown').slice(0, 32),
  };

  const endpoint = `${registry.supabaseUrl}/rest/v1/installs`;
  try {
    await postJson(endpoint, {
      apikey: registry.supabaseAnonKey,
      Authorization: `Bearer ${registry.supabaseAnonKey}`,
      Prefer: 'return=minimal',
    }, row);
    markInstallRegistered(userDataDir);
    return { success: true, installId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  loadRegistryConfig,
  registerAnonymousInstall,
  isInstallRegistered,
  getOrCreateInstallId,
};
