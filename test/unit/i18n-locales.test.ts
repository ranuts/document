import { describe, expect, it, vi } from 'vitest';
import {
  applyDocumentLanguage,
  getLanguage,
  isRtlLanguage,
  LanguageCode,
  SHELL_LOCALES,
  setLanguage,
  t,
  type I18nMessages,
  type Language,
} from '@ranuts/shared/i18n';

/**
 * Shell locales beyond en/zh (roadmap direction eight, layer 2). English and
 * Chinese are complete tables; the rest translate the *core* UI and fall back
 * to English per key, so what is pinned here is: every locale covers the core
 * set, nothing silently leaks a raw key, and RTL/lang attributes are applied.
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
  es: ['themeSystem'],
  pt: ['themeSystem'],
};

const restore = () => {
  setLanguage(LanguageCode.EN);
  document.documentElement.removeAttribute('dir');
};

describe('shell locales', () => {
  it('ships the eight languages the language menu offers', () => {
    expect([...SHELL_LOCALES]).toEqual(['en', 'zh', 'ja', 'ko', 'de', 'es', 'pt', 'fa']);
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

  it('falls back to English for untranslated keys instead of showing the key', () => {
    setLanguage(LanguageCode.DE);
    try {
      // The agent panel is deliberately English outside en/zh.
      expect(t('agentSend')).toBe('Send');
      expect(t('uploadDocument')).toBe('Dokument öffnen / bearbeiten');
    } finally {
      restore();
    }
  });

  it('marks only Persian as right-to-left', () => {
    for (const lang of SHELL_LOCALES) {
      expect(isRtlLanguage(lang), lang).toBe(lang === LanguageCode.FA);
    }
  });

  it('applyDocumentLanguage sets <html lang> and dir (zh keeps the zh-CN tag)', () => {
    applyDocumentLanguage(LanguageCode.FA);
    expect(document.documentElement.getAttribute('lang')).toBe('fa');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

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
