import { COMPACT_VIEWPORT_MAX_WIDTH } from '../viewport';

/**
 * Strip the OnlyOffice chrome that has no place in a single-user local editor
 * -- the current-user / co-users widgets, which describe a collaboration
 * session this build cannot have -- and hide the right panel on phone-sized
 * viewports. There is no DocEditor config switch for either in this build.
 *
 * The header logo is deliberately NOT in that list. This site is a derivative
 * work of ONLYOFFICE, whose AGPL-3.0 headers add, under Section 7(b), the term
 * that the original product logo must be retained when the program is
 * distributed. It used to be hidden here (and the About pane switched off in
 * the DocEditor config) which left no product mark anywhere in the interface.
 * Both are back on purpose; do not "clean up" the header again.
 */
export function injectLocalChromeCss(doc: Document): void {
  if (!doc.getElementById('oo-local-chrome-css')) {
    const style = doc.createElement('style');
    style.id = 'oo-local-chrome-css';
    // The compact rule is a media query on purpose: it re-evaluates itself
    // on rotation and on every window resize, so the panel a phone cannot
    // afford stays gone no matter which orientation the document was
    // opened in. The JS side (syncCompactLayout) only handles what CSS
    // cannot: the thumbnails panel and the SDK's own canvas geometry.
    style.textContent = [
      '.btn-current-user, #tlb-box-users { display: none !important; }',
      `@media (max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px), (pointer: coarse) and (max-height: ${COMPACT_VIEWPORT_MAX_WIDTH}px) {`,
      '  [data-layout-name="rightMenu"] { display: none !important; }',
      '}',
    ].join('\n');
    (doc.head || doc.documentElement).appendChild(style);
  }
}
