import { beforeEach, expect, it, vi } from 'vitest';
import { createResultActions } from '../../lib/agent-plugin/ui/result-actions';
beforeEach(() => document.body.replaceChildren());
function setup() {
  let draft = '';
  let session = 'one';
  const staged = vi.fn();
  const composer = document.createElement('textarea');
  document.body.append(composer);
  const owner = createResultActions({
    composer,
    getInput: () => draft,
    setInput: (text) => {
      draft = text;
    },
    focus: vi.fn(),
    session: () => session,
    onStage: staged,
    labels: () => ({
      shorter: 'Shorten',
      bullets: 'Bullet points',
      summarize: 'Summarize answer',
      shorterPrompt: 'Make this shorter',
      bulletsPrompt: 'Use bullet points',
      summarizePrompt: 'Summarize this answer',
      replace: 'Use suggestion',
      keep: 'Keep my draft',
      conflict: 'Your draft is kept. Use the suggestion instead?',
      source: 'Previous answer',
    }),
  });
  document.body.append(owner.el);
  return {
    owner,
    composer,
    staged,
    draft: () => draft,
    input: (text: string) => {
      draft = text;
    },
    changeSession: () => {
      session = 'two';
    },
  };
}
it('offers bounded scope-based actions and stages plain source without executing', () => {
  const x = setup();
  expect(x.owner.actions({ role: 'agent', text: 'ordinary' })).toHaveLength(0);
  const actions = x.owner.actions({
    role: 'agent',
    text: '',
    documentArtifact: true,
    metadata: { conversation: 'one' },
  });
  expect(actions).toHaveLength(2);
  actions[0].run('**result**');
  expect(x.draft()).toContain('**result**');
  expect(x.staged).toHaveBeenCalledOnce();
  expect(x.owner.actions({ role: 'agent', text: 'x', interrupted: true, documentArtifact: true })).toHaveLength(0);
  expect(
    x.owner.actions({ role: 'agent', text: 'x', metadata: { sources: [{ title: 'source' }], conversation: 'other' } }),
  ).toHaveLength(0);
});
it('keeps existing and newly edited drafts until an explicit current choice and cancels across conversations', () => {
  const x = setup();
  const action = x.owner.actions({ role: 'agent', text: 'x', documentArtifact: true })[0];
  x.input('my draft');
  action.run('result');
  expect(x.draft()).toBe('my draft');
  expect(x.owner.el.querySelector('.agent-result-choice-preview')?.textContent).toBe('Make this shorter');
  x.input('new typing');
  x.owner.el.querySelector<HTMLButtonElement>('[data-action=replace]')!.click();
  expect(x.draft()).toBe('new typing');
  x.owner.el.querySelector<HTMLButtonElement>('[data-action=keep]')!.click();
  expect(x.draft()).toBe('new typing');
  expect(x.owner.el.hidden).toBe(true);
  action.run('result');
  x.changeSession();
  x.owner.el.querySelector<HTMLButtonElement>('[data-action=replace]')!.click();
  expect(x.draft()).toBe('new typing');
  expect(x.staged).not.toHaveBeenCalled();
});
it('bounds resend source and never stages IME confirmation or an action after disposal', () => {
  const x = setup();
  const action = x.owner.actions({ role: 'agent', text: 'x', documentArtifact: true })[0];
  x.input('draft');
  action.run('z'.repeat(20000));
  x.composer.focus();
  x.composer.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  expect(
    x.owner.el.querySelector('button')!.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true })),
  ).toBe(false);
  expect(document.activeElement).toBe(x.composer);
  x.owner.el.querySelector<HTMLButtonElement>('button')!.click();
  expect(x.draft()).toBe('draft');
  x.composer.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  x.owner.el.querySelector<HTMLButtonElement>('button')!.click();
  expect(x.draft().length).toBeLessThan(7000);
  x.owner.dispose();
  action.run('new');
  expect(x.draft()).not.toContain('new');
});
