// Freeze-frame overlay: draw a loop around anything, then read it and answer.
(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const card = document.getElementById('card');
  const body = document.getElementById('body');
  const hint = document.getElementById('hint');
  const form = document.getElementById('ask');
  const q = document.getElementById('q');
  const send = document.getElementById('send');
  const img = new Image();
  let scale = 1, points = [], drawing = false, done = false, current = null, asking = false;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.lens.onShot(({ image, scale: s, project }) => {
    scale = s || 1;
    document.getElementById('proj').textContent = project ? `· ${project}` : '';
    img.onload = () => { resize(); render(); };
    img.src = image;
  });

  function resize() {
    canvas.width = Math.round(innerWidth * devicePixelRatio);
    canvas.height = Math.round(innerHeight * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  addEventListener('resize', () => { resize(); render(); });

  function tracePath() {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  }

  function render() {
    const W = innerWidth, H = innerHeight;
    ctx.clearRect(0, 0, W, H);
    if (!img.complete) return;
    ctx.drawImage(img, 0, 0, W, H);
    ctx.fillStyle = done ? 'rgba(4,9,17,.62)' : 'rgba(4,9,17,.28)';
    ctx.fillRect(0, 0, W, H);
    if (points.length < 2) return;
    if (done) {
      ctx.save(); tracePath(); ctx.closePath(); ctx.clip(); ctx.drawImage(img, 0, 0, W, H); ctx.restore();
    }
    tracePath();
    if (done) ctx.closePath();
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(61,214,140,.9)'; ctx.shadowBlur = 14;
    ctx.strokeStyle = '#3DD68C'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  function bbox() {
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y), pad = 6;
    const x = Math.max(0, Math.min(...xs) - pad), y = Math.max(0, Math.min(...ys) - pad);
    return { x, y, w: Math.min(innerWidth, Math.max(...xs) + pad) - x, h: Math.min(innerHeight, Math.max(...ys) + pad) - y };
  }

  // Crop from the full-resolution screenshot; small text is upscaled so OCR can read it.
  function crop(b) {
    const kx = img.naturalWidth / innerWidth, ky = img.naturalHeight / innerHeight;
    const sx = b.x * kx, sy = b.y * ky, sw = b.w * kx, sh = b.h * ky;
    const up = sh < 240 ? 2.5 : sh < 600 ? 1.6 : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(sw * up); c.height = Math.round(sh * up);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  function place(b) {
    card.hidden = false;
    const cw = card.offsetWidth, ch = Math.min(card.offsetHeight || 260, innerHeight - 32), gap = 16;
    let x = b.x + b.w + gap;
    if (x + cw > innerWidth - 16) x = b.x - cw - gap;
    if (x < 16) x = Math.min(Math.max(16, b.x), innerWidth - cw - 16);
    let y = x === b.x + b.w + gap || x === b.x - cw - gap ? b.y : b.y + b.h + gap;
    if (y + ch > innerHeight - 16) y = Math.max(16, innerHeight - ch - 16);
    card.style.left = `${x}px`; card.style.top = `${y}px`;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (asking) return;
    canvas.setPointerCapture(e.pointerId);
    drawing = true; done = false; current = null; points = [{ x: e.clientX, y: e.clientY }];
    card.hidden = true; hint.style.opacity = '0';
    render();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const last = points[points.length - 1];
    if (Math.hypot(e.clientX - last.x, e.clientY - last.y) > 2) { points.push({ x: e.clientX, y: e.clientY }); render(); }
  });
  canvas.addEventListener('pointerup', async () => {
    if (!drawing) return;
    drawing = false;
    const b = bbox();
    if (points.length < 4 || b.w < 14 || b.h < 10) { points = []; done = false; hint.style.opacity = '1'; render(); return; }
    done = true; render();
    body.innerHTML = '<div class="status"><span class="spin"></span>Reading what you circled…</div>';
    q.value = '';
    place(b);
    try {
      const r = await window.lens.read(crop(b));
      current = r;
      showRead(r);
      place(b);
      q.focus();
    } catch (err) {
      body.innerHTML = `<div class="block err"><div class="label">Could not read it</div>${esc(err.message)}</div>`;
    }
  });

  function cmdRow(c) {
    return `<div class="cmd"><code>${esc(c)}</code><button type="button" data-copy="${esc(c)}">Copy</button></div>`;
  }
  const looksLikeCommand = (s) => /^(npm|npx|pnpm|yarn|pip|python|uv|poetry|docker|cp|mv|export|cd|node|make|git|brew|apt)\b/.test(s.trim());

  function showRead(r) {
    let html = '';
    if (r.known) {
      const k = r.known;
      html += `<div class="block known"><div class="label">Known issue · proven fix</div>${esc(k.cause)}
        ${looksLikeCommand(k.fix) ? cmdRow(k.fix) : `<div style="margin-top:6px"><b>Fix:</b> ${esc(k.fix)}</div>`}
        <div class="meta">Verified by HUMBLE${k.repo ? ` in ${esc(k.repo)}` : ''}${k.verifiedAt ? ` on ${esc(k.verifiedAt.slice(0, 10))}` : ''} · evidence ${esc(k.evidence)} · no Bobcoins spent</div></div>`;
    } else if (r.text) {
      html += '<div class="status">HUMBLE hasn\'t seen this before. Ask IBM Bob, who will read your project first.</div>';
      html += '<div class="chips"><button class="chip" data-q="What is this, in plain words?">Explain this</button><button class="chip" data-q="How do I fix this?">How do I fix this?</button><button class="chip" data-q="Where in this project does this come from?">Where does this come from?</button></div>';
    } else {
      html += '<div class="status">I couldn\'t read any text there. Circle a bit wider, or type a question about it.</div>';
    }
    if (r.text) html += `<details><summary>What I read (${r.text.length} characters, ${r.ms} ms)</summary><pre>${esc(r.text)}</pre></details>`;
    body.innerHTML = html;
  }

  async function ask(question) {
    if (!current || asking) return;
    asking = true; send.disabled = true;
    const holder = document.createElement('div');
    holder.innerHTML = '<div class="block bob"><div class="label">IBM Bob</div><div class="status"><span class="spin"></span>Reading your project and thinking… (usually 20–60 s)</div></div>';
    body.appendChild(holder);
    try {
      const r = await window.lens.ask({ text: current.text, question, imageFile: current.imageFile });
      if (r.ok && r.json) {
        const j = r.json;
        holder.innerHTML = `<div class="block bob"><div class="label">IBM Bob${question ? ` · ${esc(question)}` : ''}</div>${esc(j.answer)}
          ${(j.commands || []).map(cmdRow).join('')}
          ${(j.files || []).length ? `<ul class="files">${j.files.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
          <div class="meta">${Number(r.bobcoins).toFixed(2)} Bobcoins · ${Math.round((r.ms || 0) / 1000)} s${j.confidence ? ` · ${esc(j.confidence)} confidence` : ''}</div></div>`;
      } else {
        holder.innerHTML = `<div class="block err"><div class="label">Bob couldn't answer</div>${esc(r.error || 'No answer came back.')}</div>`;
      }
    } catch (err) {
      holder.innerHTML = `<div class="block err"><div class="label">Bob couldn't answer</div>${esc(err.message)}</div>`;
    } finally {
      asking = false; send.disabled = false;
    }
  }

  body.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) { window.lens.copy(c.dataset.copy); c.textContent = 'Copied'; setTimeout(() => (c.textContent = 'Copy'), 1200); return; }
    const chip = e.target.closest('[data-q]');
    if (chip) ask(chip.dataset.q);
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = q.value.trim(); if (v) { q.value = ''; ask(v); } });
  document.getElementById('x').addEventListener('click', () => window.lens.close());
  addEventListener('keydown', (e) => { if (e.key === 'Escape') window.lens.close(); });
})();
