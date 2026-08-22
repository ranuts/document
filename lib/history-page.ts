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
import { Div, View } from 'ranui/builder';
import '../styles/history.css';
import { applyDocumentLanguage, t } from '@ranuts/shared/i18n';
import { formatRelativeTime } from './history/recovery';
import { clearAllHistory, deleteDoc, historyUsage, listDocs, pruneExpired } from './history/store';
import { isAutosaveEnabled, setAutosaveEnabled } from './history/autosave';
import { daysUntilExpiry, hasUnsavedWork, type HistoryDoc } from './history/types';

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

  const title = Div().class('history-row-title').text(doc.title).build();
  // The badge belongs with the title, not in the meta columns: it is a fact
  // about this document's safety, not another measurement of it.
  const titleCell = Div()
    .class('history-row-name')
    .children(title, ...(hasUnsavedWork(doc) ? [Div().class('history-badge').text(t('historyUnsaved')).build()] : []))
    .build();

  return Div()
    .class('history-row')
    .data('id', doc.id)
    .children(
      titleCell,
      // Each measurement gets its own column so the eye can read down one kind
      // of thing at a time; on a narrow screen they collapse into one line.
      Div().class('history-cell history-cell-time').text(formatRelativeTime(doc.updatedAt)).build(),
      Div().class('history-cell history-cell-size').text(formatBytes(doc.size)).build(),
      Div().class('history-cell history-cell-expiry').text(expiry).build(),
      Div()
        .class('history-row-actions')
        .children(
          button(
            t('historyOpen'),
            () => {
              window.location.href = `/editor?doc=${encodeURIComponent(doc.id)}`;
            },
            { class: 'history-open', type: 'primary' },
          ),
          button(
            t('historyDelete'),
            () => {
              if (!window.confirm(t('historyDeleteConfirm', { title: doc.title }))) return;
              void deleteDoc(doc.id).then(refresh);
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

  const clear = button(
    t('historyClearAll'),
    () => {
      if (!window.confirm(t('historyClearConfirm'))) return;
      void clearAllHistory().then(refresh);
    },
    { type: 'text', id: 'history-clear-all', class: 'history-clear' },
  );

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
      clear,
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
      Div()
        .class('history-title-row')
        .children(
          View('h1').class('history-title').text(t('historyTitle')).build(),
          Div()
            .class('history-header-actions')
            .children(
              buildAutosaveToggle(refresh),
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
        .text(query ? t('historyEmptySearch') : t('historyEmpty'))
        .build();

  // The two standing facts about this data live under the list, where they read
  // as terms rather than as a wall between the reader and their documents.
  const notes = Div()
    .class('history-notes')
    .children(
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
