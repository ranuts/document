import { ButtonBuilder, Div, Span, View } from 'ranui/builder';
import { t } from '@ranuts/shared/i18n';
import type { RequestQueueState } from './request-queue';

/** Compact host presentation; pending text never becomes a conversation message. */
export function createRequestQueueView(options: {
  edit(id: string): void;
  remove(id: string): void;
  sendNow(id: string): void;
  resume(): void;
  focus(): void;
}) {
  const el = View('section').class('agent-request-queue').build();
  const title = Span().class('agent-queue-title').build();
  const resume = ButtonBuilder().class('agent-queue-resume').attr('type', 'button').on('click', options.resume).build();
  const list = View('ol').class('agent-queue-list').build();
  const feedback = Span().class('agent-queue-feedback').attr('role', 'status').build();
  el.append(Div().class('agent-queue-heading').children(title, resume).build(), list, feedback);
  el.hidden = true;
  function update<Binding>(state: RequestQueueState<Binding>): void {
    const focused =
      document.activeElement instanceof HTMLElement && el.contains(document.activeElement)
        ? document.activeElement
        : undefined;
    const owner = focused?.dataset.entry;
    const action = focused?.dataset.action;
    el.hidden = !state.entries.length;
    el.setAttribute('aria-label', t('agentQueueTitle', { count: state.entries.length }));
    title.textContent = t(state.paused ? 'agentQueuePaused' : 'agentQueueTitle', { count: state.entries.length });
    resume.textContent = t('agentQueueResume');
    resume.hidden = !state.paused;
    list.replaceChildren();
    for (const entry of state.entries) {
      const row = View('li').class('agent-queue-entry').build();
      const text = Span().class('agent-queue-text').text(entry.text).build();
      text.title = entry.text;
      const controls = Div().class('agent-queue-actions').build();
      for (const [name, label, run] of [
        ['edit', 'agentQueueEdit', options.edit],
        ['remove', 'agentQueueRemove', options.remove],
        ['send-now', 'agentQueueSendNow', options.sendNow],
      ] as const) {
        const button = ButtonBuilder()
          .class(`agent-queue-${name}`)
          .attr('type', 'button')
          .text(t(label))
          .on('click', () => run(entry.id))
          .build();
        button.dataset.entry = entry.id;
        button.dataset.action = name;
        button.setAttribute('aria-label', `${t(label)}: ${entry.text}`);
        controls.append(button);
      }
      row.append(text, controls);
      list.append(row);
    }
    if (focused && !state.entries.length) options.focus();
    else if (focused && owner && action) {
      const replacement = [...list.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.dataset.entry === owner && button.dataset.action === action,
      );
      (replacement ?? list.querySelector<HTMLButtonElement>('button') ?? resume).focus();
    }
  }
  return {
    el,
    update,
    occupied: () => {
      feedback.textContent = t('agentQueueComposerOccupied');
    },
  };
}
