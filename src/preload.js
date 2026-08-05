const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dsAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),
  saveUsageToken: (token) => ipcRenderer.invoke('save-usage-token', token),
  clearApiKey: () => ipcRenderer.invoke('clear-api-key'),
  clearUsageToken: () => ipcRenderer.invoke('clear-usage-token'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  saveRefreshOptions: (options) => ipcRenderer.invoke('save-refresh-options', options),
  saveBudgetOptions: (options) => ipcRenderer.invoke('save-budget-options', options),
  verifyApiKey: (key) => ipcRenderer.invoke('verify-api-key', key),
  fetchBalance: () => ipcRenderer.invoke('fetch-balance'),
  fetchModels: () => ipcRenderer.invoke('fetch-models'),
  fetchUsage: (params) => ipcRenderer.invoke('fetch-usage', params),
  openBrowserLogin: () => ipcRenderer.invoke('open-browser-login'),
  startUsageSync: () => ipcRenderer.invoke('start-usage-sync'),
  addAccount: (name) => ipcRenderer.invoke('add-account', name),
  deleteAccount: (id) => ipcRenderer.invoke('delete-account', id),
  setActiveAccount: (id) => ipcRenderer.invoke('set-active-account', id),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUsageTokenCaptured: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('usage-token-captured', handler);
    return () => ipcRenderer.removeListener('usage-token-captured', handler);
  },
  onUsageSyncEnded: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('usage-sync-ended', handler);
    return () => ipcRenderer.removeListener('usage-sync-ended', handler);
  },
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
});
