import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { Div } from 'ranui/builder';
import { t, type I18nMessages } from '@ranuts/shared/i18n';
import type { createConversationStore } from './sessions';

const SAVE_PREFERENCE = 'agent_conversation_saving_v2';
export interface HistoryControlsOptions {
  store: ReturnType<typeof createConversationStore>;
  onRestore(deleted?: string): void;
  onBeforeRestore?(deleted?: string): void;
  onFocusAfterDeletion?(): void;
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
  const el = document.createElement('div');
  el.className = 'agent-history-options';
  const details = document.createElement('details');
  details.className = 'agent-history-management';
  const legend = document.createElement('summary');
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
  const actionLabels = new Map<HTMLButtonElement, HTMLSpanElement>();
  const button = (className: string, path?: string): HTMLButtonElement => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = className;
    if (path) {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('width', '18');
      icon.setAttribute('height', '18');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '1.6');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      icon.innerHTML = `<path d="${path}"/>`;
      const text = document.createElement('span');
      text.className = 'agent-history-action-label';
      item.append(icon, text);
      actionLabels.set(item, text);
    }
    return item;
  };
  const restore = button('agent-history-restore', 'M3 11a9 9 0 1 1 3 8M3 5v6h6M12 7v5l3 2');
  const recover = button('agent-history-recover', 'M3 11a9 9 0 1 1 3 8M3 5v6h6');
  const legacy = button('agent-history-import', 'M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5');
  const exported = button('agent-history-export', 'M12 15V3m-4 4 4-4 4 4M4 15v5h16v-5');
  const remove = button('agent-history-delete-current', 'M9 8l6 6m0-6-6 6M20 11a8 8 0 0 1-8 8H4v-8a8 8 0 0 1 16 0Z');
  const clear = button('agent-history-delete-all', 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7');
  const labelAction = (item: HTMLButtonElement, key: keyof I18nMessages) => {
    actionLabels.get(item)!.textContent = t(key);
  };
  actions.append(
    Div().class('agent-history-transfer-actions').children(restore, recover, legacy, exported).build(),
    Div().class('agent-history-danger-actions').children(remove, clear).build(),
  );
  const confirmation = document.createElement('div');
  confirmation.className = 'agent-history-confirmation';
  confirmation.hidden = true;
  const question = document.createElement('span');
  const confirm = button('agent-history-confirm');
  const cancel = button('agent-history-cancel');
  confirmation.append(question, confirm, cancel);
  details.append(legend, label, status, actions);
  el.append(details, confirmation);
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
    legend.textContent = t('agentHistoryDataControls');
    saveText.textContent = t('agentSaveHistory');
    labelAction(restore, 'agentRestoreHistory');
    labelAction(recover, 'agentRecoverHistory');
    recover.hidden = failure !== 'agentHistoryConflict';
    labelAction(legacy, 'agentImportHistory');
    labelAction(exported, 'agentExportHistory');
    labelAction(remove, 'agentDeleteConversation');
    labelAction(clear, 'agentDeleteHistory');
    const target = store.list().find((item) => item.id === deletion);
    question.textContent = t(deletion === 'all' ? 'agentDeleteHistoryConfirm' : 'agentDeleteConversationConfirm');
    if (target) question.textContent += ` ${target.title || t('agentNewConversation')}`;
    confirm.textContent = t('agentHistoryConfirmDelete');
    cancel.textContent = t('agentPlanCancel');
  };
  const showError = (error: unknown) => {
    // Row actions live outside the disclosure, so failures must reveal its status.
    details.open = true;
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
  const restoreView = (deleted?: string) => {
    if (deleted === undefined) options.onRestore();
    else options.onRestore(deleted);
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
  recover.addEventListener('click', () => {
    if (busy) return;
    void run(async () => {
      options.onBeforeRestore?.();
      await store.recoverSaved(t('agentHistoryLocalCopy'));
      localStorageSetItem(SAVE_PREFERENCE, 'false');
      restoreView();
      restore.focus();
    });
  });
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
    confirmation.scrollIntoView?.({ block: 'nearest' });
  };
  remove.addEventListener('click', () => askDeletion(store.activeId, remove));
  clear.addEventListener('click', () => askDeletion('all', clear));
  cancel.addEventListener('click', () => {
    deletion = undefined;
    confirmation.hidden = true;
    deletionTrigger?.focus();
    deletionTrigger = undefined;
  });
  confirmation.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.isComposing) return;
    event.stopPropagation();
    if (!busy) cancel.click();
  });
  confirm.addEventListener('click', () => {
    const target = deletion;
    if (!target) return;
    const trigger = deletionTrigger;
    let restoreFocus = confirmation.contains(document.activeElement);
    let settled = false;
    const finishDeletion = () => {
      if (settled) return;
      settled = true;
      restoreFocus &&= document.activeElement === document.body || confirmation.contains(document.activeElement);
      restoreView(target);
    };
    void run(async () => {
      options.onBeforeRestore?.(target);
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
        if (confirmation.hidden) {
          if (trigger?.isConnected) trigger.focus();
          else options.onFocusAfterDeletion?.();
        } else confirm.focus();
      }
      if (confirmation.hidden) deletionTrigger = undefined;
    });
  });
  sync();
  return {
    el,
    sync,
    showError,
    requestDelete: (id: string, trigger: HTMLButtonElement) => {
      if (!busy && store.list().some((item) => item.id === id)) askDeletion(id, trigger);
    },
    start: async () => {
      if (localStorageGetItem(SAVE_PREFERENCE) === 'true') {
        requestedSaving = true;
        await run(() => enableSaving(true));
      }
    },
  };
}
