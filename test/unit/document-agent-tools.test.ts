import { afterEach, expect, it, vi } from 'vitest';
import { runAgent } from '@ranuts/agent-core/runtime';
import type { LLMMessage, LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';
import { createDocumentAgentTools } from '../../lib/agent-plugin/document-agent-tools';
import type { DocumentToolTarget } from '../../lib/agent-plugin/document-tool-action';
import { agentTools } from '../../lib/agent-plugin/tools';

const target = (): DocumentToolTarget => ({
  context: { kind: 'word' },
  label: 'Word',
  selectedText: '',
  isCurrent: () => true,
});
afterEach(() => vi.restoreAllMocks());
it('returns a native read result to the next inference and ends with an unexecuted write proposal', async () => {
  const read = vi.spyOn(agentTools.get_document_text, 'execute').mockResolvedValue({ text: 'Actual body' });
  const write = vi.spyOn(agentTools.insert_text, 'execute');
  const review = vi.fn(),
    receipt = vi.fn();
  const snapshots: LLMMessage[][] = [];
  const responses = [
    { id: 'read', name: 'get_document_text', input: {} },
    { id: 'write', name: 'insert_text', input: { text: 'Edited body' } },
  ];
  const provider: LLMProvider = {
    name: 'scripted',
    isReady: () => true,
    chat: async (messages): Promise<LLMResponse> => {
      snapshots.push(structuredClone(messages));
      const call = responses.shift()!;
      return {
        text: '',
        toolCalls: [call],
        stopReason: 'tool_use',
        assistant: { role: 'assistant', content: [{ type: 'tool_use', ...call }] },
      };
    },
  };
  const result = await runAgent(provider, 'Read and propose an edit', {
    tools: createDocumentAgentTools({ target: target(), readonly: false, review, receipt }),
  });
  expect(read).toHaveBeenCalledOnce();
  expect(JSON.stringify(snapshots[1])).toContain('Actual body');
  expect(review).toHaveBeenCalledOnce();
  expect(write).not.toHaveBeenCalled();
  expect(JSON.stringify(result.messages.at(-1))).toContain('pending_review');
  expect(JSON.stringify(result.messages.at(-1))).toContain('"executed\\":false');
  expect(result.stoppedOnLimit).toBe(false);
});
it('excludes mutations from read-only tools and scopes the registry to the current editor', () => {
  const tools = createDocumentAgentTools({ target: target(), readonly: true, review: vi.fn(), receipt: vi.fn() });
  expect(tools.get_document_text).toBeDefined();
  expect(tools.insert_text).toBeUndefined();
  expect(tools.set_cell).toBeUndefined();
});
it('refuses stale targets and cancelled reads before editor dispatch', async () => {
  const read = vi.spyOn(agentTools.get_document_text, 'execute');
  const current = target();
  const tools = createDocumentAgentTools({ target: current, readonly: false, review: vi.fn(), receipt: vi.fn() });
  current.isCurrent = () => false;
  await expect(tools.get_document_text.execute({})).rejects.toThrow('agentPlanExpired');
  current.isCurrent = () => true;
  const abort = new AbortController();
  abort.abort();
  await expect(tools.get_document_text.execute({}, abort.signal)).rejects.toThrow();
  expect(read).not.toHaveBeenCalled();
});
it('rejects invalid native arguments before review or execution', async () => {
  const review = vi.fn();
  const tools = createDocumentAgentTools({ target: target(), readonly: false, review, receipt: vi.fn() });
  await expect(tools.insert_text.execute({ text: 12 })).rejects.toThrow();
  expect(review).not.toHaveBeenCalled();
});
