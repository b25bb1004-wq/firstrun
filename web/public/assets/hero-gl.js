// HUMBLE hero, GPU edition: tens of thousands of particles, all motion computed in the vertex shader (stateless, so
// it costs almost nothing on the CPU). Story: agent-coloured turbulence (drifted docs) → a wavefront sweeps left to
// right "writing" a README page in dense word-shaped glyph rows → one line flares red (the break) → turns green (the
// fix). Scrolling tilts the page back in 3D. The pointer carves a hole through the ink. Falls back to the 2D canvas
// version (hero-field.js) when WebGL isn't available; reduced motion renders the finished page once.
(function () {
  var hero = document.querySelector('.hero-full');
  if (!hero) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.createElement('canvas');
  canvas.className = 'field';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) { var s = document.createElement('script'); s.src = '/assets/hero-field.js'; document.body.appendChild(s); return; }
  hero.insertBefore(canvas, hero.firstChild);

  var VS = [
    'precision highp float;',
    'attribute vec2 aTarget; attribute vec4 aSeed; attribute float aColor; attribute float aFix;',
    'uniform float uTime, uOrder, uAlarm, uFixed, uScroll, uDpr, uMobile, uLight; uniform vec2 uRes, uMouse; uniform vec4 uClear;',
    'varying vec3 vCol; varying float vAlpha;',
    'vec3 agent(float i){',
    '  if(i<0.5) return vec3(0.14,0.25,1.0); if(i<1.5) return vec3(0.11,0.17,0.72); if(i<2.5) return vec3(1.0,0.37,0.66);',
    '  if(i<3.5) return vec3(1.0,0.18,0.53); if(i<4.5) return vec3(0.24,0.45,1.0); return vec3(1.0,0.55,0.78); }',
    'void main(){',
    '  float t = uTime * 0.55;',
    // An immersive volume, not text: every particle lives on a depth layer (aSeed.z: 0 near, 1 far) and drifts
    // on slow layered swirls. Near layers are larger, brighter and move more; far layers are small and dim.
    '  float zd = aSeed.z;',
    '  vec2 home = aSeed.xy * uRes * vec2(1.3, 1.25) - uRes * vec2(0.15, 0.12);',
    '  float calm = mix(1.0, 0.45, uOrder);',
    '  vec2 sw = vec2(sin(t*0.37*(0.6+zd) + home.y*0.003 + aSeed.w*6.28) + sin(t*0.21 + home.x*0.0025),',
    '                 cos(t*0.33*(0.6+zd) + home.x*0.003 + aSeed.w*6.28) + cos(t*0.19 + home.y*0.003));',
    '  vec2 p = home + sw * (60.0 + 80.0*(1.0-zd)) * calm;',
    // Depth projection around the centre, pointer parallax (near layers shift more), scroll pushes the layers apart.
    '  vec2 ctr = uRes * 0.5;',
    '  float persp = 1.0 / (1.0 + zd * 0.9 + uScroll * (0.6 + zd));',
    '  vec2 look = (uMouse.x < -1000.0) ? vec2(0.0) : (uMouse - ctr);',
    '  vec2 q = ctr + (p - ctr) * persp - look * (0.05 * (1.0 - zd)) - vec2(0.0, uScroll * uRes.y * 0.15);',
    // The pointer opens a gap exactly where the cursor is: repel in screen space, after the projection.
    '  vec2 d = q - uMouse; float dist = length(d); float R = 120.0 * (1.2 - zd*0.5);',
    '  q += (dist < R ? normalize(d + 0.0001) * (R - dist) * 0.6 : vec2(0.0));',
    '  gl_Position = vec4((q / uRes) * 2.0 - 1.0, 0.0, 1.0); gl_Position.y *= -1.0;',
    '  gl_PointSize = mix(3.4, 1.1, zd) * uDpr * (0.8 + 0.2*persp);',
    // Colour: a palette burst at first that calms into oat; about one particle in eight keeps its blue or pink.
    '  vec3 ink = uLight > 0.5 ? vec3(0.64,0.54,0.39) : vec3(0.94,0.91,0.85);',
    '  float accent = step(0.875, fract(aSeed.w * 7.13));',
    '  vCol = mix(agent(aColor), ink, uOrder * (1.0 - accent) * 0.95);',
    '  vAlpha = mix(0.95, 0.28, zd);',
    '  vec2 inC = smoothstep(uClear.xy - 28.0, uClear.xy + 10.0, q) * (1.0 - smoothstep(uClear.zw - 10.0, uClear.zw + 28.0, q));',
    '  vAlpha *= 1.0 - 0.85 * inC.x * inC.y;',
    '  vAlpha *= (1.0 - uScroll*0.85) * (uMobile > 0.5 ? 0.8 : 1.0);',
    '}'
  ].join('\n');
  var FS = [
    'precision mediump float; varying vec3 vCol; varying float vAlpha;',
    'void main(){ vec2 c = gl_PointCoord - 0.5; float r2 = dot(c,c); if(r2 > 0.25) discard;',
    '  float d = sqrt(r2) * 2.0;',
    '  float core = 1.0 - smoothstep(0.0, 0.65, d);',
    '  float bloom = (1.0 - d) * 0.35;',
    '  gl_FragColor = vec4(vCol, vAlpha * (core + bloom)); }'
  ].join('\n');

  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  var prog;
  try {
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { canvas.remove(); var f = document.createElement('script'); f.src = '/assets/hero-field.js'; document.body.appendChild(f); return; }
  gl.useProgram(prog);
  var U = {}; ['uTime', 'uOrder', 'uAlarm', 'uFixed', 'uScroll', 'uDpr', 'uMobile', 'uRes', 'uMouse', 'uLight', 'uClear'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  var A = {}; ['aTarget', 'aSeed', 'aColor', 'aFix'].forEach(function (n) { A[n] = gl.getAttribLocation(prog, n); });

  var W, H, dpr, N = 0, mobile = false, t0 = performance.now(), mouse = [-1e4, -1e4], scrollK = 0, visible = true, raf = 0;
  var bufs = {};
  function buffer(name, data, size) {
    if (!bufs[name]) bufs[name] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    // Attributes the shader no longer reads (aTarget, aFix since the volume redesign) are optimised away: skip them.
    if (A[name] < 0) return;
    gl.enableVertexAttribArray(A[name]); gl.vertexAttribPointer(A[name], size, gl.FLOAT, false, 0, 0);
  }

  // Device-aware hardware detection (alche.studio technique)
  var cores = navigator.hardwareConcurrency || 4;
  var memory = navigator.deviceMemory || 4;
  var isLowEnd = cores <= 4 || memory < 4;

  // Build the README page as dense word-shaped glyph blocks (a few rows of points per text line).
  function build() {
    var r = hero.getBoundingClientRect(); W = r.width; H = r.height; mobile = W < 768;
    var maxDpr = isLowEnd ? 1.0 : (mobile ? 1.25 : 1.75);
    dpr = Math.min(devicePixelRatio || 1, maxDpr);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);

    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var budget;
    if (mobile) {
      budget = isLowEnd ? 8000 : 14000;
    } else if (isLowEnd) {
      budget = 20000;
    } else {
      budget = 42000;
    }
    var rowH = mobile ? 20 : 24, glyphH = mobile ? 5 : 6, step = mobile ? 1.9 : 1.55;
    var cols = W < 1000 ? [[0.05, 0.95]] : [[0.035, 0.29], [0.71, 0.965]];
    var pts = [], lines = [];
    cols.forEach(function (c, ci) {
      for (var y = rowH * 2.4; y < H - rowH * 0.6; y += rowH) {
        if (rnd() < 0.11) continue;
        var x0 = W * c[0], x1 = x0 + W * (c[1] - c[0]) * (0.5 + rnd() * 0.5), li = lines.length;
        lines.push({ y: y, x0: x0, col: ci });
        var x = x0;
        while (x < x1) {
          var word = (2 + Math.floor(rnd() * 7)) * 7;
          for (var gx = x; gx < Math.min(x + word, x1); gx += step)
            for (var gy = 0; gy < glyphH; gy += step) pts.push(gx + (rnd() - 0.5) * 0.6, y + gy - glyphH / 2, li);
          x += word + 6;
        }
      }
    });
    // The broken line: in the left column, near the vertical middle.
    var fix = -1, best = 1e9;
    lines.forEach(function (l, i) { var d = Math.abs(l.y - H * 0.56) + l.col * 1e4; if (d < best) { best = d; fix = i; } });

    var total = pts.length / 3; N = Math.min(budget, total);
    var tgt = new Float32Array(N * 2), sd = new Float32Array(N * 4), col = new Float32Array(N), fx = new Float32Array(N);
    var stride = total / N;
    for (var i = 0; i < N; i++) {
      var j = Math.floor(i * stride) * 3;
      tgt[i * 2] = pts[j]; tgt[i * 2 + 1] = pts[j + 1];
      sd[i * 4] = Math.random(); sd[i * 4 + 1] = Math.random(); sd[i * 4 + 2] = 0.4 + Math.random() * 0.9; sd[i * 4 + 3] = Math.random();
      col[i] = i % 6; fx[i] = pts[j + 2] === fix ? 1 : 0;
    }
    buffer('aTarget', tgt, 2); buffer('aSeed', sd, 4); buffer('aColor', col, 1); buffer('aFix', fx, 1);
  }

  var clearRect = [0, 0, 0, 0];
  function measureClear() {
    var hr = hero.getBoundingClientRect(), inner = hero.querySelector('.inner');
    if (!inner) return;
    var ir = inner.getBoundingClientRect();
    clearRect = [ir.left - hr.left - 16, ir.top - hr.top - 16, ir.right - hr.left + 16, ir.bottom - hr.top + 16];
  }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function draw(now) {
    raf = 0;
    var t = (now - t0) / 1000;
    var order = reduced ? 1 : clamp((t - 0.6) / 2.8);
    var alarm = reduced ? 0 : clamp((t - 3.4) / 0.4) * (1 - clamp((t - 4.8) / 0.8));
    var fixed = reduced ? 1 : clamp((t - 4.8) / 0.8);
    var light = document.documentElement.dataset.theme !== 'dark';
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    if (light) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // additive glow on dark
    gl.uniform1f(U.uTime, reduced ? 0 : t); gl.uniform1f(U.uOrder, order); gl.uniform1f(U.uAlarm, alarm); gl.uniform1f(U.uFixed, fixed);
    gl.uniform1f(U.uScroll, reduced ? 0 : scrollK); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uMobile, mobile ? 1 : 0);
    gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uMouse, mouse[0], mouse[1]); gl.uniform1f(U.uLight, light ? 1 : 0); gl.uniform4f(U.uClear, clearRect[0], clearRect[1], clearRect[2], clearRect[3]);
    gl.drawArrays(gl.POINTS, 0, N);
    if (!reduced && visible) raf = requestAnimationFrame(draw);
  }
  function start() { if (!raf && visible && !reduced) raf = requestAnimationFrame(draw); }

  function init() {
    build(); measureClear();
    if (reduced) {
      draw(performance.now());
      return;
    }
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting && !document.hidden; start(); }).observe(hero);
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; start(); });
    hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); mouse = [e.clientX - r.left, e.clientY - r.top]; });
    hero.addEventListener('pointerleave', function () { mouse = [-1e4, -1e4]; });
    addEventListener('scroll', function () { scrollK = clamp(scrollY / (H * 0.9)); }, { passive: true });
    start();
  }

  // Defer execution until after first paint (code-splitting / performance optimization)
  if (document.readyState === 'complete') {
    requestAnimationFrame(function () { setTimeout(init, 50); });
  } else {
    window.addEventListener('load', function () {
      requestAnimationFrame(function () { setTimeout(init, 50); });
    });
  }

  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { build(); measureClear(); if (reduced) draw(performance.now()); }, 150); });
  var themeBtn = document.getElementById('theme');
  if (themeBtn) themeBtn.addEventListener('click', function () { if (reduced) setTimeout(function () { draw(performance.now()); }, 30); });
  var mark = document.querySelector('.top .mark');
  if (mark && !reduced) mark.addEventListener('click', function (e) { if (scrollY < 40) { e.preventDefault(); t0 = performance.now(); start(); } });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); visible = false; });
})();
