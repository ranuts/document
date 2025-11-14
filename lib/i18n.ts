/**
 * Internationalization configuration
 */

export type Language = 'zh' | 'en';

export interface I18nMessages {
  // UI text
  webOffice: string;
  uploadDocument: string;
  newWord: string;
  newExcel: string;
  newPowerPoint: string;

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
  zh: {
    webOffice: 'Web Office',
    uploadDocument: 'Upload Document to view',
    newWord: 'New Word',
    newExcel: 'New Excel',
    newPowerPoint: 'New PowerPoint',
    fileSavedSuccess: '文件保存成功：',
    documentLoaded: '文档加载完成：',
    failedToLoadEditor: '无法加载编辑器组件。请确保已正确安装 OnlyOffice API。',
    unsupportedFileType: '不支持的文件类型：',
    invalidFileObject: '无效的文件对象',
    documentOperationFailed: '文档操作失败：',
  },
  en: {
    webOffice: 'Web Office',
    uploadDocument: 'Upload Document to view',
    newWord: 'New Word',
    newExcel: 'New Excel',
    newPowerPoint: 'New PowerPoint',
    fileSavedSuccess: 'File saved successfully: ',
    documentLoaded: 'Document loaded: ',
    failedToLoadEditor: 'Failed to load editor component. Please ensure OnlyOffice API is properly installed.',
    unsupportedFileType: 'Unsupported file type: ',
    invalidFileObject: 'Invalid file object',
    documentOperationFailed: 'Document operation failed: ',
  },
};

class I18n {
  private currentLanguage: Language = 'en';

  constructor() {
    // Read language setting from localStorage, or auto-detect from browser language
    const savedLang = localStorage.getItem('document-lang') as Language;
    if (savedLang && (savedLang === 'zh' || savedLang === 'en')) {
      this.currentLanguage = savedLang;
    } else {
      // Detect browser language
      // Extract base language code (e.g., 'en' from 'en-US', 'zh' from 'zh-CN')
      const browserLang =
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        typeof navigator !== 'undefined' && navigator.language ? navigator.language.toLowerCase() : 'en';
      const baseLang = browserLang.split('-')[0]; // Extract 'en' from 'en-US', 'zh' from 'zh-CN'
      if (baseLang === 'zh') {
        this.currentLanguage = 'zh';
      } else {
        // Default to English for any other language
        this.currentLanguage = 'en';
      }
    }
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
    if (lang === 'zh' || lang === 'en') {
      this.currentLanguage = lang;
      localStorage.setItem('document-lang', lang);
      // Trigger language change event
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
    }
  }

  /**
   * Get translated text
   */
  t(key: keyof I18nMessages): string {
    return messages[this.currentLanguage][key] || messages.en[key] || key;
  }

  /**
   * Get all messages
   */
  getMessages(): I18nMessages {
    return messages[this.currentLanguage];
  }

  /**
   * Get OnlyOffice language code
   * OnlyOffice uses standard language code format
   * English uses 'en', Chinese uses 'zh-CN'
   */
  getOnlyOfficeLang(): string {
    // OnlyOffice supported language code mapping
    const langMap: Record<Language, string> = {
      zh: 'zh-CN',
      en: 'en',
    };
    return langMap[this.currentLanguage] || 'en';
  }
}

// Export singleton
export const i18n = new I18n();

// Export convenience functions
export const t = (key: keyof I18nMessages): string => i18n.t(key);
export const getLanguage = (): Language => i18n.getLanguage();
export const setLanguage = (lang: Language): void => i18n.setLanguage(lang);
export const getOnlyOfficeLang = (): string => i18n.getOnlyOfficeLang();
