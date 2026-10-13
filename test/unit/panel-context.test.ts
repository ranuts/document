import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountPanelContext } from '../../lib/agent-plugin/ui/panel-context';
import type { EditorApi } from '../../lib/agent-plugin/editor-bridge';

let cleanup: (() => void) | undefined;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function editor() {
  const callbacks = new Map<string, (...args: unknown[]) => void>();
  const api = {
    asc_registerCallback: (name: string, cb: (...args: unknown[]) => void) => callbacks.set(name, cb),
    asc_unregisterCallback: (name: string, cb: (...args: unknown[]) => void) => {
      if (callbacks.get(name) === cb) callbacks.delete(name);
    },
  } as unknown as EditorApi;
  return { api, callbacks };
}

it('pauses hidden page subscriptions and refreshes immediately on visibility resume', () => {
  let visible = true;
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => (visible ? 'visible' : 'hidden'));
  const refresh = vi.fn();
  const context = mountPanelContext({ isActive: () => true, refresh, getApi: () => null });
  cleanup = context.dispose;
  expect(refresh).toHaveBeenCalledTimes(1);
  visible = false;
  document.dispatchEvent(new Event('visibilitychange'));
  refresh.mockClear();
  vi.advanceTimersByTime(3000);
  expect(refresh).not.toHaveBeenCalled();
  visible = true;
  document.dispatchEvent(new Event('visibilitychange'));
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('coalesces SDK notification bursts and unregisters replaced editor callbacks', () => {
  const old = editor();
  const next = editor();
  let api = old.api;
  const refresh = vi.fn();
  const context = mountPanelContext({ isActive: () => true, refresh, getApi: () => api });
  cleanup = context.dispose;
  refresh.mockClear();
  for (let count = 0; count < 20; count++) old.callbacks.get('asc_onSelectionEnd')!();
  expect(refresh).not.toHaveBeenCalled();
  vi.advanceTimersByTime(20);
  expect(refresh).toHaveBeenCalledTimes(1);
  api = next.api;
  window.dispatchEvent(new Event('document:content-ready'));
  expect(old.callbacks.size).toBe(0);
  expect(next.callbacks.size).toBeGreaterThan(0);
  context.dispose();
  expect(next.callbacks.size).toBe(0);
});

it('cancels a queued SDK refresh when the panel closes before delivery', () => {
  const sdk = editor();
  let active = true;
  const refresh = vi.fn();
  const context = mountPanelContext({ isActive: () => active, refresh, getApi: () => sdk.api });
  cleanup = context.dispose;
  refresh.mockClear();
  sdk.callbacks.get('asc_onSelectionEnd')!();
  active = false;
  context.update();
  vi.advanceTimersByTime(20);
  expect(refresh).not.toHaveBeenCalled();
  expect(sdk.callbacks.size).toBe(0);
});

it('contains optional SDK registration, read and unregister failures across hide and disable', () => {
  let active = true;
  const sdk = {
    asc_registerCallback: () => {
      throw new Error('SDK replacing editor');
    },
    asc_unregisterCallback: () => {
      throw new Error('SDK disposed editor');
    },
  } as unknown as EditorApi;
  const context = mountPanelContext({
    isActive: () => active,
    getApi: () => sdk,
    refresh: () => {
      throw new Error('selection not ready');
    },
  });
  cleanup = context.dispose;
  active = false;
  expect(() => context.update()).not.toThrow();
  expect(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))).not.toThrow();
  expect(() => context.dispose()).not.toThrow();
});

it('refreshes only on explicit signals when the SDK cannot unregister callbacks', () => {
  const register = vi.fn();
  const api = { asc_registerCallback: register } as unknown as EditorApi;
  let active = false;
  const refresh = vi.fn();
  const context = mountPanelContext({ isActive: () => active, refresh, getApi: () => api });
  cleanup = context.dispose;
  vi.advanceTimersByTime(3000);
  expect(refresh).not.toHaveBeenCalled();
  active = true;
  context.update();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(register).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  expect(refresh).toHaveBeenCalledTimes(1);
  active = false;
  context.update();
  refresh.mockClear();
  vi.advanceTimersByTime(3000);
  expect(refresh).not.toHaveBeenCalled();
});

it('detaches and stops on BFCache pagehide, reattaching once and refreshing on pageshow', () => {
  const sdk = editor();
  const refresh = vi.fn();
  const context = mountPanelContext({ isActive: () => true, refresh, getApi: () => sdk.api });
  cleanup = context.dispose;
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(sdk.callbacks.size).toBe(0);
  refresh.mockClear();
  vi.advanceTimersByTime(3000);
  expect(refresh).not.toHaveBeenCalled();
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(refresh).toHaveBeenCalledTimes(1);
  refresh.mockClear();
  vi.advanceTimersByTime(1000);
  expect(refresh).not.toHaveBeenCalled();
  context.dispose();
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(sdk.callbacks.size).toBe(0);
});

it('waits for document readiness without polling for a late SDK', () => {
  const sdk = editor();
  let api: EditorApi | null = null;
  const getApi = vi.fn(() => api);
  const refresh = vi.fn();
  const context = mountPanelContext({ isActive: () => true, refresh, getApi });
  cleanup = context.dispose;
  refresh.mockClear();
  getApi.mockClear();
  vi.advanceTimersByTime(30_000);
  expect(refresh).not.toHaveBeenCalled();
  expect(getApi).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  api = sdk.api;
  window.dispatchEvent(new Event('document:content-ready'));
  expect(refresh).toHaveBeenCalledOnce();
  expect(sdk.callbacks.size).toBeGreaterThan(0);
});

it('refreshes content, sheet, protection and review changes without a selection move', () => {
  const sdk = editor();
  const refresh = vi.fn();
  const context = mountPanelContext({ isActive: () => true, refresh, getApi: () => sdk.api });
  cleanup = context.dispose;
  refresh.mockClear();
  sdk.callbacks.get('asc_onDocumentChanged')!();
  for (const name of [
    'asc_onActiveSheetChanged',
    'asc_onDocumentModifiedChanged',
    'asc_onUserActionEnd',
    'asc_onSheetsChanged',
    'asc_onChangeRestrictions',
    'asc_onChangeViewMode',
    'asc_onChangeDocumentProtection',
    'asc_onChangeProtectWorkbook',
    'asc_onChangeProtectWorksheet',
    'asc_onChangeDisplayModeInReview',
    'asc_onOnTrackRevisionsChange',
  ])
    sdk.callbacks.get(name)!();
  vi.advanceTimersByTime(20);
  expect(refresh).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('uses editor input signals even without SDK callback support and detaches on close', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const api = {} as EditorApi;
  Object.assign(frame.contentWindow!, { editor: api });
  let active = true;
  const refresh = vi.fn();
  const context = mountPanelContext({ isActive: () => active, refresh, getApi: () => api });
  cleanup = () => {
    context.dispose();
    frame.remove();
  };
  refresh.mockClear();
  frame.contentDocument!.dispatchEvent(new Event('input'));
  frame.contentDocument!.dispatchEvent(new Event('selectionchange'));
  vi.advanceTimersByTime(20);
  expect(refresh).toHaveBeenCalledOnce();
  active = false;
  context.update();
  refresh.mockClear();
  frame.contentDocument!.dispatchEvent(new Event('input'));
  vi.advanceTimersByTime(30_000);
  expect(refresh).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
