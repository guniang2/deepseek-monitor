const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, Notification, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Config storage path
const configDir = path.join(app.getPath('userData'), 'config.json');

const DEEPSEEK_PROVIDER = {
  id: 'deepseek',
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com',
  modelsPath: '/models',
  balancePath: '/user/balance',
  usagePath: '/dashboard/usage',
  loginUrl: 'https://platform.deepseek.com'
};

// Default config
let config = {
  accounts: [],
  activeAccountId: '',
  autoLaunch: false,
  autoRefreshEnabled: true,
  refreshIntervalSeconds: 300,
  windowBounds: { width: 380, height: 680 },
  budgetAlertEnabled: true,
  balanceThreshold: 50,
  budgetAlertState: {}
};

// ============ Secret encryption (safeStorage) ============
// apiKey / usageToken are stored encrypted when the OS keychain is available.
// Stored format: "enc:v1:<base64>". Plain text is kept as a fallback
// (e.g. Linux without a keyring), matching previous behavior.

function encryptSecret(plain) {
  if (!plain) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'enc:v1:' + safeStorage.encryptString(plain).toString('base64');
    }
  } catch (e) {
    console.error('Encrypt error:', e);
  }
  return plain;
}

function decryptSecret(stored) {
  if (!stored) return '';
  if (String(stored).startsWith('enc:v1:')) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(7), 'base64'));
    } catch (e) {
      console.error('Decrypt error:', e);
      return '';
    }
  }
  return stored;
}

// ============ Account helpers ============

function getActiveAccount() {
  if (!config.accounts.length) return null;
  let account = config.accounts.find((a) => a.id === config.activeAccountId);
  if (!account) {
    account = config.accounts[0];
    config.activeAccountId = account.id;
  }
  return account;
}

function ensureAccount() {
  if (!config.accounts.length) {
    config.accounts.push({ id: crypto.randomUUID(), name: '默认账户', apiKey: '', usageToken: '' });
    config.activeAccountId = config.accounts[0].id;
  }
  return getActiveAccount();
}

function safeAccount(account) {
  return {
    id: account.id,
    name: account.name,
    hasApiKey: !!account.apiKey,
    hasUsageToken: !!account.usageToken
  };
}

// Migrate legacy flat config (apiKey/usageToken/providers) to the multi-account shape.
// Also fills in defaults for newer settings. Returns true when something changed.
function normalizeConfig() {
  let migrated = false;

  if (!Array.isArray(config.accounts) || config.accounts.length === 0) {
    const oldDeepSeek = config.providers?.deepseek || {};
    const legacyKey = config.apiKey || oldDeepSeek.apiKey || '';
    const legacyToken = config.usageToken || oldDeepSeek.usageToken || '';
    config.accounts = [{
      id: crypto.randomUUID(),
      name: '默认账户',
      apiKey: legacyKey,
      usageToken: legacyToken
    }];
    delete config.apiKey;
    delete config.usageToken;
    migrated = true;
  }

  if (!config.activeAccountId || !config.accounts.some((a) => a.id === config.activeAccountId)) {
    config.activeAccountId = config.accounts[0].id;
    migrated = true;
  }

  if (config.budgetAlertEnabled === undefined) {
    config.budgetAlertEnabled = true;
    migrated = true;
  }
  if (config.balanceThreshold === undefined) {
    config.balanceThreshold = 50;
    migrated = true;
  }
  if (typeof config.budgetAlertState !== 'object' || !config.budgetAlertState) {
    config.budgetAlertState = {};
    migrated = true;
  }

  delete config.selectedProvider;
  delete config.providers;

  if (migrated) saveConfig();
  return migrated;
}

function getActiveProvider() {
  normalizeConfig();
  const account = getActiveAccount() || {};
  return {
    ...DEEPSEEK_PROVIDER,
    apiKey: account.apiKey || '',
    usageToken: account.usageToken || ''
  };
}

function getActiveUsageToken() {
  const account = getActiveAccount();
  return (account && account.usageToken) || '';
}

// ============ Config load / save ============

function loadConfig() {
  try {
    if (fs.existsSync(configDir)) {
      const data = fs.readFileSync(configDir, 'utf8');
      const parsed = JSON.parse(data);
      config = { ...config, ...parsed };
      if (Array.isArray(config.accounts)) {
        // Decrypt stored secrets; flag plain-text leftovers so they get
        // re-encrypted on the next save.
        let hasPlainSecret = false;
        config.accounts = config.accounts.map((a) => {
          const apiKey = decryptSecret(a.apiKey || '');
          const usageToken = decryptSecret(a.usageToken || '');
          if (a.apiKey && !String(a.apiKey).startsWith('enc:v1:')) hasPlainSecret = true;
          if (a.usageToken && !String(a.usageToken).startsWith('enc:v1:')) hasPlainSecret = true;
          return {
            id: a.id || crypto.randomUUID(),
            name: a.name || '默认账户',
            apiKey,
            usageToken
          };
        });
        if (hasPlainSecret) {
          saveConfig();
        }
      }
    }
    normalizeConfig();
  } catch (e) {
    console.error('Config load error:', e);
    normalizeConfig();
  }
}

function saveConfig() {
  try {
    const serializable = {
      ...config,
      accounts: config.accounts.map((a) => ({
        ...a,
        apiKey: encryptSecret(a.apiKey),
        usageToken: encryptSecret(a.usageToken)
      }))
    };
    fs.writeFileSync(configDir, JSON.stringify(serializable, null, 2));
  } catch (e) {
    console.error('Config save error:', e);
  }
}

// ============ Auto launch management ============

function setAutoLaunch(enabled) {
  try {
    const appPath = app.getPath('exe');
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
      const appName = 'DeepSeekMonitor';
      if (enabled) {
        execSync(`reg add "${regKey}" /v "${appName}" /t REG_SZ /d "${appPath}" /f`);
      } else {
        try { execSync(`reg delete "${regKey}" /v "${appName}" /f`); } catch (e) {}
      }
    } else if (process.platform === 'darwin') {
      // macOS LaunchAgent approach
      const launchAgentDir = path.join(app.getPath('home'), 'Library', 'LaunchAgents');
      const plistPath = path.join(launchAgentDir, 'com.deepseek.monitor.plist');
      if (enabled) {
        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.deepseek.monitor</string>
  <key>ProgramArguments</key>
  <array>
    <string>${appPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>`;
        fs.mkdirSync(launchAgentDir, { recursive: true });
        fs.writeFileSync(plistPath, plist);
      } else {
        try { fs.unlinkSync(plistPath); } catch (e) {}
      }
    }
    config.autoLaunch = enabled;
    saveConfig();
  } catch (e) {
    console.error('AutoLaunch error:', e);
  }
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

function showMainWindow() {
  if (!mainWindow) createWindow();
  if (!mainWindow) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function notify(title, body) {
  try {
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title, body });
    notification.on('click', () => showMainWindow());
    notification.show();
  } catch (e) {
    console.error('Notification error:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 640,
    minWidth: 360,
    minHeight: 580,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#00000000',
    title: 'DeepSeek Monitor',
    titleBarStyle: 'hidden',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Dev tools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// Create tray icon
function createTray() {
  if (tray) return;

  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');

  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('DeepSeek Monitor');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: showMainWindow },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    showMainWindow();
  });
}

// ============ Auto updater ============

function initAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    sendToRenderer('update-status', { status: 'available', message: '发现新版本，正在下载...' });
  });
  autoUpdater.on('update-not-available', () => {
    sendToRenderer('update-status', { status: 'not-available', message: '已是最新版本' });
  });
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent || 0),
      message: '正在下载更新...'
    });
  });
  autoUpdater.on('update-downloaded', () => {
    sendToRenderer('update-status', { status: 'downloaded', message: '新版本已下载，重启后生效' });
    notify('DeepSeek Monitor 更新', '新版本已下载，重启应用即可完成更新');
  });
  autoUpdater.on('error', (error) => {
    sendToRenderer('update-status', { status: 'error', message: '更新失败：' + (error.message || error) });
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.deepseek.monitor');
  loadConfig();
  createWindow();
  createTray();
  initAutoUpdater();
  // Background update check on startup (silent, packaged builds only)
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {});
  }
});

app.on('window-all-closed', () => {
  // Keep the app running in the tray until the user chooses "退出".
});

app.on('before-quit', () => {
  isQuitting = true;
});

// ============ IPC Handlers ============

function buildProviderUrl(provider, path, query = {}) {
  const baseUrl = provider.baseUrl || '';
  if (!baseUrl) throw new Error('No provider base URL');

  const cleanPath = String(path || '').replace(/^\/+/, '');
  const target = new URL(cleanPath || '.', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, value);
  }
  return target;
}

function requestProvider(path, options = {}) {
  return new Promise((resolve) => {
    const provider = options.provider || getActiveProvider();
    if (!provider.apiKey) {
      resolve({ success: false, error: 'No API key' });
      return;
    }
    if (!provider.baseUrl) {
      resolve({ success: false, error: 'No provider base URL' });
      return;
    }

    let target;
    try {
      target = buildProviderUrl(provider, path, options.query);
    } catch (e) {
      resolve({ success: false, error: e.message });
      return;
    }

    const transport = target.protocol === 'http:' ? http : https;
    const body = options.body || null;

    const requestOptions = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      path: `${target.pathname}${target.search}`,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };
    if (body) requestOptions.headers['Content-Length'] = Buffer.byteLength(body);

    const req = transport.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          const httpOk = res.statusCode >= 200 && res.statusCode < 300;
          const businessCode = json && typeof json === 'object' ? json.code : undefined;
          const businessOk = businessCode === undefined || businessCode === 0;
          resolve({
            success: httpOk && businessOk,
            status: res.statusCode,
            code: businessCode,
            error: httpOk && !businessOk ? (json.msg || json.message || `业务错误：${businessCode}`) : undefined,
            data: json
          });
        } catch (e) {
          resolve({ success: false, status: res.statusCode, error: 'Parse error', raw: data });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.setTimeout(options.timeout || 10000, () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    if (body) req.write(body);
    req.end();
  });
}

function normalizeModels(data) {
  const rawModels = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.models) ? data.models : []);
  return rawModels
    .map((model) => {
      const id = model.id || model.name || model.model || '';
      if (!id) return null;
      return {
        id,
        name: model.display_name || model.name || id,
        ownedBy: model.owned_by || model.owner || getActiveProvider().name,
        created: model.created || null
      };
    })
    .filter(Boolean);
}

function normalizeBalance(rawData) {
  if (!rawData || typeof rawData !== 'object') return rawData;

  // DeepSeek 格式：已经是标准格式
  if (Array.isArray(rawData.balance_infos)) {
    return rawData;
  }

  return rawData;
}

function getBalanceTotals(rawData) {
  const normalized = normalizeBalance(rawData);
  const infos = Array.isArray(normalized?.balance_infos) ? normalized.balance_infos : [];
  const totalBalance = infos.reduce((sum, item) => sum + Number(item.total_balance || 0), 0);
  const voucherBalance = infos.reduce((sum, item) => sum + Number(item.voucher_balance || item.granted_balance || 0), 0);
  const cashBalance = infos.reduce((sum, item) => sum + Number(item.cash_balance || item.topped_up_balance || 0), 0);
  return { totalBalance, voucherBalance, cashBalance, normalized };
}

// ============ Budget alerts ============

function maybeAlertLowBalance(account, total) {
  if (config.budgetAlertEnabled === false || !account) return;
  const threshold = Number(config.balanceThreshold || 0);
  const value = Number(total);
  if (!(threshold > 0) || !Number.isFinite(value)) return;

  const stateKey = account.id;
  const prev = config.budgetAlertState[stateKey] || 'ok';
  if (value < threshold && prev !== 'below') {
    config.budgetAlertState[stateKey] = 'below';
    saveConfig();
    notify(
      '余额预警',
      `账户「${account.name}」余额 ¥${value.toFixed(2)} 已低于阈值 ¥${threshold}`
    );
  } else if (value >= threshold && prev === 'below') {
    config.budgetAlertState[stateKey] = 'ok';
    saveConfig();
  }
}

function requestJsonUrl(targetUrl, token, options = {}) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(targetUrl);
    } catch (e) {
      resolve({ success: false, error: e.message });
      return;
    }

    const transport = target.protocol === 'http:' ? http : https;
    const requestOptions = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'x-app-version': '1.0.0',
        ...(options.headers || {})
      }
    };

    const req = transport.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ success: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: json });
        } catch (e) {
          resolve({ success: false, status: res.statusCode, error: 'Parse error', raw: data });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.setTimeout(options.timeout || 15000, () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    req.end();
  });
}

function requestExternalJson(targetUrl, options = {}) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(targetUrl);
    } catch (e) {
      resolve({ success: false, error: e.message });
      return;
    }
    const transport = target.protocol === 'http:' ? http : https;
    const req = transport.request({
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      path: `${target.pathname}${target.search}`,
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve({ success: ok, status: res.statusCode, data: json, error: ok ? undefined : (json.message || json.msg || `HTTP ${res.statusCode}`) });
        } catch (e) {
          resolve({ success: false, status: res.statusCode, error: 'Parse error', raw: data });
        }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.setTimeout(options.timeout || 15000, () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    req.end();
  });
}

function usageErrorFromResult(result) {
  if (result.code === 40003 || String(result.error || '').toLowerCase().includes('invalid token')) {
    return '用量 Token 无效或已过期，请重新同步';
  }
  if (result.status === 401) return '用量 Token 无效或已过期，请重新同步';
  if (result.status === 429) return '请求过于频繁，请稍后再试';
  if (result.error) return result.error;
  if (result.status) return `用量接口错误：HTTP ${result.status}`;
  return result.error || '用量查询失败';
}

function tokenBreakdown(entries = []) {
  let totalTokens = 0;
  let requestCount = 0;
  let cacheHitTokens = 0;
  let cacheMissTokens = 0;
  let responseTokens = 0;

  for (const entry of entries) {
    const type = entry.type || entry.kind || '';
    const value = Math.round(Number(entry.amount || entry.value || 0));
    if (type === 'REQUEST') requestCount = value;
    if (type === 'PROMPT_CACHE_HIT_TOKEN') {
      cacheHitTokens = value;
      totalTokens += value;
    } else if (type === 'PROMPT_CACHE_MISS_TOKEN') {
      cacheMissTokens = value;
      totalTokens += value;
    } else if (type === 'RESPONSE_TOKEN') {
      responseTokens = value;
      totalTokens += value;
    } else if (type === 'PROMPT_TOKEN') {
      totalTokens += value;
    }
  }

  return { totalTokens, requestCount, cacheHitTokens, cacheMissTokens, responseTokens };
}

function costSum(entries = []) {
  return entries
    .filter((entry) => (entry.type || entry.kind) !== 'REQUEST')
    .reduce((sum, entry) => sum + Number(entry.amount || entry.value || 0), 0);
}

function emptyUsageDay(date) {
  return {
    date,
    flashTokens: 0,
    flashCacheHit: 0,
    flashCacheMiss: 0,
    flashResponse: 0,
    proTokens: 0,
    proCacheHit: 0,
    proCacheMiss: 0,
    proResponse: 0,
    totalTokens: 0,
    totalCost: 0
  };
}

function modelLabel(model) {
  const id = String(model || '').toLowerCase();
  if (id === 'deepseek-v4-flash' || id.includes('flash') || id.includes('chat')) {
    return { key: 'flash', name: 'V4 Flash' };
  }
  if (id === 'deepseek-v4-pro' || id.includes('pro') || id.includes('reasoner') || id.includes('r1')) {
    return { key: 'pro', name: 'V4 Pro' };
  }
  return null;
}

function normalizeUsage(amountData, costData) {
  const amountBiz = amountData?.data?.biz_data || {};
  const rawCostBiz = costData?.data?.biz_data;
  const costBiz = Array.isArray(rawCostBiz) ? (rawCostBiz[0] || {}) : (rawCostBiz || {});
  const costTotals = Array.isArray(costBiz.total) ? costBiz.total : [];

  const costForModel = (model) => {
    const label = modelLabel(model);
    const item = costTotals.find((entry) => {
      if (entry.model === model) return true;
      const entryLabel = modelLabel(entry.model);
      return label && entryLabel && entryLabel.key === label.key;
    });
    return item ? costSum(item.usage) : 0;
  };

  const modelMap = new Map([
    ['flash', { key: 'flash', name: 'V4 Flash', totalTokens: 0, requestCount: 0, cacheHitTokens: 0, cacheMissTokens: 0, responseTokens: 0, cost: 0 }],
    ['pro', { key: 'pro', name: 'V4 Pro', totalTokens: 0, requestCount: 0, cacheHitTokens: 0, cacheMissTokens: 0, responseTokens: 0, cost: 0 }]
  ]);
  for (const item of amountBiz.total || []) {
    const label = modelLabel(item.model);
    if (!label) continue;
    const parts = tokenBreakdown(item.usage);
    const row = modelMap.get(label.key);
    row.totalTokens += parts.totalTokens;
    row.requestCount += parts.requestCount;
    row.cacheHitTokens += parts.cacheHitTokens;
    row.cacheMissTokens += parts.cacheMissTokens;
    row.responseTokens += parts.responseTokens;
    row.cost += costForModel(item.model);
  }

  const costByDate = new Map();
  const costByDateModel = new Map();
  for (const day of costBiz.days || []) {
    const dayCost = (day.data || []).reduce((sum, item) => sum + costSum(item.usage), 0);
    costByDate.set(day.date, dayCost);
    for (const item of day.data || []) {
      const label = modelLabel(item.model);
      if (!label) continue;
      const key = `${day.date}:${label.key}`;
      costByDateModel.set(key, (costByDateModel.get(key) || 0) + costSum(item.usage));
    }
  }

  const days = [];
  for (const day of amountBiz.days || []) {
    const row = emptyUsageDay(day.date);
    for (const item of day.data || []) {
      const parts = tokenBreakdown(item.usage);
      row.totalTokens += parts.totalTokens;
      const label = modelLabel(item.model);
      if (label?.key === 'flash') {
        row.flashTokens += parts.totalTokens;
        row.flashCacheHit += parts.cacheHitTokens;
        row.flashCacheMiss += parts.cacheMissTokens;
        row.flashResponse += parts.responseTokens;
      } else if (label?.key === 'pro') {
        row.proTokens += parts.totalTokens;
        row.proCacheHit += parts.cacheHitTokens;
        row.proCacheMiss += parts.cacheMissTokens;
        row.proResponse += parts.responseTokens;
      }
    }
    row.totalCost = costByDate.get(day.date) || 0;
    days.push(row);
  }

  for (const row of modelMap.values()) {
    if (row.cost > 0 || row.totalTokens > 0) continue;
    row.cost = Array.from(costByDateModel.entries())
      .filter(([key]) => key.endsWith(`:${row.key}`))
      .reduce((sum, [, value]) => sum + value, 0);
  }

  const monthCostFromTotals = costTotals.reduce((sum, item) => sum + costSum(item.usage), 0);
  const monthCostFromDays = Array.from(costByDate.values()).reduce((sum, value) => sum + value, 0);

  return {
    models: Array.from(modelMap.values()),
    days,
    monthCost: monthCostFromTotals || monthCostFromDays
  };
}

async function fetchUsageMonth(month, year) {
  const usageToken = getActiveUsageToken();
  if (!usageToken) {
    return { success: false, error: '未配置用量 Token' };
  }

  const amountUrl = `https://platform.deepseek.com/api/v0/usage/amount?month=${month}&year=${year}`;
  const costUrl = `https://platform.deepseek.com/api/v0/usage/cost?month=${month}&year=${year}`;
  const [amount, cost] = await Promise.all([
    requestJsonUrl(amountUrl, usageToken),
    requestJsonUrl(costUrl, usageToken)
  ]);

  if (!amount.success) return { success: false, status: amount.status, code: amount.code, error: usageErrorFromResult(amount) };
  if (!cost.success) return { success: false, status: cost.status, code: cost.code, error: usageErrorFromResult(cost) };

  return { success: true, data: normalizeUsage(amount.data, cost.data) };
}

let usageSyncWindow = null;
let usageTokenCaptured = false;
let usageTokenCandidates = new Set();

async function verifyUsageTokenValue(token) {
  const now = new Date();
  const amountUrl = `https://platform.deepseek.com/api/v0/usage/amount?month=${now.getMonth() + 1}&year=${now.getFullYear()}`;
  const result = await requestJsonUrl(amountUrl, token);
  return result.success;
}

function maybeCaptureUsageToken(authHeader) {
  const match = /Bearer\s+(\S+)/i.exec(String(authHeader || ''));
  const token = match?.[1]?.trim();
  if (!token || token.length < 20 || usageTokenCaptured) return;
  if (usageTokenCandidates.has(token)) return;
  usageTokenCandidates.add(token);

  verifyUsageTokenValue(token).then((valid) => {
    if (!valid || usageTokenCaptured) return;
    usageTokenCaptured = true;
    const account = ensureAccount();
    account.usageToken = token;
    saveConfig();

    if (mainWindow) {
      mainWindow.webContents.send('usage-token-captured', {
        usageTokenConfigured: true,
        hasUsageToken: true
      });
    }
    if (usageSyncWindow && !usageSyncWindow.isDestroyed()) usageSyncWindow.close();
    usageSyncWindow = null;
  }).catch(() => {});
}

function startUsageSyncWindow() {
  normalizeConfig();
  const provider = getActiveProvider();
  const loginUrl = provider.loginUrl;
  if (!loginUrl) return { success: false, error: 'DeepSeek 未配置官网入口' };

  if (usageSyncWindow && !usageSyncWindow.isDestroyed()) {
    usageSyncWindow.show();
    usageSyncWindow.focus();
    usageSyncWindow.webContents.reload();
    return { success: true, opened: false };
  }

  usageTokenCaptured = false;
  usageTokenCandidates = new Set();
  usageSyncWindow = new BrowserWindow({
    width: 500,
    height: 720,
    minWidth: 380,
    minHeight: 520,
    title: 'DeepSeek 账号登录',
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const filter = { urls: ['<all_urls>'] };
  usageSyncWindow.webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const headers = details.requestHeaders || {};
    const authHeader = headers.Authorization || headers.authorization;
    if (authHeader) maybeCaptureUsageToken(authHeader);
    callback({ requestHeaders: headers });
  });

  usageSyncWindow.webContents.on('did-finish-load', () => {
    usageSyncWindow.webContents.executeJavaScript(`
      (() => {
        if (window.__dsmTokenHook) return;
        window.__dsmTokenHook = true;
        const send = (value) => {
          try {
            const match = /Bearer\\s+(\\S+)/i.exec(String(value || ''));
            if (match && match[1]) document.title = 'DSM_USAGE_TOKEN:' + match[1];
          } catch (_) {}
        };
        const originalFetch = window.fetch;
        if (typeof originalFetch === 'function') {
          window.fetch = function(input, init) {
            try {
              const headers = (init && init.headers) || (input && input.headers);
              if (headers instanceof Headers) send(headers.get('authorization'));
              else if (Array.isArray(headers)) headers.forEach((row) => String(row[0]).toLowerCase() === 'authorization' && send(row[1]));
              else if (headers && typeof headers === 'object') Object.keys(headers).forEach((key) => key.toLowerCase() === 'authorization' && send(headers[key]));
            } catch (_) {}
            return originalFetch.apply(this, arguments);
          };
        }
        const originalSet = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
          if (String(name || '').toLowerCase() === 'authorization') send(value);
          return originalSet.apply(this, arguments);
        };
      })();
    `).catch(() => {});
  });

  usageSyncWindow.on('page-title-updated', (event, title) => {
    const token = String(title || '').replace(/^DSM_USAGE_TOKEN:/, '');
    if (title.startsWith('DSM_USAGE_TOKEN:')) maybeCaptureUsageToken(`Bearer ${token}`);
  });

  usageSyncWindow.on('closed', () => {
    if (!usageTokenCaptured && mainWindow) mainWindow.webContents.send('usage-sync-ended');
    usageSyncWindow = null;
  });

  usageSyncWindow.loadURL(loginUrl);
  return { success: true, opened: true };
}

// Get config
ipcMain.handle('get-config', () => {
  normalizeConfig();
  const account = getActiveAccount();
  return {
    accounts: config.accounts.map(safeAccount),
    activeAccountId: config.activeAccountId,
    autoLaunch: config.autoLaunch,
    autoRefreshEnabled: config.autoRefreshEnabled !== false,
    refreshIntervalSeconds: config.refreshIntervalSeconds || 300,
    budgetAlertEnabled: config.budgetAlertEnabled !== false,
    balanceThreshold: config.balanceThreshold || 50,
    packaged: app.isPackaged,
    hasApiKey: !!(account && account.apiKey),
    hasUsageToken: !!(account && account.usageToken),
    configPath: configDir
  };
});

// Multi-account management
ipcMain.handle('add-account', (event, name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { success: false, error: '账户名称不能为空' };
  const account = { id: crypto.randomUUID(), name: trimmed.slice(0, 30), apiKey: '', usageToken: '' };
  config.accounts.push(account);
  config.activeAccountId = account.id;
  saveConfig();
  return { success: true, account: safeAccount(account) };
});

ipcMain.handle('delete-account', (event, id) => {
  if (config.accounts.length <= 1) return { success: false, error: '至少保留一个账户' };
  const index = config.accounts.findIndex((a) => a.id === id);
  if (index < 0) return { success: false, error: '账户不存在' };
  config.accounts.splice(index, 1);
  if (config.activeAccountId === id) config.activeAccountId = config.accounts[0].id;
  delete config.budgetAlertState[id];
  saveConfig();
  return { success: true };
});

ipcMain.handle('set-active-account', (event, id) => {
  if (!config.accounts.some((a) => a.id === id)) return { success: false, error: '账户不存在' };
  config.activeAccountId = id;
  saveConfig();
  return { success: true };
});

// Save API key (active account)
ipcMain.handle('save-api-key', async (event, apiKey) => {
  const account = ensureAccount();
  account.apiKey = String(apiKey || '').trim();
  saveConfig();
  return { success: true };
});

// Save usage token (active account)
ipcMain.handle('save-usage-token', async (event, token) => {
  normalizeConfig();
  const value = String(token || '').trim();
  if (!value) return { success: false, error: '用量 Token 不能为空' };
  const valid = await verifyUsageTokenValue(value);
  if (!valid) return { success: false, error: '用量 Token 无效或已过期，请重新获取' };
  const account = ensureAccount();
  account.usageToken = value;
  saveConfig();
  return { success: true };
});

// Clear API key (active account)
ipcMain.handle('clear-api-key', () => {
  const account = ensureAccount();
  account.apiKey = '';
  saveConfig();
  return { success: true };
});

// Clear usage token (active account)
ipcMain.handle('clear-usage-token', () => {
  normalizeConfig();
  const account = ensureAccount();
  account.usageToken = '';
  saveConfig();
  return { success: true };
});

// Set auto launch
ipcMain.handle('set-auto-launch', (event, enabled) => {
  setAutoLaunch(enabled);
  return { success: true };
});

ipcMain.handle('save-refresh-options', (event, options = {}) => {
  config.autoRefreshEnabled = options.autoRefreshEnabled !== false;
  const seconds = Number(options.refreshIntervalSeconds || config.refreshIntervalSeconds || 300);
  config.refreshIntervalSeconds = [60, 300, 1800, 3600].includes(seconds) ? seconds : 300;
  saveConfig();
  return {
    success: true,
    autoRefreshEnabled: config.autoRefreshEnabled,
    refreshIntervalSeconds: config.refreshIntervalSeconds
  };
});

// Budget alert options
ipcMain.handle('save-budget-options', (event, options = {}) => {
  config.budgetAlertEnabled = options.budgetAlertEnabled !== false;
  const threshold = Number(options.balanceThreshold);
  config.balanceThreshold = Number.isFinite(threshold) && threshold >= 0 ? threshold : 50;
  saveConfig();
  return {
    success: true,
    budgetAlertEnabled: config.budgetAlertEnabled,
    balanceThreshold: config.balanceThreshold
  };
});

// Window controls
ipcMain.handle('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle('window-close', () => { if (mainWindow) mainWindow.hide(); });

// Verify API key
ipcMain.handle('verify-api-key', async (event, apiKey) => {
  const provider = { ...getActiveProvider(), apiKey: apiKey || getActiveProvider().apiKey };
  if (!provider.apiKey) return { success: false, error: 'No API key provided' };
  const result = await requestProvider(provider.balancePath || provider.modelsPath || '/models', { provider });
  return result.success ? { success: true } : result;
});

// Fetch balance
ipcMain.handle('fetch-balance', async () => {
  const provider = getActiveProvider();
  if (!provider.balancePath) return { success: false, unsupported: true, error: 'DeepSeek 未配置余额接口' };
  const result = await requestProvider(provider.balancePath);
  if (!result.success) return result;
  const account = getActiveAccount();
  if (account) {
    const totals = getBalanceTotals(result.data);
    maybeAlertLowBalance(account, totals.totalBalance);
  }
  return { ...result, data: normalizeBalance(result.data) };
});

// Fetch available models
ipcMain.handle('fetch-models', async () => {
  const provider = getActiveProvider();
  const result = await requestProvider(provider.modelsPath || '/models');
  if (!result.success) return result;
  return { ...result, models: normalizeModels(result.data) };
});

// Fetch usage data
ipcMain.handle('fetch-usage', async (event, params) => {
  const now = new Date();
  const month = Number(params?.month || now.getMonth() + 1);
  const year = Number(params?.year || now.getFullYear());
  return fetchUsageMonth(month, year);
});

// Open browser for web login
ipcMain.handle('open-browser-login', async () => {
  const provider = getActiveProvider();
  const target = provider.loginUrl || provider.baseUrl;
  if (!target) return { success: false, error: 'DeepSeek 未配置官网入口' };
  await shell.openExternal(target);
  return { success: true };
});

ipcMain.handle('start-usage-sync', async () => startUsageSyncWindow());

// Auto update
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { success: false, error: '开发模式不支持自动更新，请使用安装版' };
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || '检查更新失败' };
  }
});

ipcMain.handle('quit-and-install-update', () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});
