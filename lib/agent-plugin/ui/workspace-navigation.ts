import type { ChatNavigationSnapshot, ChatView } from '@ranuts/chat-ui';

/** Volatile presentation memory; drafts and conversation persistence belong to the host. */
export function createWorkspaceNavigation(chat: Pick<ChatView, 'captureNavigation' | 'restoreNavigation'>, limit = 50) {
  const snapshots = new Map<string, ChatNavigationSnapshot>();
  const capacity = Math.max(1, Math.min(100, Math.floor(limit) || 50));
  return {
    capture(id: string): void {
      snapshots.delete(id);
      snapshots.set(id, chat.captureNavigation());
      while (snapshots.size > capacity) snapshots.delete(snapshots.keys().next().value!);
    },
    restore(id: string, focus = false): boolean {
      const snapshot = snapshots.get(id);
      if (!snapshot) return false;
      snapshots.delete(id);
      snapshots.set(id, snapshot);
      chat.restoreNavigation(snapshot, { focus });
      return true;
    },
    forget(id?: string): void {
      if (id) snapshots.delete(id);
      else snapshots.clear();
    },
  };
}
