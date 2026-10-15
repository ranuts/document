import { afterEach, expect, it, vi } from 'vitest';
import { createRequestTiming } from '../../lib/agent-plugin/ui/request-timing';
import { AgentChatController } from '../../lib/agent-plugin/ui/controller';

let now = 10;
afterEach(() => vi.restoreAllMocks());
function clock() {
  now = 10;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
}

it('keeps provider ingress, filtered text, presentation and routing on the actual host clock', async () => {
  clock();
  const timing = createRequestTiming();
  const finishRouting = timing.routing();
  now = 20;
  finishRouting();
  const controller = new AgentChatController(
    {
      name: 'test',
      isReady: () => true,
      chat: async () => {
        throw new Error('Unused');
      },
      chatStream: async (_messages, _tools, delta) => {
        now = 30;
        delta('<think>Private reasoning');
        now = 50;
        delta('</think>Answer');
        return {
          text: 'Answer',
          toolCalls: [],
          stopReason: 'stop',
          assistant: { role: 'assistant', content: 'Answer' },
        };
      },
    },
    () => {},
    {
      onAgentDelta: () => {
        now = 70;
        timing.presented();
      },
    },
  );
  await controller.send('Question', { timing });
  const record = timing.finish('success');
  expect(record).toMatchObject({
    routingDurationMs: 10,
    firstProviderTextMs: 20,
    firstFilteredTextMs: 40,
    firstPresentedTextMs: 60,
  });
  expect(record).not.toHaveProperty('providerTimeToFirstTextMs');
});

it('records only finite numeric fields, bounds local diagnostics and suppresses stopped/stale callbacks', () => {
  clock();
  const measure = vi.fn();
  const clear = vi.fn();
  vi.stubGlobal('performance', { now: () => now, measure, clearMeasures: clear });
  try {
    for (let index = 0; index < 20; index++) {
      const timing = createRequestTiming();
      timing.usage({ contextPreparationDurationMs: 2, timeToFirstTextMs: 4, responseDurationMs: 7, promptTokens: 123 });
      timing.cancel('stopped');
      now += 10;
      timing.providerText();
      timing.filteredText();
      timing.presented();
      expect(timing.finish('success')).not.toHaveProperty('firstPresentedTextMs');
    }
    expect(new Set(measure.mock.calls.map(([name]) => name)).size).toBeLessThanOrEqual(8);
    expect(clear).toHaveBeenCalledTimes(20);
    const details = measure.mock.calls.map(([, options]) => options.detail);
    expect(
      details.every((detail) =>
        Object.entries(detail).every(([key, value]) =>
          key === 'status' ? value === 'stopped' : typeof value === 'number' && Number.isFinite(value),
        ),
      ),
    ).toBe(true);
    let current = true;
    const stale = createRequestTiming({ isCurrent: () => current });
    current = false;
    stale.providerText();
    stale.presented();
    expect(stale.finish('success')).toEqual({ status: 'superseded', durationMs: 0 });
  } finally {
    vi.unstubAllGlobals();
  }
});

it('sums only observed provider executions and ignores diagnostic API failures', () => {
  clock();
  const timing = createRequestTiming();
  timing.usage({ contextPreparationDurationMs: 2, responseDurationMs: 7, timeToFirstTextMs: 4 });
  timing.usage({ contextPreparationDurationMs: 3, responseDurationMs: 11, timeToFirstTextMs: 8 });
  vi.stubGlobal('performance', {
    now: () => now,
    clearMeasures: () => {
      throw new Error('Unavailable');
    },
  });
  try {
    expect(timing.finish('success')).toMatchObject({
      providerContextPreparationDurationMs: 5,
      providerResponseDurationMs: 18,
      providerTimeToFirstTextMs: 4,
      status: 'success',
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

it('keeps unsupported stages absent, accepts measured zero and tolerates unavailable performance APIs', () => {
  clock();
  const timing = createRequestTiming();
  const stop = timing.routing();
  stop();
  now = 99;
  stop();
  timing.usage({ contextPreparationDurationMs: Number.NaN, responseDurationMs: -1, timeToFirstTextMs: Infinity });
  expect(timing.finish('success')).toEqual({ status: 'success', routingDurationMs: 0, durationMs: 89 });
  vi.stubGlobal('performance', undefined);
  try {
    const unsupported = createRequestTiming();
    unsupported.providerText();
    unsupported.filteredText();
    unsupported.presented();
    expect(unsupported.finish('failed')).toEqual({ status: 'failed' });
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each(['stop', 'dispose'] as const)('isolates %s callbacks from a subsequent controller request', async (action) => {
  clock();
  let release!: () => void;
  let calls = 0;
  const provider = {
    name: 'test',
    isReady: () => true,
    chat: async () => {
      throw new Error('Unused');
    },
    chatStream: async (_messages: unknown, _tools: unknown, delta: (text: string) => void) => {
      if (++calls === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      now += 5;
      delta('Answer');
      return {
        text: 'Answer',
        toolCalls: [],
        stopReason: 'stop',
        assistant: { role: 'assistant' as const, content: 'Answer' },
      };
    },
  };
  const controller = new AgentChatController(provider, () => {});
  const old = createRequestTiming();
  const first = controller.send('Old', { timing: old });
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  controller[action]();
  release();
  await first;
  const next = createRequestTiming();
  await controller.send('Next', { timing: next });
  expect(old.finish('success')).not.toHaveProperty('firstProviderTextMs');
  expect(old.finish('success').status).toBe(action === 'stop' ? 'stopped' : 'superseded');
  expect(next.finish('success').firstProviderTextMs).toBe(5);
});
