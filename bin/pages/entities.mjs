/**
 * The JSON-LD entity graph: the three things this site is about, named once
 * and referred to by `@id` from every page.
 */
import { ORIGIN, REPO, SITE_NAME } from './constants.mjs';
import { LOCALES } from './locales.mjs';

/**
 * Stable identities for the three things this site is about.
 *
 * Every page used to emit its own anonymous WebApplication / SoftwareSourceCode
 * node, so 154 pages described 154 unrelated applications that happened to
 * share a name. Naming them once and referring to the name instead is what
 * turns a pile of pages into one entity described from many places -- the model
 * apple.com uses (`#organization`, `#website`, `#brand`, then
 * `manufacturer: { "@id": ... }` everywhere else). It matters more to the
 * machines that answer questions about the site than to the ones that rank it:
 * an assistant reading three of our pages should come away with one editor,
 * not three.
 */
export const ID = {
  org: `${ORIGIN}/#organization`,
  site: `${ORIGIN}/#website`,
  app: `${ORIGIN}/#app`,
  source: `${ORIGIN}/#source`,
};

/** The publisher and the site, identical on every page so they merge into one. */
export const siteEntities = () => [
  {
    '@type': 'Organization',
    '@id': ID.org,
    name: 'ranuts',
    url: ORIGIN + '/',
    logo: `${ORIGIN}/img/pwa-512.png`,
    sameAs: [REPO, 'https://github.com/ranuts', 'https://ran.chaxus.com'],
  },
  {
    '@type': 'WebSite',
    '@id': ID.site,
    name: SITE_NAME,
    url: ORIGIN + '/',
    publisher: { '@id': ID.org },
    // The site is one site in seven languages, which is a fact about the site
    // and not about whichever page is being read. Each page states its own
    // language on its WebPage node.
    inLanguage: Object.keys(LOCALES),
  },
];

/**
 * The editor itself. One entity, `url` always the site root -- a per-page url
 * here would make each translation look like a separate product.
 */
export const appEntity = (extra = {}) => ({
  '@type': 'WebApplication',
  '@id': ID.app,
  name: SITE_NAME,
  url: ORIGIN + '/',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  browserRequirements: 'Requires a modern browser with WebAssembly support',
  isAccessibleForFree: true,
  inLanguage: Object.keys(LOCALES),
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  // The repository is the editor's other public identity, not the org's.
  sameAs: [REPO],
  publisher: { '@id': ID.org },
  isPartOf: { '@id': ID.site },
  ...extra,
});

/**
 * The same entity, stated with just enough to be a definition rather than a
 * dangling reference. A documentation page is a page ABOUT the editor, not a
 * listing of it -- it should not carry a price and a category and become
 * eligible for an app rich result. But `about: { "@id": ... }` pointing at
 * nothing is silently dropped by the consumer, which puts the page back to
 * describing an anonymous application. So: named, not detailed.
 */
export const appStub = () => ({ '@type': 'WebApplication', '@id': ID.app, name: SITE_NAME, url: ORIGIN + '/' });

/** The repository behind it, named so the node merges instead of repeating. */
export const sourceEntity = () => ({
  '@type': 'SoftwareSourceCode',
  '@id': ID.source,
  name: SITE_NAME,
  codeRepository: REPO,
  programmingLanguage: 'TypeScript',
  license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  about: { '@id': ID.app },
});
