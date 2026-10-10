import { afterEach, expect, it, vi } from 'vitest';
import { createAgentEntry } from '../../lib/agent-entry';
const runtime = vi.hoisted(() => ({ create: vi.fn(), enable: vi.fn().mockResolvedValue(undefined), open: vi.fn() }));
vi.mock('../../lib/agent-plugin/agent-plugin', () => ({
  createAgentPanel: runtime.create,
  setAgentPanelEnabled: runtime.enable,
  setAgentPanelOpen: runtime.open,
}));
afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  document.body.innerHTML = '';
  localStorage.clear();
  vi.clearAllMocks();
});
it('opens a default-off welcome without importing the runtime or honoring the old URL flag', () => {
  history.replaceState(null, '', '/editor?agent=1');
  const entry = createAgentEntry();
  entry.toggle();
  const toggle = document.querySelector<HTMLButtonElement>('.agent-enable-switch')!;
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  expect(document.querySelector('.agent-onboarding')?.classList.contains('agent-panel-hidden')).toBe(false);
  expect(runtime.create).not.toHaveBeenCalled();
});
it('enables explicitly, remembers the choice and never prepares a model on its own', async () => {
  const entry = createAgentEntry();
  entry.toggle();
  document.querySelector<HTMLButtonElement>('.agent-enable-switch')!.click();
  await vi.waitFor(() => expect(runtime.create).toHaveBeenCalledOnce());
  expect(localStorage.getItem('document-assistant-enabled')).toBe('true');
  expect(runtime.enable).toHaveBeenCalledWith(true);
});
it('a remembered choice stays lazy until the user opens the assistant', async () => {
  localStorage.setItem('document-assistant-enabled', 'true');
  const entry = createAgentEntry();
  expect(runtime.create).not.toHaveBeenCalled();
  entry.toggle();
  await vi.waitFor(() => expect(runtime.create).toHaveBeenCalledOnce());
});
it('keeps the welcome usable when browser storage is unavailable', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const entry = createAgentEntry();
  entry.toggle();
  document.querySelector<HTMLButtonElement>('.agent-enable-switch')!.click();
  await vi.waitFor(() => expect(runtime.create).toHaveBeenCalledOnce());
  get.mockRestore();
  set.mockRestore();
});
