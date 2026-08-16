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

export interface I18nMessages {
  // UI text
  webOffice: string;
  uploadDocument: string;
  newWord: string;
  newExcel: string;
  newPowerPoint: string;
  menu: string;
  menuGuide: string;
  themeLabel: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;

  // Messages
  fileSavedSuccess: string;
  documentLoaded: string;

  // Error messages
  failedToLoadEditor: string;
  unsupportedFileType: string;
  invalidFileObject: string;
  documentOperationFailed: string;
  editorErrorToast: string;
  editorErrorFormatMismatch: string;
  editorErrorOpenFailed: string;

  // AI agent panel
  agentTitle: string;
  agentOpenTip: string;
  agentSettings: string;
  agentRoleUser: string;
  agentRoleTool: string;
  agentRoleError: string;
  agentProviderClaude: string;
  agentProviderOpenAI: string;
  agentProviderGemini: string;
  agentProviderLocal: string;
  agentProviderOllama: string;
  agentOllamaModelPlaceholder: string;
  agentOllamaHint: string;
  agentLoadModel: string;
  agentModelLoaded: string;
  agentCheckingCache: string;
  agentModelCached: string;
  /** `{size}` placeholder is replaced with the model's download size. */
  agentModelFirstDownload: string;
  agentNoWebGPU: string;
  agentLocalChatOnly: string;
  agentSwitchCloud: string;
  agentReviewMode: string;
  agentQuote: string;
  agentQuoteTip: string;
  agentClear: string;
  agentInputPlaceholder: string;
  agentSend: string;
  agentStop: string;
  agentNeedKey: string;
  agentNoSelection: string;
  agentQuotePrefix: string;
  agentStopped: string;
  agentMaxSteps: string;
  agentToolCallPrefix: string;
  agentToolErrorPrefix: string;
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
    themeLabel: '主题',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
    fileSavedSuccess: '文件保存成功：',
    documentLoaded: '文档加载完成：',
    failedToLoadEditor: '无法加载编辑器组件。请确保已正确安装 OnlyOffice API。',
    unsupportedFileType: '不支持的文件类型：',
    invalidFileObject: '无效的文件对象',
    documentOperationFailed: '文档操作失败：',
    editorErrorToast: '文档处理出错',
    editorErrorFormatMismatch: '文件内容与扩展名不一致，请确认文件格式后重试',
    editorErrorOpenFailed: '文件无法打开：可能已损坏、格式不受支持，或内容与扩展名不符',
    agentTitle: 'AI 助手',
    agentOpenTip: '打开 AI 助手',
    agentSettings: '设置',
    agentRoleUser: '你',
    agentRoleTool: '工具',
    agentRoleError: '错误',
    agentProviderClaude: 'Claude（云端，需 API Key）',
    agentProviderOpenAI: 'OpenAI（云端，需 API Key）',
    agentProviderGemini: 'Gemini（云端，需 API Key）',
    agentProviderLocal: '本地离线（WebLLM，需 WebGPU）',
    agentProviderOllama: 'Ollama（本地服务，需自行运行）',
    agentOllamaModelPlaceholder: '模型名，如 llama3.2',
    agentOllamaHint: '连接本地 Ollama（http://localhost:11434），无需 API Key，请确保已运行对应模型。',
    agentLoadModel: '加载模型',
    agentModelLoaded: '模型已加载，可以开始对话。',
    agentCheckingCache: '检查模型缓存…',
    agentModelCached: '该模型已缓存，点击「加载模型」秒开（刷新页面也不会重新下载）。',
    agentModelFirstDownload: '首次使用需下载（{size}），之后浏览器缓存，刷新不再下载。',
    agentNoWebGPU: '当前浏览器不支持 WebGPU，无法使用本地模式。',
    agentLocalChatOnly: '本地模型仅用于问答/改写，不会直接编辑文档。如需 AI 直接编辑文档，',
    agentSwitchCloud: '切换到云端 →',
    agentReviewMode: '修订模式',
    agentQuote: '引用选区',
    agentQuoteTip: '把当前在文档/表格/幻灯片中选中的文字引用到输入框',
    agentClear: '清空对话',
    agentInputPlaceholder: '让 AI 帮你编辑文档…（Enter 发送，Shift+Enter 换行）',
    agentSend: '发送',
    agentStop: '停止',
    agentNeedKey: '请先填写 API Key。',
    agentNoSelection: '没有检测到选中的内容，请先在文档中选择文字。',
    agentQuotePrefix: '请参考我选中的内容：',
    agentStopped: '已停止。',
    agentMaxSteps: '已达到最大执行步数，已停止。',
    agentToolCallPrefix: '调用工具：',
    agentToolErrorPrefix: '工具出错：',
  },
  [LanguageCode.EN]: {
    webOffice: 'Web Office',
    uploadDocument: 'View/Edit Document',
    newWord: 'New Word',
    newExcel: 'New Excel',
    newPowerPoint: 'New PowerPoint',
    menu: 'Menu',
    menuGuide: "Menu is in the bottom right corner, hover to view (click to close, won't show again)",
    themeLabel: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    fileSavedSuccess: 'File saved successfully: ',
    documentLoaded: 'Document loaded: ',
    failedToLoadEditor: 'Failed to load editor component. Please ensure OnlyOffice API is properly installed.',
    unsupportedFileType: 'Unsupported file type: ',
    invalidFileObject: 'Invalid file object',
    documentOperationFailed: 'Document operation failed: ',
    editorErrorToast: 'Document error',
    editorErrorFormatMismatch: 'The file content does not match its extension; check the file format and try again',
    editorErrorOpenFailed:
      'The file could not be opened: it may be corrupted, in an unsupported format, or not what its extension says',
    agentTitle: 'AI Assistant',
    agentOpenTip: 'Open AI Assistant',
    agentSettings: 'Settings',
    agentRoleUser: 'You',
    agentRoleTool: 'Tool',
    agentRoleError: 'Error',
    agentProviderClaude: 'Claude (cloud, needs API Key)',
    agentProviderOpenAI: 'OpenAI (cloud, needs API Key)',
    agentProviderGemini: 'Gemini (cloud, needs API Key)',
    agentProviderLocal: 'Local offline (WebLLM, needs WebGPU)',
    agentProviderOllama: 'Ollama (local server, run it yourself)',
    agentOllamaModelPlaceholder: 'Model name, e.g. llama3.2',
    agentOllamaHint: 'Connects to local Ollama (http://localhost:11434); no API Key — make sure the model is running.',
    agentLoadModel: 'Load model',
    agentModelLoaded: 'Model loaded — you can start chatting.',
    agentCheckingCache: 'Checking model cache…',
    agentModelCached: 'This model is cached — click "Load model" for an instant start (a refresh won\'t re-download).',
    agentModelFirstDownload:
      "First use downloads the model ({size}); it is then cached, so a refresh won't re-download.",
    agentNoWebGPU: 'This browser does not support WebGPU; local mode is unavailable.',
    agentLocalChatOnly:
      'The local model only answers and rewrites — it will not edit the document directly. For AI-driven editing, ',
    agentSwitchCloud: 'switch to cloud →',
    agentReviewMode: 'Review mode',
    agentQuote: 'Quote selection',
    agentQuoteTip: 'Quote the text currently selected in the document/spreadsheet/slide into the input',
    agentClear: 'Clear chat',
    agentInputPlaceholder: 'Ask AI to edit the document… (Enter to send, Shift+Enter for newline)',
    agentSend: 'Send',
    agentStop: 'Stop',
    agentNeedKey: 'Please enter an API Key first.',
    agentNoSelection: 'No selection detected — please select text in the document first.',
    agentQuotePrefix: 'Please consider my selected content:',
    agentStopped: 'Stopped.',
    agentMaxSteps: 'Reached the maximum number of steps; stopped.',
    agentToolCallPrefix: 'Tool call: ',
    agentToolErrorPrefix: 'Tool error: ',
  },
};

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
    if (normalized === 'zh') return LanguageCode.ZH;
    if (normalized === 'en') return LanguageCode.EN;
    return null;
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
    const savedLang = localStorageGetItem('document-lang') as Language;
    if (savedLang && (savedLang === LanguageCode.ZH || savedLang === LanguageCode.EN)) {
      if (!detectedLang) detectedLang = savedLang;
      if (!editorLocale) editorLocale = savedLang === LanguageCode.ZH ? OnlyOfficeLanguageCode.ZH_CN : 'en';
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
    if (lang === LanguageCode.ZH || lang === LanguageCode.EN) {
      this.currentLanguage = lang;
      // An explicit shell choice also decides the editor language.
      this.editorLocale = lang === LanguageCode.ZH ? OnlyOfficeLanguageCode.ZH_CN : OnlyOfficeLanguageCode.EN;
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
export const t = (key: keyof I18nMessages): string => i18n.t(key);
export const getLanguage = (): Language => i18n.getLanguage();
export const setLanguage = (lang: Language): void => i18n.setLanguage(lang);
export const getOnlyOfficeLang = (): string => i18n.getOnlyOfficeLang();
