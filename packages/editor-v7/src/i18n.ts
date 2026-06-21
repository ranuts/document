import { getCookie, getQuery, localStorageGetItem, localStorageSetItem } from 'ranuts/utils';

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

export type Language = LanguageCode.ZH | LanguageCode.EN;

export interface I18nMessages {
  // UI text
  webOffice: string;
  uploadDocument: string;
  newWord: string;
  newExcel: string;
  newPowerPoint: string;
  menu: string;
  menuGuide: string;

  // Landing page trust badges
  trustNoUpload: string;
  trustNoAccount: string;
  trustPwaOffline: string;

  // Landing page hint
  landingHint: string;

  // Landing page nav links
  navPrivateEditor: string;
  navDocxEditor: string;
  navXlsxEditor: string;
  navPptxEditor: string;
  navCsvEditor: string;
  navOnlyofficeWasm: string;
  navEmbedApi: string;
  navSelfHosted: string;

  // Messages
  fileSavedSuccess: string;
  documentLoaded: string;

  // Error messages
  failedToLoadEditor: string;
  unsupportedFileType: string;
  invalidFileObject: string;
  documentOperationFailed: string;
}

const messages: Record<Language, I18nMessages> = {
  [LanguageCode.ZH]: {
    webOffice: 'Web Office',
    uploadDocument: '查看/编辑文档',
    newWord: '新建 Word',
    newExcel: '新建 Excel',
    newPowerPoint: '新建 PowerPoint',
    menu: '菜单',
    menuGuide: '菜单在右下角，悬停即可查看（点击关闭后不再提示）',
    trustNoUpload: '无需上传',
    trustNoAccount: '无需账号',
    trustPwaOffline: 'PWA 离线',
    landingHint: '新建 Office 文件或打开本地文档，远程 URL 需支持 CORS。',
    navPrivateEditor: '隐私编辑器',
    navDocxEditor: 'DOCX 编辑器',
    navXlsxEditor: 'XLSX 编辑器',
    navPptxEditor: 'PPTX 编辑器',
    navCsvEditor: 'CSV 编辑器',
    navOnlyofficeWasm: 'OnlyOffice WASM',
    navEmbedApi: '嵌入 API',
    navSelfHosted: '自部署',
    fileSavedSuccess: '文件保存成功：',
    documentLoaded: '文档加载完成：',
    failedToLoadEditor: '无法加载编辑器组件。请确保已正确安装 OnlyOffice API。',
    unsupportedFileType: '不支持的文件类型：',
    invalidFileObject: '无效的文件对象',
    documentOperationFailed: '文档操作失败：',
  },
  [LanguageCode.EN]: {
    webOffice: 'Web Office',
    uploadDocument: 'View/Edit Document',
    newWord: 'New Word',
    newExcel: 'New Excel',
    newPowerPoint: 'New PowerPoint',
    menu: 'Menu',
    menuGuide: "Menu is in the bottom right corner, hover to view (click to close, won't show again)",
    trustNoUpload: 'No upload',
    trustNoAccount: 'No account',
    trustPwaOffline: 'PWA offline',
    landingHint: 'Create a new Office file or open a local document. Remote URLs work with CORS-enabled sources.',
    navPrivateEditor: 'Private editor',
    navDocxEditor: 'DOCX editor',
    navXlsxEditor: 'XLSX editor',
    navPptxEditor: 'PPTX editor',
    navCsvEditor: 'CSV editor',
    navOnlyofficeWasm: 'OnlyOffice WASM',
    navEmbedApi: 'Embed API',
    navSelfHosted: 'Self-hosted',
    fileSavedSuccess: 'File saved successfully: ',
    documentLoaded: 'Document loaded: ',
    failedToLoadEditor: 'Failed to load editor component. Please ensure OnlyOffice API is properly installed.',
    unsupportedFileType: 'Unsupported file type: ',
    invalidFileObject: 'Invalid file object',
    documentOperationFailed: 'Document operation failed: ',
  },
};

class I18n {
  private currentLanguage: Language = LanguageCode.EN;

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
    return getQuery()?.[name] || null;
  }

  /**
   * Normalize language code to LanguageCode enum
   * Supports: 'zh', 'zh-CN', 'zh_CN', 'en', 'en-US', etc.
   */
  private normalizeLanguage(lang: string | null): Language | null {
    if (!lang) return null;
    const normalized = lang.toLowerCase().split(/[-_]/)[0];
    if (normalized === 'zh') return LanguageCode.ZH;
    if (normalized === 'en') return LanguageCode.EN;
    return null;
  }

  constructor() {
    // Priority: path prefix -> URL locale -> cookie -> localStorage -> navigator.language -> 'en'
    let detectedLang: Language | null = null;

    // 0. Highest priority: sub-directory path prefix (e.g. /zh-cn/...)
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/zh-cn/')) {
      detectedLang = LanguageCode.ZH;
    }

    // 1. Try to get from URL parameter 'locale'
    if (!detectedLang) {
      const urlLocale = this.getUrlParameter('locale');
      detectedLang = this.normalizeLanguage(urlLocale);
    }

    // 2. If not found in URL, try cookies (locale field)
    if (!detectedLang) {
      const cookieLang = this.getCookie('locale');
      detectedLang = this.normalizeLanguage(cookieLang);
    }

    // 3. If not found in cookies, try localStorage
    if (!detectedLang) {
      const savedLang = localStorageGetItem('document-lang') as Language;
      if (savedLang && (savedLang === LanguageCode.ZH || savedLang === LanguageCode.EN)) {
        detectedLang = savedLang;
      }
    }

    // 4. If not found in localStorage, try navigator.language
    if (!detectedLang) {
      const browserLang =
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        typeof navigator !== 'undefined' && navigator.language
          ? // eslint-disable-next-line n/no-unsupported-features/node-builtins
            navigator.language
          : LanguageCode.EN;
      detectedLang = this.normalizeLanguage(browserLang);
    }

    // 5. Default to 'en' if nothing found
    this.currentLanguage = detectedLang || LanguageCode.EN;
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
    if (lang === LanguageCode.ZH || lang === LanguageCode.EN) {
      this.currentLanguage = lang;
      localStorageSetItem('document-lang', lang);
      // Trigger language change event
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
    }
  }

  /**
   * Get translated text
   */
  t(key: keyof I18nMessages): string {
    return messages[this.currentLanguage][key] || messages[LanguageCode.EN][key] || key;
  }

  /**
   * Get all messages
   */
  getMessages(): I18nMessages {
    return messages[this.currentLanguage];
  }

  /**
   * Get OnlyOffice language code (BCP 47 standard)
   * OnlyOffice uses BCP 47 standard language codes
   * - English: 'en'
   * - Simplified Chinese (Mainland China): 'zh-CN'
   */
  getOnlyOfficeLang(): string {
    // Mapping from internal language code to OnlyOffice BCP 47 standard code
    const langMap: Record<Language, OnlyOfficeLanguageCode> = {
      [LanguageCode.ZH]: OnlyOfficeLanguageCode.ZH_CN,
      [LanguageCode.EN]: OnlyOfficeLanguageCode.EN,
    };
    return langMap[this.currentLanguage] || OnlyOfficeLanguageCode.EN;
  }
}

// Export singleton
export const i18n = new I18n();

// Export convenience functions
export const t = (key: keyof I18nMessages): string => i18n.t(key);
export const getLanguage = (): Language => i18n.getLanguage();
export const setLanguage = (lang: Language): void => i18n.setLanguage(lang);
export const getOnlyOfficeLang = (): string => i18n.getOnlyOfficeLang();
