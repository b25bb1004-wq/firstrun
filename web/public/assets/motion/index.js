// Motion entry point. Contract (docs/design/ANTI_VIBECODE.md, Edith and Zeus):
//   - Every [data-motion="<name>"] mount gets `init(el)` from ./<name>.js, if that module exists (Zeus owns them).
//   - Every [data-reveal] block fades up once when it scrolls into view.
//   - With prefers-reduced-motion, nothing moves: content is already visible and mounts render their final frame
//     (modules receive { reduced: true }).
// No hover motion, no loops, no framework, no build step.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

for (const el of document.querySelectorAll('[data-motion]')) {
  const name = el.dataset.motion;
  import(`./${name}.js`).then((m) => m.init?.(el, { reduced })).catch(() => { /* not built yet: the page works without it */ });
}

if (!reduced && 'IntersectionObserver' in window) {
  const blocks = [...document.querySelectorAll('[data-reveal]')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('revealed');
      e.target.classList.remove('will-reveal');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  for (const b of blocks) {
    // Only hide what is still below the fold, so nothing flashes on load.
    if (b.getBoundingClientRect().top > innerHeight * 0.9) { b.classList.add('will-reveal'); io.observe(b); }
  }
}
