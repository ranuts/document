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
  editorErrorOutOfMemory: string;
  editorOpenRetrying: string;

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

  // Local history: autosave and the history page
  autosaveStopped: string;
  historyChip: string;
  historyTitle: string;
  historyIntro: string;
  historyColDocument: string;
  historyColEdited: string;
  historyColSize: string;
  historyColExpires: string;
  historyNotBackup: string;
  historySearchPlaceholder: string;
  historyEmptyTitle: string;
  historyEmpty: string;
  historyEmptySearchTitle: string;
  historyEmptySearch: string;
  historyClearSearch: string;
  historyOpen: string;
  historyDelete: string;
  historyCancel: string;
  historyDeleteTitle: string;
  historyClearTitle: string;
  /** `{title}` is the file name. */
  historyDeleteConfirm: string;
  historyClearAll: string;
  historyClearConfirm: string;
  historyUnsaved: string;
  /** `{size}` is a human-readable byte size. */
  historyUsage: string;
  /** `{count}` is the number of documents currently stored. */
  historyCount: string;
  /** `{page}` and `{pages}` are 1-based page numbers. */
  historyPageInfo: string;
  historyPrev: string;
  historyNext: string;
  historyBack: string;
  historyAutosaveLabel: string;
  historyAutosaveOff: string;
  historyRetention: string;
  /** `{days}` is a whole number of days, always 2 or more (see historyExpiresInOne). */
  historyExpiresIn: string;
  historyExpiresInOne: string;
  historyExpiresToday: string;
  /** Row action: write this snapshot straight to disk, without opening it. */
  historyDownload: string;
  historyDownloadFailed: string;
  /** Toolbar filter: only the documents that were never exported to disk. */
  historyOnlyUnsaved: string;
  historyOpenFile: string;
  historyRailSettings: string;
  historyRailRetention: string;
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
    editorErrorOutOfMemory:
      '浏览器无法为文档转换引擎分配内存（需要约 {mb} MB）。请关闭其他标签页或窗口后重试；若仍失败，请改用 64 位浏览器（Edge 或 64 位 Chrome）。',
    editorOpenRetrying: '打开文档时编辑器未就绪，正在自动重试…',
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

    autosaveStopped:
      '自动保存已停止：浏览器没有可用的存储空间了。请导出保存这篇文档，并到本机文档列表里删掉一些旧文件。',
    historyChip: '本机存储 · 从不上传',
    historyTitle: '本机保存的文档',
    historyIntro:
      '你编辑过的文档，副本保存在这台设备的浏览器里——刷新、误关标签页、浏览器崩溃之后都能找回。这些内容从未上传。',
    historyColDocument: '文档',
    historyColEdited: '最后编辑',
    historyColSize: '大小',
    historyColExpires: '自动删除',
    historyNotBackup: '这些副本是为了让你接着做没做完的事，不是备份——想长期保留，请导出保存到电脑。',
    historySearchPlaceholder: '按文件名搜索',
    historyEmptyTitle: '这里还是空的',
    historyEmpty: '你在本站编辑过的文档会自动出现在这里，不需要手动保存。',
    historyEmptySearchTitle: '没有匹配的文档',
    historyEmptySearch: '没有文件名包含这段文字的文档。',
    historyClearSearch: '清除搜索',
    historyOpen: '打开',
    historyDelete: '删除',
    historyCancel: '取消',
    historyDeleteTitle: '删除这篇文档',
    historyClearTitle: '删除全部文档',
    historyDeleteConfirm: '删除「{title}」及其全部保存副本？此操作不可撤销。',
    historyClearAll: '全部删除',
    historyClearConfirm: '删除这台设备上保存的全部文档副本？此操作不可撤销。',
    historyUnsaved: '未导出',
    historyUsage: '占用 {size}',
    historyCount: '{count} 篇文档',
    historyPageInfo: '第 {page} / {pages} 页',
    historyPrev: '上一页',
    historyNext: '下一页',
    historyBack: '打开编辑器',
    historyAutosaveLabel: '自动保存',
    historyAutosaveOff: '自动保存已关闭：现在编辑的内容不会再被保存，关掉页面就没有了。',
    historyRetention: '每篇文档会在你最后一次编辑或打开的 7 天后自动删除。你也可以随时在这里手动删除，删除立即生效。',
    historyDownload: '下载副本',
    historyDownloadFailed: '这份副本没能保存到磁盘。',
    historyOnlyUnsaved: '只看未导出',
    historyOpenFile: '打开文件',
    historyRailSettings: '设置',
    historyRailRetention: '保留规则',
    historyExpiresIn: '剩 {days} 天',
    historyExpiresInOne: '剩 1 天',
    historyExpiresToday: '今天',
  },
  [LanguageCode.EN]: {
    webOffice: 'Web Office',
    uploadDocument: 'View/Edit Document',
    newWord: 'New Word',
    newExcel: 'New Excel',
    newPowerPoint: 'New PowerPoint',
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
    editorErrorOutOfMemory:
      'This browser could not allocate memory for the document conversion engine (about {mb} MB). Close other tabs or windows and try again; if it keeps failing, use a 64-bit browser (Edge, or 64-bit Chrome).',
    editorOpenRetrying: 'The editor was not ready when the document opened; retrying automatically...',
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

    autosaveStopped:
      'Autosave stopped: this browser is out of storage room. Export this document, then delete a few old ones from your saved documents.',
    historyChip: 'On this device · never uploaded',
    historyTitle: 'Saved documents',
    historyIntro:
      'Copies of the documents you edited, kept in this browser on this device, so a refresh, a closed tab or a crash cannot cost you the work. None of this was uploaded.',
    historyColDocument: 'Document',
    historyColEdited: 'Last edited',
    historyColSize: 'Size',
    historyColExpires: 'Auto-deletes',
    historyNotBackup:
      'These copies exist so you can pick up work you were in the middle of. They are not a backup -- export anything you want to keep.',
    historySearchPlaceholder: 'Search by file name',
    historyEmptyTitle: 'Nothing saved yet',
    historyEmpty: 'Documents you edit here show up in this list on their own -- there is nothing to save by hand.',
    historyEmptySearchTitle: 'No matches',
    historyEmptySearch: 'No file name contains that text.',
    historyClearSearch: 'Clear search',
    historyOpen: 'Open',
    historyDelete: 'Delete',
    historyCancel: 'Cancel',
    historyDeleteTitle: 'Delete this document',
    historyClearTitle: 'Delete everything',
    historyDeleteConfirm: 'Delete "{title}" and every saved copy of it? This cannot be undone.',
    historyClearAll: 'Delete all',
    historyClearConfirm: 'Delete every document copy saved on this device? This cannot be undone.',
    historyUnsaved: 'not exported',
    historyUsage: '{size} used',
    historyCount: '{count} documents',
    historyPageInfo: 'Page {page} of {pages}',
    historyPrev: 'Previous',
    historyNext: 'Next',
    historyBack: 'Open the editor',
    historyAutosaveLabel: 'Autosave',
    historyAutosaveOff: 'Autosave is off: what you edit now is not being saved, and closing the page will lose it.',
    historyRetention:
      'Each document is deleted automatically 7 days after you last edited or opened it. You can also delete anything here yourself, and that takes effect immediately.',
    historyExpiresIn: '{days} days left',
    historyExpiresInOne: '1 day left',
    historyExpiresToday: 'today',
    historyDownload: 'Download',
    historyDownloadFailed: 'That copy could not be saved to disk.',
    historyOnlyUnsaved: 'Not exported',
    historyOpenFile: 'Open a file',
    historyRailSettings: 'Settings',
    historyRailRetention: 'Retention',
  },
};

/**
 * The remaining locales. Complete tables, same as en/zh -- the agent panel and
 * the saved-documents page used to be English here and are not any more.
 *
 * Interpolation placeholders ({size}, {title}, {when}, {days}, {count},
 * {page}, {pages}) have to survive translation verbatim; message-placeholders
 * cases in test/unit/i18n.test.ts check that. Persian is RTL, so its arrow
 * glyphs point the other way (see agentSwitchCloud).
 */
const partialMessages: Record<Exclude<Language, LanguageCode.ZH | LanguageCode.EN>, Partial<I18nMessages>> = {
  [LanguageCode.JA]: {
    webOffice: 'Web Office',
    uploadDocument: 'ドキュメントを開く / 編集',
    newWord: 'Word を新規作成',
    newExcel: 'Excel を新規作成',
    newPowerPoint: 'PowerPoint を新規作成',
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
    editorErrorOutOfMemory:
      'このブラウザーは文書変換エンジン用のメモリ (約 {mb} MB) を確保できませんでした。他のタブやウィンドウを閉じてから再試行してください。解決しない場合は 64 ビットのブラウザー (Edge または 64 ビット版 Chrome) をご利用ください。',
    editorOpenRetrying: 'ドキュメントを開いたときにエディターの準備が整っていませんでした。自動的に再試行しています…',
    agentTitle: 'AI アシスタント',
    agentOpenTip: 'AI アシスタントを開く',
    agentSettings: '設定',
    agentRoleUser: 'あなた',
    agentRoleTool: 'ツール',
    agentRoleError: 'エラー',
    agentProviderClaude: 'Claude（クラウド、API キーが必要）',
    agentProviderOpenAI: 'OpenAI（クラウド、API キーが必要）',
    agentProviderGemini: 'Gemini（クラウド、API キーが必要）',
    agentProviderLocal: 'ローカル（WebLLM、WebGPU が必要）',
    agentProviderOllama: 'Ollama（ローカルサーバー、ご自身で起動）',
    agentOllamaModelPlaceholder: 'モデル名（例：llama3.2）',
    agentOllamaHint:
      'ローカルの Ollama（http://localhost:11434）に接続します。API キーは不要ですが、モデルが起動していることをご確認ください。',
    agentLoadModel: 'モデルを読み込む',
    agentModelLoaded: 'モデルを読み込みました。チャットを始められます。',
    agentCheckingCache: 'モデルのキャッシュを確認しています…',
    agentModelCached:
      'このモデルはキャッシュ済みです。「モデルを読み込む」ですぐに始められます（再読み込みしても再ダウンロードされません）。',
    agentModelFirstDownload:
      '初回はモデル（{size}）をダウンロードします。以降はキャッシュされるため、再読み込みしても再ダウンロードされません。',
    agentNoWebGPU: 'このブラウザーは WebGPU に対応していないため、ローカルモードは使用できません。',
    agentLocalChatOnly: 'ローカルモデルは回答と書き換えのみを行い、ドキュメントを直接編集しません。AI に編集させるには',
    agentSwitchCloud: 'クラウドに切り替え →',
    agentReviewMode: '変更履歴モード',
    agentQuote: '選択範囲を引用',
    agentQuoteTip: 'ドキュメント・スプレッドシート・スライドで選択中のテキストを入力欄に引用します',
    agentClear: 'チャットを消去',
    agentInputPlaceholder: 'AI にドキュメントの編集を依頼…（Enter で送信、Shift+Enter で改行）',
    agentSend: '送信',
    agentStop: '停止',
    agentNeedKey: '先に API キーを入力してください。',
    agentNoSelection: '選択範囲が見つかりません。先にドキュメント内のテキストを選択してください。',
    agentQuotePrefix: '選択した内容を踏まえてください：',
    agentStopped: '停止しました。',
    agentMaxSteps: '最大ステップ数に達したため停止しました。',
    agentToolCallPrefix: 'ツール呼び出し：',
    agentToolErrorPrefix: 'ツールエラー：',
    autosaveStopped:
      '自動保存を停止しました。このブラウザーの保存容量が不足しています。このドキュメントを書き出してから、保存済みドキュメントをいくつか削除してください。',
    historyTitle: '保存済みドキュメント',
    historyIntro:
      '編集したドキュメントの控えを、この端末のこのブラウザー内に保管しています。再読み込みしても、タブを閉じても、クラッシュしても作業が失われません。いずれもアップロードされていません。',
    historyColDocument: 'ドキュメント',
    historyColEdited: '最終編集',
    historyColSize: 'サイズ',
    historyColExpires: '自動削除',
    historyNotBackup:
      'この控えは作業を再開するためのものであり、バックアップではありません。残しておきたいものは書き出してください。',
    historySearchPlaceholder: 'ファイル名で検索',
    historyEmpty: 'まだ何も保存されていません。ここで編集したドキュメントは、自動的にこの一覧に表示されます。',
    historyEmptySearch: '該当するファイル名はありません。',
    historyOpen: '開く',
    historyDelete: '削除',
    historyDeleteConfirm: '「{title}」と、その保存済みの控えをすべて削除しますか？この操作は取り消せません。',
    historyClearAll: 'すべて削除',
    historyClearConfirm: 'この端末に保存されているドキュメントの控えをすべて削除しますか？この操作は取り消せません。',
    historyUnsaved: '未書き出し',
    historyUsage: '{size} 使用中',
    historyCount: '{count} 件のドキュメント',
    historyPageInfo: '{pages} ページ中 {page} ページ目',
    historyPrev: '前へ',
    historyNext: '次へ',
    historyBack: 'エディターを開く',
    historyAutosaveLabel: '自動保存',
    historyAutosaveOff: '自動保存はオフです。いま編集している内容は保存されず、ページを閉じると失われます。',
    historyRetention:
      '各ドキュメントは、最後に編集または開いた日から 7 日後に自動的に削除されます。ここから手動で削除することもでき、その場合はすぐに反映されます。',
    historyExpiresIn: '残り {days} 日',
    historyExpiresInOne: '残り 1 日',
    historyExpiresToday: '本日',
    historyDownload: 'ダウンロード',
    historyDownloadFailed: 'そのコピーをディスクに保存できませんでした。',
    historyOnlyUnsaved: '未書き出し',
    historyOpenFile: 'ファイルを開く',
    historyRailSettings: '設定',
    historyRailRetention: '保存期間',
    historyCancel: 'キャンセル',
    historyChip: 'この端末内 · アップロードなし',
    historyEmptyTitle: 'まだ何も保存されていません',
    historyEmptySearchTitle: '該当なし',
    historyClearSearch: '検索をクリア',
    historyDeleteTitle: 'このドキュメントを削除',
    historyClearTitle: 'すべて削除',
  },
  [LanguageCode.KO]: {
    webOffice: 'Web Office',
    uploadDocument: '문서 열기 / 편집',
    newWord: '새 Word 문서',
    newExcel: '새 Excel 문서',
    newPowerPoint: '새 PowerPoint 문서',
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
    editorErrorOutOfMemory:
      '이 브라우저에서 문서 변환 엔진에 필요한 메모리(약 {mb} MB)를 할당할 수 없습니다. 다른 탭이나 창을 닫고 다시 시도하세요. 계속 실패하면 64비트 브라우저(Edge 또는 64비트 Chrome)를 사용하세요.',
    editorOpenRetrying: '문서를 여는 동안 편집기가 아직 준비되지 않았습니다. 자동으로 다시 시도하는 중입니다…',
    agentTitle: 'AI 어시스턴트',
    agentOpenTip: 'AI 어시스턴트 열기',
    agentSettings: '설정',
    agentRoleUser: '나',
    agentRoleTool: '도구',
    agentRoleError: '오류',
    agentProviderClaude: 'Claude (클라우드, API 키 필요)',
    agentProviderOpenAI: 'OpenAI (클라우드, API 키 필요)',
    agentProviderGemini: 'Gemini (클라우드, API 키 필요)',
    agentProviderLocal: '로컬 오프라인 (WebLLM, WebGPU 필요)',
    agentProviderOllama: 'Ollama (로컬 서버, 직접 실행)',
    agentOllamaModelPlaceholder: '모델 이름 (예: llama3.2)',
    agentOllamaHint:
      '로컬 Ollama(http://localhost:11434)에 연결합니다. API 키는 필요 없지만 모델이 실행 중인지 확인하세요.',
    agentLoadModel: '모델 불러오기',
    agentModelLoaded: '모델을 불러왔습니다. 대화를 시작하세요.',
    agentCheckingCache: '모델 캐시를 확인하는 중…',
    agentModelCached:
      "이 모델은 이미 캐시되어 있습니다. '모델 불러오기'를 누르면 바로 시작됩니다(새로 고침해도 다시 내려받지 않습니다).",
    agentModelFirstDownload:
      '처음 사용할 때 모델({size})을 내려받습니다. 이후에는 캐시되므로 새로 고침해도 다시 내려받지 않습니다.',
    agentNoWebGPU: '이 브라우저는 WebGPU를 지원하지 않아 로컬 모드를 사용할 수 없습니다.',
    agentLocalChatOnly:
      '로컬 모델은 답변과 다시 쓰기만 하며 문서를 직접 편집하지 않습니다. AI가 문서를 편집하게 하려면 ',
    agentSwitchCloud: '클라우드로 전환 →',
    agentReviewMode: '변경 내용 추적',
    agentQuote: '선택 영역 인용',
    agentQuoteTip: '문서·스프레드시트·슬라이드에서 선택한 텍스트를 입력창에 인용합니다',
    agentClear: '대화 지우기',
    agentInputPlaceholder: 'AI에게 문서 편집을 요청하세요… (Enter로 전송, Shift+Enter로 줄바꿈)',
    agentSend: '보내기',
    agentStop: '중지',
    agentNeedKey: '먼저 API 키를 입력하세요.',
    agentNoSelection: '선택한 영역이 없습니다. 문서에서 텍스트를 먼저 선택하세요.',
    agentQuotePrefix: '선택한 내용을 참고해 주세요:',
    agentStopped: '중지했습니다.',
    agentMaxSteps: '최대 단계 수에 도달하여 중지했습니다.',
    agentToolCallPrefix: '도구 호출: ',
    agentToolErrorPrefix: '도구 오류: ',
    autosaveStopped:
      '자동 저장이 중지되었습니다. 이 브라우저의 저장 공간이 부족합니다. 이 문서를 내보낸 뒤 저장된 문서 몇 개를 삭제하세요.',
    historyTitle: '저장된 문서',
    historyIntro:
      '편집한 문서의 사본을 이 기기의 이 브라우저 안에 보관합니다. 새로 고침하거나 탭을 닫거나 브라우저가 멈춰도 작업을 잃지 않습니다. 어느 것도 업로드되지 않았습니다.',
    historyColDocument: '문서',
    historyColEdited: '마지막 편집',
    historyColSize: '크기',
    historyColExpires: '자동 삭제',
    historyNotBackup: '이 사본은 하던 작업을 이어가기 위한 것으로, 백업이 아닙니다. 보관하려면 내보내세요.',
    historySearchPlaceholder: '파일 이름으로 검색',
    historyEmpty: '아직 저장된 것이 없습니다. 여기서 편집한 문서는 자동으로 이 목록에 나타납니다.',
    historyEmptySearch: '검색과 일치하는 파일 이름이 없습니다.',
    historyOpen: '열기',
    historyDelete: '삭제',
    historyDeleteConfirm: "'{title}'과(와) 저장된 모든 사본을 삭제할까요? 되돌릴 수 없습니다.",
    historyClearAll: '모두 삭제',
    historyClearConfirm: '이 기기에 저장된 모든 문서 사본을 삭제할까요? 되돌릴 수 없습니다.',
    historyUnsaved: '내보내지 않음',
    historyUsage: '{size} 사용 중',
    historyCount: '문서 {count}개',
    historyPageInfo: '{pages}페이지 중 {page}페이지',
    historyPrev: '이전',
    historyNext: '다음',
    historyBack: '편집기 열기',
    historyAutosaveLabel: '자동 저장',
    historyAutosaveOff: '자동 저장이 꺼져 있습니다. 지금 편집하는 내용은 저장되지 않으며 페이지를 닫으면 사라집니다.',
    historyRetention:
      '각 문서는 마지막으로 편집하거나 연 날로부터 7일 뒤에 자동으로 삭제됩니다. 여기서 직접 삭제할 수도 있으며 이 경우 즉시 적용됩니다.',
    historyExpiresIn: '{days}일 남음',
    historyExpiresInOne: '1일 남음',
    historyExpiresToday: '오늘',
    historyDownload: '다운로드',
    historyDownloadFailed: '해당 사본을 디스크에 저장하지 못했습니다.',
    historyOnlyUnsaved: '내보내지 않음',
    historyOpenFile: '파일 열기',
    historyRailSettings: '설정',
    historyRailRetention: '보관 기간',
    historyCancel: '취소',
    historyChip: '이 기기에만 · 업로드 없음',
    historyEmptyTitle: '아직 저장된 것이 없습니다',
    historyEmptySearchTitle: '검색 결과 없음',
    historyClearSearch: '검색 지우기',
    historyDeleteTitle: '이 문서 삭제',
    historyClearTitle: '전체 삭제',
  },
  [LanguageCode.DE]: {
    webOffice: 'Web Office',
    uploadDocument: 'Dokument öffnen / bearbeiten',
    newWord: 'Neues Word-Dokument',
    newExcel: 'Neue Excel-Tabelle',
    newPowerPoint: 'Neue PowerPoint-Präsentation',
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
    editorErrorOutOfMemory:
      'Dieser Browser konnte keinen Speicher für die Konvertierungs-Engine belegen (etwa {mb} MB). Schließen Sie andere Tabs oder Fenster und versuchen Sie es erneut; falls es weiterhin fehlschlägt, verwenden Sie einen 64-Bit-Browser (Edge oder 64-Bit-Chrome).',
    editorOpenRetrying:
      'Der Editor war beim Öffnen des Dokuments noch nicht bereit; es wird automatisch erneut versucht …',
    agentTitle: 'KI-Assistent',
    agentOpenTip: 'KI-Assistenten öffnen',
    agentSettings: 'Einstellungen',
    agentRoleUser: 'Sie',
    agentRoleTool: 'Werkzeug',
    agentRoleError: 'Fehler',
    agentProviderClaude: 'Claude (Cloud, API-Schlüssel erforderlich)',
    agentProviderOpenAI: 'OpenAI (Cloud, API-Schlüssel erforderlich)',
    agentProviderGemini: 'Gemini (Cloud, API-Schlüssel erforderlich)',
    agentProviderLocal: 'Lokal und offline (WebLLM, WebGPU erforderlich)',
    agentProviderOllama: 'Ollama (lokaler Server, selbst gestartet)',
    agentOllamaModelPlaceholder: 'Modellname, z. B. llama3.2',
    agentOllamaHint:
      'Verbindet sich mit dem lokalen Ollama (http://localhost:11434); kein API-Schlüssel nötig – achten Sie darauf, dass das Modell läuft.',
    agentLoadModel: 'Modell laden',
    agentModelLoaded: 'Modell geladen – Sie können loslegen.',
    agentCheckingCache: 'Modell-Cache wird geprüft …',
    agentModelCached:
      'Dieses Modell liegt bereits im Cache – ein Klick auf „Modell laden“ startet sofort (ein Neuladen lädt es nicht erneut herunter).',
    agentModelFirstDownload:
      'Beim ersten Mal wird das Modell heruntergeladen ({size}); danach liegt es im Cache, ein Neuladen lädt es nicht erneut herunter.',
    agentNoWebGPU: 'Dieser Browser unterstützt kein WebGPU; der lokale Modus steht nicht zur Verfügung.',
    agentLocalChatOnly:
      'Das lokale Modell antwortet und formuliert um – es bearbeitet das Dokument nicht selbst. Für KI-gestütztes Bearbeiten ',
    agentSwitchCloud: 'zur Cloud wechseln →',
    agentReviewMode: 'Änderungen nachverfolgen',
    agentQuote: 'Auswahl zitieren',
    agentQuoteTip: 'Den im Dokument, in der Tabelle oder auf der Folie ausgewählten Text in die Eingabe übernehmen',
    agentClear: 'Verlauf löschen',
    agentInputPlaceholder: 'Die KI um eine Änderung am Dokument bitten … (Enter sendet, Umschalt+Enter für neue Zeile)',
    agentSend: 'Senden',
    agentStop: 'Anhalten',
    agentNeedKey: 'Bitte zuerst einen API-Schlüssel eingeben.',
    agentNoSelection: 'Keine Auswahl erkannt – bitte zuerst Text im Dokument markieren.',
    agentQuotePrefix: 'Bitte berücksichtige den von mir markierten Inhalt:',
    agentStopped: 'Angehalten.',
    agentMaxSteps: 'Maximale Anzahl an Schritten erreicht; angehalten.',
    agentToolCallPrefix: 'Werkzeugaufruf: ',
    agentToolErrorPrefix: 'Werkzeugfehler: ',
    autosaveStopped:
      'Automatisches Speichern angehalten: In diesem Browser ist kein Speicherplatz mehr frei. Exportieren Sie dieses Dokument und löschen Sie dann einige ältere aus Ihren gespeicherten Dokumenten.',
    historyTitle: 'Gespeicherte Dokumente',
    historyIntro:
      'Kopien der Dokumente, die Sie bearbeitet haben – in diesem Browser auf diesem Gerät, damit ein Neuladen, ein geschlossener Tab oder ein Absturz die Arbeit nicht kostet. Nichts davon wurde hochgeladen.',
    historyColDocument: 'Dokument',
    historyColEdited: 'Zuletzt bearbeitet',
    historyColSize: 'Größe',
    historyColExpires: 'Wird gelöscht',
    historyNotBackup:
      'Diese Kopien sind dazu da, angefangene Arbeit wieder aufzunehmen. Sie sind keine Sicherung – exportieren Sie alles, was Sie behalten möchten.',
    historySearchPlaceholder: 'Nach Dateiname suchen',
    historyEmpty: 'Noch nichts gespeichert. Dokumente, die Sie hier bearbeiten, erscheinen von selbst in dieser Liste.',
    historyEmptySearch: 'Kein Dateiname passt zu dieser Suche.',
    historyOpen: 'Öffnen',
    historyDelete: 'Löschen',
    historyDeleteConfirm:
      '„{title}“ und alle gespeicherten Kopien davon löschen? Das lässt sich nicht rückgängig machen.',
    historyClearAll: 'Alle löschen',
    historyClearConfirm:
      'Alle auf diesem Gerät gespeicherten Dokumentkopien löschen? Das lässt sich nicht rückgängig machen.',
    historyUnsaved: 'nicht exportiert',
    historyUsage: '{size} belegt',
    historyCount: '{count} Dokumente',
    historyPageInfo: 'Seite {page} von {pages}',
    historyPrev: 'Zurück',
    historyNext: 'Weiter',
    historyBack: 'Editor öffnen',
    historyAutosaveLabel: 'Automatisch speichern',
    historyAutosaveOff:
      'Automatisches Speichern ist aus: Was Sie jetzt bearbeiten, wird nicht gespeichert und geht beim Schließen der Seite verloren.',
    historyRetention:
      'Jedes Dokument wird 7 Tage nach der letzten Bearbeitung oder Öffnung automatisch gelöscht. Sie können hier auch selbst löschen – das wirkt sofort.',
    historyExpiresIn: 'noch {days} Tage',
    historyExpiresInOne: 'noch 1 Tag',
    historyExpiresToday: 'heute',
    historyDownload: 'Herunterladen',
    historyDownloadFailed: 'Diese Kopie konnte nicht auf der Festplatte gespeichert werden.',
    historyOnlyUnsaved: 'Nicht exportiert',
    historyOpenFile: 'Datei öffnen',
    historyRailSettings: 'Einstellungen',
    historyRailRetention: 'Aufbewahrung',
    historyCancel: 'Abbrechen',
    historyChip: 'Auf diesem Gerät · nie hochgeladen',
    historyEmptyTitle: 'Noch nichts gespeichert',
    historyEmptySearchTitle: 'Keine Treffer',
    historyClearSearch: 'Suche zurücksetzen',
    historyDeleteTitle: 'Dieses Dokument löschen',
    historyClearTitle: 'Alles löschen',
  },
  [LanguageCode.ES]: {
    webOffice: 'Web Office',
    uploadDocument: 'Abrir / editar documento',
    newWord: 'Nuevo documento de Word',
    newExcel: 'Nueva hoja de Excel',
    newPowerPoint: 'Nueva presentación de PowerPoint',
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
    editorErrorOutOfMemory:
      'Este navegador no pudo reservar memoria para el motor de conversión de documentos (unos {mb} MB). Cierra otras pestañas o ventanas e inténtalo de nuevo; si sigue fallando, usa un navegador de 64 bits (Edge o Chrome de 64 bits).',
    editorOpenRetrying: 'El editor no estaba listo al abrir el documento; se está reintentando automáticamente…',
    agentTitle: 'Asistente de IA',
    agentOpenTip: 'Abrir el asistente de IA',
    agentSettings: 'Ajustes',
    agentRoleUser: 'Tú',
    agentRoleTool: 'Herramienta',
    agentRoleError: 'Error',
    agentProviderClaude: 'Claude (nube, requiere clave de API)',
    agentProviderOpenAI: 'OpenAI (nube, requiere clave de API)',
    agentProviderGemini: 'Gemini (nube, requiere clave de API)',
    agentProviderLocal: 'Local sin conexión (WebLLM, requiere WebGPU)',
    agentProviderOllama: 'Ollama (servidor local, lo ejecutas tú)',
    agentOllamaModelPlaceholder: 'Nombre del modelo, p. ej. llama3.2',
    agentOllamaHint:
      'Se conecta a Ollama en local (http://localhost:11434); no hace falta clave de API, pero asegúrate de que el modelo esté en marcha.',
    agentLoadModel: 'Cargar modelo',
    agentModelLoaded: 'Modelo cargado: ya puedes empezar a escribir.',
    agentCheckingCache: 'Comprobando la caché del modelo…',
    agentModelCached:
      'Este modelo ya está en caché: pulsa «Cargar modelo» para empezar al instante (al recargar no se descarga de nuevo).',
    agentModelFirstDownload:
      'La primera vez se descarga el modelo ({size}); después queda en caché, así que al recargar no se descarga de nuevo.',
    agentNoWebGPU: 'Este navegador no admite WebGPU, así que el modo local no está disponible.',
    agentLocalChatOnly:
      'El modelo local solo responde y reescribe: no edita el documento directamente. Para que la IA edite, ',
    agentSwitchCloud: 'cambia a la nube →',
    agentReviewMode: 'Control de cambios',
    agentQuote: 'Citar la selección',
    agentQuoteTip: 'Cita en el cuadro de texto lo que tengas seleccionado en el documento, la hoja o la diapositiva',
    agentClear: 'Borrar la conversación',
    agentInputPlaceholder: 'Pide a la IA que edite el documento… (Enter para enviar, Mayús+Enter para salto de línea)',
    agentSend: 'Enviar',
    agentStop: 'Detener',
    agentNeedKey: 'Introduce primero una clave de API.',
    agentNoSelection: 'No hay nada seleccionado: selecciona primero texto en el documento.',
    agentQuotePrefix: 'Ten en cuenta el contenido que he seleccionado:',
    agentStopped: 'Detenido.',
    agentMaxSteps: 'Se alcanzó el número máximo de pasos; proceso detenido.',
    agentToolCallPrefix: 'Llamada a herramienta: ',
    agentToolErrorPrefix: 'Error de herramienta: ',
    autosaveStopped:
      'Se ha detenido el guardado automático: este navegador se ha quedado sin espacio. Exporta este documento y borra algunos de los que tienes guardados.',
    historyTitle: 'Documentos guardados',
    historyIntro:
      'Copias de los documentos que has editado, conservadas en este navegador y en este dispositivo, para que recargar, cerrar una pestaña o un fallo no te cuesten el trabajo. Nada de esto se ha subido a ningún sitio.',
    historyColDocument: 'Documento',
    historyColEdited: 'Última edición',
    historyColSize: 'Tamaño',
    historyColExpires: 'Se borra',
    historyNotBackup:
      'Estas copias existen para que puedas retomar lo que estabas haciendo. No son una copia de seguridad: exporta lo que quieras conservar.',
    historySearchPlaceholder: 'Buscar por nombre de archivo',
    historyEmpty: 'Todavía no hay nada guardado. Los documentos que edites aquí aparecerán solos en esta lista.',
    historyEmptySearch: 'Ningún nombre de archivo coincide con esa búsqueda.',
    historyOpen: 'Abrir',
    historyDelete: 'Eliminar',
    historyDeleteConfirm: '¿Eliminar «{title}» y todas sus copias guardadas? Esto no se puede deshacer.',
    historyClearAll: 'Eliminar todo',
    historyClearConfirm:
      '¿Eliminar todas las copias de documentos guardadas en este dispositivo? Esto no se puede deshacer.',
    historyUnsaved: 'sin exportar',
    historyUsage: '{size} en uso',
    historyCount: '{count} documentos',
    historyPageInfo: 'Página {page} de {pages}',
    historyPrev: 'Anterior',
    historyNext: 'Siguiente',
    historyBack: 'Abrir el editor',
    historyAutosaveLabel: 'Guardado automático',
    historyAutosaveOff:
      'El guardado automático está desactivado: lo que edites ahora no se guarda y se perderá al cerrar la página.',
    historyRetention:
      'Cada documento se elimina automáticamente 7 días después de la última vez que lo editaste o lo abriste. También puedes borrar lo que quieras desde aquí, y surte efecto de inmediato.',
    historyExpiresIn: 'quedan {days} días',
    historyExpiresInOne: 'queda 1 día',
    historyExpiresToday: 'hoy',
    historyDownload: 'Descargar',
    historyDownloadFailed: 'No se pudo guardar esa copia en el disco.',
    historyOnlyUnsaved: 'Sin exportar',
    historyOpenFile: 'Abrir un archivo',
    historyRailSettings: 'Ajustes',
    historyRailRetention: 'Conservación',
    historyCancel: 'Cancelar',
    historyChip: 'En este dispositivo · nunca se sube',
    historyEmptyTitle: 'Todavía no hay nada guardado',
    historyEmptySearchTitle: 'Sin resultados',
    historyClearSearch: 'Borrar la búsqueda',
    historyDeleteTitle: 'Eliminar este documento',
    historyClearTitle: 'Eliminarlo todo',
  },
  [LanguageCode.PT]: {
    webOffice: 'Web Office',
    uploadDocument: 'Abrir / editar documento',
    newWord: 'Novo documento do Word',
    newExcel: 'Nova planilha do Excel',
    newPowerPoint: 'Nova apresentação do PowerPoint',
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
    editorErrorOutOfMemory:
      'Este navegador não conseguiu reservar memória para o motor de conversão de documentos (cerca de {mb} MB). Feche outras abas ou janelas e tente novamente; se continuar falhando, use um navegador de 64 bits (Edge ou Chrome de 64 bits).',
    editorOpenRetrying:
      'O editor não estava pronto quando o documento foi aberto; a tentar novamente de forma automática…',
    agentTitle: 'Assistente de IA',
    agentOpenTip: 'Abrir o assistente de IA',
    agentSettings: 'Definições',
    agentRoleUser: 'Você',
    agentRoleTool: 'Ferramenta',
    agentRoleError: 'Erro',
    agentProviderClaude: 'Claude (nuvem, precisa de chave de API)',
    agentProviderOpenAI: 'OpenAI (nuvem, precisa de chave de API)',
    agentProviderGemini: 'Gemini (nuvem, precisa de chave de API)',
    agentProviderLocal: 'Local sem ligação (WebLLM, precisa de WebGPU)',
    agentProviderOllama: 'Ollama (servidor local, executado por si)',
    agentOllamaModelPlaceholder: 'Nome do modelo, por exemplo llama3.2',
    agentOllamaHint:
      'Liga-se ao Ollama local (http://localhost:11434); não é preciso chave de API — confirme que o modelo está a correr.',
    agentLoadModel: 'Carregar modelo',
    agentModelLoaded: 'Modelo carregado — já pode começar a conversar.',
    agentCheckingCache: 'A verificar a cache do modelo…',
    agentModelCached:
      'Este modelo já está em cache — clique em «Carregar modelo» para começar de imediato (recarregar a página não o volta a transferir).',
    agentModelFirstDownload:
      'Na primeira utilização o modelo é transferido ({size}); depois fica em cache, por isso recarregar a página não o volta a transferir.',
    agentNoWebGPU: 'Este navegador não suporta WebGPU, pelo que o modo local não está disponível.',
    agentLocalChatOnly:
      'O modelo local apenas responde e reescreve — não edita o documento diretamente. Para que a IA edite, ',
    agentSwitchCloud: 'mude para a nuvem →',
    agentReviewMode: 'Registo de alterações',
    agentQuote: 'Citar a seleção',
    agentQuoteTip:
      'Cita na caixa de texto o que estiver selecionado no documento, na folha de cálculo ou no diapositivo',
    agentClear: 'Limpar a conversa',
    agentInputPlaceholder: 'Peça à IA para editar o documento… (Enter envia, Shift+Enter muda de linha)',
    agentSend: 'Enviar',
    agentStop: 'Parar',
    agentNeedKey: 'Introduza primeiro uma chave de API.',
    agentNoSelection: 'Não há nada selecionado — selecione primeiro texto no documento.',
    agentQuotePrefix: 'Tenha em conta o conteúdo que selecionei:',
    agentStopped: 'Parado.',
    agentMaxSteps: 'Foi atingido o número máximo de passos; processo parado.',
    agentToolCallPrefix: 'Chamada de ferramenta: ',
    agentToolErrorPrefix: 'Erro da ferramenta: ',
    autosaveStopped:
      'A gravação automática parou: este navegador ficou sem espaço. Exporte este documento e apague alguns dos que tem guardados.',
    historyTitle: 'Documentos guardados',
    historyIntro:
      'Cópias dos documentos que editou, mantidas neste navegador e neste dispositivo, para que recarregar, fechar um separador ou uma falha não lhe custem o trabalho. Nada disto foi enviado para a Internet.',
    historyColDocument: 'Documento',
    historyColEdited: 'Última edição',
    historyColSize: 'Tamanho',
    historyColExpires: 'Apaga-se',
    historyNotBackup:
      'Estas cópias servem para retomar aquilo que estava a meio. Não são uma cópia de segurança — exporte tudo o que quiser guardar.',
    historySearchPlaceholder: 'Procurar pelo nome do ficheiro',
    historyEmpty: 'Ainda não há nada guardado. Os documentos que editar aqui aparecem sozinhos nesta lista.',
    historyEmptySearch: 'Nenhum nome de ficheiro corresponde a essa procura.',
    historyOpen: 'Abrir',
    historyDelete: 'Eliminar',
    historyDeleteConfirm: 'Eliminar «{title}» e todas as cópias guardadas? Não é possível anular.',
    historyClearAll: 'Eliminar tudo',
    historyClearConfirm: 'Eliminar todas as cópias de documentos guardadas neste dispositivo? Não é possível anular.',
    historyUnsaved: 'por exportar',
    historyUsage: '{size} em uso',
    historyCount: '{count} documentos',
    historyPageInfo: 'Página {page} de {pages}',
    historyPrev: 'Anterior',
    historyNext: 'Seguinte',
    historyBack: 'Abrir o editor',
    historyAutosaveLabel: 'Gravação automática',
    historyAutosaveOff:
      'A gravação automática está desligada: o que editar agora não fica guardado e perde-se ao fechar a página.',
    historyRetention:
      'Cada documento é eliminado automaticamente 7 dias depois de o ter editado ou aberto pela última vez. Também pode apagar aqui o que quiser, com efeito imediato.',
    historyExpiresIn: 'faltam {days} dias',
    historyExpiresInOne: 'falta 1 dia',
    historyExpiresToday: 'hoje',
    historyDownload: 'Baixar',
    historyDownloadFailed: 'Não foi possível salvar essa cópia no disco.',
    historyOnlyUnsaved: 'Não exportados',
    historyOpenFile: 'Abrir um arquivo',
    historyRailSettings: 'Configurações',
    historyRailRetention: 'Retenção',
    historyCancel: 'Cancelar',
    historyChip: 'Neste dispositivo · nunca enviado',
    historyEmptyTitle: 'Ainda não há nada guardado',
    historyEmptySearchTitle: 'Sem resultados',
    historyClearSearch: 'Limpar a procura',
    historyDeleteTitle: 'Eliminar este documento',
    historyClearTitle: 'Eliminar tudo',
  },
  [LanguageCode.FA]: {
    webOffice: 'Web Office',
    uploadDocument: 'باز کردن / ویرایش سند',
    newWord: 'سند Word جدید',
    newExcel: 'کاربرگ Excel جدید',
    newPowerPoint: 'ارائهٔ PowerPoint جدید',
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
    editorErrorOutOfMemory:
      'این مرورگر نتوانست حافظه لازم برای موتور تبدیل سند (حدود {mb} مگابایت) را تخصیص دهد. زبانه‌ها یا پنجره‌های دیگر را ببندید و دوباره تلاش کنید؛ اگر همچنان ناموفق بود از یک مرورگر ۶۴ بیتی (Edge یا Chrome ۶۴ بیتی) استفاده کنید.',
    editorOpenRetrying: 'هنگام باز شدن سند، ویرایشگر هنوز آماده نبود؛ به‌طور خودکار دوباره تلاش می‌شود…',
    agentTitle: 'دستیار هوش مصنوعی',
    agentOpenTip: 'باز کردن دستیار هوش مصنوعی',
    agentSettings: 'تنظیمات',
    agentRoleUser: 'شما',
    agentRoleTool: 'ابزار',
    agentRoleError: 'خطا',
    agentProviderClaude: 'Claude (ابری، نیازمند کلید API)',
    agentProviderOpenAI: 'OpenAI (ابری، نیازمند کلید API)',
    agentProviderGemini: 'Gemini (ابری، نیازمند کلید API)',
    agentProviderLocal: 'محلی و آفلاین (WebLLM، نیازمند WebGPU)',
    agentProviderOllama: 'Ollama (کارساز محلی، خودتان اجرا می‌کنید)',
    agentOllamaModelPlaceholder: 'نام مدل، برای نمونه llama3.2',
    agentOllamaHint:
      'به Ollama محلی (http://localhost:11434) وصل می‌شود؛ کلید API لازم نیست — فقط مطمئن شوید مدل در حال اجراست.',
    agentLoadModel: 'بارگذاری مدل',
    agentModelLoaded: 'مدل بارگذاری شد — می‌توانید گفت‌وگو را آغاز کنید.',
    agentCheckingCache: 'در حال بررسی حافظهٔ نهان مدل…',
    agentModelCached:
      'این مدل در حافظهٔ نهان هست — روی «بارگذاری مدل» بزنید تا بی‌درنگ آغاز شود (بارگذاری دوبارهٔ صفحه آن را از نو دریافت نمی‌کند).',
    agentModelFirstDownload:
      'نخستین بار مدل ({size}) دریافت می‌شود؛ سپس در حافظهٔ نهان می‌ماند، بنابراین بارگذاری دوبارهٔ صفحه آن را از نو دریافت نمی‌کند.',
    agentNoWebGPU: 'این مرورگر از WebGPU پشتیبانی نمی‌کند؛ حالت محلی در دسترس نیست.',
    agentLocalChatOnly:
      'مدل محلی فقط پاسخ می‌دهد و بازنویسی می‌کند — سند را مستقیم ویرایش نمی‌کند. برای ویرایش با هوش مصنوعی، ',
    agentSwitchCloud: '← به حالت ابری بروید',
    agentReviewMode: 'حالت بازبینی',
    agentQuote: 'نقل‌قول از بخش برگزیده',
    agentQuoteTip: 'متنی را که هم‌اکنون در سند، صفحه‌گسترده یا اسلاید برگزیده‌اید در کادر ورودی نقل می‌کند',
    agentClear: 'پاک کردن گفت‌وگو',
    agentInputPlaceholder: 'از هوش مصنوعی بخواهید سند را ویرایش کند… (Enter برای فرستادن، Shift+Enter برای خط تازه)',
    agentSend: 'فرستادن',
    agentStop: 'توقف',
    agentNeedKey: 'نخست یک کلید API وارد کنید.',
    agentNoSelection: 'چیزی برگزیده نشده است — نخست متنی را در سند انتخاب کنید.',
    agentQuotePrefix: 'لطفاً محتوایی را که برگزیده‌ام در نظر بگیر:',
    agentStopped: 'متوقف شد.',
    agentMaxSteps: 'به بیشترین شمار گام‌ها رسید؛ متوقف شد.',
    agentToolCallPrefix: 'فراخوانی ابزار: ',
    agentToolErrorPrefix: 'خطای ابزار: ',
    autosaveStopped:
      'ذخیرهٔ خودکار متوقف شد: فضای این مرورگر پر شده است. این سند را برون‌بری کنید و سپس چند سند قدیمی را از سندهای ذخیره‌شده پاک کنید.',
    historyTitle: 'سندهای ذخیره‌شده',
    historyIntro:
      'نسخه‌هایی از سندهایی که ویرایش کرده‌اید، در همین مرورگر و روی همین دستگاه نگه داشته می‌شوند تا بارگذاری دوباره، بستن زبانه یا از کار افتادن مرورگر کارتان را از بین نبرد. هیچ‌کدام جایی بارگذاری نشده‌اند.',
    historyColDocument: 'سند',
    historyColEdited: 'آخرین ویرایش',
    historyColSize: 'اندازه',
    historyColExpires: 'پاک شدن خودکار',
    historyNotBackup:
      'این نسخه‌ها برای آن‌اند که کار نیمه‌تمام را پی بگیرید. پشتیبان نیستند — هر چه را می‌خواهید نگه دارید برون‌بری کنید.',
    historySearchPlaceholder: 'جست‌وجو بر پایهٔ نام پرونده',
    historyEmpty: 'هنوز چیزی ذخیره نشده است. سندهایی که اینجا ویرایش کنید خودبه‌خود در این فهرست پدیدار می‌شوند.',
    historyEmptySearch: 'هیچ نام پرونده‌ای با این جست‌وجو همخوانی ندارد.',
    historyOpen: 'باز کردن',
    historyDelete: 'پاک کردن',
    historyDeleteConfirm: '«{title}» و همهٔ نسخه‌های ذخیره‌شدهٔ آن پاک شوند؟ این کار بازگشت‌پذیر نیست.',
    historyClearAll: 'پاک کردن همه',
    historyClearConfirm: 'همهٔ نسخه‌های سندهای ذخیره‌شده روی این دستگاه پاک شوند؟ این کار بازگشت‌پذیر نیست.',
    historyUnsaved: 'برون‌بری‌نشده',
    historyUsage: '{size} در استفاده',
    historyCount: '{count} سند',
    historyPageInfo: 'صفحهٔ {page} از {pages}',
    historyPrev: 'پیشین',
    historyNext: 'پسین',
    historyBack: 'باز کردن ویرایشگر',
    historyAutosaveLabel: 'ذخیرهٔ خودکار',
    historyAutosaveOff:
      'ذخیرهٔ خودکار خاموش است: آنچه اکنون ویرایش می‌کنید ذخیره نمی‌شود و با بستن صفحه از دست می‌رود.',
    historyRetention:
      'هر سند ۷ روز پس از آخرین ویرایش یا باز کردنش خودبه‌خود پاک می‌شود. از همین‌جا هم می‌توانید هر چه را بخواهید پاک کنید که بی‌درنگ اعمال می‌شود.',
    historyExpiresIn: '{days} روز مانده',
    historyExpiresInOne: '۱ روز مانده',
    historyExpiresToday: 'امروز',
    historyDownload: 'دانلود',
    historyDownloadFailed: 'ذخیرهٔ این نسخه روی دیسک ممکن نشد.',
    historyOnlyUnsaved: 'خروجی‌نگرفته',
    historyOpenFile: 'باز کردن پرونده',
    historyRailSettings: 'تنظیمات',
    historyRailRetention: 'نگهداری',
    historyCancel: 'انصراف',
    historyChip: 'روی همین دستگاه · هرگز بارگذاری نشده',
    historyEmptyTitle: 'هنوز چیزی ذخیره نشده',
    historyEmptySearchTitle: 'نتیجه‌ای نیست',
    historyClearSearch: 'پاک کردن جست‌وجو',
    historyDeleteTitle: 'پاک کردن این سند',
    historyClearTitle: 'پاک کردن همه',
  },
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
