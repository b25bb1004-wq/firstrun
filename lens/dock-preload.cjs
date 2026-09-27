// lens/dock-preload.cjs — context-isolated preload for every Dock window.
// Exposes window.dock = { run, open, cancel, lens, toggle, onState, look, lookForBob, … }.
const { contextBridge, ipcRenderer } = require('electron');

let project = '';
try {
  const p = new URLSearchParams(window.location.search);
  project = p.get('project') || p.get('target') || '';
} catch {}

contextBridge.exposeInMainWorld('dock', {
  project,
  run:     (agent, target) => ipcRenderer.send('dock:run',    { agent, target }),
  open:    (what, runDir)  => ipcRenderer.send('dock:open',   { what, runDir }),
  cancel:    ()              => ipcRenderer.send('dock:cancel',  {}),
  lens:      ()              => ipcRenderer.send('dock:lens',    {}),
  toggle:    ()              => ipcRenderer.send('dock:toggle',  {}),
  onState:   (fn)            => ipcRenderer.on('dock:state', (_e, state) => fn(state)),
  setSecret: (name, value)   => ipcRenderer.send('dock:secret:set', { name, value }),
  answerAsk: (id, answer)    => ipcRenderer.send('dock:ask:answer', { id, answer }),
  look:      (want)          => ipcRenderer.invoke('spatial:look', want),   // "look at my screen" button (spec 17)
  lookForBob: ()             => ipcRenderer.invoke('spatial:forBob'),
});
