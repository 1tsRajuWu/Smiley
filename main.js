// ═══════════════════════════════════════════════════════════════════════
// YOU ARE HERE: Electron MAIN process (backend)
// ─ UI lives in src/ (renderer.js, index.html)
// ─ Bridge: preload.js exposes window.smiley → IPC handlers below
// ─ Project map: PROJECT-STRUCTURE.md │ Newbie tour: docs/CODE-TOUR.md
// ─ Module index: electron/README.md
//
// TABLE OF CONTENTS (search for the section name):
//   Constants · Encryption · Config · State · Window State · Tray Icons
//   Window · Tray · Discord RPC · Auto Updater
//   Custom Wallpapers · Custom Animations · Custom Activities
//   Storage & cache cleanup · IPC · App Lifecycle
// ═══════════════════════════════════════════════════════════════════════
const os = require('os');
const { spawn } = require('child_process');
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, globalShortcut, clipboard, screen, Notification, nativeTheme, session, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pkg = require('./package.json');
const {
  loadRegistryConfig,
  registerInstall,
} = require('./electron/install-registry');
const { createMusicSync } = require('./electron/music-sync');
const { createGameSync } = require('./electron/game-sync');
const {
  encryptJson,
  decryptJson,
  writeSecureJson,
  readSecureJson,
  migratePlaintextFile,
  encryptExport,
  decryptExport,
  secureUnlink,
  stripSensitiveFields,
  sanitizeNowPlayingTrack,
  sanitizeGameSession,
  sanitizeActivitySnapshot,
  redactForLog,
  initSecurity,
  isKeychainActive,
  writeEncryptedBinaryFile,
  readEncryptedBinaryFile,
  encryptedMediaName,
  migrateMediaDirectory,
  ENCRYPTED_FILE_EXT,
  createIpcRateLimiter,
  mimeFromExt,
} = require('./electron/security');

function getRPC() {
  return require('discord-rpc');
}

function getAutoUpdater() {
  return require('electron-updater').autoUpdater;
}

function isPortableBuild() {
  if (process.platform !== 'win32') return false;
  if (process.env.PORTABLE_EXECUTABLE_DIR) return true;
  return /portable/i.test(path.basename(process.execPath));
}

// Portable: keep settings beside the exe instead of shared %APPDATA%
if (isPortableBuild()) {
  const portableBase = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  app.setPath('userData', path.join(portableBase, 'SmileyData'));
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

/** Custom quit flag — Electron has no built-in app.isQuitting(). */
app.isQuitting = false;
function isAppQuitting() { return app.isQuitting === true; }
function markAppQuitting() { app.isQuitting = true; }

// ─── Constants ───────────────────────────────────────────────────────
const isDev = process.argv.includes('--dev');
const isPackaged = app.isPackaged;
const APP_VERSION = pkg.version;
const APP_DISPLAY_NAME = 'Smiley';
const GLOBAL_HOTKEY = 'CommandOrControl+Shift+S';
const EXAMPLE_CONFIG = path.join(__dirname, 'config.example.json');
const DISCORD_APP_CONFIG = path.join(__dirname, 'discord.app.json');

function getUserDataPath(...segments) {
  return path.join(app.getPath('userData'), ...segments);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

/** True when the app is running from a mounted DMG (not yet installed to /Applications). */
function isRunningFromDmg() {
  if (process.platform !== 'darwin' || !isPackaged) return false;
  try {
    return app.getAppPath().includes('/Volumes/');
  } catch (_) {
    return false;
  }
}

function getInstallLocationWarning() {
  if (process.platform !== 'darwin' || !isPackaged) return null;
  if (isRunningFromDmg()) {
    return {
      title: 'Install Smiley to Applications',
      message: 'Smiley is running from the installer disk image.',
      detail: 'Drag Smiley to the Applications folder once, then open it from Applications — not from this disk image.\n\nIf you already see multiple Smiley apps, delete the extras and keep only /Applications/Smiley.app.',
    };
  }
  try {
    const bundlePath = app.getAppPath();
    if (!bundlePath.startsWith('/Applications' + path.sep)) {
      return {
        title: 'Install Smiley to Applications',
        message: 'Smiley is not in the Applications folder.',
        detail: 'Move Smiley to /Applications and launch it from there for updates and auto-launch to work correctly.\n\nIf you already see multiple Smiley apps, delete the extras and keep only /Applications/Smiley.app.',
      };
    }
  } catch (_) {}
  return null;
}

// ─── Encryption (AES-256-GCM — see electron/security.js & SECURITY.md) ─
function getUserDataRoot() {
  return app.getPath('userData');
}

function encryptConfig(plainObj) {
  return encryptJson(plainObj, getUserDataRoot());
}

function decryptConfig(encryptedObj, options = {}) {
  return decryptJson(encryptedObj, getUserDataRoot(), options);
}

const WINDOW_STATE_SECURE = 'window-state.secure';
const WINDOW_STATE_LEGACY = 'window-state.json';

function migrateWindowStateIfNeeded() {
  const userData = getUserDataRoot();
  const securePath = getUserDataPath(WINDOW_STATE_SECURE);
  const legacyPath = getUserDataPath(WINDOW_STATE_LEGACY);
  if (fs.existsSync(securePath)) return;
  migratePlaintextFile(legacyPath, securePath, userData);
}

function readWindowStateFile() {
  migrateWindowStateIfNeeded();
  const userData = getUserDataRoot();
  const securePath = getUserDataPath(WINDOW_STATE_SECURE);
  const legacyPath = getUserDataPath(WINDOW_STATE_LEGACY);
  const fromSecure = readSecureJson(securePath, userData);
  if (fromSecure && typeof fromSecure === 'object') return fromSecure;
  if (fs.existsSync(legacyPath)) {
    try {
      return JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    } catch (_) {}
  }
  return null;
}

function writeWindowStateFile(state) {
  writeSecureJson(getUserDataPath(WINDOW_STATE_SECURE), state, getUserDataRoot());
  secureUnlink(getUserDataPath(WINDOW_STATE_LEGACY));
}

// ─── Config ──────────────────────────────────────────────────────────
// Client ID is baked into discord.app.json at build time — not user-editable
function loadDiscordClientId() {
  try {
    if (fs.existsSync(DISCORD_APP_CONFIG)) {
      const appConfig = JSON.parse(fs.readFileSync(DISCORD_APP_CONFIG, 'utf8'));
      const id = String(appConfig.clientId || '').trim();
      if (id && id !== 'YOUR_DISCORD_APPLICATION_CLIENT_ID' && /^\d+$/.test(id)) {
        return id;
      }
    }
  } catch (err) {
    console.error('[loadDiscordClientId]', err.message);
  }
  const fromEnv = String(process.env.DISCORD_CLIENT_ID || '').trim();
  return /^\d+$/.test(fromEnv) ? fromEnv : '';
}

const BUNDLED_CLIENT_ID = loadDiscordClientId();
const DONATION_URL = 'https://paypal.me/1tsRaj';
const GITHUB_REPO_URL =
  String(pkg.repository?.url || 'https://github.com/1tsRajuWu/Smiley.git')
    .replace(/\.git$/, '')
    .trim();
const SMILEY_SITE_URL = String(pkg.homepage || 'https://1tsrajuwu.github.io/Smiley/').replace(/\/?$/, '/');
const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`;
const GITHUB_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function getMacDmgArch() {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

function normalizeReleaseVersion(version) {
  const ver = String(version || '').replace(/^v/i, '').trim();
  if (!RELEASE_VERSION_PATTERN.test(ver)) return '';
  return ver;
}

function compareReleaseVersions(a, b) {
  const parse = (version) => normalizeReleaseVersion(version)
    .split(/[-+]/)[0]
    .split('.')
    .map((part) => parseInt(part, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (av[i] || 0) - (bv[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function extractVersionFromZipPath(zipPath) {
  if (!zipPath) return '';
  const base = path.basename(zipPath, '.zip');
  const withArch = base.match(/^Smiley-(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)-(?:arm64|x64|mac|universal)$/i);
  if (withArch) return normalizeReleaseVersion(withArch[1]);
  const plain = base.match(/^Smiley-(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/i);
  if (plain) return normalizeReleaseVersion(plain[1]);
  try {
    const infoPath = path.join(path.dirname(zipPath), 'update-info.json');
    if (fs.existsSync(infoPath)) {
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      const fromInfo = normalizeReleaseVersion(info?.version);
      if (fromInfo) return fromInfo;
    }
  } catch (_) {}
  return '';
}

function resolveUpdateVersion(explicitVersion) {
  const fromExplicit = normalizeReleaseVersion(explicitVersion);
  if (fromExplicit) return fromExplicit;
  const fromPending = normalizeReleaseVersion(pendingUpdateVersion);
  if (fromPending) return fromPending;
  return extractVersionFromZipPath(getMacDownloadedZipPath());
}

function isCachedMacUpdateInstallable() {
  const zipPath = getMacDownloadedZipPath();
  if (!zipPath) return false;
  try {
    if (fs.statSync(zipPath).size <= 1024 * 1024) return false;
  } catch {
    return false;
  }
  const ver = resolveUpdateVersion();
  if (!ver || compareReleaseVersions(ver, APP_VERSION) <= 0) {
    clearMacUpdaterArtifacts();
    return false;
  }
  return true;
}

function getGithubReleasesApiUrl() {
  try {
    const parsed = new URL(GITHUB_REPO_URL);
    if (parsed.hostname.replace(/^www\./, '') !== 'github.com') return null;
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) return null;
    return `https://api.github.com/repos/${parts[0]}/${parts[1]}/releases/latest`;
  } catch {
    return null;
  }
}

function isMacMetadataMissingError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('latest-mac.yml') ||
    msg.includes('latest.yml') ||
    msg.includes('latest-linux.yml') ||
    (msg.includes('404') && (msg.includes('mac') || msg.includes('release')))
  );
}

function httpGetJson(url, { maxRedirects = 5, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Invalid URL'));
      return;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'api.github.com' && host !== 'github.com') {
      reject(new Error('Host not allowed'));
      return;
    }
    const lib = parsed.protocol === 'http:' ? require('http') : require('https');
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': `Smiley/${APP_VERSION}`,
          Accept: 'application/vnd.github+json',
        },
        timeout,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          httpGetJson(next, { maxRedirects: maxRedirects - 1, timeout }).then(resolve).catch(reject);
          return;
        }
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 512000) {
            req.destroy();
            reject(new Error('Response too large'));
          }
        });
        res.on('end', () => resolve({ status: res.statusCode, body, finalUrl: url }));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

async function checkMacUpdateViaGithubApi() {
  const apiUrl = getGithubReleasesApiUrl();
  if (!apiUrl) {
    return { ok: false, status: 'error', error: 'Could not resolve GitHub releases API URL.' };
  }
  const { status, body } = await httpGetJson(apiUrl);
  if (status !== 200) {
    return {
      ok: false,
      status: 'no-release',
      message: 'No update on GitHub yet — download the latest installer from github.com/1tsRajuWu/Smiley/releases',
      expected: true,
    };
  }
  let release;
  try {
    release = JSON.parse(body);
  } catch {
    return { ok: false, status: 'error', error: 'Could not parse GitHub release info.' };
  }
  const ver = normalizeReleaseVersion(release?.tag_name);
  if (!ver) {
    return { ok: false, status: 'error', error: 'Could not parse release version from GitHub.' };
  }
  if (compareReleaseVersions(ver, APP_VERSION) <= 0) {
    return { ok: true, status: 'up-to-date', version: APP_VERSION };
  }
  pendingUpdateVersion = ver;
  if (isCachedMacUpdateInstallable()) {
    updateDownloaded = true;
    lastDownloadPercent = 100;
    const payload = buildMacUpdateReadyPayload(ver);
    sendUpdateStatus(payload);
    return { ok: true, status: 'downloaded', version: ver };
  }
  sendUpdateStatus({
    status: 'available',
    version: ver,
    percent: 0,
    macInApp: true,
  });
  const download = await downloadMacUpdateZip(ver);
  if (download.success) {
    return { ok: true, status: 'downloaded', version: ver };
  }
  return {
    ok: true,
    status: 'available',
    version: ver,
    message: download.error || 'Update available — click Install update to download.',
  };
}

async function tryMacGithubReleaseFallback() {
  if (!isMacInAppUpdater()) return null;
  try {
    return await checkMacUpdateViaGithubApi();
  } catch (err) {
    appendUpdaterLog(`GitHub API fallback failed: ${err.message}`);
    return null;
  }
}

function notifyMacCachedUpdateIfReady() {
  if (!isMacInAppUpdater() || !isCachedMacUpdateInstallable()) return false;
  const ver = resolveUpdateVersion();
  pendingUpdateVersion = ver;
  updateDownloaded = true;
  lastDownloadPercent = 100;
  sendUpdateStatus(buildMacUpdateReadyPayload(ver));
  return true;
}

function buildMacDmgDownloadUrl(version) {
  const ver = normalizeReleaseVersion(version);
  const arch = getMacDmgArch();
  return `${GITHUB_REPO_URL}/releases/download/v${ver}/Smiley-${ver}-${arch}.dmg`;
}

function buildMacZipDownloadUrl(version) {
  const ver = normalizeReleaseVersion(version);
  const arch = getMacDmgArch();
  return `${GITHUB_REPO_URL}/releases/download/v${ver}/Smiley-${ver}-${arch}.zip`;
}

function getMacZipPathForVersion(version) {
  const ver = normalizeReleaseVersion(version);
  if (!ver) return null;
  const dir = path.join(getUpdaterCacheDir(), 'pending');
  ensureDir(dir);
  return path.join(dir, `Smiley-${ver}-${getMacDmgArch()}.zip`);
}

function getMacUpdateDownloadDir() {
  const dir = path.join(app.getPath('downloads'), 'Smiley Updates');
  ensureDir(dir);
  return dir;
}

function getMacDmgPathForVersion(version) {
  const ver = normalizeReleaseVersion(version);
  if (!ver) return null;
  return path.join(getMacUpdateDownloadDir(), `Smiley-${ver}-${getMacDmgArch()}.dmg`);
}

function isAllowedGithubDownloadUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return GITHUB_DOWNLOAD_HOSTS.has(host);
  } catch {
    return false;
  }
}
// package.json mac.identity is "-" (ad-hoc). Squirrel ShipIt is bypassed — custom shell
// installer copies the verified zip from electron-updater cache (v4.1.9+).
const MAC_ADHOC_DISTRIBUTION = true;
const MAC_IN_APP_UPDATES = process.platform === 'darwin';
const DEFAULT_RPC_BUTTONS = [
  { label: 'Download', url: `${SMILEY_SITE_URL}#download` },
];
// SSRF guard — only fetch GIFs from known CDNs
const ALLOWED_GIF_HOSTS = [
  'tenor.com',
  'giphy.com',
  'nekos.best',
  'waifu.pics',
];

function isAllowedGifHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return ALLOWED_GIF_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

function isAllowedGifUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return isAllowedGifHost(parsed.hostname);
  } catch {
    return false;
  }
}

const ALLOWED_EXTERNAL_HOSTS = [
  'github.com',
  'github.io',
  'paypal.me',
  'discord.com',
  'discord.gg',
];

function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const h = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return ALLOWED_EXTERNAL_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

const CONFIG_PATCH_KEYS = new Set([
  'theme', 'uiVersion', 'showTimer', 'animationsEnabled', 'customAnimation', 'customWallpaper',
  'windowState', 'autoConnect', 'minimizeToTray', 'launchAtLogin', 'hotkeyEnabled',
  'autoCheckUpdates', 'autoInstallUpdates',
  'recentActivities', 'favoriteActivities',
  'customActivities', 'activityGifChoice', 'activityProfiles', 'rotateFavorites', 'sessionStats',
  'migrationNoticeShown', 'installWarningShown', 'installConsentShown',
  'musicNowPlaying', 'musicNowPlayingAlbumArt',
  'gamingNowPlaying', 'gamingNowPlayingCoverArt',
]);
const MAX_ACTIVITY_PROFILES = 8;
const MAX_PROFILE_ACTIVITIES = 10;
const MAX_COPY_TEXT_LEN = 2000;
const MAX_IMPORT_BYTES = 512 * 1024;
/** Discord RPC client-side spacing (ms). Music metadata uses applyMusicPresence directly. */
const PRESENCE_UPDATE_COOLDOWN_MS = 6000;
const STATUS_BROADCAST_DEBOUNCE_MS = 1200;
const TRAY_MENU_DEBOUNCE_MS = 3000;
const WINDOW_STATE_DEBOUNCE_MS = 500;
const SESSION_STATS_DEBOUNCE_MS = 2000;

const DEFAULT_CONFIG = {
  donationUrl: DONATION_URL,
  theme: 'dark',
  uiVersion: 'v3',
  showTimer: true,
  animationsEnabled: true,
  customAnimation: null,
  customWallpaper: null,
  windowState: { width: 1100, height: 780 },
  autoConnect: true,
  minimizeToTray: true,
  launchAtLogin: false,
  hotkeyEnabled: true,
  autoCheckUpdates: true,
  autoInstallUpdates: true,
  installTrackingEnabled: true,
  installConsentShown: false,
  recentActivities: [],
  favoriteActivities: [],
  customActivities: [],
  activityGifChoice: {},
  activityProfiles: [],
  rotateFavorites: { enabled: false, intervalMinutes: 15 },
  sessionStats: {},
  migrationNoticeShown: false,
  installWarningShown: false,
  musicNowPlaying: true,
  musicNowPlayingAlbumArt: true,
  gamingNowPlaying: true,
  gamingNowPlayingCoverArt: true,
};
let config = { ...DEFAULT_CONFIG };
let configMigrationNotice = null;
const CONFIG_SECURE = 'config.secure';
const CONFIG_SECURE_BACKUP = 'config.secure.bak';
const CONFIG_LEGACY = 'config.json';
/** Set when config could not be loaded — blocks orphan media cleanup that would delete custom GIFs. */
let configLoadHadFailure = false;
let configLoadRecovered = false;

function readEncryptedConfigFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return decryptConfig(raw, {
      tryLegacyKeychain: true,
      safeStorage,
    });
  } catch (err) {
    console.warn('[loadConfig] read failed:', filePath, err.message);
    return null;
  }
}

function readPlaintextConfigFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn('[loadConfig] plaintext read failed:', filePath, err.message);
    return null;
  }
}

function hasExistingUserMedia() {
  const dirs = [
    getUserDataPath('custom-activities'),
    getUserDataPath('custom-animations'),
    getUserDataPath('wallpapers'),
  ];
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).some((name) => !name.startsWith('.'))) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

function mergeCustomActivitiesFromBackup(loaded, backup) {
  if (!backup || typeof backup !== 'object') return loaded;
  const current = Array.isArray(loaded?.customActivities) ? loaded.customActivities : [];
  const saved = Array.isArray(backup.customActivities) ? backup.customActivities : [];
  if (current.length > 0 || saved.length === 0) return loaded;
  return { ...loaded, customActivities: saved };
}

function applyLoadedConfig(raw, { recovered = false } = {}) {
  const normalized = normalizeInstallTrackingConfig(stripSensitiveFields({ ...DEFAULT_CONFIG, ...raw }));
  delete normalized.clientId;
  config = normalized;
  if (recovered) configLoadRecovered = true;
}

function backupConfigSecureFile(securePath) {
  if (!securePath || !fs.existsSync(securePath)) return;
  try {
    const backupPath = `${securePath}.bak`;
    fs.copyFileSync(securePath, backupPath);
  } catch (err) {
    console.warn('[saveConfig] backup failed:', err.message);
  }
}

function normalizeInstallTrackingConfig(raw) {
  const cfg = { ...raw };
  cfg.installTrackingEnabled = true;
  if (cfg.installConsentShown === undefined) {
    cfg.installConsentShown = false;
  } else {
    cfg.installConsentShown = cfg.installConsentShown === true;
  }
  delete cfg.shareAnonymousInstallStats;
  return cfg;
}

function isInstallTrackingEnabled() {
  return isPackaged && !!loadRegistryConfig(__dirname);
}

function needsInstallConsentPrompt() {
  return isPackaged
    && !!loadRegistryConfig(__dirname)
    && config.installConsentShown !== true;
}

function loadConfig() {
  const securePath = getUserDataPath(CONFIG_SECURE);
  const backupPath = getUserDataPath(CONFIG_SECURE_BACKUP);
  const legacyPath = getUserDataPath(CONFIG_LEGACY);
  configLoadHadFailure = false;
  configLoadRecovered = false;

  const tryApplyDecrypted = (decrypted, sourcePath, { recovered = false } = {}) => {
    if (!decrypted || typeof decrypted !== 'object') return false;
    if (decrypted.__keychainMigration) return 'migration';
    if (Object.keys(decrypted).length === 0) return false;
    applyLoadedConfig(decrypted, { recovered });
    if (recovered) {
      console.warn(`[loadConfig] recovered settings from ${path.basename(sourcePath)}`);
    }
    return true;
  };

  try {
    if (fs.existsSync(securePath)) {
      const raw = JSON.parse(fs.readFileSync(securePath, 'utf8'));
      const decrypted = decryptConfig(raw, { tryLegacyKeychain: true, safeStorage });
      if (decrypted?.__keychainMigration) {
        const noticeAlreadyShown = config.migrationNoticeShown === true;
        const backupDecrypted = readEncryptedConfigFile(backupPath) || readPlaintextConfigFile(legacyPath);
        if (backupDecrypted && !backupDecrypted.__keychainMigration && Object.keys(backupDecrypted).length > 0) {
          applyLoadedConfig(mergeCustomActivitiesFromBackup(backupDecrypted, backupDecrypted), { recovered: true });
          flushConfigToDisk();
          return;
        }
        config = { ...DEFAULT_CONFIG, migrationNoticeShown: noticeAlreadyShown };
        if (!noticeAlreadyShown) {
          configMigrationNotice = {
            title: 'Settings reset',
            message: 'Smiley updated how settings are stored.',
            detail: 'Your previous settings used macOS Keychain and could not be migrated automatically. Defaults were restored — you can reconfigure theme, favorites, and other preferences in Settings.',
          };
        }
        fs.writeFileSync(securePath, JSON.stringify(encryptConfig(config), null, 2));
        return;
      }
      const applied = tryApplyDecrypted(decrypted, securePath);
      if (applied === true) return;

      console.error('[loadConfig] config.secure could not be decrypted — attempting recovery');
      const backupDecrypted = readEncryptedConfigFile(backupPath) || readPlaintextConfigFile(legacyPath);
      if (tryApplyDecrypted(
        mergeCustomActivitiesFromBackup(backupDecrypted, backupDecrypted),
        backupPath || legacyPath,
        { recovered: true },
      ) === true) {
        flushConfigToDisk();
        return;
      }

      configLoadHadFailure = true;
      config = { ...DEFAULT_CONFIG };
      delete config.clientId;
      console.error('[loadConfig] using in-memory defaults — existing config.secure left untouched');
      return;
    }

    if (fs.existsSync(legacyPath)) {
      const old = readPlaintextConfigFile(legacyPath);
      if (old && tryApplyDecrypted(old, legacyPath) === true) {
        flushConfigToDisk();
        try { fs.unlinkSync(legacyPath); } catch (_) {}
        return;
      }
    }

    if (fs.existsSync(backupPath)) {
      const backup = readEncryptedConfigFile(backupPath);
      if (backup && tryApplyDecrypted(backup, backupPath, { recovered: true }) === true) {
        flushConfigToDisk();
        return;
      }
    }

    if (fs.existsSync(EXAMPLE_CONFIG) && !hasExistingUserMedia()) {
      const example = JSON.parse(fs.readFileSync(EXAMPLE_CONFIG, 'utf8'));
      applyLoadedConfig(example);
      flushConfigToDisk();
      return;
    }
  } catch (err) {
    console.error('[loadConfig]', err.message);
    const backupDecrypted = readEncryptedConfigFile(backupPath) || readPlaintextConfigFile(legacyPath);
    if (backupDecrypted && tryApplyDecrypted(backupDecrypted, backupPath || legacyPath, { recovered: true }) === true) {
      flushConfigToDisk();
      return;
    }
  }

  if (hasExistingUserMedia()) {
    configLoadHadFailure = true;
    config = { ...DEFAULT_CONFIG };
    delete config.clientId;
    console.error('[loadConfig] no readable config but user media exists — skipping defaults write');
    return;
  }
  config = { ...DEFAULT_CONFIG };
}

function getClientId() {
  return BUNDLED_CLIENT_ID;
}

function formatSessionDuration(ms) {
  if (ms == null || typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '0m';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  return `${h}h ${totalMin % 60}m`;
}

function trackRecentActivity(activity) {
  if (!activity?.id) return;
  const entry = {
    id: activity.id,
    details: activity.details,
    state: activity.state,
    category: activity.category,
  };
  const recent = [entry, ...(config.recentActivities || []).filter((r) => r.id !== entry.id)].slice(0, 5);
  saveConfig({ recentActivities: recent });
  sendToWindow('config-changed', {
    recentActivities: recent,
    favoriteActivities: config.favoriteActivities || [],
    customActivities: config.customActivities || [],
    activityProfiles: config.activityProfiles || [],
  });
}

function toggleFavoriteActivity(id) {
  if (!id) return config.favoriteActivities || [];
  let favorites = [...(config.favoriteActivities || [])];
  if (favorites.includes(id)) {
    favorites = favorites.filter((f) => f !== id);
  } else {
    favorites = [id, ...favorites].slice(0, 10);
  }
  saveConfig({ favoriteActivities: favorites });
  sendToWindow('config-changed', {
    recentActivities: config.recentActivities || [],
    favoriteActivities: favorites,
    customActivities: config.customActivities || [],
  });
  return favorites;
}

function applyLaunchAtLogin() {
  try {
    app.setLoginItemSettings({
      openAtLogin: config.launchAtLogin === true,
      openAsHidden: true,
    });
  } catch (err) {
    console.error('[launchAtLogin]', err.message);
  }
}

function registerGlobalHotkey() {
  globalShortcut.unregisterAll();
  if (config.hotkeyEnabled === false) return;
  try {
    globalShortcut.register(GLOBAL_HOTKEY, () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        hideMainWindowToTray();
      } else {
        showMainWindow();
      }
    });
  } catch (err) {
    console.error('[hotkey]', err.message);
  }
}

function showOneTimeDialog(notice, configKey) {
  if (!notice || !mainWindow || config[configKey]) return;
  mainWindow.webContents.once('did-finish-load', () => {
    dialog.showMessageBox(mainWindow, {
      type: notice.type || 'info',
      title: notice.title,
      message: notice.message,
      detail: notice.detail,
      buttons: ['OK'],
    }).then(() => {
      saveConfig({ [configKey]: true });
    });
  });
}

function flushConfigToDisk() {
  try {
    const securePath = getUserDataPath(CONFIG_SECURE);
    const tmpPath = `${securePath}.tmp`;
    if (fs.existsSync(securePath)) {
      backupConfigSecureFile(securePath);
    }
    fs.writeFileSync(tmpPath, JSON.stringify(encryptConfig(config), null, 2));
    fs.renameSync(tmpPath, securePath);
    configLoadHadFailure = false;
    return true;
  } catch (e) {
    console.error('[saveConfig] disk write failed:', e.message);
    return false;
  }
}

async function persistAllUserData() {
  try {
    await flushRendererPendingConfig();
  } catch (e) {
    console.error('[persistAllUserData] renderer flush failed:', e.message);
  }
  flushPendingDiskWrites();
  flushConfigToDisk();
}

function saveConfig(data) {
  const { clientId: _c, donationUrl: _d, ...safeData } = stripSensitiveFields(data || {});
  const patch = sanitizeConfigPatch(safeData);
  config = { ...config, ...patch, donationUrl: DONATION_URL };
  if (!flushConfigToDisk()) {
    console.error('[saveConfig] config updated in memory but not persisted to disk');
  }
}

function shouldCloseToTray() {
  if (process.platform === 'darwin') return true;
  return config.minimizeToTray !== false;
}

async function flushRendererPendingConfig() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const wc = mainWindow.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    await wc.executeJavaScript(
      '(async () => { if (typeof window.__smileyFlushPendingConfig === "function") await window.__smileyFlushPendingConfig(); })()',
      true,
    );
  } catch (e) {
    console.error('[flushRendererPendingConfig]', e.message);
  }
}

function sanitizeConfigPatch(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const key of CONFIG_PATCH_KEYS) {
    if (!(key in data)) continue;
    const val = data[key];
    switch (key) {
      case 'theme':
        if (typeof val === 'string') out.theme = val.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'dark';
        break;
      case 'showTimer':
      case 'animationsEnabled':
      case 'autoConnect':
      case 'minimizeToTray':
      case 'launchAtLogin':
      case 'hotkeyEnabled':
      case 'autoCheckUpdates':
      case 'autoInstallUpdates':
      case 'migrationNoticeShown':
      case 'installWarningShown':
      case 'installConsentShown':
      case 'musicNowPlaying':
      case 'musicNowPlayingAlbumArt':
      case 'gamingNowPlaying':
      case 'gamingNowPlayingCoverArt':
        out[key] = val === true;
        break;
      case 'uiVersion':
        out.uiVersion = val === 'v1' ? 'v1' : val === 'v2' ? 'v2' : 'v3';
        break;
      case 'customAnimation':
        out.customAnimation = typeof val === 'string' ? sanitizeFilename(val).slice(0, 100) : null;
        break;
      case 'customWallpaper':
        if (val === null) {
          out.customWallpaper = null;
        } else if (val && typeof val === 'object' && typeof val.filename === 'string') {
          const filename = sanitizeFilename(val.filename).slice(0, 100);
          out.customWallpaper = filename
            ? {
              filename,
              blur: Math.min(Math.max(Number(val.blur) || 0, 0), 20),
              dim: Math.min(Math.max(Number(val.dim) || 0, 0), 80),
            }
            : null;
        }
        break;
      case 'windowState':
        if (val && typeof val === 'object') {
          out.windowState = {
            width: Math.min(Math.max(Number(val.width) || 1100, 900), 3840),
            height: Math.min(Math.max(Number(val.height) || 780, 650), 2160),
            x: Number.isFinite(val.x) ? val.x : undefined,
            y: Number.isFinite(val.y) ? val.y : undefined,
            maximized: val.maximized === true,
          };
        }
        break;
      case 'recentActivities':
        if (Array.isArray(val)) {
          out.recentActivities = val.slice(0, 5).map((item) => ({
            id: typeof item?.id === 'string' ? item.id.slice(0, 64) : '',
            details: sanitizeActivityText(item?.details, 128),
            state: sanitizeActivityText(item?.state, 128),
            category: typeof item?.category === 'string' ? item.category.slice(0, 32) : undefined,
          })).filter((item) => item.id && item.details);
        }
        break;
      case 'favoriteActivities':
        if (Array.isArray(val)) {
          out.favoriteActivities = val
            .filter((id) => typeof id === 'string')
            .map((id) => id.slice(0, 64))
            .slice(0, 10);
        }
        break;
      case 'customActivities':
        if (Array.isArray(val)) out.customActivities = val.slice(0, 20);
        break;
      case 'activityGifChoice':
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const choices = {};
          for (const [k, v] of Object.entries(val).slice(0, 100)) {
            if (typeof k === 'string' && typeof v === 'string') {
              choices[k.slice(0, 64)] = v.slice(0, 512);
            }
          }
          out.activityGifChoice = choices;
        }
        break;
      case 'activityProfiles':
        if (Array.isArray(val)) {
          out.activityProfiles = val.slice(0, MAX_ACTIVITY_PROFILES).map((item) => {
            if (!item || typeof item !== 'object') return null;
            const name = sanitizeActivityText(item.name, 40);
            const id = typeof item.id === 'string' ? item.id.slice(0, 64) : `profile-${Date.now()}`;
            const activityIds = Array.isArray(item.activityIds)
              ? item.activityIds.filter((aid) => typeof aid === 'string').map((aid) => aid.slice(0, 64)).slice(0, MAX_PROFILE_ACTIVITIES)
              : [];
            if (!name || !activityIds.length) return null;
            return { id, name, activityIds };
          }).filter(Boolean);
        }
        break;
      case 'rotateFavorites':
        if (val && typeof val === 'object') {
          out.rotateFavorites = {
            enabled: val.enabled === true,
            intervalMinutes: Math.min(Math.max(Number(val.intervalMinutes) || 15, 5), 120),
          };
        }
        break;
      case 'sessionStats':
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const stats = {};
          for (const [k, v] of Object.entries(val).slice(0, 200)) {
            if (typeof k === 'string' && Number.isFinite(Number(v)) && Number(v) > 0) {
              stats[k.slice(0, 64)] = Math.min(Math.floor(Number(v)), 864000000);
            }
          }
          out.sessionStats = stats;
        }
        break;
      default:
        break;
    }
  }
  return out;
}

function sanitizeIncomingActivity(activity) {
  if (!activity || typeof activity !== 'object') return null;
  const details = sanitizeActivityText(activity.details);
  if (!details) return null;
  const safe = {
    id: typeof activity.id === 'string' ? activity.id.slice(0, 64) : undefined,
    details,
    state: sanitizeActivityText(activity.state),
    largeImageText: sanitizeActivityText(activity.largeImageText, 128) || details,
    discordImageUrl: typeof activity.discordImageUrl === 'string' ? activity.discordImageUrl.slice(0, 2048) : undefined,
    largeImageUrl: typeof activity.largeImageUrl === 'string' ? activity.largeImageUrl.slice(0, 2048) : undefined,
    fallbackGif: typeof activity.fallbackGif === 'string' ? activity.fallbackGif.slice(0, 2048) : undefined,
    category: typeof activity.category === 'string' ? activity.category.slice(0, 32) : undefined,
    emoji: typeof activity.emoji === 'string' ? activity.emoji.slice(0, 8) : undefined,
  };
  if (Array.isArray(activity.buttons)) {
    safe.buttons = activity.buttons.slice(0, 2).map((btn) => {
      if (!btn || typeof btn !== 'object') return null;
      const label = sanitizeActivityText(btn.label, 32);
      const url = typeof btn.url === 'string' ? btn.url.slice(0, 2048) : '';
      if (!label || !url || !isAllowedExternalUrl(url)) return null;
      return { label, url };
    }).filter(Boolean);
  }
  if (activity.musicTrack) {
    safe.musicTrack = sanitizeNowPlayingTrack(activity.musicTrack);
  }
  if (activity.gameSession) {
    safe.gameSession = sanitizeGameSession(activity.gameSession);
  }
  return stripSensitiveFields(safe);
}

// ─── State ───────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let rpcClient = null;
let currentActivity = null;
let pendingUpdate = null;
let updateTimer = null;
let sessionStart = null;
let currentTrayIcon = 'default';
let pausedPresenceSnapshot = null;
let musicSync = null;
let gameSync = null;
let trayMenuRefreshTimer = null;
let windowStateSaveTimer = null;
let pendingWindowState = null;
let sessionStatsSaveTimer = null;
let sessionStatsDirty = false;
let mainWindowVisible = true;

function isMainWindowVisible() {
  return !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized());
}

function syncMusicSyncVisibility() {
  const visible = isMainWindowVisible();
  mainWindowVisible = visible;
  const sync = musicSync;
  if (!sync) return;
  sync.setUiActive(visible);
  sync.setBackgroundMode(!visible);
}

function scheduleTrayMenuRefresh() {
  if (trayMenuRefreshTimer) return;
  trayMenuRefreshTimer = setTimeout(() => {
    trayMenuRefreshTimer = null;
    updateTrayMenu();
  }, TRAY_MENU_DEBOUNCE_MS);
}

function getMusicSync() {
  if (!musicSync) {
    musicSync = createMusicSync({
      getConfig: () => config,
      applyMusicPresence,
      sendToRenderer: (track, artworkUrl) => {
        const safe = sanitizeNowPlayingTrack(track);
        if (safe && artworkUrl) safe.artworkUrl = artworkUrl;
        sendToWindow('now-playing-update', safe);
      },
      isPaused: isPresencePaused,
    });
  }
  return musicSync;
}

function getGameSync() {
  if (!gameSync) {
    gameSync = createGameSync({
      getConfig: () => config,
      applyGamePresence,
      sendToRenderer: (session) => {
        sendToWindow('gaming-update', sanitizeGameSession(session));
      },
      isPaused: isPresencePaused,
    });
  }
  return gameSync;
}

function scheduleSessionStatsSave() {
  sessionStatsDirty = true;
  if (sessionStatsSaveTimer) return;
  sessionStatsSaveTimer = setTimeout(() => {
    sessionStatsSaveTimer = null;
    if (!sessionStatsDirty) return;
    sessionStatsDirty = false;
    flushConfigToDisk();
  }, SESSION_STATS_DEBOUNCE_MS);
}

function flushSessionStatsSave() {
  if (sessionStatsSaveTimer) {
    clearTimeout(sessionStatsSaveTimer);
    sessionStatsSaveTimer = null;
  }
  if (!sessionStatsDirty) return;
  sessionStatsDirty = false;
  flushConfigToDisk();
}

function recordSessionStatsForActivity(activityId, startedAt) {
  if (!activityId || !startedAt) return;
  const duration = Date.now() - startedAt;
  if (duration < 1000) return;
  const stats = { ...(config.sessionStats || {}) };
  stats[activityId] = (stats[activityId] || 0) + duration;
  config = { ...config, sessionStats: stats };
  scheduleSessionStatsSave();
}

async function pausePresence() {
  if (!currentActivity) {
    return { success: false, error: 'No active presence to pause' };
  }
  pausedPresenceSnapshot = {
    activity: { ...currentActivity },
    sessionStart,
  };
  pendingUpdate = null;
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
  currentActivity = null;
  sessionStart = null;
  updateTrayIcon('default');
  updateTrayMenu();
  if (rpcClient) {
    try { await rpcClient.clearActivity(); } catch (_) {}
  }
  getMusicSync().stop();
  getGameSync().stop();
  broadcastStatus(true);
  return { success: true };
}

async function resumePresence() {
  if (!pausedPresenceSnapshot?.activity) {
    return { success: false, error: 'Nothing to resume' };
  }
  const { activity, sessionStart: prevStart } = pausedPresenceSnapshot;
  pausedPresenceSnapshot = null;
  sessionStart = activity.id === 'listening' ? null : (prevStart || Date.now());
  const result = await applyPresence(activity);
  if (result?.success && activity?.id === 'listening' && config.musicNowPlaying !== false) {
    getMusicSync().start({
      ...activity,
      id: 'listening',
      details: 'Listening to music',
    });
  }
  if (result?.success && activity?.category === 'gaming' && config.gamingNowPlaying !== false) {
    getGameSync().start({
      ...activity,
      category: 'gaming',
      details: 'Gaming',
    });
  }
  return result;
}

function isPresencePaused() {
  return !!pausedPresenceSnapshot;
}

// ─── Window State ────────────────────────────────────────────────────
const FIRST_SHOW_MARKER = '.first-window-shown';
const PORTABLE_INIT_MARKER = '.portable-initialized';
const CACHE_MAINTENANCE_MARKER = '.cache-maintenance';
const CACHE_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CHROMIUM_CACHE_MAX_BYTES = 150 * 1024 * 1024;
const CHROMIUM_CACHE_DIRS = [
  'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache',
  'DawnWebGPUCache', 'ShaderCache', 'blob_storage',
];

function normalizeWindowState(state = {}) {
  const width = Math.max(900, Math.min(state.width || 1100, 4000));
  const height = Math.max(650, Math.min(state.height || 780, 3000));
  let x = state.x;
  let y = state.y;

  const displays = screen.getAllDisplays();
  const workArea = screen.getPrimaryDisplay().workArea;

  const centered = () => ({
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    maximized: !!state.maximized,
  });

  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return centered();
  }

  const minVisible = 80;
  const intersects = displays.some((display) => {
    const area = display.workArea;
    const overlapW = Math.min(x + width, area.x + area.width) - Math.max(x, area.x);
    const overlapH = Math.min(y + height, area.y + area.height) - Math.max(y, area.y);
    return overlapW >= minVisible && overlapH >= minVisible;
  });

  return intersects ? { width, height, x, y, maximized: !!state.maximized } : centered();
}

function getWindowState() {
  const portableFirstRun = isPortableBuild() && !fs.existsSync(getUserDataPath(PORTABLE_INIT_MARKER));
  let state;

  if (portableFirstRun) {
    state = { ...DEFAULT_CONFIG.windowState };
    try {
      fs.writeFileSync(getUserDataPath(PORTABLE_INIT_MARKER), new Date().toISOString());
    } catch (_) {}
  } else {
    state = readWindowStateFile();
    state = state || config.windowState || { ...DEFAULT_CONFIG.windowState };
  }

  return normalizeWindowState(state);
}

function shouldStartInTrayOnly() {
  if (config.minimizeToTray === false) return false;
  try {
    const login = app.getLoginItemSettings();
    return login.wasOpenedAtLogin === true && config.launchAtLogin === true;
  } catch (_) {
    return false;
  }
}

function shouldForceShowOnStartup() {
  return !fs.existsSync(getUserDataPath(FIRST_SHOW_MARKER));
}

function markFirstWindowShown() {
  try {
    fs.writeFileSync(getUserDataPath(FIRST_SHOW_MARKER), new Date().toISOString());
  } catch (_) {}
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.show(); } catch (_) {}
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  sendWindowVisibility(true);
}

function hideMainWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.hide(); } catch (_) {}
  }
  sendWindowVisibility(false);
}

function sendToWindow(channel, ...args) {
  if (!mainWindow?.webContents || mainWindow.isDestroyed()) return false;
  mainWindow.webContents.send(channel, ...args);
  return true;
}

function sendWindowVisibility(visible) {
  mainWindowVisible = !!visible;
  syncMusicSyncVisibility();
  sendToWindow('window-visibility', !!visible);
}

function resetWindowPosition() {
  const state = normalizeWindowState({ ...DEFAULT_CONFIG.windowState });
  try {
    secureUnlink(getUserDataPath(WINDOW_STATE_SECURE));
    secureUnlink(getUserDataPath(WINDOW_STATE_LEGACY));
  } catch (_) {}
  saveConfig({ windowState: { width: state.width, height: state.height } });
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setBounds({ x: state.x, y: state.y, width: state.width, height: state.height });
    showMainWindow();
  }
  return { success: true };
}

function notifyTrayOnlyStartup() {
  if (!tray) return;
  const body = process.platform === 'darwin'
    ? 'Smiley is in the menu bar. Click the tray icon to open.'
    : 'Smiley is running in the system tray. Double-click the tray icon to open.';
  try {
    if (Notification.isSupported()) {
      new Notification({ title: 'Smiley', body }).show();
      return;
    }
  } catch (_) {}
  try {
    tray.displayBalloon?.({ title: 'Smiley', content: body });
  } catch (_) {}
}

function captureWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    const bounds = mainWindow.getNormalBounds();
    return {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: mainWindow.isMaximized(),
    };
  } catch (_) {
    return null;
  }
}

function flushWindowStateSave() {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = null;
  }
  const state = pendingWindowState || captureWindowState();
  if (!state) return;
  pendingWindowState = state;
  config = { ...config, windowState: state };
  try {
    writeWindowStateFile(state);
  } catch (_) {}
}

function scheduleWindowStateSave() {
  const state = captureWindowState();
  if (!state) return;
  pendingWindowState = state;
  config = { ...config, windowState: state };
  if (windowStateSaveTimer) return;
  windowStateSaveTimer = setTimeout(() => {
    windowStateSaveTimer = null;
    flushWindowStateSave();
  }, WINDOW_STATE_DEBOUNCE_MS);
}

function saveWindowState() {
  scheduleWindowStateSave();
}

function flushPendingDiskWrites() {
  flushWindowStateSave();
  flushSessionStatsSave();
}

// ─── Tray Icons ──────────────────────────────────────────────────────
const TRAY_COLORS = {
  food: '#f7768e', gaming: '#7aa2f7', chill: '#9ece6a',
  work: '#bb9af7', social: '#ff9e64', default: '#7aa2f7',
};

function getIconCandidates() {
  const buildDir = path.join(__dirname, 'build');
  const candidates = [];
  if (process.platform === 'win32') {
    const scale = screen.getPrimaryDisplay()?.scaleFactor || 1;
    const traySize = scale > 1 ? 32 : 16;
    candidates.push(path.join(buildDir, `icon-tray-${traySize}.png`));
    const themedTray = nativeTheme.shouldUseDarkColors ? 'icon-light.png' : 'icon-dark.png';
    candidates.push(path.join(buildDir, themedTray));
    candidates.push(path.join(buildDir, 'icon-transparent.png'));
    candidates.push(path.join(buildDir, 'icon.ico'));
  }
  candidates.push(path.join(buildDir, 'icon-transparent.png'));
  candidates.push(path.join(buildDir, 'icon.png'));
  if (isPackaged && process.resourcesPath) {
    const resBuild = path.join(process.resourcesPath, 'build');
    if (process.platform === 'win32') {
      const scale = screen.getPrimaryDisplay()?.scaleFactor || 1;
      const traySize = scale > 1 ? 32 : 16;
      candidates.push(path.join(resBuild, `icon-tray-${traySize}.png`));
      const themedTray = nativeTheme.shouldUseDarkColors ? 'icon-light.png' : 'icon-dark.png';
      candidates.push(path.join(resBuild, themedTray));
      candidates.push(path.join(resBuild, 'icon-transparent.png'));
      candidates.push(path.join(resBuild, 'icon.ico'));
    }
    candidates.push(path.join(resBuild, 'icon-transparent.png'));
    candidates.push(path.join(resBuild, 'icon.png'));
  }
  return candidates;
}

function getAppIconCandidates() {
  const buildDir = path.join(__dirname, 'build');
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(path.join(buildDir, 'icon.ico'));
  }
  candidates.push(path.join(buildDir, 'icon.png'));
  const themed = nativeTheme.shouldUseDarkColors ? 'icon-light.png' : 'icon-dark.png';
  candidates.push(path.join(buildDir, themed));
  candidates.push(path.join(buildDir, 'icon-transparent.png'));
  if (isPackaged && process.resourcesPath) {
    const resBuild = path.join(process.resourcesPath, 'build');
    if (process.platform === 'win32') {
      candidates.push(path.join(resBuild, 'icon.ico'));
    }
    candidates.push(path.join(resBuild, 'icon.png'));
    candidates.push(path.join(resBuild, themed));
    candidates.push(path.join(resBuild, 'icon-transparent.png'));
  }
  return candidates;
}

function hasVisiblePixels(img) {
  if (!img || img.isEmpty()) return false;
  const { width, height } = img.getSize();
  if (!width || !height) return false;
  const sample = width > 64 || height > 64 ? img.resize({ width: 64, height: 64 }) : img;
  const bitmap = sample.toBitmap();
  for (let i = 3; i < bitmap.length; i += 4) {
    if (bitmap[i] > 0) return true;
  }
  return false;
}

function loadNativeIcon(candidates = getIconCandidates()) {
  for (const iconPath of candidates) {
    if (!fs.existsSync(iconPath)) continue;
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty() && hasVisiblePixels(img)) return img;
  }
  return null;
}

function getThemedTrayIconPath() {
  const buildDir = path.join(__dirname, 'build');
  const name = nativeTheme.shouldUseDarkColors ? 'icon-light.png' : 'icon-dark.png';
  for (const candidate of [name, 'icon-transparent.png', 'icon.png']) {
    const iconPath = path.join(buildDir, candidate);
    if (!fs.existsSync(iconPath)) continue;
    const img = nativeImage.createFromPath(iconPath);
    if (hasVisiblePixels(img)) return iconPath;
  }
  return path.join(buildDir, 'icon.png');
}

function getTrayIconSize() {
  if (process.platform !== 'win32') return 16;
  const scale = screen.getPrimaryDisplay()?.scaleFactor || 1;
  return scale > 1 ? 32 : 16;
}

function createColoredTrayBitmap(color, size, opaqueBackground) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1;
  const bg = { r: 0x1a, g: 0x1b, b: 0x26 };
  const hex = (color || TRAY_COLORS.default).replace('#', '');
  const cr = parseInt(hex.slice(0, 2), 16);
  const cg = parseInt(hex.slice(2, 4), 16);
  const cb = parseInt(hex.slice(4, 6), 16);
  const faceR = radius * 0.7;
  const eyeR = Math.max(1, size * 0.08);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let r = bg.r;
      let g = bg.g;
      let b = bg.b;
      let a = opaqueBackground ? 255 : 0;

      if (dist <= radius) {
        a = 255;
        if (dist <= faceR) {
          r = cr;
          g = cg;
          b = cb;
          const leftEye = Math.hypot(x - (cx - faceR * 0.3), y - (cy - faceR * 0.2)) <= eyeR;
          const rightEye = Math.hypot(x - (cx + faceR * 0.3), y - (cy - faceR * 0.2)) <= eyeR;
          const mouth = Math.abs(y - (cy + faceR * 0.35)) < Math.max(1, size * 0.06)
            && Math.abs(x - cx) < faceR * 0.35;
          if (leftEye || rightEye || mouth) {
            r = bg.r;
            g = bg.g;
            b = bg.b;
          }
        }
      }
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function generateTrayIcon(color) {
  const size = getTrayIconSize();
  if (process.platform === 'win32') {
    return getTrayIconFromApp();
  }
  return createColoredTrayBitmap(color, size, false);
}

function getTrayIconFromApp() {
  const size = getTrayIconSize();
  let iconPath = null;
  if (process.platform === 'win32') {
    iconPath = getThemedTrayIconPath();
    if (isPackaged && process.resourcesPath) {
      const resThemed = path.join(
        process.resourcesPath,
        'build',
        nativeTheme.shouldUseDarkColors ? 'icon-light.png' : 'icon-dark.png',
      );
      if (fs.existsSync(resThemed)) iconPath = resThemed;
    }
  }
  const img = iconPath && fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : loadNativeIcon();
  if (img && !img.isEmpty()) {
    const { width, height } = img.getSize();
    if (width === size && height === size) return img;
    const resized = img.resize({ width: size, height: size });
    if (!resized.isEmpty()) return resized;
  }
  return createColoredTrayBitmap(TRAY_COLORS.default, size, process.platform === 'win32');
}

function getDefaultTrayIcon() {
  return getTrayIconFromApp();
}

function getAppIcon() {
  const img = loadNativeIcon(getAppIconCandidates());
  if (img) {
    if (process.platform === 'win32') {
      const { width, height } = img.getSize();
      if (width > 256 || height > 256) return img.resize({ width: 256, height: 256 });
    }
    return img;
  }
  return getDefaultTrayIcon();
}

// ─── Window ──────────────────────────────────────────────────────────
function createWindow() {
  const state = getWindowState();
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  mainWindow = new BrowserWindow({
    width: state.width || 1100,
    height: state.height || 780,
    minWidth: 900,
    minHeight: 650,
    x: state.x,
    y: state.y,
    frame: isMac,
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 16 } } : {}),
    ...(isWin ? { thickFrame: false } : {}),
    autoHideMenuBar: true,
    backgroundColor: '#1a1b26',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: process.platform !== 'darwin',
      allowRunningInsecureContent: false,
      webSecurity: true,
      experimentalFeatures: false,
      backgroundThrottling: true,
      devTools: isDev || !isPackaged,
    },
    title: APP_DISPLAY_NAME,
    icon: getAppIcon(),
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setTitle(APP_DISPLAY_NAME);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.once('did-finish-load', () => {
    pushNowPlayingToRenderer();
  });

  mainWindow.once('ready-to-show', () => {
    if (state.maximized) mainWindow.maximize();
    if (shouldForceShowOnStartup() || !shouldStartInTrayOnly()) {
      showMainWindow();
      markFirstWindowShown();
    } else {
      hideMainWindowToTray();
      notifyTrayOnlyStartup();
    }
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
    if (isPackaged && !isDev) {
      mainWindow.webContents.on('devtools-opened', () => {
        try { mainWindow.webContents.closeDevTools(); } catch (_) {}
      });
      mainWindow.webContents.on('before-input-event', (event, input) => {
        const key = String(input.key || '').toLowerCase();
        if (key === 'f12' || (input.control && input.shift && key === 'i') || (input.meta && input.alt && key === 'i')) {
          event.preventDefault();
        }
      });
    }
  });

  let closingToTray = false;
  mainWindow.on('close', (e) => {
    if (shouldCloseToTray() && !isAppQuitting()) {
      e.preventDefault();
      if (closingToTray) return;
      closingToTray = true;
      (async () => {
        try {
          await flushRendererPendingConfig();
          flushPendingDiskWrites();
          flushConfigToDisk();
          if (mainWindow && !mainWindow.isDestroyed()) hideMainWindowToTray();
        } finally {
          closingToTray = false;
        }
      })();
      return;
    }
    flushPendingDiskWrites();
    flushConfigToDisk();
  });

  mainWindow.on('resize', () => scheduleWindowStateSave());
  mainWindow.on('move', () => scheduleWindowStateSave());
  mainWindow.on('minimize', () => sendWindowVisibility(false));
  mainWindow.on('restore', () => sendWindowVisibility(true));
  mainWindow.on('hide', () => sendWindowVisibility(false));
  mainWindow.on('show', () => sendWindowVisibility(true));
  if (isWin) {
    const sendMaximized = () => {
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window-maximized', mainWindow.isMaximized());
      }
    };
    mainWindow.on('maximize', sendMaximized);
    mainWindow.on('unmaximize', sendMaximized);
  }
}

// ─── Tray ────────────────────────────────────────────────────────────
function createTray() {
  const icon = getTrayIconFromApp();
  tray = new Tray(icon);
  tray.setToolTip(APP_DISPLAY_NAME);
  updateTrayMenu();
  tray.on('double-click', () => showMainWindow());
}

function updateTrayMenu() {
  if (!tray) return;
  const sessionLabel = sessionStart
    ? `Session: ${formatSessionDuration(Date.now() - sessionStart)}`
    : 'No active session';

  const recentItems = (config.recentActivities || []).map((item) => ({
    label: `${item.details}${item.state ? ` — ${item.state}` : ''}`,
    click: () => {
      showMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('select-activity', item.id);
      }
    },
  }));

  const favoriteItems = (config.favoriteActivities || []).slice(0, 9).map((id, idx) => {
    const recent = (config.recentActivities || []).find((r) => r.id === id);
    const label = recent
      ? `${recent.details}${recent.state ? ` — ${recent.state}` : ''}`
      : `Favorite ${idx + 1}`;
    return {
      label,
      click: () => {
        showMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('select-activity', id);
        }
      },
    };
  });

  const profileItems = (config.activityProfiles || []).map((profile) => ({
    label: profile.name,
    click: () => {
      showMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('apply-profile', profile.id);
      }
    },
  }));

  const template = [
    { label: 'Show Smiley', click: () => showMainWindow() },
    { type: 'separator' },
    { label: currentActivity ? `Status: ${currentActivity.details}` : (pausedPresenceSnapshot ? 'Paused' : 'No status set'), enabled: false },
    ...(currentActivity?.musicTrack?.title
      ? [{ label: `♪ ${currentActivity.musicTrack.title}${currentActivity.musicTrack.artist ? ` — ${currentActivity.musicTrack.artist}` : ''}`, enabled: false }]
      : []),
    ...(currentActivity?.musicTrack?.device
      ? [{ label: `via ${currentActivity.musicTrack.device}`, enabled: false }]
      : []),
    { label: sessionLabel, enabled: false },
    { label: 'Clear Presence', click: () => clearPresence(), enabled: !!currentActivity },
    ...(pausedPresenceSnapshot
      ? [{ label: 'Resume Presence', click: () => {
        resumePresence().then((result) => {
          if (result?.success && mainWindow && !mainWindow.isDestroyed() && currentActivity?.id) {
            mainWindow.webContents.send('select-activity', currentActivity.id);
          }
          broadcastStatus(true);
        });
      } }]
      : [{ label: 'Pause Presence', click: () => {
        pausePresence().then((result) => {
          if (result?.success && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('presence-paused');
          }
        });
      }, enabled: !!currentActivity }]),
    { type: 'separator' },
    ...(favoriteItems.length
      ? [{ label: 'Favorites', submenu: favoriteItems }, { type: 'separator' }]
      : []),
    ...(profileItems.length
      ? [{ label: 'Profiles', submenu: profileItems }, { type: 'separator' }]
      : []),
    ...(recentItems.length
      ? [{ label: 'Recent Activities', submenu: recentItems }, { type: 'separator' }]
      : []),
    { label: 'Check for Updates', click: () => checkForUpdates(true) },
    { label: 'Settings', click: () => { showMainWindow(); if (mainWindow) mainWindow.webContents.send('open-settings'); } },
    { type: 'separator' },
    { label: 'Donate', click: () => shell.openExternal(DONATION_URL) },
    { type: 'separator' },
    { label: `Version ${APP_VERSION}`, enabled: false },
    { label: 'Quit', click: () => { markAppQuitting(); app.quit(); } },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function updateTrayIcon(category) {
  if (!tray) return;
  const type = category || 'default';
  if (currentTrayIcon === type) return;
  currentTrayIcon = type;
  try {
    if (process.platform === 'win32') {
      tray.setImage(getTrayIconFromApp());
    } else {
      tray.setImage(generateTrayIcon(TRAY_COLORS[type] || TRAY_COLORS.default));
    }
  } catch (_) {}
}

// ─── Discord RPC ─────────────────────────────────────────────────────
// Smiley never reads or stores Discord login tokens, usernames, email, or messages.
// RPC uses local IPC with the public Application Client ID only (not a user/bot token).
async function connectRPC() {
  const clientId = getClientId();
  if (!clientId) {
    return { connected: false, error: 'App not configured — set Client ID in discord.app.json before building' };
  }
  if (rpcClient) {
    try { await rpcClient.destroy(); } catch (_) {}
    rpcClient = null;
  }
  const RPC = getRPC();
  RPC.register(clientId);
  const client = new RPC.Client({ transport: 'ipc' });
  rpcClient = client;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (rpcClient === client) rpcClient = null;
      try { client.destroy(); } catch (_) {}
      resolve({ connected: false, error: 'Discord not responding — is it open?' });
    }, 8000);
    rpcClient.once('ready', () => {
      clearTimeout(timeout);
      // Intentionally ignore any user/account fields from the RPC client.
      resolve({ connected: true });
    });
    rpcClient.login({ clientId }).catch((err) => {
      clearTimeout(timeout);
      if (rpcClient === client) rpcClient = null;
      try { client.destroy(); } catch (_) {}
      resolve({ connected: false, error: err.message || 'Could not connect to Discord' });
    });
  });
}

async function buildActivityPayload(activity) {
  // Discord always shows the registered application name (e.g. "Smiley") above
  // details/state — Rich Presence cannot hide or override it via RPC.
  const payload = {
    details: activity.details,
    state: activity.state || undefined,
    instance: false,
  };

  // Discord shows a green elapsed timer when timestamps are present — never for music/listening.
  const isListening = activity.id === 'listening' || activity.musicTrack;
  if (!isListening) {
    payload.startTimestamp = sessionStart || Date.now();
  }

  // Discord shows the app/bot logo when the image key is missing or invalid.
  // Always use a direct HTTPS GIF URL resolved for this activity.
  let imageUrl =
    activity.discordImageUrl ||
    activity.largeImageUrl ||
    (activity.largeImageKey && /^https?:\/\//i.test(activity.largeImageKey) ? activity.largeImageKey : null) ||
    activity.fallbackGif;

  // Last-resort: remap hosts Discord's proxy cannot fetch (nekos/waifu → Tenor)
  if (imageUrl && /nekos\.best|waifu\.pics/i.test(imageUrl)) {
    try {
      const { resolveDiscordRpcImageUrl } = await import('./src/discord-images.js');
      imageUrl = resolveDiscordRpcImageUrl(activity, imageUrl);
      if (isDev) console.warn('[RPC] remapped untrusted host to:', imageUrl);
    } catch (err) {
      if (isDev) console.warn('[RPC] untrusted image host, remap failed:', err.message);
      imageUrl = null;
    }
  }

  if (imageUrl) {
    payload.largeImageKey = imageUrl;
    payload.largeImageText = activity.largeImageText || activity.details;
    if (isDev) console.log('[RPC] large_image:', activity.id || activity.details, imageUrl);
  } else if (isDev) {
    console.warn('[RPC] no image URL for activity', activity.id || activity.details);
  }

  // No small_image — invalid asset keys show the bot logo as an overlay
  payload.buttons = activity.buttons?.length
    ? activity.buttons.slice(0, 2)
    : DEFAULT_RPC_BUTTONS;
  return payload;
}

async function applyPresence(activity) {
  if (!rpcClient) {
    const result = await connectRPC();
    if (!result.connected) return result;
  }
  try {
    const sameActivity = currentActivity?.id && currentActivity.id === activity.id;
    if (currentActivity?.id && sessionStart && !sameActivity) {
      recordSessionStatsForActivity(currentActivity.id, sessionStart);
    }
    pausedPresenceSnapshot = null;
    const payload = await buildActivityPayload(activity);
    await rpcClient.setActivity(payload);
    currentActivity = activity;
    if (activity.id === 'listening') sessionStart = null;
    trackRecentActivity(activity);
    updateTrayIcon(activity.category);
    updateTrayMenu();
    broadcastStatus();
    return { success: true };
  } catch (err) {
    rpcClient = null;
    return { success: false, error: err.message || 'Failed to set presence' };
  }
}

/** Lightweight path for now-playing metadata — avoids disk writes & tray rebuild spam. */
let lastMusicPresenceSig = '';
let lastMusicPresenceAt = 0;
const MUSIC_PRESENCE_DEDUP_MS = 2000;

async function applyMusicPresence(activity) {
  if (!rpcClient) {
    const result = await connectRPC();
    if (!result.connected) return result;
  }
  try {
    const track = activity?.musicTrack;
    const sig = track?.title
      ? [track.title, track.artist, track.album, track.isPlaying ? '1' : '0', activity.discordImageUrl || activity.largeImageUrl || ''].join('\0')
      : `${activity.details}\0${activity.state}`;
    const now = Date.now();
    if (sig === lastMusicPresenceSig && now - lastMusicPresenceAt < MUSIC_PRESENCE_DEDUP_MS) {
      return { success: true, skipped: true };
    }
    lastMusicPresenceSig = sig;
    lastMusicPresenceAt = now;
    pausedPresenceSnapshot = null;
    const payload = await buildActivityPayload(activity);
    await rpcClient.setActivity(payload);
    currentActivity = activity;
    if (activity.id === 'listening') sessionStart = null;
    scheduleTrayMenuRefresh();
    return { success: true };
  } catch (err) {
    rpcClient = null;
    return { success: false, error: err.message || 'Failed to set presence' };
  }
}

/** Lightweight path for live gaming metadata — avoids disk writes & tray rebuild spam. */
let lastGamePresenceSig = '';
let lastGamePresenceAt = 0;
const GAME_PRESENCE_DEDUP_MS = 2000;

async function applyGamePresence(activity) {
  if (!rpcClient) {
    const result = await connectRPC();
    if (!result.connected) return result;
  }
  try {
    const session = activity?.gameSession;
    const sig = session?.title
      ? [
        session.title, session.liveLine, session.map, session.mode, session.agent,
        session.kda, session.champ, session.inMatch ? '1' : '0',
        activity.discordImageUrl || activity.largeImageUrl || '',
      ].join('\0')
      : `${activity.details}\0${activity.state}`;
    const now = Date.now();
    if (sig === lastGamePresenceSig && now - lastGamePresenceAt < GAME_PRESENCE_DEDUP_MS) {
      return { success: true, skipped: true };
    }
    lastGamePresenceSig = sig;
    lastGamePresenceAt = now;
    pausedPresenceSnapshot = null;
    const payload = await buildActivityPayload(activity);
    await rpcClient.setActivity(payload);
    currentActivity = activity;
    scheduleTrayMenuRefresh();
    return { success: true };
  } catch (err) {
    rpcClient = null;
    return { success: false, error: err.message || 'Failed to set presence' };
  }
}

async function schedulePresenceUpdate(activity, isNewSession) {
  const safeActivity = sanitizeIncomingActivity(activity);
  if (!safeActivity) return { success: false, error: 'Invalid activity' };

  handleMusicSyncForActivity(safeActivity);
  handleGameSyncForActivity(safeActivity);

  const isListeningLive = safeActivity.id === 'listening' && config.musicNowPlaying !== false;
  const isGamingLive = safeActivity.category === 'gaming' && config.gamingNowPlaying !== false;
  if (isListeningLive || isGamingLive) {
    if (isNewSession) sessionStart = isListeningLive ? null : Date.now();
    pendingUpdate = null;
    if (updateTimer) {
      clearTimeout(updateTimer);
      updateTimer = null;
    }
    return { success: true };
  }

  if (isNewSession) sessionStart = safeActivity.id === 'listening' ? null : Date.now();
  pendingUpdate = safeActivity;
  if (updateTimer) {
    return { success: true, queued: true };
  }

  const run = async () => {
    const toApply = pendingUpdate;
    pendingUpdate = null;
    updateTimer = null;
    if (toApply) return applyPresence(toApply);
    return { success: true };
  };

  const result = await run();
  updateTimer = setTimeout(async () => {
    updateTimer = null;
    if (pendingUpdate) await run();
  }, PRESENCE_UPDATE_COOLDOWN_MS);

  return result || { success: true };
}

function handleMusicSyncForActivity(safeActivity) {
  if (safeActivity.id === 'listening' && config.musicNowPlaying !== false) {
    getMusicSync().start({
      ...safeActivity,
      id: 'listening',
      details: 'Listening to music',
    });
  } else if (safeActivity.id !== 'listening') {
    getMusicSync().stop();
  }
}

function handleGameSyncForActivity(safeActivity) {
  if (safeActivity.category === 'gaming' && config.gamingNowPlaying !== false) {
    getGameSync().start({
      ...safeActivity,
      category: 'gaming',
      details: 'Gaming',
    });
  } else {
    getGameSync().stop();
  }
}

function pushNowPlayingToRenderer() {
  const track = getMusicSync().getCurrentTrack?.();
  if (!track?.title) return;
  const safe = sanitizeNowPlayingTrack(track);
  if (!safe) return;
  sendToWindow('now-playing-update', safe);
}

async function clearPresence() {
  pendingUpdate = null;
  if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }
  if (currentActivity?.id && sessionStart) {
    recordSessionStatsForActivity(currentActivity.id, sessionStart);
  }
  pausedPresenceSnapshot = null;
  currentActivity = null;
  sessionStart = null;
  getMusicSync().stop();
  getGameSync().stop();
  updateTrayIcon('default');
  updateTrayMenu();
  if (rpcClient) {
    try { await rpcClient.clearActivity(); } catch (_) {}
  }
  broadcastStatus();
  return { success: true };
}

let broadcastTimer = null;

function broadcastStatus(immediate = false) {
  if (!mainWindow?.webContents || mainWindow.isDestroyed()) return;

  const send = () => {
    sendToWindow('rpc-status', {
      connected: !!rpcClient,
      activity: sanitizeActivitySnapshot(currentActivity),
      sessionStart: currentActivity?.id === 'listening' ? null : sessionStart,
      donationUrl: DONATION_URL,
      settings: {
        theme: config.theme || 'dark',
        uiVersion: config.uiVersion === 'v1' ? 'v1' : config.uiVersion === 'v2' ? 'v2' : 'v3',
        showTimer: config.showTimer !== false,
        animationsEnabled: config.animationsEnabled !== false,
        customAnimation: config.customAnimation || null,
        minimizeToTray: config.minimizeToTray !== false,
        autoConnect: config.autoConnect !== false,
        musicNowPlaying: config.musicNowPlaying !== false,
        musicNowPlayingAlbumArt: config.musicNowPlayingAlbumArt !== false,
        gamingNowPlaying: config.gamingNowPlaying !== false,
        gamingNowPlayingCoverArt: config.gamingNowPlayingCoverArt !== false,
        donationUrl: DONATION_URL,
      },
      version: APP_VERSION,
    });
  };

  if (immediate) {
    if (broadcastTimer) {
      clearTimeout(broadcastTimer);
      broadcastTimer = null;
    }
    send();
    return;
  }

  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    send();
  }, STATUS_BROADCAST_DEBOUNCE_MS);
}

// ─── Install registry (mandatory for packaged builds) ───────────────
function canRegisterInstall() {
  return isInstallTrackingEnabled() && config.installConsentShown === true;
}

async function maybeRegisterInstall() {
  if (!canRegisterInstall()) return;
  try {
    const result = await registerInstall({
      rootDir: __dirname,
      userDataDir: app.getPath('userData'),
      appVersion: APP_VERSION,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      electronVersion: process.versions.electron,
      locale: app.getLocale(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      channel: isPortableBuild() ? 'portable' : 'release',
    });
    if (result.success) console.log('[registry] install heartbeat recorded');
    else if (result.error) console.warn('[registry]', result.error);
  } catch (err) {
    console.warn('[registry]', err.message);
  }
}

// ─── Auto Updater ────────────────────────────────────────────────────
let pendingUpdateVersion = null;
let updateDownloaded = false;
let lastDownloadPercent = 0;
let downloadStallTimer = null;
let updaterListenersAttached = false;
let silentUpdateCheck = false;
let isCheckingUpdate = false;
let macDmgDownloadInProgress = false;
let macDmgDownloadedPath = null;
let macZipDownloadInProgress = false;

function finishUpdateCheck() {
  isCheckingUpdate = false;
}

function applyUpdaterSettings() {
  if (!isPackaged) return;
  try {
    const autoUpdater = getAutoUpdater();
    // macOS: download zip to cache; custom installer replaces ShipIt (ad-hoc safe)
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.autoRunAppAfterInstall = false;
    if (process.platform !== 'darwin') {
      autoUpdater.autoInstallOnAppQuit = config.autoInstallUpdates !== false;
    }
  } catch (_) {}
}

function guardMacUpdaterQuitAndInstall() {
  if (process.platform !== 'darwin') return;
  const autoUpdater = getAutoUpdater();
  if (autoUpdater.__macQuitAndInstallGuarded) return;
  autoUpdater.__macQuitAndInstallGuarded = true;
  autoUpdater.quitAndInstall = () => {
    console.warn('[updater] quitAndInstall blocked on macOS — using custom in-app installer');
    installMacUpdate();
  };
}

function clearDownloadStallTimer() {
  if (downloadStallTimer) {
    clearTimeout(downloadStallTimer);
    downloadStallTimer = null;
  }
}

function resetDownloadStallTimer() {
  clearDownloadStallTimer();
  downloadStallTimer = setTimeout(() => {
    if (!updateDownloaded && lastDownloadPercent < 100) {
      sendUpdateStatus({
        status: 'download-stalled',
        percent: lastDownloadPercent,
        error: lastDownloadPercent === 0
          ? 'Update download did not start. Check your connection and try again.'
          : 'Update download stalled. Try again later.',
      });
    }
  }, 60000);
}

function downloadProgressPercent(progress) {
  const transferred = progress?.transferred ?? progress?.transferredBytes ?? 0;
  const total = progress?.total ?? progress?.totalBytes ?? 0;
  if (total > 0) return Math.min(99, Math.round((transferred / total) * 100));
  return Math.min(95, Math.round(transferred / (1024 * 1024)));
}

function isValidMacUpdateZipFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    return fs.statSync(filePath).size > 1024 * 1024;
  } catch {
    return false;
  }
}

function formatUpdateDownloadError(err) {
  return String(err?.message || err || 'Could not download update. Check your connection and try again.');
}

async function ensureMacUpdateDownloaded(version) {
  if (macZipDownloadInProgress) {
    return { success: false, status: 'busy', error: 'Download already in progress' };
  }
  if (isCachedMacUpdateInstallable()) {
    updateDownloaded = true;
    lastDownloadPercent = 100;
    const payload = buildMacUpdateReadyPayload(version);
    if (payload) sendUpdateStatus(payload);
    return { success: true, ...(payload || {}) };
  }
  macZipDownloadInProgress = true;
  resetDownloadStallTimer();
  try {
    return await downloadMacUpdateZip(version);
  } finally {
    macZipDownloadInProgress = false;
  }
}

function isMacInAppUpdater() {
  return MAC_IN_APP_UPDATES;
}

function isMacAdHocUpdater() {
  return isMacInAppUpdater();
}

function buildMacUpdateAvailablePayload(version = pendingUpdateVersion) {
  const ver = normalizeReleaseVersion(version) || null;
  return {
    ok: true,
    status: 'update-available-mac',
    message: ver ? `Update v${ver} available` : 'Update available',
    version: ver,
    arch: getMacDmgArch(),
    dmgUrl: ver ? buildMacDmgDownloadUrl(ver) : null,
    releasesUrl: GITHUB_RELEASES_URL,
    expected: true,
  };
}

function buildManualInstallPayload(version = pendingUpdateVersion) {
  return buildMacUpdateAvailablePayload(version);
}

function buildMacDmgReadyPayload(version = pendingUpdateVersion, dmgPath = macDmgDownloadedPath) {
  const ver = normalizeReleaseVersion(version) || null;
  return {
    ok: true,
    status: 'dmg-ready',
    message: 'Download complete — open the installer to update.',
    version: ver,
    path: dmgPath || (ver ? getMacDmgPathForVersion(ver) : null),
    instructions: [
      'Quit Smiley',
      'Drag Smiley to Applications (replace the existing app)',
      'Reopen Smiley from Applications',
    ],
    expected: true,
  };
}

function httpDownloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl, redirects = 0) => {
      if (redirects > 10) {
        reject(new Error('Too many redirects'));
        return;
      }
      if (!isAllowedGithubDownloadUrl(currentUrl)) {
        reject(new Error('Download host not allowed'));
        return;
      }
      const parsed = new URL(currentUrl);
      const lib = parsed.protocol === 'http:' ? require('http') : require('https');
      const req = lib.get(
        currentUrl,
        { headers: { 'User-Agent': `Smiley/${APP_VERSION}`, Accept: '*/*' } },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const next = res.headers.location.startsWith('http')
              ? res.headers.location
              : new URL(res.headers.location, currentUrl).href;
            res.resume();
            follow(next, redirects + 1);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`Download failed (${res.statusCode})`));
            return;
          }
          const total = parseInt(res.headers['content-length'], 10) || 0;
          let received = 0;
          const tmpPath = `${destPath}.part`;
          const file = fs.createWriteStream(tmpPath);
          res.on('data', (chunk) => {
            received += chunk.length;
            if (onProgress) {
              const percent = total > 0
                ? Math.min(99, Math.round((received / total) * 100))
                : Math.min(95, Math.round(received / (1024 * 1024)));
              onProgress(percent, received, total);
            }
          });
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              try {
                if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                fs.renameSync(tmpPath, destPath);
                if (onProgress) onProgress(100, received, total);
                resolve(destPath);
              } catch (err) {
                reject(err);
              }
            });
          });
          file.on('error', (err) => {
            try { fs.unlinkSync(tmpPath); } catch (_) {}
            reject(err);
          });
        },
      );
      req.on('error', reject);
      req.setTimeout(300000, () => {
        req.destroy();
        reject(new Error('Download timed out'));
      });
    };
    follow(url);
  });
}

function isValidDownloadedDmg(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    return fs.statSync(filePath).size > 1024 * 1024;
  } catch {
    return false;
  }
}

async function downloadMacUpdateZip(version) {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Mac-only feature' };
  }
  const ver = normalizeReleaseVersion(version || pendingUpdateVersion);
  if (!ver) return { success: false, error: 'No update version available' };

  const existingZip = getMacDownloadedZipPath();
  if (existingZip) {
    const zipVer = resolveUpdateVersion(ver);
    if (zipVer && compareReleaseVersions(zipVer, APP_VERSION) > 0) {
      pendingUpdateVersion = zipVer;
      updateDownloaded = true;
      lastDownloadPercent = 100;
      const payload = buildMacUpdateReadyPayload(zipVer);
      sendUpdateStatus(payload);
      return { success: true, ...payload };
    }
  }

  const destPath = getMacZipPathForVersion(ver);
  if (destPath && fs.existsSync(destPath) && fs.statSync(destPath).size > 1024 * 1024) {
    updateDownloaded = true;
    lastDownloadPercent = 100;
    const payload = buildMacUpdateReadyPayload(ver);
    sendUpdateStatus(payload);
    return { success: true, ...payload };
  }

  const url = buildMacZipDownloadUrl(ver);
  sendUpdateStatus({
    status: 'downloading',
    version: ver,
    percent: 0,
    macInApp: true,
  });
  resetDownloadStallTimer();

  try {
    await httpDownloadFile(url, destPath, (percent) => {
      lastDownloadPercent = percent;
      resetDownloadStallTimer();
      sendUpdateStatus({
        status: 'downloading',
        version: ver,
        percent,
        macInApp: true,
      });
    });
    updateDownloaded = true;
    lastDownloadPercent = 100;
    const payload = buildMacUpdateReadyPayload(ver);
    sendUpdateStatus(payload);
    return { success: true, ...payload };
  } catch (err) {
    appendUpdaterLog(`Zip download failed: ${err.message}`);
    return {
      success: false,
      error: 'Could not download update. Check your connection and try again.',
    };
  }
}

async function downloadMacUpdateDmg(version) {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Mac-only feature' };
  }
  const ver = normalizeReleaseVersion(version || pendingUpdateVersion);
  if (!ver) return { success: false, error: 'No update version available' };
  if (macDmgDownloadInProgress) {
    return { success: false, status: 'busy', error: 'Download already in progress' };
  }

  const destPath = getMacDmgPathForVersion(ver);
  if (isValidDownloadedDmg(destPath)) {
    macDmgDownloadedPath = destPath;
    const payload = buildMacDmgReadyPayload(ver, destPath);
    sendUpdateStatus(payload);
    return { success: true, ...payload };
  }

  const url = buildMacDmgDownloadUrl(ver);
  macDmgDownloadInProgress = true;
  sendUpdateStatus({ status: 'dmg-downloading', version: ver, percent: 0 });

  try {
    await httpDownloadFile(url, destPath, (percent) => {
      sendUpdateStatus({ status: 'dmg-downloading', version: ver, percent });
    });
    macDmgDownloadInProgress = false;
    macDmgDownloadedPath = destPath;
    const payload = buildMacDmgReadyPayload(ver, destPath);
    sendUpdateStatus(payload);
    return { success: true, ...payload };
  } catch (err) {
    macDmgDownloadInProgress = false;
    console.error('[updater] DMG download failed:', err.message);
    const payload = {
      ok: false,
      status: 'dmg-error',
      version: ver,
      error: 'Could not download update. Check your connection or try again later.',
      releasesUrl: GITHUB_RELEASES_URL,
      expected: true,
    };
    sendUpdateStatus(payload);
    return payload;
  }
}

function openMacDownloadedDmg(version = pendingUpdateVersion) {
  const ver = normalizeReleaseVersion(version);
  const destPath = macDmgDownloadedPath || (ver ? getMacDmgPathForVersion(ver) : null);
  if (!isValidDownloadedDmg(destPath)) {
    return { success: false, error: 'Installer not found — download the update first.' };
  }
  macDmgDownloadedPath = destPath;
  shell.openPath(destPath);
  return {
    success: true,
    path: destPath,
    message: 'Quit Smiley, drag to Applications (replace), then reopen.',
    instructions: buildMacDmgReadyPayload(ver, destPath).instructions,
  };
}

function getUpdaterLogPath() {
  const dir = getUserDataPath('logs');
  ensureDir(dir);
  return path.join(dir, 'mac-update.log');
}

function appendUpdaterLog(message) {
  try {
    fs.appendFileSync(getUpdaterLogPath(), `[${new Date().toISOString()}] ${message}\n`);
  } catch (_) {}
}

function getMacAppBundlePath() {
  if (process.platform !== 'darwin') return null;
  try {
    let p = path.resolve(process.execPath);
    for (let i = 0; i < 8; i++) {
      if (p.endsWith('.app')) return p;
      const parent = path.dirname(p);
      if (parent === p) break;
      p = parent;
    }
  } catch (_) {}
  return null;
}

/** Prefer /Applications/Smiley.app so updates land where Launch Services expects. */
function getMacInstallTargetPath() {
  if (process.platform !== 'darwin') return null;
  const canonical = path.join('/Applications', `${APP_DISPLAY_NAME}.app`);
  const running = getMacAppBundlePath();
  if (running?.startsWith('/Applications' + path.sep)) return running;
  try {
    if (fs.existsSync(canonical)) return canonical;
  } catch (_) {}
  return running;
}

function findZipInDirectory(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  const infoPath = path.join(dir, 'update-info.json');
  if (fs.existsSync(infoPath)) {
    try {
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      if (info?.fileName) {
        const zipPath = path.join(dir, info.fileName);
        if (fs.existsSync(zipPath)) return zipPath;
      }
    } catch (_) {}
  }
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const zips = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.zip'));
    if (zips.length === 1) return path.join(dir, zips[0].name);
    if (zips.length > 1) {
      const sorted = zips
        .map((entry) => path.join(dir, entry.name))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      return sorted[0];
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const nested = findZipInDirectory(path.join(dir, entry.name));
      if (nested) return nested;
    }
  } catch (_) {}
  return null;
}

function getMacDownloadedZipPath() {
  try {
    const autoUpdater = getAutoUpdater();
    const helper = autoUpdater.downloadedUpdateHelper;
    if (helper?.file && isValidMacUpdateZipFile(helper.file)) return helper.file;
    if (helper?.packageFile && isValidMacUpdateZipFile(helper.packageFile)) return helper.packageFile;

    const pendingDirs = new Set();
    if (helper?.cacheDirForPendingUpdate) pendingDirs.add(helper.cacheDirForPendingUpdate);
    for (const cacheRoot of getUpdaterCacheCandidates()) {
      pendingDirs.add(path.join(cacheRoot, 'pending'));
      pendingDirs.add(cacheRoot);
    }

    for (const dir of pendingDirs) {
      const zipPath = findZipInDirectory(dir);
      if (zipPath && isValidMacUpdateZipFile(zipPath)) return zipPath;
    }
  } catch (err) {
    appendUpdaterLog(`getMacDownloadedZipPath failed: ${err.message}`);
  }
  return null;
}

function waitForMacDownloadedZip(timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const zipPath = getMacDownloadedZipPath();
      if (zipPath && isValidMacUpdateZipFile(zipPath)) {
        resolve(zipPath);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

function shellQuoteForBash(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function getMacUpdaterCacheCleanupPaths() {
  return [...new Set([
    ...getUpdaterCacheCandidates(),
    getShipItCacheDir(),
    getMacUpdateDownloadDir(),
  ])];
}

function clearMacUpdaterArtifacts() {
  updateDownloaded = false;
  pendingUpdateVersion = null;
  lastDownloadPercent = 0;
  macDmgDownloadedPath = null;
  for (const dir of getMacUpdaterCacheCleanupPaths()) {
    removePathSync(dir);
  }
}

function pruneStaleMacUpdateCache() {
  if (!isMacInAppUpdater()) return false;
  const zipPath = getMacDownloadedZipPath();
  if (!zipPath) return false;
  const ver = resolveUpdateVersion();
  if (!ver || compareReleaseVersions(ver, APP_VERSION) <= 0) {
    appendUpdaterLog(`Pruning stale updater cache (cached=${ver || 'unknown'}, app=${APP_VERSION})`);
    clearMacUpdaterArtifacts();
    return true;
  }
  return false;
}

function writeMacUpdateInstallerScript({ zipPath, installPath, logPath, parentPid, cacheDirs = [] }) {
  const scriptPath = path.join(app.getPath('temp'), 'smiley-mac-update-installer.sh');
  const cacheDirLines = (cacheDirs || [])
    .filter(Boolean)
    .map((dir) => `CACHE_DIRS+=(${shellQuoteForBash(dir)})`)
    .join('\n');
  const script = `#!/bin/bash
set -euo pipefail
LOG=${shellQuoteForBash(logPath)}
ZIP=${shellQuoteForBash(zipPath)}
INSTALL=${shellQuoteForBash(installPath)}
PARENT_PID=${Number(parentPid) || 0}
CACHE_DIRS=()
${cacheDirLines}

log() { echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $*" >> "$LOG"; }

log "Mac update installer started (pid=$$, parent=$PARENT_PID)"
log "zip=$ZIP install=$INSTALL"

if [ "$PARENT_PID" -gt 0 ]; then
  for _ in $(seq 1 120); do
    if ! kill -0 "$PARENT_PID" 2>/dev/null; then
      break
    fi
    sleep 0.25
  done
  sleep 1
fi

EXTRACT_DIR=$(mktemp -d "\${TMPDIR:-/tmp}/smiley-update-XXXXXX")
trap 'rm -rf "$EXTRACT_DIR"' EXIT

log "Extracting to $EXTRACT_DIR"
if ! ditto -xk "$ZIP" "$EXTRACT_DIR" 2>>"$LOG"; then
  log "ditto failed, trying unzip"
  unzip -q -o "$ZIP" -d "$EXTRACT_DIR" 2>>"$LOG" || { log "extract failed"; exit 1; }
fi

NEW_APP=$(find "$EXTRACT_DIR" -maxdepth 3 -name "*.app" -type d 2>/dev/null | head -1)
if [ -z "$NEW_APP" ] || [ ! -d "$NEW_APP" ]; then
  log "Could not find .app in archive"
  exit 2
fi

log "Found app bundle: $NEW_APP"

if [ -d "$INSTALL" ]; then
  log "Removing old app at $INSTALL"
  rm -rf "$INSTALL"
fi

log "Installing to $INSTALL"
ditto "$NEW_APP" "$INSTALL"

log "Stripping quarantine attributes"
xattr -cr "$INSTALL" 2>>"$LOG" || true

INSTALLED_VER=$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$INSTALL/Contents/Info.plist" 2>/dev/null || true)
log "Installed bundle version: \${INSTALLED_VER:-unknown}"

log "Clearing updater caches"
rm -f "$ZIP" 2>>"$LOG" || true
for CACHE_DIR in "\${CACHE_DIRS[@]}"; do
  if [ -n "$CACHE_DIR" ] && [ -e "$CACHE_DIR" ]; then
    log "Removing cache: $CACHE_DIR"
    rm -rf "$CACHE_DIR" 2>>"$LOG" || true
  fi
done

log "Launching updated app"
open "$INSTALL"

log "Install complete"
exit 0
`;
  fs.writeFileSync(scriptPath, script, { mode: 0o755 });
  return scriptPath;
}

function installMacUpdate() {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'Mac-only feature' };
  }
  if (isRunningFromDmg()) {
    return {
      success: false,
      error: 'Install Smiley to /Applications before updating. Drag once from the DMG, then relaunch from Applications.',
      expected: true,
    };
  }

  const installPath = getMacInstallTargetPath();
  if (!installPath) {
    appendUpdaterLog('Could not determine app bundle path');
    return { success: false, error: 'Could not find Smiley.app location.', fallback: true };
  }
  const runningPath = getMacAppBundlePath();
  if (runningPath && path.resolve(runningPath) !== path.resolve(installPath)) {
    appendUpdaterLog(`Installing to ${installPath} (running from ${runningPath})`);
  }

  const zipPath = getMacDownloadedZipPath();
  if (!zipPath) {
    appendUpdaterLog('No downloaded zip found in updater cache');
    return { success: false, error: 'Update is not ready to install. Wait for the download to finish.', fallback: true };
  }

  const resolvedZip = path.resolve(zipPath);
  const allowedRoots = getUpdaterCacheCandidates()
    .map((dir) => path.resolve(dir))
    .filter((dir) => resolvedZip === dir || resolvedZip.startsWith(dir + path.sep));
  if (!allowedRoots.length) {
    appendUpdaterLog(`Rejected zip outside updater cache: ${resolvedZip}`);
    return { success: false, error: 'Invalid update cache path.', fallback: true };
  }

  try {
    const logPath = getUpdaterLogPath();
    const scriptPath = writeMacUpdateInstallerScript({
      zipPath: resolvedZip,
      installPath,
      logPath,
      parentPid: process.pid,
      cacheDirs: getMacUpdaterCacheCleanupPaths(),
    });
    appendUpdaterLog(`Spawning installer: ${scriptPath} -> ${installPath}`);
    void persistAllUserData().finally(() => {
      const child = spawn('bash', [scriptPath], { detached: true, stdio: 'ignore' });
      child.unref();
      markAppQuitting();
      setTimeout(() => app.quit(), 400);
    });
    return { success: true, version: pendingUpdateVersion || null };
  } catch (err) {
    appendUpdaterLog(`installMacUpdate failed: ${err.message}`);
    console.error('[updater] installMacUpdate failed:', err.message);
    return { success: false, error: err.message, fallback: true };
  }
}

function buildMacUpdateReadyPayload(version = pendingUpdateVersion) {
  const ver = resolveUpdateVersion(version);
  if (!ver) return null;
  return {
    ok: true,
    status: 'downloaded',
    message: 'Smiley will restart with the new version.',
    version: ver,
    percent: 100,
    macInApp: true,
    expected: true,
  };
}

function isUpdateSignatureError(msg) {
  const lower = String(msg || '').toLowerCase();
  return (
    lower.includes('not signed') ||
    lower.includes('invalid_signature') ||
    lower.includes('signature verification') ||
    lower.includes('signed by the application owner') ||
    lower.includes('code signature') ||
    lower.includes('did not pass validation') ||
    lower.includes('code requirement') ||
    lower.includes('satisfy specified code requirement') ||
    lower.includes('shipit') ||
    lower.includes('notariz') ||
    lower.includes('codesign') ||
    (lower.includes('signed') && (lower.includes('fail') || lower.includes('invalid') || lower.includes('requirement')))
  );
}

function formatUpdateError(err, version = pendingUpdateVersion) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (isUpdateSignatureError(msg)) {
    return buildManualInstallPayload(version);
  }
  if (
    process.platform === 'linux' &&
    (msg.includes('appimage env is not defined') || msg.includes('err_updater_old_file_not_found'))
  ) {
    return {
      ok: false,
      status: 'manual-install-required',
      message:
        'In-app updates only work from the AppImage. Download the latest AppImage from GitHub Releases.',
      version: version || null,
      releasesUrl: GITHUB_RELEASES_URL,
      expected: true,
    };
  }
  if (msg.includes('no update filepath') || msg.includes("can't quit and install")) {
    return {
      ok: false,
      status: 'error',
      error: 'Update is not ready to install. Wait for the download to finish or install manually from GitHub Releases.',
      expected: true,
    };
  }
  if (
    msg.includes('latest-mac.yml') &&
    process.platform === 'darwin'
  ) {
    return {
      ok: false,
      status: 'no-release',
      message:
        'Mac update metadata is not on GitHub yet. If a release just went out, wait a few minutes and try again, or download from github.com/1tsRajuWu/Smiley/releases',
      expected: true,
    };
  }
  if (
    msg.includes('latest.yml') ||
    msg.includes('latest-mac.yml') ||
    msg.includes('latest-linux.yml') ||
    msg.includes('no published') ||
    msg.includes('cannot find') ||
    msg.includes('net::err') ||
    msg.includes('404') ||
    msg.includes('enotfound') ||
    msg.includes('403')
  ) {
    return {
      ok: false,
      status: 'no-release',
      message: 'No update on GitHub yet — download the latest installer from github.com/1tsRajuWu/Smiley/releases',
      expected: true,
    };
  }
  return {
    ok: false,
    status: 'error',
    error: 'Update check failed. Download from GitHub Releases.',
    message: 'Update check failed. Download from GitHub Releases.',
    version: version || null,
    releasesUrl: GITHUB_RELEASES_URL,
    expected: true,
  };
}

function sendUpdateStatus(payload) {
  sendToWindow('update-status', payload);
}

let manualUpdateResolve = null;

function resolveManualUpdate(result) {
  if (manualUpdateResolve) {
    const resolve = manualUpdateResolve;
    manualUpdateResolve = null;
    resolve(result);
  }
}

function waitForManualUpdateCheck(timeoutMs = 45000) {
  return new Promise((resolve) => {
    if (manualUpdateResolve) {
      resolve({ ok: false, status: 'busy', error: 'Update check already in progress' });
      return;
    }
    const timer = setTimeout(() => {
      manualUpdateResolve = null;
      resolve({
        ok: false,
        status: 'timeout',
        error: 'Update check timed out. Try again or install from GitHub Releases.',
      });
    }, timeoutMs);
    manualUpdateResolve = (result) => {
      clearTimeout(timer);
      resolve(result);
    };
  });
}

async function checkForUpdates(manual = false, silent = false) {
  if (!isPackaged) {
    const result = {
      ok: true,
      status: 'dev-mode',
      message: 'Updates only work in the installed app from GitHub Releases (not npm start).',
    };
    if (manual) sendUpdateStatus({ status: 'dev-mode', message: result.message });
    return result;
  }

  if (isCheckingUpdate) {
    return { ok: false, status: 'busy', error: 'Update check already in progress' };
  }

  isCheckingUpdate = true;
  silentUpdateCheck = silent;

  if (manual) {
    const waitPromise = waitForManualUpdateCheck().finally(finishUpdateCheck);
    try {
      await getAutoUpdater().checkForUpdates();
      return await waitPromise;
    } catch (err) {
      finishUpdateCheck();
      silentUpdateCheck = false;
      console.error('[updater]', err.message);
      if (isMacInAppUpdater() && isMacMetadataMissingError(err)) {
        const fallback = await tryMacGithubReleaseFallback();
        if (fallback) {
          sendUpdateStatus(fallback.status === 'up-to-date'
            ? { status: 'up-to-date', version: fallback.version || APP_VERSION }
            : fallback);
          resolveManualUpdate(fallback);
          return fallback;
        }
      }
      const formatted = formatUpdateError(err);
      sendUpdateStatus(formatted);
      resolveManualUpdate(formatted);
      return formatted;
    }
  }

  try {
    await getAutoUpdater().checkForUpdates();
    return { ok: true, status: 'checking' };
  } catch (err) {
    finishUpdateCheck();
    silentUpdateCheck = false;
    console.error('[updater]', err.message);
    if (isMacInAppUpdater() && isMacMetadataMissingError(err)) {
      const fallback = await tryMacGithubReleaseFallback();
      if (fallback) {
        if (!silent) {
          sendUpdateStatus(fallback.status === 'up-to-date'
            ? { status: 'up-to-date', version: fallback.version || APP_VERSION, silent }
            : fallback);
        }
        return fallback;
      }
    }
    const formatted = formatUpdateError(err);
    if (!silent) sendUpdateStatus(formatted);
    return formatted;
  }
}

function isUpdateReadyToInstall() {
  if (!isPackaged) return false;
  if (process.platform === 'darwin') {
    return isCachedMacUpdateInstallable();
  }
  if (!pendingUpdateVersion || !updateDownloaded) return false;
  const helper = getAutoUpdater().downloadedUpdateHelper;
  if (helper?.file || helper?.packageFile) return true;
  return false;
}

function installPendingUpdate() {
  if (isMacInAppUpdater()) {
    const result = installMacUpdate();
    if (!result.success && result.error) {
      sendUpdateStatus({
        ok: false,
        status: 'error',
        error: result.error,
        version: pendingUpdateVersion || null,
        expected: true,
      });
    }
    return result.success;
  }
  if (!isUpdateReadyToInstall()) return false;
  if (process.platform === 'darwin' && isRunningFromDmg()) {
    sendUpdateStatus({
      ok: false,
      status: 'error',
      error: 'Install Smiley to /Applications before updating. Drag once from the DMG, then relaunch from Applications.',
      expected: true,
    });
    return false;
  }
  void persistAllUserData().then(() => {
    try {
      markAppQuitting();
      const forceRunAfter = process.platform !== 'darwin';
      getAutoUpdater().quitAndInstall(false, forceRunAfter);
    } catch (err) {
      app.isQuitting = false;
      console.error('[updater] quitAndInstall failed:', err.message);
      updateDownloaded = false;
      const formatted = formatUpdateError(err);
      sendUpdateStatus(formatted);
    }
  });
  return true;
}

function setupAutoUpdater() {
  try {
    const autoUpdater = getAutoUpdater();
    applyUpdaterSettings();
    guardMacUpdaterQuitAndInstall();
    autoUpdater.allowPrerelease = false;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.logger = console;

    // Verify update signatures in packaged builds unless explicitly skipped (unsigned local builds).
    const shouldVerifyUpdates = isPackaged && process.env.SMILEY_SKIP_UPDATE_VERIFY !== '1';
    if (!shouldVerifyUpdates && (process.platform === 'win32' || process.platform === 'darwin')) {
      autoUpdater.verifyUpdateCodeSignature = async () => null;
    }

    if (!isPackaged || updaterListenersAttached) return;
    updaterListenersAttached = true;

    getAutoUpdater().on('checking-for-update', () => {
      sendUpdateStatus({ status: 'checking', silent: silentUpdateCheck });
    });

    getAutoUpdater().on('update-available', (info) => {
      finishUpdateCheck();
      silentUpdateCheck = false;
      pendingUpdateVersion = info.version;
      updateDownloaded = false;
      lastDownloadPercent = 0;
      clearDownloadStallTimer();
      if (isMacInAppUpdater()) {
        const payload = {
          status: 'available',
          version: info.version,
          percent: 0,
          macInApp: true,
        };
        sendUpdateStatus(payload);
        resolveManualUpdate({ ok: true, status: 'available', version: info.version });
        ensureMacUpdateDownloaded(info.version).then((result) => {
          if (!result.success) {
            sendUpdateStatus({
              ok: false,
              status: 'error',
              error: result.error || formatUpdateDownloadError(),
              version: info.version,
              expected: true,
            });
          }
        }).catch((err) => {
          appendUpdaterLog(`ensureMacUpdateDownloaded failed: ${err.message}`);
          sendUpdateStatus({
            ok: false,
            status: 'error',
            error: formatUpdateDownloadError(err),
            version: info.version,
            expected: true,
          });
        });
        return;
      }
      if (updateDownloaded && pendingUpdateVersion === info.version) {
        sendUpdateStatus({ status: 'downloaded', version: info.version, percent: 100 });
        resolveManualUpdate({ ok: true, status: 'downloaded', version: info.version });
        return;
      }
      const payload = { status: 'available', version: info.version, percent: 0 };
      sendUpdateStatus(payload);
      resolveManualUpdate({ ok: true, status: 'available', version: info.version });
    });

    getAutoUpdater().on('update-not-available', (info) => {
      finishUpdateCheck();
      pendingUpdateVersion = null;
      updateDownloaded = false;
      lastDownloadPercent = 0;
      clearDownloadStallTimer();
      pruneStaleMacUpdateCache();
      const payload = {
        status: 'up-to-date',
        version: info?.version || APP_VERSION,
        silent: silentUpdateCheck,
      };
      silentUpdateCheck = false;
      sendUpdateStatus(payload);
      resolveManualUpdate({ ok: true, status: 'up-to-date', version: payload.version });
    });

    getAutoUpdater().on('download-progress', (progress) => {
      try {
        lastDownloadPercent = downloadProgressPercent(progress);
        resetDownloadStallTimer();
        sendUpdateStatus({
          status: 'downloading',
          percent: lastDownloadPercent,
          version: pendingUpdateVersion,
          macInApp: isMacInAppUpdater() || undefined,
        });
      } catch (err) {
        appendUpdaterLog(`download-progress handler failed: ${err.message}`);
      }
    });

    getAutoUpdater().on('update-downloaded', (info) => {
      clearDownloadStallTimer();
      silentUpdateCheck = false;
      pendingUpdateVersion = info.version;
      updateDownloaded = true;
      lastDownloadPercent = 100;
      if (isMacInAppUpdater()) {
        const payload = buildMacUpdateReadyPayload(info.version);
        if (payload) {
          sendUpdateStatus(payload);
          resolveManualUpdate({ ok: true, status: 'downloaded', version: payload.version });
        }
      } else {
        sendUpdateStatus({ status: 'downloaded', version: info.version, percent: 100 });
        resolveManualUpdate({ ok: true, status: 'downloaded', version: info.version });
      }
    });

    getAutoUpdater().on('error', (err) => {
      finishUpdateCheck();
      console.error('[updater]', err.message);
      clearDownloadStallTimer();
      silentUpdateCheck = false;
      const failedVersion = pendingUpdateVersion;
      updateDownloaded = false;
      lastDownloadPercent = 0;
      if (isMacInAppUpdater() && isMacMetadataMissingError(err)) {
        tryMacGithubReleaseFallback().then((fallback) => {
          if (fallback) {
            resolveManualUpdate(fallback);
            return;
          }
          const formatted = formatUpdateError(err, failedVersion);
          sendUpdateStatus(formatted);
          resolveManualUpdate(formatted);
        });
        return;
      }
      const formatted = formatUpdateError(err, failedVersion);
      if (isMacInAppUpdater() && isUpdateSignatureError(err?.message)) {
        appendUpdaterLog(`Suppressed signature error: ${err?.message || err}`);
        if (isCachedMacUpdateInstallable()) {
          updateDownloaded = true;
          const payload = buildMacUpdateReadyPayload();
          if (payload) {
            sendUpdateStatus(payload);
            resolveManualUpdate({ ok: true, status: 'downloaded', version: payload.version });
          }
          return;
        }
        ensureMacUpdateDownloaded(failedVersion).then((result) => {
          if (result.success) {
            resolveManualUpdate({ ok: true, status: 'downloaded', version: result.version });
            return;
          }
          const payload = {
            ok: false,
            status: 'error',
            error: result.error || formatUpdateDownloadError(err),
            version: failedVersion || null,
            expected: true,
          };
          sendUpdateStatus(payload);
          resolveManualUpdate(payload);
        });
        return;
      }
      if (isMacInAppUpdater() && isCachedMacUpdateInstallable()) {
        updateDownloaded = true;
        const payload = buildMacUpdateReadyPayload();
        if (payload) {
          sendUpdateStatus(payload);
          resolveManualUpdate({ ok: true, status: 'downloaded', version: payload.version });
        }
        return;
      }
      if (isMacInAppUpdater()) {
        const payload = {
          ok: false,
          status: 'error',
          error: formatUpdateDownloadError(err),
          version: failedVersion || null,
          expected: true,
        };
        if (!isCachedMacUpdateInstallable()) {
          ensureMacUpdateDownloaded(failedVersion).then((fallback) => {
            if (fallback.success) {
              resolveManualUpdate({ ok: true, status: 'downloaded', version: fallback.version });
              return;
            }
            sendUpdateStatus({
              ...payload,
              error: fallback.error || payload.error,
            });
            resolveManualUpdate({ ...payload, error: fallback.error || payload.error });
          });
          return;
        }
        sendUpdateStatus(payload);
        resolveManualUpdate(payload);
        return;
      }
      sendUpdateStatus(formatted);
      resolveManualUpdate(formatted);
    });
  } catch (err) {
    console.error('[updater] setup failed:', err.message);
  }
  if (isMacInAppUpdater()) {
    pruneStaleMacUpdateCache();
    notifyMacCachedUpdateIfReady();
  }
}

// ─── Custom Wallpapers ───────────────────────────────────────────────
const WALLPAPER_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function getWallpapersDir() {
  const dir = getUserDataPath('wallpapers');
  ensureDir(dir);
  return dir;
}

function saveWallpaper(sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (!WALLPAPER_EXTS.includes(ext)) {
    return { valid: false, error: `Only ${WALLPAPER_EXTS.join(', ')} allowed` };
  }
  const dir = getWallpapersDir();
  const hash = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const destName = sanitizeFilename(`wallpaper-${hash}${ext}${ENCRYPTED_FILE_EXT}`);
  const destPath = path.join(dir, destName);
  try {
    const buffer = fs.readFileSync(sourcePath);
    writeEncryptedBinaryFile(destPath, buffer, getUserDataRoot(), { mime: mimeFromExt(ext), origExt: ext });
    return { valid: true, path: destPath, filename: destName };
  } catch {
    return { valid: false, error: 'Save failed' };
  }
}

function isPathInsideResolvedDir(filePath, resolvedDir) {
  const rel = path.relative(resolvedDir, filePath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function resolveUserMediaFile(dir, filename) {
  if (!filename || typeof filename !== 'string') return null;
  const safeName = sanitizeFilename(path.basename(filename));
  const resolvedDir = path.resolve(dir);
  const tryPath = (name) => {
    const filePath = path.resolve(path.join(dir, name));
    if (!isPathInsideResolvedDir(filePath, resolvedDir)) return null;
    if (!fs.existsSync(filePath)) return null;
    return filePath;
  };
  return tryPath(safeName) || tryPath(encryptedMediaName(safeName)) || null;
}

function resolveWallpaperPath(filename) {
  return resolveUserMediaFile(getWallpapersDir(), filename);
}

function deleteWallpaperFile(filename) {
  const filePath = resolveWallpaperPath(filename);
  if (!filePath) return { success: false, error: 'Not found' };
  try {
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function wallpaperPathToUrl(filePath) {
  if (!filePath) return null;
  try {
    const { pathToFileURL } = require('url');
    return pathToFileURL(filePath).href;
  } catch {
    return null;
  }
}

function filePathToUrl(filePath) {
  return wallpaperPathToUrl(filePath);
}

// ─── Custom Animations ───────────────────────────────────────────────
const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getCustomAnimationsDir() {
  const dir = getUserDataPath('custom-animations');
  ensureDir(dir);
  return dir;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

function validateImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) return { valid: false, error: `Only ${ALLOWED_EXTS.join(', ')} allowed` };
  try {
    if (fs.statSync(filePath).size > MAX_FILE_SIZE) return { valid: false, error: 'Max 5MB' };
  } catch { return { valid: false, error: 'Cannot read file' }; }
  return { valid: true };
}

async function saveCustomAnimation(sourcePath) {
  const v = validateImageFile(sourcePath);
  if (!v.valid) return v;
  const dir = getCustomAnimationsDir();
  const hash = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ext = path.extname(sourcePath).toLowerCase();
  const destName = sanitizeFilename(`custom-${hash}${ext}${ENCRYPTED_FILE_EXT}`);
  const destPath = path.join(dir, destName);
  try {
    const buffer = fs.readFileSync(sourcePath);
    writeEncryptedBinaryFile(destPath, buffer, getUserDataRoot(), { mime: mimeFromExt(ext), origExt: ext });
    const files = fs.readdirSync(dir)
      .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime }))
      .sort((a, b) => b.time - a.time);
    if (files.length > 10) {
      files.slice(10).forEach(f => { try { secureUnlink(path.join(dir, f.name)); } catch (_) {} });
    }
    return { valid: true, path: destPath, name: destName };
  } catch (err) { return { valid: false, error: 'Save failed' }; }
}

function getCustomAnimationsList() {
  const dir = getCustomAnimationsDir();
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(ENCRYPTED_FILE_EXT) || ALLOWED_EXTS.includes(path.extname(f).toLowerCase()))
      .map(f => ({ name: f, path: path.join(dir, f) }));
  } catch { return []; }
}

function imageToDataUrl(filePath) {
  try {
    const result = readEncryptedBinaryFile(filePath, getUserDataRoot());
    if (!result?.buffer) return null;
    const mime = result.mime || mimeFromExt(result.origExt || path.extname(filePath));
    return `data:${mime};base64,${result.buffer.toString('base64')}`;
  } catch { return null; }
}

// ─── Custom Activities ───────────────────────────────────────────────
const MAX_CUSTOM_ACTIVITIES = 20;
const CUSTOM_ACTIVITY_TEXT_MAX = 128;
const GIF_URL_FETCH_TIMEOUT = 8000;

function getCustomActivitiesDir() {
  const dir = getUserDataPath('custom-activities');
  ensureDir(dir);
  return dir;
}

function enrichCustomActivity(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  let localGifPath = entry.localGifPath || null;
  if (entry.localFileName) {
    const filePath = resolveUserMediaFile(getCustomActivitiesDir(), entry.localFileName);
    if (filePath) {
      localGifPath = imageToDataUrl(filePath) || filePathToUrl(filePath);
    }
  }
  return { ...entry, localGifPath };
}

function sanitizeActivityText(text, maxLen = CUSTOM_ACTIVITY_TEXT_MAX) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, maxLen);
}

function sanitizeEmoji(emoji) {
  const s = sanitizeActivityText(emoji || '✨', 8);
  return s || '✨';
}

function isValidGifUrlInput(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) return false;
  if (!isAllowedGifUrl(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (/\.gif(\?|#|$)/i.test(lower)) return true;
  if (/tenor\.com|giphy\.com/i.test(lower)) return true;
  return false;
}

function httpGetText(url, { maxRedirects = 5, timeout = GIF_URL_FETCH_TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Invalid URL'));
      return;
    }
    if (!isAllowedGifUrl(url)) {
      reject(new Error('URL host not allowed'));
      return;
    }
    const lib = parsed.protocol === 'http:' ? require('http') : require('https');
    const req = lib.get(
      url,
      {
        headers: { 'User-Agent': `Smiley/${APP_VERSION}`, Accept: 'text/html,application/json,*/*' },
        timeout,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          if (!isAllowedGifUrl(next)) {
            reject(new Error('Redirect to disallowed host'));
            return;
          }
          httpGetText(next, { maxRedirects: maxRedirects - 1, timeout }).then(resolve).catch(reject);
          return;
        }
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 600000) {
            req.destroy();
            reject(new Error('Response too large'));
          }
        });
        res.on('end', () => resolve({ status: res.statusCode, body, finalUrl: url }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

function extractTenorGifFromHtml(html) {
  if (!html) return null;
  const match = html.match(/https:\/\/media\d*\.tenor\.com\/[^"'\s<>]+\.gif/i);
  return match ? match[0] : null;
}

function extractGiphyId(url) {
  const mediaMatch = url.match(/giphy\.com\/media\/([a-zA-Z0-9]+)/i);
  if (mediaMatch) return mediaMatch[1];
  const slug = url.split('/').pop()?.split('?')[0] || '';
  const parts = slug.split('-');
  const last = parts[parts.length - 1];
  if (last && /^[a-zA-Z0-9]{5,}$/.test(last)) return last;
  return null;
}

async function resolveGifUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!isValidGifUrlInput(trimmed)) {
    return { success: false, error: 'URL must be HTTPS and a .gif link or Tenor/Giphy page' };
  }

  const lower = trimmed.toLowerCase();
  if (/^https:\/\/media\.tenor\.com\/.+\.gif/i.test(trimmed)) {
    return { success: true, url: trimmed };
  }
  if (/^https:\/\/(i\.giphy\.com|media\d*\.giphy\.com)\//i.test(trimmed) && /\.gif/i.test(trimmed)) {
    return { success: true, url: trimmed };
  }
  if (/\.gif(\?|#|$)/i.test(trimmed)) {
    if (!isAllowedGifUrl(trimmed)) {
      return { success: false, error: 'GIF host not allowed' };
    }
    return { success: true, url: trimmed };
  }

  if (/tenor\.com/i.test(lower)) {
    try {
      const { body } = await httpGetText(trimmed);
      const direct = extractTenorGifFromHtml(body);
      if (direct) return { success: true, url: direct };
    } catch (err) {
      return { success: false, error: err.message || 'Could not resolve Tenor URL' };
    }
    return { success: false, error: 'Could not find GIF on Tenor page' };
  }

  if (/giphy\.com/i.test(lower)) {
    const gifId = extractGiphyId(trimmed);
    if (gifId) {
      const candidate = `https://i.giphy.com/${gifId}.gif`;
      return { success: true, url: candidate };
    }
    try {
      const { body } = await httpGetText(trimmed);
      const match = body.match(/https:\/\/i\.giphy\.com\/[a-zA-Z0-9]+\.gif/i)
        || body.match(/https:\/\/media\d*\.giphy\.com\/media\/[a-zA-Z0-9]+\/giphy\.gif/i);
      if (match) return { success: true, url: match[0] };
    } catch (err) {
      return { success: false, error: err.message || 'Could not resolve Giphy URL' };
    }
    return { success: false, error: 'Could not resolve Giphy URL' };
  }

  return { success: false, error: 'Unsupported GIF URL' };
}

async function saveCustomActivityGif(sourcePath) {
  const v = validateImageFile(sourcePath);
  if (!v.valid) return v;
  const dir = getCustomActivitiesDir();
  const hash = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ext = path.extname(sourcePath).toLowerCase();
  const destName = sanitizeFilename(`activity-${hash}${ext}${ENCRYPTED_FILE_EXT}`);
  const destPath = path.join(dir, destName);
  try {
    const buffer = fs.readFileSync(sourcePath);
    writeEncryptedBinaryFile(destPath, buffer, getUserDataRoot(), { mime: mimeFromExt(ext), origExt: ext });
    const previewUrl = imageToDataUrl(destPath);
    return { valid: true, path: destPath, name: destName, previewUrl };
  } catch {
    return { valid: false, error: 'Save failed' };
  }
}

function broadcastConfigChanged(extra = {}) {
  sendToWindow('config-changed', {
    recentActivities: config.recentActivities || [],
    favoriteActivities: config.favoriteActivities || [],
    customActivities: config.customActivities || [],
    ...extra,
  });
}

// ─── Storage & cache cleanup ─────────────────────────────────────────
function getAppCacheDir() {
  const homedir = os.homedir();
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
  }
  if (process.platform === 'darwin') {
    return path.join(homedir, 'Library', 'Caches');
  }
  return process.env.XDG_CACHE_HOME || path.join(homedir, '.cache');
}

function getPathSizeSync(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) return 0;
  try {
    const stat = fs.statSync(targetPath);
    if (stat.isFile()) return stat.size;
    if (!stat.isDirectory()) return 0;
    let total = 0;
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      const child = path.join(targetPath, entry.name);
      try {
        if (entry.isDirectory()) total += getPathSizeSync(child);
        else if (entry.isFile()) total += fs.statSync(child).size;
      } catch (_) {}
    }
    return total;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getChromiumCachePaths() {
  return CHROMIUM_CACHE_DIRS.map((d) => getUserDataPath(d));
}

function removePathSync(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) return;
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (err) {
    console.warn('[cache] remove failed:', targetPath, err.message);
  }
}

function clearChromiumCaches() {
  for (const cachePath of getChromiumCachePaths()) {
    removePathSync(cachePath);
  }
  try {
    session.defaultSession?.clearCache().catch(() => {});
  } catch (_) {}
}

function getUpdaterCacheDir() {
  return path.join(getAppCacheDir(), `${app.getName()}-updater`);
}

function getUpdaterCacheCandidates() {
  const base = getAppCacheDir();
  const names = [
    `${app.getName()}-updater`,
    app.getName(),
    'smiley-rpc-updater',
    'com.smiley.rpc-updater',
  ];
  return [...new Set(names.map((name) => path.join(base, name)))];
}

function getShipItCacheDir() {
  return path.join(getAppCacheDir(), 'com.smiley.rpc.ShipIt');
}

function cleanStaleUpdaterCache({ force = false } = {}) {
  if (!force && (updateDownloaded || pendingUpdateVersion || getMacDownloadedZipPath())) {
    return { skipped: true, reason: 'pending-install' };
  }
  let cleared = false;
  for (const dir of getUpdaterCacheCandidates()) {
    if (!fs.existsSync(dir)) continue;
    const pendingDir = path.join(dir, 'pending');
    if (fs.existsSync(pendingDir) && findZipInDirectory(pendingDir)) {
      continue;
    }
    removePathSync(dir);
    cleared = true;
  }
  if (cleared && !force) {
    updateDownloaded = false;
    pendingUpdateVersion = null;
  }
  return { cleared };
}

function cleanOrphanedWallpapers() {
  if (configLoadHadFailure) return 0;
  const active = config.customWallpaper?.filename;
  const dir = getWallpapersDir();
  let removed = 0;
  try {
    for (const file of fs.readdirSync(dir)) {
      if (file === active) continue;
      try {
        fs.unlinkSync(path.join(dir, file));
        removed += 1;
      } catch (_) {}
    }
  } catch (_) {}
  return removed;
}

function cleanOrphanedCustomActivityFiles() {
  if (configLoadHadFailure) return 0;
  const referenced = new Set(
    (config.customActivities || [])
      .map((a) => a.localFileName)
      .filter(Boolean)
      .map((f) => sanitizeFilename(f)),
  );
  const dir = getCustomActivitiesDir();
  let removed = 0;
  try {
    for (const file of fs.readdirSync(dir)) {
      if (referenced.has(sanitizeFilename(file))) continue;
      try {
        fs.unlinkSync(path.join(dir, file));
        removed += 1;
      } catch (_) {}
    }
  } catch (_) {}
  return removed;
}

function getUserDataEssentialPaths() {
  return [
    getUserDataPath(CONFIG_SECURE),
    getUserDataPath(CONFIG_SECURE_BACKUP),
    getUserDataPath(CONFIG_LEGACY),
    getUserDataPath(WINDOW_STATE_SECURE),
    getUserDataPath(WINDOW_STATE_LEGACY),
    getUserDataPath('install-id.secure'),
    getUserDataPath('install-id'),
    getUserDataPath('master-key.enc'),
    getUserDataPath('custom-activities'),
    getUserDataPath('custom-animations'),
    getUserDataPath('wallpapers'),
    getUserDataPath(FIRST_SHOW_MARKER),
    getUserDataPath(PORTABLE_INIT_MARKER),
    getUserDataPath(CACHE_MAINTENANCE_MARKER),
  ];
}

function getStorageInfo() {
  const chromiumBytes = getChromiumCachePaths().reduce((sum, p) => sum + getPathSizeSync(p), 0);
  const updaterBytes = getPathSizeSync(getUpdaterCacheDir());
  const shipItBytes = process.platform === 'darwin' ? getPathSizeSync(getShipItCacheDir()) : 0;
  const essentialsBytes = getUserDataEssentialPaths().reduce((sum, p) => sum + getPathSizeSync(p), 0);
  const userDataBytes = getPathSizeSync(app.getPath('userData'));
  const clearableBytes = chromiumBytes + updaterBytes + shipItBytes;
  return {
    userDataPath: app.getPath('userData'),
    essentialsBytes,
    chromiumBytes,
    updaterBytes,
    shipItBytes,
    userDataBytes,
    clearableBytes,
    totalOnDiskBytes: userDataBytes + updaterBytes + shipItBytes,
    formatted: {
      essentials: formatBytes(essentialsBytes),
      clearable: formatBytes(clearableBytes),
      total: formatBytes(userDataBytes + updaterBytes + shipItBytes),
      chromium: formatBytes(chromiumBytes),
      updater: formatBytes(updaterBytes),
      shipIt: formatBytes(shipItBytes),
    },
  };
}

async function clearAppCache({ forceUpdater = false } = {}) {
  const before = getStorageInfo();
  cleanOrphanedWallpapers();
  cleanOrphanedCustomActivityFiles();
  cleanStaleUpdaterCache({ force: forceUpdater });
  clearChromiumCaches();
  if (process.platform === 'darwin') {
    removePathSync(getShipItCacheDir());
  }
  const after = getStorageInfo();
  return {
    success: true,
    freedBytes: Math.max(0, before.clearableBytes - after.clearableBytes),
    freedFormatted: formatBytes(Math.max(0, before.clearableBytes - after.clearableBytes)),
    ...after,
  };
}

function runStartupCacheMaintenance() {
  const markerPath = getUserDataPath(CACHE_MAINTENANCE_MARKER);
  let lastRun = 0;
  try {
    if (fs.existsSync(markerPath)) {
      const parsed = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      lastRun = Date.parse(parsed.lastRun) || 0;
    }
  } catch (_) {}
  if (Date.now() - lastRun < CACHE_MAINTENANCE_INTERVAL_MS) return;

  try {
    cleanOrphanedWallpapers();
    cleanOrphanedCustomActivityFiles();
    cleanStaleUpdaterCache();
    const chromiumBytes = getChromiumCachePaths().reduce((sum, p) => sum + getPathSizeSync(p), 0);
    if (chromiumBytes > CHROMIUM_CACHE_MAX_BYTES) {
      clearChromiumCaches();
    }
    if (process.platform === 'darwin') {
      removePathSync(getShipItCacheDir());
    }
    fs.writeFileSync(markerPath, JSON.stringify({ lastRun: new Date().toISOString() }));
  } catch (err) {
    console.warn('[cache] startup maintenance failed:', err.message);
  }
}

// ─── IPC ─────────────────────────────────────────────────────────────
let ipcGuardInstalled = false;
const ipcRateLimiter = createIpcRateLimiter({
  'export-settings': 5000,
  'import-settings': 5000,
  'resolve-gif-url': 800,
  'open-external': 400,
  'save-install-consent': 2000,
});

function isTrustedIpcEvent(event) {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (event.sender !== mainWindow.webContents) return false;
    const url = event.senderFrame?.url || event.sender.getURL?.() || '';
    return url.startsWith('file://');
  } catch {
    return false;
  }
}

function installIpcGuard() {
  if (ipcGuardInstalled) return;
  ipcGuardInstalled = true;
  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) => {
    originalHandle(channel, async (event, ...args) => {
      if (!isTrustedIpcEvent(event)) {
        console.warn('[ipc] blocked untrusted sender:', channel);
        throw new Error('Unauthorized IPC request');
      }
      if (!ipcRateLimiter.check(channel)) {
        return { success: false, error: 'Too many requests — try again shortly' };
      }
      return listener(event, ...args);
    });
  };
}

function migrateUserMediaToEncrypted() {
  // Removed: bulk sync encryption at startup froze macOS (scrypt + large GIF reads on main thread).
  // Legacy plain files are encrypted lazily in the background via scheduleLazyMediaEncryption().
}

function setupIPC() {
  installIpcGuard();
  ipcMain.handle('get-config', () => ({
    hasValidClientId: !!getClientId(),
    donationUrl: DONATION_URL,
    theme: config.theme || 'dark',
    uiVersion: config.uiVersion === 'v1' ? 'v1' : config.uiVersion === 'v2' ? 'v2' : 'v3',
    showTimer: config.showTimer !== false,
    animationsEnabled: config.animationsEnabled !== false,
    customAnimation: config.customAnimation || null,
    minimizeToTray: config.minimizeToTray !== false,
    autoConnect: config.autoConnect !== false,
    launchAtLogin: config.launchAtLogin === true,
    hotkeyEnabled: config.hotkeyEnabled !== false,
    hotkey: GLOBAL_HOTKEY,
    autoCheckUpdates: config.autoCheckUpdates !== false,
    autoInstallUpdates: config.autoInstallUpdates !== false,
    installTrackingEnabled: isInstallTrackingEnabled(),
    shareAnonymousInstallStats: isInstallTrackingEnabled(),
    installRegistryConfigured: !!loadRegistryConfig(__dirname),
    installConsentShown: config.installConsentShown === true,
    needsInstallConsent: needsInstallConsentPrompt(),
    securityKeychain: isKeychainActive(),
    recentActivities: config.recentActivities || [],
    favoriteActivities: config.favoriteActivities || [],
    customActivities: config.customActivities || [],
    activityGifChoice: config.activityGifChoice || {},
    activityProfiles: config.activityProfiles || [],
    rotateFavorites: config.rotateFavorites || { enabled: false, intervalMinutes: 15 },
    sessionStats: config.sessionStats || {},
    musicNowPlaying: config.musicNowPlaying !== false,
    musicNowPlayingAlbumArt: config.musicNowPlayingAlbumArt !== false,
    gamingNowPlaying: config.gamingNowPlaying !== false,
    gamingNowPlayingCoverArt: config.gamingNowPlayingCoverArt !== false,
    presencePaused: isPresencePaused(),
    customWallpaper: config.customWallpaper || null,
    isMac: process.platform === 'darwin',
    macInAppUpdates: MAC_IN_APP_UPDATES,
    macAdHocUpdates: false,
    macDmgArch: process.platform === 'darwin' ? getMacDmgArch() : null,
    releasesUrl: GITHUB_RELEASES_URL,
    osPlatform: process.platform,
    version: APP_VERSION,
    platform: `${process.platform} ${os.release()}`,
  }));

  ipcMain.handle('toggle-favorite', (_, id) => {
    if (typeof id !== 'string' || !id.trim()) return config.favoriteActivities || [];
    return toggleFavoriteActivity(id.trim().slice(0, 64));
  });
  ipcMain.handle('pause-presence', () => pausePresence());
  ipcMain.handle('resume-presence', () => resumePresence());
  ipcMain.handle('get-presence-paused', () => ({ paused: isPresencePaused() }));
  ipcMain.handle('copy-text', (_, text) => {
    try {
      if (typeof text !== 'string' || !text.trim()) return { success: false };
      clipboard.writeText(text.trim().slice(0, MAX_COPY_TEXT_LEN));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('save-config', async (_, data) => {
    const prevMusicSync = config.musicNowPlaying !== false;
    const prevGameSync = config.gamingNowPlaying !== false;
    saveConfig(data);
    const nextMusicSync = config.musicNowPlaying !== false;
    const nextGameSync = config.gamingNowPlaying !== false;
    if (prevMusicSync !== nextMusicSync) {
      getMusicSync().handleConfigChange(nextMusicSync);
    }
    if (prevGameSync !== nextGameSync) {
      getGameSync().handleConfigChange(nextGameSync);
    }
    applyLaunchAtLogin();
    registerGlobalHotkey();
    applyUpdaterSettings();
    updateTrayMenu();
    if (canRegisterInstall()) {
      maybeRegisterInstall();
    }
    if (config.autoConnect !== false && !rpcClient) return connectRPC();
    return { connected: !!rpcClient };
  });

  ipcMain.handle('flush-config', async () => {
    await flushRendererPendingConfig();
    flushConfigToDisk();
    return { success: true };
  });

  ipcMain.handle('connect-rpc', () => connectRPC());
  ipcMain.handle('set-activity', async (_, activity, isNewSession = true) =>
    schedulePresenceUpdate(activity, isNewSession)
  );
  ipcMain.handle('clear-activity', () => clearPresence());
  ipcMain.handle('get-status', () => ({
    connected: !!rpcClient,
    activity: sanitizeActivitySnapshot(currentActivity),
    sessionStart: currentActivity?.id === 'listening' ? null : sessionStart,
  }));

  ipcMain.handle('check-for-updates', async () => {
    try {
      return await checkForUpdates(true);
    } catch (err) {
      console.error('[updater]', err.message);
      const formatted = formatUpdateError(err);
      sendUpdateStatus(formatted);
      return formatted;
    }
  });

  ipcMain.handle('install-update', async () => {
    if (isMacInAppUpdater()) {
      if (isRunningFromDmg()) {
        return {
          success: false,
          error: 'Install Smiley to /Applications before updating. Drag once from the DMG, then relaunch from Applications.',
        };
      }
      if (!pendingUpdateVersion) {
        pendingUpdateVersion = resolveUpdateVersion() || null;
      }
      if (!isUpdateReadyToInstall()) {
        if (!pendingUpdateVersion) {
          return {
            success: false,
            error: 'No update found. Click Check for updates first.',
          };
        }
        const download = await ensureMacUpdateDownloaded(pendingUpdateVersion);
        if (!download.success) {
          return {
            success: false,
            error: download.error || formatUpdateDownloadError(),
          };
        }
      }
      const result = installMacUpdate();
      if (result.success) return result;
      return {
        success: false,
        error: result.error || 'Could not install update. Make sure Smiley is in /Applications.',
      };
    }
    if (process.platform === 'darwin' && isRunningFromDmg()) {
      return {
        success: false,
        error: 'Install Smiley to /Applications before updating. Drag once from the DMG, then relaunch from Applications.',
      };
    }
    if (!isUpdateReadyToInstall()) {
      return {
        success: false,
        error: 'Update is not ready to install. Wait for the download to finish or install manually from GitHub Releases.',
      };
    }
    const started = installPendingUpdate();
    return {
      success: started,
      error: started ? undefined : 'Could not start installer. Try downloading from GitHub Releases.',
      releasesUrl: GITHUB_RELEASES_URL,
      version: pendingUpdateVersion || null,
    };
  });

  ipcMain.handle('download-mac-update', async (_, version) => {
    try {
      return await downloadMacUpdateDmg(version || pendingUpdateVersion);
    } catch (err) {
      console.error('[updater] download-mac-update failed:', err.message);
      const payload = {
        ok: false,
        status: 'dmg-error',
        version: normalizeReleaseVersion(version || pendingUpdateVersion) || null,
        error: 'Could not download update. Try again later.',
        releasesUrl: GITHUB_RELEASES_URL,
        expected: true,
      };
      sendUpdateStatus(payload);
      return payload;
    }
  });

  ipcMain.handle('open-mac-update-dmg', (_, version) => openMacDownloadedDmg(version || pendingUpdateVersion));

  ipcMain.handle('pick-custom-animation', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Custom Animation',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const saveResult = await saveCustomAnimation(result.filePaths[0]);
    if (!saveResult.valid) return { error: saveResult.error };
    const dataUrl = imageToDataUrl(saveResult.path);
    if (!dataUrl) return { error: 'Could not read image' };
    return { success: true, name: saveResult.name, dataUrl, path: saveResult.path };
  });

  ipcMain.handle('get-custom-animations', () => {
    return getCustomAnimationsList()
      .map((item) => {
        const dataUrl = imageToDataUrl(item.path);
        return dataUrl ? { name: item.name, dataUrl } : null;
      })
      .filter(Boolean);
  });

  ipcMain.handle('delete-custom-animation', (_, name) => {
    if (typeof name !== 'string' || !name.trim()) return { success: false, error: 'Invalid name' };
    const dir = getCustomAnimationsDir();
    const safeName = sanitizeFilename(name.trim());
    const resolvedDir = path.resolve(dir);
    const filePath = path.resolve(path.join(dir, safeName));
    if (!isPathInsideResolvedDir(filePath, resolvedDir)) {
      return { success: false, error: 'Invalid path' };
    }
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('resolve-custom-activity-preview', (_, localFileName) => {
    if (typeof localFileName !== 'string' || !localFileName.trim()) return { url: null };
    const filePath = resolveUserMediaFile(getCustomActivitiesDir(), localFileName.trim());
    if (!filePath) return { url: null };
    const url = imageToDataUrl(filePath);
    return { url: url || null };
  });

  ipcMain.handle('get-custom-activities', () =>
    (config.customActivities || []).map((entry) => {
      if (!entry?.localFileName) return { ...entry, localGifPath: entry.localGifPath || null };
      return { ...entry, localGifPath: null };
    }),
  );

  ipcMain.handle('resolve-gif-url', async (_, url) => {
    if (typeof url !== 'string') return { success: false, error: 'Invalid URL' };
    return resolveGifUrl(url.slice(0, 2048));
  });

  ipcMain.handle('pick-custom-activity-gif', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select GIF for Activity',
      filters: [{ name: 'Images', extensions: ['gif', 'webp', 'png'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const saveResult = await saveCustomActivityGif(result.filePaths[0]);
    if (!saveResult.valid) return { error: saveResult.error };
    return {
      success: true,
      fileName: saveResult.name,
      previewUrl: saveResult.previewUrl,
      path: saveResult.path,
    };
  });

  ipcMain.handle('save-custom-activity', async (_, data) => {
    const activities = [...(config.customActivities || [])];
    const isEdit = Boolean(data?.id);
    if (!isEdit && activities.length >= MAX_CUSTOM_ACTIVITIES) {
      return { success: false, error: `Maximum ${MAX_CUSTOM_ACTIVITIES} custom activities` };
    }

    const details = sanitizeActivityText(data?.details);
    if (!details) return { success: false, error: 'Title is required' };

    const state = sanitizeActivityText(data?.state);
    const emoji = sanitizeEmoji(data?.emoji);
    let gifUrl = null;
    let localGifPath = null;
    let localFileName = null;

    if (data?.gifUrl) {
      const resolved = await resolveGifUrl(data.gifUrl);
      if (!resolved.success) return { success: false, error: resolved.error };
      gifUrl = resolved.url;
    } else if (data?.keepGifUrl) {
      const existing = activities.find((a) => a.id === data.id);
      gifUrl = existing?.gifUrl || null;
    }

    if (data?.localFileName) {
      const filePath = resolveUserMediaFile(getCustomActivitiesDir(), data.localFileName);
      if (filePath) {
        localFileName = sanitizeFilename(path.basename(filePath));
        localGifPath = imageToDataUrl(filePath) || filePathToUrl(filePath);
      }
    } else if (isEdit && data?.keepLocalFile) {
      const existing = activities.find((a) => a.id === data.id);
      localFileName = existing?.localFileName || null;
      localGifPath = existing?.localGifPath || null;
    }

    if (!gifUrl && !localGifPath) {
      return { success: false, error: 'Add a GIF URL or upload a file' };
    }

    const id = isEdit ? String(data.id) : `custom-${crypto.randomUUID()}`;
    const existingIdx = activities.findIndex((a) => a.id === id);
    const entry = {
      id,
      details,
      state,
      emoji,
      category: 'custom',
      gifUrl,
      localGifPath,
      localFileName,
      createdAt: existingIdx >= 0 ? (activities[existingIdx].createdAt || Date.now()) : Date.now(),
    };

    if (existingIdx >= 0) {
      const old = activities[existingIdx];
      if (old.localFileName && old.localFileName !== localFileName) {
        try {
          const oldPath = path.join(getCustomActivitiesDir(), sanitizeFilename(old.localFileName));
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (_) {}
      }
      activities[existingIdx] = entry;
    } else {
      activities.push(entry);
    }

    saveConfig({ customActivities: activities });
    broadcastConfigChanged();
    return { success: true, activity: enrichCustomActivity(entry) };
  });

  ipcMain.handle('delete-custom-activity', (_, id) => {
    if (typeof id !== 'string' || !id.trim()) return { success: false, error: 'Invalid id' };
    const safeId = id.trim().slice(0, 64);
    const activities = [...(config.customActivities || [])];
    const idx = activities.findIndex((a) => a.id === safeId);
    if (idx < 0) return { success: false, error: 'Not found' };
    const removed = activities.splice(idx, 1)[0];
    if (removed.localFileName) {
      try {
        const fp = path.join(getCustomActivitiesDir(), sanitizeFilename(removed.localFileName));
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (_) {}
    }
    saveConfig({
      customActivities: activities,
      favoriteActivities: (config.favoriteActivities || []).filter((f) => f !== safeId),
      recentActivities: (config.recentActivities || []).filter((r) => r.id !== safeId),
    });
    broadcastConfigChanged();
    return { success: true };
  });

  ipcMain.handle('pick-wallpaper', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Wallpaper',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const saveResult = saveWallpaper(result.filePaths[0]);
    if (!saveResult.valid) return { error: saveResult.error };
    const url = imageToDataUrl(saveResult.path);
    if (!url) return { error: 'Could not read image' };
    return { success: true, filename: saveResult.filename, url };
  });

  ipcMain.handle('get-wallpaper-path', (_, filename) => {
    const filePath = resolveWallpaperPath(filename);
    const url = filePath ? imageToDataUrl(filePath) : null;
    return url ? { url } : { url: null };
  });

  ipcMain.handle('delete-wallpaper', (_, filename) => deleteWallpaperFile(filename));


  ipcMain.handle('open-external', (_, url) => {
    try {
      if (typeof url !== 'string' || !url.trim()) return { success: false, error: 'Invalid URL' };
      const trimmed = url.trim().slice(0, 2048);
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'mailto:') {
        shell.openExternal(trimmed);
        return { success: true };
      }
      if (!isAllowedExternalUrl(trimmed)) return { success: false, error: 'URL not allowed' };
      shell.openExternal(trimmed);
      return { success: true };
    } catch { return { success: false, error: 'Invalid URL' }; }
  });

  ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.handle('maximize-window', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return { isMaximized: false };
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return { isMaximized: mainWindow.isMaximized() };
  });
  ipcMain.handle('is-window-maximized', () => ({
    isMaximized: !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()),
  }));
  ipcMain.handle('is-window-visible', () => ({
    visible: !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized()),
  }));
  ipcMain.handle('close-window', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (shouldCloseToTray() && !isAppQuitting()) {
      await flushRendererPendingConfig();
      flushPendingDiskWrites();
      flushConfigToDisk();
      hideMainWindowToTray();
      return;
    }
    markAppQuitting();
    app.quit();
  });

  ipcMain.handle('save-install-consent', () => {
    saveConfig({
      installConsentShown: true,
      installTrackingEnabled: true,
    });
    setImmediate(() => maybeRegisterInstall());
    return { success: true };
  });

  ipcMain.handle('export-settings', async (_, { passphrase } = {}) => {
    if (!mainWindow) return { canceled: true };
    const pass = typeof passphrase === 'string' ? passphrase.trim() : '';
    if (pass.length < 8) {
      return { success: false, error: 'Export passphrase must be at least 8 characters' };
    }
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Smiley Settings (E2EE)',
      defaultPath: 'smiley-settings.smiley',
      filters: [
        { name: 'Encrypted Smiley Settings', extensions: ['smiley'] },
      ],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const exportData = stripSensitiveFields({ ...config });
    delete exportData.clientId;
    const envelope = encryptExport(exportData, pass);
    fs.writeFileSync(result.filePath, JSON.stringify(envelope, null, 2));
    return { success: true, path: result.filePath, encrypted: true };
  });

  ipcMain.handle('reset-window-position', () => resetWindowPosition());

  ipcMain.handle('get-storage-info', () => getStorageInfo());

  ipcMain.handle('clear-cache', async () => clearAppCache());

  ipcMain.handle('import-settings', async (_, { passphrase } = {}) => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Smiley Settings',
      filters: [
        { name: 'Smiley Settings', extensions: ['smiley', 'json'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try {
      const filePath = result.filePaths[0];
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_IMPORT_BYTES) {
        return { success: false, error: 'Settings file too large' };
      }
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
        return { success: false, error: 'Invalid settings file' };
      }
      let imported;
      if (raw?.type === 'smiley-export') {
        const pass = typeof passphrase === 'string' ? passphrase.trim() : '';
        if (!pass) {
          return { success: false, error: 'Passphrase required for encrypted export', needsPassphrase: true };
        }
        imported = stripSensitiveFields(decryptExport(raw, pass));
      } else {
        imported = stripSensitiveFields(raw);
      }
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
        return { success: false, error: 'Invalid settings file' };
      }
      delete imported.clientId;
      saveConfig(sanitizeConfigPatch(imported));
      applyLaunchAtLogin();
      registerGlobalHotkey();
      applyUpdaterSettings();
      broadcastStatus();
      updateTrayMenu();
      return { success: true };
    } catch (err) {
      const msg = err.message?.includes('passphrase') || err.message?.includes('decipher')
        ? 'Wrong passphrase or corrupted export file'
        : (err.message || 'Invalid settings file');
      return { success: false, error: msg };
    }
  });
}

function deferAfterWindowShown(fn) {
  if (!mainWindow) {
    setImmediate(fn);
    return;
  }
  if (mainWindow.isVisible()) {
    setImmediate(fn);
    return;
  }
  mainWindow.once('show', () => setImmediate(fn));
}

function scheduleStartupCacheMaintenance() {
  deferAfterWindowShown(() => runStartupCacheMaintenance());
}

function scheduleInitialRpcConnect() {
  const notify = (result) => {
    broadcastStatus(true);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('initial-connect', result);
    }
  };

  if (config.autoConnect === false) {
    const sendDisconnected = () => notify({ connected: false, error: null });
    if (mainWindow?.webContents.isLoadingMainFrame()) {
      mainWindow.webContents.once('did-finish-load', sendDisconnected);
    } else {
      setImmediate(sendDisconnected);
    }
    return;
  }

  const run = () => connectRPC().then(notify);
  deferAfterWindowShown(() => setImmediate(run));
}

// ─── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(() => {
  app.setName(APP_DISPLAY_NAME);
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.smiley.rpc');
  }
  Menu.setApplicationMenu(null);
  initSecurity(app.getPath('userData'));
  loadConfig();
  ensureDir(getUserDataPath('custom-animations'));
  ensureDir(getUserDataPath('custom-activities'));
  ensureDir(getUserDataPath('wallpapers'));
  applyLaunchAtLogin();
  createWindow();
  scheduleStartupCacheMaintenance();
  createTray();
  nativeTheme.on('updated', () => {
    if (!tray || process.platform !== 'win32') return;
    try {
      if (currentTrayIcon === 'default') tray.setImage(getTrayIconFromApp());
    } catch (_) {}
  });
  setupIPC();
  setupAutoUpdater();
  registerGlobalHotkey();

  const installWarning = getInstallLocationWarning();
  if (installWarning) {
    showOneTimeDialog({ ...installWarning, type: 'warning' }, 'installWarningShown');
  }

  if (configMigrationNotice) {
    showOneTimeDialog(configMigrationNotice, 'migrationNoticeShown');
  }

  // Auto-check for updates shortly after launch (installed NSIS/dmg builds only)
  if (isPackaged && !isRunningFromDmg() && !isPortableBuild() && config.autoCheckUpdates !== false) {
    setImmediate(() => checkForUpdates(false, true));
  }

  if (canRegisterInstall()) {
    setImmediate(() => maybeRegisterInstall());
  }

  scheduleInitialRpcConnect();
});

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) showMainWindow();
    else createWindow();
  });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) showMainWindow();
  else createWindow();
});
app.on('before-quit', async () => {
  markAppQuitting();
  globalShortcut.unregisterAll();
  if (trayMenuRefreshTimer) {
    clearTimeout(trayMenuRefreshTimer);
    trayMenuRefreshTimer = null;
  }
  if (musicSync) await musicSync.stop();
  await persistAllUserData();
  if (rpcClient) { try { await rpcClient.destroy(); } catch (_) {} }
});

// Security: block navigation and new windows
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (e, navigationUrl) => {
    if (navigationUrl !== contents.getURL()) e.preventDefault();
  });
  contents.on('will-attach-webview', (e) => e.preventDefault());
});

// Hide menu bar on every window (Windows shows File/Edit/View without this)
app.on('browser-window-created', (_, win) => {
  win.setMenu(null);
  win.setMenuBarVisibility(false);
  win.setTitle(APP_DISPLAY_NAME);
  if (!isDev) {
    win.webContents.on('before-input-event', (e, input) => {
      if (input.key && (input.control || input.meta) && input.shift && ['i', 'j', 'c'].includes(input.key.toLowerCase())) {
        e.preventDefault();
      }
    });
  }
});
