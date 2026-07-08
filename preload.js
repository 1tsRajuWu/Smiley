// ═══════════════════════════════════════════════════════════════════════
// YOU ARE HERE: Preload bridge (renderer ↔ main)
// ─ Adds window.smiley.* — UI must use this, not require('electron')
// ─ Pair each method with ipcMain.handle in main.js
// ─ Project map: PROJECT-STRUCTURE.md │ Newbie tour: docs/CODE-TOUR.md
// ═══════════════════════════════════════════════════════════════════════
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smiley', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (data) => ipcRenderer.invoke('save-config', data),
  saveRiotApiKey: (key) => ipcRenderer.invoke('save-riot-api-key', key),
  flushConfig: () => ipcRenderer.invoke('flush-config'),
  connectRpc: () => ipcRenderer.invoke('connect-rpc'),
  setActivity: (activity, isNewSession) => ipcRenderer.invoke('set-activity', activity, isNewSession),
  clearActivity: () => ipcRenderer.invoke('clear-activity'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getLiveUiStatus: () => ipcRenderer.invoke('get-live-ui-status'),
  checkLiveUiPatch: () => ipcRenderer.invoke('check-live-ui-patch'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  downloadMacUpdate: (version) => ipcRenderer.invoke('download-mac-update', version),
  openMacUpdateDmg: (version) => ipcRenderer.invoke('open-mac-update-dmg', version),
  pickCustomAnimation: () => ipcRenderer.invoke('pick-custom-animation'),
  getCustomAnimations: () => ipcRenderer.invoke('get-custom-animations'),
  deleteCustomAnimation: (name) => ipcRenderer.invoke('delete-custom-animation', name),
  getCustomActivities: () => ipcRenderer.invoke('get-custom-activities'),
  saveCustomActivity: (data) => ipcRenderer.invoke('save-custom-activity', data),
  deleteCustomActivity: (id) => ipcRenderer.invoke('delete-custom-activity', id),
  pickCustomActivityGif: () => ipcRenderer.invoke('pick-custom-activity-gif'),
  resolveGifUrl: (url) => ipcRenderer.invoke('resolve-gif-url', url),
  pickWallpaper: () => ipcRenderer.invoke('pick-wallpaper'),
  getWallpaperPath: (filename) => ipcRenderer.invoke('get-wallpaper-path', filename),
  deleteWallpaper: (filename) => ipcRenderer.invoke('delete-wallpaper', filename),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  resolveCustomActivityPreview: (localFileName) =>
    ipcRenderer.invoke('resolve-custom-activity-preview', localFileName),
  importSettings: (opts) => ipcRenderer.invoke('import-settings', opts),
  exportSettings: (opts) => ipcRenderer.invoke('export-settings', opts),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  pausePresence: () => ipcRenderer.invoke('pause-presence'),
  resumePresence: () => ipcRenderer.invoke('resume-presence'),
  getPresencePaused: () => ipcRenderer.invoke('get-presence-paused'),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  isWindowVisible: () => ipcRenderer.invoke('is-window-visible'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  saveInstallConsent: () => ipcRenderer.invoke('save-install-consent'),
  resetWindowPosition: () => ipcRenderer.invoke('reset-window-position'),
  getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  onStatus: (callback) => {
    ipcRenderer.removeAllListeners('rpc-status');
    ipcRenderer.on('rpc-status', (_, data) => callback(data));
  },
  onInitialConnect: (callback) => {
    ipcRenderer.removeAllListeners('initial-connect');
    ipcRenderer.on('initial-connect', (_, data) => callback(data));
  },
  onOpenSettings: (callback) => {
    ipcRenderer.removeAllListeners('open-settings');
    ipcRenderer.on('open-settings', () => callback());
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.removeAllListeners('update-status');
    ipcRenderer.on('update-status', (_, data) => callback(data));
  },
  onSelectActivity: (callback) => {
    ipcRenderer.removeAllListeners('select-activity');
    ipcRenderer.on('select-activity', (_, id) => callback(id));
  },
  onApplyProfile: (callback) => {
    ipcRenderer.removeAllListeners('apply-profile');
    ipcRenderer.on('apply-profile', (_, id) => callback(id));
  },
  onPresencePaused: (callback) => {
    ipcRenderer.removeAllListeners('presence-paused');
    ipcRenderer.on('presence-paused', () => callback());
  },
  onConfigChanged: (callback) => {
    ipcRenderer.removeAllListeners('config-changed');
    ipcRenderer.on('config-changed', (_, data) => callback(data));
  },
  onWindowMaximized: (callback) => {
    ipcRenderer.removeAllListeners('window-maximized');
    ipcRenderer.on('window-maximized', (_, isMaximized) => callback(isMaximized));
  },
  onWindowVisibility: (callback) => {
    ipcRenderer.removeAllListeners('window-visibility');
    ipcRenderer.on('window-visibility', (_, visible) => callback(visible));
  },
  onNowPlayingUpdate: (callback) => {
    ipcRenderer.removeAllListeners('now-playing-update');
    ipcRenderer.on('now-playing-update', (_, track) => callback(track));
  },
  onGamingUpdate: (callback) => {
    ipcRenderer.removeAllListeners('gaming-update');
    ipcRenderer.on('gaming-update', (_, session) => callback(session));
  },
  onCodingUpdate: (callback) => {
    ipcRenderer.removeAllListeners('coding-update');
    ipcRenderer.on('coding-update', (_, session) => callback(session));
  },
});
