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
  navigation: Pick<ReturnType<typeof createWorkspaceNavigation>, 'capture' | 'restore'>;
  conversation: () => string;
  isOpen: () => boolean;
  runtime: { row: HTMLElement; settings: HTMLElement; modelRow: HTMLElement; modelActions: HTMLElement };
  views: Record<Exclude<PanelWorkspaceView, 'chat'>, WorkspaceSurface>;
  beforeChange: (view: PanelWorkspaceView) => void;
  changed: (view: PanelWorkspaceView) => void;
}) {
  const { panel, chat, views, runtime, navigation } = options;
  const show = (view: PanelWorkspaceView): void => {
    options.beforeChange(view);
    if (panel.dataset.view === 'chat' && view !== 'chat') navigation.capture(options.conversation());
    panel.dataset.view = view;
    if (view === 'settings') runtime.modelRow.insertBefore(runtime.row, runtime.modelActions);
    else panel.insertBefore(runtime.row, runtime.settings);
    chat.el.hidden = view !== 'chat';
    for (const [name, surface] of Object.entries(views)) {
      if (name === 'settings') surface.el.classList.toggle('agent-panel-settings-hidden', view !== name);
      else surface.el.hidden = view !== name;
      surface.trigger.setAttribute('aria-expanded', String(view === name));
    }
    options.changed(view);
    if (!options.isOpen()) return;
    if (view !== 'chat') views[view].focus();
    else if (!navigation.restore(options.conversation(), true)) chat.focus();
  };
  for (const [name, surface] of Object.entries(views)) {
    surface.trigger.addEventListener('click', () =>
      show(panel.dataset.view === name ? 'chat' : (name as PanelWorkspaceView)),
    );
    surface.el.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented || event.keyCode === 229) return;
      event.stopPropagation();
      show('chat');
      surface.trigger.focus();
    });
  }
  return { show };
}
