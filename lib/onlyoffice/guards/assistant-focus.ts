/**
 * Guard 18: keep unsolicited SDK focus from taking a control the assistant owns.
 */
const owners = new WeakMap<Document, HTMLElement>();
const watchedParents = new WeakSet<Document>();
const watchedEditors = new WeakSet<Document>();
const guardedPrototypes = new WeakSet<object>();

function visiblePanel(target: HTMLElement): HTMLElement | null {
  if (!target.isConnected) return null;
  const panel = target.closest<HTMLElement>('.agent-runtime-panel');
  if (!panel || target.closest('[hidden], .agent-panel-hidden')) return null;
  const win = target.ownerDocument.defaultView;
  for (let element: HTMLElement | null = target; element; element = element.parentElement) {
    const style = win?.getComputedStyle(element);
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return null;
  }
  return panel;
}

function currentOwner(doc: Document): HTMLElement | undefined {
  const owner = owners.get(doc);
  if (owner && !visiblePanel(owner)) {
    owners.delete(doc);
    return undefined;
  }
  return owner;
}

function watchParent(doc: Document): void {
  if (watchedParents.has(doc)) return;
  watchedParents.add(doc);
  const onIntent = (event: Event) => {
    const view = doc.defaultView;
    let target = event.target;
    // Pointer events may originate from an SVG inside a button.
    while (view && target instanceof view.Element && !(target instanceof view.HTMLElement))
      target = target.parentElement;
    if (view && target instanceof view.HTMLElement) claimAssistantFocus(target);
    else owners.delete(doc);
  };
  doc.addEventListener('focusin', onIntent, true);
  doc.addEventListener(
    'pointerdown',
    (event) => {
      onIntent(event);
      const target = currentOwner(doc);
      if (!target?.matches('input, textarea, button, select, a[href], [tabindex], [contenteditable="true"]')) return;
      // Firefox can ignore the native parent click while the SDK input owns focus.
      // Retry only that explicit handoff once, and yield to every newer intent.
      doc.defaultView?.requestAnimationFrame(() => {
        if (currentOwner(doc) !== target) return;
        const active = doc.activeElement;
        try {
          if (active?.tagName === 'IFRAME' && watchedEditors.has((active as HTMLIFrameElement).contentDocument!))
            target.focus({ preventScroll: true });
        } catch {
          // A navigating frame no longer owns an available editor document.
        }
      });
    },
    true,
  );
  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') owners.delete(doc);
    },
    true,
  );
}

/** Claim before focusing: leaving the iframe can synchronously request SDK focus. */
export function claimAssistantFocus(target: HTMLElement): void {
  const doc = target.ownerDocument;
  watchParent(doc);
  if (visiblePanel(target)) owners.set(doc, target);
  else owners.delete(doc);
}

/** A pending fallback must yield when an explicit editor interaction retired its claim. */
export function ownsAssistantFocus(panel: HTMLElement): boolean {
  const owner = currentOwner(panel.ownerDocument);
  return !!owner && panel.contains(owner);
}

type FocusApi = { getFocusElement?: unknown; WordControl?: { TextBoxInput?: unknown } };
type FocusGlobals = {
  Asc?: { editor?: FocusApi };
  editor?: FocusApi;
  AscCommon?: { g_inputContext?: { HtmlArea?: unknown } };
};

function readOptional<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function isDocumentFocusTarget(win: Window, target: HTMLElement): boolean {
  const doc = win.document;
  if (target.ownerDocument !== doc) return false;
  if (target === doc.getElementById('editor_sdk') || target === doc.getElementById('area_id')) return true;
  // Resolve the live SDK input on every call: it may be replaced after loading.
  // Modal buttons and toolbar controls must retain their native focus behavior.
  const frame = win as unknown as FocusGlobals;
  const api = readOptional(() => frame.Asc?.editor) ?? readOptional(() => frame.editor);
  return (
    readOptional(() => {
      const getFocusElement = api?.getFocusElement;
      return typeof getFocusElement === 'function' ? getFocusElement.call(api) : undefined;
    }) === target ||
    readOptional(() => api?.WordControl?.TextBoxInput) === target ||
    readOptional(() => frame.AscCommon?.g_inputContext?.HtmlArea) === target
  );
}

/** Install only in the SDK's editor realm, leaving native focus unchanged otherwise. */
export function installAssistantFocusGuard(win: Window): boolean {
  try {
    if (win.parent === win || !win.document.getElementById('editor_sdk')) return false;
    const parentDoc = win.parent.document;
    const doc = win.document;
    watchParent(parentDoc);
    if (!watchedEditors.has(doc)) {
      watchedEditors.add(doc);
      const release = () => owners.delete(parentDoc);
      doc.addEventListener('pointerdown', release, true);
      doc.addEventListener('mousedown', release, true);
      doc.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Tab') release();
        },
        true,
      );
    }
    const prototype = (win as Window & typeof globalThis).HTMLElement.prototype;
    if (guardedPrototypes.has(prototype)) return true;
    const focus = prototype.focus;
    prototype.focus = function (...args: Parameters<HTMLElement['focus']>) {
      if (currentOwner(parentDoc) && isDocumentFocusTarget(win, this)) return;
      const result = focus.apply(this, args);
      // A native modal/control may legitimately take focus. Do not release a
      // newer host claim if one of its focus handlers already returned there.
      if (doc.activeElement === this && parentDoc.activeElement === win.frameElement) owners.delete(parentDoc);
      return result;
    };
    guardedPrototypes.add(prototype);
    return true;
  } catch {
    // A navigating or cross-origin frame is not an available editor target.
    return false;
  }
}
