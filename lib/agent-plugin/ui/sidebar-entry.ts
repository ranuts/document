import { COMPACT_VIEWPORT_MAX_WIDTH } from '../../onlyoffice/viewport';

/** Use the editor's left rail when compact chrome hides its right rail. */
export function createSidebarEntry(toggle: () => void, label: () => string, isAvailable?: () => boolean) {
  let button: HTMLButtonElement | null = null;
  let ready = false,
    open = false;
  const sync = () => {
    if (!ready || (isAvailable && !isAvailable())) {
      button?.remove();
      button = null;
      return;
    }
    let rail: Element | null = null;
    for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe')) {
      try {
        const doc = frame.contentDocument;
        // Match the editor's compact chrome CSS, including touch landscape.
        const compact =
          frame.contentWindow?.matchMedia?.(
            `(max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px), (pointer: coarse) and (max-height: ${COMPACT_VIEWPORT_MAX_WIDTH}px)`,
          ).matches ?? false;
        rail =
          doc?.querySelector(compact ? '#left-menu .tool-menu-btns' : '#right-menu .tool-menu-btns') ??
          doc?.querySelector('#left-menu .tool-menu-btns') ??
          null;
      } catch {
        /* Cross-origin frames are not editor targets. */
      }
      if (rail) break;
    }
    if (!rail) {
      button?.remove();
      button = null;
      return;
    }
    if (!button || button.ownerDocument !== rail.ownerDocument) {
      button?.remove();
      const doc = rail.ownerDocument;
      button = doc.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-category canfocused agent-sidebar-entry';
      button.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></svg>';
      button.style.cssText =
        'display:flex;align-items:center;justify-content:center;padding:0;color:inherit;cursor:pointer;';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (ready && (!isAvailable || isAvailable())) toggle();
      });
    }
    if (button.parentElement !== rail) {
      const hadFocus = button.ownerDocument.hasFocus() && button.ownerDocument.activeElement === button;
      rail.append(button);
      if (hadFocus) button.focus({ preventScroll: true });
    }
    button.title = label();
    button.setAttribute('aria-label', label());
    button.setAttribute('aria-pressed', String(open));
    button.classList.toggle('active', open);
  };
  const timer = setInterval(sync, 500);
  return {
    focus: (): boolean => {
      if (!ready || !button?.isConnected || (isAvailable && !isAvailable())) return false;
      button.focus({ preventScroll: true });
      return button.ownerDocument.activeElement === button;
    },
    update: (available: boolean, expanded: boolean) => {
      ready = available;
      open = expanded;
      sync();
    },
    dispose: () => {
      clearInterval(timer);
      button?.remove();
      button = null;
      ready = false;
    },
  };
}
