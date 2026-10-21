import { t } from '@ranuts/shared/i18n';
import type { SourcesLabels } from './sources-view';
export function sourcesLabels(): SourcesLabels {
  return {
    title: t('agentSourcesSources'),
    offline: t('agentOfflineFeaturesHint'),
    excerpt: t('agentSourcesExcerpt'),
    local: t('agentSourcesLocal'),
    localHint: t('agentSourcesLocalHint'),
    loading: t('agentSourcesLoading'),
    failed: t('agentSourcesFailed'),
    tooLarge: t('agentSourcesTooLarge'),
    limit: t('agentSourcesLimit'),
    corrupt: t('agentSourcesCorrupt'),
    encrypted: t('agentSourcesEncrypted'),
    empty: t('agentSourcesEmpty'),
    timeout: t('agentSourcesTimeout'),
    unsupported: t('agentSourcesUnsupported'),
    remove: t('agentSourcesRemove'),
    attach: t('agentSourcesAttach'),
    close: t('agentSourcesClose'),
    search: t('agentSourcesSearch'),
    previewTruncated: t('agentSourcesPreviewTruncated'),
    openSource: t('agentSourcesOpen'),
  };
}

import type { ArtifactsLabels } from './artifacts-view';
export function artifactLabels(): ArtifactsLabels {
  return {
    title: t('agentArtifactTitle'),
    empty: t('agentArtifactEmpty'),
    back: t('agentArtifactBack'),
    backToConversation: t('agentBackToChat'),
    backToList: t('agentArtifactBackToList'),
    titleField: t('agentArtifactTitleField'),
    textField: t('agentArtifactTextField'),
    version: t('agentArtifactVersion'),
    saveVersion: t('agentArtifactSaveVersion'),
    apply: t('agentArtifactApply'),
    delete: t('agentArtifactDelete'),
    confirmDelete: t('agentArtifactConfirmDelete'),
    cancel: t('agentArtifactCancel'),
    saved: t('agentArtifactSaved'),
    conflict: t('agentArtifactConflict'),
    limit: t('agentArtifactLimit'),
    versionLimit: t('agentArtifactVersionLimit'),
    countLimit: t('agentArtifactCountLimit'),
    textLimit: t('agentArtifactTextLimit'),
    export: t('agentArtifactExport'),
    import: t('agentArtifactImport'),
    importHint: t('agentArtifactImportHint'),
    preview: t('agentArtifactPreview'),
    edit: t('agentArtifactEdit'),
    cancelEditing: t('agentArtifactCancelEditing'),
    sourceData: t('agentArtifactSourceData'),
    unsaved: t('agentArtifactUnsaved'),
    next: t('agentArtifactNext'),
    previous: t('agentArtifactPrevious'),
    structuredHint: t('agentArtifactStructuredHint'),
    saveNew: t('agentArtifactSaveNew'),
    failed: t('agentArtifactFailed'),
    discardChanges: t('agentArtifactDiscardChanges'),
    provenance: t('agentArtifactProvenance'),
  };
}

import type { ResultActionLabels } from './result-actions';
export function resultActionLabels(): ResultActionLabels {
  return {
    shorter: t('agentResultShorter'),
    bullets: t('agentResultBullets'),
    summarize: t('agentResultSummarize'),
    shorterPrompt: t('agentResultShorterPrompt'),
    bulletsPrompt: t('agentResultBulletsPrompt'),
    summarizePrompt: t('agentResultSummarizePrompt'),
    source: t('agentResultPrevious'),
    conflict: t('agentResultDraftChoice'),
    replace: t('agentResultUseSuggestion'),
    keep: t('agentResultKeepDraft'),
  };
}

import type { ArtifactWorkflowLabels } from './artifact-workflow';
export function artifactWorkflowLabels(): ArtifactWorkflowLabels {
  return {
    entire: t('agentArtifactRevisionEntire'),
    selected: t('agentSelectionContext'),
    recovered: t('agentArtifactRevisionRecovered'),
    partial: t('agentArtifactRevisionPartial'),
    showFull: t('agentShowFullMessage'),
    refine: t('agentArtifactRevisionRefine'),
    instruction: t('agentArtifactRevisionInstruction'),
    submit: t('agentArtifactRevisionSubmit'),
    accept: t('agentArtifactRevisionAccept'),
    reject: t('agentArtifactRevisionReject'),
    waiting: t('agentArtifactRevisionWaiting'),
    ready: t('agentArtifactRevisionReady'),
    stale: t('agentArtifactRevisionStale'),
    failed: t('agentArtifactRevisionFailed'),
    accepted: t('agentArtifactRevisionAccepted'),
    stop: t('agentStop'),
    stopped: t('agentStopped'),
  };
}
