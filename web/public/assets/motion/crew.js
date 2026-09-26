// Apple-Style Sticky Scrollytelling for Agent Crew Pipeline (Zeus)
// Conforms to ANTI_VIBECODE.md + Agent Identity System (Karmanya/Edith 16:40):
// Scout #4f8cff ● circle · Planner #9b7bff ■ square · Runner #ff8a3d ▲ triangle
// Doctor #ff5c7a ✚ plus · Verifier #2fbf85 ◯ ring · Scribe #f5c542 ◆ diamond.
// Pinned for ~300vh: scroll progress drives agent transitions, shape growth, and artifact reveals.

export function init(container, { reduced = false } = {}) {
  if (!container) return;

  const agents = [
    {
      id: '01',
      name: 'Scout',
      color: 'var(--c-scout, #4f8cff)',
      shapeName: 'circle',
      shapeSvg: '<circle cx="32" cy="32" r="22" fill="currentColor"/>',
      miniSvg: '<circle cx="10" cy="10" r="6" fill="currentColor"/>',
      tagline: 'Audit facts against reality',
      desc: 'Reads documentation alongside what is actually true in the repo: manifests, lockfiles, compose files, CI configurations, and application source.',
      artName: 'facts',
      artLocation: 'events.ndjson',
      artCode: `{
  "runtime": "node 16.20.2",
  "pkgManager": "npm",
  "manifest": "package.json",
  "services": ["mongo:5.0", "redis:7.0"],
  "scripts": { "dev": "nodemon src/server.ts" }
}`
    },
    {
      id: '02',
      name: 'Planner',
      color: 'var(--c-planner, #9b7bff)',
      shapeName: 'square',
      shapeSvg: '<rect x="12" y="12" width="40" height="40" rx="4" fill="currentColor"/>',
      miniSvg: '<rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor"/>',
      tagline: 'Extract exact commands in order',
      desc: 'Turns prose instructions into the exact deterministic sequence a newcomer would execute, flagging where README commands contradict codebase manifests.',
      artName: 'plan.json',
      artLocation: 'plan.json',
      artCode: `[
  { "id": "01", "kind": "clone", "cmd": "git clone <repo>" },
  { "id": "02", "kind": "install", "cmd": "npm install" },
  { "id": "03", "kind": "serve", "cmd": "npm run dev", "port": 3000 }
]`
    },
    {
      id: '03',
      name: 'Runner',
      color: 'var(--c-runner, #ff8a3d)',
      shapeName: 'triangle',
      shapeSvg: '<polygon points="32,10 54,48 10,48" fill="currentColor"/>',
      miniSvg: '<polygon points="10,3 17,16 3,16" fill="currentColor"/>',
      tagline: 'Execute on an untouched machine',
      desc: 'Executes every planned command inside an ephemeral container. Zero host tools leaked, no cached packages, no assumed environment variables.',
      artName: 'events.ndjson',
      artLocation: 'events.ndjson',
      artCode: `{"ts":1727339401,"event":"step_start","id":"02","cmd":"npm install"}
{"ts":1727339404,"event":"step_fail","id":"02","exit":1,"err":"ERESOLVE"}
{"ts":1727339404,"event":"break_detected","class":"peer-conflict"}`
    },
    {
      id: '04',
      name: 'Doctor',
      color: 'var(--c-doctor, #ff5c7a)',
      shapeName: 'plus',
      shapeSvg: '<path d="M26 10h12v16h16v12h-16v16h-12v-16h-16v-12h16z" fill="currentColor"/>',
      miniSvg: '<path d="M8 3h4v5h5v4h-5v5h-4v-5h-5v-4h5z" fill="currentColor"/>',
      tagline: 'Diagnose root cause with evidence',
      desc: 'Inspects failing logs and exit codes. Known failure patterns receive deterministic rule repairs; novel breaks route to IBM Bob for structured synthesis.',
      artName: 'evidence/E1.json',
      artLocation: 'evidence/E1.json',
      artCode: `{
  "breakId": "B-01",
  "rule": "npm-peer-conflict",
  "cause": "Conflicting peer dependencies in tree",
  "repair": "npm install --legacy-peer-deps",
  "confidence": 1.0,
  "costBobcoins": 0
}`
    },
    {
      id: '05',
      name: 'Verifier',
      color: 'var(--c-verifier, #2fbf85)',
      shapeName: 'ring',
      shapeSvg: '<circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="7"/>',
      miniSvg: '<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/>',
      tagline: 'Discard machine and replay from zero',
      desc: 'Throws the modified sandbox in the trash. Replays the repaired guide on a completely clean container from zero. A fix only counts when replay passes.',
      artName: 'passport.json',
      artLocation: 'passport.json',
      artCode: `{
  "status": "VERIFIED",
  "cleanSandbox": 2,
  "durationSeconds": 53,
  "replayProbe": "GET / -> 200 OK",
  "zeroBreaksRemaining": true
}`
    },
    {
      id: '06',
      name: 'Scribe',
      color: 'var(--c-scribe, #f5c542)',
      shapeName: 'diamond',
      shapeSvg: '<polygon points="32,8 54,32 32,56 10,32" fill="currentColor"/>',
      miniSvg: '<polygon points="10,2 17,10 10,18 3,10" fill="currentColor"/>',
      tagline: 'Smallest README diff with proof',
      desc: 'Generates the minimal, human-verifiable pull request that brings the repository documentation into 100% agreement with reality.',
      artName: 'FIRSTRUN.md + README.diff',
      artLocation: 'artifacts/README.diff',
      artCode: `--- a/README.md
+++ b/README.md
@@ -14,2 +14,4 @@
-npm install
+npm install --legacy-peer-deps
+docker compose up -d mongo redis
 npm run dev`
    }
  ];

  // If next sibling is <ol class="crew">, make it accessible to screen readers without duplicating visual layout
  const siblingList = container.nextElementSibling;
  if (siblingList && siblingList.classList.contains('crew') && !reduced) {
    siblingList.setAttribute('style', 'position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;');
  }

  // Static fallback for reduced motion or non-sticky viewports
  if (reduced) {
    container.innerHTML = `
      <div class="c-reduced" style="display: flex; flex-direction: column; gap: 20px; padding: 24px 0; font-family: var(--sans);">
        <div style="font-family: var(--mono); font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--line); padding-bottom: 10px;">
          The HUMBLE Six-Agent Pipeline · Orchestrated by IBM Bob
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          ${agents.map((a) => `
            <div style="border: 1px solid var(--line); border-top: 3px solid ${a.color}; border-radius: 4px; background: var(--surface); padding: 18px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: ${a.color}; display: flex; align-items: center;">
                    <svg width="18" height="18" viewBox="0 0 20 20">${a.miniSvg}</svg>
                  </span>
                  <span style="font-weight: 600; font-size: 16px; color: var(--ink);">${a.name}</span>
                </div>
                <span style="font-family: var(--mono); font-size: 12px; color: var(--muted);">${a.id}</span>
              </div>
              <div style="font-size: 13px; font-weight: 500; color: ${a.color};">${a.tagline}</div>
              <div style="font-size: 13px; color: var(--muted); line-height: 1.5;">${a.desc}</div>
              <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 11px; color: var(--ink); display: flex; justify-content: space-between;">
                <span>Artifact:</span>
                <span style="color: ${a.color};">${a.artName}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    return;
  }

  // Full Apple-Style Sticky Scrollytelling implementation
  container.innerHTML = `
    <div class="c-scrolly" style="position: relative; height: 300vh; font-family: var(--sans);">
      <!-- Pinned Stage -->
      <div class="c-sticky" style="position: sticky; top: 76px; height: calc(100vh - 96px); max-height: 600px; min-height: 480px; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); overflow: hidden;">
        
        <!-- Header & Nav Timeline -->
        <div class="c-nav-bar" style="padding: 16px 20px 12px; border-bottom: 1px solid var(--line); background: var(--bg); display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);">
              <span>How It Works</span>
              <span>·</span>
              <span class="c-nav-indicator" style="color: var(--ink); font-weight: 500;">Step 1 of 6</span>
            </div>
            <div style="font-family: var(--mono); font-size: 12px; color: var(--muted);">
              IBM Bob Multi-Agent Flow
            </div>
          </div>

          <!-- 6-Agent Timeline Bar -->
          <div class="c-timeline" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; position: relative;">
            ${agents.map((a, i) => `
              <div class="c-pill c-pill-${i}" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--line); background: var(--surface); font-size: 12px; font-family: var(--mono); color: var(--muted); transition: all 0.2s ease;">
                <span class="c-pill-icon" style="display: flex; align-items: center; color: currentColor;">
                  <svg width="14" height="14" viewBox="0 0 20 20">${a.miniSvg}</svg>
                </span>
                <span class="c-pill-name" style="font-weight: 500;">${a.name}</span>
              </div>
            `).join('')}
          </div>

          <!-- Micro Progress Line -->
          <div style="height: 2px; width: 100%; background: var(--line); border-radius: 1px; overflow: hidden; margin-top: 2px;">
            <div class="c-progress-line" style="height: 100%; width: 0%; background: var(--c-scout, #4f8cff); transition: width 0.1s linear, background-color 0.25s ease;"></div>
          </div>
        </div>

        <!-- Spotlight Content Area -->
        <div class="c-spotlight" style="flex: 1; padding: 24px; display: grid; grid-template-columns: 1.1fr 1fr; gap: 28px; align-items: center; overflow: hidden;">
          
          <!-- Left: Hero Agent Info + Growing Shape -->
          <div class="c-agent-panel" style="display: flex; flex-direction: column; gap: 16px; max-width: 520px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div class="c-shape-hero" style="width: 72px; height: 72px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                <svg class="c-shape-svg" width="56" height="56" viewBox="0 0 64 64" style="transition: transform 0.3s ease, color 0.3s ease;">
                  ${agents[0].shapeSvg}
                </svg>
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="c-agent-idx mono" style="font-size: 12px; font-weight: 600; padding: 2px 6px; border-radius: 2px; background: rgba(79, 140, 255, 0.12); color: var(--c-scout, #4f8cff);">AGENT 01</span>
                  <span class="c-agent-shape-label mono" style="font-size: 12px; color: var(--muted);">● circle</span>
                </div>
                <div class="c-agent-name" style="font-size: 24px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em;">Scout</div>
              </div>
            </div>

            <div class="c-agent-tagline" style="font-size: 16px; font-weight: 500; color: var(--c-scout, #4f8cff); transition: color 0.25s ease;">
              Audit facts against reality
            </div>

            <div class="c-agent-desc" style="font-size: 14px; line-height: 1.6; color: var(--muted);">
              Reads documentation alongside what is actually true in the repo: manifests, lockfiles, compose files, CI configurations, and application source.
            </div>

            <div class="c-scroll-hint" style="margin-top: 8px; font-family: var(--mono); font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--line);"></span>
              <span>Scroll to advance agent handoff</span>
            </div>
          </div>

          <!-- Right: Code Inspector Artifact Card -->
          <div class="c-artifact-card" style="display: flex; flex-direction: column; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; height: 100%; max-height: 380px; box-shadow: 0 2px 12px rgba(0,0,0,0.18); transition: transform 0.25s ease, opacity 0.25s ease;">
            
            <!-- Window / File Header -->
            <div style="padding: 10px 14px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; align-items: center; font-family: var(--mono); font-size: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="c-art-dot" style="width: 8px; height: 8px; border-radius: 50%; background: var(--c-scout, #4f8cff); display: inline-block;"></span>
                <span class="c-art-file" style="color: var(--ink); font-weight: 500;">facts</span>
              </div>
              <span class="c-art-badge" style="font-size: 11px; color: var(--muted); padding: 1px 6px; border: 1px solid var(--line); border-radius: 2px;">
                output
              </span>
            </div>

            <!-- Code Body -->
            <div style="flex: 1; padding: 16px; overflow-x: auto; background: var(--bg);">
              <pre class="c-art-pre mono" style="margin: 0; font-size: 12px; line-height: 1.6; color: var(--ink); white-space: pre; font-family: var(--mono);"></pre>
            </div>

            <!-- Footer Meta -->
            <div style="padding: 8px 14px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; background: rgba(255,255,255,0.01);">
              <span class="c-art-loc">events.ndjson</span>
              <span style="color: var(--accent);">✓ verified</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  `;

  const pills = container.querySelectorAll('.c-pill');
  const progressLine = container.querySelector('.c-progress-line');
  const navIndicator = container.querySelector('.c-nav-indicator');

  const shapeHero = container.querySelector('.c-shape-hero');
  const shapeSvg = container.querySelector('.c-shape-svg');
  const agentIdx = container.querySelector('.c-agent-idx');
  const agentShapeLabel = container.querySelector('.c-agent-shape-label');
  const agentName = container.querySelector('.c-agent-name');
  const agentTagline = container.querySelector('.c-agent-tagline');
  const agentDesc = container.querySelector('.c-agent-desc');

  const artDot = container.querySelector('.c-art-dot');
  const artFile = container.querySelector('.c-art-file');
  const artPre = container.querySelector('.c-art-pre');
  const artLoc = container.querySelector('.c-art-loc');
  const artifactCard = container.querySelector('.c-artifact-card');

  let currentAgent = -1;

  function setAgent(idx, stepProgress) {
    if (idx === currentAgent) {
      // Micro shape growth within the active step
      const scale = 0.95 + stepProgress * 0.15; // 0.95 -> 1.10
      shapeSvg.style.transform = `scale(${scale.toFixed(3)})`;
      return;
    }

    currentAgent = idx;
    const a = agents[idx];

    // Update Nav Pills
    pills.forEach((p, i) => {
      if (i === idx) {
        p.style.borderColor = a.color;
        p.style.background = 'var(--bg)';
        p.style.color = a.color;
        p.style.fontWeight = '600';
      } else if (i < idx) {
        p.style.borderColor = 'var(--line)';
        p.style.background = 'transparent';
        p.style.color = 'var(--ink)';
        p.style.fontWeight = '400';
      } else {
        p.style.borderColor = 'var(--line)';
        p.style.background = 'transparent';
        p.style.color = 'var(--muted)';
        p.style.fontWeight = '400';
      }
    });

    navIndicator.textContent = `Step ${idx + 1} of 6 · ${a.name}`;
    progressLine.style.backgroundColor = a.color;

    // Update Left Spotlight
    shapeHero.style.borderColor = a.color;
    shapeSvg.innerHTML = a.shapeSvg;
    shapeSvg.style.color = a.color;
    shapeSvg.style.transform = 'scale(1.05)';

    agentIdx.textContent = `AGENT ${a.id}`;
    agentIdx.style.color = a.color;
    agentIdx.style.background = 'rgba(255,255,255,0.06)';

    agentShapeLabel.textContent = `${a.shapeName}`;
    agentName.textContent = a.name;
    agentTagline.textContent = a.tagline;
    agentTagline.style.color = a.color;
    agentDesc.textContent = a.desc;

    // Update Right Artifact Card with quick fade
    artifactCard.style.opacity = '0.7';
    artifactCard.style.transform = 'translateY(4px)';

    setTimeout(() => {
      artDot.style.backgroundColor = a.color;
      artFile.textContent = a.artName;
      artLoc.textContent = a.artLocation;
      artPre.textContent = a.artCode;

      artifactCard.style.opacity = '1';
      artifactCard.style.transform = 'translateY(0)';
    }, 60);
  }

  // Set initial state
  setAgent(0, 0);

  // RAF throttled scroll tracking
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const pinnedTop = 76;
        const totalDistance = container.offsetHeight - (window.innerHeight - pinnedTop);

        if (totalDistance > 0) {
          const scrolled = pinnedTop - rect.top;
          const progress = Math.min(Math.max(scrolled / totalDistance, 0), 0.999);

          // Update micro progress bar
          progressLine.style.width = `${(progress * 100).toFixed(1)}%`;

          // Determine current agent
          const agentIndex = Math.min(Math.floor(progress * 6), 5);
          const stepProgress = (progress * 6) % 1;
          setAgent(agentIndex, stepProgress);
        }

        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Clean up if container is ever unmounted
  const obs = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}
