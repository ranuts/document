import { ButtonBuilder, Div, InputBuilder, Span, View } from 'ranui/builder';
import { getLanguage, t } from '@ranuts/shared/i18n';
import type { Conversation, createConversationStore } from './sessions';
import { createHistorySearch } from './history-search';
import type { SearchMatch } from './history-search-model';

interface ConversationListOptions {
  store: ReturnType<typeof createConversationStore>;
  onSelect(id: string): void;
  onDelete(id: string, trigger: HTMLButtonElement): void;
}

/** Keyed, bounded presentation of the session owner's local history. */
export function createConversationList({ store, onSelect, onDelete }: ConversationListOptions) {
  const heading = View('h2').class('agent-history-heading').build();
  const search = InputBuilder().class('agent-history-search').attr('type', 'search').build();
  const searchIcon = Span().attr('aria-hidden', 'true').build();
  searchIcon.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>';
  const searchRow = Div().class('agent-history-search-row').children(searchIcon, search).build();
  const list = View('ul').class('agent-conversation-list').build();
  const empty = View('p').class('agent-history-empty').attr('role', 'status').build();
  const more = ButtonBuilder().class('agent-history-more').attr('type', 'button').build();
  const el = Div().class('agent-conversations').children(heading, searchRow, list, empty, more).build();
  let active = true;
  let disposed = false;
  let limit = 40;
  let query = '';
  let matches: SearchMatch[] | undefined;
  let sessions: Conversation[] = [];
  let source: ReturnType<typeof store.searchSnapshot> | undefined;
  const nodes = new Map<
    string,
    {
      row: HTMLElement;
      open: HTMLButtonElement;
      title: HTMLSpanElement;
      date: HTMLElement;
      current: HTMLSpanElement;
      snippet: HTMLSpanElement;
      remove: HTMLButtonElement;
    }
  >();
  const groups = new Map<string, HTMLElement>();
  let dateLanguage = '';
  let dateFormat: Intl.DateTimeFormat;
  const engine = createHistorySearch((result) => {
    if (disposed || !active || result.query !== query) return;
    matches = result.matches;
    render();
  });
  function render() {
    if (!active || disposed) return;
    if (heading.textContent !== t('agentConversations')) heading.textContent = t('agentConversations');
    search.placeholder = t('agentSearchConversations');
    search.setAttribute('aria-label', t('agentSearchConversations'));
    list.setAttribute('aria-label', t('agentConversations'));
    if (more.textContent !== t('agentHistoryLoadMore')) more.textContent = t('agentHistoryLoadMore');
    if (query && !matches) {
      list.setAttribute('aria-busy', 'true');
      const ids = new Set(sessions.map((session) => session.id));
      for (const [id, node] of nodes)
        if (!ids.has(id)) {
          node.row.remove();
          nodes.delete(id);
        }
      empty.hidden = true;
      more.hidden = true;
      return;
    }
    if (dateLanguage !== getLanguage() || !dateFormat) {
      dateLanguage = getLanguage();
      dateFormat = new Intl.DateTimeFormat(dateLanguage, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    const snippets = new Map(matches?.map((match) => [match.id, match.snippet]));
    const filtered = query ? sessions.filter((session) => snippets.has(session.id)) : sessions;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    const items: HTMLElement[] = [];
    const visible = new Set<string>();
    let previousGroup = '';
    for (const session of filtered.slice(0, limit)) {
      visible.add(session.id);
      const group =
        session.updatedAt >= today
          ? 'agentHistoryToday'
          : session.updatedAt >= yesterday
            ? 'agentHistoryYesterday'
            : 'agentHistoryEarlier';
      if (group !== previousGroup) {
        let label = groups.get(group);
        if (!label) {
          label = View('li').class('agent-conversation-group').build();
          groups.set(group, label);
        }
        if (label.textContent !== t(group)) label.textContent = t(group);
        items.push(label);
        previousGroup = group;
      }
      let node = nodes.get(session.id);
      if (!node) {
        const title = Span().class('agent-conversation-title').build();
        const date = View('time').class('agent-conversation-date').build();
        const current = Span().class('agent-conversation-current').build();
        const metadata = Div().class('agent-conversation-meta').children(date, current).build();
        const snippet = Span().class('agent-conversation-snippet').build();
        const open = ButtonBuilder()
          .class('agent-conversation-open')
          .attr('type', 'button')
          .attr('data-id', session.id)
          .children(title, metadata, snippet)
          .on('click', () => onSelect(session.id))
          .build();
        const remove = ButtonBuilder()
          .class('agent-conversation-delete')
          .attr('type', 'button')
          .attr('data-id', session.id)
          .on('click', () => onDelete(session.id, remove))
          .build();
        remove.innerHTML =
          '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
        const row = View('li').class('agent-conversation-row').children(open, remove).build();
        node = { row, open, title, date, current, snippet, remove };
        nodes.set(session.id, node);
      }
      const title = session.title || t('agentNewConversation');
      if (node.title.textContent !== title) node.title.textContent = title;
      node.open.title = title;
      node.open.setAttribute('aria-current', String(session.id === store.activeId));
      if (node.current.textContent !== t('agentCurrentConversation'))
        node.current.textContent = t('agentCurrentConversation');
      node.current.hidden = session.id !== store.activeId;
      node.date.setAttribute('datetime', new Date(session.updatedAt).toISOString());
      const date = dateFormat.format(session.updatedAt);
      if (node.date.textContent !== date) node.date.textContent = date;
      const snippet = snippets.get(session.id) || '';
      if (node.snippet.textContent !== snippet) node.snippet.textContent = snippet;
      node.snippet.hidden = !query || !snippet;
      node.remove.title = t('agentDeleteConversation');
      node.remove.setAttribute('aria-label', `${t('agentDeleteConversation')}: ${title}`);
      items.push(node.row);
    }
    // Move only changed positions. Unchanged rows and focused buttons stay connected.
    const focused = list.contains(document.activeElement) ? (document.activeElement as HTMLElement) : undefined;
    items.forEach((item, index) => {
      if (list.children[index] !== item) list.insertBefore(item, list.children[index] ?? null);
    });
    while (list.children.length > items.length) list.lastElementChild!.remove();
    if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    for (const id of nodes.keys()) if (!visible.has(id)) nodes.delete(id);
    empty.hidden = filtered.length > 0 || Boolean(query && !matches);
    empty.textContent = query ? t('agentNoConversationsFound') : t('agentHistoryEmpty');
    more.hidden = filtered.length <= limit;
    list.setAttribute('aria-busy', String(Boolean(query && !matches)));
  }
  function sync() {
    if (!active || disposed) return;
    const next = store.searchSnapshot();
    if (next !== source) {
      source = next;
      sessions = next
        .filter((entry) => !entry.empty)
        .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      engine.update(next);
      matches = undefined;
    }
    render();
  }
  const onInput = () => {
    const next = search.value.trim().toLocaleLowerCase();
    if (next === query) return;
    query = next;
    limit = 40;
    matches = undefined;
    engine.query(query);
    render();
  };
  search.addEventListener('input', onInput);
  more.addEventListener('click', () => {
    limit += 40;
    render();
  });
  sync();
  return {
    el,
    sync,
    focus: () => search.focus(),
    setActive(value: boolean) {
      if (disposed) return;
      active = value;
      if (active) {
        sync();
        engine.query(query);
      }
    },
    dispose() {
      disposed = true;
      engine.dispose();
      search.removeEventListener('input', onInput);
      nodes.clear();
    },
  };
}
