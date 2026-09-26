// Setup Passport: a document-styled card with a machine-readable zone and an inked stamp.
import { h, raw, esc, short, secs, identicon } from './lib.js';

let uid = 0;

function guilloche(w = 640, hgt = 420) {
  let paths = '';
  for (let k = 0; k < 22; k++) {
    let d = '';
    for (let x = -10; x <= w + 10; x += 8) {
      const y = hgt * 0.52 + Math.sin(x / 38 + k * 0.33) * (46 + k * 3.2) * Math.cos(x / 131 - k * 0.21);
      d += (x === -10 ? 'M' : 'L') + x.toFixed(0) + ' ' + y.toFixed(1);
    }
    paths += `<path d="${d}"/>`;
  }
  let rings = '';
  for (let k = 0; k < 16; k++) {
    const r = 30 + k * 5.5;
    rings += `<ellipse cx="${w * 0.8}" cy="${hgt * 0.36}" rx="${r}" ry="${r * 0.62}" transform="rotate(${k * 11} ${w * 0.8} ${hgt * 0.36})"/>`;
  }
  return raw(`<svg class="pp-guilloche" viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none" aria-hidden="true"><g class="g-waves">${paths}</g><g class="g-rose">${rings}</g></svg>`);
}

function mrzLines(p) {
  const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '<');
  const pad = s => (s + '<'.repeat(44)).slice(0, 44);
  const [org, name] = String(p.repo || '').split('/');
  const l1 = pad(`P<FRN${clean(org)}<<${clean(name)}`);
  const rt = clean(String(p.runtime || '').replace(/\s+/g, ''));
  const l2 = pad(`${short(p.commit).toUpperCase()}<${rt}<<${p.breaksFound}B${p.breaksFixed}F${p.needsHuman}H<<${p.replaySeconds}S<${clean(p.verdict)}`);
  return [l1, l2];
}

export function stampSVG(p, { size = 150 } = {}) {
  const id = `ink${++uid}`;
  const date = new Date(p.verifiedAt || Date.now());
  const dstr = isNaN(date) ? '' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const ring = 'FIRSTRUN · CLEAN MACHINE · REPLAYED FROM ZERO · ';
  return raw(`<svg class="stamp" viewBox="0 0 160 160" width="${size}" height="${size}" role="img" aria-label="${esc(p.verdict)} stamp">
    <defs>
      <filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="grain"/>
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.4" result="rough"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="${(p.replaySeconds || 3) % 9}" result="blot"/>
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.7 0 0 0 1.62" result="holes"/>
        <feComposite in="rough" in2="holes" operator="in"/>
      </filter>
      <path id="${id}c" d="M80 80 m-58 0 a58 58 0 1 1 116 0 a58 58 0 1 1 -116 0"/>
    </defs>
    <g filter="url(#${id})" fill="none" stroke="currentColor">
      <circle cx="80" cy="80" r="74" stroke-width="4"/>
      <circle cx="80" cy="80" r="68" stroke-width="1.2"/>
      <circle cx="80" cy="80" r="47" stroke-width="1.6"/>
      <text font-size="10.2" letter-spacing="1.6" fill="currentColor" stroke="none" font-family="IBM Plex Sans Condensed, sans-serif" font-weight="600"><textPath href="#${id}c">${ring}${ring.slice(0, 18)}</textPath></text>
      <rect x="14" y="66" width="132" height="30" fill="var(--stamp-bg, transparent)" stroke-width="2.4" rx="2"/>
      <text x="80" y="88" text-anchor="middle" font-size="${p.verdict === 'NO-SETUP-DOCS' ? 14 : p.verdict === 'VERIFIED' ? 22 : p.verdict === 'INCONCLUSIVE' ? 18 : p.verdict === 'CI-ONLY' ? 18 : 24}" font-weight="700" letter-spacing="${p.verdict === 'NO-SETUP-DOCS' ? 0.5 : p.verdict === 'INCONCLUSIVE' ? 1 : p.verdict === 'CI-ONLY' ? 1 : 2}" fill="currentColor" stroke="none" font-family="IBM Plex Sans Condensed, sans-serif">${esc(p.verdict)}</text>
      <text x="80" y="112" text-anchor="middle" font-size="9.5" letter-spacing="1" fill="currentColor" stroke="none" font-family="IBM Plex Mono, monospace">${esc(dstr)}</text>
      <text x="80" y="59" text-anchor="middle" font-size="9.5" letter-spacing="1" fill="currentColor" stroke="none" font-family="IBM Plex Mono, monospace">${esc(short(p.commit).toUpperCase())}</text>
    </g>
  </svg>`);
}

export function passportHTML(p, { fresh = false, guideHref = '' } = {}) {
  const v = String(p.verdict || '').toLowerCase();
  const [l1, l2] = mrzLines(p);
  const verified = new Date(p.verifiedAt);
  const vstr = isNaN(verified) ? '' : verified.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  const [org, name] = String(p.repo || '').split('/');
  return h`<figure class="passport v-${v} ${fresh ? 'fresh' : ''}" aria-label="Setup Passport for ${p.repo}">
    ${guilloche()}
    <header class="pp-head">
      <span class="pp-title">Setup Passport</span>
      <span class="pp-issuer">Issued by HUMBLE after a replay from zero</span>
    </header>
    <div class="pp-body">
      <div class="pp-portrait">${identicon(p.commit)}<span>${short(p.commit)}</span></div>
      <dl class="pp-fields">
        <div class="f f-wide"><dt>Repository</dt><dd class="pp-repo">${org}/<b>${name}</b></dd></div>
        <div class="f"><dt>Commit</dt><dd class="mono">${short(p.commit)}</dd></div>
        <div class="f"><dt>Runtime</dt><dd class="mono">${p.runtime}</dd></div>
        <div class="f f-wide"><dt>Runtime image</dt><dd class="mono">${p.image}</dd></div>
        ${p.verdict === 'VERIFIED'
          ? h`<div class="f f-hero f-wide"><dt>Clone to running</dt><dd><span class="pp-time">${secs(p.replaySeconds)}</span> <small>from zero</small></dd></div>`
          : p.verdict === 'NO-SETUP-DOCS'
          ? h`<div class="f f-hero f-wide"><dt>Setup commands</dt><dd><span class="pp-time pp-short">None found</span> <small>docs have no runnable setup steps</small></dd></div>`
          : p.verdict === 'INCONCLUSIVE'
          ? h`<div class="f f-hero f-wide"><dt>Setup commands</dt><dd><span class="pp-time pp-short">Inconclusive</span> <small>${p.humbleUnknowns} unknown failure${p.humbleUnknowns !== 1 ? 's' : ''} from HUMBLE (no rule matched)</small></dd></div>`
          : p.verdict === 'CI-ONLY'
          ? h`<div class="f f-hero f-wide"><dt>Clone to running</dt><dd><span class="pp-time">${secs(p.replaySeconds)}</span> <small>from zero (CI workflow)</small></dd></div>`
          : h`<div class="f f-hero f-wide"><dt>Clone to running</dt><dd><span class="pp-time pp-short">Not reached</span> <small>${p.replaySeconds ? `replay stopped after ${secs(p.replaySeconds)}` : 'no clean replay'}</small></dd></div>`}
        <div class="f f-tally f-wide"><dt>Breaks on a clean machine</dt><dd><span><b>${p.breaksFound}</b><small>found</small></span><span><b class="c-pass">${p.breaksFixed}</b><small>fixed</small></span><span><b class="${p.needsHuman ? 'c-human' : ''}">${p.needsHuman}</b><small>for a human</small></span></dd></div>
        <div class="f"><dt>Bobcoins spent</dt><dd class="c-bob">${p.bobcoins}</dd></div>
        <div class="f"><dt>Steps</dt><dd>${p.stepsTotal} <small>${p.stepsFromReadme} from README</small></dd></div>
        <div class="f f-wide"><dt>Verified at</dt><dd>${vstr}</dd></div>
      </dl>
      <div class="pp-stamp">${stampSVG(p, { size: 158 })}</div>
    </div>
    <footer class="mrz" aria-label="Machine-readable zone"><span>${l1}</span><span>${l2}</span></footer>
  </figure>
  ${guideHref ? h`<a class="pp-guide btn" href="${guideHref}">Open the newcomer guide</a>` : ''}`;
}
