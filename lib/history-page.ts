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
import 'ranui/message';
import { Div, View } from 'ranui/builder';
import '../styles/history.css';
import { saveFileToDisk } from 'ranuts/utils';
import { applyDocumentLanguage, getLanguage, localeHomePath, t, withLocale } from '@ranuts/shared/i18n';
import { getDocumentMimeType } from '@ranuts/shared/document-utils';
import { formatRelativeTime } from './history/recovery';
import { clearAllHistory, deleteDoc, getLatestSnapshot, historyUsage, listDocs, pruneExpired } from './history/store';
import { stashPendingFile } from './pending-open';
import { isAutosaveEnabled, setAutosaveEnabled } from './history/autosave';
import { daysUntilExpiry, hasUnsavedWork, type HistoryDoc } from './history/types';
import { confirmDialog } from './confirm-dialog';

const SEARCH_DEBOUNCE_MS = 200;

let query = '';
let page = 1;
let searchTimer = 0;
/** Filter: only documents whose latest edit was never exported to disk. */
let unsavedOnly = false;

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
  if (unsavedOnly) url.searchParams.set('unsaved', '1');
  else url.searchParams.delete('unsaved');
  if (page > 1) url.searchParams.set('page', String(page));
  else url.searchParams.delete('page');
  window.history.replaceState(null, '', url);
}

function readUrl(): void {
  const params = new URLSearchParams(window.location.search);
  query = params.get('q') ?? '';
  unsavedOnly = params.get('unsaved') === '1';
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

/**
 * Write the newest snapshot of one document to disk.
 *
 * It deliberately does NOT mark the document as exported: what lands on disk
 * is the last autosaved revision, which is not necessarily what the editor
 * would produce from the live session, and claiming "exported" for a copy the
 * user has not seen would silence the badge that says work is at risk.
 */
async function downloadDoc(doc: HistoryDoc): Promise<void> {
  try {
    const snapshot = await getLatestSnapshot(doc.id);
    if (!snapshot) throw new Error('no snapshot');
    await saveFileToDisk(snapshot.bytes, doc.title, { mimeType: getDocumentMimeType(doc.title) });
  } catch {
    (window as unknown as { message?: { error?: (msg: string) => void } }).message?.error?.(t('historyDownloadFailed'));
  }
}

/** Ask for a document and hand it to the editor through the IndexedDB handoff. */
function pickAndOpenFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  // Same list the app's own picker offers (lib/document.ts).
  input.accept = '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.csv,.pdf';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    void stashPendingFile(file).then((stashed) => {
      window.location.href = stashed ? '/editor?open=local' : '/editor';
    });
  });
  document.body.appendChild(input);
  input.click();
}

function buildRow(doc: HistoryDoc, refresh: () => void): HTMLElement {
  const days = daysUntilExpiry(doc);
  const expiry =
    days === 0
      ? t('historyExpiresToday')
      : days === 1
        ? t('historyExpiresInOne')
        : t('historyExpiresIn', { days: String(days) });
  // The countdown is the only thing on this page with a deadline, and it is
  // the last day that matters: printed in the same grey as the file size, "1
  // day left" reads like a fact rather than like a prompt to do something.
  const expiryUrgent = days <= 1;

  // Title line: what it is called, plus the one status worth interrupting for.
  const titleLine = Div()
    .class('history-row-title-line')
    .children(
      View('a')
        .class('history-row-title history-open')
        // Carry the language: this page knows which one it is in, and the
        // editor should not have to guess it again from the browser.
        .attr('href', withLocale(`/editor?saved=${encodeURIComponent(doc.id)}`, getLanguage()))
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
          ['fact-expiry' + (expiryUrgent ? ' fact-expiry-urgent' : ''), expiry],
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
          // Getting the work out is the reason most people open this page, and
          // until now the only way was to open the editor and save from there.
          // The bytes are already in IndexedDB; this writes them straight to
          // disk (File System Access where available, download elsewhere).
          button(
            t('historyDownload'),
            () => {
              void downloadDoc(doc);
            },
            { type: 'text', class: 'history-download' },
          ),
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

function buildToolbar(refresh: () => void): HTMLElement {
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

  // One filter, and it is the one that matters: a document that was never
  // exported is the only kind whose bytes exist nowhere else, and it is the
  // reason someone opens this page in a hurry.
  const filter = View('button')
    .attr('type', 'button')
    .id('history-filter-unsaved')
    .class(`history-filter${unsavedOnly ? ' is-on' : ''}`)
    .attr('aria-pressed', unsavedOnly ? 'true' : 'false')
    .on('click', () => {
      unsavedOnly = !unsavedOnly;
      page = 1;
      refresh();
    })
    .children(View('i').class('history-dot').build(), View('span').text(t('historyOnlyUnsaved')).build())
    .build();

  return Div().class('history-toolbar').children(search, filter).build();
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
    listDocs({ query, page, unsavedOnly }),
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
                  // Back to the homepage the reader came from, not to English.
                  window.location.href = localeHomePath(getLanguage());
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
            .text(query || unsavedOnly ? '⌕' : '⌂')
            .attr('aria-hidden', 'true')
            .build(),
          Div()
            .class('history-empty-title')
            .text(query || unsavedOnly ? t('historyEmptySearchTitle') : t('historyEmptyTitle'))
            .build(),
          Div()
            .class('history-empty-body')
            .text(query || unsavedOnly ? t('historyEmptySearch') : t('historyEmpty'))
            .build(),
          query || unsavedOnly
            ? button(
                t('historyClearSearch'),
                () => {
                  query = '';
                  unsavedOnly = false;
                  page = 1;
                  refresh();
                },
                { type: 'text', class: 'history-empty-action' },
              )
            : // "Back to the homepage" made the reader take the long way round to
              // the thing they came to do. This page cannot open a document
              // itself -- it deliberately does not load the editor bundle --
              // so it hands the file to the editor the same way the static
              // landing pages do (lib/pending-open.ts).
              button(
                t('historyOpenFile'),
                () => {
                  pickAndOpenFile();
                },
                { type: 'primary', id: 'history-open-file', class: 'history-empty-action' },
              ),
        )
        .build();

  /**
   * Everything that is about the feature rather than about one document:
   * the switch that governs it, the single destructive action, and the rules
   * they operate under.
   *
   * On a wide screen this is a rail beside the list -- the same shape the
   * content pages use, and the reason the page can now afford the site's wide
   * frame: the space to the right of a file name used to be dead. Below the
   * breakpoint the rail is not hidden (unlike the rail on an article page,
   * these are controls, not navigation) -- it falls to the bottom of the
   * column, which is where it already was.
   */
  const rail = View('aside')
    .class('history-rail')
    .children(
      // How much is being kept is a fact about the store, not about the
      // search, so it sits at the top of the rail rather than beside the
      // search box, where it competed with the filter for the same row.
      Div()
        .class('history-usage')
        .text(
          total
            ? `${t('historyCount', { count: String(total) })} · ${t('historyUsage', { size: formatBytes(usage) })}`
            : '',
        )
        .build(),
      Div()
        .class('history-rail-block')
        .children(
          Div().class('history-rail-label').text(t('historyRailSettings')).build(),
          buildAutosaveToggle(refresh),
          ...(isAutosaveEnabled()
            ? []
            : [Div().class('history-note history-note-warn').text(t('historyAutosaveOff')).build()]),
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
      Div()
        .class('history-rail-block')
        .children(
          Div().class('history-rail-label').text(t('historyRailRetention')).build(),
          Div().class('history-note').text(t('historyRetention')).build(),
          Div().class('history-note').text(t('historyNotBackup')).build(),
        )
        .build(),
    )
    .build();

  const pageEl = Div()
    .class('history-shell')
    .children(
      Div()
        .class('history-page')
        .children(header, buildToolbar(refresh), list, ...(pages > 1 ? [buildPager(page, pages, refresh)] : []))
        .build(),
      rail,
    )
    .build();

  root().replaceChildren(pageEl);
}

/**
 * The chrome around this page is hand-written (history.html), so its <title>
 * and the language switch's current entry ship as English literals while the
 * body is translated at runtime -- a Chinese reader got a Chinese page whose
 * switch still read "English" and whose tab still read "Local history".
 *
 * The endonyms are already in the DOM, one per <a class="lang-option" lang>,
 * so the current entry is copied from the link that matches <html lang>
 * rather than from a second table that would have to be kept in step with
 * bin/pages/locales.mjs.
 */
function syncPageChrome(): void {
  document.title = t('historyTitle');
  const lang = document.documentElement.getAttribute('lang');
  const options = [...document.querySelectorAll<HTMLAnchorElement>('a.lang-option')];
  const current = options.find((option) => option.getAttribute('lang') === lang);
  if (!current) return;
  for (const option of options) {
    option.classList.toggle('is-current', option === current);
    if (option === current) option.setAttribute('aria-current', 'page');
    else option.removeAttribute('aria-current');
  }
  const label = document.querySelector('.lang-current');
  if (label) label.textContent = current.textContent?.trim() ?? '';
}

applyDocumentLanguage();
syncPageChrome();
readUrl();
void render();
