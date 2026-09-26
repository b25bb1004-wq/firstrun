// The HUMBLE intro: the first thing anyone sees. Drawn like a drafting board (after alche.studio's outro): hairline
// guides first, then each agent's name arrives, condenses to its letter, and that letter flies into its slot until
// HARVEY UNITY MACH DR.BO LARP ECHO have spelled HUMBLE. The wordmark then settles into the header logo.
// Any click, key, wheel or touch skips to the end. Reduced motion: the wordmark, briefly, no movement.
(function () {
  var root = document.getElementById('intro');
  if (!root) return;
  var html = document.documentElement;
  var AGENTS = [
    { name: 'HARVEY', key: 'H', role: 'Scout' },
    { name: 'UNITY', key: 'U', role: 'Planner' },
    { name: 'MACH', key: 'M', role: 'Runner' },
    { name: 'DR.BO', key: 'B', role: 'Doctor' },
    { name: 'LARP', key: 'L', role: 'Verifier' },
    { name: 'ECHO', key: 'E', role: 'Scribe' },
  ];
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A deep link (#try, #proof) goes straight to the content.
  if (location.hash) { root.remove(); html.classList.remove('intro-on'); return; }

  var EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)', EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  var word = root.querySelector('.intro-word'), stage = root.querySelector('.intro-stage'), svg = root.querySelector('.intro-guides');
  var slots = [].slice.call(word.children);
  var done = false, timers = [];
  // ?introSlow=4 plays everything four times slower (for reviewing the choreography).
  var SLOW = Math.max(1, Number(new URLSearchParams(location.search).get('introSlow')) || 1);
  var later = function (fn, ms) { timers.push(setTimeout(fn, ms * SLOW)); };
  var anim = function (el, kf, o) { o = Object.assign({ fill: 'forwards' }, o); o.duration *= SLOW; if (o.delay) o.delay *= SLOW; return el.animate(kf, o); };

  function line(x1, y1, x2, y2, cls, delay) {
    var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('pathLength', '1'); l.setAttribute('class', cls || '');
    svg.appendChild(l);
    if (!reduced) anim(l, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 700, delay: delay || 0, easing: EASE_OUT });
    return l;
  }
  function circle(cx, cy, r) {
    var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r); c.setAttribute('class', 'compass');
    svg.appendChild(c);
    // The compass mark confirms the letter, then steps back so only the newest one shows.
    anim(c, [{ opacity: 0, transform: 'rotate(-40deg)' }, { opacity: 1, transform: 'rotate(0deg)', offset: 0.35 }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'rotate(10deg)' }], { duration: 1100, easing: EASE_OUT });
    return c;
  }

  // Construction guides: baseline, cap height and one vertical per letter slot, measured from the laid-out wordmark.
  function drawGuides() {
    var W = innerWidth, H = innerHeight, r = word.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var cap = r.top + r.height * 0.18, base = r.top + r.height * 0.86;
    line(0, cap, W, cap, 'h', 0); line(0, base, W, base, 'h', 80);
    slots.forEach(function (s, i) { var b = s.getBoundingClientRect(); line(b.left, 0, b.left, H, 'v', 120 + i * 40); });
    var sr = stage.getBoundingClientRect(); line(0, sr.top + sr.height * 0.62, W, sr.top + sr.height * 0.62, 'h faint', 260);
  }

  function finish(immediate) {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    slots.forEach(function (s) { s.classList.add('in'); s.getAnimations().forEach(function (a) { a.finish(); }); });
    stage.innerHTML = '';
    var mark = document.querySelector('.top .mark');
    var end = function () { root.remove(); html.classList.remove('intro-on'); window.dispatchEvent(new Event('humble:intro-done')); };
    if (immediate || reduced || !mark) { anim(root, [{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 400 : 250, delay: reduced ? 700 : 0 }).onfinish = end; return; }
    // The wordmark flies into the header logo (FLIP), and the board lifts away beneath it.
    var from = word.getBoundingClientRect(), to = mark.getBoundingClientRect();
    var s = to.height / from.height * 1.25;
    anim(svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: EASE_OUT });
    anim(word, [{ transform: 'none' }, { transform: 'translate(' + (to.left - from.left) + 'px,' + (to.top + to.height / 2 - (from.top + from.height / 2)) + 'px) scale(' + s + ')' }], { duration: 750, delay: 250, easing: EASE_IN_OUT });
    anim(root.querySelector('.intro-board'), [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: 700, delay: 450, easing: EASE_IN_OUT }).onfinish = end;
  }

  function playAgent(i, t0) {
    var a = AGENTS[i], slot = slots[i];
    later(function () {
      if (done) return;
      // Each agent gets its own layer, so its letter can still be flying while the next name comes in.
      var box = document.createElement('div');
      box.className = 'intro-agent';
      box.innerHTML = '<div class="intro-name" aria-hidden="true">' + a.name.split('').map(function (ch) {
        return '<span' + (ch === a.key ? ' class="k"' : '') + '>' + ch + '</span>';
      }).join('') + '</div><div class="intro-role mono">' + a.role + '</div>';
      stage.appendChild(box);
      var nm = box.firstChild, chars = [].slice.call(nm.children), keyEl = nm.querySelector('.k'), role = box.lastChild;
      // 1. The name rises in, letter by letter.
      chars.forEach(function (c, j) { anim(c, [{ opacity: 0, transform: 'translateY(40%)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 320, delay: j * 26, easing: EASE_OUT }); });
      anim(role, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 120 });
      // 2. It condenses: every other letter collapses, the key letter stays.
      later(function () {
        if (done) return;
        // Condense: each other letter slides toward the key letter and dissolves into it (no reflow, so nothing mashes).
        var k = keyEl.getBoundingClientRect(), kx = k.left + k.width / 2;
        chars.forEach(function (c) {
          if (c === keyEl) return;
          var r = c.getBoundingClientRect(), dx = kx - (r.left + r.width / 2);
          anim(c, [{ opacity: 1, filter: 'blur(0)', transform: 'none' }, { opacity: 0, filter: 'blur(6px)', transform: 'translateX(' + dx * 0.85 + 'px) scale(0.6)' }], { duration: 300, easing: EASE_IN_OUT });
        });
        anim(role, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
        keyEl.classList.add('hot');
      }, 420);
      // 3. The key letter flies into its slot; the slot's compass mark confirms it.
      later(function () {
        if (done) return;
        var from = keyEl.getBoundingClientRect(), to = slot.getBoundingClientRect();
        var s = to.height / from.height;
        anim(keyEl, [{ transform: 'none' }, { transform: 'translate(' + (to.left + to.width / 2 - (from.left + from.width / 2)) + 'px,' + (to.top + to.height / 2 - (from.top + from.height / 2)) + 'px) scale(' + s + ')' }], { duration: 400, easing: EASE_IN_OUT })
          .onfinish = function () {
            if (done) return;
            slot.classList.add('in');
            anim(slot, [{ color: 'var(--blue)' }, { color: 'var(--ink)' }], { duration: 600, easing: EASE_OUT });
            box.remove();
            var b = slot.getBoundingClientRect();
            circle(b.left + b.width / 2, b.top + b.height / 2, b.height * 0.62);
          };
      }, 600);
    }, t0);
  }

  function start() {
    html.classList.add('intro-on');
    if (reduced) { slots.forEach(function (s) { s.classList.add('in'); }); finish(false); return; }
    drawGuides();
    // One agent every 860 ms: the previous letter is already halfway to its slot when the next name rises in.
    var STEP = 860, T0 = 450;
    AGENTS.forEach(function (_, i) { playAgent(i, T0 + i * STEP); });
    later(function () { finish(false); }, T0 + AGENTS.length * STEP + 700);
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { addEventListener(ev, function () { finish(true); }, { once: true, passive: true }); });
  }

  var go = function () { if (!done) start(); };
  // Wait for the display face (Bricolage) so measurements match, but never more than 700 ms.
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(function (r) { setTimeout(r, 700); })]).then(go);
})();
