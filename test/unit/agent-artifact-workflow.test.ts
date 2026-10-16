import { expect, it, vi } from 'vitest';
import { captureArtifactDraft } from '../../lib/agent-plugin/artifacts/edit-proposal';
import { createArtifactWorkflow, runArtifactRevision } from '../../lib/agent-plugin/ui/artifact-workflow';
const draft = captureArtifactDraft({
  artifactId: 'a',
  expectedVersion: 1,
  revision: 0,
  title: 'Title',
  text: 'before',
  start: 0,
  end: 0,
});
const labels = {
  refine: 'Refine',
  instruction: 'What should change?',
  submit: 'Suggest',
  stop: 'Stop',
  accept: 'Use draft',
  reject: 'Discard',
  waiting: 'Working',
  ready: 'Review changes',
  stale: 'Draft changed',
  failed: 'Try again',
  stopped: 'Stopped',
  accepted: 'Updated draft. Save a version to keep it.',
};
it('discloses a single instruction and accepts only current completed proposals explicitly', () => {
  let request: any;
  let current = true;
  const apply = vi.fn();
  const flow = createArtifactWorkflow({
    labels,
    capture: () => draft,
    isCurrent: () => current,
    accept: apply,
    submit: (r) => {
      request = r;
    },
    stop: vi.fn(),
  });
  document.body.append(flow.el);
  (flow.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
  (flow.el.querySelector('input') as HTMLInputElement).value = 'Shorten';
  flow.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(request.instruction).toBe('Shorten');
  request.delta('after');
  expect(apply).not.toHaveBeenCalled();
  request.complete('after');
  expect(flow.el.querySelector('ins')?.textContent).toBe('after');
  current = false;
  (flow.el.querySelector('[data-action=accept]') as HTMLButtonElement).click();
  expect(apply).not.toHaveBeenCalled();
  expect(flow.el.textContent).toContain('Draft changed');
  flow.dispose();
});
it('sends no tools or document context and rejects incomplete and tool responses', async () => {
  const response = {
    text: 'after',
    toolCalls: [],
    stopReason: 'end_turn',
    assistant: { role: 'assistant', content: 'after' },
  } as const;
  const chat = vi.fn().mockResolvedValue(response);
  expect(
    await runArtifactRevision({
      provider: { name: 'test', isReady: () => true, chat },
      draft,
      instruction: 'Shorten',
      signal: new AbortController().signal,
      current: () => true,
      delta: vi.fn(),
    }),
  ).toBe('after');
  expect(chat.mock.calls[0][1]).toEqual([]);
  expect(chat.mock.calls[0][0][0].content).not.toContain('Office');
  chat.mockResolvedValue({ ...response, stopReason: 'max_tokens' });
  await expect(
    runArtifactRevision({
      provider: { name: 'test', isReady: () => true, chat },
      draft,
      instruction: 'Shorten',
      signal: new AbortController().signal,
      current: () => true,
      delta: vi.fn(),
    }),
  ).rejects.toThrow();
  chat.mockResolvedValue({ ...response, toolCalls: [{ name: 'insert_text' }] });
  await expect(
    runArtifactRevision({
      provider: { name: 'test', isReady: () => true, chat },
      draft,
      instruction: 'Shorten',
      signal: new AbortController().signal,
      current: () => true,
      delta: vi.fn(),
    }),
  ).rejects.toThrow();
});
it('applies a completed proposal once and preserves a cancelled or failed draft', async () => {
  let request: import('../../lib/agent-plugin/ui/artifact-workflow').ArtifactRevisionRequest;
  const apply = vi.fn().mockResolvedValue(true),
    stop = vi.fn();
  const flow = createArtifactWorkflow({
    labels,
    capture: () => draft,
    isCurrent: () => true,
    accept: apply,
    submit: (r) => {
      request = r;
    },
    stop,
  });
  document.body.append(flow.el);
  (flow.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
  (flow.el.querySelector('input') as HTMLInputElement).value = 'Change';
  const send = () => flow.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  send();
  request!.complete('after');
  (flow.el.querySelector('[data-action=accept]') as HTMLButtonElement).click();
  await Promise.resolve();
  expect(apply).toHaveBeenCalledTimes(1);
  expect(flow.el.textContent).toContain(labels.accepted);
  send();
  const old = request!;
  (flow.el.querySelector('[data-action=stop]') as HTMLButtonElement).click();
  expect(stop).toHaveBeenCalledTimes(1);
  old.complete('late');
  expect(flow.el.textContent).toContain(labels.stopped);
  send();
  request!.fail('Network unavailable. Reconnect and retry.');
  expect(flow.el.textContent).toContain('Reconnect and retry');
  expect((flow.el.querySelector('input') as HTMLInputElement).value).toBe('Change');
  flow.setLabels({ ...labels, refine: 'New label' });
  expect(flow.el.querySelector('[data-action=refine]')?.textContent).toBe('New label');
  flow.dispose();
  request!.complete('after disposal');
  expect(flow.el.isConnected).toBe(false);
});
it('guards host context during streaming and rejects late, empty and oversized output', async () => {
  const controller = new AbortController();
  const args = { draft, instruction: 'Revise', signal: controller.signal, current: () => true, delta: vi.fn() };
  const response = (text: string) => ({
    text,
    toolCalls: [],
    stopReason: 'stop',
    assistant: { role: 'assistant' as const, content: text },
  });
  const chat = vi.fn().mockResolvedValue(response(''));
  const provider = { name: 'test', isReady: () => true, chat };
  await expect(runArtifactRevision({ ...args, provider })).rejects.toThrow('empty');
  chat.mockResolvedValue(response('a'.repeat(131073)));
  await expect(runArtifactRevision({ ...args, provider })).rejects.toThrow('too-large');
  const chatStream = vi.fn(async (_messages: unknown, _tools: unknown, delta: (text: string) => void) => {
    delta('x'.repeat(131073));
    return response('ok');
  });
  await expect(runArtifactRevision({ ...args, provider: { ...provider, chatStream } })).rejects.toThrow('too-large');
  await expect(runArtifactRevision({ ...args, provider, current: () => false })).rejects.toThrow('stale');
  await expect(runArtifactRevision({ ...args, provider: { ...provider, isReady: () => false } })).rejects.toThrow(
    'not-ready',
  );
  await expect(runArtifactRevision({ ...args, provider, instruction: ' ' })).rejects.toThrow('invalid');
  controller.abort();
  await expect(runArtifactRevision({ ...args, provider })).rejects.toThrow();
});
it('shows captured selected/full scope without moving focus and bounds preview until explicit expansion', () => {
  let captured = captureArtifactDraft({ ...draft, text: 'x'.repeat(10000), start: 1, end: 4 });
  let request: import('../../lib/agent-plugin/ui/artifact-workflow').ArtifactRevisionRequest;
  const flow = createArtifactWorkflow({
    labels: {
      ...labels,
      selected: 'Selected text · {count} characters',
      entire: 'Entire artifact',
      partial: 'Partial preview',
      showFull: 'Show full',
    },
    capture: () => captured,
    isCurrent: () => true,
    accept: vi.fn(),
    submit: (r) => {
      request = r;
    },
    stop: vi.fn(),
  });
  document.body.append(flow.el);
  (flow.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
  expect(flow.el.querySelector('.agent-artifact-scope')?.textContent).toBe('Selected text · 3 characters');
  const input = flow.el.querySelector('input')!;
  input.value = 'Change';
  input.focus();
  captured = captureArtifactDraft({ ...draft, text: 'x'.repeat(10000), start: 0, end: 0 });
  flow.refreshScope();
  expect(flow.el.querySelector('.agent-artifact-scope')?.textContent).toBe('Entire artifact');
  expect(document.activeElement).toBe(input);
  flow.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  request!.delta('y'.repeat(9000));
  expect(flow.el.querySelector('.agent-artifact-diff')!.textContent!.length).toBe(8000);
  request!.complete('y'.repeat(9000));
  expect(flow.el.querySelector('.agent-artifact-diff')!.textContent!.length).toBeLessThan(8000);
  (flow.el.querySelector('[data-action=showFull]') as HTMLButtonElement).click();
  expect(flow.el.querySelector('.agent-artifact-diff')!.textContent!.length).toBe(19000);
  flow.dispose();
});
it('never submits a partially composed instruction through Enter or form submission', () => {
  const submit = vi.fn();
  const flow = createArtifactWorkflow({
    labels,
    capture: () => draft,
    isCurrent: () => true,
    accept: vi.fn(),
    submit,
    stop: vi.fn(),
  });
  document.body.append(flow.el);
  (flow.el.querySelector('[data-action=refine]') as HTMLButtonElement).click();
  const input = flow.el.querySelector('input')!;
  input.value = '改进';
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  input.dispatchEvent(enter);
  expect(enter.defaultPrevented).toBe(true);
  flow.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(submit).not.toHaveBeenCalled();
  input.dispatchEvent(new CompositionEvent('compositionend'));
  flow.el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  expect(submit).toHaveBeenCalledOnce();
  flow.dispose();
});
it('requires a valid same-kind whole structured AI result and tells the provider the bounded schema', async () => {
  const text = JSON.stringify({ kind: 'table', columns: ['A'], rows: [['one']] });
  const bound = captureArtifactDraft({ ...draft, text, start: 0, end: 0, payloadKind: 'table' });
  const chat = vi.fn().mockResolvedValue({
    text: JSON.stringify({ kind: 'slides', slides: [{ title: 'oops', body: 'changed kind' }] }),
    toolCalls: [],
    stopReason: 'end_turn',
    assistant: { role: 'assistant', content: 'bad' },
  });
  const options = {
    provider: { isReady: () => true, chat } as any,
    draft: bound,
    instruction: 'Shorten',
    signal: new AbortController().signal,
    current: () => true,
    delta: vi.fn(),
  };
  await expect(runArtifactRevision(options)).rejects.toThrow('invalid');
  expect(chat.mock.calls[0][0][0].content).toContain('10000 cells');
  chat.mockResolvedValue({
    text: JSON.stringify({ kind: 'table', columns: ['A'], rows: [['two']] }),
    toolCalls: [],
    stopReason: 'end_turn',
    assistant: { role: 'assistant', content: 'valid' },
  });
  expect(await runArtifactRevision(options)).toContain('two');
});
