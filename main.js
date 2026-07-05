const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const RPC = require('discord-rpc');
const { autoUpdater } = require('electron-updater');

// ─── Constants ───────────────────────────────────────────────────────
const isDev = process.argv.includes('--dev');
const APP_VERSION = '2.0.0';
const EXAMPLE_CONFIG = path.join(__dirname, 'config.example.json');

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
const DEFAULT_CONFIG = {
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

let config = { ...DEFAULT_CONFIG };

function loadConfig() {
  const securePath = getUserDataPath('config.secure');
  const legacyPath = getUserDataPath('config.json');
  try {
    if (fs.existsSync(securePath)) {
      const raw = JSON.parse(fs.readFileSync(securePath, 'utf8'));
      const decrypted = decryptConfig(raw);
      config = { ...DEFAULT_CONFIG, ...decrypted };
      return;
    }
    if (fs.existsSync(legacyPath)) {
      const old = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      config = { ...DEFAULT_CONFIG, ...old };
      fs.writeFileSync(securePath, JSON.stringify(encryptConfig(config), null, 2));
      try { fs.unlinkSync(legacyPath); } catch (_) {}
      return;
    }
    if (fs.existsSync(EXAMPLE_CONFIG)) {
      const example = JSON.parse(fs.readFileSync(EXAMPLE_CONFIG, 'utf8'));
      config = { ...DEFAULT_CONFIG, ...example };
      fs.writeFileSync(securePath, JSON.stringify(encryptConfig(config), null, 2));
      return;
    }
  } catch (err) {
    console.error('[loadConfig]', err.message);
  }
  config = { ...DEFAULT_CONFIG };
}

function saveConfig(data) {
  config = { ...config, ...data };
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
  tray = new Tray(getDefaultTrayIcon());
  tray.setToolTip('Smiley — Discord Rich Presence');
  updateTrayMenu();
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const template = [
    { label: 'Show Smiley', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: currentActivity ? `Status: ${currentActivity.details}` : 'No status set', enabled: false },
    { label: 'Clear Presence', click: () => clearPresence(), enabled: !!currentActivity },
    { type: 'separator' },
    { label: 'Check for Updates', click: () => autoUpdater.checkForUpdatesAndNotify() },
    { label: 'Settings', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('open-settings'); } } },
    { type: 'separator' },
    { label: 'Donate', click: () => shell.openExternal(config.donationUrl || 'https://paypal.me/1tsRaj') },
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
  if (!config.clientId || config.clientId === 'YOUR_DISCORD_APPLICATION_CLIENT_ID') {
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
    rpcClient.once('ready', () => { clearTimeout(timeout); resolve({ connected: true }); });
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
    pendingUpdate = null;
    updateTimer = null;
    if (toApply) await applyPresence(toApply);
  };

  run();
  updateTimer = setTimeout(() => {
    updateTimer = null;
    if (pendingUpdate) run();
  }, 15000);

  return { success: true };
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
    clientId: config.clientId,
    donationUrl: config.donationUrl,
    settings: {
      theme: config.theme || 'dark',
      showTimer: config.showTimer !== false,
      animationsEnabled: config.animationsEnabled !== false,
      customAnimation: config.customAnimation || null,
      minimizeToTray: config.minimizeToTray !== false,
      autoConnect: config.autoConnect !== false,
      donationUrl: config.donationUrl || 'https://paypal.me/1tsRaj',
    },
    version: APP_VERSION,
  });
}

// ─── Auto Updater ────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    if (mainWindow?.webContents) mainWindow.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow?.webContents) mainWindow.webContents.send('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow?.webContents) mainWindow.webContents.send('update-status', { status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow?.webContents) mainWindow.webContents.send('update-status', { status: 'downloading', percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow?.webContents) mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version });
    if (mainWindow) {
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
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message);
    if (mainWindow?.webContents) mainWindow.webContents.send('update-status', { status: 'error', error: err.message });
  });
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
    clientId: config.clientId || '',
    donationUrl: config.donationUrl || 'https://paypal.me/1tsRaj',
    hasValidClientId: !!(config.clientId && config.clientId !== 'YOUR_DISCORD_APPLICATION_CLIENT_ID'),
    theme: config.theme || 'dark',
    showTimer: config.showTimer !== false,
    animationsEnabled: config.animationsEnabled !== false,
    customAnimation: config.customAnimation || null,
    minimizeToTray: config.minimizeToTray !== false,
    autoConnect: config.autoConnect !== false,
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
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    return { checking: true };
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
}

// ─── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  loadConfig();
  ensureDir(getUserDataPath('custom-animations'));
  createWindow();
  createTray();
  setupIPC();
  setupAutoUpdater();

  // Check for updates after 5s (skip in dev)
  if (!isDev) {
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 5000);
  }

  if (config.autoConnect !== false) {
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
