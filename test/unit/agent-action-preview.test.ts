import { afterEach, expect, it, vi } from 'vitest';
import { ActionPreview } from '../../lib/agent-plugin/ui/action-preview';
import { ReviewedAction } from '../../lib/agent-plugin/reviewed-action';
it('uses a generic document target for legacy text suggestions regardless of the source format', () => {
  const view = new ActionPreview();
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: '', isCurrent: () => true },
      { tool: 'insert_text', input: { text: 'Draft' } },
    ),
  );
  expect(view.el.querySelector('.agent-plan-target')?.textContent).toBe('Current document · Current cursor');
  view.dispose();
});
it('announces a pending proposal through the existing inline status', () => {
  const view = new ActionPreview();
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: '', isCurrent: () => true },
      { tool: 'insert_text', input: { text: 'Draft' } },
    ),
  );
  expect(view.el.querySelector('[role="status"]')?.textContent).toBe('Review the proposal before applying it.');
  expect(view.el.querySelectorAll('[role="status"]')).toHaveLength(1);
  view.dispose();
});
it.each([
  [{ kind: 'word' }, 'clear_document', {}, 'Current document'],
  [{ kind: 'slide', page: 3 }, 'add_slide_text', { text: 'Draft' }, 'Slide 3'],
  [{ kind: 'cell', sheet: 'Sales' }, 'set_cell', { cell: 'B2', value: '42' }, 'Sales · B2'],
  [{ kind: 'cell', sheet: 'Sales' }, 'sum_range', { range: 'A1:A10', target: 'B1' }, 'Sales · A1:A10 → B1'],
  [{ kind: 'cell', sheet: 'Sales' }, 'sort_range', { range: 'A1:C10' }, 'Sales · A1:C10'],
] as const)('shows the actual editor target instead of a file-format label: %j', (context, tool, input, expected) => {
  const view = new ActionPreview();
  view.show({
    target: { label: 'Incorrect format label', selectedText: '', context },
    plan: { tool, input },
    isCurrent: () => true,
    cancel: vi.fn(),
    apply: async () => 'verified',
  });
  expect(view.el.querySelector('.agent-plan-target')?.textContent).toBe(expected);
  view.dispose();
});
it('selects a pending proposal for conversational refinement without applying it', () => {
  const view = new ActionPreview();
  const action = new ReviewedAction(
    { editor: 'word', label: 'DOCX', selectedText: '', isCurrent: () => true },
    { tool: 'insert_text', input: { text: 'Draft' } },
  );
  let selected = '';
  view.show(action, undefined, (proposal) => {
    selected = String(proposal.plan.input.text);
  });
  view.el.querySelector<HTMLElement>('.agent-plan-refine')!.click();
  expect(selected).toBe('Draft');
  expect(action.isCurrent()).toBe(true);
  view.invalidate();
  selected = '';
  view.el.querySelector<HTMLElement>('.agent-plan-refine')!.click();
  expect(selected).toBe('');
  view.dispose();
});
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
it('retains completed changes in an expandable record without permitting replay', async () => {
  const view = new ActionPreview();
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: 'Before', isCurrent: () => true },
      { tool: 'insert_text', input: { text: 'After' } },
    ),
  );
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const record = view.el.querySelector<HTMLDetailsElement>('.agent-plan-record')!;
  expect(record.hidden).toBe(false);
  expect(record.textContent).toContain('Before');
  expect(record.textContent).toContain('After');
  expect(record.querySelector('.agent-plan-apply')).toBeNull();
  view.dispose();
});
it('edits a draft without changing the document and applies the validated replacement', async () => {
  const view = new ActionPreview();
  document.body.append(view.el);
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: 'Before', isCurrent: () => true },
      { tool: 'insert_text', input: { text: 'After' } },
    ),
  );
  view.el.querySelector<HTMLElement>('.agent-plan-edit')!.click();
  const draft = view.el.querySelector<HTMLTextAreaElement>('.agent-plan-draft')!;
  draft.value = 'Revised';
  view.el.querySelector<HTMLElement>('.agent-plan-save')!.click();
  expect(execute).not.toHaveBeenCalled();
  expect(view.el.querySelector('.agent-plan-content')?.textContent).toBe('Revised');
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(execute).toHaveBeenCalledWith({ text: 'Revised' }, expect.any(AbortSignal));
  view.dispose();
});
it('keeps an invalid edit draft and never restores an expired action', () => {
  const view = new ActionPreview();
  let current = true;
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: '', isCurrent: () => current },
      { tool: 'insert_text', input: { text: 'After' } },
    ),
  );
  view.el.querySelector<HTMLElement>('.agent-plan-edit')!.click();
  const draft = view.el.querySelector<HTMLTextAreaElement>('.agent-plan-draft')!;
  draft.value = '';
  view.el.querySelector<HTMLElement>('.agent-plan-save')!.click();
  expect(draft.hidden).toBe(false);
  expect(view.el.querySelector('.agent-plan-status')?.textContent).not.toBe('');
  current = false;
  draft.value = 'Changed';
  view.el.querySelector<HTMLElement>('.agent-plan-save')!.click();
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  expect(execute).not.toHaveBeenCalled();
  view.dispose();
});

it('marks a replaced proposal as superseded without restoring apply controls', () => {
  const view = new ActionPreview();
  view.show(
    new ReviewedAction(
      { editor: 'word', label: 'DOCX', selectedText: '', isCurrent: () => true },
      { tool: 'insert_text', input: { text: 'Draft' } },
    ),
  );
  view.invalidate();
  view.supersede();
  expect(view.el.dataset.state).toBe('superseded');
  expect(view.el.querySelector('.agent-plan-primary-buttons')!.hasAttribute('hidden')).toBe(true);
  expect(view.pending()).toBeUndefined();
  view.dispose();
});

it('keeps the original suggestion during refinement while preventing concurrent approval', async () => {
  const view = new ActionPreview();
  const apply = vi.fn(async () => 'verified' as const);
  const action = {
    target: { label: 'Document', selectedText: '' },
    plan: { tool: 'insert_text', input: { text: 'Draft' } },
    isCurrent: () => true,
    cancel: vi.fn(),
    apply,
  };
  view.show(action);
  view.setRefining(true);
  expect(view.pending()).toBe(action);
  expect(view.el.getAttribute('aria-busy')).toBe('true');
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  expect(apply).not.toHaveBeenCalled();
  view.setRefining(false);
  expect(view.pending()).toBe(action);
  expect(action.cancel).not.toHaveBeenCalled();
  view.el.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await Promise.resolve();
  expect(apply).toHaveBeenCalledTimes(1);
  view.dispose();
});
it('never restores an expired suggestion when refinement ends', () => {
  const view = new ActionPreview();
  view.show({
    target: { label: 'Document', selectedText: '' },
    plan: { tool: 'insert_text', input: { text: 'Draft' } },
    isCurrent: () => true,
    cancel: vi.fn(),
    apply: async () => 'verified',
  });
  view.setRefining(true);
  view.invalidate();
  view.setRefining(false);
  expect(view.pending()).toBeUndefined();
  expect(view.el.querySelector('.agent-plan-apply')?.hasAttribute('disabled')).toBe(true);
  view.dispose();
});

it.each([
  ['add', 'Add one slide'],
  ['duplicate', 'Duplicate the current slide'],
] as const)('describes a %s slide proposal in product language before confirmation', (operation, description) => {
  const apply = vi.fn(async () => 'verified' as const);
  const view = new ActionPreview();
  view.show({
    target: { label: 'PPTX', selectedText: '', context: { kind: 'slide', page: 3 } },
    plan: { tool: 'slide_action', input: { action: operation } },
    isCurrent: () => true,
    cancel: vi.fn(),
    apply,
  });
  expect(view.el.querySelector('.agent-plan-content')?.textContent).toBe(description);
  expect(view.el.querySelector('.agent-plan-target')?.textContent).toBe('Slide 3');
  expect(apply).not.toHaveBeenCalled();
  view.dispose();
});
