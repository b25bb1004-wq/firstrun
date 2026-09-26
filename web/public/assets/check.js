// Theme toggle + the "Check a README" form (calls /api/check, the Vercel function).
(function () {
  var root = document.documentElement;
  document.getElementById('theme').addEventListener('click', function () {
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
    var t = dark ? 'light' : 'dark';
    root.dataset.theme = t;
    try { localStorage.setItem('humble.theme', JSON.stringify(t)); } catch (e) {}
  });

  var form = document.getElementById('form'), input = document.getElementById('repo'), go = document.getElementById('go'), out = document.getElementById('result');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function render(r) {
    var p = r.plan, f = r.facts;
    var run = p.steps.filter(function (s) { return !s.skip; });
    var docs = (p.docsUsed && p.docsUsed.length ? p.docsUsed : f.docs) || [];
    var html = '<div class="res-head"><h3><a class="link" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.repo) + '</a> <span class="mono muted">@ ' + esc(r.commit) + '</span></h3>' +
      '<span class="meta">' + esc(f.stack || 'unknown stack') + ', docs read: ' + esc(docs.join(', ') || 'none found') + ', ' + (r.downloadMs + r.analyzeMs) + ' ms</span></div>';

    html += '<p class="sec-t">Where the docs and the code disagree</p>';
    html += p.conflicts.length
      ? '<ul class="conf">' + p.conflicts.map(function (c) {
          return '<li><div class="what">' + esc(c.what) + '</div><div>Docs say <b>' + esc(c.docs) + '</b>, code says <b>' + esc(c.truth) + '</b></div><div class="src mono">' + esc(c.source) + '</div></li>';
        }).join('') + '</ul>'
      : '<p class="none">No conflicts found from reading alone. The full check runs every step to prove it.</p>';

    html += '<p class="sec-t">What a newcomer would run: ' + run.length + ' steps on ' + esc(p.image) + '</p>';
    html += p.steps.length
      ? '<ol class="steps">' + p.steps.map(function (s) {
          var src = s.source ? s.source.file + (s.source.line ? ':' + s.source.line : '') : '';
          return '<li class="' + (s.skip ? 'skip' : '') + '"><span class="id">' + esc(s.id) + '</span><span class="cmd">' + esc(s.command) + '</span><span class="k">' + esc(s.skip ? 'skipped: ' + s.skip : s.kind + (src ? ', ' + src : '')) + '</span></li>';
        }).join('') + '</ol>'
      : '<p class="none">No setup commands found in the docs. That is a finding too: a newcomer has nothing to follow.</p>';
    if (p.verify) html += '<p class="none">Done when: ' + esc(p.verify.kind === 'http' ? 'GET ' + p.verify.target : p.verify.target) + '</p>';

    html += '<p class="next">This was the quick read. To prove it, HUMBLE runs every step on a clean machine, repairs what breaks with evidence, and replays from zero: <code>firstrun verify ' + esc(r.url) + '</code>. <a class="link" href="/proof">See a full run</a></p>';
    out.innerHTML = html;
  }

  var SKELETON = '<div class="skel" aria-label="Reading the repository"><i></i><i></i><i></i><i></i><i></i></div>';

  async function check(repo) {
    if (!repo.trim()) { input.focus(); return; }
    go.disabled = true; go.textContent = 'Reading';
    out.innerHTML = SKELETON;
    try {
      var res = await fetch('/api/check?repo=' + encodeURIComponent(repo.trim()));
      var data = await res.json().catch(function () { return { error: 'The check failed (' + res.status + ').' }; });
      if (!res.ok) throw new Error(data.error || ('The check failed (' + res.status + ').'));
      render(data);
      try { history.replaceState(null, '', '?repo=' + encodeURIComponent(repo.trim()) + '#try'); } catch (e) {}
    } catch (e) {
      out.innerHTML = '<p class="err">' + esc(e.message) + '</p>';
    } finally {
      go.disabled = false; go.textContent = 'Check README';
    }
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); check(input.value); });
  document.querySelectorAll('.examples button').forEach(function (b) {
    b.addEventListener('click', function () { input.value = b.dataset.r; check(b.dataset.r); });
  });
  var q = new URLSearchParams(location.search).get('repo');
  if (q) { input.value = q; check(q); }
})();
