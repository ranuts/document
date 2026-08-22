/**
 * /history -- the local document library.
 *
 * Everything listed here lives in this browser's IndexedDB and has never left
 * the device, which is exactly why the page leads with a way to delete it:
 * the feature's whole privacy cost is that a shared machine now remembers what
 * was edited on it, and the answer to that is a delete on every row and a
 * clear-everything that empties the bytes as well as the index.
 *
 * The page is an app surface, not a landing page: no per-language HTML file,
 * no sitemap entry, noindex. Its language follows the app's i18n the way the
 * editor's does.
 */
import 'ranui/button';
import 'ranui/input';
import 'ranui/icon';
import { Div, View } from 'ranui/builder';
import '../styles/history.css';
import { applyDocumentLanguage, t } from '@ranuts/shared/i18n';
import { formatRelativeTime } from './history/recovery';
import { clearAllHistory, deleteDoc, historyUsage, listDocs, pruneExpired } from './history/store';
import { isAutosaveEnabled, setAutosaveEnabled } from './history/autosave';
import { daysUntilExpiry, hasUnsavedWork, type HistoryDoc } from './history/types';
import { confirmDialog } from './confirm-dialog';

const SEARCH_DEBOUNCE_MS = 200;

let query = '';
let page = 1;
let searchTimer = 0;

function root(): HTMLElement {
  return document.getElementById('history-root') as HTMLElement;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Keep the view in the URL so a search or a page survives a reload and can be shared. */
function syncUrl(): void {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  if (page > 1) url.searchParams.set('page', String(page));
  else url.searchParams.delete('page');
  window.history.replaceState(null, '', url);
}

function readUrl(): void {
  const params = new URLSearchParams(window.location.search);
  query = params.get('q') ?? '';
  page = Math.max(1, Number(params.get('page') ?? '1') || 1);
}

function button(
  label: string,
  onClick: () => void,
  options: { type?: string; id?: string; class?: string } = {},
): HTMLElement {
  const builder = View('r-button').text(label).on('click', onClick);
  if (options.id) builder.id(options.id);
  if (options.class) builder.class(options.class);
  builder.attr('type', options.type ?? 'default');
  return builder.build();
}

function buildRow(doc: HistoryDoc, refresh: () => void): HTMLElement {
  const days = daysUntilExpiry(doc);
  const expiry =
    days === 0
      ? t('historyExpiresToday')
      : days === 1
        ? t('historyExpiresInOne')
        : t('historyExpiresIn', { days: String(days) });

  // Title line: what it is called, plus the one status worth interrupting for.
  const titleLine = Div()
    .class('history-row-title-line')
    .children(
      View('a')
        .class('history-row-title history-open')
        .attr('href', `/editor?saved=${encodeURIComponent(doc.id)}`)
        .text(doc.title)
        .build(),
      ...(hasUnsavedWork(doc)
        ? [
            Div()
              .class('history-badge')
              .children(View('i').class('history-dot').build(), View('span').text(t('historyUnsaved')).build())
              .build(),
          ]
        : []),
    )
    .build();

  // Facts line: read as one sentence, separated rather than aligned. Nobody
  // compares 51 KB with 180 KB down a column; they look for their document.
  const facts = Div()
    .class('history-row-facts')
    .children(
      ...(
        [
          ['fact-time', formatRelativeTime(doc.updatedAt)],
          ['fact-size', formatBytes(doc.size)],
          ['fact-expiry', expiry],
        ] as Array<[string, string]>
      ).map(([kind, text]) => View('span').class(kind).text(text).build()),
    )
    .build();

  return Div()
    .class('history-row')
    .data('id', doc.id)
    .children(
      Div().class('history-kind').text(doc.ext.toUpperCase()).build(),
      Div().class('history-row-main').children(titleLine, facts).build(),
      Div()
        .class('history-row-actions')
        .children(
          button(
            t('historyDelete'),
            () => {
              void confirmDialog({
                title: t('historyDeleteTitle'),
                body: t('historyDeleteConfirm', { title: doc.title }),
                confirmLabel: t('historyDelete'),
                cancelLabel: t('historyCancel'),
                danger: true,
              }).then((ok) => (ok ? deleteDoc(doc.id).then(refresh) : undefined));
            },
            { type: 'text', class: 'history-delete' },
          ),
        )
        .build(),
    )
    .build();
}

function buildToolbar(usage: number, total: number, refresh: () => void): HTMLElement {
  const search = View('r-input')
    .id('history-search')
    .class('history-search')
    .attr('placeholder', t('historySearchPlaceholder'))
    .attr('value', query)
    .on('input', (event: Event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value ?? '';
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        query = value;
        // A new search starts at the top; staying on page 4 of the previous
        // result set shows an empty page more often than not.
        page = 1;
        refresh();
      }, SEARCH_DEBOUNCE_MS);
    })
    .build();

  return Div()
    .class('history-toolbar')
    .children(
      search,
      Div()
        .class('history-usage')
        .text(
          total
            ? `${t('historyCount', { count: String(total) })} · ${t('historyUsage', { size: formatBytes(usage) })}`
            : '',
        )
        .build(),
    )
    .build();
}

function buildPager(current: number, pages: number, refresh: () => void): HTMLElement {
  // Writes the module's page, not a parameter shadowing it: a pager that moved
  // a local copy would re-render the same page for ever.
  const goTo = (target: number): void => {
    page = Math.min(Math.max(1, target), pages);
    refresh();
  };
  const prev = button(t('historyPrev'), () => goTo(current - 1), { id: 'history-prev' });
  const next = button(t('historyNext'), () => goTo(current + 1), { id: 'history-next' });
  if (current <= 1) prev.setAttribute('disabled', '');
  if (current >= pages) next.setAttribute('disabled', '');

  return Div()
    .class('history-pager')
    .children(
      prev,
      Div()
        .class('history-page-info')
        .text(t('historyPageInfo', { page: String(current), pages: String(pages) }))
        .build(),
      next,
    )
    .build();
}

function buildAutosaveToggle(refresh: () => void): HTMLElement {
  const enabled = isAutosaveEnabled();
  const toggle = View('input')
    .id('history-autosave')
    .class('history-switch')
    .attr('type', 'checkbox')
    .attr('role', 'switch')
    .on('change', (event: Event) => {
      setAutosaveEnabled((event.target as HTMLInputElement).checked);
      refresh();
    })
    .build() as HTMLInputElement;
  toggle.checked = enabled;

  return View('label')
    .class('history-autosave')
    .attr('for', 'history-autosave')
    .children(toggle, View('span').text(t('historyAutosaveLabel')).build())
    .build();
}

async function render(): Promise<void> {
  // Sweep before reading: a row the user is shown must not be one the seven-day
  // rule already deleted, and this page is the most likely thing to be open
  // when that boundary is crossed.
  await pruneExpired();
  const [{ items, total, page: current, pageSize }, usage] = await Promise.all([
    listDocs({ query, page }),
    historyUsage(),
  ]);
  page = current;
  syncUrl();

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const refresh = () => void render();

  const header = Div()
    .class('history-header')
    .children(
      // chip -> title -> intro: the homepage hero's own opening, so the page a
      // visitor reaches from it is recognisably the same product rather than
      // an admin screen that happens to share a header.
      Div()
        .class('history-chip')
        .children(View('i').class('history-chip-dot').build(), View('span').text(t('historyChip')).build())
        .build(),
      Div()
        .class('history-title-row')
        .children(
          View('h1').class('history-title').text(t('historyTitle')).build(),
          Div()
            .class('history-header-actions')
            .children(
              button(
                t('historyBack'),
                () => {
                  window.location.href = '/';
                },
                { type: 'text', class: 'history-back' },
              ),
            )
            .build(),
        )
        .build(),
      View('p').class('history-intro').text(t('historyIntro')).build(),
    )
    .build();

  const list = items.length
    ? Div()
        .class('history-list')
        .id('history-list')
        .children(...items.map((doc) => buildRow(doc, refresh)))
        .build()
    : Div()
        .class('history-empty')
        .id('history-empty')
        .children(
          Div()
            .class('history-empty-mark')
            .text(query ? '⌕' : '⌂')
            .attr('aria-hidden', 'true')
            .build(),
          Div()
            .class('history-empty-title')
            .text(query ? t('historyEmptySearchTitle') : t('historyEmptyTitle'))
            .build(),
          Div()
            .class('history-empty-body')
            .text(query ? t('historyEmptySearch') : t('historyEmpty'))
            .build(),
          query
            ? button(
                t('historyClearSearch'),
                () => {
                  query = '';
                  page = 1;
                  refresh();
                },
                { type: 'text', class: 'history-empty-action' },
              )
            : button(
                t('historyBack'),
                () => {
                  window.location.href = '/';
                },
                { type: 'primary', class: 'history-empty-action' },
              ),
        )
        .build();

  // The two standing facts about this data live under the list, where they read
  // as terms rather than as a wall between the reader and their documents.
  const notes = Div()
    .class('history-notes')
    .children(
      // Everything that acts on the whole feature rather than on one document,
      // together and below the list: the switch that governs it, the single
      // destructive action, and the rules they operate under. A "delete
      // everything" button next to a search box is a mis-click waiting.
      Div()
        .class('history-notes-controls')
        .children(
          buildAutosaveToggle(refresh),
          button(
            t('historyClearAll'),
            () => {
              void confirmDialog({
                title: t('historyClearTitle'),
                body: t('historyClearConfirm'),
                confirmLabel: t('historyClearAll'),
                cancelLabel: t('historyCancel'),
                danger: true,
              }).then((ok) => (ok ? clearAllHistory().then(refresh) : undefined));
            },
            { type: 'text', id: 'history-clear-all', class: 'history-clear' },
          ),
        )
        .build(),
      Div().class('history-note').text(t('historyRetention')).build(),
      Div().class('history-note').text(t('historyNotBackup')).build(),
      ...(isAutosaveEnabled()
        ? []
        : [Div().class('history-note history-note-warn').text(t('historyAutosaveOff')).build()]),
    )
    .build();

  const pageEl = Div()
    .class('history-page')
    .children(
      header,
      buildToolbar(usage, total, refresh),
      list,
      ...(pages > 1 ? [buildPager(page, pages, refresh)] : []),
      notes,
    )
    .build();

  root().replaceChildren(pageEl);
}

applyDocumentLanguage();
readUrl();
void render();
