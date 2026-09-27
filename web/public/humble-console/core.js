// HUMBLE Console Core - Shared ES Module (Web copy of lens/humble/console-core.js)
// No DOM access at import time, no dependencies
// Exports: flight, typeSchedule, lineFromBeat, lineFromGuideStep, reelPlayer, onboardingTimeline

import { redactSecrets } from './redact.js';

/**
 * Section 6: Flight math - ported 1:1 from Clicky
 * duration = clamp(distance / 800, 0.6s, 1.4s)
 * quadratic bezier: P0 = start, P2 = target, P1 = midpoint moved UP by min(distance × 0.2, 80px)
 * eased progress t = 3u² − 2u³ (smoothstep)
 * rotation = atan2(B'(t)) + 90°, with B'(t) = 2(1−t)(P1−P0) + 2t(P2−P1); settle at −35° on arrival
 * scale = 1 + sin(u·π) × 0.3 (1.3x mid-flight)
 * glow = 8 + (scale − 1) × 20
 */
export function flight(start, target) {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const distance = Math.hypot(dx, dy);

  // duration clamp: 0.6s to 1.4s at distance over 800
  const duration = Math.max(0.6, Math.min(1.4, distance / 800));

  // Control point: midpoint moved UP by min(distance × 0.2, 80)
  const controlYOffset = Math.min(distance * 0.2, 80);
  const p0 = { x: start.x, y: start.y };
  const p1 = { x: (start.x + target.x) / 2, y: (start.y + target.y) / 2 - controlYOffset };
  const p2 = { x: target.x, y: target.y };

  function at(u) {
    // Clamp u to [0, 1]
    u = Math.max(0, Math.min(1, u));

    // Smoothstep: t = 3u² − 2u³
    const t = 3 * u * u - 2 * u * u * u;

    // Quadratic bezier position
    const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;

    // Derivative for rotation: B'(t) = 2(1−t)(P1−P0) + 2t(P2−P1)
    const dx1 = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy1 = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    const rotation = Math.atan2(dy1, dx1) * (180 / Math.PI) + 90;

    // Settle at -35° on arrival
    const finalRotation = u >= 1 ? -35 : rotation;

    // Scale = 1 + sin(u·π) × 0.3 (peak 1.3 at u=0.5)
    const scale = 1 + Math.sin(u * Math.PI) * 0.3;

    // Glow = 8 + (scale - 1) × 20
    const glow = 8 + (scale - 1) * 20;

    return { x, y, rotation: finalRotation, scale, glow };
  }

  return { duration, at };
}

/**
 * Section 4: Typing engine - per-character delays
 * welcome: fixed 30ms/char
 * bubble: random 30-60ms/char (with injectable seeded random)
 * cmd: 18ms/char + 120ms pause before why line
 * instant for reduced motion
 */
export function typeSchedule(text, mode, options = {}) {
  const { reducedMotion = false, random = Math.random } = options;

  if (reducedMotion) {
    return { delays: new Array(text.length).fill(0), pauseAfter: 0 };
  }

  let delays;
  let pauseAfter = 0;

  switch (mode) {
    case 'welcome':
      // Fixed 30ms/char (Clicky)
      delays = new Array(text.length).fill(30);
      break;
    case 'bubble':
      // Random 30-60ms/char (Clicky)
      delays = new Array(text.length).fill(0).map(() => 30 + random() * 30);
      break;
    case 'cmd':
      // 18ms/char, then 120ms pause before why line
      delays = new Array(text.length).fill(18);
      pauseAfter = 120;
      break;
    default:
      delays = new Array(text.length).fill(0);
  }

  return { delays, pauseAfter };
}

/**
 * Section 3: Line grammar - mapping beats/guide steps to line kinds
 * Kinds: cmd, why, out, fail, diag, was, fix, pass, sys
 * Output lines capped at 6 + more-lines marker
 * All text passed through redactSecrets
 */

const LINE_KINDS = {
  cmd: { prefix: '$ ', color: '--c-ink' },
  why: { prefix: '  why: ', color: '--c-ink-2' },
  out: { prefix: '  ', color: '--c-ink-2' },
  fail: { prefix: '  > ', color: '--c-fail' },
  diag: { prefix: '  ', color: '--c-ink', tagColor: '--c-ink' },
  was: { prefix: '  - ', color: '--c-fail', opacity: 0.7, strikethrough: true },
  fix: { prefix: '  + ', color: '--c-ok' },
  pass: { prefix: '', color: '--c-ok', rightAlign: true },
  sys: { prefix: '', color: '--c-ink-3', italic: true }
};

function applyRedaction(text) {
  return redactSecrets(text);
}

function capLines(lines, max = 6) {
  if (lines.length <= max) return lines;
  const capped = lines.slice(0, max);
  capped.push({ kind: 'sys', text: `… ${lines.length - max} more lines`, prefix: '', color: '--c-ink-3', italic: true });
  return capped;
}

function lineFromBeat(beat) {
  const lines = [];

  switch (beat.kind) {
    case 'step':
      if (beat.text.startsWith('Phase:')) {
        lines.push({ kind: 'sys', text: applyRedaction(beat.text), ...LINE_KINDS.sys });
      } else if (beat.text.startsWith('{')) {
        // JSON phase data - skip for display
        break;
      } else if (beat.text.startsWith('clean machine ready:')) {
        lines.push({ kind: 'sys', text: applyRedaction(beat.text), ...LINE_KINDS.sys });
      } else if (beat.text.startsWith('switching the clean machine to')) {
        lines.push({ kind: 'sys', text: applyRedaction(beat.text), ...LINE_KINDS.sys });
      } else if (beat.text.startsWith('replaying earlier steps')) {
        lines.push({ kind: 'sys', text: applyRedaction(beat.text), ...LINE_KINDS.sys });
      } else {
        // Command step
        lines.push({ kind: 'cmd', text: applyRedaction(beat.text), prefix: '$ ', color: '--c-ink' });
      }
      break;
    case 'fail':
      lines.push({ kind: 'cmd', text: applyRedaction(beat.text), prefix: '$ ', color: '--c-ink', status: 'fail' });
      break;
    case 'pass':
      lines.push({ kind: 'cmd', text: applyRedaction(beat.text), prefix: '$ ', color: '--c-ink', status: 'pass' });
      break;
    case 'diagnosis':
      lines.push({ kind: 'diag', text: applyRedaction(beat.text), prefix: '  [DR.BO] ', tagColor: '--c-ink', color: '--c-ink' });
      break;
    case 'fix':
      lines.push({ kind: 'fix', text: applyRedaction(beat.text), prefix: '  + ', color: '--c-ok' });
      break;
    case 'verified':
      lines.push({ kind: 'pass', text: `VERIFIED · replay from zero in ${beat.text}s`, rightAlign: true, color: '--c-ok' });
      break;
    default:
      lines.push({ kind: 'sys', text: applyRedaction(beat.text), ...LINE_KINDS.sys });
  }

  return capLines(lines);
}

function lineFromGuideStep(step) {
  const lines = [];

  if (step.command) {
    lines.push({ kind: 'cmd', text: applyRedaction(step.command), prefix: '$ ', color: '--c-ink' });
  }
  if (step.why) {
    lines.push({ kind: 'why', text: applyRedaction(step.why), prefix: '  why: ', color: '--c-ink-2' });
  }

  return capLines(lines);
}

export { lineFromBeat, lineFromGuideStep };

/**
 * Section 7: Reel Player - pure state machine over Hermes-2 reel JSON
 * Yields timed actions: type line, shake, point at line with bubble text, celebrate, end with VERIFIED line
 * Compressed to ~25s total
 * skip() jumps to end instantly
 */
export function reelPlayer(reel, options = {}) {
  const { targetDuration = 25000, onAction = () => {} } = options;
  const beats = reel.beats || [];

  // Calculate time compression factor
  const realDuration = reel.replaySeconds * 1000 || 14000;
  const compression = targetDuration / realDuration;

  let currentBeatIndex = 0;
  let skipped = false;
  let state = 'idle';

  async function play() {
    state = 'playing';

    for (let i = 0; i < beats.length; i++) {
      if (skipped) break;

      const beat = beats[i];
      const prevBeat = beats[i - 1];
      const delay = prevBeat ? (beat.t - prevBeat.t) * 1000 * compression : 0;

      if (delay > 0) {
        await sleep(delay);
        if (skipped) break;
      }

      const lines = lineFromBeat(beat);

      for (const line of lines) {
        if (skipped) break;

        let action = { type: 'type', line };

        if (beat.kind === 'fail') {
          action = { type: 'shake', line };
        } else if (beat.kind === 'diagnosis') {
          action = { type: 'point', line, bubbleText: 'this broke here' };
        } else if (beat.kind === 'fix') {
          action = { type: 'point', line, bubbleText: 'so i fixed the readme' };
        } else if (beat.kind === 'verified') {
          action = { type: 'celebrate', line };
        }

        await onAction(action);
      }
    }

    // End with VERIFIED line using real replaySeconds
    if (!skipped) {
      const verifiedLine = {
        kind: 'pass',
        text: `VERIFIED · replay from zero in ${reel.replaySeconds}s`,
        rightAlign: true,
        color: '--c-ok'
      };
      await onAction({ type: 'end', line: verifiedLine });
    }

    state = 'ended';
  }

  function skip() {
    skipped = true;
    // Immediately emit the VERIFIED line
    const verifiedLine = {
      kind: 'pass',
      text: `VERIFIED · replay from zero in ${reel.replaySeconds}s`,
      rightAlign: true,
      color: '--c-ok'
    };
    onAction({ type: 'end', line: verifiedLine });
    state = 'ended';
  }

  function getState() {
    return state;
  }

  return { play, skip, getState };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Section 7: Onboarding timeline steps as data with exact delays
 */
export function onboardingTimeline() {
  return [
    { step: 'intro', delay: 0 },
    { step: 'boot', delay: 420 }, // iris-shutter boot + lantern warm-up
    { step: 'welcomeFadeIn', delay: 400 }, // bubble fades in 0.4s
    { step: 'welcomeType', delay: 30 }, // types at 30ms/char
    { step: 'welcomeHold', delay: 2000 }, // holds 2s
    { step: 'welcomeFadeOut', delay: 500 }, // fades 0.5s
    { step: 'terminalFadeIn', delay: 2000 }, // terminal fades in over 2s
    { step: 'reelPlay', delay: 25000 }, // reel compressed to ~25s
    { step: 'demoPoint1', delay: 0 }, // mascot flies to first fail
    { step: 'demoPoint2', delay: 0 }, // mascot flies to fix line
    { step: 'ctaDelay', delay: 2300 }, // 2.3s after reel ends
    { step: 'ctaType', delay: 30 }, // CTA types at 30ms/char
    { step: 'ctaHold', delay: 10000 }, // stays 10s
    { step: 'ctaFadeOut', delay: 500 } // fades
  ];
}