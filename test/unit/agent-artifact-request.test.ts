import { expect, it, vi } from 'vitest';
import { createArtifactRequestOwner } from '../../lib/agent-plugin/ui/artifact-request';
import { captureArtifactDraft } from '../../lib/agent-plugin/artifacts/edit-proposal';
import { RequestQueue } from '../../lib/agent-plugin/ui/request-queue';
import type { ArtifactRevisionRequest } from '../../lib/agent-plugin/ui/artifact-workflow';
const draft = captureArtifactDraft({
  artifactId: 'a',
  expectedVersion: 1,
  revision: 0,
  title: 'Title',
  text: 'Only artifact',
  start: 0,
  end: 0,
});
const response = {
  text: 'New artifact',
  toolCalls: [],
  stopReason: 'stop',
  assistant: { role: 'assistant' as const, content: 'New artifact' },
};
const makeRequest = () => {
  let guard = () => true;
  return {
    draft,
    instruction: 'Change',
    isCurrent: () => guard(),
    bindCurrent: (next: () => boolean) => {
      guard = next;
    },
    delta: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  } satisfies ArtifactRevisionRequest;
};
const labels = {
  stale: 'Changed',
  prepare: 'Prepare model first',
  failed: 'Try a smaller edit',
  stopped: 'Stopped',
  tooLarge: 'Too large',
};
it('cancels its queued entry without stopping another owner and holds Stop until physical settlement', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  const provider = {
    name: 'test',
    isReady: () => true,
    chat: vi.fn(async () => {
      calls.push('artifact');
      await gate;
      return response;
    }),
  };
  let owner!: ReturnType<typeof createArtifactRequestOwner>;
  const queue = new RequestQueue<any>({
    execute: async (entry, accept) => {
      if (entry.binding.origin === 'artifact') return owner.execute(entry, accept);
      calls.push('document');
      accept();
      await gate;
      return { turnId: entry.id, status: 'success' };
    },
    cancel: () => {
      owner.cancelActive();
    },
    revoke: () => {},
    changed: () => {},
  });
  queue.select('c');
  owner = createArtifactRequestOwner({
    provider: () => provider,
    store: { get: vi.fn().mockResolvedValue({ versions: [{ version: 1 }] }) },
    sources: () => ({ references: [], isCurrent: () => true }),
    conversation: () => 'c',
    providerRevision: () => 0,
    enabled: () => true,
    isCurrentDraft: () => true,
    enqueue: (text, binding) => queue.enqueue('c', text, binding),
    cancel: (id, conversation) => {
      if (queue.activeId === id) queue.pause(conversation);
      else queue.remove(conversation, id);
    },
    labels: () => labels,
    error: () => labels.failed,
  });
  queue.enqueue('c', 'office', { origin: 'document' });
  const cancelQueued = owner.enqueue(makeRequest());
  cancelQueued();
  expect(calls).toEqual(['document']);
  const request = makeRequest();
  owner.enqueue(request);
  release();
  await vi.waitFor(() => expect(request.complete).toHaveBeenCalledWith('New artifact'));
  expect(calls).toEqual(['document', 'artifact']);
});
it('guards draft, context and stored versions before inference and before publishing', async () => {
  let revision = 0;
  let storedVersion = 1;
  let current = true;
  const provider = {
    name: 'test',
    isReady: () => true,
    chat: vi.fn(async () => {
      storedVersion = 2;
      return response;
    }),
  };
  let binding: any;
  const owner = createArtifactRequestOwner({
    provider: () => provider,
    store: { get: async () => ({ versions: [{ version: storedVersion }] }) as any },
    sources: () => ({ references: [], isCurrent: () => true }),
    conversation: () => 'c',
    providerRevision: () => revision,
    enabled: () => true,
    isCurrentDraft: () => current,
    enqueue: (_text, b) => {
      binding = b;
      return { id: 'r' };
    },
    cancel: vi.fn(),
    labels: () => labels,
    error: () => labels.failed,
  });
  const request = makeRequest();
  owner.enqueue(request);
  expect((await owner.execute({ id: 'r', text: 'Change', binding }, () => true)).status).toBe('superseded');
  expect(request.complete).not.toHaveBeenCalled();
  expect(request.fail).toHaveBeenCalledWith('Changed');
  provider.chat.mockClear();
  storedVersion = 1;
  owner.enqueue(request);
  revision++;
  await owner.execute({ id: 'r', text: 'Change', binding }, () => true);
  expect(provider.chat).not.toHaveBeenCalled();
  current = false;
  expect(request.isCurrent()).toBe(false);
});
it('keeps the shared queue leased while an aborted provider physically settles', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chat = vi.fn(async () => {
    await gate;
    return response;
  });
  const provider = { name: 'test', isReady: () => true, chat };
  let owner!: ReturnType<typeof createArtifactRequestOwner>;
  const documentRun = vi.fn();
  const queue = new RequestQueue<any>({
    execute: async (entry, accept) => {
      if (entry.binding.origin === 'artifact') return owner.execute(entry, accept);
      documentRun();
      accept();
      return { turnId: entry.id, status: 'success' };
    },
    cancel: () => {
      owner.cancelActive();
    },
    revoke: () => {},
    changed: () => {},
  });
  queue.select('c');
  owner = createArtifactRequestOwner({
    provider: () => provider,
    store: { get: vi.fn().mockResolvedValue({ versions: [{ version: 1 }] }) },
    sources: () => ({ references: [], isCurrent: () => true }),
    conversation: () => 'c',
    providerRevision: () => 0,
    enabled: () => true,
    isCurrentDraft: () => true,
    enqueue: (text, binding) => queue.enqueue('c', text, binding),
    cancel: (id, conversation) => {
      if (queue.activeId === id) queue.pause(conversation);
      else queue.remove(conversation, id);
    },
    labels: () => labels,
    error: () => labels.failed,
  });
  const request = makeRequest();
  const stop = owner.enqueue(request);
  await vi.waitFor(() => expect(chat).toHaveBeenCalledOnce());
  stop();
  queue.enqueue('c', 'Office', { origin: 'document' });
  await Promise.resolve();
  expect(documentRun).not.toHaveBeenCalled();
  expect(queue.busy).toBe(true);
  release();
  await vi.waitFor(() => expect(documentRun).toHaveBeenCalledOnce());
  expect(request.complete).not.toHaveBeenCalled();
  expect(request.fail).toHaveBeenCalledWith('Stopped');
});
it('never prepares unavailable providers and sends captured reference excerpts only', async () => {
  let provider: any;
  let binding: any;
  let connected = true;
  const owner = createArtifactRequestOwner({
    provider: () => provider,
    store: { get: vi.fn().mockResolvedValue({ versions: [{ version: 1 }] }) },
    sources: () => ({
      references: [{ id: 's', connector: 'local', title: 'Notes', text: 'Attached reference' }],
      isCurrent: () => connected,
    }),
    conversation: () => 'c',
    providerRevision: () => 0,
    enabled: () => true,
    isCurrentDraft: () => true,
    enqueue: (_text, b) => {
      binding = b;
      return { id: 'r' };
    },
    cancel: vi.fn(),
    labels: () => labels,
    error: () => labels.failed,
  });
  const request = makeRequest();
  owner.enqueue(request);
  expect((await owner.execute({ id: 'r', text: 'Revise', binding }, () => true)).status).toBe('failed');
  expect(request.fail).toHaveBeenCalledWith(labels.prepare);
  provider = { name: 'test', isReady: () => true, chat: vi.fn().mockResolvedValue(response) };
  owner.enqueue(request);
  await owner.execute({ id: 'r', text: 'Revise', binding }, () => true);
  expect(provider.chat.mock.calls[0][1]).toEqual([]);
  expect(JSON.stringify(provider.chat.mock.calls[0][0])).toContain('Attached reference');
  connected = false;
  expect(request.isCurrent()).toBe(false);
});
it('recovers a pre-accept Stop into artifact refinement without losing origin into chat', async () => {
  const { createArtifactsView } = await import('../../lib/agent-plugin/ui/artifacts-view');
  const { createRequestQueueControls } = await import('../../lib/agent-plugin/ui/request-queue-controls');
  let release!: (artifact: any) => void;
  const gate = new Promise<any>((resolve) => {
    release = resolve;
  });
  const artifact = {
    id: 'a',
    title: 'Draft',
    updatedAt: 1,
    versions: [{ version: 1, text: 'Artifact only', createdAt: 1 }],
    provenance: {},
  };
  const store = {
    create: vi.fn().mockResolvedValue(artifact),
    get: vi.fn().mockReturnValueOnce(gate).mockResolvedValue(artifact),
    list: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const provider = { name: 'test', isReady: () => true, chat: vi.fn().mockResolvedValue(response) };
  let owner!: ReturnType<typeof createArtifactRequestOwner>;
  const officeRun = vi.fn(),
    chatDraft = vi.fn(),
    officePrepare = vi.fn();
  const queue = new RequestQueue<any>({
    execute: async (entry, accept) => {
      if (entry.binding.origin === 'artifact') return owner.execute(entry, accept);
      officeRun();
      return { turnId: entry.id, status: 'failed' };
    },
    cancel: () => {
      owner.cancelActive();
    },
    revoke: (entry) => {
      if (entry.binding.origin === 'artifact') entry.binding.request.fail('Stopped');
    },
    changed: vi.fn(),
  });
  queue.select('c');
  const flowLabels = {
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
    selected: 'Selection {count}',
    entire: 'Entire artifact',
    recovered: 'Select again or choose entire artifact',
  };
  const view = createArtifactsView({
    store,
    labels: Object.fromEntries(
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
    ) as any,
    onApply: vi.fn(),
    refinement: { labels: flowLabels, submit: (r) => owner.enqueue(r), stop: () => queue.pause('c') },
  });
  owner = createArtifactRequestOwner({
    provider: () => provider,
    store,
    sources: () => ({ references: [], isCurrent: () => true }),
    conversation: () => 'c',
    providerRevision: () => 0,
    enabled: () => true,
    isCurrentDraft: (bound) => view.isCurrentDraft(bound),
    enqueue: (text, binding) => queue.enqueue('c', text, binding),
    cancel: (id, conversation) => {
      if (queue.activeId === id) queue.pause(conversation);
      else queue.remove(conversation, id);
    },
    labels: () => labels,
    error: () => labels.failed,
  });
  await view.save('Artifact only');
  (view.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
  (view.el.querySelector('form input') as HTMLInputElement).value = 'Delete the selection';
  view.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  queue.pause('c');
  view.cancelPending();
  release(artifact);
  await vi.waitFor(() => expect(queue.busy).toBe(false));
  expect(queue.state('c').entries[0].recoverOnly).toBe(true);
  const controls = createRequestQueueControls({
    queue: () => queue,
    conversation: () => 'c',
    getDraft: () => '',
    setDraft: chatDraft,
    focus: vi.fn(),
    prepare: (_text, entry) => {
      if (entry?.binding.origin === 'artifact') return false;
      officePrepare();
      return false;
    },
    restore: (entry) => {
      if (entry.binding.origin !== 'artifact') return false;
      void view.recover(entry.binding.request.draft, entry.text).then((ok) => {
        if (ok) queue.remove('c', entry.id);
      });
      return true;
    },
  });
  controls.update(queue.state('c'), 'c');
  (controls.el.querySelector('.agent-queue-edit') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(queue.state('c').entries).toHaveLength(0));
  expect((view.el.querySelector('form input') as HTMLInputElement).value).toBe('Delete the selection');
  expect(chatDraft).not.toHaveBeenCalled();
  expect(officePrepare).not.toHaveBeenCalled();
  expect(officeRun).not.toHaveBeenCalled();
  expect(provider.chat).not.toHaveBeenCalled();
  view.dispose();
});
