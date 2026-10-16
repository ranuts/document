import { expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
import { presentSourceCitations } from '../../lib/agent-plugin/ui/source-citations';
it('decorates completed and restored source citations without changing original copy text', async () => {
  HTMLElement.prototype.scrollTo = vi.fn();
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  const metadata = { evidence: [{ id: 'S1', sourceId: 'one', title: 'Notes', connector: 'local', text: 'source' }] };
  const view = new ChatView({
    onSend: vi.fn(),
    presentMessage: (bubble, data) => presentSourceCitations(bubble, data, 'Open source'),
  });
  document.body.append(view.el);
  view.appendDelta('Answer [S1] unknown [S9]', { metadata });
  view.endStream();
  expect(view.el.querySelectorAll('.agent-source-citation')).toHaveLength(1);
  (view.el.querySelector('.cui-copy') as HTMLButtonElement).click();
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledWith('Answer [S1] unknown [S9]');
  view.clear();
  view.restoreHistory([{ role: 'agent', text: 'Restored [S1]', metadata }]);
  expect(view.el.querySelectorAll('.agent-source-citation')).toHaveLength(1);
  view.dispose();
  vi.unstubAllGlobals();
});
