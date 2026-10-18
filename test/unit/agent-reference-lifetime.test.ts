import { expect, it } from 'vitest';
import { withReferenceAbort } from '../../lib/agent-plugin/references/reference-lifetime';
it('releases a stalled lazy dependency at the deadline and ignores late completion', async () => {
  const deadline = new AbortController();
  let complete!: (value: string) => void;
  const stalled = new Promise<string>((resolve) => (complete = resolve));
  const pending = withReferenceAbort(stalled, deadline.signal);
  deadline.abort(new DOMException('Timed out', 'TimeoutError'));
  await expect(pending).rejects.toThrow('Timed out');
  complete('late import');
  await Promise.resolve();
});
