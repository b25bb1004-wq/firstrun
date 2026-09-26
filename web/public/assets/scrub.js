// "Scroll through a real run": the section pins while scroll progress scrubs through the recorded acme-shop run
// (web/public/data/runs/acme-shop-3c0bc2b2/f/events.ndjson). Every line is an event from that recording: commands,
// exit codes, durations, the Doctor's diagnoses and fixes, the replay from zero, the verdict. Nothing is invented.
// Reduced motion (or no JS): the whole run is listed, unpinned.
(function () {
  var sec = document.querySelector('.scrub');
  if (!sec) return;
  var feed = sec.querySelector('.scrub-feed'), meta = sec.querySelector('.scrub-meta');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var secs = function (ms) { return ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : Math.max(1, Math.round(ms)) + ' ms'; };

  fetch(sec.dataset.events).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (text) {
    var ev = text.trim().split('\n').map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    var beats = [], found = 0, fixed = 0, passed = 0, replaying = false, verdict = null, replayMs = 0;
    ev.forEach(function (e) {
      var d = e.data || {};
      if (e.type === 'step.end' && e.agent === 'runner') {
        var ok = d.exitCode === 0; if (!ok) found++; else passed++;
        beats.push({ kind: ok ? 'pass' : 'fail', label: d.command, sub: (ok ? 'passed' : 'exit ' + d.exitCode) + ' · ' + secs(d.durationMs || 0), found: found, fixed: fixed, passed: passed, phase: 'Following the README on a clean machine' });
      } else if (e.type === 'diagnosis') {
        beats.push({ kind: 'doctor', label: 'DR.BO', sub: d.diagnosis && d.diagnosis.cause, found: found, fixed: fixed, passed: passed, phase: 'A step broke. DR.BO finds out why' });
      } else if (e.type === 'fix' && d.fix && d.fix.doc) {
        beats.push({ kind: 'fix', label: 'Fix', sub: d.fix.doc.text, found: found, fixed: fixed, passed: passed, phase: 'Repairing' });
      } else if (e.type === 'evidence' && d.status === 'verified') {
        fixed = Math.min(found, fixed + 1);
      } else if (e.type === 'replay.start') {
        replaying = true; passed = 0;
        beats.push({ kind: 'reset', label: 'Machine thrown away', sub: 'A brand-new machine replays the repaired guide from zero', found: found, fixed: fixed, passed: 0, phase: 'Proving it from zero' });
      } else if (e.type === 'step.end' && e.agent === 'verifier') {
        passed++;
        beats.push({ kind: 'replay', label: d.command, sub: (d.exitCode === 0 ? 'passed' : 'exit ' + d.exitCode) + ' · ' + secs(d.durationMs || 0), found: found, fixed: fixed, passed: passed, phase: 'Proving it from zero' });
      } else if (e.type === 'replay.end') {
        replayMs = d.durationMs || 0;
      } else if (e.type === 'done') {
        verdict = d.verdict;
        beats.push({ kind: 'done', label: verdict, sub: found + ' breaks found, ' + found + ' fixed, replayed from zero' + (replayMs ? ' in ' + secs(replayMs) : ''), found: found, fixed: found, passed: passed, phase: 'Done' });
      }
    });
    if (!beats.length) return;

    feed.innerHTML = beats.map(function (b, i) {
      return '<li class="beat k-' + b.kind + '" data-i="' + i + '"><span class="dot" aria-hidden="true"></span><div><b>' + esc(b.label) + '</b><span>' + esc(b.sub) + '</span></div></li>';
    }).join('');
    var items = [].slice.call(feed.children);
    var total = beats.length;

    function show(p) {
      var n = Math.max(1, Math.min(total, Math.ceil(p * total)));
      items.forEach(function (li, i) { li.classList.toggle('on', i < n); li.classList.toggle('now', i === n - 1); });
      var b = beats[n - 1];
      meta.querySelector('[data-k=phase]').textContent = b.phase;
      meta.querySelector('[data-k=found]').textContent = b.found;
      meta.querySelector('[data-k=fixed]').textContent = b.fixed;
      meta.querySelector('[data-k=step]').textContent = n + ' / ' + total;
      sec.dataset.state = b.kind;
      // keep the current beat in view: slide the feed up as it grows
      var cur = items[n - 1], box = feed.parentElement;
      var shift = Math.max(0, cur.offsetTop + cur.offsetHeight - box.clientHeight + 40);
      feed.style.transform = 'translateY(' + (-shift) + 'px)';
    }

    if (reduced) { sec.classList.add('static'); show(1); return; }
    var ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight;
        show(span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 1);
        ticking = false;
      });
    }
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();
  }).catch(function () { sec.remove(); });
})();
