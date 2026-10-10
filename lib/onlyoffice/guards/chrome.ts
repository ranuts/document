import { COMPACT_VIEWPORT_MAX_WIDTH } from '../viewport';

/**
 * 1. Strip the OnlyOffice chrome that has no place in a single-user local editor
 * -- the current-user / co-users widgets, which describe a collaboration
 * session this build cannot have -- and hide the right panel on phone-sized
 * viewports. There is no DocEditor config switch for either in this build.
 *
 * Product marks are hidden independently of legal attribution. About remains
 * reachable with the upstream copyright, version, license and source links.
 * NOTICE records the branding decision and the FSF's interpretation of AGPLv3.
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
      '#header-logo, .brand-logo, .asc-about-office, #id-about-company-logo { display: none !important; }',
      '#id-about-licensor-logo .asc-about-version:not(#id-about-licensor-version-name) { display: none !important; }',
      `@media (max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px), (pointer: coarse) and (max-height: ${COMPACT_VIEWPORT_MAX_WIDTH}px) {`,
      '  [data-layout-name="rightMenu"] { display: none !important; }',
      '}',
    ].join('\n');
    (doc.head || doc.documentElement).appendChild(style);

    // The vendor rewrites the title after every rename and modified-state
    // change. Preserve the filename and unsaved marker without its suffix.
    const neutralizeTitle = (): void => {
      const title = doc.title.replace(/\s+-\s+ONLYOFFICE$/i, '');
      const neutralTitle = /^ONLYOFFICE$/i.test(title) ? 'Document Editor' : title;
      if (neutralTitle !== doc.title) doc.title = neutralTitle;
    };
    neutralizeTitle();
    const titleElement = doc.querySelector('title');
    const Observer = doc.defaultView?.MutationObserver;
    if (titleElement && Observer) {
      new Observer(neutralizeTitle).observe(titleElement, { childList: true, characterData: true, subtree: true });
    }
  }
}
