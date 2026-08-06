import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLanguage, getOnlyOfficeLang, LanguageCode, setLanguage, t } from '@ranuts/shared/i18n';

describe('i18n', () => {
  afterEach(() => {
    setLanguage(LanguageCode.EN);
  });

  it('uses English by default in the test environment', () => {
    expect(getLanguage()).toBe(LanguageCode.EN);
    expect(getOnlyOfficeLang()).toBe('en');
  });

  it('returns known translations for the active language', () => {
    expect(t('documentLoaded')).toBe('Document loaded: ');

    setLanguage(LanguageCode.ZH);

    expect(getLanguage()).toBe(LanguageCode.ZH);
    expect(getOnlyOfficeLang()).toBe('zh-CN');
    expect(t('documentLoaded')).toBe('文档加载完成：');
  });

  it('falls back to the key for unknown translations', () => {
    expect(t('missing.translation.key' as Parameters<typeof t>[0])).toBe('missing.translation.key');
  });

  it('has non-empty agent-panel translations in both languages', () => {
    const agentKeys = [
      'agentTitle',
      'agentSend',
      'agentStop',
      'agentClear',
      'agentQuote',
      'agentReviewMode',
      'agentProviderClaude',
      'agentProviderOpenAI',
      'agentProviderLocal',
      'agentLoadModel',
      'agentNeedKey',
      'agentStopped',
      'agentToolCallPrefix',
    ] as const;
    for (const lang of [LanguageCode.EN, LanguageCode.ZH]) {
      setLanguage(lang);
      for (const key of agentKeys) {
        expect(t(key), `${key} (${lang})`).toBeTruthy();
      }
    }
  });

  // GitHub #37/#32 "UI defaults to Chinese, can't switch to English": the module-load-time
  // language detection reads `?locale=` first (see i18n.ts constructor priority chain).
  // The singleton is constructed once at import time, so each case needs a fresh module
  // instance via resetModules + dynamic import rather than the shared `getLanguage()`.
  describe('locale detection at module init (URL "locale" param)', () => {
    afterEach(() => {
      window.history.pushState({}, '', '/');
      localStorage.clear();
    });

    it.each([
      ['?locale=zh', LanguageCode.ZH],
      ['?locale=zh-CN', LanguageCode.ZH],
      ['?locale=en', LanguageCode.EN],
      ['?locale=en-US', LanguageCode.EN],
    ])('URL "%s" selects language %s regardless of saved preference', async (search, expected) => {
      localStorage.setItem('document-lang', expected === LanguageCode.ZH ? LanguageCode.EN : LanguageCode.ZH);
      window.history.pushState({}, '', `/${search}`);

      vi.resetModules();
      const { getLanguage: freshGetLanguage } = await import('@ranuts/shared/i18n');

      expect(freshGetLanguage()).toBe(expected);
    });

    it('falls back to localStorage when the URL has no locale param', async () => {
      localStorage.setItem('document-lang', LanguageCode.ZH);
      window.history.pushState({}, '', '/');

      vi.resetModules();
      const { getLanguage: freshGetLanguage } = await import('@ranuts/shared/i18n');

      expect(freshGetLanguage()).toBe(LanguageCode.ZH);
    });
  });
});
