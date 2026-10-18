import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimAssistantFocus,
  installAssistantFocusGuard,
  ownsAssistantFocus,
} from '../../lib/onlyoffice/guards/assistant-focus';

function fixture() {
  document.body.innerHTML =
    '<section class="agent-runtime-panel"><div class="view"><textarea></textarea><button>Other</button></div></section><input class="external"><iframe></iframe>';
  const panel = document.querySelector<HTMLElement>('.agent-runtime-panel')!;
  const input = panel.querySelector('textarea')!;
  const external = document.querySelector<HTMLInputElement>('.external')!;
  const frame = document.querySelector('iframe')!;
  const win = frame.contentWindow!;
  win.document.body.innerHTML = '<div id="editor_sdk" tabindex="0"></div><textarea id="area_id"></textarea>';
  const editor = win.document.querySelector<HTMLTextAreaElement>('#area_id')!;
  return { panel, input, external, frame, win, editor };
}

function pointer(target: Element, type = 'pointerdown') {
  target.dispatchEvent(new Event(type, { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('assistant focus ownership across the editor boundary', () => {
  it.each(['#area_id', '#editor_sdk'])(
    'blocks background SDK focus on %s after a parent control receives focus',
    (selector) => {
      const { win, input } = fixture();
      expect(installAssistantFocusGuard(win)).toBe(true);
      input.focus();
      win.document.querySelector<HTMLElement>(selector)!.focus();
      expect(document.activeElement).toBe(input);
    },
  );

  it('retries a parent pointer handoff once when Firefox leaves the editor active', () => {
    const { win, input, panel, frame } = fixture();
    let nextFrame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    installAssistantFocusGuard(win);
    frame.focus();
    pointer(input);
    expect(document.activeElement).toBe(frame);
    expect(ownsAssistantFocus(panel)).toBe(true);
    expect(nextFrame).toBeDefined();
    nextFrame!(0);
    expect(document.activeElement).toBe(input);
  });

  it.each(['editor', 'other-control', 'hidden'])('cancels the pointer retry after %s intent', (intent) => {
    const { win, input, panel, frame, external } = fixture();
    let nextFrame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    installAssistantFocusGuard(win);
    frame.focus();
    pointer(input);
    if (intent === 'editor') pointer(win.document.body);
    else if (intent === 'other-control') pointer(external);
    else panel.hidden = true;
    expect(nextFrame).toBeDefined();
    nextFrame!(0);
    expect(document.activeElement).toBe(frame);
  });

  it('allows SDK modal focus and retires assistant ownership after that actual handoff', () => {
    const { win, input, panel } = fixture();
    const modal = win.document.createElement('button');
    win.document.body.append(modal);
    installAssistantFocusGuard(win);
    input.focus();
    modal.focus({ preventScroll: true });
    expect(win.document.activeElement).toBe(modal);
    expect(ownsAssistantFocus(panel)).toBe(false);
  });

  it('keeps the claim when a non-document native focus call does not move focus', () => {
    const { win, input, panel, editor } = fixture();
    const inert = win.document.createElement('div');
    win.document.body.append(inert);
    installAssistantFocusGuard(win);
    input.focus();
    inert.focus();
    expect(ownsAssistantFocus(panel)).toBe(true);
    editor.focus();
    expect(document.activeElement).toBe(input);
  });

  it('preserves a new assistant claim made reentrantly during native modal focus', () => {
    const { win, input, panel, editor } = fixture();
    const modal = win.document.createElement('button');
    win.document.body.append(modal);
    installAssistantFocusGuard(win);
    input.focus();
    let enteredModal = false;
    modal.addEventListener('focus', () => {
      enteredModal = true;
      claimAssistantFocus(input);
      input.focus();
    });
    modal.focus();
    expect(enteredModal).toBe(true);
    expect(ownsAssistantFocus(panel)).toBe(true);
    editor.focus();
    expect(document.activeElement).toBe(input);
  });

  it.each(['getFocusElement', 'window-editor', 'TextBoxInput', 'HtmlArea'])(
    'uses the current SDK %s reference rather than retaining an old document input',
    (source) => {
      const { win, input } = fixture();
      const first = win.document.createElement('textarea');
      const second = win.document.createElement('textarea');
      win.document.body.append(first, second);
      const api = {
        input: first,
        getFocusElement() {
          return this.input;
        },
      };
      const wordControl = { TextBoxInput: first };
      const inputContext = { HtmlArea: first };
      if (source === 'getFocusElement') Object.assign(win, { Asc: { editor: api } });
      if (source === 'window-editor') Object.assign(win, { editor: api });
      if (source === 'TextBoxInput') Object.assign(win, { Asc: { editor: { WordControl: wordControl } } });
      if (source === 'HtmlArea') Object.assign(win, { AscCommon: { g_inputContext: inputContext } });
      installAssistantFocusGuard(win);
      input.focus();
      first.focus();
      expect(document.activeElement).toBe(input);
      api.input = second;
      wordControl.TextBoxInput = second;
      inputContext.HtmlArea = second;
      first.focus();
      expect(win.document.activeElement).toBe(first);
      input.focus();
      second.focus();
      expect(document.activeElement).toBe(input);
    },
  );

  it('ignores malformed SDK references while retaining exact document-node fallbacks', () => {
    const { win, input, editor } = fixture();
    Object.assign(win, {
      Asc: { editor: { getFocusElement: 'not callable', WordControl: null } },
      AscCommon: { g_inputContext: { HtmlArea: { id: 'area_id' } } },
    });
    const control = win.document.createElement('input');
    win.document.body.append(control);
    installAssistantFocusGuard(win);
    input.focus();
    control.focus();
    expect(win.document.activeElement).toBe(control);
    input.focus();
    editor.focus();
    expect(document.activeElement).toBe(input);
  });

  it('allows native UI focus when optional SDK accessors throw', () => {
    const { win, input, editor } = fixture();
    for (const key of ['Asc', 'editor', 'AscCommon']) {
      Object.defineProperty(win, key, {
        configurable: true,
        get() {
          throw new Error('SDK unavailable');
        },
      });
    }
    const control = win.document.createElement('button');
    win.document.body.append(control);
    installAssistantFocusGuard(win);
    input.focus();
    expect(() => control.focus()).not.toThrow();
    expect(win.document.activeElement).toBe(control);
    input.focus();
    editor.focus();
    expect(document.activeElement).toBe(input);
  });

  it('still recognizes a live input when another optional SDK accessor fails', () => {
    const { win, input } = fixture();
    const customInput = win.document.createElement('textarea');
    win.document.body.append(customInput);
    Object.defineProperty(win, 'Asc', {
      configurable: true,
      get() {
        throw new Error('Asc unavailable');
      },
    });
    Object.assign(win, {
      editor: {
        getFocusElement() {
          throw new Error('not ready');
        },
        WordControl: { TextBoxInput: customInput },
      },
    });
    installAssistantFocusGuard(win);
    input.focus();
    customInput.focus();
    expect(document.activeElement).toBe(input);
  });

  it('does not reserve focus merely because the panel is open', () => {
    const { win, editor, panel } = fixture();
    installAssistantFocusGuard(win);
    expect(ownsAssistantFocus(panel)).toBe(false);
    editor.focus();
    expect(win.document.activeElement).toBe(editor);
  });

  it.each(['pointerdown', 'mousedown'])('lets an explicit editor %s win before vendor handlers', (event) => {
    const { win, input, editor, panel } = fixture();
    installAssistantFocusGuard(win);
    input.focus();
    editor.addEventListener(event, () => editor.focus());
    pointer(editor, event);
    expect(ownsAssistantFocus(panel)).toBe(false);
    expect(win.document.activeElement).toBe(editor);
  });

  it('releases focus to a parent control outside the panel', () => {
    const { win, input, external, editor, panel } = fixture();
    installAssistantFocusGuard(win);
    input.focus();
    external.focus();
    expect(ownsAssistantFocus(panel)).toBe(false);
    editor.focus();
    expect(win.document.activeElement).toBe(editor);
  });

  it('releases on an outside pointer before its focus default action', () => {
    const { win, input, external, editor, panel } = fixture();
    installAssistantFocusGuard(win);
    input.focus();
    pointer(external);
    expect(ownsAssistantFocus(panel)).toBe(false);
    editor.focus();
    expect(win.document.activeElement).toBe(editor);
  });

  it.each([false, true])('releases an explicit Tab handoff (shift=%s)', (shiftKey) => {
    const { win, input, editor, panel } = fixture();
    installAssistantFocusGuard(win);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true }));
    expect(ownsAssistantFocus(panel)).toBe(false);
    editor.focus();
    expect(win.document.activeElement).toBe(editor);
  });

  it('claims a panel pointer before the browser moves focus into it', () => {
    const { win, input, external, editor, panel } = fixture();
    installAssistantFocusGuard(win);
    external.focus();
    pointer(input);
    expect(ownsAssistantFocus(panel)).toBe(true);
    editor.focus();
    expect(document.activeElement).toBe(external);
  });

  it('protects the initial host focus from reentrant SDK focus', () => {
    const { win, input, editor } = fixture();
    installAssistantFocusGuard(win);
    input.addEventListener('focus', () => editor.focus());
    claimAssistantFocus(input);
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('can claim the panel before an initial focus attempt and loses that claim on editor input', () => {
    const { win, panel, editor } = fixture();
    installAssistantFocusGuard(win);
    editor.focus();
    claimAssistantFocus(panel);
    expect(ownsAssistantFocus(panel)).toBe(true);
    pointer(editor);
    expect(ownsAssistantFocus(panel)).toBe(false);
  });

  it.each(['closed', 'hidden-view', 'display-none', 'visibility-hidden', 'removed-control', 'removed-panel'])(
    'retires ownership immediately when its control becomes %s',
    (change) => {
      const { win, input, editor, panel } = fixture();
      installAssistantFocusGuard(win);
      input.focus();
      const view = input.parentElement!;
      if (change === 'closed') panel.classList.add('agent-panel-hidden');
      if (change === 'hidden-view') view.hidden = true;
      if (change === 'display-none') view.style.display = 'none';
      if (change === 'visibility-hidden') view.style.visibility = 'hidden';
      if (change === 'removed-control') input.remove();
      if (change === 'removed-panel') panel.remove();
      editor.focus();
      expect(win.document.activeElement).toBe(editor);
      expect(ownsAssistantFocus(panel)).toBe(false);
      panel.classList.remove('agent-panel-hidden');
      view.hidden = false;
      view.removeAttribute('style');
      expect(ownsAssistantFocus(panel)).toBe(false);
    },
  );

  it('moves ownership to a newly claimed panel without retaining the old panel', () => {
    const { win, panel, input, editor } = fixture();
    installAssistantFocusGuard(win);
    input.focus();
    const otherPanel = document.createElement('section');
    otherPanel.className = 'agent-runtime-panel';
    const otherInput = document.createElement('textarea');
    otherPanel.append(otherInput);
    document.body.append(otherPanel);
    claimAssistantFocus(otherInput);
    expect(ownsAssistantFocus(panel)).toBe(false);
    expect(ownsAssistantFocus(otherPanel)).toBe(true);
    panel.remove();
    otherInput.focus();
    editor.focus();
    expect(document.activeElement).toBe(otherInput);
  });

  it('keeps focus ownership scoped to the parent document of each editor', () => {
    const { input } = fixture();
    const host = document.createElement('iframe');
    document.body.append(host);
    const hostDoc = host.contentDocument!;
    const nested = hostDoc.createElement('iframe');
    hostDoc.body.append(nested);
    const win = nested.contentWindow!;
    win.document.body.innerHTML = '<div id="editor_sdk"></div><textarea></textarea>';
    const editor = win.document.querySelector('textarea')!;
    installAssistantFocusGuard(win);
    claimAssistantFocus(input);
    editor.focus();
    expect(win.document.activeElement).toBe(editor);
  });

  it('preserves native receiver, options and result without wrapping a realm twice', () => {
    const { win, editor } = fixture();
    const prototype = (win as Window & typeof globalThis).HTMLElement.prototype;
    const native = vi.spyOn(prototype, 'focus');
    installAssistantFocusGuard(win);
    const installed = prototype.focus;
    expect(installAssistantFocusGuard(win)).toBe(true);
    expect(prototype.focus).toBe(installed);
    const options = { preventScroll: true };
    expect(editor.focus(options)).toBeUndefined();
    expect(native).toHaveBeenCalledExactlyOnceWith(options);
    expect(native.mock.contexts[0]).toBe(editor);
    expect(win.document.activeElement).toBe(editor);
  });

  it('leaves non-editor iframe focus untouched and can install once its editor mounts', () => {
    const { win, editor, input } = fixture();
    win.document.querySelector('#editor_sdk')!.remove();
    const original = (win as Window & typeof globalThis).HTMLElement.prototype.focus;
    expect(installAssistantFocusGuard(win)).toBe(false);
    expect((win as Window & typeof globalThis).HTMLElement.prototype.focus).toBe(original);
    const marker = win.document.createElement('div');
    marker.id = 'editor_sdk';
    win.document.body.append(marker);
    expect(installAssistantFocusGuard(win)).toBe(true);
    input.focus();
    editor.focus();
    expect(document.activeElement).toBe(input);
  });
});
