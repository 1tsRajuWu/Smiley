const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, safeStorage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const RPC = require('discord-rpc');
const { autoUpdater } = require('electron-updater');
const pkg = require('./package.json');

// ─── Constants ───────────────────────────────────────────────────────
const isDev = process.argv.includes('--dev');
const isPackaged = app.isPackaged;
const APP_VERSION = pkg.version;
const GLOBAL_HOTKEY = 'CommandOrControl+Shift+S';
const EXAMPLE_CONFIG = path.join(__dirname, 'config.example.json');
const DISCORD_APP_CONFIG = path.join(__dirname, 'discord.app.json');

function getUserDataPath(...segments) {
  return path.join(app.getPath('userData'), ...segments);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ─── Encryption (OS-level safeStorage + AES fallback) ────────────────
function encryptConfig(plainObj) {
  try {
    const json = JSON.stringify(plainObj);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json);
      return { v: 2, data: encrypted.toString('base64') };
    }
    // AES-256-GCM fallback
    const key = crypto.scryptSync(app.getPath('userData'), 'smiley-salt-v1', 32);
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
      // Legacy plain JSON
      return encryptedObj || {};
    }
    if (encryptedObj.v === 2 && safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(encryptedObj.data, 'base64'));
      return JSON.parse(decrypted);
    }
    if (encryptedObj.v === 1) {
      const key = crypto.scryptSync(app.getPath('userData'), 'smiley-salt-v1', 32);
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
const DEFAULT_CONFIG = {
  donationUrl: DONATION_URL,
  theme: 'dark',
  showTimer: true,
  animationsEnabled: true,
  customAnimation: null,
  windowState: { width: 1100, height: 780 },
  autoConnect: true,
  minimizeToTray: true,
  launchAtLogin: false,
  hotkeyEnabled: true,
  recentActivities: [],
};
let config = { ...DEFAULT_CONFIG };

function loadConfig() {
  const securePath = getUserDataPath('config.secure');
  const legacyPath = getUserDataPath('config.json');
  try {
    if (fs.existsSync(securePath)) {
      const raw = JSON.parse(fs.readFileSync(securePath, 'utf8'));
      const decrypted = decryptConfig(raw);
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

function saveConfig(data) {
  const { clientId: _c, donationUrl: _d, ...safeData } = data || {};
  config = { ...config, ...safeData, donationUrl: DONATION_URL };
  try {
    const securePath = getUserDataPath('config.secure');
    fs.writeFileSync(securePath, JSON.stringify(encryptConfig(config), null, 2));
  } catch (e) {
    console.error('[saveConfig]', e.message);
  }
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
function getWindowState() {
  try {
    const statePath = getUserDataPath('window-state.json');
    if (fs.existsSync(statePath)) return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (_) {}
  return config.windowState || { width: 1100, height: 780 };
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
function generateTrayIcon(color) {
  const size = 64;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="14" fill="#1a1b26"/>
    <circle cx="32" cy="32" r="22" fill="${color}"/>
    <circle cx="26" cy="28" r="5" fill="#1a1b26"/><circle cx="38" cy="28" r="5" fill="#1a1b26"/>
    <ellipse cx="32" cy="40" rx="6" ry="4" fill="#1a1b26"/>
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg)).resize({ width: 16, height: 16 });
}

const TRAY_COLORS = {
  food: '#f7768e', gaming: '#7aa2f7', chill: '#9ece6a',
  work: '#bb9af7', social: '#ff9e64', default: '#7aa2f7',
};

function getDefaultTrayIcon() {
  return generateTrayIcon(TRAY_COLORS.default);
}

function getAppIcon() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  }
  return getDefaultTrayIcon();
}

// ─── Window ──────────────────────────────────────────────────────────
function createWindow() {
  const state = getWindowState();
  mainWindow = new BrowserWindow({
    width: state.width || 1100,
    height: state.height || 780,
    minWidth: 900,
    minHeight: 650,
    x: state.x,
    y: state.y,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1a1b26',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      allowRunningInsecureContent: false,
      webSecurity: true,
      experimentalFeatures: false,
    },
    icon: getAppIcon(),
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (state.maximized) mainWindow.maximize();
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
}

// ─── Tray ────────────────────────────────────────────────────────────
function createTray() {
  const icon = getAppIcon().resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Smiley — Discord Rich Presence');
  updateTrayMenu();
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
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
  try { tray.setImage(generateTrayIcon(TRAY_COLORS[type] || TRAY_COLORS.default)); } catch (_) {}
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

function buildActivityPayload(activity) {
  const payload = {
    details: activity.details,
    state: activity.state || undefined,
    startTimestamp: sessionStart || Date.now(),
    instance: false,
  };

  // Discord shows the app/bot logo when the image key is missing or invalid.
  // Always use a direct HTTPS GIF URL for the large image (animated on Discord).
  const imageUrl =
    activity.largeImageUrl ||
    activity.discordImageUrl ||
    (activity.largeImageKey && /^https?:\/\//i.test(activity.largeImageKey) ? activity.largeImageKey : null) ||
    activity.fallbackGif;

  if (imageUrl) {
    payload.largeImageKey = imageUrl;
    payload.largeImageText = activity.largeImageText || activity.details;
    if (isDev) console.log('[RPC] large_image:', imageUrl);
  } else if (isDev) {
    console.warn('[RPC] no image URL for activity', activity.details);
  }

  // No small_image — invalid asset keys show the bot logo as an overlay
  if (activity.buttons?.length) payload.buttons = activity.buttons.slice(0, 2);
  return payload;
}

async function applyPresence(activity) {
  if (!rpcClient) {
    const result = await connectRPC();
    if (!result.connected) return result;
  }
  try {
    const payload = buildActivityPayload(activity);
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
  if (isNewSession) sessionStart = Date.now();
  pendingUpdate = activity;
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

function broadcastStatus() {
  if (!mainWindow?.webContents) return;
  mainWindow.webContents.send('rpc-status', {
    connected: !!rpcClient,
    activity: currentActivity,
    sessionStart,
    // clientId intentionally hidden from UI
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
}

// ─── Auto Updater ────────────────────────────────────────────────────
let pendingUpdateVersion = null;
let updaterListenersAttached = false;

function formatUpdateError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
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

async function checkForUpdates(manual = false) {
  if (!isPackaged) {
    const result = {
      ok: true,
      status: 'dev-mode',
      message: 'Updates only work in the installed app from GitHub Releases (not npm start).',
    };
    if (manual) sendUpdateStatus({ status: 'dev-mode', message: result.message });
    return result;
  }

  if (manual) {
    sendUpdateStatus({ status: 'checking' });
    const waitPromise = waitForManualUpdateCheck();
    try {
      await autoUpdater.checkForUpdates();
      return await waitPromise;
    } catch (err) {
      console.error('[updater]', err.message);
      const formatted = formatUpdateError(err);
      sendUpdateStatus(formatted);
      resolveManualUpdate(formatted);
      return formatted;
    }
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true, status: 'checking' };
  } catch (err) {
    console.error('[updater]', err.message);
    const formatted = formatUpdateError(err);
    sendUpdateStatus(formatted);
    return formatted;
  }
}

function installPendingUpdate() {
  if (!isPackaged || !pendingUpdateVersion) return false;
  app.isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
  return true;
}

function setupAutoUpdater() {
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.logger = console;

    if (!isPackaged || updaterListenersAttached) return;
    updaterListenersAttached = true;

    autoUpdater.on('checking-for-update', () => {
      sendUpdateStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      pendingUpdateVersion = info.version;
      const payload = { status: 'available', version: info.version };
      sendUpdateStatus(payload);
      resolveManualUpdate({ ok: true, status: 'available', version: info.version });
    });

    autoUpdater.on('update-not-available', (info) => {
      pendingUpdateVersion = null;
      const payload = {
        status: 'up-to-date',
        version: info?.version || APP_VERSION,
      };
      sendUpdateStatus(payload);
      resolveManualUpdate({ ok: true, status: 'up-to-date', version: payload.version });
    });

    autoUpdater.on('download-progress', (progress) => {
      sendUpdateStatus({
        status: 'downloading',
        percent: Math.round(progress.percent),
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      pendingUpdateVersion = info.version;
      sendUpdateStatus({ status: 'downloaded', version: info.version });
      if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Update Ready',
          message: `Smiley v${info.version} has been downloaded.`,
          detail: 'Restart now to install the update, or it will apply when you quit.',
          buttons: ['Restart Now', 'Later'],
          defaultId: 0,
        }).then(({ response }) => {
          if (response === 0) installPendingUpdate();
        });
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('[updater]', err.message);
      const formatted = formatUpdateError(err);
      sendUpdateStatus(formatted);
      resolveManualUpdate(formatted);
    });
  } catch (err) {
    console.error('[updater] setup failed:', err.message);
  }
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
    version: APP_VERSION,
  }));

  ipcMain.handle('save-config', async (_, data) => {
    saveConfig(data);
    applyLaunchAtLogin();
    registerGlobalHotkey();
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
    const started = installPendingUpdate();
    return { success: started };
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
    const dir = getCustomAnimationsDir();
    const safeName = sanitizeFilename(name);
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

  ipcMain.handle('open-external', (_, url) => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return { success: false, error: 'Invalid protocol' };
      shell.openExternal(url);
      return { success: true };
    } catch { return { success: false, error: 'Invalid URL' }; }
  });

  ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
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

  ipcMain.handle('import-settings', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Smiley Settings',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try {
      const imported = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
      delete imported.clientId;
      saveConfig(imported);
      applyLaunchAtLogin();
      registerGlobalHotkey();
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
  loadConfig();
  ensureDir(getUserDataPath('custom-animations'));
  applyLaunchAtLogin();
  createWindow();
  createTray();
  setupIPC();
  setupAutoUpdater();
  registerGlobalHotkey();

  // Check for updates after 5s (installed app only)
  if (isPackaged) {
    setTimeout(() => checkForUpdates(false), 5000);
  }

  if (config.autoConnect !== false) {
    const result = await connectRPC();
    if (mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        broadcastStatus();
        mainWindow.webContents.send('initial-connect', result);
      });
    }
  } else if (mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      broadcastStatus();
      mainWindow.webContents.send('initial-connect', { connected: false, error: null });
    });
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow) mainWindow.show(); else createWindow(); });
app.on('before-quit', async () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  saveWindowState();
  if (rpcClient) { try { await rpcClient.destroy(); } catch (_) {} }
});

// Security: block navigation and new windows
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (e, url) => { e.preventDefault(); shell.openExternal(url); });
  contents.on('will-navigate', (e, url) => { if (url !== contents.getURL()) { e.preventDefault(); shell.openExternal(url); } });
});

// Block DevTools shortcuts in production
app.on('browser-window-created', (_, win) => {
  if (!isDev) {
    win.webContents.on('before-input-event', (e, input) => {
      if (input.key && (input.control || input.meta) && input.shift && ['i', 'j', 'c'].includes(input.key.toLowerCase())) {
        e.preventDefault();
      }
    });
  }
});
