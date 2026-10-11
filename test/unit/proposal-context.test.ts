import { expect, it } from 'vitest';
import { ProposalContext } from '../../lib/agent-plugin/ui/proposal-context';
it('never substitutes a new editor target for an expired selected suggestion', () => {
  const context = new ProposalContext();
  const plan = { tool: 'insert_text', input: { text: 'Draft' } };
  let live = true;
  context.select(() => (live ? plan : undefined));
  expect(context.capture()).toEqual({ kind: 'selected', plan });
  live = false;
  expect(context.capture()).toEqual({ kind: 'expired' });
  context.clear();
  expect(context.capture()).toEqual({ kind: 'none' });
});
