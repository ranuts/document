import { COMPACT_VIEWPORT_MAX_WIDTH } from '../viewport';

/**
 * Strip the OnlyOffice chrome that has no place in a single-user local editor
 * -- the header logo and the current-user / co-users widgets -- and hide the
 * right panel on phone-sized viewports. There is no DocEditor config switch
 * for any of it in this build.
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
      '#header-logo, .btn-current-user, #tlb-box-users { display: none !important; }',
      `@media (max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px), (pointer: coarse) and (max-height: ${COMPACT_VIEWPORT_MAX_WIDTH}px) {`,
      '  [data-layout-name="rightMenu"] { display: none !important; }',
      '}',
    ].join('\n');
    (doc.head || doc.documentElement).appendChild(style);
  }
}
