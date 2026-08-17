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
  FA = 'fa',
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
 * Shell languages, in the order the language menu shows them. English and
 * Chinese are complete; the others translate the core UI and fall back to
 * English per missing key (see `messages` below and `t()`).
 */
export const SHELL_LOCALES: readonly Language[] = [
  LanguageCode.EN,
  LanguageCode.ZH,
  LanguageCode.JA,
  LanguageCode.KO,
  LanguageCode.DE,
  LanguageCode.ES,
  LanguageCode.PT,
  LanguageCode.FA,
];

/** Right-to-left shell languages (drives `<html dir>`, see applyDocumentLanguage). */
export const RTL_LANGUAGES: readonly Language[] = [LanguageCode.FA];

export const isRtlLanguage = (lang: Language): boolean => RTL_LANGUAGES.includes(lang);

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

/**
 * en and zh are complete (`I18nMessages`); every other locale is a partial
 * table -- a missing key falls back to English in `t()`. That keeps adding a
 * new UI string a two-language change instead of an eight-language one, and
 * an untranslated string shows in English rather than as a raw key. The
 * experimental agent panel (`agent*`, opt-in via ?agent=1) is deliberately
 * English-only outside en/zh until someone reviews those translations.
 */
const completeMessages: Record<LanguageCode.ZH | LanguageCode.EN, I18nMessages> = {
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

/** Core shell strings for the remaining locales (machine-drafted, reviewed for tone). */
const partialMessages: Record<Exclude<Language, LanguageCode.ZH | LanguageCode.EN>, Partial<I18nMessages>> = {
  [LanguageCode.JA]: {
    webOffice: 'Web Office',
    uploadDocument: 'ドキュメントを開く / 編集',
    newWord: 'Word を新規作成',
    newExcel: 'Excel を新規作成',
    newPowerPoint: 'PowerPoint を新規作成',
    menu: 'メニュー',
    menuGuide: 'メニューは右下にあります。カーソルを合わせると開きます（閉じると次回から表示されません）',
    themeLabel: 'テーマ',
    themeSystem: 'システム',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    fileSavedSuccess: 'ファイルを保存しました: ',
    documentLoaded: 'ドキュメントを読み込みました: ',
    failedToLoadEditor: 'エディターを読み込めませんでした。OnlyOffice API が正しく配置されているか確認してください。',
    unsupportedFileType: 'サポートされていないファイル形式: ',
    invalidFileObject: '無効なファイルです',
    documentOperationFailed: 'ドキュメントの操作に失敗しました: ',
    editorErrorToast: 'ドキュメントエラー',
    editorErrorFormatMismatch: 'ファイルの内容が拡張子と一致しません。形式を確認してからもう一度お試しください',
    editorErrorOpenFailed:
      'ファイルを開けませんでした。破損しているか、サポートされていない形式か、拡張子と内容が異なる可能性があります',
  },
  [LanguageCode.KO]: {
    webOffice: 'Web Office',
    uploadDocument: '문서 열기 / 편집',
    newWord: '새 Word 문서',
    newExcel: '새 Excel 문서',
    newPowerPoint: '새 PowerPoint 문서',
    menu: '메뉴',
    menuGuide: '메뉴는 오른쪽 아래에 있습니다. 마우스를 올리면 열립니다(닫으면 다시 표시되지 않습니다)',
    themeLabel: '테마',
    themeSystem: '시스템',
    themeLight: '라이트',
    themeDark: '다크',
    fileSavedSuccess: '파일을 저장했습니다: ',
    documentLoaded: '문서를 불러왔습니다: ',
    failedToLoadEditor: '편집기를 불러오지 못했습니다. OnlyOffice API가 올바르게 설치되어 있는지 확인하세요.',
    unsupportedFileType: '지원하지 않는 파일 형식: ',
    invalidFileObject: '잘못된 파일입니다',
    documentOperationFailed: '문서 작업에 실패했습니다: ',
    editorErrorToast: '문서 오류',
    editorErrorFormatMismatch: '파일 내용이 확장자와 일치하지 않습니다. 형식을 확인한 뒤 다시 시도하세요',
    editorErrorOpenFailed:
      '파일을 열 수 없습니다. 손상되었거나, 지원하지 않는 형식이거나, 확장자와 내용이 다를 수 있습니다',
  },
  [LanguageCode.DE]: {
    webOffice: 'Web Office',
    uploadDocument: 'Dokument öffnen / bearbeiten',
    newWord: 'Neues Word-Dokument',
    newExcel: 'Neue Excel-Tabelle',
    newPowerPoint: 'Neue PowerPoint-Präsentation',
    menu: 'Menü',
    menuGuide:
      'Das Menü ist unten rechts – zum Öffnen mit der Maus darauf zeigen (nach dem Schließen wird dieser Hinweis nicht mehr angezeigt)',
    themeLabel: 'Design',
    themeSystem: 'System',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    fileSavedSuccess: 'Datei gespeichert: ',
    documentLoaded: 'Dokument geladen: ',
    failedToLoadEditor:
      'Der Editor konnte nicht geladen werden. Bitte prüfen, ob die OnlyOffice-API korrekt eingebunden ist.',
    unsupportedFileType: 'Nicht unterstützter Dateityp: ',
    invalidFileObject: 'Ungültige Datei',
    documentOperationFailed: 'Dokumentvorgang fehlgeschlagen: ',
    editorErrorToast: 'Dokumentfehler',
    editorErrorFormatMismatch:
      'Der Inhalt der Datei passt nicht zur Dateiendung – bitte das Format prüfen und erneut versuchen',
    editorErrorOpenFailed:
      'Die Datei konnte nicht geöffnet werden: möglicherweise beschädigt, in einem nicht unterstützten Format, oder der Inhalt passt nicht zur Endung',
  },
  [LanguageCode.ES]: {
    webOffice: 'Web Office',
    uploadDocument: 'Abrir / editar documento',
    newWord: 'Nuevo documento de Word',
    newExcel: 'Nueva hoja de Excel',
    newPowerPoint: 'Nueva presentación de PowerPoint',
    menu: 'Menú',
    menuGuide:
      'El menú está abajo a la derecha: pasa el cursor para abrirlo (si lo cierras, no volverá a mostrarse este aviso)',
    themeLabel: 'Tema',
    themeSystem: 'Sistema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    fileSavedSuccess: 'Archivo guardado: ',
    documentLoaded: 'Documento cargado: ',
    failedToLoadEditor: 'No se pudo cargar el editor. Comprueba que la API de OnlyOffice esté instalada correctamente.',
    unsupportedFileType: 'Tipo de archivo no admitido: ',
    invalidFileObject: 'Archivo no válido',
    documentOperationFailed: 'Error al procesar el documento: ',
    editorErrorToast: 'Error del documento',
    editorErrorFormatMismatch:
      'El contenido del archivo no coincide con su extensión; comprueba el formato e inténtalo de nuevo',
    editorErrorOpenFailed:
      'No se pudo abrir el archivo: puede estar dañado, tener un formato no admitido o no corresponder a su extensión',
  },
  [LanguageCode.PT]: {
    webOffice: 'Web Office',
    uploadDocument: 'Abrir / editar documento',
    newWord: 'Novo documento do Word',
    newExcel: 'Nova planilha do Excel',
    newPowerPoint: 'Nova apresentação do PowerPoint',
    menu: 'Menu',
    menuGuide:
      'O menu fica no canto inferior direito: passe o cursor para abrir (ao fechar, este aviso não aparece novamente)',
    themeLabel: 'Tema',
    themeSystem: 'Sistema',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    fileSavedSuccess: 'Arquivo salvo: ',
    documentLoaded: 'Documento carregado: ',
    failedToLoadEditor: 'Não foi possível carregar o editor. Verifique se a API do OnlyOffice está instalada.',
    unsupportedFileType: 'Tipo de arquivo não suportado: ',
    invalidFileObject: 'Arquivo inválido',
    documentOperationFailed: 'Falha na operação do documento: ',
    editorErrorToast: 'Erro no documento',
    editorErrorFormatMismatch:
      'O conteúdo do arquivo não corresponde à extensão; verifique o formato e tente novamente',
    editorErrorOpenFailed:
      'Não foi possível abrir o arquivo: ele pode estar corrompido, em formato não suportado ou não corresponder à extensão',
  },
  [LanguageCode.FA]: {
    webOffice: 'Web Office',
    uploadDocument: 'باز کردن / ویرایش سند',
    newWord: 'سند Word جدید',
    newExcel: 'کاربرگ Excel جدید',
    newPowerPoint: 'ارائهٔ PowerPoint جدید',
    menu: 'منو',
    menuGuide:
      'منو در گوشهٔ پایین سمت راست است؛ نشانگر را روی آن ببرید تا باز شود (پس از بستن دیگر نمایش داده نمی‌شود)',
    themeLabel: 'پوسته',
    themeSystem: 'سیستم',
    themeLight: 'روشن',
    themeDark: 'تیره',
    fileSavedSuccess: 'فایل ذخیره شد: ',
    documentLoaded: 'سند بارگذاری شد: ',
    failedToLoadEditor: 'ویرایشگر بارگذاری نشد. مطمئن شوید OnlyOffice API درست نصب شده است.',
    unsupportedFileType: 'نوع فایل پشتیبانی نمی‌شود: ',
    invalidFileObject: 'فایل نامعتبر است',
    documentOperationFailed: 'عملیات روی سند ناموفق بود: ',
    editorErrorToast: 'خطای سند',
    editorErrorFormatMismatch: 'محتوای فایل با پسوند آن هم‌خوانی ندارد؛ قالب را بررسی و دوباره تلاش کنید',
    editorErrorOpenFailed: 'فایل باز نشد: ممکن است خراب باشد، قالب آن پشتیبانی نشود، یا با پسوندش هم‌خوانی نداشته باشد',
  },
};

const messages: Record<Language, Partial<I18nMessages>> = { ...completeMessages, ...partialMessages };

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
  t(key: keyof I18nMessages): string {
    // Partial locales fall back to English key by key (see `messages`).
    return messages[this.currentLanguage]?.[key] || completeMessages[LanguageCode.EN][key] || key;
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
export const t = (key: keyof I18nMessages): string => i18n.t(key);
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
