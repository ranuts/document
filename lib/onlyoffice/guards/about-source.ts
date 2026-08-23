/**
 * Guard 12: the source offer and the "not an official product" line, added to
 * the editor's own About pane.
 *
 * The vendor's About pane already carries what Section 7(b) of the ONLYOFFICE
 * AGPL terms asks for -- product logo, version, Ascensio System SIA copyright.
 * What it cannot carry is the two things that are true of THIS build and not of
 * theirs: that it is a modified version, and where its corresponding source is.
 * AGPL-3.0 Section 13 asks a network-interactive modified version to offer that
 * source to the people using it, and Section 7(e) is the reason to say plainly
 * that the mark on the pane above is not ours.
 *
 * The pane is populated lazily -- `#about-menu-panel` exists from boot but is
 * empty until the user opens it -- so this watches for the content to arrive
 * instead of writing once. Appending inside the observed node re-enters the
 * callback; the id check is what stops that after one pass.
 *
 * Additive only: nothing the vendor renders is moved, restyled or removed.
 */
const NOTICE_ID = 'oo-source-notice';
const SOURCE_URL = 'https://github.com/ranuts/document';
const WATCHED = '__ranSourceNoticeWatched';

function renderNotice(doc: Document, panel: HTMLElement): void {
  // Nothing to append to yet: the pane has not been opened for the first time.
  if (panel.children.length === 0) return;
  if (doc.getElementById(NOTICE_ID)) return;

  const box = doc.createElement('div');
  box.id = NOTICE_ID;
  box.style.cssText = 'padding:12px 0;font-size:11px;line-height:1.6;opacity:0.75;';

  const line = doc.createElement('div');
  line.textContent =
    'This is a modified version of the ONLYOFFICE editors, not an official ONLYOFFICE product. ' +
    'ONLYOFFICE is a trademark of Ascensio System SIA.';
  box.appendChild(line);

  const source = doc.createElement('div');
  source.textContent = 'Source code (AGPL-3.0): ';
  const link = doc.createElement('a');
  link.href = SOURCE_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = SOURCE_URL;
  source.appendChild(link);
  box.appendChild(source);

  panel.appendChild(box);
}

export function installAboutSourceNotice(doc: Document): boolean {
  const panel = doc.getElementById('about-menu-panel');
  if (!panel) return false;

  const flagged = panel as HTMLElement & { [WATCHED]?: boolean };
  if (flagged[WATCHED]) return true;
  flagged[WATCHED] = true;

  renderNotice(doc, panel);
  const view = doc.defaultView;
  if (view?.MutationObserver) {
    new view.MutationObserver(() => renderNotice(doc, panel)).observe(panel, { childList: true });
  }
  return true;
}
