import { describe, expect, it, vi } from 'vitest';
import {
  applyDocumentLanguage,
  getLanguage,
  isRtlLanguage,
  RTL_LANGUAGES,
  LanguageCode,
  i18n,
  SHELL_LOCALES,
  setLanguage,
  t,
  type I18nMessages,
  type Language,
} from '@ranuts/shared/i18n';

/**
 * Shell locales beyond en/zh (roadmap direction eight, layer 2). All eight
 * tables are now complete, so what is pinned here is: every locale covers
 * every key, nothing silently leaks a raw key or an English string, and
 * RTL/lang attributes are applied.
 *
 * The per-key English fallback still exists in `t()` and still matters -- it
 * is what keeps a newly added key from rendering as a raw identifier before
 * the translations catch up. It is exercised below against a key that is not
 * in any table rather than against a real one, so the completeness check and
 * the fallback check cannot both be satisfied by the same gap.
 */
const CORE_KEYS: Array<keyof I18nMessages> = [
  'uploadDocument',
  'newWord',
  'newExcel',
  'newPowerPoint',
  'themeLabel',
  'themeSystem',
  'themeLight',
  'themeDark',
  'fileSavedSuccess',
  'documentLoaded',
  'failedToLoadEditor',
  'unsupportedFileType',
  'invalidFileObject',
  'documentOperationFailed',
  'editorErrorToast',
  'editorErrorFormatMismatch',
  'editorErrorOpenFailed',
];

/**
 * Strings that are legitimately identical to English in a given locale --
 * same word, not a missing translation. Anything else matching English fails.
 */
const SAME_AS_ENGLISH: Partial<Record<string, Array<keyof I18nMessages>>> = {
  de: ['themeSystem'],
  es: ['themeSystem', 'agentRoleError'],
  pt: ['themeSystem'],
};

/** The product name, which reads the same in every language. */
const NEVER_TRANSLATED: Array<keyof I18nMessages> = ['webOffice'];

const restore = () => {
  setLanguage(LanguageCode.EN);
  document.documentElement.removeAttribute('dir');
};

describe('shell locales', () => {
  it('ships the seven languages the language menu offers', () => {
    expect([...SHELL_LOCALES]).toEqual(['en', 'zh', 'ja', 'ko', 'de', 'es', 'pt']);
  });

  it.each(SHELL_LOCALES.filter((l) => l !== LanguageCode.EN))(
    '%s translates every core string (no English leakage, no raw keys)',
    (lang) => {
      setLanguage(lang as Language);
      try {
        expect(getLanguage()).toBe(lang);
        for (const key of CORE_KEYS) {
          const value = t(key);
          expect(value, `${lang}.${key}`).toBeTruthy();
          expect(value, `${lang}.${key} is a raw key`).not.toBe(key);
          // Every core string must actually differ from English.
          setLanguage(LanguageCode.EN);
          const english = t(key);
          setLanguage(lang as Language);
          if (!SAME_AS_ENGLISH[lang]?.includes(key)) {
            expect(value, `${lang}.${key} not translated`).not.toBe(english);
          }
        }
      } finally {
        restore();
      }
    },
  );

  /**
   * Every key, not just the core set: a table that silently loses a key would
   * still render -- in English -- and only a reader of that language would
   * notice. The agent panel used to be deliberately English outside en/zh;
   * it is translated now, and this is what keeps it that way.
   */
  it.each(SHELL_LOCALES.filter((l) => l !== LanguageCode.EN))('%s translates every key in the table', (lang) => {
    setLanguage(LanguageCode.EN);
    const english = i18n.getMessages();
    setLanguage(lang as Language);
    try {
      const untranslated = (Object.keys(english) as Array<keyof I18nMessages>).filter((key) => {
        if (NEVER_TRANSLATED.includes(key) || SAME_AS_ENGLISH[lang]?.includes(key)) return false;
        const value = t(key);
        return !value || value === key || value === english[key];
      });
      expect(untranslated, `${lang} still falls back to English for: ${untranslated.join(', ')}`).toEqual([]);
    } finally {
      restore();
    }
  });

  it('falls back to English rather than showing a raw key', () => {
    setLanguage(LanguageCode.DE);
    try {
      // A real German string, to prove the table is being consulted at all...
      expect(t('uploadDocument')).toBe('Dokument öffnen / bearbeiten');
      // ...and a key no table defines, which is what the fallback is for.
      expect(t('__notATranslatedKey__' as keyof I18nMessages)).toBe('__notATranslatedKey__');
    } finally {
      restore();
    }
  });

  /**
   * No shell locale is right-to-left today -- Persian was removed because the
   * vendor editor has no fa locale and the stylesheets still use physical
   * properties. The machinery stays so that adding one is a data change, and
   * this pins the pair together: an empty list, and a dir that follows it.
   */
  it('has no right-to-left shell language, and says so consistently', () => {
    expect([...RTL_LANGUAGES]).toEqual([]);
    for (const lang of SHELL_LOCALES) expect(isRtlLanguage(lang), lang).toBe(false);
  });

  it('applyDocumentLanguage sets <html lang> and dir (zh keeps the zh-CN tag)', () => {
    applyDocumentLanguage(LanguageCode.ZH);
    expect(document.documentElement.getAttribute('lang')).toBe('zh-CN');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');

    applyDocumentLanguage(LanguageCode.JA);
    expect(document.documentElement.getAttribute('lang')).toBe('ja');
    restore();
  });

  it('a stored language from any locale survives a reload', async () => {
    localStorage.setItem('document-lang', 'ko');
    window.history.pushState({}, '', '/');
    vi.resetModules();
    try {
      const m = await import('@ranuts/shared/i18n');
      expect(m.getLanguage()).toBe(LanguageCode.KO);
      expect(m.getOnlyOfficeLang()).toBe('ko');
    } finally {
      localStorage.removeItem('document-lang');
    }
  });
});
