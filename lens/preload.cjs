const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lens', {
  onShot: (fn) => ipcRenderer.on('lens:shot', (_e, d) => fn(d)),
  read: (png) => ipcRenderer.invoke('lens:read', { png }),
  ask: (payload) => ipcRenderer.invoke('lens:ask', payload),
  copy: (s) => ipcRenderer.send('lens:copy', s),
  close: () => ipcRenderer.send('lens:close'),
});
