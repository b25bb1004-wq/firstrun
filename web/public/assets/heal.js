// The self-healing opener. The page starts as GeekyAnts/express-typescript's setup guide, exactly as written and
// unstyled. Scrolling follows it on a clean machine, beat by beat, then the repaired guide morphs into the designed page.
// Nothing factual is written here: exit codes, durations, log lines, diagnoses, inserted commands, the image, the commit,
// the break counts and the replay time are all read at load time from the audited run the site publishes (RUN below,
// audit v2-31-final). The script only says which recorded event each beat shows; a log line is shown only if its
// pattern matches that exact attempt's recorded log. If the run can't be loaded, the opener stays hidden.
// Excerpt: the guide's "Without Docker" block, text as written in the README at the audited commit.
// Reduced motion: no pin, the healed guide is shown as is.
(function () {
  var sec = document.getElementById('heal');
  if (!sec) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RUN = '/data/runs/v2-31-final-GeekyAnts__express-typescript/f/events.ndjson';

  // The guide as written. k = key shared by the raw and the healed layer (the morph pairs them).
  // Lines HUMBLE added (add: 1) take their text from the run's recorded fix / step.inserted events.
  var LINES = [
    { k: 'c1', t: '# Clone the repo.', c: 1 },
    { k: 'S1', t: 'git clone https://github.com/GeekyAnts/express-typescript.git;' },
    { k: 'c2', t: '# Goto the cloned project folder.', c: 1 },
    { k: 'S2', t: 'cd nodets;' },
    { k: 'gap1', t: '', gap: 1 },
    { k: 'c3', t: '# Note: It is assumed here that you have MongoDB running in the background and that you have created the database.', c: 1 },
    { k: 'c4', t: '# Install NPM dependencies.', c: 1 },
    { k: 'S3', t: 'npm install;', gone: 1 },
    { k: 'S3b', add: 1, from: 'S3' },
    { k: 'c5', t: '# Edit your DotEnv file using any editor of your choice.', c: 1 },
    { k: 'S4', t: 'vim .env;' },
    { k: 'c6', t: '# Run the app', c: 1 },
    { k: 'R1', add: 1 },
    { k: 'R2', add: 1 },
    { k: 'R3', add: 1 },
    { k: 'S5', t: 'npm run dev;' }
  ];

  // The script. Words are ours; every fact is a reference into the recorded run:
  //   skip: steps whose recorded skip reason is shown     fail: [step, attempt, pattern in that attempt's log]
  //   doctor: n-th recorded diagnosis                     pass: [step, attempt, optional pattern] (line = where it shows)
  //   service: n-th recorded fix whose service image is shown on the line it re-ran   replay: recorded replay attempts
  // found/fixed are counted from fail/fixed beats and must agree with the run's passport.
  var SCRIPT = [
    { phase: 'As written', cap: 'This is a real setup guide, exactly as its authors wrote it.' },
    { phase: 'machine', cap: 'HUMBLE follows it on a brand-new machine, like your next teammate would.', skip: ['S1', 'S2'] },
    { phase: 'Running', cap: 'Step one breaks.', mark: 'S3', fail: ['S3', 1, /npm error ERESOLVE[^\n]*/] },
    { phase: 'DR.BO', cap: 'DR.BO reads the log and finds out why.', mark: 'S3', doctor: 0 },
    { phase: 'Fixed', cap: 'One flag. It installs.', mark: 'S3b', show: ['S3b'], fixed: 1, strike: 'S3', pass: ['S3', 2], line: 'S3b' },
    { phase: 'Running', cap: 'The editor step is for humans; the defaults apply.', mark: 'S4', skip: ['S4'] },
    { phase: 'Running', cap: 'The app will not start.', mark: 'S5', fail: ['S5', 1, /sh: \d+: nodemon: not found/], doctor: 1 },
    { phase: 'Fixed', cap: 'The guide assumed a tool nobody told you to install.', mark: 'R1', show: ['R1'], fixed: 1, pass: ['R1', 1], clear: 'S5' },
    { phase: 'Running', cap: 'Again. Now it wants a database.', mark: 'S5', assume: 1, fail: ['S5', 2, /failed to connect to server \[[^\]\n]*\]/], doctor: 2 },
    { phase: 'Fixed', cap: '"It is assumed here." That sentence was the bug.', mark: 'R2', show: ['R2'], assume: 1, fixed: 1, pass: ['R2', 1], clear: 'S5' },
    { phase: 'Running', cap: 'Again. A service the guide never mentions at all.', mark: 'S5', fail: ['S5', 3, /Error: connect ECONNREFUSED [\d.]+:6379/], doctor: 3 },
    { phase: 'Fixed', cap: 'Redis. Started.', mark: 'R3', show: ['R3'], fixed: 1, pass: ['R3', 1], clear: 'S5' },
    { phase: 'Running', cap: 'Again. The database is up, but too new for this app.', mark: 'S5', fail: ['S5', 4, /Unsupported OP_QUERY command: \w+/], doctor: 4 },
    { phase: 'Fixed', cap: 'The guide never said which MongoDB. This driver needs 4.4.', mark: 'R2', fixed: 1, service: [4, 'R2'], clear: 'S5' },
    { phase: 'Running', cap: 'It runs.', mark: 'S5', pass: ['S5', 5, /GET \S+ → \d+/] },
    { phase: 'Machine thrown away', cap: 'Then HUMBLE throws the machine away.', wipe: 1 },
    { phase: 'Replay from zero', cap: 'A brand-new one follows the repaired guide from the top.', wipe: 1, replay: { S3b: 'S3', R1: 'R1', R2: 'R2', R3: 'R3', S5: 'S5' } },
    { phase: 'Verified', wipe: 1, replay: 1, stamp: 1, final: 1 }
  ];

  var secs = function (ms) { var s = ms / 1000; return s < 60 ? s.toFixed(1) + ' s' : Math.floor(s / 60) + ' m ' + Math.round(s % 60) + ' s'; };

  // Turns the script + the recorded events into the beats the page plays. Returns null if the run doesn't hold a fact
  // the script asks for (the opener then stays hidden rather than show something the run can't back).
  function build(ev) {
    var ends = [], diag = [], fixes = [], ins = {}, plan = null, rep = null, pass = null, image = null, replaying = false;
    ev.forEach(function (e) {
      var d = e.data || {};
      if (e.type === 'replay.start') { replaying = true; image = d.image; }
      else if (e.type === 'step.end') ends.push({ id: d.stepId, n: d.n, exit: d.exitCode, ms: d.durationMs, log: d.logTail || '', replay: replaying });
      else if (e.type === 'diagnosis' && d.diagnosis) diag.push(d.diagnosis.cause);
      else if (e.type === 'fix' && d.fix) fixes.push(d.fix);
      else if (e.type === 'step.inserted' && d.step) ins[d.step.id] = d.step.command;
      else if (e.type === 'plan' && d.steps) plan = d.steps;
      else if (e.type === 'passport') pass = d;
      else if (e.type === 'replay.end') rep = d;
    });
    if (!pass || !rep || !plan || !image) return null;
    var at = function (id, n) { for (var i = 0; i < ends.length; i++) if (ends[i].id === id && ends[i].n === n && !ends[i].replay) return ends[i]; };
    var replayed = function (id) { for (var i = ends.length - 1; i >= 0; i--) if (ends[i].id === id && ends[i].replay) return ends[i]; };
    var skipOf = function (id) { for (var i = 0; i < plan.length; i++) if (plan[i].id === id) return plan[i].skip; };
    var grep = function (log, re) { var m = re && log.match(re); return m ? m[0] : ''; };

    // Added lines: the replaced command from the recorded fix, inserted ones from step.inserted.
    var replaced = null;
    fixes.forEach(function (f) { (f.actions || []).forEach(function (a) { if (a.type === 'replace-step' && !replaced) replaced = a.command; }); });
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i]; if (!l.add) continue;
      l.t = l.from ? replaced : ins[l.k];
      if (!l.t) return null;
    }

    var found = 0, fixed = 0, beats = [];
    for (var j = 0; j < SCRIPT.length; j++) {
      var s = SCRIPT[j], b = { cap: s.cap, mark: s.mark, show: s.show, assume: s.assume, wipe: s.wipe, replay: !!s.replay, stamp: s.stamp, set: {} };
      b.phase = s.phase === 'machine' ? 'Clean machine, ' + image : s.phase;
      (s.skip || []).forEach(function (id) { var why = skipOf(id); if (!why) return; b.set[id] = { r: ['skip', 'skipped: ' + why] }; });
      if (s.fail) {
        var f = at(s.fail[0], s.fail[1]); if (!f || f.exit === 0) return null;
        found++;
        b.set[s.fail[0]] = { st: 'fail', r: ['fail', 'exit ' + f.exit + ' · ' + secs(f.ms), grep(f.log, s.fail[2])] };
      }
      if (s.doctor != null) { if (!diag[s.doctor]) return null; b.doctor = diag[s.doctor]; }
      if (s.strike) b.set[s.strike] = { st: 'struck', r: null };
      if (s.clear) b.set[s.clear] = { st: '', r: null };
      if (s.pass) {
        var p = at(s.pass[0], s.pass[1]); if (!p || p.exit !== 0) return null;
        var line = s.line || s.pass[0];
        b.set[line] = { st: line === 'S5' ? 'pass' : undefined, r: ['pass', 'passed · ' + secs(p.ms), grep(p.log, s.pass[2])] };
        if (b.set[line].st === undefined) delete b.set[line].st;
      }
      if (s.service) {
        var fx = fixes[s.service[0]], svc = null;
        (fx && fx.actions || []).forEach(function (a) { if (a.type === 'service' && a.image) svc = a; });
        if (!svc) return null;
        b.set[s.service[1]] = { r: ['pass', 'restarted as ' + svc.image] };
      }
      if (s.fixed) fixed++;
      if (s.replay && s.replay !== 1) {
        Object.keys(s.replay).forEach(function (k) {
          var r = replayed(s.replay[k]); if (!r) return;
          b.set[k] = { r: ['pass', 'replayed · ' + secs(r.ms), k === 'S5' ? grep(r.log, /GET \S+ → \d+/) : ''] };
          if (k === 'S5') b.set[k].st = 'pass';
        });
      }
      if (s.final) {
        if (found !== pass.breaksFound || fixed !== pass.breaksFixed) return null; // script and run disagree: show nothing
        b.cap = pass.breaksFound + ' breaks found. ' + pass.breaksFixed + ' fixed. Replayed from zero in ' + secs(pass.replaySeconds * 1000) + '.';
      }
      b.found = found; b.fixed = fixed;
      beats.push(b);
    }
    return { beats: beats, pass: pass, image: image };
  }

  fetch(RUN).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (text) {
    var ev = text.split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
    var got = build(ev);
    if (!got) { console.warn('[heal] the recorded run does not back the opener; not shown'); return; }
    start(got);
  }).catch(function (e) { console.warn('[heal] run not loaded; opener not shown', e); });

  function start(got) {
  var BEATS = got.beats, P = got.pass;
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
    '<p class="proof mono" data-k="stamp">' + esc(P.verdict === 'VERIFIED' ? 'Verified' : P.verdict) + ' from zero on ' + esc(got.image) + ' at ' + esc(P.commit) +
      ' · clone to running in ' + esc(secs(P.replaySeconds * 1000)) + '</p>';
  var src = panel.querySelector('[data-k=src]');
  if (src) src.textContent = P.repo + ' · audit v2-31-final · ' + got.image + ' · ' + P.commit;

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
  }
})();
