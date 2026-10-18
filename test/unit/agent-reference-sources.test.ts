import { expect, it, vi } from 'vitest';
import { ReferenceSources, readLocalReference } from '../../lib/agent-plugin/references/reference-sources';

it('accepts bounded text files and rejects binary or oversized sources', async () => {
  expect((await readLocalReference(new File(['hello'], 'notes.md'))).text).toBe('hello');
  await expect(readLocalReference(new File(['binary'], 'notes.docx'))).rejects.toThrow('corrupt');
  await expect(readLocalReference(new File(['x'.repeat(262145)], 'large.txt'))).rejects.toThrow('too-large');
});
it('captures immutable references and invalidates a snapshot on removal', () => {
  const sources = new ReferenceSources();
  sources.add({ id: 'one', connector: 'local', title: 'Notes', text: 'original' });
  const snapshot = sources.capture();
  sources.add({ id: 'two', connector: 'local', title: 'More', text: 'second' });
  expect(snapshot.references).toHaveLength(1);
  expect(snapshot.isCurrent()).toBe(true);
  sources.remove('one');
  expect(snapshot.isCurrent()).toBe(false);
});
it('keeps attachments scoped to conversations and forgets their original scope', () => {
  const sources = new ReferenceSources();
  sources.select('one');
  sources.add({ id: 'x', connector: 'local', title: 'Source', text: 'one' });
  const queued = sources.capture();
  sources.select('two');
  expect(sources.list()).toEqual([]);
  expect(queued.isCurrent()).toBe(true);
  sources.forget('one');
  expect(queued.isCurrent()).toBe(false);
});
it('forgets deleted conversation attachments and invalidates their snapshots', () => {
  const sources = new ReferenceSources();
  sources.select('deleted');
  sources.add({ id: 'x', connector: 'local', title: 'Private', text: 'private' });
  const old = sources.capture();
  sources.select('kept');
  sources.add({ id: 'y', connector: 'local', title: 'Current', text: 'current' });
  sources.forget('deleted');
  expect(old.isCurrent()).toBe(false);
  expect(sources.list()).toHaveLength(1);
  const current = sources.capture();
  sources.forget();
  expect(current.isCurrent()).toBe(false);
  expect(sources.list()).toEqual([]);
});
it('releases canceled file reads and ignores their late completion', async () => {
  let complete!: (value: string) => void;
  const file = {
    name: 'slow.txt',
    size: 10,
    text: () => new Promise<string>((resolve) => (complete = resolve)),
  } as File;
  const controller = new AbortController();
  const pending = readLocalReference(file, controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow();
  complete('late text');
});
it('reports the deadline when an underlying file read never settles', async () => {
  vi.useFakeTimers();
  // AbortSignal.timeout uses the platform clock, so substitute a controllable deadline.
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  try {
    const file = { name: 'slow.txt', size: 10, text: () => new Promise<string>(() => {}) } as File;
    const pending = readLocalReference(file);
    controller.abort(new DOMException('Timed out', 'TimeoutError'));
    await expect(pending).rejects.toThrow('source-timeout');
  } finally {
    timeout.mockRestore();
    vi.useRealTimers();
  }
});
