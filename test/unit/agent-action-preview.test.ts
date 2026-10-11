import { afterEach, expect, it, vi } from 'vitest';
import { ActionPreview } from '../../lib/agent-plugin/ui/action-preview';
import { ReviewedAction } from '../../lib/agent-plugin/reviewed-action';
const execute = vi.hoisted(() => vi.fn());
vi.mock('../../lib/agent-plugin/tools', () => ({ agentTools: { insert_text: { execute } } }));
afterEach(() => {
  document.body.innerHTML = '';
  execute.mockReset();
});
it('renders text safely, never executes before click and ignores duplicate confirmation', async () => {
  const view = new ActionPreview();
  document.body.append(view.el);
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: '<script>untrusted source</script>', isCurrent: () => true },
      { tool: 'insert_text', input: { text: '<img src=x onerror=alert(1)>' } },
    ),
  );
  expect(view.el.querySelector('img')).toBeNull();
  expect(view.el.querySelector('script')).toBeNull();
  expect(view.el.querySelector('.agent-plan-before')?.textContent).toBe('<script>untrusted source</script>');
  expect(execute).not.toHaveBeenCalled();
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  expect(execute).toHaveBeenCalledTimes(1);
  view.dispose();
});
it('cancel and invalidation cannot execute a pending proposal', async () => {
  const view = new ActionPreview();
  document.body.append(view.el);
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: '', isCurrent: () => true },
      { tool: 'insert_text', input: { text: 'Hello' } },
    ),
  );
  view.invalidate();
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await Promise.resolve();
  expect(execute).not.toHaveBeenCalled();
  view.dispose();
});

it('stopping an applying preview aborts its document operation and suppresses success', async () => {
  let received: AbortSignal | undefined;
  execute.mockImplementation((_input, signal?: AbortSignal) => {
    received = signal;
    return new Promise((_resolve, reject) =>
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true }),
    );
  });
  const view = new ActionPreview();
  document.body.append(view.el);
  const completed = vi.fn();
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: 'Before', isCurrent: () => true },
      { tool: 'insert_text', input: { text: 'After' } },
    ),
    completed,
  );
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  view.invalidate();
  await Promise.resolve();
  expect(received?.aborted).toBe(true);
  expect(completed).not.toHaveBeenCalled();
  view.dispose();
});

it('copies a proposal without applying it', async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } });
  const view = new ActionPreview();
  document.body.append(view.el);
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: 'Before', isCurrent: () => true },
      { tool: 'insert_text', input: { text: 'After' } },
    ),
  );
  view.el.querySelector<HTMLElement>('.agent-plan-copy')!.click();
  await Promise.resolve();
  expect(write).toHaveBeenCalledWith('After');
  expect(execute).not.toHaveBeenCalled();
  view.dispose();
});

it('uses operation-specific labels and hides irrelevant controls for clear', () => {
  const view = new ActionPreview();
  view.show({
    target: { label: 'DOCX', selectedText: '' },
    plan: { tool: 'clear_document', input: {} },
    isCurrent: () => true,
    cancel: vi.fn(),
    apply: vi.fn(),
  });
  expect(view.el.querySelector('.agent-plan-copy')?.hasAttribute('hidden')).toBe(true);
  expect(view.el.querySelector('.agent-plan-apply')?.textContent).not.toBe('Apply changes');
  view.dispose();
});
it('settles a completed proposal without actionable cancel or apply controls', async () => {
  const view = new ActionPreview();
  const action = {
    target: { label: 'DOCX', selectedText: '' },
    plan: { tool: 'insert_text', input: { text: 'Hello' } },
    isCurrent: () => true,
    cancel: vi.fn(),
    apply: vi.fn(async () => 'verified' as const),
  };
  view.show(action);
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(view.el.dataset.state).toBe('verified');
  expect(view.el.querySelector('.agent-plan-buttons')?.hasAttribute('hidden')).toBe(true);
  expect(view.el.querySelector('.agent-plan-content')?.hasAttribute('hidden')).toBe(true);
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  expect(action.apply).toHaveBeenCalledTimes(1);
  view.dispose();
});
