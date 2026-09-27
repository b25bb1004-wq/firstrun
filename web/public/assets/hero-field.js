// HUMBLE hero: "chaos → proven". Particles in the six agent colours start in a turbulent flow (setup docs that
// drifted), then stream into the lines of a README page. One line flares red (the break) and turns green (the fix).
// The pointer pushes particles aside; they spring back. Canvas 2D, no dependencies. Paused off-screen and in hidden
// tabs; with reduced motion it draws the finished page once and stops.
(function () {
  var hero = document.querySelector('.hero-full');
  if (!hero) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'field';
  canvas.setAttribute('aria-hidden', 'true');
  hero.insertBefore(canvas, hero.firstChild);
  var ctx = canvas.getContext('2d', { alpha: false });
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var AGENTS = ['#2440ff', '#1b2bb8', '#ff2d87', '#ff5fa8'];   // palette only
  var RED = [255, 92, 122], GREEN = [47, 191, 133];
  var W, H, dpr, P = [], lines = [], fixLine = -1, t0 = performance.now(), bg = '#111315', ink = [233, 231, 226];
  var mouse = { x: -1e4, y: -1e4 }, visible = true, raf = 0;

  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function readTheme() {
    var cs = getComputedStyle(document.body);
    bg = cs.backgroundColor || bg;
    // Settled particles: toasted oat #a38a64 on the light theme, pale oat on dark.
    ink = document.documentElement.dataset.theme === 'dark' ? [239, 231, 218] : [163, 138, 100];
  }

  // The README page the particles assemble into: ragged lines like real prose, in two columns on wide screens,
  // kept clear of the centre so the headline stays readable.
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    var r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var gap = W < 700 ? 7 : 6, rowH = W < 700 ? 22 : 26;
    var cols = W < 900 ? [[0.06, 0.94]] : [[0.05, 0.3], [0.7, 0.95]];
    var targets = []; lines = [];
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    cols.forEach(function (c) {
      for (var y = rowH * 2.2; y < H - rowH; y += rowH) {
        if (rnd() < 0.12) continue;                         // paragraph break
        var x0 = W * c[0], width = W * (c[1] - c[0]) * (0.45 + rnd() * 0.55);
        var line = { y: y, x0: x0, x1: x0 + width, idx: lines.length };
        lines.push(line);
        // Words, not a rule: runs of 3–9 "letters" with a space between them, so the page reads as prose.
        var x = x0;
        while (x < line.x1) {
          var word = (3 + Math.floor(rnd() * 7)) * gap;
          for (var wx = x; wx < Math.min(x + word, line.x1); wx += gap * 0.55) targets.push({ x: wx, y: y + (rnd() - 0.5) * 1.2, line: line.idx });
          x += word + gap * 1.8;
        }
      }
    });
    // The broken line: nearest the vertical middle of the left column.
    fixLine = -1;   // no highlighted line (removed 26 Sep: it read as a stray stroke)

    var n = Math.min(targets.length, W < 700 ? 1400 : 4200);
    // Spread targets evenly if we have fewer particles than points.
    var step = targets.length / n;
    P = [];
    for (var i = 0; i < n; i++) {
      var tg = targets[Math.floor(i * step)];
      P.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, tx: tg.x, ty: tg.y, line: tg.line,
        c: hexRgb(AGENTS[i % AGENTS.length]), px: 0, py: 0, jit: Math.random() * 6.283 });
    }
    readTheme();
  }

  // Cheap smooth flow field (layered trig): the "drifting docs".
  function flow(x, y, t) {
    return (Math.sin(x * 0.0021 + t * 0.00031) + Math.cos(y * 0.0026 - t * 0.00023) + Math.sin((x + y) * 0.0012 + t * 0.00017)) * Math.PI;
  }
  function ease(x) { return x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3); }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }

  function frame(now) {
    raf = 0;
    var t = now - t0;
    var order = reduced ? 1 : ease((t - 700) / 2600);            // chaos → page
    var alarm = reduced ? 0 : Math.max(0, Math.min(1, (t - 3200) / 500)) * (1 - Math.max(0, Math.min(1, (t - 4600) / 900))); // red flare
    var fixed = reduced ? 1 : Math.max(0, Math.min(1, (t - 4600) / 900));   // then green

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = bg;
    ctx.globalAlpha = reduced ? 1 : 0.22;                           // motion trails
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';

    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      p.px = p.x; p.py = p.y;
      if (!reduced) {
        var a = flow(p.x, p.y, t);
        var fx = Math.cos(a) * 0.9 * (1 - order), fy = Math.sin(a) * 0.9 * (1 - order);
        var tx = p.tx + Math.sin(t * 0.0012 + p.jit) * 0.8, ty = p.ty + Math.cos(t * 0.001 + p.jit) * 0.8; // breathing
        fx += (tx - p.x) * 0.018 * order; fy += (ty - p.y) * 0.018 * order;
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 14400) { var f = (1 - d2 / 14400) * 3.2; var d = Math.sqrt(d2) || 1; fx += dx / d * f; fy += dy / d * f; }
        p.vx = (p.vx + fx) * (0.86 - 0.08 * order); p.vy = (p.vy + fy) * (0.86 - 0.08 * order);
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      } else { p.x = p.tx; p.y = p.ty; p.px = p.x - 1.4; p.py = p.y; }

      // Colour: agent colours in the chaos, calm ink on the page, red → green on the broken line.
      var col = mix(p.c, ink, order * 0.95), alpha = 0.6 + order * 0.25;
      if (p.line === fixLine && order > 0.5) {
        col = alarm > 0 ? mix(col, RED, alarm) : mix(col, GREEN, fixed);
        alpha = 0.3 + Math.max(alarm, fixed) * 0.55;
      }
      ctx.strokeStyle = 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + alpha.toFixed(3) + ')';
      ctx.lineWidth = p.line === fixLine && order > 0.5 ? 2 : 1.3;
      ctx.beginPath(); ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x + (p.x === p.px ? 0.6 : 0), p.y); ctx.stroke();
    }
    if (!reduced && visible) raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && visible) raf = requestAnimationFrame(frame); }
  layout();
  if (reduced) { frame(performance.now()); }
  else {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting && !document.hidden; if (visible) start(); }).observe(hero);
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; if (visible) start(); });
    hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    hero.addEventListener('pointerleave', function () { mouse.x = mouse.y = -1e4; });
    start();
  }
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); if (reduced) frame(performance.now()); }, 150); });
  var themeBtn = document.getElementById('theme');
  if (themeBtn) themeBtn.addEventListener('click', function () { setTimeout(function () { readTheme(); if (reduced) frame(performance.now()); }, 30); });
  // Replay the story when the logo is clicked at the top of the page.
  var mark = document.querySelector('.top .mark');
  if (mark && !reduced) mark.addEventListener('click', function (e) { if (scrollY < 40) { e.preventDefault(); layout(); t0 = performance.now(); start(); } });
})();
