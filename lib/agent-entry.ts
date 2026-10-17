import { t } from '@ranuts/shared/i18n';
import { isEmbedMode } from './embed-mode';
import { readAssistantEnabled, saveAssistantEnabled } from './agent-preferences';
import { createSidebarEntry } from './agent-plugin/ui/sidebar-entry';
import { mountPanelViewport } from './agent-plugin/ui/panel-viewport';

/** Keep the discovery and opt-in surface independent of the inference runtime. */
export function createAgentEntry() {
  let enabled = readAssistantEnabled();
  let open = false;
  let disposed = false;
  let busy = false;
  let runtime: typeof import('./agent-plugin/agent-plugin') | undefined;
  const shell = document.createElement('aside');
  shell.className = 'agent-panel agent-onboarding agent-panel-hidden';
  shell.setAttribute('aria-label', t('agentTitle'));
  const header = document.createElement('header');
  header.className = 'agent-panel-header';
  const title = document.createElement('strong');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'agent-panel-close';
  close.textContent = '×';
  const welcome = document.createElement('div');
  welcome.className = 'agent-welcome';
  const heading = document.createElement('h2');
  const intro = document.createElement('p');
  const row = document.createElement('div');
  row.className = 'agent-enable-row';
  const label = document.createElement('label');
  label.htmlFor = 'agent-enable';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'agent-enable';
  toggle.className = 'agent-enable-switch';
  toggle.setAttribute('role', 'switch');
  const note = document.createElement('p');
  note.className = 'agent-entry-note';
  note.setAttribute('role', 'status');
  const status = document.createElement('p');
  status.className = 'agent-entry-note';
  row.append(label, toggle);
  welcome.append(heading, intro, row, status, note);
  header.append(title, close);
  shell.append(header, welcome);
  if (!isEmbedMode()) document.body.append(shell);
  let viewportDispose = mountPanelViewport(shell);
  const mountSidebar = () =>
    createSidebarEntry(
      () => {
        void show(!open);
      },
      () => t('agentOpenTip'),
      () => !disposed && !isEmbedMode(),
    );
  let sidebar = mountSidebar();
  const sync = () => {
    title.textContent = t('agentTitle');
    heading.textContent = t('agentWelcome');
    intro.textContent = t('agentIntro');
    label.textContent = t('agentEnable');
    status.textContent = t('agentDefaultOff');
    toggle.setAttribute('aria-label', t('agentEnable'));
    toggle.setAttribute('aria-checked', String(enabled));
    toggle.disabled = busy;
    close.setAttribute('aria-label', t('agentClose'));
    sidebar.update(true, open);
  };
  async function setEnabled(next: boolean): Promise<void> {
    if (busy || disposed) return;
    busy = true;
    sync();
    note.textContent = '';
    try {
      if (next) {
        runtime ??= await import('./agent-plugin/agent-plugin');
        if (disposed) return;
        runtime.createAgentPanel({
          background: true,
          externalEntry: true,
          onDisable: () => setEnabled(false),
          onClose: () => {
            void show(false);
          },
        });
        await runtime.setAgentPanelEnabled(true);
      } else {
        enabled = false;
        saveAssistantEnabled(false);
        shell.classList.toggle('agent-panel-hidden', !open);
        await runtime?.setAgentPanelEnabled(false);
      }
      if (disposed) return;
      enabled = next;
      saveAssistantEnabled(next);
      await show(open);
    } catch (error) {
      enabled = false;
      saveAssistantEnabled(false);
      shell.classList.toggle('agent-panel-hidden', !open);
      note.textContent =
        error instanceof Error && error.message === t('agentModelCleanupFailed')
          ? error.message
          : t('agentSetupFailed');
      await show(open);
    } finally {
      busy = false;
      if (!disposed) sync();
    }
  }
  async function show(next: boolean): Promise<void> {
    if (disposed || isEmbedMode()) return;
    open = next;
    if (enabled && next && !runtime) {
      await setEnabled(true);
      return;
    }
    shell.classList.toggle('agent-panel-hidden', !next || enabled);
    runtime?.setAgentPanelOpen(next && enabled);
    document.body.classList.toggle('agent-docked', next);
    sync();
    if (next && !enabled) toggle.focus();
    if (!next) sidebar.focus();
  }
  toggle.addEventListener('click', () => {
    void setEnabled(!enabled);
  });
  close.addEventListener('click', () => {
    void show(false);
  });
  shell.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      void show(false);
    }
  });
  const onLanguage = () => {
    sync();
    note.textContent = t('agentStartNote');
  };
  window.addEventListener('languagechange', onLanguage);
  note.textContent = t('agentStartNote');
  sync();
  const onPageHide = (event: PageTransitionEvent) => {
    sidebar.dispose();
    viewportDispose();
    if (!event.persisted) {
      disposed = true;
      window.removeEventListener('languagechange', onLanguage);
    }
  };
  // Preserve the shell after a BFCache restore; no model is restarted.
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted && !disposed) {
      sidebar = mountSidebar();
      viewportDispose = mountPanelViewport(shell);
      sync();
    }
  };
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  return {
    toggle: () => {
      void show(!open);
    },
  };
}
