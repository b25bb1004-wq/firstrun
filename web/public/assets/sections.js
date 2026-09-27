// alche.studio-style section headers and the page-end outro.
// 1. Every section heading gets a small mono index ("01 / The problem") and a hairline rule that draws in once the
//    heading scrolls into view. 2. The outro builds a giant HUMBLE from construction lines (guides and compass arcs
//    draw first, then the letters settle), once, when it enters the viewport. Reduced motion: shown finished.
(function () {
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LABELS = { 'h-problem': 'The problem', 'h-how': 'How it works', 'h-proof': 'Proof', 'h-try': 'Try it', 'h-bob': 'IBM Bob' };
  var n = 0;
  Object.keys(LABELS).forEach(function (id) {
    var h = document.getElementById(id);
    if (!h) return;
    n++;
    var head = document.createElement('div');
    head.className = 'sec-head';
    head.innerHTML = '<p class="sec-index mono"><span>' + String(n).padStart(2, '0') + '</span> / ' + LABELS[id] + '</p><span class="sec-rule" aria-hidden="true"></span>';
    h.parentNode.insertBefore(head, h);
  });

  var io = 'IntersectionObserver' in window && !reduced ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('drawn'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' }) : null;
  [].forEach.call(document.querySelectorAll('.sec-head, .outro'), function (el) { if (io) io.observe(el); else el.classList.add('drawn'); });
})();
