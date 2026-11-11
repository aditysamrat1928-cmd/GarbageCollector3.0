const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { startServer } = require('./server');

let server;
const PORT = 8787;

function localIPs() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(x => x && x.family === 'IPv4' && !x.internal)
    .map(x => x.address);
}

async function createWindow() {
  server = await startServer(app.getPath('userData'), PORT);

  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f7fbf8',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

ipcMain.handle('server-info', () => ({
  port: PORT,
  ips: localIPs(),
  api: `http://127.0.0.1:${PORT}`
}));

ipcMain.handle('pick-images', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','webp'] }]
  });
  return result.canceled ? [] : result.filePaths;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
