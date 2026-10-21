import type { ChatView } from '@ranuts/chat-ui';
import type { createWorkspaceNavigation } from './workspace-navigation';

export type PanelWorkspaceView = 'chat' | 'settings' | 'history' | 'sources' | 'artifacts';
interface WorkspaceSurface {
  el: HTMLElement;
  trigger: HTMLElement;
  focus: () => void;
}

/** Presentation navigation only. Request/session invalidation remains with the panel's lifecycle owners. */
export function createPanelWorkspace(options: {
  panel: HTMLElement;
  chat: Pick<ChatView, 'el' | 'focus'>;
  chatTrigger?: HTMLElement;
  navigation: Pick<ReturnType<typeof createWorkspaceNavigation>, 'capture' | 'restore'>;
  conversation: () => string;
  isOpen: () => boolean;
  runtime: { row: HTMLElement; settings: HTMLElement; modelRow: HTMLElement; modelActions: HTMLElement };
  views: Record<Exclude<PanelWorkspaceView, 'chat'>, WorkspaceSurface>;
  beforeChange: (view: PanelWorkspaceView) => void;
  changed: (view: PanelWorkspaceView) => void;
}) {
  const { panel, chat, views, runtime, navigation } = options;
  let initialized = false;
  const reveal = (trigger?: HTMLElement): void => {
    trigger?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  for (const trigger of [options.chatTrigger, ...Object.values(views).map((surface) => surface.trigger)])
    trigger?.addEventListener('focus', () => reveal(trigger));
  const show = (view: PanelWorkspaceView): void => {
    if (initialized && panel.dataset.view === view) return;
    options.beforeChange(view);
    initialized = true;
    if (panel.dataset.view === 'chat' && view !== 'chat') navigation.capture(options.conversation());
    panel.dataset.view = view;
    if (view === 'settings') runtime.modelRow.insertBefore(runtime.row, runtime.modelActions);
    else panel.insertBefore(runtime.row, runtime.settings);
    chat.el.hidden = view !== 'chat';
    if (options.chatTrigger) {
      if (view === 'chat') options.chatTrigger.setAttribute('aria-current', 'page');
      else options.chatTrigger.removeAttribute('aria-current');
    }
    for (const [name, surface] of Object.entries(views)) {
      if (name === 'settings') surface.el.classList.toggle('agent-panel-settings-hidden', view !== name);
      else surface.el.hidden = view !== name;
      surface.trigger.setAttribute('aria-expanded', String(view === name));
      if (view === name) surface.trigger.setAttribute('aria-current', 'page');
      else surface.trigger.removeAttribute('aria-current');
    }
    reveal(view === 'chat' ? options.chatTrigger : views[view].trigger);
    options.changed(view);
    if (!options.isOpen()) return;
    if (view !== 'chat') views[view].focus();
    else if (!navigation.restore(options.conversation(), true)) chat.focus();
  };
  options.chatTrigger?.addEventListener('click', () => show('chat'));
  for (const [name, surface] of Object.entries(views)) {
    surface.trigger.addEventListener('click', () => show(name as PanelWorkspaceView));
    surface.el.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented || event.keyCode === 229) return;
      event.stopPropagation();
      show('chat');
      surface.trigger.focus();
    });
  }
  return { show };
}
