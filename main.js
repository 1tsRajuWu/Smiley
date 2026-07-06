const os = require('os');
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, globalShortcut, clipboard, screen, Notification, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pkg = require('./package.json');

function getRPC() {
  return require('discord-rpc');
}

function getAutoUpdater() {
  return require('electron-updater').autoUpdater;
}

if (app?.commandLine) {
  app.commandLine.appendSwitch('disable-background-timer-throttling');
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

// ─── Encryption (AES-256-GCM, no OS keychain) ──────────────────────
const CONFIG_CIPHER_SALT = 'smiley-salt-v1';

function getConfigCipherKey() {
  return crypto.scryptSync(app.getPath('userData'), CONFIG_CIPHER_SALT, 32);
}

function encryptConfig(plainObj) {
  try {
    const json = JSON.stringify(plainObj);
    const key = getConfigCipherKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(json, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return { v: 1, iv: iv.toString('base64'), data: encrypted, tag: cipher.getAuthTag().toString('base64') };
  } catch (e) {
    console.error('[encrypt]', e.message);
    return { v: 0, data: JSON.stringify(plainObj) };
  }
}

function decryptConfig(encryptedObj) {
  try {
    if (!encryptedObj || typeof encryptedObj.v !== 'number') {
      return encryptedObj || {};
    }
    if (encryptedObj.v === 2) {
      // Legacy OS keychain format — intentionally not migrated (avoids keychain prompt)
      return { __keychainMigration: true };
    }
    if (encryptedObj.v === 1) {
      const key = getConfigCipherKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encryptedObj.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(encryptedObj.tag, 'base64'));
      let decrypted = decipher.update(encryptedObj.data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    }
    return JSON.parse(encryptedObj.data || '{}');
  } catch (e) {
    console.error('[decrypt]', e.message);
    return {};
  }
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
  String(pkg.homepage || pkg.repository?.url || 'https://github.com/1tsRajuWu/Smiley')
    .replace(/\.git$/, '')
    .trim();
const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`;
// package.json mac.identity is "-" (ad-hoc). Squirrel ShipIt validates update signatures
// at install time — separate from electron-updater verifyUpdateCodeSignature (Windows).
const MAC_ADHOC_DISTRIBUTION = true;
const DEFAULT_RPC_BUTTONS = [
  { label: 'Download Smiley', url: GITHUB_RELEASES_URL },
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
  'theme', 'showTimer', 'animationsEnabled', 'customAnimation', 'customWallpaper',
  'windowState', 'autoConnect', 'minimizeToTray', 'launchAtLogin', 'hotkeyEnabled',
  'autoCheckUpdates', 'autoInstallUpdates', 'recentActivities', 'favoriteActivities',
  'customActivities', 'activityGifChoice', 'migrationNoticeShown', 'installWarningShown',
]);
const MAX_COPY_TEXT_LEN = 2000;
const MAX_IMPORT_BYTES = 512 * 1024;

const DEFAULT_CONFIG = {
  donationUrl: DONATION_URL,
  theme: 'dark',
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
  recentActivities: [],
  favoriteActivities: [],
  customActivities: [],
  activityGifChoice: {},
  migrationNoticeShown: false,
  installWarningShown: false,
};
let config = { ...DEFAULT_CONFIG };
let configMigrationNotice = null;

function loadConfig() {
  const securePath = getUserDataPath('config.secure');
  const legacyPath = getUserDataPath('config.json');
  try {
    if (fs.existsSync(securePath)) {
      const raw = JSON.parse(fs.readFileSync(securePath, 'utf8'));
      const decrypted = decryptConfig(raw);
      if (decrypted?.__keychainMigration) {
        const noticeAlreadyShown = config.migrationNoticeShown === true;
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
      config = { ...DEFAULT_CONFIG, ...decrypted };
      delete config.clientId;
      return;
    }
    if (fs.existsSync(legacyPath)) {
      const old = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      config = { ...DEFAULT_CONFIG, ...old };
      delete config.clientId;
      fs.writeFileSync(securePath, JSON.stringify(encryptConfig(config), null, 2));
      try { fs.unlinkSync(legacyPath); } catch (_) {}
      return;
    }
    if (fs.existsSync(EXAMPLE_CONFIG)) {
      const example = JSON.parse(fs.readFileSync(EXAMPLE_CONFIG, 'utf8'));
      config = { ...DEFAULT_CONFIG, ...example };
      delete config.clientId;
      fs.writeFileSync(securePath, JSON.stringify(encryptConfig(config), null, 2));
      return;
    }
  } catch (err) {
    console.error('[loadConfig]', err.message);
  }
  config = { ...DEFAULT_CONFIG };
}

function getClientId() {
  return BUNDLED_CLIENT_ID;
}

function formatSessionDuration(ms) {
  if (!ms || ms < 0) return '0m';
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
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('config-changed', {
      recentActivities: recent,
      favoriteActivities: config.favoriteActivities || [],
      customActivities: config.customActivities || [],
    });
  }
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
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('config-changed', {
      recentActivities: config.recentActivities || [],
      favoriteActivities: favorites,
      customActivities: config.customActivities || [],
    });
  }
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
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
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

function saveConfig(data) {
  const { clientId: _c, donationUrl: _d, ...safeData } = data || {};
  const patch = sanitizeConfigPatch(safeData);
  config = { ...config, ...patch, donationUrl: DONATION_URL };
  try {
    const securePath = getUserDataPath('config.secure');
    fs.writeFileSync(securePath, JSON.stringify(encryptConfig(config), null, 2));
  } catch (e) {
    console.error('[saveConfig]', e.message);
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
        out[key] = val === true;
        break;
      case 'customAnimation':
      case 'customWallpaper':
        out[key] = typeof val === 'string' ? sanitizeFilename(val).slice(0, 100) : null;
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
  return {
    ...activity,
    id: typeof activity.id === 'string' ? activity.id.slice(0, 64) : undefined,
    details,
    state: sanitizeActivityText(activity.state),
    largeImageText: sanitizeActivityText(activity.largeImageText, 128) || details,
    discordImageUrl: typeof activity.discordImageUrl === 'string' ? activity.discordImageUrl.slice(0, 2048) : undefined,
    largeImageUrl: typeof activity.largeImageUrl === 'string' ? activity.largeImageUrl.slice(0, 2048) : undefined,
    fallbackGif: typeof activity.fallbackGif === 'string' ? activity.fallbackGif.slice(0, 2048) : undefined,
    category: typeof activity.category === 'string' ? activity.category.slice(0, 32) : undefined,
  };
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

// ─── Window State ────────────────────────────────────────────────────
const FIRST_SHOW_MARKER = '.first-window-shown';
const PORTABLE_INIT_MARKER = '.portable-initialized';

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
  const statePath = getUserDataPath('window-state.json');
  const portableFirstRun = isPortableBuild() && !fs.existsSync(getUserDataPath(PORTABLE_INIT_MARKER));
  let state;

  if (portableFirstRun) {
    state = { ...DEFAULT_CONFIG.windowState };
    try {
      fs.writeFileSync(getUserDataPath(PORTABLE_INIT_MARKER), new Date().toISOString());
    } catch (_) {}
  } else {
    try {
      if (fs.existsSync(statePath)) state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (_) {}
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
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function resetWindowPosition() {
  const state = normalizeWindowState({ ...DEFAULT_CONFIG.windowState });
  try {
    const statePath = getUserDataPath('window-state.json');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
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
  if (!tray || process.platform !== 'win32') return;
  const body = 'Smiley is running in the system tray. Double-click the tray icon to open.';
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

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getNormalBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: mainWindow.isMaximized(),
    };
    fs.writeFileSync(getUserDataPath('window-state.json'), JSON.stringify(state, null, 2));
    saveConfig({ windowState: { width: bounds.width, height: bounds.height } });
  } catch (_) {}
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
      // macOS: sandbox true breaks native file dialogs / tray in some Electron builds
      sandbox: process.platform !== 'darwin',
      allowRunningInsecureContent: false,
      webSecurity: true,
      experimentalFeatures: false,
    },
    title: APP_DISPLAY_NAME,
    icon: getAppIcon(),
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setTitle(APP_DISPLAY_NAME);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (state.maximized) mainWindow.maximize();
    if (shouldForceShowOnStartup() || !shouldStartInTrayOnly()) {
      showMainWindow();
      markFirstWindowShown();
    } else {
      notifyTrayOnlyStartup();
    }
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('close', (e) => {
    saveWindowState();
    if (config.minimizeToTray !== false && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());
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
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('select-activity', item.id);
      }
    },
  }));

  const template = [
    { label: 'Show Smiley', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: currentActivity ? `Status: ${currentActivity.details}` : 'No status set', enabled: false },
    { label: sessionLabel, enabled: false },
    { label: 'Clear Presence', click: () => clearPresence(), enabled: !!currentActivity },
    { type: 'separator' },
    ...(recentItems.length
      ? [{ label: 'Recent Activities', submenu: recentItems }, { type: 'separator' }]
      : []),
    { label: 'Check for Updates', click: () => checkForUpdates(true) },
    { label: 'Settings', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('open-settings'); } } },
    { type: 'separator' },
    { label: 'Donate', click: () => shell.openExternal(DONATION_URL) },
    { type: 'separator' },
    { label: `Version ${APP_VERSION}`, enabled: false },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
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
  rpcClient = new RPC.Client({ transport: 'ipc' });
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ connected: false, error: 'Discord not responding — is it open?' });
    }, 8000);
    rpcClient.once('ready', () => { clearTimeout(timeout); resolve({ connected: true }); });
    rpcClient.login({ clientId }).catch((err) => {
      clearTimeout(timeout);
      resolve({ connected: false, error: err.message || 'Could not connect to Discord' });
    });
  });
}

async function buildActivityPayload(activity) {
  const payload = {
    details: activity.details,
    state: activity.state || undefined,
    startTimestamp: sessionStart || Date.now(),
    instance: false,
  };

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
    const payload = await buildActivityPayload(activity);
    await rpcClient.setActivity(payload);
    currentActivity = activity;
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

async function schedulePresenceUpdate(activity, isNewSession) {
  const safeActivity = sanitizeIncomingActivity(activity);
  if (!safeActivity) return { success: false, error: 'Invalid activity' };
  if (isNewSession) sessionStart = Date.now();
  pendingUpdate = safeActivity;
  if (updateTimer) return { success: true, queued: true };

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
  }, 15000);

  return result || { success: true };
}

async function clearPresence() {
  pendingUpdate = null;
  if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }
  currentActivity = null;
  sessionStart = null;
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
  if (!mainWindow?.webContents) return;

  const send = () => {
    mainWindow.webContents.send('rpc-status', {
      connected: !!rpcClient,
      activity: currentActivity,
      sessionStart,
      donationUrl: DONATION_URL,
      settings: {
        theme: config.theme || 'dark',
        showTimer: config.showTimer !== false,
        animationsEnabled: config.animationsEnabled !== false,
        customAnimation: config.customAnimation || null,
        minimizeToTray: config.minimizeToTray !== false,
        autoConnect: config.autoConnect !== false,
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
  }, 1500);
}

// ─── Auto Updater ────────────────────────────────────────────────────
let pendingUpdateVersion = null;
let updateDownloaded = false;
let lastDownloadPercent = 0;
let downloadStallTimer = null;
let updaterListenersAttached = false;
let silentUpdateCheck = false;

function applyUpdaterSettings() {
  if (!isPackaged) return;
  try {
    const autoUpdater = getAutoUpdater();
    autoUpdater.autoDownload = true;
    // Ad-hoc macOS: ShipIt rejects in-app install on quit — manual DMG download instead
    if (process.platform === 'darwin' && MAC_ADHOC_DISTRIBUTION) {
      autoUpdater.autoInstallOnAppQuit = false;
    } else {
      autoUpdater.autoInstallOnAppQuit = config.autoInstallUpdates !== false;
    }
    autoUpdater.autoRunAppAfterInstall = false;
  } catch (_) {}
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
    if (!updateDownloaded && lastDownloadPercent > 0 && lastDownloadPercent < 100) {
      sendUpdateStatus({
        status: 'download-stalled',
        percent: lastDownloadPercent,
        error: 'Update download stalled. Try again later.',
      });
    }
  }, 60000);
}

function buildManualInstallPayload(version = pendingUpdateVersion) {
  const verLabel = version ? `v${version}` : 'the latest version';
  return {
    ok: false,
    status: 'manual-install-required',
    message: `Update couldn't install automatically. Download ${verLabel} from GitHub.`,
    version: version || null,
    releasesUrl: GITHUB_RELEASES_URL,
    expected: true,
  };
}

function isUpdateSignatureError(msg) {
  return (
    msg.includes('not signed') ||
    msg.includes('invalid_signature') ||
    msg.includes('signature verification') ||
    msg.includes('signed by the application owner') ||
    msg.includes('code signature') ||
    msg.includes('did not pass validation') ||
    msg.includes('code requirement') ||
    msg.includes('satisfy specified code requirement') ||
    msg.includes('shipit')
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
    error: err?.message || 'Update check failed. Download from GitHub Releases.',
    version: version || null,
    releasesUrl: GITHUB_RELEASES_URL,
    expected: false,
  };
}

function sendUpdateStatus(payload) {
  if (mainWindow?.webContents) mainWindow.webContents.send('update-status', payload);
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

  silentUpdateCheck = silent;

  if (manual) {
    sendUpdateStatus({ status: 'checking' });
    const waitPromise = waitForManualUpdateCheck();
    try {
      await getAutoUpdater().checkForUpdates();
      return await waitPromise;
    } catch (err) {
      silentUpdateCheck = false;
      console.error('[updater]', err.message);
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
    silentUpdateCheck = false;
    console.error('[updater]', err.message);
    const formatted = formatUpdateError(err);
    if (!silent) sendUpdateStatus(formatted);
    return formatted;
  }
}

function isUpdateReadyToInstall() {
  if (!isPackaged || !updateDownloaded || !pendingUpdateVersion) return false;
  const helper = getAutoUpdater().downloadedUpdateHelper;
  if (helper?.file || helper?.packageFile) return true;
  return false;
}

function installPendingUpdate() {
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
  try {
    app.isQuitting = true;
    // macOS: don't force-run after install — avoids Squirrel spawning a second copy
    const forceRunAfter = process.platform !== 'darwin';
    getAutoUpdater().quitAndInstall(false, forceRunAfter);
    return true;
  } catch (err) {
    console.error('[updater] quitAndInstall failed:', err.message);
    updateDownloaded = false;
    const formatted = formatUpdateError(err);
    sendUpdateStatus(formatted);
    return false;
  }
}

function setupAutoUpdater() {
  try {
    const autoUpdater = getAutoUpdater();
    applyUpdaterSettings();
    autoUpdater.allowPrerelease = false;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.logger = console;

    // Windows NSIS: skip publisher signature check (unsigned builds).
    // macOS Squirrel ShipIt validates separately at install — handled via friendly errors.
    if (process.platform === 'win32') {
      autoUpdater.verifyUpdateCodeSignature = async () => null;
    }

    if (!isPackaged || updaterListenersAttached) return;
    updaterListenersAttached = true;

    getAutoUpdater().on('checking-for-update', () => {
      sendUpdateStatus({ status: 'checking', silent: silentUpdateCheck });
    });

    getAutoUpdater().on('update-available', (info) => {
      silentUpdateCheck = false;
      pendingUpdateVersion = info.version;
      if (updateDownloaded && pendingUpdateVersion === info.version) {
        sendUpdateStatus({ status: 'downloaded', version: info.version, percent: 100 });
        resolveManualUpdate({ ok: true, status: 'downloaded', version: info.version });
        return;
      }
      updateDownloaded = false;
      lastDownloadPercent = 0;
      clearDownloadStallTimer();
      const payload = { status: 'available', version: info.version, percent: 0 };
      sendUpdateStatus(payload);
      resolveManualUpdate({ ok: true, status: 'available', version: info.version });
    });

    getAutoUpdater().on('update-not-available', (info) => {
      pendingUpdateVersion = null;
      updateDownloaded = false;
      lastDownloadPercent = 0;
      clearDownloadStallTimer();
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
      lastDownloadPercent = Math.min(99, Math.round(progress.percent || 0));
      resetDownloadStallTimer();
      sendUpdateStatus({
        status: 'downloading',
        percent: lastDownloadPercent,
        version: pendingUpdateVersion,
      });
    });

    getAutoUpdater().on('update-downloaded', (info) => {
      clearDownloadStallTimer();
      silentUpdateCheck = false;
      pendingUpdateVersion = info.version;
      updateDownloaded = true;
      lastDownloadPercent = 100;
      sendUpdateStatus({ status: 'downloaded', version: info.version, percent: 100 });
      resolveManualUpdate({ ok: true, status: 'downloaded', version: info.version });
    });

    getAutoUpdater().on('error', (err) => {
      console.error('[updater]', err.message);
      clearDownloadStallTimer();
      silentUpdateCheck = false;
      const failedVersion = pendingUpdateVersion;
      updateDownloaded = false;
      lastDownloadPercent = 0;
      const formatted = formatUpdateError(err, failedVersion);
      sendUpdateStatus(formatted);
      resolveManualUpdate(formatted);
    });
  } catch (err) {
    console.error('[updater] setup failed:', err.message);
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
  const destName = sanitizeFilename(`wallpaper-${hash}${ext}`);
  const destPath = path.join(dir, destName);
  try {
    fs.copyFileSync(sourcePath, destPath);
    return { valid: true, path: destPath, filename: destName };
  } catch {
    return { valid: false, error: 'Save failed' };
  }
}

function resolveWallpaperPath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const dir = getWallpapersDir();
  const safeName = sanitizeFilename(path.basename(filename));
  const filePath = path.resolve(path.join(dir, safeName));
  const resolvedDir = path.resolve(dir);
  if (!filePath.startsWith(resolvedDir + path.sep) && filePath !== resolvedDir) return null;
  if (!fs.existsSync(filePath)) return null;
  return filePath;
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
  const destName = sanitizeFilename(`custom-${hash}${ext}`);
  const destPath = path.join(dir, destName);
  try {
    fs.copyFileSync(sourcePath, destPath);
    // Keep last 10
    const files = fs.readdirSync(dir)
      .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime }))
      .sort((a, b) => b.time - a.time);
    if (files.length > 10) {
      files.slice(10).forEach(f => { try { fs.unlinkSync(path.join(dir, f.name)); } catch (_) {} });
    }
    return { valid: true, path: destPath, name: destName };
  } catch (err) { return { valid: false, error: 'Save failed' }; }
}

function getCustomAnimationsList() {
  const dir = getCustomAnimationsDir();
  try {
    return fs.readdirSync(dir)
      .filter(f => ALLOWED_EXTS.includes(path.extname(f).toLowerCase()))
      .map(f => ({ name: f, path: path.join(dir, f) }));
  } catch { return []; }
}

function imageToDataUrl(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
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
  const destName = sanitizeFilename(`activity-${hash}${ext}`);
  const destPath = path.join(dir, destName);
  try {
    fs.copyFileSync(sourcePath, destPath);
    const previewUrl = filePathToUrl(destPath);
    return { valid: true, path: destPath, name: destName, previewUrl };
  } catch {
    return { valid: false, error: 'Save failed' };
  }
}

function broadcastConfigChanged(extra = {}) {
  if (!mainWindow?.webContents) return;
  mainWindow.webContents.send('config-changed', {
    recentActivities: config.recentActivities || [],
    favoriteActivities: config.favoriteActivities || [],
    customActivities: config.customActivities || [],
    ...extra,
  });
}

// ─── IPC ─────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle('get-config', () => ({
    hasValidClientId: !!getClientId(),
    donationUrl: DONATION_URL,
    theme: config.theme || 'dark',
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
    recentActivities: config.recentActivities || [],
    favoriteActivities: config.favoriteActivities || [],
    customActivities: config.customActivities || [],
    customWallpaper: config.customWallpaper || null,
    isMac: process.platform === 'darwin',
    macAdHocUpdates: process.platform === 'darwin' && MAC_ADHOC_DISTRIBUTION,
    releasesUrl: GITHUB_RELEASES_URL,
    osPlatform: process.platform,
    version: APP_VERSION,
    platform: `${process.platform} ${os.release()}`,
  }));

  ipcMain.handle('toggle-favorite', (_, id) => {
    if (typeof id !== 'string' || !id.trim()) return config.favoriteActivities || [];
    return toggleFavoriteActivity(id.trim().slice(0, 64));
  });
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
    saveConfig(data);
    applyLaunchAtLogin();
    registerGlobalHotkey();
    applyUpdaterSettings();
    updateTrayMenu();
    if (config.autoConnect !== false && !rpcClient) return connectRPC();
    return { connected: !!rpcClient };
  });

  ipcMain.handle('connect-rpc', () => connectRPC());
  ipcMain.handle('set-activity', async (_, activity, isNewSession = true) =>
    schedulePresenceUpdate(activity, isNewSession)
  );
  ipcMain.handle('clear-activity', () => clearPresence());
  ipcMain.handle('get-status', () => ({ connected: !!rpcClient, activity: currentActivity, sessionStart }));

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

  ipcMain.handle('install-update', () => {
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
      .map(item => {
        const dataUrl = imageToDataUrl(item.path);
        return dataUrl ? { name: item.name, dataUrl } : null;
      })
      .filter(Boolean);
  });

  ipcMain.handle('delete-custom-animation', (_, name) => {
    if (typeof name !== 'string' || !name.trim()) return { success: false, error: 'Invalid name' };
    const dir = getCustomAnimationsDir();
    const safeName = sanitizeFilename(name.trim());
    const filePath = path.resolve(path.join(dir, safeName));
    const resolvedDir = path.resolve(dir);
    if (!filePath.startsWith(resolvedDir + path.sep) && filePath !== resolvedDir) {
      return { success: false, error: 'Invalid path' };
    }
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('get-custom-activities', () => config.customActivities || []);

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
      const safeName = sanitizeFilename(data.localFileName);
      const filePath = path.join(getCustomActivitiesDir(), safeName);
      const resolvedDir = path.resolve(getCustomActivitiesDir());
      const resolvedPath = path.resolve(filePath);
      if (resolvedPath.startsWith(resolvedDir + path.sep) && fs.existsSync(resolvedPath)) {
        localFileName = safeName;
        localGifPath = filePathToUrl(resolvedPath);
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
    return { success: true, activity: entry };
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
    const url = wallpaperPathToUrl(saveResult.path);
    if (!url) return { error: 'Could not read image' };
    return { success: true, filename: saveResult.filename, url };
  });

  ipcMain.handle('get-wallpaper-path', (_, filename) => {
    const filePath = resolveWallpaperPath(filename);
    const url = wallpaperPathToUrl(filePath);
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
  ipcMain.handle('close-window', () => {
    if (mainWindow) {
      if (config.minimizeToTray !== false) mainWindow.hide();
      else { app.isQuitting = true; app.quit(); }
    }
  });

  ipcMain.handle('export-settings', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Smiley Settings',
      defaultPath: 'smiley-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const exportData = { ...config };
    delete exportData.clientId;
    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2));
    return { success: true, path: result.filePath };
  });

  ipcMain.handle('reset-window-position', () => resetWindowPosition());

  ipcMain.handle('import-settings', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Smiley Settings',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try {
      const stat = fs.statSync(result.filePaths[0]);
      if (stat.size > MAX_IMPORT_BYTES) {
        return { success: false, error: 'Settings file too large' };
      }
      const imported = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
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
      return { success: false, error: err.message || 'Invalid settings file' };
    }
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  app.setName(APP_DISPLAY_NAME);
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.smiley.rpc');
  }
  Menu.setApplicationMenu(null);
  loadConfig();
  ensureDir(getUserDataPath('custom-animations'));
  ensureDir(getUserDataPath('custom-activities'));
  ensureDir(getUserDataPath('wallpapers'));
  applyLaunchAtLogin();
  createWindow();
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

  if (config.autoConnect !== false) {
    const result = await connectRPC();
    if (mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        broadcastStatus(true);
        mainWindow.webContents.send('initial-connect', result);
      });
    }
  } else if (mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      broadcastStatus(true);
      mainWindow.webContents.send('initial-connect', { connected: false, error: null });
    });
  }
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
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  saveWindowState();
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
