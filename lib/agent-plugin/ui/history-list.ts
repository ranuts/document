import { ButtonBuilder, Div, InputBuilder, Span, View } from 'ranui/builder';
import { getLanguage, t } from '@ranuts/shared/i18n';
import type { createConversationStore } from './sessions';

interface ConversationListOptions {
  store: ReturnType<typeof createConversationStore>;
  onSelect(id: string): void;
  onDelete(id: string, trigger: HTMLButtonElement): void;
}

/** Browse and search the existing local conversations without creating a second store. */
export function createConversationList({ store, onSelect, onDelete }: ConversationListOptions) {
  const heading = View('h2').class('agent-history-heading').build();
  const search = InputBuilder().class('agent-history-search').attr('type', 'search').build();
  const searchIcon = Span().attr('aria-hidden', 'true').build();
  searchIcon.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>';
  const searchRow = Div().class('agent-history-search-row').children(searchIcon, search).build();
  const list = View('ul').class('agent-conversation-list').build();
  const empty = View('p').class('agent-history-empty').attr('role', 'status').build();
  const el = Div().class('agent-conversations').children(heading, searchRow, list, empty).build();
  const sync = () => {
    heading.textContent = t('agentConversations');
    search.placeholder = t('agentSearchConversations');
    search.setAttribute('aria-label', t('agentSearchConversations'));
    list.setAttribute('aria-label', t('agentConversations'));
    const focused = list.contains(document.activeElement) ? (document.activeElement as HTMLButtonElement) : null;
    const query = search.value.trim().toLocaleLowerCase();
    const sessions = store
      .list()
      .filter((session) => {
        if (!query || session.title.toLocaleLowerCase().includes(query)) return true;
        return store
          .history(session.id)
          .load()
          .some((message) => {
            const text =
              typeof message.content === 'string'
                ? message.content
                : message.content
                    .filter((part) => part.type === 'text')
                    .map((part) => part.text)
                    .join(' ');
            return text.toLocaleLowerCase().includes(query);
          });
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    let previousGroup = '';
    const items = sessions
      .map((session) => {
        const group =
          session.updatedAt >= today
            ? 'agentHistoryToday'
            : session.updatedAt >= yesterday
              ? 'agentHistoryYesterday'
              : 'agentHistoryEarlier';
        const row = View('li').class('agent-conversation-row').build();
        const title = Span()
          .class('agent-conversation-title')
          .text(session.title || t('agentNewConversation'))
          .build();
        const date = View('time')
          .class('agent-conversation-date')
          .attr('datetime', new Date(session.updatedAt).toISOString())
          .text(
            new Intl.DateTimeFormat(getLanguage(), {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(session.updatedAt),
          )
          .build();
        const metadata = Div().class('agent-conversation-meta').children(date).build();
        const active = session.id === store.activeId;
        if (active)
          metadata.append(Span().class('agent-conversation-current').text(t('agentCurrentConversation')).build());
        const open = ButtonBuilder()
          .class('agent-conversation-open')
          .attr('type', 'button')
          .attr('data-id', session.id)
          .attr('aria-current', active ? 'true' : 'false')
          .children(title, metadata)
          .on('click', () => onSelect(session.id))
          .build();
        open.title = title.textContent || '';
        const remove = ButtonBuilder()
          .class('agent-conversation-delete')
          .attr('type', 'button')
          .attr('data-id', session.id)
          .attr('aria-label', `${t('agentDeleteConversation')}: ${title.textContent}`)
          .on('click', () => onDelete(session.id, remove))
          .build();
        remove.title = t('agentDeleteConversation');
        remove.innerHTML =
          '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
        row.append(open, remove);
        if (group !== previousGroup) {
          const label = View('li').class('agent-conversation-group').text(t(group)).build();
          previousGroup = group;
          return [label, row];
        }
        return [row];
      })
      .flat();
    list.replaceChildren(...items);
    empty.hidden = sessions.length > 0;
    empty.textContent = t('agentNoConversationsFound');
    if (focused)
      Array.from(list.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.dataset.id === focused.dataset.id && button.className === focused.className)
        ?.focus();
  };
  search.addEventListener('input', sync);
  sync();
  return { el, sync, focus: () => search.focus() };
}
