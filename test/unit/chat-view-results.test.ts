import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
import { historyToTurns } from '../../lib/agent-plugin/ui/storage';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';

let view: ChatView;
const apply = vi.fn().mockResolvedValue('retry');
const source = '# Project update\n\n**Ready for review**, with the original formatting.';
beforeEach(() => {
  document.body.replaceChildren();
  HTMLElement.prototype.scrollTo = vi.fn();
  apply.mockClear();
  view = new ChatView({
    onSend: vi.fn(),
    requireDocumentArtifact: true,
    onApplyMessage: apply,
    labels: { documentDraft: 'Document draft', incomplete: 'Incomplete response' },
  });
  document.body.append(view.el);
});
afterEach(() => view.dispose());

it('identifies host-marked document drafts without promoting ordinary answers or tool receipts', () => {
  view.append({ role: 'agent', text: 'Here is a document draft. It has been written.' });
  view.append({ role: 'tool', text: 'Sent to the editor; verification unavailable' });
  expect(view.el.querySelector('.cui-result-header')).toBeNull();
  expect(view.el.querySelector('.cui-apply')).toBeNull();
  const body = view.append({ role: 'agent', text: source, documentArtifact: true });
  const row = body.parentElement!;
  expect(row.querySelector('.cui-result-label')?.textContent).toBe('Document draft');
  expect(row.getAttribute('aria-label')).toBe('Document draft');
  expect(row.getAttribute('role')).toBe('article');
  expect(row.firstElementChild?.className).toBe('cui-result-header');
  expect(body.querySelector('h2')?.textContent).toBe('Project update');
  expect(view.getLastDocumentBody()).toBe(source);
  expect(row.querySelector('.cui-message-actions')?.firstElementChild?.className).toBe('cui-apply');
});

it('keeps document-draft framing stable through explicit completion and copies the source alone', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  view.setRunning(true);
  view.appendDelta(source, { documentArtifact: true });
  const row = view.el.querySelector<HTMLElement>('.cui-msg-agent')!;
  const header = row.querySelector('.cui-result-header');
  expect(header?.textContent).toBe('Document draft');
  expect(view.getLastDocumentBody()).toBe('');
  view.endStream();
  view.setRunning(false);
  expect(row.querySelector('.cui-result-header')).toBe(header);
  expect(row.querySelector('.cui-result-label')?.textContent).toBe('Document draft');
  row.querySelector<HTMLButtonElement>('.cui-copy')!.click();
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith(source));
  row.querySelector<HTMLButtonElement>('.cui-apply')!.click();
  await vi.waitFor(() => expect(apply).toHaveBeenCalledExactlyOnceWith(source));
  expect(view.getLastDocumentBody()).toBe(source);
});

it('labels interrupted output immediately and preserves safe source-only copying on locale changes', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  view.setRunning(true);
  view.appendDelta(source, { documentArtifact: true });
  const row = view.el.querySelector<HTMLElement>('.cui-msg-agent')!;
  view.setRunning(false);
  expect(row.querySelector('.cui-result-label')?.textContent).toBe('Incomplete response');
  expect(row.getAttribute('aria-label')).toBe('Incomplete response');
  expect(row.querySelector('.cui-apply')).toBeNull();
  expect(view.getLastDocumentBody()).toBe('');
  view.setLabels({ documentDraft: 'Entwurf', incomplete: 'Unvollstandige Antwort' });
  expect(row.querySelector('.cui-result-label')?.textContent).toBe('Unvollstandige Antwort');
  expect(row.getAttribute('aria-label')).toBe('Unvollstandige Antwort');
  row.querySelector<HTMLButtonElement>('.cui-copy')!.click();
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith(source));
});

it('restores truthful result identities in history without reconstructing write actions', () => {
  view.appendMany([
    { role: 'agent', text: source, documentArtifact: true, copyOnly: true },
    { role: 'agent', text: 'Partial ordinary answer', interrupted: true },
    { role: 'agent', text: 'Partial document body', documentArtifact: true, interrupted: true },
  ]);
  expect([...view.el.querySelectorAll('.cui-result-label')].map((node) => node.textContent)).toEqual([
    'Document draft',
    'Incomplete response',
    'Incomplete response',
  ]);
  expect(view.el.querySelectorAll('.cui-copy')).toHaveLength(3);
  expect(view.el.querySelector('.cui-apply')).toBeNull();
  expect(view.getLastDocumentBody()).toBe(source);
});

it('converts the complete host history before windowing so boundary status retains interruption metadata', () => {
  const source: Array<LLMMessage & { hostGuidance?: 'status' | 'tool' }> = [
    { role: 'user', content: 'Original document request' },
    { role: 'assistant', content: 'Incomplete document', documentArtifact: true },
    { role: 'assistant', content: 'Stopped', hostGuidance: 'status' },
    ...Array.from({ length: 39 }, (_, index) => ({
      role: 'assistant' as const,
      content: `Read ${index}`,
      hostGuidance: 'tool' as const,
    })),
  ];
  view.restoreHistory(historyToTurns(source));
  expect(view.el.querySelector('.cui-msg-agent')).toBeNull();
  expect(view.getLastAnswer()).toBe('');
  expect(view.getLastDocumentBody()).toBe('');
  view.el.querySelector<HTMLButtonElement>('.cui-load-earlier')!.click();
  const row = view.el.querySelector<HTMLElement>('.cui-msg-agent')!;
  expect(row.dataset.interrupted).toBe('true');
  expect(row.querySelector('.cui-result-label')?.textContent).toBe('Incomplete response');
  expect(row.querySelector('.cui-copy')).not.toBeNull();
  expect(row.querySelector('.cui-apply')).toBeNull();
});
