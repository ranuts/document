import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applySiteThemeToEditor,
  hasUserPickedEditorTheme,
  installEditorThemeFollow,
  isSiteDark,
  resolveEditorUiTheme,
} from '../../lib/editor-theme';

const LIGHT = 'theme-classic-light';
const html = document.documentElement;

afterEach(() => {
  html.removeAttribute('data-ran-theme');
  for (const k of ['ran-theme', 'ui-theme-id', 'ui-theme-site-driven']) window.localStorage.removeItem(k);
});

describe('isSiteDark', () => {
  it('reads the effective ranui attribute first', () => {
    html.setAttribute('data-ran-theme', 'dark');
    expect(isSiteDark()).toBe(true);
    html.setAttribute('data-ran-theme', 'light');
    window.localStorage.setItem('ran-theme', 'dark');
    expect(isSiteDark()).toBe(false);
  });

  it('falls back to the stored intent, then the OS media query', () => {
    window.localStorage.setItem('ran-theme', 'dark');
    expect(isSiteDark()).toBe(true);
    window.localStorage.setItem('ran-theme', 'system');
    expect(isSiteDark()).toBe(false); // vitest setup: matchMedia.matches = false
  });
});

describe('resolveEditorUiTheme', () => {
  it('maps a dark site to theme-dark and remembers that it drove it', () => {
    html.setAttribute('data-ran-theme', 'dark');
    expect(resolveEditorUiTheme(LIGHT)).toBe('theme-dark');
    expect(window.localStorage.getItem('ui-theme-site-driven')).toBe('theme-dark');
    expect(hasUserPickedEditorTheme()).toBe(false);
  });

  it('a light site gets the classic default', () => {
    html.setAttribute('data-ran-theme', 'light');
    expect(resolveEditorUiTheme(LIGHT)).toBe(LIGHT);
  });

  it('a theme the user picked inside the editor wins over the site', () => {
    html.setAttribute('data-ran-theme', 'dark');
    window.localStorage.setItem('ui-theme-id', 'theme-white');
    expect(hasUserPickedEditorTheme()).toBe(true);
    expect(resolveEditorUiTheme(LIGHT)).toBe('theme-white');
  });

  it('an editor-persisted copy of the driven theme is not a user choice', () => {
    html.setAttribute('data-ran-theme', 'dark');
    resolveEditorUiTheme(LIGHT);
    // The editor writes ui-theme-id with the theme it was told to use.
    window.localStorage.setItem('ui-theme-id', 'theme-dark');
    expect(hasUserPickedEditorTheme()).toBe(false);
    html.setAttribute('data-ran-theme', 'light');
    expect(resolveEditorUiTheme(LIGHT)).toBe(LIGHT);
  });
});

describe('applySiteThemeToEditor / installEditorThemeFollow', () => {
  function fakeEditorRoot(current = LIGHT) {
    const setTheme = vi.fn((id: string) => {
      current = id;
    });
    const frame = { Common: { UI: { Themes: { setTheme, currentThemeId: () => current } } }, frames: [] };
    const root = { frames: [frame] } as unknown as Window;
    return { root, setTheme };
  }

  it('pushes the site theme into every editor frame that exposes Common.UI.Themes', () => {
    const { root, setTheme } = fakeEditorRoot();
    html.setAttribute('data-ran-theme', 'dark');
    expect(applySiteThemeToEditor(LIGHT, root)).toBe('theme-dark');
    expect(setTheme).toHaveBeenCalledWith('theme-dark');
    // Same theme again: no redundant call.
    applySiteThemeToEditor(LIGHT, root);
    expect(setTheme).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the user overrode the theme inside the editor', () => {
    const { root, setTheme } = fakeEditorRoot();
    window.localStorage.setItem('ui-theme-id', 'theme-night');
    html.setAttribute('data-ran-theme', 'dark');
    expect(applySiteThemeToEditor(LIGHT, root)).toBeNull();
    expect(setTheme).not.toHaveBeenCalled();
  });

  it('reacts to <html data-ran-theme> flips until disposed', async () => {
    const setTheme = vi.fn();
    const frame = { Common: { UI: { Themes: { setTheme, currentThemeId: () => LIGHT } } }, frames: [] };
    const original = Object.getOwnPropertyDescriptor(window, 'frames');
    Object.defineProperty(window, 'frames', { configurable: true, value: [frame] });
    const dispose = installEditorThemeFollow(LIGHT);
    try {
      html.setAttribute('data-ran-theme', 'dark');
      await new Promise((r) => setTimeout(r, 0));
      expect(setTheme).toHaveBeenCalledWith('theme-dark');
      dispose();
      setTheme.mockClear();
      html.setAttribute('data-ran-theme', 'light');
      await new Promise((r) => setTimeout(r, 0));
      expect(setTheme).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(window, 'frames', original);
    }
  });
});
