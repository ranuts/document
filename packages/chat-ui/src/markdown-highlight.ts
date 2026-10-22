import type { HighlighterCore, ThemedToken } from 'shiki/core';

/** Fixed imports: model language names can never choose a module URL. */
const languages = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
};
type Language = keyof typeof languages;
const aliases: Record<string, Language> = {
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  py: 'python',
  python: 'python',
  json: 'json',
  html: 'html',
  css: 'css',
  sh: 'bash',
  shell: 'bash',
  bash: 'bash',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
};
const names: Record<Language, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  python: 'Python',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  bash: 'Shell',
  sql: 'SQL',
  yaml: 'YAML',
  markdown: 'Markdown',
};
export function codeLanguage(info: string | undefined): { id?: Language; label: string } {
  const name = info?.trim().split(/\s/, 1)[0].slice(0, 64).toLowerCase() ?? '';
  const id = Object.hasOwn(aliases, name) ? aliases[name] : undefined;
  return { id, label: id ? names[id] : name };
}
export const CODE_HIGHLIGHT_LIMIT = 8000;
let core: Promise<HighlighterCore> | undefined;
const loaded = new Map<Language, Promise<void>>();
function getCore(): Promise<HighlighterCore> {
  return (core ??= Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/themes/github-light.mjs'),
    import('shiki/themes/github-dark.mjs'),
  ]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark]) =>
    createHighlighterCore({ engine: createJavaScriptRegexEngine(), themes: [light.default, dark.default], langs: [] }),
  ));
}
/** Tokens only. Consumers append textContent and colors, never highlighter HTML. */
export async function highlightCode(source: string, language: Language): Promise<ThemedToken[][]> {
  const highlighter = await getCore();
  let ready = loaded.get(language);
  if (!ready) {
    ready = languages[language]().then((module) => highlighter.loadLanguage(module.default));
    loaded.set(language, ready);
  }
  await ready;
  return highlighter.codeToTokens(source, {
    lang: language,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    includeExplanation: false,
  }).tokens;
}
