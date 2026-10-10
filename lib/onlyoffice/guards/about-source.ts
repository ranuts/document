/**
 * Guard 12: legal attribution for the modified editor, independent of product marks.
 * The vendor's copyright and version remain; this adds the modified-version
 * notice, warranty disclaimer, license and source links. See NOTICE for the
 * decision to omit product branding.
 *
 * The pane is populated lazily -- `#about-menu-panel` exists from boot but is
 * empty until the user opens it -- so this watches for the content to arrive
 * instead of writing once. Appending inside the observed node re-enters the
 * callback; the id check is what stops that after one pass.
 *
 * Legal text is additive; guards/chrome.ts hides only product branding.
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
    'Copyright: Ascensio System SIA (upstream editors). ' +
    'ONLYOFFICE is a trademark of Ascensio System SIA. ' +
    'This modified version is distributed under AGPL-3.0, WITHOUT ANY WARRANTY; ' +
    'you may redistribute it under the applicable license terms.';
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

  const legal = doc.createElement('div');
  for (const [label, href] of [
    ['License (AGPL-3.0)', '/LICENSE'],
    ['Copyright and modification notices', '/NOTICE'],
  ]) {
    if (legal.children.length) legal.appendChild(doc.createTextNode(' · '));
    const legalLink = doc.createElement('a');
    legalLink.href = href;
    legalLink.target = '_blank';
    legalLink.rel = 'noopener noreferrer';
    legalLink.textContent = label;
    legal.appendChild(legalLink);
  }
  box.appendChild(legal);

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
