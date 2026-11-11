const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gc', {
  serverInfo: () => ipcRenderer.invoke('server-info'),
  pickImages: () => ipcRenderer.invoke('pick-images')
});
