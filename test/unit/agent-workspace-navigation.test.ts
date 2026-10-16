import { expect, it, vi } from 'vitest';
import { createWorkspaceNavigation } from '../../lib/agent-plugin/ui/workspace-navigation';
it('keeps snapshots per conversation, forgets deleted entries and bounds retention', () => {
  let value = { composer: { focused: true } };
  const chat = { captureNavigation: vi.fn(() => value), restoreNavigation: vi.fn(), focus: vi.fn() };
  const navigation = createWorkspaceNavigation(chat as never, 2);
  navigation.capture('a');
  value = { composer: { focused: false } };
  navigation.capture('b');
  navigation.restore('a', true);
  expect(chat.restoreNavigation).toHaveBeenLastCalledWith({ composer: { focused: true } }, { focus: true });
  navigation.capture('c');
  expect(navigation.restore('b')).toBe(false);
  expect(navigation.restore('new')).toBe(false);
  navigation.forget('a');
  expect(navigation.restore('a')).toBe(false);
  navigation.forget();
  expect(navigation.restore('c')).toBe(false);
});
it('does not focus a historical reader composer when returning from a workspace view', () => {
  const chat = {
    captureNavigation: () => ({ composer: { focused: false } }),
    restoreNavigation: vi.fn(),
    focus: vi.fn(),
  };
  const navigation = createWorkspaceNavigation(chat as never);
  navigation.capture('a');
  navigation.restore('a', true);
  expect(chat.restoreNavigation).toHaveBeenCalledWith({ composer: { focused: false } }, { focus: true });
  expect(chat.focus).not.toHaveBeenCalled();
});
it('never borrows a snapshot from another conversation with identical content', () => {
  const snapshot = { composer: { focused: false }, transcript: { anchor: { fingerprint: 'same message' }, top: 120 } };
  const chat = { captureNavigation: () => snapshot, restoreNavigation: vi.fn() };
  const navigation = createWorkspaceNavigation(chat as never);
  navigation.capture('original');
  expect(navigation.restore('identical-content-new-conversation', true)).toBe(false);
  expect(chat.restoreNavigation).not.toHaveBeenCalled();
});
