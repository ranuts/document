import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
const frames: HTMLIFrameElement[] = [];
afterEach(() => {
  for (const frame of frames) frame.remove();
  frames.length = 0;
});
function setup() {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  frames.push(frame);
  const win = frame.contentWindow!;
  const source = readFileSync('public/sdkjs/cell/sdk-all.js', 'utf8');
  const start = source.indexOf('var Y=!1;a.addEventListener&&a.addEventListener("beforeunload"');
  if (start < 0) throw new Error('External formula lifecycle registration changed; audit updated SDK');
  const end = source.indexOf('}};p.prototype.onOpenCellEditor=', start);
  if (end < 0) throw new Error('External formula lifecycle boundary changed');
  let closes = 0;
  let external = true;
  const editor = {
    wb: { isFormulaEditMode: true },
    getExternalFormulaEditMode: () => external,
    sendExternalCloseEditor: () => {
      closes++;
    },
  };
  // Execute the actual shipped closure and registrations, retaining its state.
  new Function('a', 'aa', source.slice(start, end))(win, editor);
  return {
    win,
    editor,
    closes: () => closes,
    setExternal: (value: boolean) => {
      external = value;
    },
  };
}
it('keeps the departure warning and closes external formula editing on cached pagehide instead of unload', () => {
  const s = setup();
  const before = new Event('beforeunload', { cancelable: true });
  s.win.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(true);
  s.win.dispatchEvent(new Event('unload'));
  expect(s.closes()).toBe(0);
  s.win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(s.closes()).toBe(1);
});
it('does not close the formula editor when departure never requested a warning', () => {
  const s = setup();
  s.setExternal(false);
  const before = new Event('beforeunload', { cancelable: true });
  s.win.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(false);
  s.win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(s.closes()).toBe(0);
});
it('does not close an inactive formula editor after a warning, or merely when departure is cancelled', () => {
  const s = setup();
  s.win.dispatchEvent(new Event('beforeunload', { cancelable: true }));
  expect(s.closes()).toBe(0);
  s.editor.wb.isFormulaEditMode = false;
  s.win.dispatchEvent(new PageTransitionEvent('pagehide'));
  expect(s.closes()).toBe(0);
});
it('forgets the prior warning after cached return before a departure without external editing', () => {
  const s = setup();
  s.win.dispatchEvent(new Event('beforeunload', { cancelable: true }));
  s.win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(s.closes()).toBe(1);
  s.win.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  s.setExternal(false);
  const next = new Event('beforeunload', { cancelable: true });
  s.win.dispatchEvent(next);
  expect(next.defaultPrevented).toBe(false);
  s.win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(s.closes()).toBe(1);
});
it('recomputes a cancelled warning before the next departure and consumes cleanup once', () => {
  const s = setup();
  s.win.dispatchEvent(new Event('beforeunload', { cancelable: true }));
  s.setExternal(false);
  s.win.dispatchEvent(new Event('beforeunload', { cancelable: true }));
  s.win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(s.closes()).toBe(0);
  s.setExternal(true);
  s.win.dispatchEvent(new Event('beforeunload', { cancelable: true }));
  s.win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  s.win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(s.closes()).toBe(1);
});
