import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { t, type I18nMessages } from '@ranuts/shared/i18n';
import type { createConversationStore } from './sessions';

const SAVE_PREFERENCE = 'agent_conversation_saving_v2';
export interface HistoryControlsOptions {
  store: ReturnType<typeof createConversationStore>;
  onRestore(): void;
  onBeforeRestore?(): void;
}

/** Local-only download. The export contains conversation data, never provider settings. */
export function downloadConversations(json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `conversations-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createHistoryControls(options: HistoryControlsOptions) {
  const { store } = options;
  const el = document.createElement('fieldset');
  el.className = 'agent-history-options';
  const legend = document.createElement('legend');
  const label = document.createElement('label');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'agent-history-save';
  const saveText = document.createElement('span');
  label.append(toggle, saveText);
  const status = document.createElement('p');
  status.className = 'agent-history-status';
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'agent-history-actions';
  const button = (className: string): HTMLButtonElement => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = className;
    return item;
  };
  const restore = button('agent-history-restore');
  const legacy = button('agent-history-import');
  const exported = button('agent-history-export');
  const remove = button('agent-history-delete-current');
  const clear = button('agent-history-delete-all');
  actions.append(restore, legacy, exported, remove, clear);
  const confirmation = document.createElement('div');
  confirmation.className = 'agent-history-confirmation';
  confirmation.hidden = true;
  const question = document.createElement('span');
  const confirm = button('agent-history-confirm');
  const cancel = button('agent-history-cancel');
  confirmation.append(question, confirm, cancel);
  el.append(legend, label, status, actions, confirmation);
  let busy = 0;
  let requestedSaving: boolean | undefined;
  let failure: keyof I18nMessages | undefined;
  let deletion: 'all' | string | undefined;
  const sync = () => {
    toggle.checked = busy && requestedSaving !== undefined ? requestedSaving : store.saving;
    status.textContent = t(
      busy ? 'agentHistoryBusy' : (failure ?? (store.saving ? 'agentHistorySaving' : 'agentHistoryMemory')),
    );
    for (const item of actions.querySelectorAll('button')) item.disabled = busy > 0;
    confirm.disabled = busy > 0;
    cancel.disabled = busy > 0;
    legend.textContent = t('agentConversations');
    saveText.textContent = t('agentSaveHistory');
    restore.textContent = t('agentRestoreHistory');
    legacy.textContent = t('agentImportHistory');
    exported.textContent = t('agentExportHistory');
    remove.textContent = t('agentDeleteConversation');
    clear.textContent = t('agentDeleteHistory');
    question.textContent = t(deletion === 'all' ? 'agentDeleteHistoryConfirm' : 'agentDeleteConversationConfirm');
    confirm.textContent = t('agentHistoryConfirmDelete');
    cancel.textContent = t('agentPlanCancel');
  };
  const showError = (error: unknown) => {
    requestedSaving = undefined;
    failure =
      typeof error === 'object' && error !== null && 'name' in error && error.name === 'ConversationConflictError'
        ? 'agentHistoryConflict'
        : 'agentHistorySaveFailed';
    status.title = error instanceof Error ? error.message : String(error);
    localStorageSetItem(SAVE_PREFERENCE, 'false');
    sync();
  };
  const run = async (operation: () => Promise<void>) => {
    busy++;
    failure = undefined;
    sync();
    try {
      await operation();
    } catch (error) {
      showError(error);
    } finally {
      busy--;
      if (!busy) requestedSaving = undefined;
      sync();
    }
  };
  const restoreView = () => {
    options.onRestore();
    confirmation.hidden = true;
    deletion = undefined;
  };
  const enableSaving = async (enabled: boolean) => {
    if (enabled) options.onBeforeRestore?.();
    await store.setSaving(enabled);
    localStorageSetItem(SAVE_PREFERENCE, String(store.saving));
    if (enabled && store.saving) restoreView();
  };
  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    requestedSaving = enabled;
    void run(() => enableSaving(enabled));
  });
  restore.addEventListener(
    'click',
    () =>
      void run(async () => {
        options.onBeforeRestore?.();
        await store.restoreSaved();
        restoreView();
      }),
  );
  legacy.addEventListener(
    'click',
    () =>
      void run(async () => {
        options.onBeforeRestore?.();
        await store.importLegacy();
        restoreView();
      }),
  );
  exported.addEventListener('click', () => {
    try {
      downloadConversations(store.exportJSON());
    } catch (error) {
      showError(error);
    }
  });
  let deletionTrigger: HTMLButtonElement | undefined;
  const askDeletion = (target: string, trigger: HTMLButtonElement) => {
    deletionTrigger = trigger;
    deletion = target;
    confirmation.hidden = false;
    sync();
    cancel.focus();
  };
  remove.addEventListener('click', () => askDeletion(store.activeId, remove));
  clear.addEventListener('click', () => askDeletion('all', clear));
  cancel.addEventListener('click', () => {
    deletion = undefined;
    confirmation.hidden = true;
    deletionTrigger?.focus();
    deletionTrigger = undefined;
  });
  confirm.addEventListener('click', () => {
    const target = deletion;
    if (!target) return;
    const trigger = deletionTrigger;
    let restoreFocus = confirmation.contains(document.activeElement);
    const finishDeletion = () => {
      restoreFocus &&= document.activeElement === document.body || confirmation.contains(document.activeElement);
      restoreView();
    };
    void run(async () => {
      options.onBeforeRestore?.();
      if (target === 'all') {
        await store.clearAll();
        localStorageSetItem(SAVE_PREFERENCE, 'false');
      } else {
        try {
          await store.remove(target);
          await store.flush();
        } finally {
          finishDeletion();
        }
      }
      finishDeletion();
    }).then(() => {
      if (restoreFocus && (document.activeElement === document.body || confirmation.contains(document.activeElement))) {
        if (confirmation.hidden) trigger?.focus();
        else confirm.focus();
      }
      if (confirmation.hidden) deletionTrigger = undefined;
    });
  });
  sync();
  return {
    el,
    sync,
    showError,
    start: async () => {
      if (localStorageGetItem(SAVE_PREFERENCE) === 'true') {
        requestedSaving = true;
        await run(() => enableSaving(true));
      }
    },
  };
}
