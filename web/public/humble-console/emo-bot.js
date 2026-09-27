/**
 * HUMBLE's mascot: a small hovering robot with an EMO-style LED face.
 *
 * - Body: real 3D (three.js, lazy-loaded from jsDelivr only when the bot is on screen,
 *   so it never counts against the first-load JS budget).
 * - Face: a dark glass visor showing a blue LED dot-matrix. Only lit pixels glow;
 *   the unlit grid stays faintly visible. Eyes blink, dart and change shape per state.
 * - Fallback: the same LED face drawn flat on a canvas (no WebGL, reduced motion,
 *   or the CDN is unreachable). The face is the character, so the fallback keeps it.
 *
 * API: const bot = new EmoBot(el, { size: 140 }); bot.setState('think'); bot.look(dx, dy);
 * States: sleep think talk point celebrate worried idle
 */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const INK = '#0d1030';
const BLUE = '#3b5bff';      // lit LED (electric blue, a touch lighter so it reads as light)
const BLUE_HOT = '#9fb2ff';  // LED core
const PINK = '#f0287a';      // worried tint
const GRID_W = 24, GRID_H = 12;

// ---------------------------------------------------------------- LED face

/** Eye shapes per state, as functions of (x, y, t) on a 24x12 grid -> lit? */
function eyeMask(state, t, blinkAmt, gaze) {
  const gx = Math.round(gaze.x * 2), gy = Math.round(gaze.y * 1);
  const eyes = [{ cx: 7 + gx, cy: 6 + gy }, { cx: 16 + gx, cy: 6 + gy }];
  const W = 3; // eye half-width in pixels
  const open = 1 - blinkAmt; // 1 open, 0 shut
  return (x, y) => {
    for (const e of eyes) {
      const dx = x - e.cx, dy = y - e.cy;
      switch (state) {
        case 'sleep': // flat lines
          if (dy === 1 && Math.abs(dx) <= 2) return true;
          break;
        case 'celebrate': { // ^ ^ arcs
          const ax = Math.abs(dx);
          if (ax <= 3 && dy === -1 + ax && dy <= 1) return true;
          break;
        }
        case 'worried': { // slanted, drooping outward
          const tilt = e.cx < 12 ? dx : -dx;
          const h = Math.max(1, Math.round(3 * open));
          if (Math.abs(dx) <= 2 && dy >= -h + Math.round(tilt / 2) && dy <= h - 1) return true;
          break;
        }
        case 'think': { // eyes narrowed and glancing up-right
          const h = Math.max(1, Math.round(2 * open));
          if (Math.abs(dx - 1) <= 2 && dy >= -h - 1 && dy <= h - 2) return true;
          break;
        }
        default: { // idle / talk / point: two rounded rectangles
          const bounce = state === 'talk' ? Math.round(Math.sin(t * 9) * 0.6) : 0;
          const h = Math.max(1, Math.round(4.2 * open));
          if (Math.abs(dx) <= W - 1 + (dx > 0 ? 0 : 1) && dx <= W - 1 && dx >= -W && dy + bounce >= -h && dy + bounce <= h - 1) {
            const corner = (dx === -W || dx === W - 1) && (dy + bounce === -h || dy + bounce === h - 1);
            if (!corner || h < 2) return true;
          }
        }
      }
    }
    // thinking: a small loading dot that orbits under the eyes
    if (state === 'think') {
      const k = Math.floor(t * 4) % 3;
      if (y === 10 && x === 10 + k * 2) return true;
    }
    // sleeping: a pixel 'z' drifting up at the right
    if (state === 'sleep') {
      const zy = 8 - (Math.floor(t * 1.5) % 7), zx = 21;
      const z = [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]];
      if (zy >= 0 && z.some(([a, b]) => x === zx + a - 1 && y === zy + b - 1)) return true;
    }
    return false;
  };
}

/** Draws the LED face into a 2D canvas context. */
function drawFace(ctx, w, h, state, t, blinkAmt, gaze) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  const cell = Math.min(w / (GRID_W + 2), h / (GRID_H + 2));
  const ox = (w - cell * GRID_W) / 2, oy = (h - cell * GRID_H) / 2;
  const lit = eyeMask(state, t, blinkAmt, gaze);
  const hue = state === 'worried' ? PINK : BLUE;
  const flicker = 0.92 + 0.08 * Math.sin(t * 50); // subtle refresh shimmer
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const px = ox + x * cell + cell * 0.12, py = oy + y * cell + cell * 0.12, s = cell * 0.76;
      if (lit(x, y)) {
        ctx.shadowColor = hue; ctx.shadowBlur = cell * 1.1;
        ctx.fillStyle = hue; ctx.globalAlpha = flicker;
        roundRect(ctx, px, py, s, s, s * 0.3); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 0.55 * flicker;
        ctx.fillStyle = BLUE_HOT;
        roundRect(ctx, px + s * 0.25, py + s * 0.25, s * 0.5, s * 0.5, s * 0.2); ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(120,140,255,0.07)'; // faint unlit grid
        roundRect(ctx, px, py, s, s, s * 0.3); ctx.fill();
      }
    }
  }
  // scanline
  const sy = ((t * 40) % (h + 20)) - 10;
  const g = ctx.createLinearGradient(0, sy - 6, 0, sy + 6);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(160,180,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, sy - 6, w, 12);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------------------------------------------------------------- the bot

export class EmoBot {
  constructor(container, { size = 140, interactive = true } = {}) {
    this.el = container;
    this.size = size;
    this.state = 'idle';
    this.gaze = { x: 0, y: 0 };
    this.targetGaze = { x: 0, y: 0 };
    this.blinkAmt = 0;
    this.nextBlink = performance.now() + 2500;
    this.t0 = performance.now();
    this.running = false;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.el.classList.add('emo-bot');
    this.el.style.width = this.el.style.height = size + 'px';
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', 'HUMBLE mascot');
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 256; this.faceCanvas.height = 128;
    this.faceCtx = this.faceCanvas.getContext('2d');
    if (interactive && !this.reduced) {
      this._onMove = (e) => {
        const r = this.el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
        const dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
        this.targetGaze = { x: Math.max(-1, Math.min(1, dx * 3)), y: Math.max(-1, Math.min(1, dy * 3)) };
      };
      addEventListener('pointermove', this._onMove, { passive: true });
    }
    this._visible = false;
    this._io = new IntersectionObserver((es) => {
      this._visible = es.some((e) => e.isIntersecting);
      if (this._visible && !this._booted) this._boot();
      if (this._visible) this._start(); else this.running = false;
    });
    this._io.observe(this.el);
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.el.dataset.state = state;
    if (state === 'point') this.targetGaze = { x: 1, y: 0.2 };
    if (state === 'celebrate') this._hop = performance.now();
    if (this.reduced || !this._three) this._drawFlat();
  }

  look(dx, dy) { this.targetGaze = { x: dx, y: dy }; }

  async _boot() {
    this._booted = true;
    if (this.reduced || !hasWebGL()) return this._mountFlat();
    try {
      const THREE = await import(/* webpackIgnore: true */ THREE_URL);
      this._mount3D(THREE);
    } catch {
      this._mountFlat();
    }
  }

  // Flat fallback: the LED face in a rounded ink screen.
  _mountFlat() {
    this.el.innerHTML = '';
    const c = this.faceCanvas;
    c.className = 'emo-face-flat';
    Object.assign(c.style, { width: '100%', height: '50%', marginTop: '25%', borderRadius: '18%', display: 'block', background: INK });
    this.el.appendChild(c);
    this._drawFlat();
  }
  _drawFlat() {
    if (!this.faceCtx) return;
    drawFace(this.faceCtx, 256, 128, this.state === 'idle' ? 'idle' : this.state, 0, 0, this.gaze);
  }

  _mount3D(THREE) {
    this._three = THREE;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(this.size, this.size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.el.innerHTML = '';
    this.el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 50);
    camera.position.set(0, 0.55, 7.0);
    camera.lookAt(0, 0.25, 0);

    // light: soft key, cool rim, warm fill from below
    scene.add(new THREE.HemisphereLight(0xf4ede3, 0x1a1f45, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f8bff, 2.4); rim.position.set(-3, 1.5, -2.5); scene.add(rim);

    const shell = new THREE.MeshPhysicalMaterial({ color: 0xf2eee8, roughness: 0.42, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.35 });
    const trim = new THREE.MeshPhysicalMaterial({ color: 0x0d1030, roughness: 0.35, metalness: 0.2, clearcoat: 0.8 });

    const bot = new THREE.Group(); scene.add(bot);

    // head: a soft rounded block (EMO proportions: big head, small body)
    const head = new THREE.Mesh(roundedBox(THREE, 2.2, 1.6, 1.5, 0.42), shell);
    head.position.y = 0.55; bot.add(head);

    // visor: dark glass screen carrying the LED texture
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: this.faceTex, emissive: 0xffffff, emissiveMap: this.faceTex, emissiveIntensity: 1.25,
      roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05,
    });
    const visor = new THREE.Mesh(roundedPlane(THREE, 1.78, 1.06, 0.26), visorMat);
    visor.position.set(0, 0.55, 0.755); bot.add(visor);
    const bezel = new THREE.Mesh(roundedPlane(THREE, 1.9, 1.18, 0.3), trim);
    bezel.position.set(0, 0.55, 0.752); bot.add(bezel);

    // ear pods
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 32), trim);
      ear.rotation.z = Math.PI / 2; ear.position.set(s * 1.16, 0.55, 0); bot.add(ear);
    }

    // antenna with a lantern tip (the pointing light)
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 12), trim);
    stalk.position.set(0.55, 1.55, 0); bot.add(stalk);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x1f3bff, emissive: 0x3b5bff, emissiveIntensity: 1.6, toneMapped: false });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), tipMat);
    tip.position.set(0.55, 1.8, 0); bot.add(tip);

    // body: small rounded torso with a belly lantern, no legs (it hovers)
    const body = new THREE.Mesh(roundedBox(THREE, 1.2, 0.85, 1.0, 0.32), shell);
    body.position.y = -0.62; bot.add(body);
    const belly = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ color: 0x2a47ff, toneMapped: false }));
    belly.position.set(0, -0.6, 0.505); bot.add(belly);
    const lamp = new THREE.PointLight(0x3b5bff, 1.4, 3); lamp.position.set(0, -0.6, 0.8); bot.add(lamp);

    // little arms
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 12), shell);
      arm.position.set(s * 0.72, -0.6, 0); arm.rotation.z = s * 0.35; bot.add(arm); arms.push(arm);
    }

    // hover thruster glow + contact shadow on the "floor"
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ color: 0x3b5bff, transparent: true, opacity: 0.35 }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(0, -1.1, 0); bot.add(glow);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ map: radialTex(THREE), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.55; scene.add(shadow);

    Object.assign(this, { renderer, scene, camera, bot, head, arms, tip, tipMat, lamp, shadow, glow });
    this._start();
  }

  _start() {
    if (this.running || !this._visible) return;
    this.running = true;
    let last = 0;
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const idle = this.state === 'sleep' || this.state === 'idle';
      if (idle && now - last < 1000 / 30) return; // 30 fps when idle
      last = now;
      this._frame(now);
    };
    requestAnimationFrame(loop);
  }

  _frame(now) {
    const t = (now - this.t0) / 1000;
    // blink: close+open in ~120 ms every 3-6 s, sometimes twice
    if (now > this.nextBlink) {
      const p = (now - this.nextBlink) / 120;
      this.blinkAmt = p < 0.5 ? p * 2 : Math.max(0, 2 - p * 2);
      if (p >= 1) {
        this.blinkAmt = 0;
        this.nextBlink = now + (Math.random() < 0.2 ? 180 : 3000 + Math.random() * 3000);
      }
    }
    // gaze eases toward its target
    this.gaze.x += (this.targetGaze.x - this.gaze.x) * 0.12;
    this.gaze.y += (this.targetGaze.y - this.gaze.y) * 0.12;
    const faceState = this.state === 'idle' ? 'idle' : this.state;
    drawFace(this.faceCtx, 256, 128, faceState, t, this.state === 'sleep' ? 0 : this.blinkAmt, this.gaze);
    if (!this._three) return;
    this.faceTex.needsUpdate = true;

    // hover: a gentle bob; sleeping sinks and slows; celebrating hops once
    const sleep = this.state === 'sleep';
    let y = Math.sin(t * (sleep ? 1.1 : 2)) * (sleep ? 0.03 : 0.08) - (sleep ? 0.12 : 0);
    if (this._hop) {
      const h = (now - this._hop) / 600;
      if (h < 1) y += Math.sin(h * Math.PI) * 0.35; else this._hop = 0;
    }
    this.bot.position.y = y;
    // banks toward where it's looking; worried: a small shiver
    const shiver = this.state === 'worried' ? Math.sin(t * 40) * 0.015 : 0;
    this.bot.rotation.y = this.gaze.x * 0.35;
    this.bot.rotation.x = -this.gaze.y * 0.15;
    this.bot.rotation.z = -this.gaze.x * 0.08 + shiver;
    // arms: wave on celebrate, point forward-right on point
    const [la, ra] = this.arms;
    la.rotation.z = -0.35 + (this.state === 'celebrate' ? Math.sin(t * 12) * 0.5 : 0);
    ra.rotation.z = 0.35 + (this.state === 'celebrate' ? -Math.sin(t * 12) * 0.5 : this.state === 'point' ? 1.2 : 0);
    // lantern: flickers when worried, bright when pointing
    const base = this.state === 'point' ? 2.6 : this.state === 'worried' ? 1.0 + Math.random() * 0.8 : sleep ? 0.4 : 1.4;
    this.lamp.intensity = base;
    this.tipMat.emissiveIntensity = base * 1.1;
    this.tipMat.emissive.set(this.state === 'worried' ? 0xf0287a : 0x3b5bff);
    // contact shadow tightens as it rises
    const s = 1 - y * 0.6;
    this.shadow.scale.set(s, s, s);
    this.shadow.material.opacity = 0.55 - y * 0.4;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.running = false;
    this._io?.disconnect();
    if (this._onMove) removeEventListener('pointermove', this._onMove);
    this.renderer?.dispose();
    this.el.innerHTML = '';
  }
}

// ---------------------------------------------------------------- geometry helpers

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

function roundedBox(THREE, w, h, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const bevel = Math.min(r, d / 2) * 0.9;
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 8, curveSegments: 16 });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

function roundedPlane(THREE, w, h, r) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(shape, 16);
  // UVs 0..1 across the plane so the LED texture fills the screen
  const pos = g.attributes.position, uv = [];
  for (let i = 0; i < pos.count; i++) uv.push((pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

function radialTex(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d').createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(13,16,48,0.45)'); g.addColorStop(1, 'rgba(13,16,48,0)');
  const ctx = c.getContext('2d'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// exported for tests
export const _internal = { eyeMask, GRID_W, GRID_H };
