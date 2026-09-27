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
  dragStart: ()              => ipcRenderer.send('dock:button:dragStart'),
  dragMove:  (dx, dy)        => ipcRenderer.send('dock:button:drag', { dx, dy }),
  dragEnd:   ()              => ipcRenderer.send('dock:button:dragEnd'),
  dragReset: ()              => ipcRenderer.send('dock:button:reset'),
  console:   (runDir)        => ipcRenderer.send('dock:console', { runDir }),
  onState:   (fn)            => ipcRenderer.on('dock:state', (_e, state) => fn(state)),
  setSecret: (name, value)   => ipcRenderer.send('dock:secret:set', { name, value }),
  answerAsk: (id, answer)    => ipcRenderer.send('dock:ask:answer', { id, answer }),
  look:      (want)          => ipcRenderer.invoke('spatial:look', want),   // "look at my screen" button (spec 17)
  lookForBob: ()             => ipcRenderer.invoke('spatial:forBob'),
  probe:     ()              => ipcRenderer.invoke('dock:probe'),
  getGuide:  (target)        => ipcRenderer.invoke('dock:getGuide', target),
  getReel:   (name)          => ipcRenderer.invoke('dock:getReel', name),
  runStep:   (opts)          => ipcRenderer.invoke('dock:runStep', opts),
  checkStep: (opts)          => ipcRenderer.invoke('dock:checkStep', opts),
  onStepOutput: (fn)         => ipcRenderer.on('dock:step:output', (_e, data) => fn(data)),
});
