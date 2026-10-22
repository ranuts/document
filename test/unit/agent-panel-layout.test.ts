import { afterEach, expect, it, vi } from 'vitest';
import { createPanelWorkspace } from '../../lib/agent-plugin/ui/panel-workspace';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('changes split presentation without re-entering routes or discarding mounted artifact work', () => {
  const panel = document.createElement('section');
  let width = 1040;
  vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, width, 900));
  const chatEl = document.createElement('div');
  const input = document.createElement('textarea');
  chatEl.append(input);
  const beforeChange = vi.fn();
  const changed = vi.fn();
  const capture = vi.fn();
  const surface = () => {
    const el = document.createElement('section');
    const trigger = document.createElement('button');
    const target = document.createElement('button');
    el.append(target);
    panel.append(el, trigger);
    return { el, trigger, focus: vi.fn(() => target.focus()) };
  };
  const views = { settings: surface(), history: surface(), sources: surface(), artifacts: surface() };
  const source = document.createElement('textarea');
  source.value = 'Retained artifact draft';
  views.artifacts.el.append(source);
  const row = document.createElement('div');
  const modelRow = document.createElement('div');
  const modelActions = document.createElement('div');
  modelRow.append(modelActions);
  views.settings.el.append(modelRow);
  panel.append(row, chatEl);
  document.body.append(panel);
  const workspace = createPanelWorkspace({
    panel,
    chat: { el: chatEl, focus: () => input.focus() },
    navigation: { capture, restore: () => false },
    conversation: () => 'c1',
    isOpen: () => true,
    runtime: { row, settings: views.settings.el, modelRow, modelActions },
    views,
    beforeChange,
    changed,
  });
  workspace.show('artifacts');
  expect(chatEl.hidden).toBe(false);
  expect(panel.dataset.split).toBe('true');
  source.setSelectionRange(2, 8);
  input.focus();
  width = 480;
  panel.dispatchEvent(new Event('agentlayoutchange'));
  expect(chatEl.hidden).toBe(true);
  expect(document.activeElement).not.toBe(input);
  width = 1040;
  panel.dispatchEvent(new Event('agentlayoutchange'));
  expect(chatEl.hidden).toBe(false);
  expect(source.value).toBe('Retained artifact draft');
  expect([source.selectionStart, source.selectionEnd]).toEqual([2, 8]);
  expect(beforeChange).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(views.artifacts.trigger.getAttribute('aria-current')).toBe('page');
  const captured = capture.mock.calls.length;
  // A header click can move focus out of Chat before route navigation starts.
  views.history.trigger.focus();
  workspace.show('history');
  expect(capture).toHaveBeenCalledTimes(captured + 1);
});
