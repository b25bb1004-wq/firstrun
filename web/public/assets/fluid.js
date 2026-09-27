// Site-wide liquid background (after alche.studio): one fixed WebGL canvas behind every section. The pointer drops
// ripples that spread and fade a beat behind the cursor, bending a faint paper texture in the page colour. Ripples
// are computed analytically from a trail of recent pointer points (no simulation buffers), and the canvas only draws
// while ripples are alive, so an idle page costs nothing. Reduced motion or no WebGL: the plain page colour.
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'fluid-bg';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return;
  document.body.insertBefore(canvas, document.body.firstChild);
  document.documentElement.classList.add('has-fluid');

  var N = 24; // pointer trail length
  var VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FS = [
    'precision mediump float;',
    'uniform vec2 uRes; uniform float uTime; uniform vec3 uBg; uniform float uDark;',
    'uniform vec3 uPts[' + N + '];', // x, y (px), birth time (s)
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }',
    'void main(){',
    '  vec2 px = gl_FragCoord.xy;',
    '  float h = 0.0; vec2 grad = vec2(0.0);',
    '  for (int i = 0; i < ' + N + '; i++) {',
    '    vec3 q = uPts[i]; float age = uTime - q.z;',
    '    if (q.z < 0.0 || age < 0.0 || age > 2.4) continue;',
    '    vec2 d = px - q.xy; float r = length(d) + 0.001;',
    '    float front = age * 240.0;',                       // the ring expands at 240 px/s
    '    float w = exp(-pow((r - front) / 38.0, 2.0)) * exp(-age * 1.6) * exp(-r * 0.0022);',
    '    float s = sin((r - front) * 0.09);',
    '    h += s * w; grad += (d / r) * cos((r - front) * 0.09) * w;',
    '  }',
    // Paper-like tone bent by the ripple slope; light catches the slopes.
    '  vec2 uv = (px + grad * 55.0) / 260.0;',
    '  float tex = fbm(uv) - 0.5;',
    '  float shade = tex * 0.05 + h * 0.08 + dot(grad, vec2(-0.6, 0.8)) * 0.13;',
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
  var U = {}; ['uRes', 'uTime', 'uBg', 'uDark', 'uPts'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  // Render at a reduced scale: the texture is soft, so full resolution buys nothing but cost.
  var SCALE = 0.5, W = 0, H = 0;
  var pts = new Float32Array(N * 3); for (var i = 0; i < N; i++) pts[i * 3 + 2] = -1;
  var head = 0, t0 = performance.now(), raf = 0, lastDrop = 0, follow = null, target = null, bg = [0.94, 0.91, 0.85], dark = 0;
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
    var t = now();
    gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uTime, t); gl.uniform3f(U.uBg, bg[0], bg[1], bg[2]); gl.uniform1f(U.uDark, dark);
    gl.uniform3fv(U.uPts, pts);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function alive() { var t = now(); for (var i = 0; i < N; i++) { var b = pts[i * 3 + 2]; if (b >= 0 && t - b < 2.4) return true; } return false; }
  function loop() {
    raf = 0;
    // The drop point trails the cursor (the "delay"): it eases toward the pointer and drops a ripple as it moves.
    if (target) {
      if (!follow) follow = target.slice();
      follow[0] += (target[0] - follow[0]) * 0.12; follow[1] += (target[1] - follow[1]) * 0.12;
      var t = now(), moved = Math.hypot(target[0] - follow[0], target[1] - follow[1]);
      if (moved > 1.5 && t - lastDrop > 0.06) {
        pts[head * 3] = follow[0] * SCALE; pts[head * 3 + 1] = (innerHeight - follow[1]) * SCALE; pts[head * 3 + 2] = t;
        head = (head + 1) % N; lastDrop = t;
      }
    }
    draw();
    if (!document.hidden && (alive() || (target && follow && Math.hypot(target[0] - follow[0], target[1] - follow[1]) > 0.5))) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }

  addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; target = [e.clientX, e.clientY]; kick(); }, { passive: true });
  addEventListener('resize', resize);
  var themeBtn = document.getElementById('theme');
  if (themeBtn) themeBtn.addEventListener('click', function () { setTimeout(function () { readBg(); draw(); }, 30); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  resize();
})();
