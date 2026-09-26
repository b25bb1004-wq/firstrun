// Live audit data: reads directly from web/public/data (or /api/audits) so every number on the
// site switches at once from its audit folder — no mixing. Tiles flip in when the wall scrolls into
// view; each opens the recorded run.
(function () {
  var wall = document.getElementById('wall');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLOR = { VERIFIED: 'var(--c-verifier)', PARTIAL: 'var(--c-runner)', FAILED: 'var(--c-doctor)', INCONCLUSIVE: 'var(--muted)', 'CI-ONLY': 'var(--c-runner)', 'NO-SETUP-DOCS': 'var(--muted)' };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  function resolveAuditId() {
    var qMatch = location.search.match(/[?&]audit=([^&]+)/);
    if (qMatch) return Promise.resolve(decodeURIComponent(qMatch[1]));
    var explicit = wall && wall.dataset && wall.dataset.audit;
    if (explicit && explicit !== 'auto') return Promise.resolve(explicit);
    return fetchJson('/data/audits.json')
      .catch(function () { return fetchJson('/api/audits'); })
      .then(function (list) {
        if (Array.isArray(list) && list.length && list[0].id) return list[0].id;
        return 'real-16-v2';
      })
      .catch(function () { return 'real-16-v2'; });
  }

  resolveAuditId().then(function (id) {
    return fetchJson('/data/audits/' + encodeURIComponent(id) + '.json')
      .catch(function () { return fetchJson('/api/audits/' + encodeURIComponent(id)); })
      .catch(function () {
        if (id !== 'real-16-v2') {
          return fetchJson('/data/audits/real-16-v2.json')
            .catch(function () { return fetchJson('/api/audits/real-16-v2'); });
        }
        throw new Error('Could not load audit ' + id);
      });
  }).then(function (a) {
    if (!a) return;
    var repos = a.repos || [];
    var s = a.summary || {};
    var total = s.total != null ? s.total : repos.length;
    var noDocs = repos.filter(function (r) { return r.verdict === 'NO-SETUP-DOCS'; }).length;
    var followable = Math.max(0, total - noDocs);
    var broke = s.brokeOnCleanMachine != null ? s.brokeOnCleanMachine : repos.filter(function (r) { return r.verdict === 'FAILED' || r.verdict === 'PARTIAL'; }).length;
    var fixed = s.breaksFixed != null ? s.breaksFixed : 0;

    // 1. Update hero figures
    document.querySelectorAll('[data-stat="total"]').forEach(function (el) {
      if (window.humbleUpdateCounter) {
        window.humbleUpdateCounter(el, total, '');
      } else {
        el.dataset.count = total;
        el.textContent = total;
      }
    });

    document.querySelectorAll('[data-stat="broke"]').forEach(function (el) {
      var suffix = ' of ' + followable;
      if (window.humbleUpdateCounter) {
        window.humbleUpdateCounter(el, broke, suffix);
      } else {
        el.dataset.count = broke;
        el.dataset.suffix = suffix;
        el.textContent = broke + suffix;
      }
    });

    document.querySelectorAll('[data-stat="fixed"]').forEach(function (el) {
      if (window.humbleUpdateCounter) {
        window.humbleUpdateCounter(el, fixed, '');
      } else {
        el.dataset.count = fixed;
        el.textContent = fixed;
      }
    });

    // 2. Update fact note under hero stage
    document.querySelectorAll('[data-stat="fact"]').forEach(function (el) {
      el.innerHTML = 'Numbers from an audit of ' + total + ' public repositories pinned to exact commits. <a class="link" href="/audit">See the audit</a>';
    });

    // 3. Update gallery proof caption
    document.querySelectorAll('[data-stat="caption"]').forEach(function (el) {
      el.textContent = total + ' public repos, pinned to exact commits';
    });

    // 4. Update card shot image alt
    var shot = document.querySelector('.card-shot img');
    if (shot) {
      shot.alt = 'The HUMBLE audit dashboard: ' + broke + ' of ' + total + ' READMEs broke on a clean machine, ' + (s.breaksFound || 0) + ' breaks found, ' + fixed + ' fixed with evidence, one card per repository with its verdict.';
    }

    // 5. Update Wall if element exists
    if (wall) {
      wall.setAttribute('aria-label', 'The ' + total + ' audited repositories and their verdicts');
      wall.innerHTML = repos.map(function (r, i) {
        var p = r.passport || {}, found = p.breaksFound || 0, rFixed = p.breaksFixed || 0;
        var dots = '';
        for (var k = 0; k < found; k++) dots += '<i class="' + (k < rFixed ? 'ok' : 'no') + '"></i>';
        var name = (r.url || r.slug || '').replace(/^https:\/\/github\.com\//, '');
        return '<a class="tile" href="/app/#/run/' + esc(r.runId || '') + '" style="--i:' + i + ';--v:' + (COLOR[r.verdict] || 'var(--muted)') + '">' +
          '<span class="v">' + esc(r.verdict || 'n/a') + '</span>' +
          '<span class="n">' + esc(name) + '</span>' +
          '<span class="b">' + (found ? '<span class="dots">' + dots + '</span>' + rFixed + ' of ' + found + ' fixed' : (r.verdict === 'NO-SETUP-DOCS' ? 'no setup steps to follow' : 'worked as written')) + '</span></a>';
      }).join('');

      var note = document.getElementById('wall-note');
      if (note) {
        note.textContent = 'Audit ' + a.id + ': ' + repos.length + ' public repositories pinned to exact commits, rules only, replayed on clean machines. Click a tile to open its recorded run.';
      }

      if (reduced || !('IntersectionObserver' in window) || document.visibilityState !== 'visible') {
        wall.classList.add('in');
      } else {
        var io = new IntersectionObserver(function (es) {
          if (es[0].isIntersecting) { wall.classList.add('in'); io.disconnect(); }
        }, { threshold: 0.2 });
        io.observe(wall);
        setTimeout(function () { wall.classList.add('in'); }, 6000);
      }
    }

    // Broadcast audit data loaded event
    try {
      document.dispatchEvent(new CustomEvent('audit:loaded', {
        detail: { id: a.id, total: total, broke: broke, followable: followable, fixed: fixed, summary: s, repos: repos }
      }));
    } catch (e) {}
  }).catch(function (err) {
    if (wall) wall.remove();
  });
})();
