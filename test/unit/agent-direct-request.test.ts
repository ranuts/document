import { beforeEach, expect, it, vi } from 'vitest';
import { prepareDirectDocumentRequest } from '../../lib/agent-plugin/ui/direct-document-request';
import type { DocumentToolTarget } from '../../lib/agent-plugin/document-tool-action';
import { t } from '@ranuts/shared/i18n';

const execute = vi.hoisted(() => vi.fn());
vi.mock('../../lib/agent-plugin/tools', () => ({ agentTools: { set_bold: { execute }, sum_range: { execute } } }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({ getEditorApi: () => null }));
beforeEach(() => execute.mockReset());
const target = (): DocumentToolTarget => ({
  context: { kind: 'word' },
  label: 'selection',
  selectedText: 'selected',
  isCurrent: vi.fn(() => true),
});

it('validates and promotes a document write target before executing a deterministic command', async () => {
  const captured = target();
  const promoted = target();
  captured.prepareWrite = vi.fn(() => promoted);
  execute.mockResolvedValue({ verified: true });
  const request = prepareDirectDocumentRequest({ kind: 'bold', enabled: true }, 'bold selection', captured, '');
  expect(captured.prepareWrite).toHaveBeenCalledOnce();
  expect(promoted.isCurrent).toHaveBeenCalledWith(true);
  expect(execute).not.toHaveBeenCalled();
  const signal = new AbortController().signal;
  const result = await request.execute(signal);
  expect(execute).toHaveBeenCalledWith({ enabled: true }, signal);
  expect(result.status).toBe('success');
  expect(result.turn).toEqual({ role: 'tool', text: t('agentPlanVerified') });
  expect(result.messages[0]).toMatchObject({
    role: 'assistant',
    content: [{ type: 'tool_use', name: 'set_bold', input: { enabled: true } }],
  });
});

it('does not promote read-only scope and returns the sum as history evidence', async () => {
  const captured = target();
  captured.prepareWrite = vi.fn();
  execute.mockResolvedValue({ verified: true, sum: 42 });
  const request = prepareDirectDocumentRequest({ kind: 'sum_range', range: 'A1:A2' }, 'sum A1:A2', captured, '');
  expect(captured.prepareWrite).not.toHaveBeenCalled();
  const result = await request.execute(new AbortController().signal);
  expect(result.turn.text).toBe('A1:A2: 42');
  expect(result.messages.at(-1)).toEqual({ role: 'assistant', content: 'A1:A2: 42', hostGuidance: 'tool' });
});

it('rejects unverified results and cancellation instead of reporting success', async () => {
  const request = prepareDirectDocumentRequest({ kind: 'bold', enabled: true }, 'bold selection', target(), '');
  execute.mockResolvedValue({ verified: false });
  await expect(request.execute(new AbortController().signal)).rejects.toThrow(t('agentPlanUnverified'));
  const abort = new AbortController();
  execute.mockImplementation(async () => {
    abort.abort();
    return { verified: true };
  });
  await expect(request.execute(abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

it('refuses stale scope and missing answer before any editor tool starts', () => {
  const stale = target();
  stale.isCurrent = () => false;
  expect(() => prepareDirectDocumentRequest({ kind: 'bold', enabled: true }, 'bold', stale, '')).toThrow(
    t('agentPlanExpired'),
  );
  expect(() =>
    prepareDirectDocumentRequest({ kind: 'write_reply', requireSelection: false }, 'write', target(), ''),
  ).toThrow('agentNoCompletedAnswer');
  expect(execute).not.toHaveBeenCalled();
});
