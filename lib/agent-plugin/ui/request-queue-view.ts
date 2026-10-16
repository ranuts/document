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
  let expanded: string | undefined;
  function update<Binding>(state: RequestQueueState<Binding>): void {
    feedback.textContent = '';
    const focused =
      document.activeElement instanceof HTMLElement && el.contains(document.activeElement)
        ? document.activeElement
        : undefined;
    const owner = focused?.dataset.entry;
    const action = focused?.dataset.action;
    el.hidden = !state.entries.length;
    const executable = state.entries.filter((entry) => !entry.recoverOnly).length;
    title.textContent = executable
      ? t(state.paused ? 'agentQueuePaused' : 'agentQueueTitle', { count: executable })
      : t('agentRestoreRequest');
    el.setAttribute('aria-label', title.textContent);
    resume.textContent = t('agentQueueResume');
    resume.hidden = !state.paused || !executable;
    if (!state.entries.some((entry) => entry.id === expanded) || state.preparing?.id === expanded) expanded = undefined;
    list.replaceChildren();
    for (const entry of state.entries) {
      const preparing = state.preparing?.id === entry.id ? state.preparing : undefined;
      const row = View('li').class('agent-queue-entry').build();
      if (preparing) row.setAttribute('aria-busy', 'true');
      const text = Span().class('agent-queue-text').text(entry.text).build();
      text.title = entry.text;
      const controls = Div().class('agent-queue-actions').build();
      controls.hidden = expanded !== entry.id;
      const more = ButtonBuilder().class('agent-queue-more').attr('type', 'button').text('⋯').build();
      more.dataset.entry = entry.id;
      more.dataset.action = 'more';
      more.disabled = !!preparing;
      more.setAttribute('aria-label', `${t('agentQueueMoreActions')}: ${entry.text}`);
      more.setAttribute('aria-expanded', String(!controls.hidden));
      more.addEventListener('click', () => {
        const opening = controls.hidden;
        for (const other of list.querySelectorAll<HTMLElement>('.agent-queue-actions')) other.hidden = true;
        for (const other of list.querySelectorAll<HTMLElement>('.agent-queue-more'))
          other.setAttribute('aria-expanded', 'false');
        controls.hidden = !opening;
        expanded = opening ? entry.id : undefined;
        more.setAttribute('aria-expanded', String(opening));
      });
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || controls.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        controls.hidden = true;
        expanded = undefined;
        more.setAttribute('aria-expanded', 'false');
        more.focus();
      });
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
        button.disabled = !!preparing;
        if (entry.recoverOnly && name === 'send-now') button.hidden = true;
        if (entry.recoverOnly && name === 'edit') button.textContent = t('agentRestoreRequest');
        button.dataset.entry = entry.id;
        button.dataset.action = name;
        button.setAttribute('aria-label', `${button.textContent}: ${entry.text}`);
        if (name === 'edit') {
          button.replaceChildren(text);
          button.title = `${t(entry.recoverOnly ? 'agentRestoreRequest' : 'agentQueueEdit')}: ${entry.text}`;
          row.append(button);
        } else controls.append(button);
      }
      row.append(more);
      if (preparing)
        row.append(
          Span()
            .class('agent-queue-state')
            .attr('role', 'status')
            .text(t(preparing.stopping ? 'agentStopping' : 'agentPreparingTask'))
            .build(),
        );
      else if (entry.recoverOnly) row.append(Span().class('agent-queue-recovery').text(t('agentStopped')).build());
      row.append(controls);
      list.append(row);
    }
    if (focused && !state.entries.length) options.focus();
    else if (focused && (focused !== resume || resume.hidden)) {
      const available = [...list.querySelectorAll<HTMLButtonElement>('button')].filter(
        (button) => !button.disabled && !button.hidden && !button.closest('[hidden]'),
      );
      const replacement = available.find(
        (button) => button.dataset.entry === owner && button.dataset.action === action,
      );
      const target = replacement ?? available[0] ?? (!resume.hidden ? resume : undefined);
      if (target) target.focus();
      else options.focus();
    }
  }
  return {
    el,
    update,
    occupied: () => {
      feedback.textContent = t('agentQueueComposerOccupied');
    },
    unavailable: () => {
      feedback.textContent = t('agentQueueEditUnavailable');
    },
  };
}
