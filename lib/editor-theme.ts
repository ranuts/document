/**
 * Site theme -> editor interface theme.
 *
 * The site (landing pages and the app shell) is themed by ranui: the
 * effective light/dark is the `data-ran-theme` attribute on <html> (ranui's
 * setTheme writes it, and in "system" mode resolves prefers-color-scheme into
 * it), the user's intent lives in localStorage `ran-theme`. The OnlyOffice
 * editor has its own theme system (`uitheme=` frame parameter at boot,
 * `Common.UI.Themes.setTheme` at runtime, persisted as `ui-theme-id` only
 * when the theme actually changes). Before this module the two were
 * unrelated: a dark site opened a light editor.
 *
 * Rules:
 * - A theme the user picked *inside the editor* wins (it is what
 *   `ui-theme-id` holds when it differs from the last value we drove).
 * - Otherwise the editor follows the site: dark -> `theme-dark`,
 *   light -> the classic default; and it keeps following while the document
 *   is open (theme switch in the top bar / OS switch in system mode).
 * - Every theme we drive is remembered in `ui-theme-site-driven`; when the
 *   editor persists that same id it is not mistaken for a user choice.
 */

export const SITE_THEME_ATTR = 'data-ran-theme';
export const SITE_THEME_STORAGE_KEY = 'ran-theme';
export const EDITOR_THEME_STORAGE_KEY = 'ui-theme-id';
export const SITE_DRIVEN_THEME_STORAGE_KEY = 'ui-theme-site-driven';
export const DARK_UI_THEME = 'theme-dark';

const DARK_MQ = '(prefers-color-scheme: dark)';

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (privacy mode / sandboxed frame): the
    // follow logic then just re-derives on every call.
  }
}

/** Effective site appearance right now. */
export function isSiteDark(): boolean {
  const attr = document.documentElement.getAttribute(SITE_THEME_ATTR);
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  const stored = storageGet(SITE_THEME_STORAGE_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  try {
    return !!window.matchMedia?.(DARK_MQ)?.matches;
  } catch {
    return false;
  }
}

export function uiThemeForSite(lightDefault: string): string {
  return isSiteDark() ? DARK_UI_THEME : lightDefault;
}

/** True when `ui-theme-id` holds a choice the user made inside the editor. */
export function hasUserPickedEditorTheme(): boolean {
  const stored = storageGet(EDITOR_THEME_STORAGE_KEY);
  if (!stored || !stored.trim()) return false;
  return stored.trim() !== storageGet(SITE_DRIVEN_THEME_STORAGE_KEY);
}

/**
 * Theme to mount the editor with. Records the driven value so a later
 * `ui-theme-id` write of the same id is still recognised as ours.
 */
export function resolveEditorUiTheme(lightDefault: string): string {
  const stored = storageGet(EDITOR_THEME_STORAGE_KEY);
  if (hasUserPickedEditorTheme() && stored) return stored.trim();
  const theme = uiThemeForSite(lightDefault);
  storageSet(SITE_DRIVEN_THEME_STORAGE_KEY, theme);
  return theme;
}

interface ThemesApi {
  setTheme?: (id: string) => void;
  currentThemeId?: () => string;
}

/** Runtime theme API of every mounted editor frame (web-apps `Common.UI.Themes`). */
function editorThemeApis(root: Window): ThemesApi[] {
  const out: ThemesApi[] = [];
  const visit = (win: Window, depth: number): void => {
    if (depth > 3) return;
    try {
      const themes = (win as unknown as { Common?: { UI?: { Themes?: ThemesApi } } }).Common?.UI?.Themes;
      if (themes && typeof themes.setTheme === 'function') out.push(themes);
    } catch {
      // cross-origin frame
    }
    let count = 0;
    try {
      count = win.frames.length;
    } catch {
      return;
    }
    for (let i = 0; i < count; i++) visit(win.frames[i], depth + 1);
  };
  visit(root, 0);
  return out;
}

/** Push the site-derived theme into every live editor frame (no-op when the user overrode it). */
export function applySiteThemeToEditor(lightDefault: string, root: Window = window): string | null {
  if (hasUserPickedEditorTheme()) return null;
  const theme = uiThemeForSite(lightDefault);
  const apis = editorThemeApis(root);
  // Record before calling setTheme: the editor persists ui-theme-id inside
  // setTheme, and the marker must already match when it does.
  storageSet(SITE_DRIVEN_THEME_STORAGE_KEY, theme);
  for (const api of apis) {
    try {
      if (api.currentThemeId?.() === theme) continue;
      api.setTheme?.(theme);
    } catch {
      // A frame mid-boot can throw; the next change or the next open re-applies.
    }
  }
  return theme;
}

/**
 * Keep the editor following the site theme for the page's lifetime:
 * observes ranui's <html data-ran-theme> flips and, for "system" mode
 * before ranui has resolved it, the OS media query. Returns a disposer.
 */
export function installEditorThemeFollow(lightDefault: string): () => void {
  const apply = () => {
    applySiteThemeToEditor(lightDefault);
  };
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === SITE_THEME_ATTR)) apply();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [SITE_THEME_ATTR] });

  let mq: MediaQueryList | null = null;
  try {
    mq = window.matchMedia?.(DARK_MQ) ?? null;
    mq?.addEventListener?.('change', apply);
  } catch {
    mq = null;
  }
  return () => {
    observer.disconnect();
    try {
      mq?.removeEventListener?.('change', apply);
    } catch {
      // ignore
    }
  };
}
