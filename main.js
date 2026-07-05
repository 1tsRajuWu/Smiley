const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const RPC = require('discord-rpc');
const { autoUpdater } = require('electron-updater');

// ─── Anti-debug / Anti-tamper ────────────────────────────────────────
const isDev = process.argv.includes('--dev');
const APP_VERSION = app.getVersion();
const CHECKSUM_SECRET = 'smiley-' + APP_VERSION;

function verifyIntegrity() {
  // Simple integrity check - ensure our core files haven't been tampered with
  try {
    const preloadPath = path.join(__dirname, 'preload.js');
    const mainPath = path.join(__dirname, 'main.js');
    const preloadStat = fs.statSync(preloadPath);
    const mainStat = fs.statSync(mainPath);
    // Files should exist and not be suspiciously small (tampered/empty)
    if (preloadStat.size < 500 || mainStat.size < 5000) {
      console.error('Integrity check failed: core files appear tampered');
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ─── Paths ───────────────────────────────────────────────────────────
const EXAMPLE_CONFIG = path.join(__dirname, 'config.example.json');
function getUserDataPath(...segments) {
  return path.join(app.getPath('userData'), ...segments);
}
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ─── Encryption ──────────────────────────────────────────────────────
function encryptConfig(plainObj) {
  try {
    const json = JSON.stringify(plainObj);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json);
      return { v: 2, data: encrypted.toString('base64') };
    }
    // Fallback: AES-256-GCM with app-specific key
    const key = crypto.scryptSync(app.getPath('userData').slice(-32), CHECKSUM_SECRET, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(json, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return { v: 1, iv: iv.toString('base64'), data: encrypted, tag: authTag.toString('base64') };
  } catch (e) {
    console.error('Encrypt failed:', e.message);
    return { v: 0, data: json };
  }
}

function decryptConfig(encryptedObj) {
  try {
    if (!encryptedObj || encryptedObj.v === undefined) {
      // Legacy plain JSON
      return encryptedObj || {};
    }
    if (encryptedObj.v === 2 && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encryptedObj.data, 'base64');
      const decrypted = safeStorage.decryptString(buffer);
      return JSON.parse(decrypted);
    }
    if (encryptedObj.v === 1) {
      const key = crypto.scryptSync(app.getPath('userData').slice(-32), CHECKSUM_SECRET, 32);
      const iv = Buffer.from(encryptedObj.iv, 'base64');
      const tag = Buffer.from(encryptedObj.tag, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encryptedObj.data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    }
    return encryptedObj.data ? JSON.parse(encryptedObj.data) : {};
  } catch (e) {
    console.error('Decrypt failed:', e.message);
    return {};
  }
}

// ─── Config ──────────────────────────────────────────────────────────
function loadConfig() {
  const configPath = getUserDataPath('config.secure');
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return decryptConfig(raw);
    }
    // Migrate from old plain config
    const oldPath = getUserDataPath('config.json');
    if (fs.existsSync(oldPath)) {
      const old = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
      saveConfig(old);
      try { fs.unlinkSync(oldPath); } catch (_) {}
      return old;
    }
    if (fs.existsSync(EXAMPLE_CONFIG)) {
      const example = JSON.parse(fs.readFileSync(EXAMPLE_CONFIG, 'utf8'));
      saveConfig(example);
      return example;
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return {
    clientId: '',
    donationUrl: 'https://paypal.me/1tsRaj',
    theme: 'dark',
    showTimer: true,
    animationsEnabled: true,
    customAnimation: null,
    windowState: { width: 1100, height: 780 },
    autoConnect: true,
    minimizeToTray: true,
  };
}

function saveConfig(data) {
  config = { ...config, ...data };
  const configPath = getUserDataPath('config.secure');
  const encrypted = encryptConfig(config);
  fs.writeFileSync(configPath, JSON.stringify(encrypted, null, 2));
}

// ─── State ───────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let rpcClient = null;
let config = null;
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
  return config?.windowState || { width: 1100, height: 780 };
}

function saveWindowState() {
  if (!mainWindow) return;
  const bounds = mainWindow.getNormalBounds();
  const state = {
    width: bounds.width, height: bounds.height,
    x: bounds.x, y: bounds.y,
    maximized: mainWindow.isMaximized(),
  };
  try {
    fs.writeFileSync(getUserDataPath('window-state.json'), JSON.stringify(state, null, 2));
    saveConfig({ windowState: { width: bounds.width, height: bounds.height } });
  } catch (_) {}
}

// ─── Icons ───────────────────────────────────────────────────────────
function generateActivityIcon(type) {
  const colors = { food: '#f7768e', gaming: '#7aa2f7', chill: '#9ece6a', work: '#bb9af7', social: '#ff9e64', default: '#7aa2f7' };
  const color = colors[type] || colors.default;
  const size = 64;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="14" fill="#1a1b26"/>
    <circle cx="32" cy="32" r="22" fill="${color}"/>
    <circle cx="26" cy="28" r="5" fill="#1a1b26"/><circle cx="38" cy="28" r="5" fill="#1a1b26"/>
    <ellipse cx="32" cy="40" rx="6" ry="4" fill="#1a1b26"/>
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg)).resize({ width: 16, height: 16 });
}

function getDefaultTrayIcon() {
  const size = 64;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="14" fill="#1a1b26"/>
    <circle cx="32" cy="32" r="22" fill="#7aa2f7"/>
    <circle cx="25" cy="28" r="5" fill="#1a1b26"/><circle cx="39" cy="28" r="5" fill="#1a1b26"/>
    <path d="M22 38 Q32 48 42 38" stroke="#1a1b26" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg)).resize({ width: 16, height: 16 });
}

// ─── Window ──────────────────────────────────────────────────────────
function createWindow() {
  const state = getWindowState();
  mainWindow = new BrowserWindow({
    width: state.width || 1100,
    height: state.height || 780,
    minWidth: 900, minHeight: 650,
    x: state.x, y: state.y,
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
    icon: getDefaultTrayIcon(),
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (state.maximized) mainWindow.maximize();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('close', (e) => {
    saveWindowState();
    if (config?.minimizeToTray !== false && !app.isQuitting) {
      e.preventDefault(); mainWindow.hide();
    }
  });

  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());
}

// ─── Tray ────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(getDefaultTrayIcon());
  tray.setToolTip('Smiley — Discord Rich Presence');
  updateTrayMenu();
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

function updateTrayMenu() {
  const template = [
    { label: 'Show Smiley', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: currentActivity ? `Status: ${currentActivity.details}` : 'No status set', enabled: false },
    { label: 'Clear Presence', click: () => clearPresence(), enabled: !!currentActivity },
    { type: 'separator' },
    { label: 'Check for Updates', click: () => autoUpdater.checkForUpdatesAndNotify() },
    { label: 'Settings', click: () => { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('open-settings'); } },
    { type: 'separator' },
    { label: 'Donate', click: () => shell.openExternal(config?.donationUrl || 'https://paypal.me/1tsRaj') },
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
  try { tray.setImage(generateActivityIcon(type)); } catch (err) {}
}

// ─── Discord RPC ─────────────────────────────────────────────────────
async function connectRPC() {
  if (!config?.clientId || config.clientId === 'YOUR_DISCORD_APPLICATION_CLIENT_ID') {
    return { connected: false, error: 'Set your Client ID in Settings' };
  }
  if (rpcClient) {
    try { await rpcClient.destroy(); } catch (_) {}
    rpcClient = null;
  }
  RPC.register(config.clientId);
  rpcClient = new RPC.Client({ transport: 'ipc' });
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ connected: false, error: 'Discord not responding — is it open?' });
    }, 8000);
    rpcClient.on('ready', () => { clearTimeout(timeout); resolve({ connected: true }); });
    rpcClient.login({ clientId: config.clientId }).catch((err) => {
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
  if (activity.largeImageKey) {
    payload.largeImageKey = activity.largeImageKey;
    payload.largeImageText = activity.largeImageText || activity.details;
  }
  if (activity.smallImageKey) {
    payload.smallImageKey = activity.smallImageKey;
    payload.smallImageText = activity.smallImageText || 'Smiley';
  }
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
    updateTrayIcon(activity.category);
    updateTrayMenu();
    broadcastStatus();
    return { success: true };
  } catch (err) {
    rpcClient = null;
    return { success: false, error: err.message || 'Failed to set presence' };
  }
}

function schedulePresenceUpdate(activity, isNewSession) {
  if (isNewSession) sessionStart = Date.now();
  pendingUpdate = activity;
  if (updateTimer) return { success: true, queued: true };
  const run = async () => {
    const toApply = pendingUpdate;
    pendingUpdate = null; updateTimer = null;
    if (toApply) await applyPresence(toApply);
  };
  run();
  updateTimer = setTimeout(() => { updateTimer = null; if (pendingUpdate) run(); }, 15000);
  return { success: true };
}

async function clearPresence() {
  pendingUpdate = null;
  if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }
  currentActivity = null; sessionStart = null;
  updateTrayIcon('default'); updateTrayMenu();
  if (rpcClient) {
    try { await rpcClient.clearActivity(); } catch (_) {}
  }
  broadcastStatus();
  return { success: true };
}

function broadcastStatus() {
  if (!mainWindow?.webContents) return;
  mainWindow.webContents.send('rpc-status', {
    connected: !!rpcClient, activity: currentActivity, sessionStart,
    clientId: config?.clientId, donationUrl: config?.donationUrl,
    settings: getSanitizedConfig(), version: APP_VERSION,
  });
}

function getSanitizedConfig() {
  return {
    theme: config?.theme || 'dark',
    showTimer: config?.showTimer !== false,
    animationsEnabled: config?.animationsEnabled !== false,
    customAnimation: config?.customAnimation || null,
    minimizeToTray: config?.minimizeToTray !== false,
    autoConnect: config?.autoConnect !== false,
    donationUrl: config?.donationUrl || 'https://paypal.me/1tsRaj',
  };
}

// ─── Auto Updater ────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloading', percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version });
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Smiley v${info.version} has been downloaded.`,
      detail: 'The update will be installed when you quit the app.',
      buttons: ['Restart Now', 'Later'],
    }).then(({ response }) => {
      if (response === 0) {
        app.isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    if (mainWindow) mainWindow.webContents.send('update-status', { status: 'error', error: err.message });
  });
}

// ─── Custom Animations ───────────────────────────────────────────────
const ALLOWED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const MAX_CUSTOM_IMAGE_SIZE = 5 * 1024 * 1024;

function getCustomAnimationsDir() {
  const dir = getUserDataPath('custom-animations');
  ensureDir(dir);
  return dir;
}

function validateImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.includes(ext)) return { valid: false, error: `Only ${ALLOWED_IMAGE_EXTS.join(', ')} files allowed` };
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_CUSTOM_IMAGE_SIZE) return { valid: false, error: 'File too large (max 5MB)' };
  } catch (err) { return { valid: false, error: 'Cannot read file' }; }
  return { valid: true };
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

async function saveCustomAnimation(sourcePath) {
  const validation = validateImageFile(sourcePath);
  if (!validation.valid) return validation;
  const dir = getCustomAnimationsDir();
  const hash = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
  const ext = path.extname(sourcePath).toLowerCase();
  const destName = sanitizeFilename(`custom-${hash}${ext}`);
  const destPath = path.join(dir, destName);
  try {
    fs.copyFileSync(sourcePath, destPath);
    const files = fs.readdirSync(dir).map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime })).sort((a, b) => b.time - a.time);
    if (files.length > 10) files.slice(10).forEach(f => { try { fs.unlinkSync(path.join(dir, f.name)); } catch (_) {} });
    return { valid: true, path: destPath, name: destName };
  } catch (err) { return { valid: false, error: 'Failed to save file' }; }
}

function getCustomAnimationsList() {
  const dir = getCustomAnimationsDir();
  try {
    return fs.readdirSync(dir)
      .filter(f => ALLOWED_IMAGE_EXTS.includes(path.extname(f).toLowerCase()))
      .map(f => ({ name: f, path: path.join(dir, f), url: `smiley-custom://${f}` }));
  } catch (_) { return []; }
}

// ─── IPC ─────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle('get-config', () => ({
    clientId: config?.clientId || '',
    donationUrl: config?.donationUrl || 'https://paypal.me/1tsRaj',
    hasValidClientId: config?.clientId && config.clientId !== 'YOUR_DISCORD_APPLICATION_CLIENT_ID',
    ...getSanitizedConfig(),
    version: APP_VERSION,
  }));

  ipcMain.handle('save-config', async (_, data) => {
    if (data.clientId !== undefined && data.clientId && !/^\d+$/.test(data.clientId)) {
      return { connected: false, error: 'Client ID must be numeric' };
    }
    saveConfig(data);
    if (data.clientId !== undefined && rpcClient) {
      try { await rpcClient.destroy(); } catch (_) {}
      rpcClient = null;
    }
    if (data.clientId !== undefined) return connectRPC();
    return { connected: !!rpcClient };
  });

  ipcMain.handle('connect-rpc', () => connectRPC());
  ipcMain.handle('set-activity', (_, activity, isNewSession = true) => schedulePresenceUpdate(activity, isNewSession));
  ipcMain.handle('clear-activity', () => clearPresence());
  ipcMain.handle('get-status', () => ({ connected: !!rpcClient, activity: currentActivity, sessionStart }));

  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdatesAndNotify();
    return { checking: true };
  });

  ipcMain.handle('pick-custom-animation', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Custom Animation',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
        { name: 'GIF Animation', extensions: ['gif'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const saveResult = await saveCustomAnimation(result.filePaths[0]);
    if (!saveResult.valid) return { error: saveResult.error };
    const buffer = fs.readFileSync(saveResult.path);
    const ext = path.extname(saveResult.path).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/png';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    return { success: true, name: saveResult.name, dataUrl, path: saveResult.path };
  });

  ipcMain.handle('get-custom-animations', () => {
    const list = getCustomAnimationsList();
    return list.map(item => {
      try {
        const buffer = fs.readFileSync(item.path);
        const ext = path.extname(item.path).toLowerCase();
        const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/png';
        return { name: item.name, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
      } catch (_) { return null; }
    }).filter(Boolean);
  });

  ipcMain.handle('delete-custom-animation', (_, name) => {
    const dir = getCustomAnimationsDir();
    const safeName = sanitizeFilename(name);
    const filePath = path.join(dir, safeName);
    if (!filePath.startsWith(dir)) return { success: false, error: 'Invalid path' };
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('open-external', (_, url) => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return { success: false, error: 'Invalid URL protocol' };
      shell.openExternal(url);
      return { success: true };
    } catch (_) { return { success: false, error: 'Invalid URL' }; }
  });

  ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.handle('close-window', () => {
    if (mainWindow) {
      if (config?.minimizeToTray !== false) mainWindow.hide();
      else { app.isQuitting = true; app.quit(); }
    }
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (!verifyIntegrity() && !isDev) {
    dialog.showErrorBox('Integrity Error', 'Smiley appears to have been tampered with. Please reinstall.');
    app.quit();
    return;
  }

  config = loadConfig();
  ensureDir(getUserDataPath('custom-animations'));
  createWindow();
  createTray();
  setupIPC();
  setupAutoUpdater();

  // Check for updates on launch (not in dev)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 5000);
  }

  if (config?.autoConnect !== false) {
    const result = await connectRPC();
    if (mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        broadcastStatus();
        mainWindow.webContents.send('initial-connect', result);
      });
    }
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow) mainWindow.show(); else createWindow(); });
app.on('before-quit', async () => {
  app.isQuitting = true;
  saveWindowState();
  if (rpcClient) { try { await rpcClient.destroy(); } catch (_) {} }
});

// Security: prevent new window creation & navigation
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (e, url) => { e.preventDefault(); shell.openExternal(url); });
  contents.on('will-navigate', (e, url) => { if (url !== contents.getURL()) { e.preventDefault(); shell.openExternal(url); } });
});

// Block DevTools in production
app.on('browser-window-created', (_, win) => {
  if (!isDev) {
    win.webContents.on('before-input-event', (e, input) => {
      if ((input.control || input.meta) && input.shift && ['i', 'j', 'c'].includes(input.key.toLowerCase())) {
        e.preventDefault();
      }
    });
  }
});
