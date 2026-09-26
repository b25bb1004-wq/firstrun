// Thinking Orbs — Dotted 3D thought-orb component ported from rareformlabs/thinking-orbs (MIT, Jakub Antalik)
// Adapted for HUMBLE multi-agent architecture:
// Six states mapped to six HUMBLE crew agents:
//   Scout:    'searching' (globe)
//   Planner:  'shaping'   (morph)
//   Runner:   'working'   (orbits)
//   Doctor:   'solving'   (rubik)
//   Verifier: 'listening' (wave)
//   Scribe:   'composing' (ribbon)

(function () {
  'use strict';

  // --- Primitives & Math ---
  function hashD(a, b) {
    const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return h - Math.floor(h);
  }

  function fibDir(i, n) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - (2 * (i + 0.5)) / n;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * golden;
    return [rad * Math.cos(a), y, rad * Math.sin(a)];
  }

  function angleDelta(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  function makeProj(yaw, tilt, cx, cy, scale) {
    const st = Math.sin(tilt);
    const ct = Math.cos(tilt);
    const sy = Math.sin(yaw);
    const cyw = Math.cos(yaw);
    return function (x, y, z) {
      const x1 = x * cyw + z * sy;
      const z1 = -x * sy + z * cyw;
      const y1 = y * ct - z1 * st;
      const z2 = y * st + z1 * ct;
      return [cx + x1 * scale, cy - y1 * scale, z2];
    };
  }

  function radiusScale(size, pow) {
    return Math.pow(size / 300, pow);
  }

  function paint(ctx, dots, dark, rMin, tintRgb) {
    if (rMin == null) rMin = 0.3;
    dots.sort((a, b) => a.z - b.z);
    const len = dots.length;
    for (let i = 0; i < len; i++) {
      const d = dots[i];
      const alpha = d.a != null ? d.a : 1;
      if (alpha < 0.02) continue;
      const w = Math.min(1, Math.max(0, d.white));
      if (tintRgb) {
        const factor = dark ? (0.35 + 0.65 * (1 - w)) : (0.2 + 0.8 * (1 - w));
        const r = Math.round(tintRgb[0] * factor);
        const g = Math.round(tintRgb[1] * factor);
        const b = Math.round(tintRgb[2] * factor);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      } else {
        const g = Math.round((dark ? 1 - w : w) * 255);
        ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
      }
      ctx.beginPath();
      ctx.arc(d.x, d.y, Math.max(rMin, d.r), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Profiles & Presets ---
  const COUNT_PAIRS = [
    ['latRings', 'lonDensity'],
    ['rings', 'lonDensity'],
    ['lanes', 'segs']
  ];
  const COUNT_KEYS = ['orbitN', 'ghostN'];
  const ICON_DENSITY_KEYS = ['iconD'];
  const RADIUS_KEYS = ['rBase', 'rDepth', 'rActive', 'rDot', 'ghostR', 'partR', 'partRDepth'];

  function scaleCounts(opts, scale) {
    const out = Object.assign({}, opts);
    const done = new Set();
    const rt = Math.sqrt(scale);
    for (const [a, b] of COUNT_PAIRS) {
      const va = out[a];
      const vb = out[b];
      if (va != null && vb != null && !done.has(a) && !done.has(b)) {
        out[a] = Math.max(2, Math.round(va * rt));
        out[b] = Math.max(2, Math.round(vb * rt));
        done.add(a);
        done.add(b);
      }
    }
    for (const k of COUNT_KEYS) {
      const v = out[k];
      if (v != null && !done.has(k)) out[k] = Math.max(1, Math.round(v * scale));
    }
    for (const k of ICON_DENSITY_KEYS) {
      const v = out[k];
      if (v != null) out[k] = Math.max(0.02, v * scale);
    }
    return out;
  }

  function scaleRadii(opts, scale) {
    const out = Object.assign({}, opts);
    for (const k of RADIUS_KEYS) {
      const v = out[k];
      if (v != null) out[k] = v * scale;
    }
    out.rSizeMul = (out.rSizeMul ?? 1) * scale;
    return out;
  }

  const BASE_PROFILES = {
    globe: { latRings: 17, lonDensity: 44, rBase: 0.6, rDepth: 1.7, rBoost: 1.0, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
    orbits: { orbitN: 12, ghostN: 40, ghostR: 0.9, ghostA: 0.5, particles: 3, partR: 1.2, partRDepth: 1.6, rsPow: 0.6, rMin: 0.3 },
    rubik: { latRings: 15, lonDensity: 40, moveCount: 14, rBase: 0.6, rDepth: 1.7, rActive: 0.3, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
    wave: { rings: 15, lonDensity: 40, rBase: 0.6, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    ribbon: { lanes: 5, segs: 88, ghostN: 150, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    morph: { rDot: 0.021, iconD: 1, rMin: 0.25 }
  };

  const PRESETS = {
    orbits: { 64: { speed: 1.885, count: 1, size: 1 }, 20: { speed: 3.9, count: 0.238, size: 2.4 } },
    globe: { 64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } }, 20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } } },
    rubik: { 64: { speed: 1.82, count: 0.35, size: 1.05 }, 20: { speed: 1.95, count: 0.088, size: 1.9 } },
    wave: { 64: { speed: 4.388, count: 0.341, size: 1 }, 20: { speed: 3.998, count: 0.105, size: 1.6 } },
    ribbon: { 64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } }, 20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } } },
    morph: { 64: { speed: 2.405, count: 0.54, size: 0.395, extra: { spread: 1.45 } }, 20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } } }
  };

  const STATE_TO_MODE = {
    working: 'orbits',
    searching: 'globe',
    solving: 'rubik',
    listening: 'wave',
    composing: 'ribbon',
    shaping: 'morph',
    // aliases matching agents
    scout: 'globe',
    planner: 'morph',
    runner: 'orbits',
    doctor: 'rubik',
    verifier: 'wave',
    scribe: 'ribbon'
  };

  const cache = new Map();
  function resolvePreset(state, size) {
    const mode = STATE_TO_MODE[state] || 'working';
    const targetSize = size <= 32 ? 20 : 64;
    const key = `${mode}-${targetSize}`;
    let resolved = cache.get(key);
    if (!resolved) {
      const preset = PRESETS[mode][targetSize];
      let opts = Object.assign({}, BASE_PROFILES[mode]);
      if (preset.count !== 1) opts = scaleCounts(opts, preset.count);
      if (preset.size !== 1) opts = scaleRadii(opts, preset.size);
      if (preset.extra) opts = Object.assign(opts, preset.extra);
      resolved = { mode, speed: preset.speed, opts };
      cache.set(key, resolved);
    }
    return resolved;
  }

  // --- Draw Modes ---

  // 1. Orbits (working / runner)
  function drawOrbits(ctx, size, t, dark, o, tint) {
    const cx = size / 2;
    const cy = size / 2;
    const R = (size / 2) * 0.82;
    const pt = makeProj(t * 0.12, 0.3, cx, cy, 1);
    const rs = radiusScale(size, o.rsPow ?? 0.6);
    const dots = [];
    const orbitN = o.orbitN ?? 12;
    const ghostN = o.ghostN ?? 40;
    const particles = o.particles ?? 3;

    for (let orb = 0; orb < orbitN; orb++) {
      const h1 = hashD(orb, 1.7);
      const h2 = hashD(orb, 5.2);
      const h3 = hashD(orb, 8.9);
      const ro = R * (0.45 + 0.52 * h1);
      const th = h1 * 2 * Math.PI;
      const phi = Math.acos(2 * h2 - 1);
      const nx = Math.sin(phi) * Math.cos(th);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(th);
      let ux = -ny, uy = nx, uz = 0;
      const ul = Math.max(1e-6, Math.sqrt(ux * ux + uy * uy));
      ux /= ul; uy /= ul;
      const vx = ny * uz - nz * uy;
      const vy = nz * ux - nx * uz;
      const vz = nx * uy - ny * ux;
      const speed = (0.25 + 0.55 * h3) * (h3 > 0.5 ? 1 : -1);

      for (let k = 0; k < ghostN; k++) {
        const a = (k / ghostN) * 2 * Math.PI;
        const [px, py, z] = pt(
          (ux * Math.cos(a) + vx * Math.sin(a)) * ro,
          (uy * Math.cos(a) + vy * Math.sin(a)) * ro,
          (uz * Math.cos(a) + vz * Math.sin(a)) * ro
        );
        const depth = (z / ro + 1) / 2;
        dots.push({
          x: px, y: py, z,
          r: (o.ghostR ?? 0.9) * rs,
          white: 0.72,
          a: (o.ghostA ?? 0.5) * (0.4 + 0.6 * depth)
        });
      }

      for (let m = 0; m < particles; m++) {
        const a = t * speed + (m / particles) * 2 * Math.PI + h2 * 6;
        const [px, py, z] = pt(
          (ux * Math.cos(a) + vx * Math.sin(a)) * ro,
          (uy * Math.cos(a) + vy * Math.sin(a)) * ro,
          (uz * Math.cos(a) + vz * Math.sin(a)) * ro
        );
        const depth = (z / ro + 1) / 2;
        dots.push({
          x: px, y: py, z,
          r: ((o.partR ?? 1.2) + (o.partRDepth ?? 1.6) * depth) * rs,
          white: 0.3 - 0.22 * depth
        });
      }
    }
    paint(ctx, dots, dark, o.rMin, tint);
  }

  // 2. Globe (searching / scout)
  function drawGlobe(ctx, size, t, dark, o, tint) {
    const spin = 0.5;
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) * 0.82;
    const tilt = 0.4 + 0.06 * Math.sin(t * 0.35);
    const pt = makeProj(t * spin, tilt, cx, cy, radius);
    const scan = t * (spin + (1.7 - spin) * (o.scanMul ?? 1));
    const rs = radiusScale(size, o.rsPow ?? 0.6);
    const dimBase = o.dimBase ?? 1;

    const dots = [];
    const latRings = o.latRings ?? 17;
    const lonDensity = o.lonDensity ?? 44;
    for (let li = 0; li <= latRings; li++) {
      const lat = -Math.PI / 2 + (li / latRings) * Math.PI;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      const lonCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
      for (let lj = 0; lj < lonCount; lj++) {
        const lon = (lj / lonCount) * 2 * Math.PI;
        const [px, py, z] = pt(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));
        const depth = (z + 1) / 2;
        const d = angleDelta(lon + t * spin, scan);
        const boost = Math.exp(-(d * d) / 0.18) * Math.max(0, z);
        dots.push({
          x: px, y: py, z,
          r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth + (o.rBoost ?? 1) * boost) * rs,
          white: (o.inkFar ?? 0.62) - (o.inkSpan ?? 0.54) * depth,
          a: dimBase + (1 - dimBase) * Math.min(1, boost)
        });
      }
    }
    paint(ctx, dots, dark, o.rMin, tint);
  }

  // 3. Rubik (solving / doctor)
  function solveCycle(time, count, slotDur, rest) {
    const cyc = 2 * count * slotDur + rest;
    const tc = time % cyc;
    const amount = new Array(count).fill(0);
    let active = -1;
    if (tc < 2 * count * slotDur) {
      const slot = Math.floor(tc / slotDur);
      const p = (tc - slot * slotDur) / slotDur;
      const cl = Math.min(1, p / 0.7);
      const ep = 1 - Math.pow(1 - cl, 3);
      if (slot < count) {
        for (let i = 0; i < slot; i++) amount[i] = 1;
        amount[slot] = ep;
        active = slot;
      } else {
        const u = 2 * count - 1 - slot;
        for (let i = 0; i < u; i++) amount[i] = 1;
        amount[u] = 1 - ep;
        active = u;
      }
    }
    return { amount, active };
  }

  function applyMoves(pt3, moves, sc) {
    let [x, y, z] = pt3;
    let inActive = false;
    for (let i = 0; i < moves.length; i++) {
      if (sc.amount[i] <= 0) continue;
      const mv = moves[i];
      const coord = mv.axis === 0 ? x : mv.axis === 1 ? y : z;
      if (coord < mv.lo || coord >= mv.hi) continue;
      if (i === sc.active) inActive = true;
      const a = mv.ang * sc.amount[i];
      const ca = Math.cos(a), sa = Math.sin(a);
      if (mv.axis === 0) {
        const y2 = y * ca - z * sa; z = y * sa + z * ca; y = y2;
      } else if (mv.axis === 1) {
        const x2 = x * ca + z * sa; z = -x * sa + z * ca; x = x2;
      } else {
        const x2 = x * ca - y * sa; y = x * sa + y * ca; x = x2;
      }
    }
    return [x, y, z, inActive];
  }

  function makeMoves(count) {
    const moves = [];
    for (let i = 0; i < count; i++) {
      const axis = Math.min(2, Math.floor(hashD(i, 2.3) * 3));
      const lo = -1.0 + 0.5 * Math.min(3, Math.floor(hashD(i, 5.9) * 4));
      const dir = hashD(i, 7.7) < 0.5 ? 1 : -1;
      moves.push({ axis, lo, hi: lo + 0.5, ang: (dir * Math.PI) / 2 });
    }
    return moves;
  }

  function drawRubik(ctx, size, t, dark, o, tint) {
    const cx = size / 2;
    const cy = size / 2;
    const R = (size / 2) * 0.82;
    const pt = makeProj(t * 0.55, 0.35 + 0.1 * Math.sin(t * 0.9), cx, cy, R);
    const rs = radiusScale(size, o.rsPow ?? 0.6);
    const moveCount = o.moveCount ?? 14;
    const moves = makeMoves(moveCount);
    const sc = solveCycle(t, moveCount, 0.42, 1.2);

    const dots = [];
    const latRings = o.latRings ?? 15;
    const lonDensity = o.lonDensity ?? 40;
    for (let li = 0; li <= latRings; li++) {
      const lat = -Math.PI / 2 + (li / latRings) * Math.PI;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      const lonCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
      for (let lj = 0; lj < lonCount; lj++) {
        const lon = (lj / lonCount) * 2 * Math.PI;
        const [x, y, z, inActive] = applyMoves([cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon)], moves, sc);
        const [px, py, zr] = pt(x, y, z);
        const depth = (zr + 1) / 2;
        dots.push({
          x: px, y: py, z: zr,
          r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth + (inActive ? (o.rActive ?? 0.3) : 0)) * rs,
          white: (o.inkFar ?? 0.62) - (o.inkSpan ?? 0.54) * depth - (inActive ? 0.14 : 0)
        });
      }
    }
    paint(ctx, dots, dark, o.rMin, tint);
  }

  // 4. Wave (listening / verifier)
  function drawWave(ctx, size, t, dark, o, tint) {
    const cx = size / 2;
    const cy = size / 2;
    const R = (size / 2) * 0.874;
    const pt = makeProj(t * 0.18, 0.38, cx, cy, 1);
    const rs = radiusScale(size, o.rsPow ?? 0.6);
    const dots = [];
    const rings = o.rings ?? 15;
    const lonDensity = o.lonDensity ?? 40;
    for (let ri = 0; ri <= rings; ri++) {
      const lat = -Math.PI / 2 + (ri / rings) * Math.PI;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      const w = 0.62 * Math.sin(t * 2.1 - ri * 0.52) + 0.38 * Math.sin(t * 1.27 + ri * 0.83);
      const rr = R * (0.88 + 0.105 * w);
      const lonCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));
      for (let lj = 0; lj < lonCount; lj++) {
        const lon = (lj / lonCount) * 2 * Math.PI;
        const [px, py, z] = pt(cosLat * Math.cos(lon) * rr, sinLat * rr, cosLat * Math.sin(lon) * rr);
        const depth = (z / R + 1) / 2;
        const crest = Math.max(0, w);
        dots.push({
          x: px, y: py, z,
          r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth) * (1 + 0.4 * crest) * rs,
          white: 0.66 - 0.56 * depth - 0.1 * crest
        });
      }
    }
    paint(ctx, dots, dark, o.rMin, tint);
  }

  // 5. Ribbon (composing / scribe)
  function drawRibbon(ctx, size, t, dark, o, tint) {
    const cx = size / 2;
    const cy = size / 2;
    const R = (size / 2) * 0.78;
    const spin = o.spin ?? 1;
    const pt = makeProj(t * 0.1 * spin, 0.3, cx, cy, 1);
    const rs = radiusScale(size, o.rsPow ?? 0.6);
    const dots = [];
    const ghostN = o.ghostN ?? 150;
    for (let i = 0; i < ghostN; i++) {
      const d = fibDir(i, ghostN);
      const [px, py, z] = pt(d[0] * R, d[1] * R, d[2] * R);
      const depth = (z / R + 1) / 2;
      dots.push({ x: px, y: py, z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth });
    }

    const ya = t * 0.24 * spin;
    const ta = 0.55 + 0.3 * Math.sin(t * 0.18) * spin;
    const ux = Math.cos(ya), uy = 0, uz = Math.sin(ya);
    const vx = -uz * Math.sin(ta), vy = Math.cos(ta), vz = ux * Math.sin(ta);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;

    const baseLanes = o.lanes ?? 5;
    const segs = o.segs ?? 88;
    const lanes = Math.max(1, Math.round(baseLanes * (o.bandMul ?? 1)));
    for (let w = 0; w < lanes; w++) {
      const laneOff = (w - (lanes - 1) / 2) * 0.075;
      const edge = Math.abs(w - (lanes - 1) / 2) / Math.max(1, (lanes - 1) / 2);
      for (let k = 0; k < segs; k++) {
        const a = (k / segs) * 2 * Math.PI;
        const wob =
          (0.16 * Math.sin(a * 3 - t * 1.7 + w * 0.22) + 0.07 * Math.sin(a * 5 + t * 1.1)) * (o.wobMul ?? 1);
        const off = laneOff + wob;
        const x = ux * Math.cos(a) + vx * Math.sin(a) + nx * off;
        const y = uy * Math.cos(a) + vy * Math.sin(a) + ny * off;
        const z = uz * Math.cos(a) + vz * Math.sin(a) + nz * off;
        const l = Math.sqrt(x * x + y * y + z * z);
        const [px, py, zr] = pt((x / l) * R, (y / l) * R, (z / l) * R);
        const depth = (zr / R + 1) / 2;
        dots.push({
          x: px, y: py, z: zr,
          r: ((o.rBase ?? 1.1) + (o.rDepth ?? 1.7) * depth) * (1 - 0.25 * edge) * rs,
          white: 0.52 - 0.44 * depth + 0.18 * edge,
          a: 0.4 + 0.6 * depth
        });
      }
    }
    paint(ctx, dots, dark, o.rMin, tint);
  }

  // 6. Morph (shaping / planner)
  function smoothE(x) { return x * x * (3 - 2 * x); }
  function polyPath(verts) {
    const V = verts.length;
    const L = [];
    let total = 0;
    for (let i = 0; i < V; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % V];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      L.push(l);
      total += l;
    }
    return function (f) {
      let target = f * total;
      let i = 0;
      while (target > L[i] && i < V - 1) {
        target -= L[i];
        i++;
      }
      const a = verts[i];
      const b = verts[(i + 1) % V];
      const ff = L[i] ? Math.min(1, target / L[i]) : 0;
      return [a[0] + (b[0] - a[0]) * ff, a[1] + (b[1] - a[1]) * ff];
    };
  }

  const CIRCLE = function (f) {
    const a = -Math.PI / 2 + f * 2 * Math.PI;
    return [Math.cos(a) * 0.24, Math.sin(a) * 0.24];
  };
  const TRIANGLE = polyPath([[0.0, -0.26], [0.24, 0.16], [-0.24, 0.16]]);
  const SQUARE = polyPath([[0, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [-0.2, -0.2]]);
  const CYCLE = [CIRCLE, TRIANGLE, SQUARE];

  function morphN(d) { return Math.max(6, Math.round(34 * d)); }
  const HOLD = 1.4, MORPH = 0.9, SEG = HOLD + MORPH;

  function drawMorph(ctx, size, t, dark, o, tint) {
    const K = CYCLE.length;
    const tc = t % (SEG * K);
    const k = Math.floor(tc / SEG);
    const local = tc - k * SEG;
    const m = local > HOLD ? smoothE((local - HOLD) / MORPH) : 0;
    const sprd = o.spread ?? 1;

    const pA = CYCLE[k];
    const pB = CYCLE[(k + 1) % K];
    const M = 160;
    const pts = [];
    for (let i = 0; i < M; i++) {
      const f = i / M;
      const a = pA(f), b = pB(f);
      pts.push([(a[0] + (b[0] - a[0]) * m) * sprd, (a[1] + (b[1] - a[1]) * m) * sprd]);
    }
    const L = [];
    let total = 0;
    for (let i = 0; i < M; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % M];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      L.push(l);
      total += l;
    }

    const n = morphN(o.iconD ?? 1);
    const re = (o.rDot ?? 0.021) * 1.35 * sprd;
    const pulse = 1 + 0.02 * Math.sin(local * 3.1);
    const dots = [];
    const c2 = size / 2;
    let seg = 0, acc = 0;
    for (let k2 = 0; k2 < n; k2++) {
      const target = (k2 / n) * total;
      while (acc + L[seg] < target && seg < M - 1) {
        acc += L[seg];
        seg++;
      }
      const a = pts[seg];
      const b = pts[(seg + 1) % M];
      const f = L[seg] ? Math.min(1, (target - acc) / L[seg]) : 0;
      const x = (a[0] + (b[0] - a[0]) * f) * pulse;
      const y = (a[1] + (b[1] - a[1]) * f) * pulse;
      dots.push({
        x: c2 + x * size,
        y: c2 + y * size,
        z: 0,
        r: Math.max(0.35, re * size),
        white: 0.1
      });
    }
    paint(ctx, dots, dark, o.rMin, tint);
  }

  const MODE_DRAWS = {
    orbits: drawOrbits,
    globe: drawGlobe,
    rubik: drawRubik,
    wave: drawWave,
    ribbon: drawRibbon,
    morph: drawMorph
  };

  // Palette only (docs/design/ANTI_VIBECODE.md): blue = scouting/proving, hot pink = running/breaking, ink for the Scribe.
  const BLUE = [36, 64, 255], DEEP = [27, 43, 184], PINK = [255, 45, 135];
  const AGENT_TINTS = {
    searching: BLUE, globe: BLUE,       // Scout
    shaping: DEEP, morph: DEEP,         // Planner
    working: PINK, orbits: PINK,        // Runner
    solving: PINK, rubik: PINK,         // Doctor
    listening: BLUE, wave: BLUE,        // Verifier
    composing: null, ribbon: null       // Scribe: plain ink
  };

  // --- ThinkingOrb Controller ---
  function createThinkingOrb(canvas, options = {}) {
    if (!canvas) return null;
    let state = options.state || canvas.dataset.orb || 'working';
    let size = options.size || parseInt(canvas.dataset.size, 10) || canvas.clientWidth || parseInt(canvas.getAttribute('width'), 10) || 64;
    let speed = options.speed || parseFloat(canvas.dataset.speed) || 1;
    let paused = !!options.paused;

    function resolveTint(st, optTint) {
      if (optTint === false || canvas.dataset.tint === 'none' || canvas.dataset.tint === 'mono') return null;
      if (Array.isArray(optTint)) return optTint;
      if (canvas.dataset.tint && canvas.dataset.tint.includes(',')) {
        return canvas.dataset.tint.split(',').map(Number);
      }
      return AGENT_TINTS[st] || null;
    }

    let tint = resolveTint(state, options.tint);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let raf = 0;
    let running = false;
    let visible = true;

    function isDark() {
      const dt = document.documentElement.dataset.theme;
      if (dt === 'dark') return true;
      if (dt === 'light') return false;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function isReduced() {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function render(tSec) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(size * dpr);
      const h = Math.round(size * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const resolved = resolvePreset(state, size);
      const draw = MODE_DRAWS[resolved.mode] || drawOrbits;
      const dark = isDark();
      draw(ctx, size, tSec, dark, resolved.opts, tint);
    }

    function loop() {
      const resolved = resolvePreset(state, size);
      const effSpeed = resolved.speed * speed;
      const t = (performance.now() / 1000) * effSpeed;
      render(t);
      if (running) raf = requestAnimationFrame(loop);
    }

    function start() {
      if (running || paused || isReduced()) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    }

    // Visibility & Viewport Intersection
    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && document.visibilityState !== 'hidden') start();
        else stop();
      });
      io.observe(canvas);
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else if (visible) start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Initial paint
    render(0.6);
    if (!isReduced()) start();

    return {
      setState(newState, newTint) {
        state = newState;
        tint = newTint !== undefined ? newTint : resolveTint(state, options.tint);
        render(0.6);
      },
      setSize(newSize) {
        size = newSize;
        render(0.6);
      },
      setTint(newTint) {
        tint = newTint;
        render(0.6);
      },
      start,
      stop,
      destroy() {
        stop();
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }

  // Auto-init all canvases with [data-orb]
  function initAll() {
    const list = document.querySelectorAll('canvas[data-orb]');
    const orbs = [];
    list.forEach(c => {
      orbs.push(createThinkingOrb(c));
    });
    return orbs;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Expose globally
  window.ThinkingOrb = {
    create: createThinkingOrb,
    initAll: initAll,
    STATE_TO_MODE: STATE_TO_MODE
  };
})();
