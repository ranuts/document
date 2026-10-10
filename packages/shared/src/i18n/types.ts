/**
 * The message table's shape, kept apart from the tables themselves.
 *
 * Every locale file imports this type and nothing else, so adding a language is
 * adding a file rather than editing a thousand-line one, and two changes to two
 * different languages no longer touch the same lines.
 */
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
  openUrlFailed: string;
  openUrlUnreachable: string;
  editorErrorToast: string;
  editorErrorFormatMismatch: string;
  editorErrorOpenFailed: string;
  editorErrorOutOfMemory: string;
  editorOpenRetrying: string;

  // AI agent panel
  agentSlideNoRoom: string;
  agentDocumentActionTimeout: string;
  agentPlanUnverified: string;
  agentDocumentReadOnly: string;
  agentEditorLoading: string;
  agentSelectCell: string;
  agentSlidesUnavailable: string;
  agentPreparing: string;
  agentTaskChat: string;
  agentWelcome: string;
  agentComposeHint: string;
  agentWritingHint: string;
  agentRequestFailed: string;
  agentReadSelection: string;
  agentReadDocument: string;
  agentUpdateDocument: string;
  agentReadCell: string;
  agentNoReadableText: string;
  agentToolNotChosen: string;
  agentUpdateCell: string;
  agentExecute: string;
  agentClose: string;
  agentConfigure: string;
  agentWriteReply: string;
  agentWriteReplyTip: string;
  agentWritingReply: string;
  agentReplyWritten: string;
  agentCheckDocument: string;
  agentWordOnly: string;
  agentTitle: string;
  agentOpenTip: string;
  agentSettings: string;
  agentCustomModel: string;
  agentProviderLabel: string;
  agentModelLabel: string;
  agentApiKeyLabel: string;
  agentRoleUser: string;
  agentRoleTool: string;
  agentRoleError: string;
  agentProviderClaude: string;
  agentProviderOpenAI: string;
  agentProviderGemini: string;
  agentProviderWllama: string;
  agentWllamaHint: string;
  agentProviderLocal: string;
  agentProviderOllama: string;
  agentOllamaModelPlaceholder: string;
  agentOllamaHint: string;
  /** Optional native loopback service, used as the writing backend. */
  agentProviderLoopback: string;
  agentEndpointKind: string;
  agentEndpointLoopback: string;
  agentEndpointOpenAICompatible: string;
  agentEndpointAnthropic: string;
  agentEndpointGemini: string;
  agentEndpointUrl: string;
  agentEndpointModel: string;
  agentEndpointKey: string;
  agentEndpointConnect: string;
  agentEndpointDisconnect: string;
  agentEndpointConnecting: string;
  agentEndpointConnected: string;
  agentEndpointConfigured: string;
  agentEndpointFailed: string;
  agentEndpointModelRequired: string;
  agentEndpointUrlRequired: string;
  agentWriteDestinationTitle: string;
  agentWriteDestinationDevice: string;
  agentWriteDestinationRemote: string;
  agentWriteNeedsDestination: string;
  agentWritePreference: string;
  agentWritePreferDevice: string;
  agentWritePreferRemote: string;
  /** Explicit opt-in to the experimental browser-local writing route. */
  agentWritingOfflineNeedsDevice: string;
  agentEndpointOfflineHint: string;
  agentEndpointKeyRequired: string;
  agentWriteDestinationOfflineUnavailable: string;
  agentLocalWritingConsent: string;
  agentWritingNeedsLocalService: string;
  agentChooseModelFiles: string;
  agentLoadModel: string;
  agentModelLoaded: string;
  agentCheckingCache: string;
  agentModelCached: string;
  /** `{memory}` is an estimated GPU memory requirement, not download size. */
  agentModelMemory: string;
  agentModelFirstDownload: string;
  agentNoWebGPU: string;
  agentLocalChatOnly: string;
  agentSwitchCloud: string;
  agentReviewMode: string;
  agentPlanMode: string;
  agentTaskEdit: string;
  agentTaskTools: string;
  agentWritingNumbersChanged: string;
  agentWritingCurrencyChanged: string;
  agentSummaryNotShorter: string;
  agentLocalModelReload: string;
  agentWritingLanguageMismatch: string;
  agentWritingUnchanged: string;
  agentTaskRewrite: string;
  agentTaskSummarize: string;
  agentTaskTranslate: string;
  agentTaskModelLabel: string;
  agentTaskModelInherit: string;
  agentTaskModelExperimental: string;
  agentTaskLabel: string;
  agentTaskLanguage: string;
  agentPlanTitle: string;
  agentPlanBefore: string;
  agentPlanAfter: string;
  agentPlanApply: string;
  agentPlanCancel: string;
  agentPlanExpired: string;
  agentPlanApplied: string;
  agentPlanVerified: string;
  agentPlanReady: string;
  agentPlanCursor: string;
  agentPlanSelection: string;

  agentQuote: string;
  agentQuoteTip: string;
  agentNewConversation: string;
  agentSaveHistory: string;
  agentGenerationSettings: string;
  agentSystemPrompt: string;
  agentSystemPromptDefault: string;
  agentTemperature: string;
  agentTopP: string;
  agentFirstText: string;
  agentResponseRate: string;
  agentDecodeSpeed: string;
  agentFirstToken: string;
  agentMaxTokens: string;
  agentGenerationInvalid: string;
  agentGenerationLocal: string;

  agentHistoryMemory: string;
  agentHistorySaving: string;
  agentHistoryBusy: string;
  agentHistorySaveFailed: string;
  agentHistoryConflict: string;
  agentRestoreHistory: string;
  agentImportHistory: string;
  agentExportHistory: string;
  agentDeleteConversation: string;
  agentDeleteHistory: string;
  agentDeleteHistoryConfirm: string;
  agentDeleteConversationConfirm: string;
  agentHistoryConfirmDelete: string;

  agentConversations: string;
  agentContextTrimmed: string;
  agentContextTooLong: string;
  agentClear: string;
  agentInputPlaceholder: string;
  agentSend: string;
  agentStop: string;
  agentNeedKey: string;
  agentNoCompletedAnswer: string;
  agentParagraphSelectionConflict: string;
  agentNoSelection: string;
  agentQuotePrefix: string;
  agentCopy: string;
  agentCopied: string;
  agentCopyFailed: string;
  agentRestoreRequest: string;
  agentWaiting: string;
  agentScrollLatest: string;
  agentModelCleanupFailed: string;
  agentModelLoadFailed: string;
  agentModelSourceInvalid: string;
  agentModelQuota: string;
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
