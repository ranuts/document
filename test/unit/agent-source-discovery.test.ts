import { expect, it, vi } from 'vitest';
import { safeSourceUri, sourceMatches } from '../../lib/agent-plugin/ui/source-preview';
import { serializeRequestContext } from '../../lib/agent-plugin/ui/request-context';
it('searches source titles and contents literally and normalizes whitespace', () => {
  expect(sourceMatches({ title: 'Notes', text: 'Budget   forecast' }, 'budget forecast')).toBe(true);
  expect(sourceMatches({ title: '<script>', text: '' }, '<script>')).toBe(true);
});
it('only exposes bounded safe external locators', () => {
  expect(safeSourceUri('javascript:alert(1)')).toBeUndefined();
  expect(safeSourceUri('https://user:secret@example.com')).toBeUndefined();
  expect(safeSourceUri('file:///secret')).toBeUndefined();
  expect(safeSourceUri('https://example.com/doc')).toBe('https://example.com/doc');
});
it('captures evidence from the final bounded excerpts, never full attachments', () => {
  const result = serializeRequestContext(
    {
      editor: null,
      selection: { text: '', truncated: false },
      references: [{ id: 'original', title: 'Notes', connector: 'local', text: '长'.repeat(10000) }],
    },
    'summarize',
  );
  expect(result.evidence[0]).toMatchObject({ id: 'S1', sourceId: 'original', truncated: true });
  expect(result.evidence[0].text).toBe(result.context.references![0].text);
  expect(result.evidence[0].text.length).toBeLessThan(10000);
  expect(JSON.parse(result.serialized).references[0].id).toBe('S1');
});
import { presentSourceCitations } from '../../lib/agent-plugin/ui/source-citations';
it('links only known captured ids and retains excerpts after attachment removal', async () => {
  const bubble = document.createElement('div');
  bubble.textContent = 'Known [S1] unknown [S9]';
  const source = {
    id: 'S1',
    sourceId: 'gone',
    title: 'Old notes',
    connector: 'local',
    text: '<script>captured</script>',
  };
  presentSourceCitations(bubble, { evidence: [source] }, 'Open source');
  expect(bubble.querySelectorAll('button')).toHaveLength(1);
  expect(bubble.textContent).toContain('[S9]');
  bubble.querySelector('button')!.click();
  await vi.waitFor(() => expect(bubble.textContent).toContain('<script>captured</script>'));
  expect(bubble.querySelector('script')).toBeNull();
  const trigger = bubble.querySelector('button')!;
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  trigger.click();
  expect(bubble.querySelector('.agent-source-preview')).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
import { capturedEvidence, validSourcePresentation } from '../../lib/agent-plugin/ui/source-evidence';
import { historyToTurns, isMessage } from '../../lib/agent-plugin/ui/storage';
it('reconciles later runtime clipping and rejects invented or mismatched identities', () => {
  const original = [
    { id: 'S1', sourceId: 'one', title: 'Notes', connector: 'local', text: 'abcdef', uri: 'https://example.com' },
  ];
  expect(
    capturedEvidence(
      JSON.stringify({ references: [{ id: 'S1', sourceId: 'one', text: 'abc', truncated: true }] }),
      original,
    )[0],
  ).toMatchObject({ text: 'abc', truncated: true });
  expect(
    capturedEvidence(JSON.stringify({ references: [{ id: 'S1', sourceId: 'different', text: 'abc' }] }), original),
  ).toEqual([]);
  expect(capturedEvidence(undefined, original)).toEqual([]);
});
it('restores exact host-owned message annotations, bounded independently from history content', () => {
  const evidence = [{ id: 'S1', sourceId: 'one', title: 'Notes', connector: 'local', text: 'captured' }];
  const message = {
    role: 'assistant' as const,
    content: 'Answer [S1]',
    hostPresentation: { id: 'message-one', metadata: { evidence } },
  };
  expect(isMessage(message)).toBe(true);
  expect(historyToTurns([message])[0].metadata?.evidence).toEqual(evidence);
  expect(
    validSourcePresentation({ id: 'bad', metadata: { evidence: [{ ...evidence[0], text: 'x'.repeat(9000) }] } }),
  ).toBe(false);
});
import { sourceExcerpt } from '../../lib/agent-plugin/connectors/reference-search';
it('centers a bounded source preview on late literal search hits', () => {
  const result = sourceExcerpt(
    'prefix '.repeat(3000) + 'Budget   forecast' + ' suffix'.repeat(3000),
    'budget forecast',
  );
  expect(result.text).toContain('Budget   forecast');
  expect(result.text.length).toBeLessThanOrEqual(8000);
  expect(result.partial).toBe(true);
});

import { sourcePreview } from '../../lib/agent-plugin/ui/source-preview';
it.each(['attachment', 'citation'])('keeps the %s excerpt on disclosure reopen', async (kind) => {
  const source = { id: 'S1', sourceId: 'one', title: 'Notes', connector: 'local', text: 'Captured budget evidence' };
  const bubble = document.createElement('div');
  if (kind === 'citation') {
    bubble.textContent = 'Answer [S1]';
    presentSourceCitations(bubble, { evidence: [source] }, 'Open source');
    bubble.querySelector('button')!.click();
  } else bubble.append(sourcePreview(source, 'Open source', 'budget'));
  const detail = bubble.querySelector('details')!;
  expect(detail.querySelector('pre')!.textContent).toBe('');
  detail.open = true;
  detail.dispatchEvent(new Event('toggle'));
  expect(detail.querySelector('pre')!.textContent).toBe(source.text);
  detail.open = false;
  detail.dispatchEvent(new Event('toggle'));
  detail.open = true;
  detail.dispatchEvent(new Event('toggle'));
  expect(detail.querySelector('pre')!.textContent).toBe(source.text);
  if (kind === 'attachment') expect(detail.querySelector('mark')!.textContent).toBe('budget');
});
