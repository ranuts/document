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
    'packages/chat-ui/src/markdown-styles.ts',
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
  const markdownStyles = 'packages/chat-ui/src/markdown-styles.ts';
  const errors = [];
  const inspect = (file, source) => {
    // Only CSS in HTML participates: text, SVG artwork, meta colours and script
    // strings are not stylesheet consumers.
    const css = authoredStyles(file, source);
    const dependencies = file.endsWith('.html') ? [] : [foundation];
    if (!file.endsWith('.html') && file !== 'packages/chat-ui/src/styles.ts' && file !== markdownStyles)
      dependencies.push(application);
    if (file === 'styles/assistant.css') dependencies.push(sharedChat);
    if (file.endsWith('.html')) {
      for (const [, path] of source.matchAll(/<link[^>]*href="\/([^"?]+\.css)"/g)) {
        // Font files define @font-face, not application roles.
        dependencies.push(read(`public/${path}`));
      }
    }
    // The resizer writes this geometry onto the host at runtime. It is not a
    // colour/spacing role and has a local fallback before the panel mounts.
    const external =
      file === 'styles/assistant.css'
        ? ['--agent-panel-width']
        : // Shiki token colors are written onto safe spans at render time.
          file === markdownStyles
          ? ['--cui-token-light', '--cui-token-dark']
          : [];
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
      // Logical properties are hyphenated more than once
      // (`padding-inline-start`, `margin-block-end`). The character class has to
      // accept every hyphen, not just the first: with `[\w]+` the name matched
      // only `padding-inline`, the following `:` never arrived, and the whole
      // declaration went unchecked -- 3 literal insets hid behind that gap.
      /(?<![\w-])(font(?:-size)?|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|border-radius)\s*:\s*([^;{}]+)/g,
    ),
  ]
    .filter((match) => [...match[2].matchAll(/(-?\d+(?:\.\d+)?)px/g)].some((value) => Math.abs(Number(value[1])) > 1))
    .map((match) => `${match[1]}: ${match[2].trim()}`);
}

/**
 * A palette property in a `transition` also animates when the *theme* flips its
 * token, because CSS cannot tell why a value changed. Every surface then fades at
 * its own duration while the page around it snaps -- see DESIGN.md §5. Motion
 * properties (`transform`, `opacity`, box geometry) do not follow the theme and
 * are fine. `all` and bare durations mean `all`, so they include palette props.
 *
 * Each comma-separated transition is judged by its *first* token: a timing value
 * there means the property was omitted, i.e. `all`. A lone `var(--…-transition)`
 * is the documented opt-in hook and is skipped -- its value is the consumer's.
 */
export function paletteTransitions(source) {
  const palette =
    /^(?:all|background|background-color|color|border|border-color|border-[\w-]*color|box-shadow|fill|stroke|outline-color|text-decoration-color)$/;
  const timing =
    /^(?:[\d.]+m?s|ease|linear|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\(.*\)|steps\(.*\))$/;
  const found = [];
  for (const match of clean(source).matchAll(/(?:^|[;{])\s*transition(?:-property)?\s*:\s*([^;}]+)/g)) {
    const value = match[1].replace(/var\([^()]*\)/g, 'VAR').trim();
    if (value === 'VAR') continue;
    const offends = value.split(',').some((part) => {
      const first = part.trim().split(/\s+/)[0];
      if (!first) return false;
      // A hook variable in first position is indistinguishable from a duration;
      // only a named property or a literal timing value is decidable.
      return first !== 'VAR' && (timing.test(first) || palette.test(first));
    });
    if (offends) found.push(`transition: ${value.replace(/\s+/g, ' ')}`);
  }
  return found;
}

/** CSS functions cannot take a prefixed unary sign: negate their numeric value
 * inside calc(), e.g. calc(-1 * var(--space)), instead of -var(--space).
 */
export function invalidTokenArithmetic(source) {
  return [...clean(source).matchAll(/[+-](?:var|calc|clamp|min|max|env)\(/g)].map((match) => match[0]);
}
