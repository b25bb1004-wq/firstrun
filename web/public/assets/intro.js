// The HUMBLE intro, driven by scroll: the first thing anyone sees. A drafting board (after alche.studio's outro):
// hairline guides, then, as you scroll, each agent's name rises in, condenses into its key letter, and the letter
// settles into its slot: HARVEY UNITY MACH DR.BO LARP ECHO spell HUMBLE. Scrolling back plays it backwards.
// How: every animation is built once, paused, on one shared timeline; scroll progress sets the playhead.
// Reduced motion (or no JS): the finished wordmark, not pinned.
(function () {
  var sec = document.getElementById('intro');
  if (!sec) return;
  var AGENTS = [
    { name: 'HARVEY', key: 'H', role: 'Scout' },
    { name: 'UNITY', key: 'U', role: 'Planner' },
    { name: 'MACH', key: 'M', role: 'Runner' },
    { name: 'DR.BO', key: 'B', role: 'Doctor' },
    { name: 'LARP', key: 'L', role: 'Verifier' },
    { name: 'ECHO', key: 'E', role: 'Scribe' },
  ];
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)', EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  var word = sec.querySelector('.intro-word'), stage = sec.querySelector('.intro-stage'), svg = sec.querySelector('.intro-guides'), hint = sec.querySelector('.intro-hint');
  var slots = [].slice.call(word.children);
  var D = 1000;                        // timeline units per agent
  var TOTAL = AGENTS.length * D + 400; // + the guides settling at the end
  var anims = [];
  var tl = function (el, kf, o) { var a = el.animate(kf, Object.assign({ fill: 'both' }, o)); a.pause(); anims.push(a); return a; };

  if (reduced) { sec.classList.add('static'); slots.forEach(function (s) { s.style.opacity = 1; }); return; }

  function build() {
    anims.forEach(function (a) { a.cancel(); }); anims = [];
    svg.innerHTML = ''; stage.innerHTML = '';
    slots.forEach(function (s) { s.style.opacity = ''; });

    // Construction guides, measured from the laid-out wordmark: baseline, cap height, one vertical per slot.
    var box = sec.querySelector('.intro-stick').getBoundingClientRect(), W = box.width, H = box.height;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var r = word.getBoundingClientRect(), top = r.top - box.top;
    var mk = function (tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; };
    var guide = function (x1, y1, x2, y2, cls, at) {
      var l = mk('line', { x1: x1, y1: y1, x2: x2, y2: y2, pathLength: 1, class: cls });
      tl(l, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 500, delay: at, easing: EASE_OUT });
    };
    // The guides are already drawn when the page loads (the board is ready), and draw themselves again on rewind.
    guide(0, top + r.height * 0.18, W, top + r.height * 0.18, 'h', -500);
    guide(0, top + r.height * 0.86, W, top + r.height * 0.86, 'h', -480);
    slots.forEach(function (s, i) { var b = s.getBoundingClientRect(); guide(b.left - box.left, 0, b.left - box.left, H, 'v', -460 + i * 20); });

    AGENTS.forEach(function (a, i) {
      var t = i * D, slot = slots[i];
      var el = document.createElement('div');
      el.className = 'intro-agent';
      el.innerHTML = '<div class="intro-name" aria-hidden="true">' + a.name.split('').map(function (ch) {
        return '<span' + (ch === a.key ? ' class="k"' : '') + '>' + ch + '</span>';
      }).join('') + '</div><div class="intro-role mono">' + a.role + '</div>';
      stage.appendChild(el);
      var chars = [].slice.call(el.firstChild.children), keyEl = el.querySelector('.k'), role = el.lastChild;
      // Measure first: a paused animation applies its first frame at once and would skew these.
      var k = keyEl.getBoundingClientRect(), kx = k.left + k.width / 2, to = slot.getBoundingClientRect();
      var dxOf = chars.map(function (c) { var rc = c.getBoundingClientRect(); return kx - (rc.left + rc.width / 2); });

      // 1. The name rises in, letter by letter (0 to 0.32 of the agent's stretch).
      chars.forEach(function (c, j) {
        tl(c, [{ opacity: 0, transform: 'translateY(40%)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 0.2 * D, delay: t + j * 0.025 * D, easing: EASE_OUT });
      });
      tl(role, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 0.42 * D, delay: t + 0.08 * D });

      // 2. Condense (0.38 to 0.6): the other letters slide into the key letter and dissolve; the key letter turns pink.
      chars.forEach(function (c, j) {
        if (c === keyEl) return;
        var dx = dxOf[j];
        tl(c, [{ opacity: 1, filter: 'blur(0px)', transform: 'none' }, { opacity: 0, filter: 'blur(6px)', transform: 'translateX(' + dx * 0.85 + 'px) scale(0.6)' }], { duration: 0.22 * D, delay: t + 0.38 * D, easing: EASE_IN_OUT, fill: 'forwards' });
      });
      // Later phases only take effect once they start (fill forwards), so they never override the rise-in before it.
      tl(keyEl, [{ color: 'var(--ink)' }, { color: 'var(--pink)' }], { duration: 0.12 * D, delay: t + 0.36 * D, fill: 'forwards' });

      // 3. The key letter flies to its slot (0.6 to 0.94), then hands over to the slot letter (0.94 to 1).
      var s = to.height / k.height;
      var dxs = to.left + to.width / 2 - kx, dys = to.top + to.height / 2 - (k.top + k.height / 2);
      tl(keyEl, [{ transform: 'none', opacity: 1 }, { transform: 'translate(' + dxs + 'px,' + dys + 'px) scale(' + s + ')', opacity: 1, offset: 0.85 }, { transform: 'translate(' + dxs + 'px,' + dys + 'px) scale(' + s + ')', opacity: 0 }], { duration: 0.4 * D, delay: t + 0.6 * D, easing: EASE_IN_OUT, fill: 'forwards' });
      tl(slot, [{ opacity: 0, color: 'var(--blue)' }, { opacity: 1, color: 'var(--blue)', offset: 0.12 }, { opacity: 1, color: 'var(--ink)' }], { duration: 0.5 * D, delay: t + 0.94 * D });

      // The compass mark confirms the letter, then steps back.
      var b = to, cx = b.left - box.left + b.width / 2, cy = b.top - box.top + b.height / 2;
      var c = mk('circle', { cx: cx, cy: cy, r: b.height * 0.62, class: 'compass' });
      tl(c, [{ opacity: 0, transform: 'rotate(-40deg)' }, { opacity: 1, transform: 'rotate(0deg)', offset: 0.35 }, { opacity: 1, offset: 0.6 }, { opacity: 0, transform: 'rotate(10deg)' }], { duration: 0.9 * D, delay: t + 0.9 * D, easing: EASE_OUT });
    });
  }

  var raf = 0;
  function update() {
    raf = 0;
    var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight;
    var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
    var at = Math.min(1, p / 0.9) * TOTAL; // the last 10% of the scroll holds the finished wordmark
    for (var i = 0; i < anims.length; i++) anims[i].currentTime = at;
    if (hint) hint.style.opacity = String(Math.max(0, 1 - p * 12));
  }
  var onScroll = function () { if (!raf) raf = requestAnimationFrame(update); };

  function init() { window.scrollTo(window.scrollX, window.scrollY); build(); update(); }
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(function (r) { setTimeout(r, 700); })]).then(function () {
    // Measure with the page at its natural layout: build at the top, then jump back to where the reader is.
    var y = scrollY; init();
    addEventListener('scroll', onScroll, { passive: true });
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { build(); update(); }, 150); });
    if (y) update();
  });
})();
