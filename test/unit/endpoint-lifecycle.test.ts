import { expect, it, vi } from 'vitest';
import { EndpointConnection } from '../../lib/agent-plugin/ui/endpoint-lifecycle';
import type { LLMProvider } from '@ranuts/agent-core/llm/types';

function provider(preload: () => Promise<void> = async () => undefined) {
  let disposed = false;
  return {
    name: 'test',
    preload,
    isReady: () => !disposed,
    chat: vi.fn(),
    dispose: vi.fn(async () => {
      disposed = true;
    }),
  } satisfies LLMProvider & { preload(): Promise<void>; dispose(): Promise<void> };
}

it('keeps a cancelled connection from replacing a newer endpoint', async () => {
  let finish!: () => void;
  const old = provider(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const next = provider();
  const connection = new EndpointConnection();
  const pending = connection.connect(() => old);
  connection.disconnect();
  expect(await connection.connect(() => next)).toBe(true);
  finish();
  expect(await pending).toBe(false);
  expect(connection.current).toBe(next);
  expect(connection.pending).toBeNull();
  expect(old.isReady()).toBe(false);
  connection.disconnect();
  expect(next.isReady()).toBe(false);
});

it('releases a failed provider and allows a later connection', async () => {
  const failed = provider(async () => {
    throw new Error('unreachable');
  });
  const connection = new EndpointConnection();
  await expect(connection.connect(() => failed)).rejects.toThrow('unreachable');
  expect(connection.current).toBeNull();
  expect(connection.pending).toBeNull();
  expect(failed.isReady()).toBe(false);
  const next = provider();
  expect(await connection.connect(() => next)).toBe(true);
  expect(connection.current).toBe(next);
  connection.disconnect();
});
