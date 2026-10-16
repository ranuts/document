import { t } from '@ranuts/shared/i18n';
import type { SourcesLabels } from './sources-view';
export function sourcesLabels(): SourcesLabels {
  return {
    title: t('agentSourcesSources'),
    offline: t('agentOfflineFeaturesHint'),
    excerpt: t('agentSourcesExcerpt'),
    local: t('agentSourcesLocal'),
    localHint: t('agentSourcesLocalHint'),
    mcp: t('agentSourcesMcp'),
    url: t('agentSourcesUrl'),
    token: t('agentSourcesToken'),
    connect: t('agentSourcesConnect'),
    disconnect: t('agentSourcesDisconnect'),
    drive: t('agentSourcesDrive'),
    driveHint: t('agentSourcesDriveHint'),
    unavailable: t('agentSourcesUnavailable'),
    reconnect: t('agentSourcesReconnect'),
    loading: t('agentSourcesLoading'),
    failed: t('agentSourcesFailed'),
    tooLarge: t('agentSourcesTooLarge'),
    limit: t('agentSourcesLimit'),
    unsupported: t('agentSourcesUnsupported'),
    remove: t('agentSourcesRemove'),
    attached: t('agentSourcesAttached'),
    attach: t('agentSourcesAttach'),
    close: t('agentSourcesClose'),
    more: t('agentSourcesMore'),
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
