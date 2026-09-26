// Edith's page motion: count-up stats, gallery buttons, hero shape parallax. Reduced motion: none of it moves.
(function () {
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Count-up: numbers rise from 0 once they are on screen (Apple-style stat reveal). The final text is already in
  // the HTML, so crawlers, reduced motion and no-JS all see the real number.
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  function run(el) {
    var to = +el.dataset.count, suffix = el.dataset.suffix || '', t0 = null, dur = 1400;
    function frame(t) {
      t0 = t0 || t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(to * e) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if (!reduced && 'IntersectionObserver' in window && document.visibilityState === 'visible') {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { io.observe(c); });
  }

  // Gallery: the buttons page one card at a time; touch and trackpad scroll natively (scroll-snap).
  var g = document.getElementById('gallery');
  document.querySelectorAll('.gallery-nav button').forEach(function (b) {
    b.addEventListener('click', function () {
      var card = g && g.firstElementChild;
      if (!card) return;
      g.scrollBy({ left: +b.dataset.dir * (card.getBoundingClientRect().width + 20), behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  // Hero shapes drift apart slightly as you scroll away (depth), each at its own speed.
  var shapes = [].slice.call(document.querySelectorAll('.hero-full .shape'));
  if (!reduced && shapes.length) {
    var ticking = false;
    addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = Math.min(scrollY, innerHeight);
        shapes.forEach(function (s, i) { s.style.translate = '0 ' + (y * (0.12 + (i % 3) * 0.09)).toFixed(1) + 'px'; });
        ticking = false;
      });
    }, { passive: true });
  }
})();

// Premium layer (emil-design-eng): spring-smoothed pointer tilt on the hero shapes, and clip-path image reveals.
(function () {
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  // Decorative mouse tracking must not snap to the pointer: a damped spring gives it weight.
  var layer = document.querySelector('.hero-full .shapes');
  if (layer && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var target = { x: 0, y: 0 }, pos = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, running = false;
    var k = 0.06, damping = 0.82; // soft spring, no bounce to speak of
    function step() {
      ['x', 'y'].forEach(function (a) {
        vel[a] = (vel[a] + (target[a] - pos[a]) * k) * damping;
        pos[a] += vel[a];
      });
      layer.style.transform = 'rotateX(' + (-pos.y * 6).toFixed(2) + 'deg) rotateY(' + (pos.x * 8).toFixed(2) + 'deg) translate3d(' + (pos.x * 18).toFixed(1) + 'px,' + (pos.y * 14).toFixed(1) + 'px,0)';
      if (Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) + Math.abs(vel.x) + Math.abs(vel.y) > 0.001) requestAnimationFrame(step);
      else running = false;
    }
    document.querySelector('.hero-full').addEventListener('pointermove', function (e) {
      target.x = e.clientX / innerWidth - 0.5; target.y = e.clientY / innerHeight - 0.5;
      if (!running) { running = true; requestAnimationFrame(step); }
    });
  }

  // Images wipe up into view once. Visible by default; only hidden when we can observe them.
  if (!('IntersectionObserver' in window) || location.hash || document.visibilityState !== 'visible') return;
  var imgs = [].slice.call(document.querySelectorAll('.gallery img, .shot img'));
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('clip-shown'); e.target.classList.remove('clip-hidden'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -80px 0px' });
  imgs.forEach(function (i) { if (i.getBoundingClientRect().top > innerHeight) { i.classList.add('clip-hidden'); io.observe(i); } });
  setTimeout(function () { imgs.forEach(function (i) { i.classList.add('clip-shown'); i.classList.remove('clip-hidden'); }); }, 4000);
})();
