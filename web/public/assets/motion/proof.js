// Proof Motion Module (Zeus)
// Subtle scroll-linked sharpness reveal of real audit dashboard footage.
// Zero fake UI overlays, sharp 2px corners, clean hairline framing.

export function init(figure, { reduced = false } = {}) {
  if (!figure) return;
  const img = figure.querySelector('img');
  if (!img) return;

  if (reduced) {
    img.style.opacity = '1';
    img.style.filter = 'none';
    return;
  }

  img.style.transition = 'filter 0.5s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)), opacity 0.4s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))';
  img.style.filter = 'contrast(0.96) brightness(0.95)';
  img.style.opacity = '0.9';

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        img.style.filter = 'contrast(1) brightness(1)';
        img.style.opacity = '1';
        figure.style.borderColor = 'var(--muted)';
      } else {
        img.style.filter = 'contrast(0.96) brightness(0.95)';
        img.style.opacity = '0.9';
        figure.style.borderColor = 'var(--line)';
      }
    }
  }, { threshold: 0.35 });

  io.observe(figure);
}
