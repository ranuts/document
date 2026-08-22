import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasUnsavedChanges,
  installUnsavedChangesGuard,
  markDocumentDirty,
  markDocumentSaved,
  resetUnsavedChanges,
  resetUnsavedGuardForTests,
} from '../../lib/unsaved-guard';

// One module instance throughout: resetModules() would leave the previous
// instance's beforeunload listener attached to the same window, and that stale
// listener answers for state the current test cannot reach.
function fireBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('unsaved changes guard', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/editor');
  });

  afterEach(() => {
    resetUnsavedGuardForTests();
  });

  it('does not block unload when the document has no edits', () => {
    installUnsavedChangesGuard();

    expect(hasUnsavedChanges()).toBe(false);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('blocks unload once the editor reports an edit', () => {
    installUnsavedChangesGuard();

    markDocumentDirty();

    expect(hasUnsavedChanges()).toBe(true);
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it('stops blocking once the bytes reached the disk', () => {
    installUnsavedChangesGuard();

    markDocumentDirty();
    markDocumentSaved();

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('clears the flag when another document takes over the editor', () => {
    installUnsavedChangesGuard();

    markDocumentDirty();
    resetUnsavedChanges();

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('stays out of the way in embed mode', () => {
    window.history.replaceState(null, '', '/editor?embed=1');
    installUnsavedChangesGuard();

    markDocumentDirty();

    // The host page owns the unload experience for its own iframe.
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('installs a single listener however many times it is called', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');

    installUnsavedChangesGuard();
    installUnsavedChangesGuard();
    installUnsavedChangesGuard();

    expect(addEventListener.mock.calls.filter(([type]) => type === 'beforeunload')).toHaveLength(1);
    addEventListener.mockRestore();
  });
});
