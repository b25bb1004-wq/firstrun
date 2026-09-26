// lens/dock-preload.cjs — context-isolated preload for every Dock window.
// Exposes window.dock = { run, open, cancel, lens, toggle, onState }.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dock', {
  run:     (agent, target) => ipcRenderer.send('dock:run',    { agent, target }),
  open:    (what, runDir)  => ipcRenderer.send('dock:open',   { what, runDir }),
  cancel:  ()              => ipcRenderer.send('dock:cancel',  {}),
  lens:    ()              => ipcRenderer.send('dock:lens',    {}),
  toggle:  ()              => ipcRenderer.send('dock:toggle',  {}),
  onState: (fn)            => ipcRenderer.on('dock:state', (_e, state) => fn(state)),
});
