import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import { ARTIFACT_DB_NAME, createArtifactStore } from '../../lib/agent-plugin/artifacts/store';
import { createArtifactsView, type ArtifactsLabels } from '../../lib/agent-plugin/ui/artifacts-view';
beforeEach(async () => {
  document.body.replaceChildren();
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(ARTIFACT_DB_NAME);
    r.onsuccess = () => resolve();
  });
});
const labels = Object.fromEntries(
  [
    'title',
    'empty',
    'back',
    'titleField',
    'textField',
    'version',
    'saveVersion',
    'apply',
    'delete',
    'confirmDelete',
    'cancel',
    'saved',
    'conflict',
    'limit',
    'failed',
    'discardChanges',
    'provenance',
  ].map((k) => [k, k]),
) as unknown as ArtifactsLabels;
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
it('saves explicitly, preserves a conflicting edit, and applies selected text', async () => {
  const store = createArtifactStore();
  const apply = vi.fn();
  const view = createArtifactsView({ store, labels, onApply: apply });
  document.body.append(view.el);
  await view.save('original');
  const a = (await store.list())[0];
  const text = view.el.querySelector('textarea')!;
  text.value = 'my draft';
  text.dispatchEvent(new Event('input'));
  await store.update(a.id, 1, { title: 'Changed elsewhere', text: 'other' });
  (view.el.querySelector('[data-action="saveVersion"]') as HTMLButtonElement).click();
  await tick();
  expect(text.value).toBe('my draft');
  expect(view.el.querySelector('[role="status"]')?.textContent).toBe('conflict');
  (view.el.querySelector('[data-action="apply"]') as HTMLButtonElement).click();
  await tick();
  expect(apply).toHaveBeenCalledWith('my draft');
  view.dispose();
});
it('requires confirmation before deleting and supports choosing older versions', async () => {
  const store = createArtifactStore();
  const a = await store.create({ title: 'Draft', text: 'one', provenance: {} });
  await store.update(a.id, 1, { title: 'Draft', text: 'two' });
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  await view.refresh();
  document.body.append(view.el);
  (view.el.querySelector('[data-artifact]') as HTMLButtonElement).click();
  await tick();
  const select = view.el.querySelector('select')!;
  select.value = '1';
  select.dispatchEvent(new Event('change'));
  expect(view.el.querySelector('textarea')?.value).toBe('one');
  (view.el.querySelector('[data-action="saveVersion"]') as HTMLButtonElement).click();
  await tick();
  expect((await store.get(a.id))?.versions.at(-1)?.text).toBe('one');
  (view.el.querySelector('[data-action="delete"]') as HTMLButtonElement).click();
  await tick();
  expect(await store.get(a.id)).toBeDefined();
  (view.el.querySelector('[data-action="confirmDelete"]') as HTMLButtonElement).click();
  await tick();
  expect(await store.get(a.id)).toBeUndefined();
  view.dispose();
});
it('keeps an unsaved editor when a new result or back navigation is requested', async () => {
  const store = createArtifactStore();
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.save('first');
  const text = view.el.querySelector('textarea')!;
  text.value = 'edited';
  text.dispatchEvent(new Event('input'));
  await view.save('second');
  expect(await store.list()).toHaveLength(1);
  expect(text.value).toBe('edited');
  (view.el.querySelector('[data-action="cancel"]') as HTMLButtonElement).click();
  (view.el.querySelector('[data-action="back"]') as HTMLButtonElement).click();
  expect(view.el.querySelector('textarea')?.value).toBe('edited');
  (view.el.querySelector('[data-action="discardChanges"]') as HTMLButtonElement).click();
  await tick();
  expect(view.el.querySelector('textarea')).toBeNull();
  view.dispose();
});
it('reports storage failures without discarding edited text', async () => {
  const store = createArtifactStore();
  const view = createArtifactsView({ store, labels, onApply: () => Promise.reject(new Error('private')) });
  document.body.append(view.el);
  await view.save('first');
  const text = view.el.querySelector('textarea')!;
  text.value = 'draft';
  text.dispatchEvent(new Event('input'));
  vi.spyOn(store, 'update').mockRejectedValue(new Error('private details'));
  (view.el.querySelector('[data-action="saveVersion"]') as HTMLButtonElement).click();
  await tick();
  expect(view.el.querySelector('[role="status"]')?.textContent).toBe('failed');
  expect(text.value).toBe('draft');
  view.setLabels({ ...labels, apply: 'Review in document' });
  expect(view.el.querySelector('[data-action="apply"]')?.textContent).toBe('Review in document');
  (view.el.querySelector('[data-action="apply"]') as HTMLButtonElement).click();
  await tick();
  expect(view.el.textContent).not.toContain('private');
  view.dispose();
});
it('disables editing during an in-flight save and focuses the new editor on settlement', async () => {
  const store = createArtifactStore();
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.save('first');
  const original = store.update.bind(store);
  let release!: () => void;
  vi.spyOn(store, 'update').mockImplementation(async (...args) => {
    await new Promise<void>((r) => {
      release = r;
    });
    return original(...args);
  });
  const text = view.el.querySelector('textarea')!;
  text.value = 'second';
  text.dispatchEvent(new Event('input'));
  (view.el.querySelector('[data-action="saveVersion"]') as HTMLButtonElement).click();
  expect(text.disabled).toBe(true);
  release();
  await vi.waitFor(() => expect(view.el.querySelector('textarea')?.value).toBe('second'));
  await vi.waitFor(() => expect(document.activeElement).toBe(view.el.querySelector('textarea')));
  view.dispose();
});
it('keeps provenance human-readable after a language change', async () => {
  const view = createArtifactsView({ store: createArtifactStore(), labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.save('Result', {
    conversation: 'internal-conversation-uuid',
    sources: [{ title: 'Policy', connector: 'internal-adapter' }],
  });
  view.setLabels({ ...labels, provenance: 'References' });
  expect(view.el.querySelector('.agent-artifact-provenance')?.textContent).toBe('References · Policy');
  expect(view.el.textContent).not.toContain('internal-conversation-uuid');
  expect(view.el.textContent).not.toContain('internal-adapter');
  view.dispose();
});
