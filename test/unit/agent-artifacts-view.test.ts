import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import { ARTIFACT_DB_NAME, ArtifactError, createArtifactStore } from '../../lib/agent-plugin/artifacts/store';
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
    'versionLimit',
    'countLimit',
    'textLimit',
    'saveNew',
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
  expect(view.el.querySelector('[role="status"]')?.textContent).toContain('conflict');
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
  await view.refresh();
  expect(view.el.querySelector('textarea')).toBe(text);
  const pendingSave = view.save('second');
  expect(await store.list()).toHaveLength(1);
  expect(text.value).toBe('edited');
  (view.el.querySelector('[data-action="cancel"]') as HTMLButtonElement).click();
  expect(await pendingSave).toBe('cancelled');
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

it('discards both the edited title and text when returning to the latest version', async () => {
  const store = createArtifactStore();
  const a = await store.create({ title: 'Saved title', text: 'one', provenance: {} });
  await store.update(a.id, 1, { title: 'Saved title', text: 'two' });
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.refresh();
  (view.el.querySelector('[data-artifact]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.el.querySelector('select')).not.toBeNull());
  const select = view.el.querySelector('select')!;
  select.value = '1';
  select.dispatchEvent(new Event('change'));
  const title = view.el.querySelector('input')!;
  title.value = 'Unsaved title';
  title.dispatchEvent(new Event('input'));
  select.value = '2';
  select.dispatchEvent(new Event('change'));
  (view.el.querySelector('[data-action=discardChanges]') as HTMLButtonElement).click();
  expect(title.value).toBe('Saved title');
  expect(view.el.querySelector('textarea')!.value).toBe('two');
  expect((view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).disabled).toBe(true);
  expect((await store.get(a.id))!.title).toBe('Saved title');
  view.dispose();
});
it('offers a working save-as-new recovery when an artifact reaches twenty versions', async () => {
  const store = createArtifactStore();
  const a = await store.create({
    title: 'Saved title',
    text: 'one',
    provenance: { sources: [{ title: 'Policy', connector: 'local' }] },
  });
  for (let v = 1; v < 20; v++) await store.update(a.id, v, { title: a.title, text: String(v) });
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.refresh();
  (view.el.querySelector('[data-artifact]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.el.querySelector('textarea')).not.toBeNull());
  const text = view.el.querySelector('textarea')!;
  text.value = 'New draft';
  text.dispatchEvent(new Event('input'));
  (view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.el.querySelector('[role=status]')!.textContent).toContain('versionLimit'));
  expect(text.value).toBe('New draft');
  (view.el.querySelector('[data-action=saveNew]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.el.querySelector('[role=status]')!.textContent).toBe('saved'));
  expect(await store.list()).toHaveLength(2);
  expect((await store.get(a.id))!.versions).toHaveLength(20);
  expect(view.current!.id).not.toBe(a.id);
  expect(view.current!.versions.map((v) => v.text)).toEqual(['New draft']);
  expect(view.current!.provenance.sources![0].title).toBe('Policy');
  view.dispose();
});

it.each([
  ['count-limit', 'countLimit'],
  ['text-limit', 'textLimit'],
] as const)('explains %s without losing the editable draft', async (code, message) => {
  const store = createArtifactStore();
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.save('Saved body');
  const text = view.el.querySelector('textarea')!;
  text.value = 'Keep this draft';
  text.dispatchEvent(new Event('input'));
  vi.spyOn(store, 'update').mockRejectedValue(new ArtifactError(code));
  (view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.el.querySelector('[role=status]')!.textContent).toBe(message));
  expect(text.value).toBe('Keep this draft');
  expect(text.disabled).toBe(false);
  expect(view.el.querySelector('[data-action=saveNew]')).toBeNull();
  view.dispose();
});

it('canceling a version switch preserves the previously selected version and edited draft', async () => {
  const store = createArtifactStore();
  const a = await store.create({ title: 'Saved title', text: 'one', provenance: {} });
  await store.update(a.id, 1, { title: 'Saved title', text: 'two' });
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.refresh();
  (view.el.querySelector('[data-artifact]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.el.querySelector('select')).not.toBeNull());
  const select = view.el.querySelector('select')!;
  select.value = '1';
  select.dispatchEvent(new Event('change'));
  const title = view.el.querySelector('input')!;
  title.value = 'Keep my title';
  title.dispatchEvent(new Event('input'));
  select.value = '2';
  select.dispatchEvent(new Event('change'));
  (view.el.querySelector('[data-action=cancel]') as HTMLButtonElement).click();
  expect(select.value).toBe('1');
  expect(title.value).toBe('Keep my title');
  expect(view.el.querySelector('textarea')!.value).toBe('one');
  expect((view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).disabled).toBe(false);
  view.dispose();
});
it('reports cancelled save after keeping a dirty draft and settles pending confirmation on disposal', async () => {
  const store = createArtifactStore();
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  expect(await view.save('first')).toBe('saved');
  const text = view.el.querySelector('textarea')!;
  text.value = 'unsaved';
  text.dispatchEvent(new Event('input'));
  const pending = view.save('second');
  let settled = false;
  void pending.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  view.el.querySelector<HTMLButtonElement>('[data-action=cancel]')!.click();
  expect(await pending).toBe('cancelled');
  expect(text.value).toBe('unsaved');
  const closing = view.save('third');
  view.dispose();
  expect(await closing).toBe('cancelled');
  expect(await store.list()).toHaveLength(1);
});
it('reports storage failure rather than successful save', async () => {
  const store = createArtifactStore();
  vi.spyOn(store, 'create').mockRejectedValue(new Error('full'));
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  expect(await view.save('answer')).toBe('failed');
  view.dispose();
});
it('settles replaced confirmations and cancels navigation without adopting a late saved editor', async () => {
  const store = createArtifactStore();
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.save('first');
  const text = view.el.querySelector('textarea')!;
  text.value = 'draft';
  text.dispatchEvent(new Event('input'));
  const first = view.save('second');
  const second = view.save('third');
  expect(await first).toBe('cancelled');
  view.cancelPending();
  expect(await second).toBe('cancelled');
  expect(view.el.querySelector('[data-action=discardChanges]')).toBeNull();
  expect(text.value).toBe('draft');
  // Return to the list explicitly before testing a delayed successful write.
  view.el.querySelector<HTMLButtonElement>('[data-action=back]')!.click();
  view.el.querySelector<HTMLButtonElement>('[data-action=discardChanges]')!.click();
  await tick();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const create = store.create.bind(store);
  vi.spyOn(store, 'create').mockImplementation(async (input) => {
    const a = await create(input);
    await gate;
    return a;
  });
  const pending = view.save('late result');
  view.cancelPending();
  expect(await pending).toBe('cancelled');
  release();
  await tick();
  expect(view.el.querySelector('textarea')).toBeNull();
  view.dispose();
});
it('accepts a range proposal into an unchanged draft only, without saving automatically', async () => {
  let request: import('../../lib/agent-plugin/ui/artifact-workflow').ArtifactRevisionRequest | undefined;
  const store = createArtifactStore();
  const workflowLabels = {
    refine: 'Refine',
    instruction: 'Instruction',
    submit: 'Suggest',
    stop: 'Stop',
    accept: 'Use draft',
    reject: 'Discard',
    waiting: 'Waiting',
    ready: 'Ready',
    stale: 'Changed',
    failed: 'Failed',
    stopped: 'Stopped',
    accepted: 'Accepted',
  };
  const view = createArtifactsView({
    store,
    labels,
    onApply: vi.fn(),
    refinement: {
      labels: workflowLabels,
      submit: (r) => {
        request = r;
      },
      stop: vi.fn(),
    },
  });
  document.body.append(view.el);
  await view.save('前😀selected后');
  const text = view.el.querySelector('textarea')!;
  text.setSelectionRange(3, 11);
  (view.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
  const instruction = view.el.querySelector('form input') as HTMLInputElement;
  instruction.value = 'Shorten';
  view.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(request?.draft.selectedText).toBe('selected');
  request!.complete('新');
  (view.el.querySelector('[data-action=accept]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(text.value).toBe('前😀新后'));
  expect((await store.get(request!.draft.artifactId))!.versions).toHaveLength(1);
  expect((view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).disabled).toBe(false);
  view.dispose();
});
it('invalidates late proposals after manual edits and offers direct keep-as-new on storage conflict', async () => {
  let request: import('../../lib/agent-plugin/ui/artifact-workflow').ArtifactRevisionRequest | undefined;
  const store = createArtifactStore();
  const view = createArtifactsView({
    store,
    labels,
    onApply: vi.fn(),
    refinement: {
      labels: {
        refine: 'Refine',
        instruction: 'Instruction',
        submit: 'Suggest',
        stop: 'Stop',
        accept: 'Accept',
        reject: 'Reject',
        waiting: 'Waiting',
        ready: 'Ready',
        stale: 'Changed',
        failed: 'Failed',
        stopped: 'Stopped',
        accepted: 'Accepted',
      },
      submit: (r) => {
        request = r;
      },
      stop: vi.fn(),
    },
  });
  await view.save('Original', { sources: [{ title: 'Source', connector: 'local' }] });
  (view.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
  (view.el.querySelector('form input') as HTMLInputElement).value = 'Revise';
  view.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  const text = view.el.querySelector('textarea')!;
  text.value = 'My new edit';
  text.dispatchEvent(new Event('input'));
  request!.complete('Must not replace');
  expect(view.el.querySelector('[data-action=accept]')?.closest('[hidden]')).not.toBeNull();
  const artifact = view.current!;
  await store.update(artifact.id, 1, { title: 'Other', text: 'Other writer' });
  (view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.el.querySelector('[data-action=saveNew]')).not.toBeNull());
  (view.el.querySelector('[data-action=saveNew]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.current!.id).not.toBe(artifact.id));
  expect(view.current!.versions[0].text).toBe('My new edit');
  expect(view.current!.provenance.sources).toEqual([{ title: 'Source', connector: 'local' }]);
  expect((await store.get(artifact.id))!.versions.at(-1)!.text).toBe('Other writer');
  view.dispose();
});
it('rejects acceptance after a concurrent persisted version and preserves pending-save outcomes', async () => {
  let request: import('../../lib/agent-plugin/ui/artifact-workflow').ArtifactRevisionRequest;
  const store = createArtifactStore();
  const view = createArtifactsView({
    store,
    labels,
    onApply: vi.fn(),
    refinement: {
      labels: {
        refine: 'Refine',
        instruction: 'Instruction',
        submit: 'Suggest',
        stop: 'Stop',
        accept: 'Accept',
        reject: 'Reject',
        waiting: 'Waiting',
        ready: 'Ready',
        stale: 'Changed',
        failed: 'Failed',
        stopped: 'Stopped',
        accepted: 'Accepted',
      },
      submit: (r) => {
        request = r;
      },
      stop: vi.fn(),
    },
  });
  await view.save('Original');
  (view.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
  (view.el.querySelector('form input') as HTMLInputElement).value = 'Revise';
  view.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  request!.complete('Changed');
  await store.update(request!.draft.artifactId, 1, { title: 'Other', text: 'Other writer' });
  (view.el.querySelector('[data-action=accept]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(view.el.querySelector('[data-action=saveNew]')).not.toBeNull());
  expect(view.el.querySelector('textarea')!.value).toBe('Original');
  view.setRefinementLabels({
    refine: 'Refine again',
    instruction: 'Instruction',
    submit: 'Suggest',
    stop: 'Stop',
    accept: 'Accept',
    reject: 'Reject',
    waiting: 'Waiting',
    ready: 'Ready',
    stale: 'Changed',
    failed: 'Failed',
    stopped: 'Stopped',
    accepted: 'Accepted',
  });
  expect(view.el.querySelector('[data-action=refine]')?.textContent).toBe('Refine again');
  view.dispose();
});
it.each(['draft', 'context'] as const)(
  'rechecks %s freshness after an asynchronous acceptance read',
  async (change) => {
    const original = createArtifactStore();
    let held = false,
      finish: ((artifact: Awaited<ReturnType<typeof original.get>>) => void) | undefined;
    const store = {
      ...original,
      get: (id: string) =>
        held
          ? new Promise<Awaited<ReturnType<typeof original.get>>>((resolve) => {
              finish = resolve;
            })
          : original.get(id),
    };
    let request: import('../../lib/agent-plugin/ui/artifact-workflow').ArtifactRevisionRequest;
    let contextCurrent = true;
    const view = createArtifactsView({
      store,
      labels,
      onApply: vi.fn(),
      refinement: {
        labels: {
          refine: 'Refine',
          instruction: 'Instruction',
          submit: 'Suggest',
          stop: 'Stop',
          accept: 'Accept',
          reject: 'Reject',
          waiting: 'Waiting',
          ready: 'Ready',
          stale: 'Changed',
          failed: 'Failed',
          stopped: 'Stopped',
          accepted: 'Accepted',
        },
        submit: (r) => {
          request = r;
          r.bindCurrent(() => contextCurrent);
        },
        stop: vi.fn(),
      },
    });
    await view.save('Original');
    (view.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
    (view.el.querySelector('form input') as HTMLInputElement).value = 'Revise';
    view.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    request!.complete('Suggestion');
    held = true;
    (view.el.querySelector('[data-action=accept]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(finish).toBeDefined());
    const text = view.el.querySelector('textarea')!;
    if (change === 'draft') {
      text.value = 'My newer draft';
      text.dispatchEvent(new Event('input'));
    } else contextCurrent = false;
    finish!(await original.get(request!.draft.artifactId));
    await vi.waitFor(() =>
      expect((view.el.querySelector('[data-action=accept]') as HTMLButtonElement).disabled).toBe(false),
    );
    expect(text.value).toBe(change === 'draft' ? 'My newer draft' : 'Original');
    expect((await original.get(request!.draft.artifactId))!.versions).toHaveLength(1);
    view.dispose();
  },
);
it('restores selected instructions without old offsets and requires an explicit new scope for changed bodies', async () => {
  const { captureArtifactDraft } = await import('../../lib/agent-plugin/artifacts/edit-proposal');
  const submit = vi.fn();
  const view = createArtifactsView({
    store: createArtifactStore(),
    labels,
    onApply: vi.fn(),
    refinement: {
      labels: {
        refine: 'Refine',
        instruction: 'Instruction',
        submit: 'Suggest',
        stop: 'Stop',
        accept: 'Accept',
        reject: 'Reject',
        waiting: 'Waiting',
        ready: 'Ready',
        stale: 'Changed',
        failed: 'Failed',
        stopped: 'Stopped',
        accepted: 'Accepted',
        selected: 'Selected {count}',
        entire: 'Entire artifact',
        recovered: 'Select again or choose entire artifact',
      },
      submit,
      stop: vi.fn(),
    },
  });
  await view.save('Original body');
  const bound = captureArtifactDraft({
    artifactId: view.current!.id,
    expectedVersion: 1,
    revision: 1,
    title: view.current!.title,
    text: 'Original body',
    start: 0,
    end: 8,
  });
  const text = view.el.querySelector('textarea')!;
  text.value = 'My newer draft';
  text.dispatchEvent(new Event('input'));
  expect(await view.recover(bound, 'Delete this selection')).toBe(true);
  const send = view.el.querySelector<HTMLButtonElement>('[data-action=submit]')!;
  expect(send.disabled).toBe(true);
  expect(text.value).toBe('My newer draft');
  expect(text.selectionStart).toBe(0);
  expect(text.selectionEnd).toBe(0);
  view.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(submit).not.toHaveBeenCalled();
  view.el.querySelector<HTMLButtonElement>('[data-action=entire]')!.click();
  expect(send.disabled).toBe(false);
  expect(submit).not.toHaveBeenCalled();
  expect((view.el.querySelector('form input') as HTMLInputElement).value).toBe('Delete this selection');
  view.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(submit.mock.calls[0][0].draft.selectedText).toBe('My newer draft');
  view.dispose();
});
it('keeps recovered clean-artifact instructions when an earlier list refresh settles later', async () => {
  const { captureArtifactDraft } = await import('../../lib/agent-plugin/artifacts/edit-proposal');
  const original = createArtifactStore();
  let release!: (rows: Awaited<ReturnType<typeof original.list>>) => void;
  const list = new Promise<Awaited<ReturnType<typeof original.list>>>((resolve) => {
    release = resolve;
  });
  const view = createArtifactsView({
    store: { ...original, list: () => list },
    labels,
    onApply: vi.fn(),
    refinement: {
      labels: {
        refine: 'Refine',
        instruction: 'Instruction',
        submit: 'Suggest',
        stop: 'Stop',
        accept: 'Accept',
        reject: 'Reject',
        waiting: 'Waiting',
        ready: 'Ready',
        stale: 'Changed',
        failed: 'Failed',
        stopped: 'Stopped',
        accepted: 'Accepted',
        selected: 'Selected {count}',
        entire: 'Entire artifact',
      },
      submit: vi.fn(),
      stop: vi.fn(),
    },
  });
  await view.save('Original body');
  const artifact = view.current!;
  const bound = captureArtifactDraft({
    artifactId: artifact.id,
    expectedVersion: 1,
    revision: 1,
    title: artifact.title,
    text: 'Original body',
    start: 0,
    end: 8,
  });
  // showView('artifacts') starts refresh before origin-aware recovery is staged.
  const refreshing = view.refresh();
  expect(await view.recover(bound, 'Keep this instruction')).toBe(true);
  release(await original.list());
  await refreshing;
  expect(view.current?.id).toBe(artifact.id);
  expect(view.el.querySelector('textarea')?.value).toBe('Original body');
  expect((view.el.querySelector('form input') as HTMLInputElement).value).toBe('Keep this instruction');
  view.dispose();
});
it('imports a validated structured result, paginates preview, preserves JSON edits and hides unsupported native apply', async () => {
  const store = createArtifactStore();
  const apply = vi.fn();
  const view = createArtifactsView({ store, labels, onApply: apply });
  document.body.append(view.el);
  await view.refresh();
  (view.el.querySelector('[data-action=import]') as HTMLButtonElement).click();
  const title = view.el.querySelector('input')!;
  title.value = 'Table';
  const text = view.el.querySelector('textarea')!;
  text.value = JSON.stringify({
    schemaVersion: 1,
    payload: { kind: 'table', columns: ['Name'], rows: Array.from({ length: 25 }, (_, i) => ['row ' + i]) },
  });
  text.dispatchEvent(new Event('input'));
  (view.el.querySelector('[data-action=saveNew]') as HTMLButtonElement).click();
  await tick();
  expect(view.el.querySelectorAll('table tr')).toHaveLength(11);
  expect(
    view.el
      .querySelector('.agent-artifact-actions')!
      .compareDocumentPosition(view.el.querySelector('.agent-artifact-presentation')!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect((view.el.querySelector('[data-action=apply]') as HTMLButtonElement).hidden).toBe(true);
  expect(apply).not.toHaveBeenCalled();
  const editor = view.el.querySelector<HTMLTextAreaElement>('textarea[data-artifact-source]')!;
  editor.value = 'invalid JSON';
  editor.dispatchEvent(new Event('input'));
  (view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).click();
  await tick();
  expect(editor.value).toBe('invalid JSON');
  expect((await store.get((await store.list())[0].id))?.versions).toHaveLength(1);
  view.dispose();
});
it('keeps a structured cell focused while typing, persists edits and can restore a prior version', async () => {
  const store = createArtifactStore();
  const payload = { kind: 'table' as const, columns: ['Name'], rows: [['one']] };
  const a = await store.create({ title: 'Data', text: JSON.stringify(payload), payload, provenance: {} });
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.refresh();
  (view.el.querySelector('[data-artifact]') as HTMLButtonElement).click();
  await tick();
  const cell = view.el.querySelector<HTMLTextAreaElement>('td textarea')!;
  cell.focus();
  cell.value = 'two';
  cell.setSelectionRange(2, 2);
  cell.dispatchEvent(new Event('input'));
  expect(document.activeElement).toBe(cell);
  expect(cell.selectionStart).toBe(2);
  expect(view.el.querySelector<HTMLDetailsElement>('.agent-artifact-editor > details')?.open).toBe(false);
  (view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).click();
  await tick();
  expect((await store.get(a.id))?.versions[1].payload).toEqual({ ...payload, rows: [['two']] });
  const select = view.el.querySelector('select')!;
  select.value = '1';
  select.dispatchEvent(new Event('change'));
  expect(view.el.querySelector<HTMLTextAreaElement>('td textarea')?.value).toBe('one');
  view.dispose();
});
it('retains imported text payload envelopes when editing a version', async () => {
  const store = createArtifactStore();
  const payload = { kind: 'text' as const, text: 'one' };
  const a = await store.create({ title: 'Text', text: 'one', payload, provenance: {} });
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.refresh();
  (view.el.querySelector('[data-artifact]') as HTMLButtonElement).click();
  await tick();
  const text = view.el.querySelector('textarea')!;
  text.value = 'two';
  text.dispatchEvent(new Event('input'));
  (view.el.querySelector('[data-action=saveVersion]') as HTMLButtonElement).click();
  await tick();
  expect((await store.get(a.id))?.versions[1].payload).toEqual({ kind: 'text', text: 'two' });
  view.dispose();
});

it('keeps destination-aware header Back in the busy registry and guards imported drafts', async () => {
  const store = createArtifactStore();
  const a = await store.create({ title: 'Draft', text: 'original', provenance: {} });
  const close = vi.fn();
  const view = createArtifactsView({
    store,
    labels: {
      ...labels,
      import: 'Import',
      backToConversation: 'Back to conversation',
      backToList: 'Back to artifacts',
    },
    onApply: vi.fn(),
    onClose: close,
  });
  document.body.append(view.el);
  await view.refresh();
  const back = () => view.el.querySelector<HTMLButtonElement>('.agent-view-header [data-action=back]')!;
  expect(back()).toBeNull();
  expect(view.el.querySelectorAll('[data-action=back]')).toHaveLength(0);
  let resolve!: (value: typeof a) => void;
  vi.spyOn(store, 'get').mockImplementationOnce(() => new Promise((r) => (resolve = r)));
  view.el.querySelector<HTMLButtonElement>('[data-artifact]')!.click();
  expect(view.el.querySelector<HTMLButtonElement>('[data-artifact]')!.disabled).toBe(true);
  expect(close).not.toHaveBeenCalled();
  resolve(a);
  await tick();
  expect(back().disabled).toBe(false);
  expect(back().getAttribute('aria-label')).toBe('Back to artifacts');
  view.setLabels({ ...labels, backToList: '返回成果列表' });
  expect(back().getAttribute('aria-label')).toBe('返回成果列表');
  expect(back().querySelectorAll('svg')).toHaveLength(1);
  back().click();
  await tick();
  expect(document.activeElement).toBe(view.el.querySelector('h2'));
  view.el.querySelector<HTMLButtonElement>('[data-action=import]')!.click();
  const data = view.el.querySelector('textarea')!;
  data.value = 'unfinished import';
  data.dispatchEvent(new Event('input'));
  back().click();
  expect(view.el.querySelector('textarea')).toBe(data);
  view.el.querySelector<HTMLButtonElement>('[data-action=cancel]')!.click();
  expect(data.value).toBe('unfinished import');
  back().click();
  view.el.querySelector<HTMLButtonElement>('[data-action=discardChanges]')!.click();
  await tick();
  expect(view.el.querySelector('textarea')).toBeNull();
  expect(view.el.querySelectorAll('[data-action=back]')).toHaveLength(0);
  view.dispose();
});

it('preserves a busy import when workspace navigation requests a list refresh', async () => {
  const store = createArtifactStore();
  const view = createArtifactsView({ store, labels: { ...labels, import: 'Import' }, onApply: vi.fn() });
  document.body.append(view.el);
  await view.refresh();
  view.el.querySelector<HTMLButtonElement>('[data-action=import]')!.click();
  const input = view.el.querySelector('textarea')!;
  view.el.querySelector('input')!.value = 'Imported';
  input.value = JSON.stringify({ schemaVersion: 1, payload: { kind: 'text', text: 'imported' } });
  let release!: () => void;
  const create = store.create.bind(store);
  vi.spyOn(store, 'create').mockImplementation(async (...args) => {
    await new Promise<void>((resolve) => (release = resolve));
    return create(...args);
  });
  view.el.querySelector<HTMLButtonElement>('[data-action=saveNew]')!.click();
  expect(input.disabled).toBe(true);
  view.cancelPending();
  await view.refresh();
  expect(view.el.querySelector('textarea')).toBe(input);
  expect(input.disabled).toBe(true);
  release();
  await vi.waitFor(() => expect(view.el.querySelector('textarea')?.value).toBe('imported'));
  view.dispose();
});

it('focuses the safe deletion choice and returns to Delete when cancelled', async () => {
  const store = createArtifactStore();
  const view = createArtifactsView({ store, labels, onApply: vi.fn() });
  document.body.append(view.el);
  await view.save('Keep this draft');
  const remove = view.el.querySelector<HTMLButtonElement>('[data-action=delete]')!;
  remove.focus();
  remove.click();
  const cancel = view.el.querySelector<HTMLButtonElement>('[data-action=cancel]')!;
  expect(document.activeElement).toBe(cancel);
  cancel.click();
  expect(document.activeElement).toBe(remove);
  expect(view.el.querySelector('textarea')?.value).toBe('Keep this draft');
  expect(await store.list()).toHaveLength(1);
  view.dispose();
});
