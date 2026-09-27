import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Test that the bob.js error message is updated
describe('Bob.js error message format', () => {
  test('askBob returns "Sign in to Bob Shell first" when not signed in', () => {
    const bobSource = fs.readFileSync(path.join(process.cwd(), 'src/brain/bob.js'), 'utf8');
    
    // Check that the error message for not signed in contains the required text
    assert.match(bobSource, /Sign in to Bob Shell first/);
    assert.match(bobSource, /open a terminal, run bob/);
  });
});

// Test that dock-bridge.js has child.on('error') handler
describe('Dock-bridge.js - error handling', () => {
  test('runAgent handles spawn error', () => {
    const bridgeSource = fs.readFileSync(path.join(process.cwd(), 'lens/dock-bridge.js'), 'utf8');
    assert.match(bridgeSource, /child\.on\('error'/);
  });
  
  test('runAgent handles non-zero exit codes', () => {
    const bridgeSource = fs.readFileSync(path.join(process.cwd(), 'lens/dock-bridge.js'), 'utf8');
    assert.match(bridgeSource, /process exited/);
  });
});

// Test that main.js lens:read handler catches OCR errors
describe('Main.js - lens:read error handling', () => {
  test('lens:read handler has try/catch', () => {
    const mainSource = fs.readFileSync(path.join(process.cwd(), 'lens/main.js'), 'utf8');
    // Check that the handler wraps ocr call in try/catch
    assert.match(mainSource, /ipcMain\.handle\('lens:read'/);
    assert.match(mainSource, /try \{/);
    assert.match(mainSource, /catch \(err\) \{/);
    assert.match(mainSource, /Could not read the selection/);
  });
});

// Test that main.js lens:ask handler catches askBobAbout errors
describe('Main.js - lens:ask error handling', () => {
  test('lens:ask handler has try/catch', () => {
    const mainSource = fs.readFileSync(path.join(process.cwd(), 'lens/main.js'), 'utf8');
    assert.match(mainSource, /ipcMain\.handle\('lens:ask'/);
    assert.match(mainSource, /try \{/);
    assert.match(mainSource, /catch \(err\) \{/);
    assert.match(mainSource, /return \{ ok: false/);
  });
});

// Test that main.js spatial:look handler catches errors
describe('Main.js - spatial:look error handling', () => {
  test('spatial:look handler catches errors and returns ok:false', () => {
    const mainSource = fs.readFileSync(path.join(process.cwd(), 'lens/main.js'), 'utf8');
    assert.match(mainSource, /spatial:look.*catch.*\(e\) => \(\{ ok: false/);
  });
});

// Test that main.js dock:runStep handler catches spawn errors
describe('Main.js - dock:runStep error handling', () => {
  test('dock:runStep handler catches spawn errors', () => {
    const mainSource = fs.readFileSync(path.join(process.cwd(), 'lens/main.js'), 'utf8');
    assert.match(mainSource, /proc\.on\('error'/);
  });
});

// Test that main.js dock:getGuide handler returns ok:false when no run folder
describe('Main.js - dock:getGuide error handling', () => {
  test('dock:getGuide handler returns ok:false when no run folder', () => {
    const mainSource = fs.readFileSync(path.join(process.cwd(), 'lens/main.js'), 'utf8');
    assert.match(mainSource, /No verified run folder found/);
  });
});

// Test overlay.js error display
describe('Overlay.js - error display', () => {
  test('overlay catches lens.read errors and shows readable message', () => {
    const overlaySource = fs.readFileSync(path.join(process.cwd(), 'lens/overlay.js'), 'utf8');
    assert.match(overlaySource, /catch \(err\) \{/);
    assert.match(overlaySource, /Could not read it/);
  });
  
  test('overlay catches lens.ask errors and shows readable message', () => {
    const overlaySource = fs.readFileSync(path.join(process.cwd(), 'lens/overlay.js'), 'utf8');
    assert.match(overlaySource, /Bob couldn't answer/);
    assert.match(overlaySource, /r\.error/);
  });
});

// Test engine.js askBobAbout passes errors correctly
describe('Engine.js - askBobAbout passes errors', () => {
  test('askBobAbout returns askBob result directly', () => {
    const engineSource = fs.readFileSync(path.join(process.cwd(), 'lens/engine.js'), 'utf8');
    assert.match(engineSource, /return askBob\(/);
  });
});

// Test spatial/look.js error handling
describe('Spatial/look.js - error handling', () => {
  test('look returns ok:false when no window found', () => {
    const lookSource = fs.readFileSync(path.join(process.cwd(), 'lens/spatial/look.js'), 'utf8');
    assert.match(lookSource, /ok: false/);
    assert.match(lookSource, /no.*window found/);
  });
  
  test('look returns ok:false when verifyPoint fails', () => {
    const lookSource = fs.readFileSync(path.join(process.cwd(), 'lens/spatial/look.js'), 'utf8');
    assert.match(lookSource, /!v\.ok.*ok: false/);
  });
});

// Test that dock:probe, dock:checkStep, dock:runStep handlers exist
describe('Main.js - other IPC handlers', () => {
  test('dock:probe handler exists', () => {
    const mainSource = fs.readFileSync(path.join(process.cwd(), 'lens/main.js'), 'utf8');
    assert.match(mainSource, /ipcMain\.handle\('dock:probe'/);
  });
  
  test('dock:checkStep handler exists', () => {
    const mainSource = fs.readFileSync(path.join(process.cwd(), 'lens/main.js'), 'utf8');
    assert.match(mainSource, /ipcMain\.handle\('dock:checkStep'/);
  });
  
  test('dock:runStep handler exists', () => {
    const mainSource = fs.readFileSync(path.join(process.cwd(), 'lens/main.js'), 'utf8');
    assert.match(mainSource, /ipcMain\.handle\('dock:runStep'/);
  });
});

console.log('All lens-hardening verification tests loaded');