import type { I18nMessages } from './i18n/types';
import { zhCN } from './i18n/messages/zh-CN';
import { en } from './i18n/messages/en';
import { ja } from './i18n/messages/ja';
import { ko } from './i18n/messages/ko';
import { de } from './i18n/messages/de';
import { es } from './i18n/messages/es';
import { pt } from './i18n/messages/pt';
import { getAllQueryString, getCookie, localStorageGetItem, localStorageSetItem } from 'ranuts/utils';

/**
 * Internationalization configuration
 */

/**
 * Language codes enum
 * Internal language codes (simplified): 'zh' | 'en'
 * OnlyOffice language codes (BCP 47 standard): 'zh-CN' | 'en'
 */
export enum LanguageCode {
  /** Simplified Chinese (internal) */
  ZH = 'zh',
  /** English (internal) */
  EN = 'en',
  /** Japanese */
  JA = 'ja',
  /** Korean */
  KO = 'ko',
  /** German */
  DE = 'de',
  /** Spanish */
  ES = 'es',
  /** Portuguese */
  PT = 'pt',
  /** Persian (right-to-left) */
}

/**
 * OnlyOffice language codes (BCP 47 standard)
 */
export enum OnlyOfficeLanguageCode {
  /** Simplified Chinese (Mainland China) - BCP 47 standard */
  ZH_CN = 'zh-CN',
  /** English */
  EN = 'en',
}

/** Any shell language (the enum's member union). */
export type Language = LanguageCode;

/**
 * Shell languages, in the order the language menu shows them. All eight
 * tables are complete; `t()` still falls back to English per missing key,
 * which is what keeps a newly added key readable before its translations
 * land. test/unit/i18n-locales.test.ts fails if any table loses a key.
 */
export const SHELL_LOCALES: readonly Language[] = [
  LanguageCode.EN,
  LanguageCode.ZH,
  LanguageCode.JA,
  LanguageCode.KO,
  LanguageCode.DE,
  LanguageCode.ES,
  LanguageCode.PT,
];

/**
 * Right-to-left shell languages (drives `<html dir>`, see applyDocumentLanguage).
 *
 * Empty on purpose rather than deleted. Persian used to be here and was removed
 * with the rest of its table: the vendor editor ships ar, he and ur but no fa,
 * so a Persian visitor got a Persian site around an English editor -- and the
 * site's own stylesheets still use physical properties (padding-left and
 * friends), so the pages would have laid out left-to-right anyway. Adding a
 * genuine RTL locale means doing both: a vendor locale that exists, and
 * logical properties in landing.css / home.css / history.css / base.css.
 */
export const RTL_LANGUAGES: readonly Language[] = [];

export const isRtlLanguage = (lang: Language): boolean => RTL_LANGUAGES.includes(lang);

/**
 * Where a language's homepage lives. English is the site root; every other
 * language is a directory under it. Mirrors LOCALES in bin/build-pages.mjs,
 * which generates those pages -- the app needs it to send a reader back to the
 * homepage they came from rather than to the English one.
 */
export const localeHomePath = (lang: Language): string => (lang === LanguageCode.EN ? '/' : `/${lang}/`);

/**
 * Add `?locale=` to an app URL when the language is not the default. The app
 * resolves its language from the URL first, so a link that carries it works
 * even for a reader who has never chosen one explicitly (a shared link, a new
 * browser) -- the cookie only covers people who used the switch.
 */
export const withLocale = (url: string, lang: Language): string => {
  if (lang === LanguageCode.EN) return url;
  return `${url}${url.includes('?') ? '&' : '?'}locale=${lang}`;
};

/**
 * Editor (OnlyOffice) UI locales shipped by the vendored web-apps build --
 * `public/web-apps/apps/<app>/main/locale/<code>.json`. The site shell has
 * strings for en / zh-CN only, but the editor can speak all of these, so the
 * editor UI follows the visitor's preferred language independently of the
 * shell (a Japanese visitor gets a Japanese editor on an English landing).
 * The vendor loader lowercases the tag, keeps `pt-pt` / `zh-tw` / `sr-cyrl`
 * as 4-letter codes and otherwise uses the primary subtag, falling back to
 * English when the file is missing -- so anything returned here is safe.
 */
export const EDITOR_UI_LOCALES: readonly string[] = [
  'ar',
  'az',
  'be',
  'bg',
  'ca',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'eu',
  'fi',
  'fr',
  'gl',
  'he',
  'hu',
  'hy',
  'id',
  'it',
  'ja',
  'ko',
  'lo',
  'lv',
  'ms',
  'nl',
  'no',
  'pl',
  'pt',
  'pt-PT',
  'ro',
  'ru',
  'si',
  'sk',
  'sl',
  'sq',
  'sr',
  'sr-Cyrl',
  'sv',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh-CN',
  'zh-TW',
];

/**
 * The message table's shape and every locale's table live under ./i18n/ --
 * `types.ts` for the interface, `messages/<locale>.ts` for each language.
 * Re-exported here so `@ranuts/shared/i18n` stays the one import path.
 */
/**
 * Map any BCP 47-ish tag (`ja`, `pt_BR`, `zh-Hant-HK`, `en-US`) to the editor
 * locale the vendor can serve, or null when it has none (e.g. `fa`).
 * Region-sensitive cases: Chinese splits into zh-CN (default) vs zh-TW
 * (TW / HK / MO or the Hant script); Portuguese into pt (Brazil, default)
 * vs pt-PT; Serbian into sr (Latin) vs sr-Cyrl.
 */
export function resolveEditorLocale(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const parts = String(tag).trim().toLowerCase().split(/[-_]/).filter(Boolean);
  if (!parts.length) return null;
  const [primary, ...rest] = parts;
  if (primary === 'zh') {
    return rest.some((p) => p === 'tw' || p === 'hk' || p === 'mo' || p === 'hant') ? 'zh-TW' : 'zh-CN';
  }
  if (primary === 'pt') return rest.includes('pt') ? 'pt-PT' : 'pt';
  if (primary === 'sr') return rest.includes('cyrl') ? 'sr-Cyrl' : 'sr';
  if (primary === 'nb' || primary === 'nn') return 'no';
  if (primary === 'in') return 'id'; // legacy Indonesian tag
  if (primary === 'iw') return 'he'; // legacy Hebrew tag
  return EDITOR_UI_LOCALES.includes(primary) ? primary : null;
}

export type { I18nMessages } from './i18n/types';

/**
 * Which languages promise a complete table.
 *
 * en and zh-CN are the reference pair: every key exists in both, so a new UI
 * string is a two-language change rather than an eight-language one, and a
 * missing translation elsewhere shows in English rather than as a raw key.
 * The rest are complete too today; the type stays Partial so that staying
 * complete is a choice the i18n tests enforce rather than one the compiler
 * makes impossible to relax.
 */
const completeMessages: Record<LanguageCode.ZH | LanguageCode.EN, I18nMessages> = {
  [LanguageCode.ZH]: zhCN,
  [LanguageCode.EN]: en,
};

const partialMessages: Record<Exclude<Language, LanguageCode.ZH | LanguageCode.EN>, Partial<I18nMessages>> = {
  [LanguageCode.JA]: ja,
  [LanguageCode.KO]: ko,
  [LanguageCode.DE]: de,
  [LanguageCode.ES]: es,
  [LanguageCode.PT]: pt,
};

const messages: Record<Language, Partial<I18nMessages>> = { ...completeMessages, ...partialMessages };

/**
 * Values for a message's `{name}` placeholders.
 *
 * Numbers a message quotes must not be retyped into every locale: the
 * out-of-memory string quotes x2t's declared heap, which comes from the wasm
 * binary (lib/onlyoffice/wasm-memory.ts, pinned by vendor-contract.test.ts).
 * Eight hand-written copies of "283" would silently go stale on the next
 * vendor bump.
 */
export type TemplateVars = Record<string, string | number>;

/** Replaces `{name}`; an unknown name is left as written rather than blanked. */
const interpolate = (text: string, vars: TemplateVars): string =>
  text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));

class I18n {
  private currentLanguage: Language = LanguageCode.EN;
  /** Editor UI locale (see EDITOR_UI_LOCALES); detected alongside the shell language. */
  private editorLocale: string = OnlyOfficeLanguageCode.EN;

  /**
   * Get cookie value by name (using ranuts utility)
   */
  private getCookie(name: string): string | null {
    return getCookie(name);
  }

  /**
   * Get URL parameter by name (using ranuts utility)
   */
  private getUrlParameter(name: string): string | null {
    return getAllQueryString()?.[name] || null;
  }

  /**
   * Normalize language code to LanguageCode enum
   * Supports: 'zh', 'zh-CN', 'zh_CN', 'en', 'en-US', etc.
   */
  private normalizeLanguage(lang: string | null): Language | null {
    if (!lang) return null;
    const normalized = lang.toLowerCase().split(/[-_]/)[0];
    return (SHELL_LOCALES as readonly string[]).includes(normalized) ? (normalized as Language) : null;
  }

  constructor() {
    // Priority: URL locale -> cookie -> localStorage -> navigator.language -> 'en'
    // The same chain feeds two results: the shell language (en / zh only) and
    // the editor UI locale (any vendor-supported tag). The first source that
    // yields a value for a given result wins for that result, so `?locale=ja`
    // gives an English shell with a Japanese editor.
    let detectedLang: Language | null = null;
    let editorLocale: string | null = null;

    // 1. Try to get from URL parameter 'locale' (highest priority)
    const urlLocale = this.getUrlParameter('locale');
    detectedLang = this.normalizeLanguage(urlLocale);
    editorLocale = resolveEditorLocale(urlLocale);

    // 2. If not found in URL, try cookies (locale field)
    const cookieLang = this.getCookie('locale');
    if (!detectedLang) detectedLang = this.normalizeLanguage(cookieLang);
    if (!editorLocale) editorLocale = resolveEditorLocale(cookieLang);

    // 3. If not found in cookies, try localStorage (an explicit shell choice)
    const savedLang = this.normalizeLanguage(localStorageGetItem('document-lang'));
    if (savedLang) {
      if (!detectedLang) detectedLang = savedLang;
      if (!editorLocale) editorLocale = resolveEditorLocale(savedLang);
    }

    // 4. If not found in localStorage, try navigator.language(s)
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const browserLangs = nav ? [...(nav.languages || []), nav.language].filter(Boolean) : [];
    if (!detectedLang) detectedLang = this.normalizeLanguage(browserLangs[0] || null);
    if (!editorLocale) {
      for (const candidate of browserLangs) {
        editorLocale = resolveEditorLocale(candidate);
        if (editorLocale) break;
      }
    }

    // 5. Default to 'en' if nothing found
    this.currentLanguage = detectedLang || LanguageCode.EN;
    this.editorLocale = editorLocale || OnlyOfficeLanguageCode.EN;
  }

  /**
   * Get current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Set language
   */
  setLanguage(lang: Language): void {
    if ((SHELL_LOCALES as readonly string[]).includes(lang)) {
      this.currentLanguage = lang;
      // An explicit shell choice also decides the editor language (falling back
      // to English when the vendor ships no locale for it, e.g. fa).
      this.editorLocale = resolveEditorLocale(lang) || OnlyOfficeLanguageCode.EN;
      localStorageSetItem('document-lang', lang);
      // Trigger language change event
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
    }
  }

  /**
   * Get translated text
   */
  t(key: keyof I18nMessages, vars?: TemplateVars): string {
    // Partial locales fall back to English key by key (see `messages`).
    const text = messages[this.currentLanguage]?.[key] || completeMessages[LanguageCode.EN][key] || key;
    return vars ? interpolate(text, vars) : text;
  }

  /**
   * Get all messages
   */
  getMessages(): I18nMessages {
    return { ...completeMessages[LanguageCode.EN], ...messages[this.currentLanguage] };
  }

  /**
   * Get the editor UI locale (BCP 47, one of EDITOR_UI_LOCALES). Follows the
   * visitor's preferred language even when the shell has no strings for it;
   * an explicit shell choice (setLanguage / ?locale=zh) overrides it.
   * OnlyOffice uses BCP 47 standard language codes
   * - English: 'en'
   * - Simplified Chinese (Mainland China): 'zh-CN'
   */
  getOnlyOfficeLang(): string {
    return this.editorLocale;
  }
}

// Export singleton
export const i18n = new I18n();

// Export convenience functions
export const t = (key: keyof I18nMessages, vars?: TemplateVars): string => i18n.t(key, vars);
export const getLanguage = (): Language => i18n.getLanguage();
export const setLanguage = (lang: Language): void => i18n.setLanguage(lang);
export const getOnlyOfficeLang = (): string => i18n.getOnlyOfficeLang();

/**
 * Reflect the active shell language on <html> (`lang`, and `dir` for RTL
 * locales). Called by the app entry; the static landing pages carry their own
 * lang/dir in the served HTML.
 */
export const applyDocumentLanguage = (lang: Language = i18n.getLanguage()): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('lang', lang === LanguageCode.ZH ? 'zh-CN' : lang);
  document.documentElement.setAttribute('dir', isRtlLanguage(lang) ? 'rtl' : 'ltr');
};
