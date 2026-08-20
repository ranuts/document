import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLanguage, getOnlyOfficeLang, LanguageCode, setLanguage, SHELL_LOCALES, t } from '@ranuts/shared/i18n';

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

// Editor UI locale passthrough (roadmap direction eight, layer 1): the shell has
// strings for en / zh only, but the vendored editor ships 45 locales, so the
// editor follows the visitor's language independently of the shell.
describe('message placeholders', () => {
  afterEach(() => {
    setLanguage(LanguageCode.EN);
  });

  it('fills {name} from the caller in every locale that has the string', () => {
    // The out-of-memory message quotes x2t's declared heap, which is read out
    // of the wasm binary (lib/onlyoffice/wasm-memory.ts). Eight hand-typed
    // copies of "283" would go stale on the next vendor bump without a single
    // test noticing.
    for (const locale of SHELL_LOCALES) {
      setLanguage(locale);
      const filled = t('editorErrorOutOfMemory', { mb: 283 });
      expect(filled, locale).toContain('283');
      expect(filled, locale).not.toContain('{mb}');
    }
  });

  it('leaves the placeholder written out when the caller passes nothing', () => {
    // Better a visible `{mb}` in one toast than a silently blank number.
    expect(t('editorErrorOutOfMemory')).toContain('{mb}');
  });

  it('leaves an unknown name alone rather than blanking it', () => {
    expect(t('editorErrorOutOfMemory', { other: 1 })).toContain('{mb}');
  });

  it('no locale hardcodes the heap size any more', () => {
    for (const locale of SHELL_LOCALES) {
      setLanguage(locale);
      expect(t('editorErrorOutOfMemory'), locale).not.toContain('283');
    }
  });
});

describe('editor UI locale (getOnlyOfficeLang) follows the visitor beyond en/zh', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
    localStorage.clear();
  });

  it.each([
    ['ja', 'ja'],
    ['ja-JP', 'ja'],
    ['ko-KR', 'ko'],
    ['de-DE', 'de'],
    ['es-419', 'es'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt-PT'],
    ['pt', 'pt'],
    ['zh', 'zh-CN'],
    ['zh_CN', 'zh-CN'],
    ['zh-Hans-CN', 'zh-CN'],
    ['zh-TW', 'zh-TW'],
    ['zh-Hant-HK', 'zh-TW'],
    ['sr-Cyrl-RS', 'sr-Cyrl'],
    ['nb-NO', 'no'],
    ['en-US', 'en'],
    ['fa', null], // no Persian locale in the vendor build
    ['xx', null],
    ['', null],
    [null, null],
  ])('resolveEditorLocale(%j) -> %j', async (tag, expected) => {
    const { resolveEditorLocale } = await import('@ranuts/shared/i18n');
    expect(resolveEditorLocale(tag)).toBe(expected);
  });

  it('every resolvable locale is one the vendor ships (and vice versa)', async () => {
    const { EDITOR_UI_LOCALES, resolveEditorLocale } = await import('@ranuts/shared/i18n');
    for (const code of EDITOR_UI_LOCALES) expect(resolveEditorLocale(code)).toBe(code);
  });

  it('?locale=ja gives a Japanese shell and a Japanese editor', async () => {
    window.history.pushState({}, '', '/?locale=ja');
    vi.resetModules();
    const m = await import('@ranuts/shared/i18n');
    expect(m.getLanguage()).toBe(LanguageCode.JA);
    expect(m.getOnlyOfficeLang()).toBe('ja');
  });

  it('?locale=fa gives a Persian shell but an English editor (no vendor locale)', async () => {
    window.history.pushState({}, '', '/?locale=fa');
    vi.resetModules();
    const m = await import('@ranuts/shared/i18n');
    expect(m.getLanguage()).toBe(LanguageCode.FA);
    expect(m.getOnlyOfficeLang()).toBe('en');
    expect(m.t('uploadDocument')).toBe('باز کردن / ویرایش سند');
  });

  it('an unsupported ?locale (fa) falls back to the browser language for the editor', async () => {
    window.history.pushState({}, '', '/?locale=fa');
    const spy = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fa-IR', 'de-DE', 'en']);
    try {
      vi.resetModules();
      const m = await import('@ranuts/shared/i18n');
      expect(m.getOnlyOfficeLang()).toBe('de');
    } finally {
      spy.mockRestore();
    }
  });

  it('an explicit shell choice overrides the browser language for the editor too', async () => {
    const spy = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    try {
      vi.resetModules();
      const m = await import('@ranuts/shared/i18n');
      expect(m.getOnlyOfficeLang()).toBe('ja');
      m.setLanguage(LanguageCode.ZH);
      expect(m.getOnlyOfficeLang()).toBe('zh-CN');
      m.setLanguage(LanguageCode.EN);
      expect(m.getOnlyOfficeLang()).toBe('en');
    } finally {
      spy.mockRestore();
    }
  });
});
