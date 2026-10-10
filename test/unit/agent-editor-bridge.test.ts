import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EditorNotReadyError,
  getEditorApi,
  getEditorContext,
  requireEditorApi,
  requireEditorContext,
} from '../../lib/agent-plugin/editor-bridge';

/**
 * OnlyOffice replaces the placeholder div with `<iframe name="frameEditor">`,
 * so we plant such an iframe and override its contentWindow (jsdom's real one
 * can't be assigned a `.editor` reliably).
 */
function mountIframe(contentWindow: unknown, opts: { name?: string } = {}): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  if (opts.name) iframe.setAttribute('name', opts.name);
  Object.defineProperty(iframe, 'contentWindow', { value: contentWindow, configurable: true });
  document.body.appendChild(iframe);
  return iframe;
}

describe('agent editor-bridge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('getEditorApi', () => {
    it('returns null when there is no iframe', () => {
      expect(getEditorApi()).toBeNull();
    });

    it('returns the api from the named frameEditor iframe', () => {
      const api = { pluginMethod_PasteHtml: () => {} };
      mountIframe({ editor: api }, { name: 'frameEditor' });
      expect(getEditorApi()).toBe(api);
    });

    it('falls back to any iframe exposing editor when none is named frameEditor', () => {
      const api = { pluginMethod_PasteHtml: () => {} };
      mountIframe({ editor: api });
      expect(getEditorApi()).toBe(api);
    });

    it('resolves the api from Asc.editor when window.editor is undefined (Excel)', () => {
      const api = { pluginMethod_PasteHtml: () => {} };
      mountIframe({ editor: undefined, Asc: { editor: api } }, { name: 'frameEditor' });
      expect(getEditorApi()).toBe(api);
    });

    it('prefers the named frameEditor iframe over other iframes', () => {
      const other = { pluginMethod_PasteHtml: () => {}, _which: 'other' };
      const editorApi = { pluginMethod_PasteHtml: () => {}, _which: 'editor' };
      mountIframe({ editor: other }); // unnamed, appears first in DOM order
      mountIframe({ editor: editorApi }, { name: 'frameEditor' });
      expect(getEditorApi()).toBe(editorApi);
    });

    it('returns null when no iframe exposes an editor', () => {
      mountIframe({ editor: undefined }, { name: 'frameEditor' });
      expect(getEditorApi()).toBeNull();
    });

    it('skips iframes whose contentWindow access throws (cross-origin) and keeps scanning', () => {
      const crossOrigin = document.createElement('iframe');
      Object.defineProperty(crossOrigin, 'contentWindow', {
        get() {
          throw new Error('cross-origin');
        },
        configurable: true,
      });
      document.body.appendChild(crossOrigin);
      const api = { pluginMethod_PasteHtml: () => {} };
      mountIframe({ editor: api }, { name: 'frameEditor' });
      expect(getEditorApi()).toBe(api);
    });
  });

  describe('requireEditorApi', () => {
    it('throws EditorNotReadyError when the editor is unavailable', () => {
      expect(() => requireEditorApi()).toThrow(EditorNotReadyError);
    });

    it('returns the api when available', () => {
      const api = { pluginMethod_PasteHtml: () => {} };
      mountIframe({ editor: api }, { name: 'frameEditor' });
      expect(requireEditorApi()).toBe(api);
    });
  });

  describe('getEditorContext', () => {
    it('returns null when no editor is mounted', () => {
      expect(getEditorContext()).toBeNull();
    });

    it('returns null when the editor is present but Asc is missing', () => {
      mountIframe({ editor: { pluginMethod_PasteHtml: () => {} } }, { name: 'frameEditor' });
      expect(getEditorContext()).toBeNull();
    });

    it('returns both api and Asc when present', () => {
      const api = { pluginMethod_PasteHtml: () => {} };
      const Asc = { asc_CCommentDataWord: function () {} };
      mountIframe({ editor: api, Asc }, { name: 'frameEditor' });
      expect(getEditorContext()).toEqual({ api, Asc });
    });

    it('resolves api from Asc.editor when window.editor is undefined (Excel)', () => {
      const api = { pluginMethod_PasteHtml: () => {} };
      const Asc = { editor: api, asc_CCommentDataWord: function () {} };
      mountIframe({ editor: undefined, Asc }, { name: 'frameEditor' });
      expect(getEditorContext()).toEqual({ api, Asc });
    });
  });

  describe('requireEditorContext', () => {
    it('throws EditorNotReadyError when the context is unavailable', () => {
      mountIframe({ editor: { pluginMethod_PasteHtml: () => {} } }, { name: 'frameEditor' });
      expect(() => requireEditorContext()).toThrow(EditorNotReadyError);
    });

    it('returns the context when available', () => {
      const api = { pluginMethod_PasteHtml: () => {} };
      const Asc = { asc_CCommentDataWord: function () {} };
      mountIframe({ editor: api, Asc }, { name: 'frameEditor' });
      expect(requireEditorContext()).toEqual({ api, Asc });
    });
  });
});

it('returns native history from the same frame as the resolved API', () => {
  document.body.innerHTML = '';
  const unrelated = { History: { Index: 9 } };
  mountIframe({ editor: {}, Asc: {}, AscCommon: unrelated });
  const api = {},
    Asc = {},
    AscCommon = { History: { Index: 0 } };
  mountIframe({ editor: api, Asc, AscCommon }, { name: 'frameEditor' });
  const context = getEditorContext();
  expect(context?.api).toBe(api);
  expect(context?.AscCommon).toBe(AscCommon);
  document.body.innerHTML = '';
});
it('refreshes native history when the editor frame is replaced', () => {
  document.body.innerHTML = '';
  const first = { History: { Index: 0 } };
  mountIframe({ editor: {}, Asc: {}, AscCommon: first }, { name: 'frameEditor' });
  expect(getEditorContext()?.AscCommon).toBe(first);
  document.body.innerHTML = '';
  const second = { History: { Index: -1 } };
  mountIframe({ editor: {}, Asc: {}, AscCommon: second }, { name: 'frameEditor' });
  expect(getEditorContext()?.AscCommon).toBe(second);
  document.body.innerHTML = '';
});
