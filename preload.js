const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smiley', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (data) => ipcRenderer.invoke('save-config', data),
  connectRpc: () => ipcRenderer.invoke('connect-rpc'),
  setActivity: (activity, isNewSession) => ipcRenderer.invoke('set-activity', activity, isNewSession),
  clearActivity: () => ipcRenderer.invoke('clear-activity'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  pickCustomAnimation: () => ipcRenderer.invoke('pick-custom-animation'),
  getCustomAnimations: () => ipcRenderer.invoke('get-custom-animations'),
  deleteCustomAnimation: (name) => ipcRenderer.invoke('delete-custom-animation', name),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  exportSettings: () => ipcRenderer.invoke('export-settings'),
  importSettings: () => ipcRenderer.invoke('import-settings'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  onStatus: (callback) => ipcRenderer.on('rpc-status', (_, data) => callback(data)),
  onInitialConnect: (callback) => ipcRenderer.on('initial-connect', (_, data) => callback(data)),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', () => callback()),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, data) => callback(data)),
  onSelectActivity: (callback) => ipcRenderer.on('select-activity', (_, id) => callback(id)),
});
