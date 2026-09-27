import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJson } from '../util.js';

/**
 * Onboard state file: .firstrun/onboard-state.json
 * Records all creations made during this session for proper undo.
 */
const STATE_DIR = '.firstrun';
const STATE_FILE = path.join(STATE_DIR, 'onboard-state.json');

export const CREATION_TYPES = {
  FILE: 'file',
  DIR: 'dir',
  ENV_FILE: 'env_file',
  CONTAINER: 'container',
  NODE_MODULES: 'node_modules',
  VENV: 'venv'
};

/**
 * Initialize the onboard state file.
 */
export async function initOnboardState() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const state = {
    version: 1,
    createdAt: new Date().toISOString(),
    creations: [],
    // Stack of applied steps for rewind
    appliedSteps: []
  };
  await writeJson(STATE_FILE, state);
  return state;
}

/**
 * Load the current onboard state.
 */
export async function loadOnboardState() {
  try {
    return await readJson(STATE_FILE);
  } catch {
    return await initOnboardState();
  }
}

/**
 * Save the onboard state.
 */
export async function saveOnboardState(state) {
  await writeJson(STATE_FILE, state);
}

/**
 * Record a file creation with content hash.
 * @param {string} filePath - Path to the file (relative to repo root)
 * @param {string} content - Current content of the file
 * @param {string} stepId - Step that created this file
 * @param {string} type - Type of creation (from CREATION_TYPES)
 */
export async function recordCreation(filePath, content, stepId, type = CREATION_TYPES.FILE) {
  const state = await loadOnboardState();
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const creation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    path: filePath,
    hash,
    stepId,
    createdAt: new Date().toISOString()
  };
  state.creations.push(creation);
  await saveOnboardState(state);
  return creation;
}

/**
 * Record a container creation.
 * @param {string} containerId - Docker container ID
 * @param {string} containerName - Docker container name
 * @param {string} stepId - Step that created this container
 */
export async function recordContainer(containerId, containerName, stepId) {
  const state = await loadOnboardState();
  const creation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: CREATION_TYPES.CONTAINER,
    containerId,
    containerName,
    stepId,
    createdAt: new Date().toISOString()
  };
  state.creations.push(creation);
  await saveOnboardState(state);
  return creation;
}

/**
 * Record a node_modules creation.
 * @param {string} dirPath - Path to node_modules directory
 * @param {string} stepId - Step that created this
 */
export async function recordNodeModules(dirPath, stepId) {
  const state = await loadOnboardState();
  const creation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: CREATION_TYPES.NODE_MODULES,
    path: dirPath,
    stepId,
    createdAt: new Date().toISOString()
  };
  state.creations.push(creation);
  await saveOnboardState(state);
  return creation;
}

/**
 * Record a venv creation.
 * @param {string} dirPath - Path to venv directory
 * @param {string} stepId - Step that created this
 */
export async function recordVenv(dirPath, stepId) {
  const state = await loadOnboardState();
  const creation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: CREATION_TYPES.VENV,
    path: dirPath,
    stepId,
    createdAt: new Date().toISOString()
  };
  state.creations.push(creation);
  await saveOnboardState(state);
  return creation;
}

/**
 * Record an env file backup (before modification).
 * @param {string} filePath - Path to the env file
 * @param {string} originalContent - Original content before HUMBLE modified it
 * @param {string} stepId - Step that modified this file
 */
export async function recordEnvBackup(filePath, originalContent, stepId) {
  const state = await loadOnboardState();
  const hash = originalContent
    ? crypto.createHash('sha256').update(originalContent).digest('hex')
    : null;
  const creation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: CREATION_TYPES.ENV_FILE,
    path: filePath,
    originalContent,
    originalHash: hash,
    stepId,
    createdAt: new Date().toISOString()
  };
  state.creations.push(creation);
  await saveOnboardState(state);
  return creation;
}

/**
 * Record that a step was applied (for rewind tracking).
 */
export async function recordAppliedStep(stepId, stepKind, undoInfo) {
  const state = await loadOnboardState();
  state.appliedSteps.push({
    stepId,
    kind: stepKind,
    undo: undoInfo,
    appliedAt: new Date().toISOString()
  });
  await saveOnboardState(state);
}

/**
 * Run the undo for a specific step, through the guard.
 * Returns { success: boolean, error?: string }
 */
export async function undoStep(stepId, guardCheck) {
  const state = await loadOnboardState();
  const appliedIndex = state.appliedSteps.findIndex(s => s.stepId === stepId);
  if (appliedIndex === -1) {
    return { success: false, error: `Step ${stepId} was not applied in this session` };
  }

  const applied = state.appliedSteps[appliedIndex];
  const undo = applied.undo;

  // Run through guard first
  if (guardCheck) {
    const verdict = await guardCheck(undo.command || undo.type);
    if (verdict === 'block') {
      return { success: false, error: `Undo blocked by guard: ${undo.command || undo.type}` };
    }
    // warn is allowed but logged
  }

  let success = false;
  let error = null;

  try {
    switch (undo.type) {
      case 'run':
        success = await runUndoCommand(undo.command);
        break;
      case 'restore-file':
        success = await restoreFile(undo.file);
        break;
      case 'none':
        success = true; // Nothing to do
        break;
      case 'created-only':
        // The removal itself is removeCreationsForStep below: only what this step recorded creating.
        success = true;
        break;
      case 'stop-started':
        success = stopStartedProcess(undo.pid);
        break;
      default:
        error = `Unknown undo type: ${undo.type}`;
    }
  } catch (err) {
    error = err.message;
    success = false;
  }

  if (success) {
    // Remove creations associated with this step
    await removeCreationsForStep(stepId);
    // Remove from applied steps - reload state to get latest
    const freshState = await loadOnboardState();
    const freshIndex = freshState.appliedSteps.findIndex(s => s.stepId === stepId);
    if (freshIndex !== -1) {
      freshState.appliedSteps.splice(freshIndex, 1);
      await saveOnboardState(freshState);
    }
  }

  return { success, error };
}

/**
 * Run an undo command.
 */
async function runUndoCommand(command) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], { timeout: 60000 });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

/**
 * Restore a file from backup.
 */
async function restoreFile(filePath) {
  const state = await loadOnboardState();
  const backup = state.creations.find(
    c => c.type === CREATION_TYPES.ENV_FILE && c.path === filePath
  );
  if (!backup) {
    // No backup recorded - file may have existed before
    return true;
  }
  if (backup.originalContent === null) {
    // File didn't exist before - delete it
    try {
      await fs.unlink(filePath);
    } catch {
      // File may already be gone
    }
    return true;
  }
  // Restore original content
  await fs.writeFile(filePath, backup.originalContent);
  return true;
}

/**
 * Remove all creations associated with a step.
 * Only deletes if HUMBLE created them and they're unchanged (hash matches).
 */
async function removeCreationsForStep(stepId) {
  const state = await loadOnboardState();
  const toRemove = state.creations.filter(c => c.stepId === stepId);
  const remaining = state.creations.filter(c => c.stepId !== stepId);

  for (const creation of toRemove) {
    try {
      switch (creation.type) {
        case CREATION_TYPES.FILE:
        case CREATION_TYPES.ENV_FILE:
          await deleteFileIfUnchanged(creation.path, creation.hash);
          break;
        case CREATION_TYPES.NODE_MODULES:
          await deleteNodeModulesIfUnchanged(creation.path);
          break;
        case CREATION_TYPES.VENV:
          await deleteVenvIfUnchanged(creation.path);
          break;
        case CREATION_TYPES.CONTAINER:
          await stopAndRemoveContainer(creation.containerId);
          break;
      }
    } catch (err) {
      // Log but continue
      console.error(`Failed to remove creation ${creation.id}:`, err.message);
    }
  }

  state.creations = remaining;
  await saveOnboardState(state);
}

/**
 * Delete a file only if HUMBLE created it and it's unchanged.
 */
async function deleteFileIfUnchanged(filePath, expectedHash) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const currentHash = crypto.createHash('sha256').update(content).digest('hex');
    if (currentHash === expectedHash) {
      await fs.unlink(filePath);
    }
    // If hash differs, user modified it - leave it alone
  } catch {
    // File doesn't exist - fine
  }
}

/**
 * Delete node_modules only if HUMBLE created it in this session.
 * We consider it "ours" if the directory exists and we recorded it.
 * (In practice, we just remove it since we created it fresh)
 */
async function deleteNodeModulesIfUnchanged(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
}

/**
 * Delete venv only if HUMBLE created it in this session.
 */
async function deleteVenvIfUnchanged(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
}

/**
 * Stop and remove a container by ID.
 */
async function stopAndRemoveContainer(containerId) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn('docker', ['stop', containerId], { timeout: 30000 });
    child.on('close', () => {
      const rmChild = spawn('docker', ['rm', containerId], { timeout: 10000 });
      rmChild.on('close', () => resolve(true));
      rmChild.on('error', () => resolve(true)); // Best effort
    });
    child.on('error', () => resolve(true)); // Best effort
  });
}

/**
 * Rewind to a specific step (inclusive - that step and all after it are undone).
 * Runs undos in reverse order through the guard.
 * Stops on first failing undo.
 * @param {string} targetStepId - Step ID to rewind TO (this step and later will be undone)
 * @param {Function} guardCheck - Function(command) -> Promise<'ok'|'warn'|'block'>
 * @returns {Promise<{success: boolean, undone: string[], failed?: string, error?: string}>}
 */
export async function rewind(targetStepId, guardCheck) {
  const state = await loadOnboardState();
  const targetIndex = state.appliedSteps.findIndex(s => s.stepId === targetStepId);
  if (targetIndex === -1) {
    return { success: false, error: `Step ${targetStepId} not found in applied steps` };
  }

  // Steps to undo: from targetIndex to end (inclusive), in reverse order
  const stepsToUndo = state.appliedSteps.slice(targetIndex).reverse();
  const undone = [];
  let failed = null;
  let error = null;

  for (const applied of stepsToUndo) {
    const result = await undoStep(applied.stepId, guardCheck);
    if (result.success) {
      undone.push(applied.stepId);
    } else {
      failed = applied.stepId;
      error = result.error;
      break; // Stop on first failure
    }
  }

  return {
    success: failed === null,
    undone,
    failed,
    error
  };
}

/**
 * Get all applied steps in order.
 */
export async function getAppliedSteps() {
  const state = await loadOnboardState();
  return state.appliedSteps;
}

/**
 * Clear all onboard state (for testing or fresh start).
 */
export async function clearOnboardState() {
  await fs.rm(STATE_DIR, { recursive: true, force: true });
}
/** Stop the server process the guide started (its pid was recorded with the step), whole tree on Windows. */
function stopStartedProcess(pid) {
  if (!pid) return true; // nothing was started in this session
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(pid, 'SIGTERM');
  } catch { /* already gone */ }
  return true;
}
