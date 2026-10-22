import { t } from '@ranuts/shared/i18n';

/** Own dock preference and temporary expansion without rebuilding any workspace surface. */
export function mountPanelResize(panel: HTMLElement, options: { expandButton?: HTMLButtonElement } = {}): () => void {
  const handle = document.createElement('div');
  handle.className = 'agent-panel-resizer';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  panel.prepend(handle);
  let preferred = 480;
  try {
    preferred = Number(localStorage.getItem('agent-panel-width')) || 480;
  } catch {
    /* Storage is optional. */
  }
  let expanded = panel.dataset.expanded === 'true';
  let shield: HTMLElement | undefined;
  let pointer: number | undefined;
  const bounds = () => ({
    min: Math.min(320, window.innerWidth),
    max: window.innerWidth <= 480 ? window.innerWidth : Math.max(320, window.innerWidth - 360),
  });
  const syncLabels = () => {
    handle.setAttribute('aria-label', t('agentResizePanel'));
    panel.dataset.expanded = String(expanded);
    const button = options.expandButton;
    if (!button) return;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', t(expanded ? 'agentCollapse' : 'agentExpand'));
    button.title = t(expanded ? 'agentCollapse' : 'agentExpand');
    button.hidden =
      window.innerWidth <= 480 ||
      (!expanded && Math.min(1040, bounds().max) <= Number(handle.getAttribute('aria-valuenow')));
  };
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
    syncLabels();
    panel.dispatchEvent(new Event('agentlayoutchange'));
  };
  const resize = () => apply(expanded ? Math.min(1040, bounds().max) : preferred);
  const toggle = () => {
    expanded = !expanded;
    resize();
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
    expanded = false;
    syncLabels();
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
    expanded = false;
    apply(next, true);
  });
  options.expandButton?.addEventListener('click', toggle);
  window.addEventListener('resize', resize);
  window.addEventListener('blur', finish);
  window.addEventListener('languagechange', syncLabels);
  resize();
  return () => {
    finish();
    options.expandButton?.removeEventListener('click', toggle);
    window.removeEventListener('resize', resize);
    window.removeEventListener('blur', finish);
    window.removeEventListener('languagechange', syncLabels);
    handle.remove();
  };
}
