import { afterEach, expect, it, vi } from 'vitest';
import { pasteWordHtml } from '../../lib/agent-plugin/word-paste';
import type { EditorContext } from '../../lib/agent-plugin/editor-bridge';
const bridge = vi.hoisted(() => ({ context: null as EditorContext | null }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  getEditorContext: () => bridge.context,
  requireEditorApi: () => bridge.context?.api,
}));
afterEach(() => {
  bridge.context = null;
  vi.useRealTimers();
});
function fixture(sync = false) {
  let resume!: () => void,
    busy = false,
    temporary = false,
    text = 'Alpha';
  const history = {
    Index: 0,
    Points: [{ Items: [{ initial: true }] as unknown[] }],
    Remove_LastPoint() {
      this.Points.pop();
      this.Index--;
    },
  };
  const logic = { GetText: () => text, Document_UpdateInterfaceState: vi.fn() };
  const helper = { Api: undefined as unknown, Paste_Process_End: vi.fn(), active: false };
  helper.Paste_Process_End.mockImplementation(() => {
    helper.active = false;
  });
  const cleanup = vi.fn();
  const undo = vi.fn(() => {
    history.Index--;
    text = 'Alpha';
  });
  const api = {
    WordControl: { m_oLogicDocument: logic },
    pluginMethod_PasteHtml: vi.fn(),
    isLongAction: () => busy,
    sync_StartAction: vi.fn(),
    sync_EndAction: vi.fn(),
    Undo: undo,
    pre_Paste: (_fonts: unknown, _images: unknown, insert: () => void) => {
      resume = insert;
      if (sync) insert();
    },
    asc_PasteData: (_format: number, _html: unknown, _a: unknown, _b: unknown, _c: unknown, complete: () => void) => {
      helper.active = true;
      api.pre_Paste([], {}, () => {
        text = 'Replacement';
        history.Points[1].Items.push({ insertion: true });
        helper.Paste_Process_End();
        complete();
      });
    },
    _pluginMethod_PasteHtml: (_html: string, complete: () => void) => {
      history.Points.push({ Items: [{ deletion: true }] });
      history.Index++;
      text = '';
      busy = true;
      temporary = true;
      api.asc_PasteData(1, {}, undefined, undefined, undefined, () => {
        cleanup();
        busy = false;
        temporary = false;
        complete();
      });
    },
  };
  helper.Api = api;
  bridge.context = {
    api,
    Asc: { c_oAscAsyncActionType: { BlockInteraction: 1 }, c_oAscAsyncAction: { ApplyChanges: 2 } },
    AscCommon: { History: history, g_specialPasteHelper: helper as never },
  } as unknown as EditorContext;
  return {
    api,
    history,
    helper,
    cleanup,
    undo,
    logic,
    resume: () => resume(),
    state: () => ({ text, busy, temporary }),
  };
}
it('waits for native completion while restoring intercepted methods immediately', async () => {
  const f = fixture();
  const prepare = f.api.pre_Paste,
    paste = f.api.asc_PasteData;
  let settled = false;
  const result = pasteWordHtml(f.api as never, '<b>escaped</b>').then(() => {
    settled = true;
  });
  expect(settled).toBe(false);
  expect(f.state().text).toBe('');
  expect(f.api.pre_Paste).toBe(prepare);
  expect(f.api.asc_PasteData).toBe(paste);
  f.resume();
  await result;
  expect(f.state()).toEqual({ text: 'Replacement', busy: false, temporary: false });
  expect(f.cleanup).toHaveBeenCalledOnce();
  expect(f.undo).not.toHaveBeenCalled();
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
});
it('cancels pending deletion, runs native cleanup once, and suppresses late insertion', async () => {
  const f = fixture(),
    abort = new AbortController();
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', abort.signal)).rejects.toThrow('Stopped');
  abort.abort(new DOMException('Stopped', 'AbortError'));
  await result;
  expect(f.state()).toEqual({ text: 'Alpha', busy: false, temporary: false });
  expect(f.history.Index).toBe(0);
  expect(f.history.Points).toHaveLength(1);
  f.resume();
  f.resume();
  expect(f.state().text).toBe('Alpha');
  expect(f.cleanup).toHaveBeenCalledOnce();
  expect(f.undo).toHaveBeenCalledOnce();
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
});
it('accepts synchronous successful native paste', async () => {
  const f = fixture(true);
  await pasteWordHtml(f.api as never, 'Replacement');
  expect(f.state().text).toBe('Replacement');
  expect(f.undo).not.toHaveBeenCalled();
});
it('rejects an already cancelled request before native mutation', async () => {
  const f = fixture(),
    abort = new AbortController();
  abort.abort(new DOMException('Stopped', 'AbortError'));
  await expect(pasteWordHtml(f.api as never, 'Replacement', abort.signal)).rejects.toThrow('Stopped');
  expect(f.state().text).toBe('Alpha');
  expect(f.api.sync_StartAction).not.toHaveBeenCalled();
});
it('times out with cleanup and rollback, preventing late insertion', async () => {
  vi.useFakeTimers();
  const f = fixture();
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', undefined, 50)).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(50);
  await result;
  f.resume();
  expect(f.state()).toEqual({ text: 'Alpha', busy: false, temporary: false });
});
it('never undoes independent history appended while paste is pending', async () => {
  const f = fixture(),
    abort = new AbortController();
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', abort.signal)).rejects.toThrow();
  f.history.Points.push({ Items: [{ foreign: true }] });
  f.history.Index++;
  abort.abort(new DOMException('Stopped', 'AbortError'));
  await result;
  f.resume();
  expect(f.undo).not.toHaveBeenCalled();
  expect(f.cleanup).not.toHaveBeenCalled();
});
it('does not clean another editor paste state after identity changes', async () => {
  const f = fixture(),
    abort = new AbortController();
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', abort.signal)).rejects.toThrow();
  bridge.context = null;
  abort.abort(new DOMException('Stopped', 'AbortError'));
  await result;
  f.resume();
  expect(f.undo).not.toHaveBeenCalled();
  expect(f.helper.Paste_Process_End).not.toHaveBeenCalled();
});

it('releases native cleanup after a deferred insertion throws without undoing unverified changes', async () => {
  const f = fixture();
  f.api.asc_PasteData = (_format, _html, _a, _b, _c, _complete) => {
    f.helper.active = true;
    f.api.pre_Paste([], {}, () => {
      f.history.Points[1].Items.push({ partial: true });
      throw new Error('Insertion failed');
    });
  };
  const result = expect(pasteWordHtml(f.api as never, 'Replacement')).rejects.toThrow('could not be verified');
  f.resume();
  await result;
  expect(f.state().busy).toBe(false);
  expect(f.state().temporary).toBe(false);
  expect(f.cleanup).toHaveBeenCalledOnce();
  expect(f.undo).not.toHaveBeenCalled();
});

it('accepts native finalization removing an empty pending paste point on cancellation', async () => {
  const f = fixture(),
    abort = new AbortController();
  f.api._pluginMethod_PasteHtml = (_html, complete) => {
    f.history.Points.push({ Items: [] });
    f.history.Index++;
    f.api.asc_PasteData(1, {}, undefined, undefined, undefined, () => {
      if (f.history.Points[1]?.Items.length === 0) f.history.Remove_LastPoint();
      complete();
    });
  };
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', abort.signal)).rejects.toThrow('Stopped');
  abort.abort(new DOMException('Stopped', 'AbortError'));
  await result;
  f.resume();
  expect(f.state().text).toBe('Alpha');
  expect(f.history.Points).toHaveLength(1);
  expect(f.undo).not.toHaveBeenCalled();
});

it('releases its interaction action before the native wrapper waits for long actions to finish', async () => {
  vi.useFakeTimers();
  const f = fixture();
  let blocking = false,
    queued: (() => void) | undefined;
  f.api.sync_StartAction.mockImplementation(() => {
    blocking = true;
  });
  f.api.sync_EndAction.mockImplementation(() => {
    blocking = false;
    queued?.();
  });
  f.api._pluginMethod_PasteHtml = (_html, complete) => {
    f.history.Points.push({ Items: [{ deletion: true }] });
    f.history.Index++;
    f.api.asc_PasteData(1, {}, undefined, undefined, undefined, () => {
      if (blocking) queued = complete;
      else complete();
    });
  };
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', undefined, 50)).resolves.toBeUndefined();
  f.resume();
  await vi.advanceTimersByTimeAsync(50);
  await result;
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
  expect(f.undo).not.toHaveBeenCalled();
});

it('waits for deferred wrapper cleanup before rolling back cancelled text', async () => {
  vi.useFakeTimers();
  const f = fixture(),
    abort = new AbortController();
  const wrapper = f.api._pluginMethod_PasteHtml;
  f.api._pluginMethod_PasteHtml = (html, complete) => wrapper(html, () => setTimeout(complete, 50));
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', abort.signal)).rejects.toThrow('Stopped');
  abort.abort(new DOMException('Stopped', 'AbortError'));
  expect(f.undo).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(50);
  await result;
  expect(f.state().text).toBe('Alpha');
  expect(f.undo).toHaveBeenCalledOnce();
});

it('does not roll back a foreign edit made while cancelled wrapper cleanup is pending', async () => {
  vi.useFakeTimers();
  const f = fixture(),
    abort = new AbortController();
  const wrapper = f.api._pluginMethod_PasteHtml;
  f.api._pluginMethod_PasteHtml = (html, complete) => wrapper(html, () => setTimeout(complete, 50));
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', abort.signal)).rejects.toThrow(
    'could not be verified',
  );
  abort.abort(new DOMException('Stopped', 'AbortError'));
  const foreign = { Items: [{ independent: true }] };
  f.history.Points.push(foreign);
  f.history.Index++;
  await vi.advanceTimersByTimeAsync(50);
  await result;
  f.resume();
  expect(f.undo).not.toHaveBeenCalled();
  expect(f.history.Points.at(-1)).toBe(foreign);
  expect(f.history.Index).toBe(2);
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
});

it('never changes document history when wrapper cleanup arrives after its deadline', async () => {
  vi.useFakeTimers();
  const f = fixture(),
    abort = new AbortController();
  const wrapper = f.api._pluginMethod_PasteHtml;
  let lateCleanup!: () => void;
  f.api._pluginMethod_PasteHtml = (html, complete) =>
    wrapper(html, () => {
      lateCleanup = complete;
    });
  const result = expect(pasteWordHtml(f.api as never, 'Replacement', abort.signal, 50)).rejects.toThrow(
    'could not be verified',
  );
  abort.abort(new DOMException('Stopped', 'AbortError'));
  await vi.advanceTimersByTimeAsync(50);
  await result;
  const foreign = { Items: [{ independent: true }] };
  f.history.Points.push(foreign);
  f.history.Index++;
  const beforeLate = f.state();
  lateCleanup();
  f.resume();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.state()).toEqual(beforeLate);
  expect(f.undo).not.toHaveBeenCalled();
  expect(f.history.Points.at(-1)).toBe(foreign);
  expect(f.history.Index).toBe(2);
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
});
