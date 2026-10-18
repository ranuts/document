import { COMPACT_VIEWPORT_MAX_WIDTH } from '../../onlyoffice/viewport';

/** Use the editor's left rail when compact chrome hides its right rail. */
export function createSidebarEntry(toggle: () => void, label: () => string, isAvailable?: () => boolean) {
  let button: HTMLButtonElement | null = null;
  let ready = false,
    open = false;
  let disposed = false;
  let frameObserver: MutationObserver | null = null;
  type FrameBinding = {
    doc: Document | null;
    media: MediaQueryList | null;
    observer: MutationObserver | null;
    onLoad: () => void;
    onMediaChange: () => void;
  };
  const frames = new Map<HTMLIFrameElement, FrameBinding>();
  const enabled = () => !disposed && ready && (!isAvailable || isAvailable());
  const removeButton = () => {
    button?.remove();
    button = null;
  };
  const unbindDocument = (binding: FrameBinding) => {
    binding.observer?.disconnect();
    binding.media?.removeEventListener?.('change', binding.onMediaChange);
    binding.observer = null;
    binding.media = null;
    binding.doc = null;
  };
  const stopWatching = () => {
    frameObserver?.disconnect();
    frameObserver = null;
    for (const [frame, binding] of frames) {
      frame.removeEventListener('load', binding.onLoad);
      unbindDocument(binding);
    }
    frames.clear();
  };
  const sync = () => {
    if (!enabled()) {
      stopWatching();
      removeButton();
      return;
    }
    let rail: Element | null = null;
    for (const binding of frames.values()) {
      try {
        const doc = binding.doc;
        const compact = binding.media?.matches ?? false;
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
      removeButton();
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
      // The vendor rail schedules editor focus on mouse presses.
      button.addEventListener('mousedown', (event) => event.stopPropagation());
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (enabled()) toggle();
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
  // Observe structural rail changes, not editor/composer text or our own entry insertion.
  const changesRails = (records: MutationRecord[]) =>
    records.some((record) =>
      [...record.addedNodes, ...record.removedNodes].some((node) => {
        if (node === button) return !button?.isConnected;
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const element = node as Element;
        if (element.matches('#left-menu, #right-menu') || element.querySelector('#left-menu, #right-menu')) return true;
        const insideMenu = (record.target as Element).closest?.('#left-menu, #right-menu');
        return !!insideMenu && (element.matches('.tool-menu-btns') || !!element.querySelector('.tool-menu-btns'));
      }),
    );
  const bindDocument = (frame: HTMLIFrameElement, binding: FrameBinding) => {
    unbindDocument(binding);
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      binding.doc = doc;
      // Match the editor's compact chrome CSS, including touch landscape.
      binding.media =
        frame.contentWindow?.matchMedia?.(
          `(max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px), (pointer: coarse) and (max-height: ${COMPACT_VIEWPORT_MAX_WIDTH}px)`,
        ) ?? null;
      binding.media?.addEventListener?.('change', binding.onMediaChange);
      binding.observer = new MutationObserver((records) => {
        if (enabled() && frames.get(frame) === binding && changesRails(records)) sync();
      });
      binding.observer.observe(doc, { childList: true, subtree: true });
    } catch {
      // Cross-origin or navigating frames may become accessible on a later load.
      unbindDocument(binding);
    }
  };
  const refreshFrames = () => {
    const currentFrames = new Set(document.querySelectorAll<HTMLIFrameElement>('iframe'));
    for (const [frame, binding] of frames) {
      if (currentFrames.has(frame)) continue;
      frame.removeEventListener('load', binding.onLoad);
      unbindDocument(binding);
      frames.delete(frame);
    }
    for (const frame of currentFrames) {
      if (frames.has(frame)) continue;
      const binding: FrameBinding = {
        doc: null,
        media: null,
        observer: null,
        onLoad: () => {
          if (!enabled() || frames.get(frame) !== binding) return;
          bindDocument(frame, binding);
          sync();
        },
        onMediaChange: () => {
          if (enabled() && frames.get(frame) === binding) sync();
        },
      };
      frames.set(frame, binding);
      frame.addEventListener('load', binding.onLoad);
      bindDocument(frame, binding);
    }
  };
  const startWatching = () => {
    if (frameObserver) return;
    frameObserver = new MutationObserver((records) => {
      if (!enabled()) return;
      const changed = records.some((record) =>
        [...record.addedNodes, ...record.removedNodes].some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            ((node as Element).matches('iframe') || !!(node as Element).querySelector('iframe')),
        ),
      );
      if (!changed) return;
      refreshFrames();
      sync();
    });
    frameObserver.observe(document, { childList: true, subtree: true });
    refreshFrames();
  };
  return {
    focus: (): boolean => {
      if (!enabled() || !button?.isConnected) return false;
      button.focus({ preventScroll: true });
      return button.ownerDocument.activeElement === button;
    },
    update: (available: boolean, expanded: boolean) => {
      if (disposed) return;
      ready = available;
      open = expanded;
      if (enabled()) startWatching();
      sync();
    },
    dispose: () => {
      disposed = true;
      ready = false;
      stopWatching();
      removeButton();
    },
  };
}
