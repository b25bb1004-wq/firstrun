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
