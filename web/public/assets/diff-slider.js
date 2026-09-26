// Interactive Before / After README Slider (Zeus)
// Compares GeekyAnts/express-typescript as written vs proven by HUMBLE.
// Pointer capture, touch support, keyboard a11y (arrow keys, Home, End).
(function () {
  const container = document.getElementById('diff-slider');
  if (!container) return;

  const handle = container.querySelector('.diff-handle');
  if (!handle) return;

  let split = 50; // percentage
  let isDragging = false;

  function setSplit(pct) {
    split = Math.max(5, Math.min(95, pct));
    container.style.setProperty('--split', `${split}%`);
    handle.setAttribute('aria-valuenow', Math.round(split));
  }

  function updateFromPointer(e) {
    const rect = container.getBoundingClientRect();
    if (!rect.width) return;
    const x = e.clientX - rect.left;
    setSplit((x / rect.width) * 100);
  }

  handle.addEventListener('pointerdown', (e) => {
    isDragging = true;
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    updateFromPointer(e);
  });

  const onPointerUp = (e) => {
    if (isDragging) {
      isDragging = false;
      try { handle.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerUp);

  // Click anywhere on slider to jump
  container.addEventListener('click', (e) => {
    if (e.target.closest('.diff-handle')) return;
    updateFromPointer(e);
  });

  // Keyboard accessibility
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      setSplit(split - 5);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      setSplit(split + 5);
      e.preventDefault();
    } else if (e.key === 'Home') {
      setSplit(0);
      e.preventDefault();
    } else if (e.key === 'End') {
      setSplit(100);
      e.preventDefault();
    }
  });
})();
