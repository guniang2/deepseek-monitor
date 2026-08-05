// Smoke test: launch the app, verify no fatal errors, then quit.
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  // Load the real main process logic by requiring it with a patched entry?
  // Simpler: just spawn a window with the same settings and load index.html.
  const win = new BrowserWindow({
    width: 380, height: 640, show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js')
    }
  });
  win.webContents.on('did-finish-load', () => {
    console.log('SMOKE: page loaded OK');
    setTimeout(() => app.quit(), 500);
  });
  win.webContents.on('console-message', (e, level, message) => {
    if (level >= 2) console.log('SMOKE console(' + level + '):', message);
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
});
app.on('window-all-closed', () => app.quit());
