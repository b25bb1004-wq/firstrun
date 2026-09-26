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
    'uniform float uTime, uOrder, uAlarm, uFixed, uScroll, uDpr, uMobile; uniform vec2 uRes, uMouse;',
    'varying vec3 vCol; varying float vAlpha;',
    'vec3 agent(float i){',
    '  if(i<0.5) return vec3(0.31,0.55,1.0); if(i<1.5) return vec3(0.61,0.48,1.0); if(i<2.5) return vec3(1.0,0.54,0.24);',
    '  if(i<3.5) return vec3(1.0,0.36,0.48); if(i<4.5) return vec3(0.18,0.75,0.52); return vec3(0.96,0.77,0.26); }',
    'void main(){',
    '  float t = uTime;',
    // Chaos: each particle rides layered swirls around its own home point (stateless flow).
    '  vec2 home = aSeed.xy * uRes;',
    '  vec2 sw = vec2(sin(t*0.37*aSeed.z + home.y*0.004 + aSeed.w*6.28) + sin(t*0.21 + home.x*0.003),',
    '                 cos(t*0.33*aSeed.z + home.x*0.004 + aSeed.w*6.28) + cos(t*0.19 + home.y*0.0035));',
    '  vec2 chaos = home + sw * (70.0 + 90.0*aSeed.z) + vec2(sin(t*0.6+aSeed.w*9.0), cos(t*0.5+aSeed.z*7.0))*24.0;',
    // Order: a wavefront sweeps left→right, each particle settles when it passes (writing the page).
    '  float wave = clamp(uOrder*1.55 - (aTarget.x/uRes.x)*0.55 - aSeed.w*0.12, 0.0, 1.0);',
    '  float k = wave*wave*(3.0-2.0*wave);',
    '  vec2 breathe = vec2(sin(t*1.3+aSeed.w*20.0), cos(t*1.1+aSeed.z*20.0)) * 0.35;',
    '  vec2 p = mix(chaos, aTarget + breathe, k);',
    // Pointer carves a hole; ink flows back when it leaves.
    '  vec2 d = p - uMouse; float dist = length(d);',
    '  p += (dist < 130.0 ? normalize(d + 0.0001) * (130.0 - dist) * 0.55 : vec2(0.0));',
    // 3D: scrolling tilts the page back around its lower third and pushes it away.
    '  vec2 c = p - vec2(uRes.x*0.5, uRes.y*0.62);',
    '  float ang = uScroll * 1.05; float z = c.y * sin(ang) + uScroll*260.0;',
    '  float persp = 900.0 / (900.0 + z);',
    '  vec2 q = vec2(c.x, c.y * cos(ang)) * persp + vec2(uRes.x*0.5, uRes.y*0.62 - uScroll*uRes.y*0.18);',
    '  gl_Position = vec4((q / uRes) * 2.0 - 1.0, 0.0, 1.0); gl_Position.y *= -1.0;',
    '  float fixLine = aFix * step(0.55, k);',
    '  gl_PointSize = (1.7 + fixLine*0.8 + (1.0-k)*0.5) * uDpr * persp;',
    // Colour: agent colours in the chaos → calm ink on the page; the broken line red → green.
    '  vec3 ink = vec3(0.86,0.85,0.82);',
    '  vec3 col = mix(agent(aColor), ink * 0.62, k*0.92);',
    '  col = mix(col, vec3(1.0,0.36,0.48), fixLine*uAlarm);',
    '  col = mix(col, vec3(0.18,0.75,0.52), fixLine*uFixed);',
    '  vCol = col;',
    '  vAlpha = mix(0.55, 0.62, k) + fixLine*max(uAlarm,uFixed)*0.4;',
    '  vAlpha *= (1.0 - uScroll*0.85) * (uMobile > 0.5 ? 0.8 : 1.0);',
    '}'
  ].join('\n');
  var FS = [
    'precision mediump float; varying vec3 vCol; varying float vAlpha; uniform float uLight;',
    'void main(){ vec2 c = gl_PointCoord - 0.5; float r = dot(c,c); if(r > 0.25) discard;',
    '  vec3 col = uLight > 0.5 ? vCol * 0.55 : vCol;',
    '  gl_FragColor = vec4(col, vAlpha * (1.0 - smoothstep(0.12, 0.25, r))); }'
  ].join('\n');

  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  var prog;
  try {
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { canvas.remove(); var f = document.createElement('script'); f.src = '/assets/hero-field.js'; document.body.appendChild(f); return; }
  gl.useProgram(prog);
  var U = {}; ['uTime', 'uOrder', 'uAlarm', 'uFixed', 'uScroll', 'uDpr', 'uMobile', 'uRes', 'uMouse', 'uLight'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  var A = {}; ['aTarget', 'aSeed', 'aColor', 'aFix'].forEach(function (n) { A[n] = gl.getAttribLocation(prog, n); });

  var W, H, dpr, N = 0, mobile = false, t0 = performance.now(), mouse = [-1e4, -1e4], scrollK = 0, visible = true, raf = 0;
  var bufs = {};
  function buffer(name, data, size) {
    if (!bufs[name]) bufs[name] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(A[name]); gl.vertexAttribPointer(A[name], size, gl.FLOAT, false, 0, 0);
  }

  // Build the README page as dense word-shaped glyph blocks (a few rows of points per text line).
  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    var r = hero.getBoundingClientRect(); W = r.width; H = r.height; mobile = W < 720;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);

    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var budget = mobile ? 18000 : 60000;
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

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function draw(now) {
    raf = 0;
    var t = (now - t0) / 1000;
    var order = reduced ? 1 : clamp((t - 0.6) / 2.8);
    var alarm = reduced ? 0 : clamp((t - 3.4) / 0.4) * (1 - clamp((t - 4.8) / 0.8));
    var fixed = reduced ? 1 : clamp((t - 4.8) / 0.8);
    var light = document.documentElement.dataset.theme === 'light' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: light)').matches);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    if (light) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // additive glow on dark
    gl.uniform1f(U.uTime, reduced ? 0 : t); gl.uniform1f(U.uOrder, order); gl.uniform1f(U.uAlarm, alarm); gl.uniform1f(U.uFixed, fixed);
    gl.uniform1f(U.uScroll, reduced ? 0 : scrollK); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uMobile, mobile ? 1 : 0);
    gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uMouse, mouse[0], mouse[1]); gl.uniform1f(U.uLight, light ? 1 : 0);
    gl.drawArrays(gl.POINTS, 0, N);
    if (!reduced && visible) raf = requestAnimationFrame(draw);
  }
  function start() { if (!raf && visible && !reduced) raf = requestAnimationFrame(draw); }

  build();
  if (reduced) draw(performance.now());
  else {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting && !document.hidden; start(); }).observe(hero);
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; start(); });
    hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); mouse = [e.clientX - r.left, e.clientY - r.top]; });
    hero.addEventListener('pointerleave', function () { mouse = [-1e4, -1e4]; });
    addEventListener('scroll', function () { scrollK = clamp(scrollY / (H * 0.9)); }, { passive: true });
    start();
  }
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { build(); if (reduced) draw(performance.now()); }, 150); });
  var themeBtn = document.getElementById('theme');
  if (themeBtn) themeBtn.addEventListener('click', function () { if (reduced) setTimeout(function () { draw(performance.now()); }, 30); });
  var mark = document.querySelector('.top .mark');
  if (mark && !reduced) mark.addEventListener('click', function (e) { if (scrollY < 40) { e.preventDefault(); t0 = performance.now(); start(); } });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); visible = false; });
})();
