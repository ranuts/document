/** A captured pointer plus a temporary shield prevents the editor iframe stealing drags. */
export function mountPanelResize(panel: HTMLElement): () => void {
  const handle = document.createElement('div');
  handle.className = 'agent-panel-resizer';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-label', 'Resize AI panel');
  handle.setAttribute('aria-orientation', 'vertical');
  panel.prepend(handle);
  let preferred = 432;
  try {
    preferred = Number(localStorage.getItem('agent-panel-width')) || 432;
  } catch {
    /* Storage is optional. */
  }
  let shield: HTMLElement | undefined;
  let pointer: number | undefined;
  const bounds = () => ({
    min: Math.min(320, window.innerWidth),
    max: window.innerWidth <= 480 ? window.innerWidth : Math.max(320, window.innerWidth - 360),
  });
  const apply = (value: number, persist = false) => {
    const { min, max } = bounds();
    const width = Math.round(Math.max(min, Math.min(max, value)));
    document.documentElement.style.setProperty('--agent-panel-width', `${width}px`);
    handle.setAttribute('aria-valuemin', String(min));
    handle.setAttribute('aria-valuemax', String(max));
    handle.setAttribute('aria-valuenow', String(width));
    if (persist) {
      preferred = width;
      try {
        localStorage.setItem('agent-panel-width', String(width));
      } catch {
        /* Storage is optional. */
      }
    }
  };
  const finish = () => {
    if (pointer !== undefined && handle.hasPointerCapture?.(pointer)) handle.releasePointerCapture(pointer);
    pointer = undefined;
    shield?.remove();
    shield = undefined;
    document.body.classList.remove('agent-panel-resizing');
  };
  handle.addEventListener('pointerdown', (event) => {
    if (pointer !== undefined || event.button !== 0 || window.innerWidth <= 480) return;
    event.preventDefault();
    pointer = event.pointerId;
    shield = document.createElement('div');
    shield.className = 'agent-panel-resize-shield';
    document.body.append(shield);
    document.body.classList.add('agent-panel-resizing');
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (event.pointerId === pointer) apply(window.innerWidth - event.clientX, true);
  });
  handle.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointer) return;
    apply(window.innerWidth - event.clientX, true);
    finish();
  });
  const cancelPointer = (event: PointerEvent) => {
    if (event.pointerId === pointer) finish();
  };
  handle.addEventListener('pointercancel', cancelPointer);
  handle.addEventListener('lostpointercapture', cancelPointer);
  handle.addEventListener('keydown', (event) => {
    const current = Number(handle.getAttribute('aria-valuenow'));
    const { min, max } = bounds();
    const next = { ArrowLeft: current + 24, ArrowRight: current - 24, Home: min, End: max }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    apply(next, true);
  });
  const resize = () => apply(preferred);
  window.addEventListener('resize', resize);
  window.addEventListener('blur', finish);
  apply(preferred);
  return () => {
    finish();
    window.removeEventListener('resize', resize);
    window.removeEventListener('blur', finish);
    handle.remove();
  };
}
