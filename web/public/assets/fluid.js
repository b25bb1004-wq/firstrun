// Site-wide liquid background (after alche.studio): one fixed WebGL canvas behind every section, a faint paper texture
// in the page colour. Around the cursor, and only there, the texture is bent: moving the pointer smears it along the
// direction of travel in a small, irregular (noise-edged, not circular) patch that settles within a second; at rest a
// faint still warp stays under the cursor. Nothing spreads across the page. Computed analytically from a short trail
// of recent pointer points (no simulation buffers); the canvas only animates while the trail is fading, so an idle
// page costs nothing. Reduced motion, touch or no WebGL: the plain page colour.
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'fluid-bg';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return;
  document.body.insertBefore(canvas, document.body.firstChild);
  document.documentElement.classList.add('has-fluid');

  var N = 16;          // pointer trail length
  var LIFE = 0.7;      // seconds a trail point keeps bending the texture
  var VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FS = [
    'precision mediump float;',
    'uniform float uTime; uniform vec3 uBg; uniform float uDark; uniform float uR;',
    'uniform vec3 uPts[' + N + '];', // x, y (canvas px), birth time (s)
    'uniform vec2 uVel[' + N + '];', // pointer travel at that point (canvas px)
    'uniform vec3 uCur;',            // cursor x, y (canvas px), resting-warp strength 0..1
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }',
    // Irregular falloff: a gaussian whose radius wobbles with noise, so the patch has a soft, uneven edge.
    'float patch(vec2 d, float seed){ float n = noise(d / (uR * 0.55) + seed); return exp(-dot(d, d) / (uR * uR) * (0.55 + 1.1 * n)); }',
    'void main(){',
    '  vec2 px = gl_FragCoord.xy;',
    '  vec2 disp = vec2(0.0); float lens = 0.0;',
    '  for (int i = 0; i < ' + N + '; i++) {',
    '    vec3 q = uPts[i]; float age = uTime - q.z;',
    '    if (q.z < 0.0 || age < 0.0 || age > ' + LIFE.toFixed(2) + ') continue;',
    '    float fade = 1.0 - age / ' + LIFE.toFixed(2) + '; fade *= fade;',
    '    float f = patch(px - q.xy, q.z * 3.7) * fade;',
    '    disp += uVel[i] * f; lens += f;',
    '  }',
    // Resting warp: a gentle inward pinch under a still cursor.
    '  if (uCur.z > 0.0) { vec2 d = px - uCur.xy; float f = patch(d, 11.0) * uCur.z; disp -= d * f * 0.18; lens += f * 0.6; }',
    '  lens = min(lens, 1.5);',
    // Paper-like tone everywhere; near the cursor a finer grain shows through, sampled through the displacement, so
    // the texture visibly bends (refraction) instead of just darkening. The bent grain is centred on zero, so the patch
    // neither lightens nor darkens the page on average; a faint glint on the leading edge catches the light.
    '  float tex = fbm(px / 260.0) - 0.5;',
    '  float k = min(lens, 1.0);',
    '  float grain = fbm((px - disp * 3.0) / 46.0) - fbm(px / 46.0 + 17.0);',
    '  float glint = dot(disp, vec2(-0.6, 0.8)) * 0.0025 * k;',
    '  float shade = tex * 0.05 + grain * 0.16 * k + glint;',
    '  vec3 col = uBg + (uDark > 0.5 ? shade * 0.8 : shade) * vec3(1.0, 0.96, 0.9);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { canvas.remove(); document.documentElement.classList.remove('has-fluid'); return; }
  var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); document.documentElement.classList.remove('has-fluid'); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['uTime', 'uBg', 'uDark', 'uR', 'uPts', 'uVel', 'uCur'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  // Render at a reduced scale: the texture is soft, so full resolution buys nothing but cost.
  var SCALE = 0.5, RADIUS = 56, W = 0, H = 0; // RADIUS: size of the bent patch, in CSS px
  var pts = new Float32Array(N * 3), vel = new Float32Array(N * 2); for (var i = 0; i < N; i++) pts[i * 3 + 2] = -1;
  var head = 0, t0 = performance.now(), raf = 0, lastDrop = 0, follow = null, target = null, rest = 0;
  var bg = [0.94, 0.91, 0.85], dark = 0;
  var now = function () { return (performance.now() - t0) / 1000; };

  function readBg() {
    var c = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#efe7da';
    var m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) { var n = parseInt(m[1], 16); bg = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
    dark = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
  }
  function resize() {
    W = Math.max(1, Math.round(innerWidth * SCALE)); H = Math.max(1, Math.round(innerHeight * SCALE));
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
    readBg(); draw();
  }
  function draw() {
    gl.uniform1f(U.uTime, now()); gl.uniform3f(U.uBg, bg[0], bg[1], bg[2]); gl.uniform1f(U.uDark, dark);
    gl.uniform1f(U.uR, RADIUS * SCALE);
    gl.uniform3fv(U.uPts, pts); gl.uniform2fv(U.uVel, vel);
    if (follow) gl.uniform3f(U.uCur, follow[0] * SCALE, (innerHeight - follow[1]) * SCALE, rest);
    else gl.uniform3f(U.uCur, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function alive() { var t = now(); for (var i = 0; i < N; i++) { var b = pts[i * 3 + 2]; if (b >= 0 && t - b < LIFE) return true; } return false; }
  function loop() {
    raf = 0;
    var moving = false;
    if (target) {
      // The warp trails the cursor slightly, which is what makes it read as liquid rather than a stamp.
      if (!follow) follow = target.slice();
      var dx = (target[0] - follow[0]) * 0.25, dy = (target[1] - follow[1]) * 0.25;
      follow[0] += dx; follow[1] += dy;
      moving = Math.hypot(target[0] - follow[0], target[1] - follow[1]) > 0.5;
      var t = now();
      if (Math.hypot(dx, dy) > 0.8 && t - lastDrop > 0.03) {
        var k = Math.min(1, 18 / Math.hypot(dx, dy)); // cap how far one point can push the texture
        pts[head * 3] = follow[0] * SCALE; pts[head * 3 + 1] = (innerHeight - follow[1]) * SCALE; pts[head * 3 + 2] = t;
        vel[head * 2] = dx * k * SCALE; vel[head * 2 + 1] = -dy * k * SCALE;
        head = (head + 1) % N; lastDrop = t;
      }
      // The resting warp fades out while moving and back in once the cursor settles.
      rest += ((moving ? 0 : 1) - rest) * 0.08;
    }
    draw();
    var settling = Math.abs((moving ? 0 : 1) - rest) > 0.01;
    if (!document.hidden && (alive() || moving || settling)) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }

  addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; target = [e.clientX, e.clientY]; kick(); }, { passive: true });
  // Pointer leaves the window: let the warp fade instead of leaving it stuck at the edge.
  document.addEventListener('pointerleave', function () { target = null; follow = null; rest = 0; kick(); });
  addEventListener('resize', resize);
  var themeBtn = document.getElementById('theme');
  if (themeBtn) themeBtn.addEventListener('click', function () { setTimeout(function () { readBg(); draw(); }, 30); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  resize();
})();
