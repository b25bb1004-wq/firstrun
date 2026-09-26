// Live audit wall: the 16 real repositories from the audit data (same JSON the dashboard reads), one tile each with
// its real verdict and breaks fixed/found. Tiles flip in, staggered, when the wall scrolls into view; each opens the
// recorded run. If the data can't load, the wall stays empty and the rest of the page is unaffected.
(function () {
  var wall = document.getElementById('wall');
  if (!wall) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLOR = { VERIFIED: 'var(--c-verifier)', PARTIAL: 'var(--c-runner)', FAILED: 'var(--c-doctor)', INCONCLUSIVE: 'var(--muted)', 'NO-SETUP-DOCS': 'var(--muted)' };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  fetch('/api/audits/' + wall.dataset.audit).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (a) {
    var repos = a.repos || [];
    wall.innerHTML = repos.map(function (r, i) {
      var p = r.passport || {}, found = p.breaksFound || 0, fixed = p.breaksFixed || 0;
      var dots = '';
      for (var k = 0; k < found; k++) dots += '<i class="' + (k < fixed ? 'ok' : 'no') + '"></i>';
      var name = (r.url || r.slug).replace(/^https:\/\/github\.com\//, '');
      return '<a class="tile" href="/app/#/run/' + esc(r.runId || '') + '" style="--i:' + i + ';--v:' + (COLOR[r.verdict] || 'var(--muted)') + '">' +
        '<span class="v">' + esc(r.verdict || 'n/a') + '</span>' +
        '<span class="n">' + esc(name) + '</span>' +
        '<span class="b">' + (found ? '<span class="dots">' + dots + '</span>' + fixed + ' of ' + found + ' fixed' : (r.verdict === 'NO-SETUP-DOCS' ? 'no setup steps to follow' : 'worked as written')) + '</span></a>';
    }).join('');
    var s = a.summary || {};
    var note = document.getElementById('wall-note');
    if (note) note.textContent = 'Audit ' + a.id + ': ' + repos.length + ' public repositories pinned to exact commits, rules only, replayed on clean machines. Click a tile to open its recorded run.';
    if (reduced || !('IntersectionObserver' in window) || document.visibilityState !== 'visible') { wall.classList.add('in'); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { wall.classList.add('in'); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(wall);
    setTimeout(function () { wall.classList.add('in'); }, 6000);
  }).catch(function () { wall.remove(); });
})();
