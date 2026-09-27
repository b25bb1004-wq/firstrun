// The guide thread (Arnav's pick from /lab/thread.html): instead of a mascot flying over the log, a blue thread is
// drawn in a reserved left gutter from step to step. A break is a pink crack in the thread, the fix stitches across
// it, a light runs down the thread when the machine is thrown away for the replay, and VERIFIED ties a knot. Nothing
// moves over the text. The SVG lives inside the scrolling terminal, so it scrolls with the lines it marks.

const NS = 'http://www.w3.org/2000/svg';
const X = 11; // thread x inside the gutter

export class GuideThread {
  constructor(scroller, { reduced = false, speed = 1 } = {}) {
    this.scroller = scroller;
    this.reduced = reduced;
    this.speed = speed;
    this.reset();
  }

  reset() {
    this.svg?.remove();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'humble-thread');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '22');
    this.scroller.prepend(svg);
    this.svg = svg;
    this.lastY = null;   // where the thread currently ends
    this.lastNode = null;
    this.broken = null;  // an unstitched crack
  }

  // ── drawing primitives ─────────────────────────────────────────────────────────────────────────────────────
  sleep(ms) { return this.reduced ? Promise.resolve() : new Promise((r) => setTimeout(r, ms / this.speed)); }
  fit() {
    // The console rewrites the terminal's HTML (intro panel, then clear), which detaches the SVG: put it back first.
    if (!this.svg.isConnected) this.scroller.prepend(this.svg);
    const h = this.scroller.scrollHeight; this.svg.setAttribute('height', h); this.svg.style.height = h + 'px';
  }
  cy(el) { return el.offsetTop + el.offsetHeight / 2; }
  add(tag, attrs, cls) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute('class', cls);
    this.svg.append(e);
    return e;
  }
  // A stroke that draws itself: dasharray = its length, animate the offset to zero.
  stroke(e, len, ms) {
    if (this.reduced) return Promise.resolve();
    e.style.strokeDasharray = len; e.style.strokeDashoffset = len;
    e.style.setProperty('--hb-draw', (ms / this.speed) + 'ms');
    e.classList.add('hb-draw');
    return this.sleep(ms);
  }
  async segment(y0, y1, cls = '') {
    if (y1 - y0 < 2) return;
    const s = this.add('line', { x1: X, y1: y0, x2: X, y2: y1 }, 'hb-seg' + (cls ? ' ' + cls : ''));
    await this.stroke(s, y1 - y0, Math.min(380, 110 + (y1 - y0) * 2));
  }

  // ── what the console calls ─────────────────────────────────────────────────────────────────────────────────
  /** A command starts: carry the thread down to it and tie a node there. */
  async step(el) {
    this.fit();
    const y = this.cy(el);
    if (this.lastY != null) await this.segment(this.lastY + 4, y - 4);
    this.lastNode = this.add('circle', { cx: X, cy: y, r: 3.4 }, 'hb-node');
    this.lastY = y;
  }

  /** A step broke: the thread reaches the failed line and cracks there. It only continues once stitched. */
  async crack(el) {
    this.fit();
    const y = this.cy(el);
    if (this.lastY != null) await this.segment(this.lastY + 4, y - 7);
    const c = this.add('polyline', { points: `${X - 7},${y + 5} ${X - 3},${y + 1} ${X},${y + 7} ${X + 3},${y + 1} ${X + 7},${y + 6}` }, 'hb-crack');
    await this.stroke(c, 34, 240);
    this.broken = { y };
    this.lastY = y;
  }

  /** The fix: three stitches across the crack, then the thread carries on to the fix line. */
  async stitch(el) {
    this.fit();
    if (this.broken) {
      const y = this.broken.y;
      for (const dx of [-5, 0, 5]) {
        const s = this.add('line', { x1: X + dx - 2, y1: y - 4, x2: X + dx + 2, y2: y + 9 }, 'hb-stitch');
        await this.stroke(s, 14, 110);
      }
      this.broken = null;
      this.lastY = y + 8;
    }
    const y = this.cy(el);
    await this.segment(this.lastY + 2, y - 4);
    this.lastNode = this.add('circle', { cx: X, cy: y, r: 3.4 }, 'hb-node hb-fixed');
    this.lastY = y;
  }

  /** A step passed (or a fix was proven): fill the thread's node at that line. */
  async pass(el) {
    this.fit();
    const y = this.cy(el);
    if (this.lastY != null && y - this.lastY > 6) await this.segment(this.lastY + 4, y - 4);
    this.lastNode = this.add('circle', { cx: X, cy: y, r: 3.4 }, 'hb-node hb-pass');
    this.lastY = y;
  }

  /** The machine is thrown away: a light runs down the whole thread once. */
  async pulse() {
    if (this.reduced || this.lastY == null) return;
    this.fit();
    const p = this.add('circle', { cx: X, cy: 8, r: 3 }, 'hb-pulse');
    if (p.animate) await p.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${this.lastY - 8}px)` }], { duration: 1100 / this.speed, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }).finished.catch(() => {});
    p.remove();
  }

  /** VERIFIED: the thread reaches the verdict and ties a knot. */
  async knot(el) {
    this.fit();
    const y = this.cy(el);
    if (this.lastY != null) await this.segment(this.lastY + 4, y - 6);
    const k = this.add('circle', { cx: X, cy: y, r: 5.5 }, 'hb-knot');
    await this.stroke(k, 35, 320);
    this.add('circle', { cx: X, cy: y, r: 2.4 }, 'hb-node hb-pass');
    this.lastY = y;
  }

  /** Redraw the whole thread at once (replay / skip / reduced motion) from the rendered lines. */
  async rebuild(lines) {
    const was = this.reduced; this.reduced = true;
    this.reset();
    for (const { element, line } of lines) {
      if (!element?.isConnected) continue;
      await this.mark(element, line);
    }
    this.reduced = was;
  }

  /** The one mapping from a console line to what the thread does there (used live and on rebuild). */
  async mark(el, line) {
    if (line.verdict) return this.knot(el);
    if (line.proven) return this.pass(el);
    if (line.kind === 'fix') return this.stitch(el);
    if (line.kind !== 'cmd') return;
    if (line.status === 'fail') return this.crack(el);
    if (line.status === 'pass') return this.pass(el);
    return this.step(el);
  }
}
