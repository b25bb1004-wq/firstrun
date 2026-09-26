// The self-healing opener. The page starts as GeekyAnts/express-typescript's setup guide, exactly as written and
// unstyled. Scrolling follows it on a clean machine, beat by beat, then the repaired guide morphs into the designed page.
// Every command, exit code, duration, log line and diagnosis below is copied from one real run:
//   run GeekyAnts__express-typescript-ee9f45c8, node:22, commit 6b9bb70e23, 26 Sep 2026, verdict VERIFIED
//   (events.ndjson, evidence E1 to E4, logs S3-1, S5-1..4). Excerpt: the guide's "Without Docker" block.
// Reduced motion: no pin, the healed guide is shown as is.
(function () {
  var sec = document.getElementById('heal');
  if (!sec) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The guide as written. k = key shared by the raw and the healed layer (the morph pairs them).
  var LINES = [
    { k: 'c1', t: '# Clone the repo.', c: 1 },
    { k: 'S1', t: 'git clone https://github.com/GeekyAnts/express-typescript.git;' },
    { k: 'c2', t: '# Goto the cloned project folder.', c: 1 },
    { k: 'S2', t: 'cd nodets;' },
    { k: 'gap1', t: '', gap: 1 },
    { k: 'c3', t: '# Note: It is assumed here that you have MongoDB running in the background and that you have created the database.', c: 1 },
    { k: 'c4', t: '# Install NPM dependencies.', c: 1 },
    { k: 'S3', t: 'npm install;', gone: 1 },
    { k: 'S3b', t: 'npm install --legacy-peer-deps', add: 1 },
    { k: 'c5', t: '# Edit your DotEnv file using any editor of your choice.', c: 1 },
    { k: 'S4', t: 'vim .env;' },
    { k: 'c6', t: '# Run the app', c: 1 },
    { k: 'R1', t: 'npm install --global nodemon', add: 1 },
    { k: 'R2', t: 'docker compose up -d mongo', add: 1 },
    { k: 'R3', t: 'docker compose up -d redis', add: 1 },
    { k: 'S5', t: 'npm run dev;' }
  ];

  // Beats. Each one patches the state of the page; state at beat n = beats 0..n applied in order.
  // r: [kind, text, log] result shown under a line; mark: line highlight; show: inserted lines that appear.
  var BEATS = [
    { phase: 'As written', cap: 'This is a real setup guide, exactly as its authors wrote it.', found: 0, fixed: 0 },
    { phase: 'Clean machine, node:22', cap: 'HUMBLE follows it on a brand-new machine, like your next teammate would.', found: 0, fixed: 0,
      set: { S1: { r: ['skip', 'skipped: HUMBLE starts from a fresh clone at 6b9bb70e23'] }, S2: { r: ['skip', 'skipped: already there'] } } },
    { phase: 'Running', cap: 'Step one breaks.', found: 1, fixed: 0, mark: 'S3',
      set: { S3: { st: 'fail', r: ['fail', 'exit 1 · 29.5 s', 'npm error ERESOLVE unable to resolve dependency tree'] } } },
    { phase: 'DR.BO', cap: 'DR.BO reads the log and finds out why.', found: 1, fixed: 0, mark: 'S3',
      doctor: "Current npm refuses the project's conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps." },
    { phase: 'Fixed', cap: 'One flag. It installs.', found: 1, fixed: 1, mark: 'S3b', show: ['S3b'],
      set: { S3: { st: 'struck', r: null }, S3b: { r: ['pass', 'passed · 1 m 31 s'] } } },
    { phase: 'Running', cap: 'The editor step is for humans; the defaults apply.', found: 1, fixed: 1, mark: 'S4',
      set: { S4: { r: ['skip', 'skipped: opens an editor'] } } },
    { phase: 'Running', cap: 'The app will not start.', found: 2, fixed: 1, mark: 'S5',
      set: { S5: { st: 'fail', r: ['fail', 'exit 1 · 5.1 s', 'sh: 1: nodemon: not found'] } },
      doctor: "The scripts call `nodemon`, but it isn't a dependency of the project: the docs assume it is installed globally." },
    { phase: 'Fixed', cap: 'The guide assumed a tool nobody told you to install.', found: 2, fixed: 2, mark: 'R1', show: ['R1'],
      set: { R1: { r: ['pass', 'passed · 4.6 s'] }, S5: { st: '', r: null } } },
    { phase: 'Running', cap: 'Again. Now it wants a database.', found: 3, fixed: 2, mark: 'S5', assume: 1,
      set: { S5: { st: 'fail', r: ['fail', 'exit 1 · 1.9 s', 'MongoError: failed to connect to server [127.0.0.1:27017]'] } },
      doctor: 'The app connects to MongoDB on localhost:27017, but the docs never start it.' },
    { phase: 'Fixed', cap: '"It is assumed here." That sentence was the bug.', found: 3, fixed: 3, mark: 'R2', show: ['R2'], assume: 1,
      set: { R2: { r: ['pass', 'passed · 0.1 s'] }, S5: { st: '', r: null } } },
    { phase: 'Running', cap: 'Again. A service the guide never mentions at all.', found: 4, fixed: 3, mark: 'S5',
      set: { S5: { st: 'fail', r: ['fail', 'exit 1 · 1.9 s', 'Error: connect ECONNREFUSED 127.0.0.1:6379'] } },
      doctor: 'The app connects to Redis on localhost:6379, but the docs never start it.' },
    { phase: 'Fixed', cap: 'Redis. Started.', found: 4, fixed: 4, mark: 'R3', show: ['R3'],
      set: { R3: { r: ['pass', 'passed · 0.1 s'] }, S5: { st: '', r: null } } },
    { phase: 'Running', cap: 'It runs.', found: 4, fixed: 4, mark: 'S5',
      set: { S5: { st: 'pass', r: ['pass', 'passed · 2.1 s', 'GET / → 200'] } } },
    { phase: 'Machine thrown away', cap: 'Then HUMBLE throws the machine away.', found: 4, fixed: 4, wipe: 1 },
    { phase: 'Replay from zero', cap: 'A brand-new one follows the repaired guide from the top.', found: 4, fixed: 4, wipe: 1, replay: 1,
      set: { S3b: { r: ['pass', 'replayed · 23.4 s'] }, R1: { r: ['pass', 'replayed · 0.6 s'] }, R2: { r: ['pass', 'replayed · 1.9 s'] },
             R3: { r: ['pass', 'replayed · 0.6 s'] }, S5: { st: 'pass', r: ['pass', 'replayed · 4.8 s', 'GET / → 200'] } } },
    { phase: 'Verified', cap: '4 breaks found. 4 fixed. Proven from zero in 53 seconds.', found: 4, fixed: 4, wipe: 1, replay: 1, stamp: 1 }
  ];
  var LAST = BEATS.length - 1;

  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (s) { return sec.querySelector(s); };
  var raw = $('.heal-raw'), done = $('.heal-done'), panel = $('.heal-panel');

  // Raw layer: browser-default look, the guide as a plain document.
  raw.innerHTML = '<h1 data-k="h">Install, Configure &amp; Run</h1>' +
    '<p data-k="p">Below mentioned are the steps to install, configure &amp; run in your platform/distributions.</p>' +
    '<pre>' + LINES.map(function (l) {
      if (l.gap) return '<span class="ln gap" data-k="' + l.k + '"></span>';
      return '<span class="ln' + (l.add ? ' add' : '') + (l.c ? ' cm' : '') + '" data-k="' + l.k + '"><span class="t">' + esc(l.t) + '</span><span class="res"></span></span>';
    }).join('') + '</pre>' +
    '<div class="stamp" aria-hidden="true">VERIFIED</div>';

  // Healed layer: the repaired guide, typeset.
  done.innerHTML = '<p class="kicker mono">GeekyAnts/express-typescript · README, repaired by HUMBLE</p>' +
    '<h2 data-k="h">Install, Configure &amp; Run</h2>' +
    '<p class="lede" data-k="p">Below mentioned are the steps to install, configure &amp; run in your platform/distributions.</p>' +
    '<ol class="cmds">' + LINES.filter(function (l) { return !l.gone && !l.gap; }).map(function (l) {
      return '<li class="' + (l.c ? 'cm' : 'cmd') + (l.add ? ' add' : '') + '" data-k="' + l.k + '">' + (l.add ? '<b aria-label="added">+</b>' : '') + esc(l.t.replace(/^# /, '').replace(/;$/, '')) + '</li>';
    }).join('') + '</ol>' +
    '<p class="proof mono" data-k="stamp">Verified from zero on node:22 at 6b9bb70e23 · clone to running in 53 s</p>';

  var rawEl = {}; [].forEach.call(raw.querySelectorAll('[data-k]'), function (e) { rawEl[e.dataset.k] = e; });
  rawEl.stamp = raw.querySelector('.stamp');
  var doneEl = {}; [].forEach.call(done.querySelectorAll('[data-k]'), function (e) { doneEl[e.dataset.k] = e; });

  function stateAt(n) {
    var s = { lines: {}, show: {}, found: 0, fixed: 0 };
    for (var i = 0; i <= n; i++) {
      var b = BEATS[i];
      if (b.wipe && !BEATS[i - 1].wipe) Object.keys(s.lines).forEach(function (k) { if (s.lines[k].st !== 'struck') s.lines[k] = {}; });
      (b.show || []).forEach(function (k) { s.show[k] = 1; });
      var set = b.set || {};
      Object.keys(set).forEach(function (k) { var o = s.lines[k] = s.lines[k] || {}; if ('st' in set[k]) o.st = set[k].st; if ('r' in set[k]) o.r = set[k].r; });
    }
    return s;
  }

  var shown = -1;
  function beat(n) {
    if (n === shown) return; shown = n;
    var b = BEATS[n], s = stateAt(n);
    LINES.forEach(function (l) {
      var el = rawEl[l.k]; if (l.gap) return;
      var o = s.lines[l.k] || {};
      el.className = 'ln' + (l.c ? ' cm' : '') + (l.add ? ' add' : '') + (l.add && !s.show[l.k] ? ' hid' : '') +
        (o.st ? ' ' + o.st : '') + (b.mark === l.k ? ' now' : '') + (l.k === 'c3' && b.assume ? ' assume' : '');
      var r = o.r, res = el.querySelector('.res');
      res.className = 'res' + (r ? ' r-' + r[0] : '');
      res.innerHTML = r ? esc(r[1]) + (r[2] ? '<i>' + esc(r[2]) + '</i>' : '') : '';
    });
    raw.classList.toggle('replay', !!b.replay);
    raw.classList.toggle('stamped', !!b.stamp);
    // DR.BO's scan line sweeps the guide once on every diagnosis beat (restarted, never looped).
    raw.classList.remove('scan');
    if (b.doctor) { raw.style.setProperty('--scan-h', raw.offsetHeight + 'px'); void raw.offsetWidth; raw.classList.add('scan'); }
    sec.dataset.beat = n;
    panel.querySelector('[data-k=phase]').textContent = b.phase;
    panel.querySelector('[data-k=cap]').textContent = b.cap;
    panel.querySelector('[data-k=found]').textContent = b.found;
    panel.querySelector('[data-k=fixed]').textContent = b.fixed;
    var doc = panel.querySelector('.doctor');
    doc.hidden = !b.doctor;
    if (b.doctor) doc.querySelector('span').textContent = b.doctor;
    rects = null;
  }

  // The morph: each line of the raw guide travels to where the same line sits in the healed guide, while one
  // typeface cross-fades into the other (a light blur hides the swap). Staggered top to bottom, driven by scroll.
  var rects = null, KEYS = Object.keys(doneEl);
  function measure() {
    rects = {};
    setHeal(0, true);
    KEYS.forEach(function (k) {
      var a = rawEl[k], d = doneEl[k]; if (!a || !d) return;
      var ra = (a.querySelector('.t') || a).getBoundingClientRect(), rd = d.getBoundingClientRect();
      if (!ra.width) return;
      rects[k] = { dx: rd.left - ra.left, dy: rd.top - ra.top, s: rd.height / Math.max(1, ra.height) };
    });
  }
  var ease = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var lastH = -1;
  function setHeal(h, force) {
    if (!force && Math.abs(h - lastH) < 0.001) return; lastH = h;
    sec.classList.toggle('healing', h > 0);
    sec.classList.toggle('healed', h >= 1);
    var n = KEYS.length, st = 0.5 / n;
    KEYS.forEach(function (k, i) {
      var a = rawEl[k], d = doneEl[k], r = rects && rects[k];
      var t = ease(clamp((h - i * st) / (1 - (n - 1) * st)));
      if (!r || h === 0) {
        if (a) { a.style.transform = ''; a.style.opacity = ''; a.style.filter = ''; }
        d.style.transform = ''; d.style.opacity = h >= 1 ? '1' : '0'; d.style.filter = '';
        return;
      }
      var sc = 1 + (r.s - 1) * t;
      a.style.transform = 'translate(' + r.dx * t + 'px,' + r.dy * t + 'px) scale(' + sc + ')';
      a.style.opacity = String(1 - t);
      a.style.filter = t > 0 && t < 1 ? 'blur(' + (Math.sin(t * Math.PI) * 3).toFixed(2) + 'px)' : '';
      d.style.transform = 'translate(' + -r.dx * (1 - t) + 'px,' + -r.dy * (1 - t) + 'px) scale(' + sc / r.s + ')';
      d.style.opacity = String(t);
      d.style.filter = t > 0 && t < 1 ? 'blur(' + (Math.sin(t * Math.PI) * 3).toFixed(2) + 'px)' : '';
    });
    // The struck `npm install;` has no partner in the healed guide, so it just fades.
    rawEl.S3.style.opacity = String(1 - clamp(h * 3));
    var p = panel.querySelector('.heal-out');
    p.style.opacity = String(clamp((h - 0.7) / 0.3));
  }

  sec.hidden = false;
  if (reduced) {
    sec.classList.add('static');
    beat(LAST); setHeal(1, true);
    return;
  }

  // Scroll map: 0 to 0.74 plays the run, 0.78 to 0.97 heals, the rest holds the healed page.
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight;
      var p = span > 0 ? clamp(-r.top / span) : 1;
      beat(Math.min(LAST, Math.floor(clamp(p / 0.74) * (LAST + 0.999))));
      var h = clamp((p - 0.78) / 0.19);
      if (h > 0 && !rects) measure();
      setHeal(h);
      panel.querySelector('.bar i').style.transform = 'scaleX(' + p.toFixed(4) + ')';
    });
  }
  beat(0);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', function () { rects = null; lastH = -1; onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { rects = null; lastH = -1; onScroll(); });
  onScroll();
})();
