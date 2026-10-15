import { expect, it, vi } from 'vitest';
import { RequestQueue } from '../../lib/agent-plugin/ui/request-queue';
import type { TurnResult } from '../../lib/agent-plugin/ui/controller';

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
function setup() {
  const runs: Array<{ text: string; accept(): boolean; finish(status: TurnResult['status']): void }> = [];
  const cancel = vi.fn();
  const revoke = vi.fn();
  const queue = new RequestQueue<string>({
    execute: (entry, accept) =>
      new Promise((resolve) =>
        runs.push({ text: entry.text, accept, finish: (status) => resolve({ turnId: entry.id, status }) }),
      ),
    cancel,
    revoke,
    changed: vi.fn(),
  });
  queue.select('a');
  return { queue, runs, cancel, revoke };
}
it('executes FIFO once and retains pending text until execution is accepted', async () => {
  const { queue, runs } = setup();
  queue.enqueue('a', 'first', 'scope');
  queue.enqueue('a', 'second', 'scope');
  expect(runs.map((r) => r.text)).toEqual(['first']);
  expect(queue.state('a').entries.map((e) => e.text)).toEqual(['first', 'second']);
  runs[0].accept();
  expect(queue.state('a').entries.map((e) => e.text)).toEqual(['second']);
  runs[0].finish('success');
  await tick();
  expect(runs.map((r) => r.text)).toEqual(['first', 'second']);
  runs[1].accept();
  runs[1].finish('success');
  await tick();
  expect(queue.state('a').entries).toEqual([]);
});
it('pauses on preflight failure without losing the request and new drafts do not resume it', async () => {
  const { queue, runs } = setup();
  queue.enqueue('a', 'first', 'scope');
  runs[0].finish('failed');
  await tick();
  queue.enqueue('a', 'second', 'scope');
  expect(runs).toHaveLength(1);
  expect(queue.state('a').paused).toBe(true);
  expect(queue.state('a').entries.map((e) => e.text)).toEqual(['first', 'second']);
  queue.resume('a');
  expect(runs).toHaveLength(2);
});
it('promotes Send now, cancels once and waits for logical settlement across early idle UI', async () => {
  const { queue, runs, cancel } = setup();
  queue.enqueue('a', 'first', 'scope');
  runs[0].accept();
  queue.enqueue('a', 'second', 'scope');
  const third = queue.enqueue('a', 'third', 'scope');
  queue.sendNow('a', third.id);
  queue.sendNow('a', third.id);
  expect(cancel).toHaveBeenCalledOnce();
  expect(runs).toHaveLength(1);
  runs[0].finish('stopped');
  await tick();
  expect(runs.map((r) => r.text)).toEqual(['first', 'third']);
});
it('holds review through Apply in flight and handles synchronous settlement before submit returns', async () => {
  const { queue, runs } = setup();
  const first = queue.enqueue('a', 'first', 'scope');
  runs[0].accept();
  queue.enqueue('a', 'second', 'scope');
  runs[0].finish('review-pending');
  await tick();
  expect(runs).toHaveLength(1);
  queue.settleReview(first.id, 'verified');
  await tick();
  expect(runs).toHaveLength(2);
  runs[1].accept();
  const owner = queue.activeId!;
  queue.settleReview(owner, 'verified');
  runs[1].finish('review-pending');
  await tick();
  expect(queue.activeId).toBeUndefined();
  queue.settleReview(first.id, 'cancelled');
  expect(queue.state('a').paused).toBe(false);
});
it.each(['stopped', 'failed', 'limited', 'superseded'] as const)('pauses after %s', async (status) => {
  const { queue, runs } = setup();
  queue.enqueue('a', 'first', 'scope');
  runs[0].accept();
  queue.enqueue('a', 'second', 'scope');
  runs[0].finish(status);
  await tick();
  expect(runs).toHaveLength(1);
  expect(queue.state('a').paused).toBe(true);
});
it('switches pause old sessions and returning requires Resume, while one global submit owns busy', async () => {
  const { queue, runs, cancel } = setup();
  queue.enqueue('a', 'first', 'scope');
  runs[0].accept();
  queue.enqueue('a', 'second', 'scope');
  queue.select('b');
  queue.enqueue('b', 'other', 'scope');
  expect(cancel).toHaveBeenCalledOnce();
  expect(runs).toHaveLength(1);
  runs[0].finish('superseded');
  await tick();
  expect(runs.map((r) => r.text)).toEqual(['first', 'other']);
  runs[1].accept();
  runs[1].finish('success');
  await tick();
  queue.select('a');
  expect(runs).toHaveLength(2);
  queue.resume('a');
  expect(runs.at(-1)?.text).toBe('second');
});
it('restores only to an empty composer and revokes trust before insertion or removal', () => {
  const { queue, runs, revoke } = setup();
  queue.select('b');
  queue.pause('a');
  const entry = queue.enqueue('a', 'pending', 'trusted');
  expect(queue.restore('a', entry.id, false, vi.fn())).toBe(false);
  expect(revoke).not.toHaveBeenCalled();
  const insert = vi.fn(() => expect(revoke).toHaveBeenCalledWith(entry));
  expect(queue.restore('a', entry.id, true, insert)).toBe(true);
  expect(insert).toHaveBeenCalledWith('pending');
  const next = queue.enqueue('a', 'remove', 'trusted');
  queue.remove('a', next.id);
  expect(revoke).toHaveBeenCalledWith(next);
  expect(runs).toHaveLength(0);
});
it('invalidation drops volatile entries and late finally cannot clear newer active ownership', async () => {
  const { queue, runs, revoke } = setup();
  queue.enqueue('a', 'first', 'scope');
  runs[0].accept();
  const pending = queue.enqueue('a', 'second', 'scope');
  queue.invalidate('a');
  expect(revoke).toHaveBeenCalledWith(pending);
  queue.enqueue('a', 'new', 'scope');
  expect(runs).toHaveLength(1);
  runs[0].finish('success');
  await tick();
  expect(runs.at(-1)?.text).toBe('new');
});
it('rejects late acceptance after a preflight Stop and never retries an unaccepted success automatically', async () => {
  const { queue, runs } = setup();
  queue.enqueue('a', 'preflight', 'scope');
  queue.pause('a');
  expect(runs[0].accept()).toBe(false);
  runs[0].finish('success');
  await tick();
  expect(runs).toHaveLength(1);
  expect(queue.state('a').entries.map((e) => e.text)).toEqual(['preflight']);
  expect(queue.state('a').paused).toBe(true);
  queue.resume('a');
  runs[1].finish('success');
  await tick();
  expect(runs).toHaveLength(2);
  expect(queue.state('a').paused).toBe(true);
});
it('allows a fresh explicit Send after Stop when no older work exists, after active settlement', async () => {
  const { queue, runs } = setup();
  queue.enqueue('a', 'old', 'scope');
  runs[0].accept();
  queue.pause('a');
  queue.enqueue('a', 'fresh', 'scope');
  expect(runs).toHaveLength(1);
  runs[0].finish('stopped');
  await tick();
  expect(runs.map((run) => run.text)).toEqual(['old', 'fresh']);
});
it('prioritizes an explicitly selected refinement only after its previous submit settles, without cancelling its review', async () => {
  const { queue, runs, cancel } = setup();
  const first = queue.enqueue('a', 'proposal', 'scope');
  runs[0].accept();
  queue.enqueue('a', 'older pending', 'scope');
  queue.enqueue('a', 'refine', 'scope', { owner: first.id, current: () => true });
  expect(runs).toHaveLength(1);
  expect(cancel).not.toHaveBeenCalled();
  runs[0].finish('review-pending');
  await tick();
  expect(runs.map((run) => run.text)).toEqual(['proposal', 'refine']);
  runs[1].accept();
  runs[1].finish('review-pending');
  await tick();
  queue.settleReview(first.id, 'verified');
  expect(runs).toHaveLength(2);
  expect(queue.state('a').entries.map((entry) => entry.text)).toEqual(['older pending']);
});
it('retains an explicit Resume requested while a cancelled original submit is still settling', async () => {
  const { queue, runs } = setup();
  queue.enqueue('a', 'old', 'scope');
  runs[0].accept();
  queue.enqueue('a', 'pending', 'scope');
  queue.select('b');
  queue.select('a');
  queue.resume('a');
  expect(runs).toHaveLength(1);
  runs[0].finish('superseded');
  await tick();
  expect(runs.map((run) => run.text)).toEqual(['old', 'pending']);
});
