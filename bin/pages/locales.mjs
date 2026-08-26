/**
 * The languages the site ships, and the order the language menu lists them in.
 */

/** Locales the shell knows about. `prefix` is the URL directory; '' = root. */
export const LOCALES = {
  en: { prefix: '', lang: 'en', label: 'English', home: '/', dir: 'ltr', og: 'en_US' },
  'zh-CN': { prefix: '/zh-CN', lang: 'zh-CN', label: '中文', home: '/zh-CN/', dir: 'ltr', og: 'zh_CN' },
  ja: { prefix: '/ja', lang: 'ja', label: '日本語', home: '/ja/', dir: 'ltr', og: 'ja_JP' },
  de: { prefix: '/de', lang: 'de', label: 'Deutsch', home: '/de/', dir: 'ltr', og: 'de_DE' },
  es: { prefix: '/es', lang: 'es', label: 'Español', home: '/es/', dir: 'ltr', og: 'es_ES' },
  ko: { prefix: '/ko', lang: 'ko', label: '한국어', home: '/ko/', dir: 'ltr', og: 'ko_KR' },
  // pt_BR, not pt_PT: the pages, the shell strings and the vendor locale the
  // editor loads (pt.json) are all Brazilian Portuguese.
  pt: { prefix: '/pt', lang: 'pt', label: 'Português', home: '/pt/', dir: 'ltr', og: 'pt_BR' },
};
export const DEFAULT_LOCALE = 'en';

/**
 * The order the language menu lists its entries in.
 *
 * Explicit rather than sorted at render time: `localeCompare` answers according
 * to whatever ICU data the host has, so the order could differ between a local
 * build and CI, and a menu that reorders itself is one nobody can learn. Latin
 * endonyms alphabetically first, then the rest -- a reader scanning for their
 * own language is looking for the shape of a word, not reading the list.
 *
 * Every locale in `LOCALES` must appear here; `landing-pages.test.ts` fails if
 * one is added and this is not.
 */
export const MENU_ORDER = ['de', 'en', 'es', 'pt', 'zh-CN', 'ja', 'ko'];
