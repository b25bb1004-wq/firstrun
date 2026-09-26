// Agent Crew Handoff Pipeline Graphic (Zeus)
// Shows the handoff: Scout -> Planner -> Runner -> Doctor -> Verifier -> Scribe.
// Plays once when scrolled into view, then settles in done state. Real artifact names.

export function init(container, { reduced = false } = {}) {
  if (!container) return;

  const agents = [
    { id: '01', name: 'Scout', role: 'Audit facts', out: 'facts', icon: '<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
    { id: '02', name: 'Planner', role: 'Extract steps', out: 'plan.json', icon: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' },
    { id: '03', name: 'Runner', role: 'Clean execution', out: 'events.ndjson', icon: '<polygon points="5,3 19,12 5,21" fill="none" stroke="currentColor" stroke-width="1.5"/>' },
    { id: '04', name: 'Doctor', role: 'Root cause', out: 'evidence/E1.json', icon: '<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' },
    { id: '05', name: 'Verifier', role: 'Prove from zero', out: 'passport.json', icon: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="1.5"/>' },
    { id: '06', name: 'Scribe', role: 'README diff', out: 'FIRSTRUN.md + README.diff', icon: '<path d="M4 20h4l10-10-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.5"/>' }
  ];

  container.innerHTML = `
    <div class="c-pipe" style="border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); padding: 20px 20px; font-family: var(--sans);">
      <div class="c-head" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--line); font-size: 13px;">
        <span style="font-family: var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Sequential Agent Pipeline</span>
        <span style="font-family: var(--mono); color: var(--ink);">Orchestrated by IBM Bob</span>
      </div>

      <div class="c-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; position: relative;">
        ${agents.map((a, i) => `
          <div class="c-node c-node-${i}" style="border: 1px solid var(--line); border-radius: var(--r); background: var(--bg); padding: 14px 12px; display: flex; flex-direction: column; gap: 8px; transition: border-color 0.25s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-family: var(--mono); font-size: 12px; color: var(--muted);">${a.id}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" style="color: var(--muted); transition: color 0.25s ease;">${a.icon}</svg>
            </div>
            <div style="font-weight: 600; font-size: 15px; color: var(--ink);">${a.name}</div>
            <div style="font-size: 12px; color: var(--muted); line-height: 1.3;">${a.role}</div>
            <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${a.out}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const nodes = container.querySelectorAll('.c-node');

  function setAllDone() {
    nodes.forEach((n) => {
      n.style.borderColor = 'var(--line)';
      const svg = n.querySelector('svg');
      if (svg) svg.style.color = 'var(--muted)';
    });
  }

  if (reduced) {
    setAllDone();
    return;
  }

  // Animate once when in viewport, then settle
  let hasPlayed = false;

  function playOnce() {
    if (hasPlayed) return;
    hasPlayed = true;

    let step = 0;
    const interval = setInterval(() => {
      nodes.forEach((n, idx) => {
        const svg = n.querySelector('svg');
        if (idx === step) {
          n.style.borderColor = 'var(--accent)';
          if (svg) svg.style.color = 'var(--accent)';
        } else if (idx < step) {
          n.style.borderColor = 'var(--line)';
          if (svg) svg.style.color = 'var(--ink)';
        } else {
          n.style.borderColor = 'var(--line)';
          if (svg) svg.style.color = 'var(--muted)';
        }
      });

      step++;
      if (step > nodes.length) {
        clearInterval(interval);
        // Settle all in completed steady state
        nodes.forEach((n) => {
          n.style.borderColor = 'var(--line)';
          const svg = n.querySelector('svg');
          if (svg) svg.style.color = 'var(--ink)';
        });
      }
    }, 450);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !hasPlayed) {
          playOnce();
          observer.unobserve(e.target);
        }
      }
    }, { threshold: 0.25 });
    observer.observe(container);
  } else {
    playOnce();
  }
}
