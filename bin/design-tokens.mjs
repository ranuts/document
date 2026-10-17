import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const clean = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
const definitions = (source) => [...clean(source).matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);

/** Resolve each consumer against its dependencies, never another unrelated page.
 * Fallbacks are intentionally irrelevant: a removed role remains a contract bug.
 */
export function unresolvedTokens(source, dependencies = [], external = []) {
  const known = new Set([...dependencies, source].flatMap(definitions).concat(external));
  return [...new Set([...clean(source).matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]))]
    .filter((name) => !known.has(name))
    .sort();
}

/** First-party source inventory. Public vendor trees, fonts and generated pages
 * are excluded; generators are checked through their freshly rendered output.
 * New authored stylesheets in styles/ or public/ are automatically included.
 */
export function designTokenSources(root) {
  const sources = [];
  const collectCss = (directory) => {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory() && directory.startsWith('styles')) collectCss(file);
      else if (entry.isFile() && entry.name.endsWith('.css') && entry.name !== 'ran-tokens.css') sources.push(file);
    }
  };
  collectCss('styles');
  collectCss('public');
  return [
    ...sources,
    'packages/chat-ui/src/styles.ts',
    'index.html',
    'editor.html',
    'history.html',
    'public/404.html',
    'public/embed-demo.html',
  ];
}

export function authoredStyles(file, source) {
  return file.endsWith('.html')
    ? [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|\bstyle="([^"]*)"/gi)].map((m) => m[1] ?? m[2]).join('\n')
    : source;
}

export function auditDesignTokens(root, generated = []) {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const foundation = read('public/ran-tokens.css');
  const application = read('public/app-tokens.css');
  const sharedChat = read('packages/chat-ui/src/styles.ts');
  const errors = [];
  const inspect = (file, source) => {
    // Only CSS in HTML participates: text, SVG artwork, meta colours and script
    // strings are not stylesheet consumers.
    const css = authoredStyles(file, source);
    const dependencies = file.endsWith('.html') ? [] : [foundation];
    if (!file.endsWith('.html') && file !== 'packages/chat-ui/src/styles.ts') dependencies.push(application);
    if (file === 'styles/assistant.css') dependencies.push(sharedChat);
    if (file.endsWith('.html')) {
      for (const [, path] of source.matchAll(/<link[^>]*href="\/([^"?]+\.css)"/g)) {
        // Font files define @font-face, not application roles.
        dependencies.push(read(`public/${path}`));
      }
    }
    // The resizer writes this geometry onto the host at runtime. It is not a
    // colour/spacing role and has a local fallback before the panel mounts.
    const external = file === 'styles/assistant.css' ? ['--agent-panel-width'] : [];
    const missing = unresolvedTokens(css, dependencies, external);
    if (missing.length) errors.push({ file, missing });
  };
  for (const file of designTokenSources(root)) inspect(file, read(file));
  for (const page of generated) inspect(`generated/${page.rel}`, page.html);
  return errors;
}

/** Semantic spacing/type/corner values use tokens. Fluid viewport/brand art,
 * 1px optical offsets and the screen-reader-only -1px sentinel are geometry.
 * Standalone component fallbacks are allowed only inside validated var() calls.
 */
export function semanticLiterals(source) {
  let css = clean(source);
  // Remove balanced var()/clamp() expressions so nested standalone fallbacks
  // do not look like new literal design decisions.
  const removeFunctions = (text) => {
    let previous;
    do {
      previous = text;
      text = text.replace(/\b(?:var|clamp)\([^()]*\)/g, 'TOKEN');
    } while (text !== previous);
    return text;
  };
  css = removeFunctions(css);
  return [
    ...css.matchAll(
      /(?<![\w-])(font(?:-size)?|padding(?:-[\w]+)?|margin(?:-[\w]+)?|gap|border-radius)\s*:\s*([^;{}]+)/g,
    ),
  ]
    .filter((match) => [...match[2].matchAll(/(-?\d+(?:\.\d+)?)px/g)].some((value) => Math.abs(Number(value[1])) > 1))
    .map((match) => `${match[1]}: ${match[2].trim()}`);
}
