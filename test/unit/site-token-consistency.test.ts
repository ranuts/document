import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');
it('uses the supported modal heading API', () => {
  expect(read('lib/confirm-dialog.ts')).toContain(".attr('heading', options.title)");
});
it('keeps the textual home destination visible at narrow widths', () => {
  for (const file of ['public/home.css', 'public/landing.css']) {
    expect(read(file)).not.toMatch(/(?:#landing-hero|header\.bar) \.wordmark\s*\{\s*display:\s*none/);
  }
});
it('does not leave fallback-masked or removed design roles in first-party surfaces', () => {
  const files = ['public/home.css', 'public/landing.css', 'public/404.html', 'packages/chat-ui/src/styles.ts'];
  for (const file of files) {
    expect(read(file).replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(
      /var\(--(?:ran-color-focus-ring|ran-space-5|ran-size-8|rule|mono|ink|ink-2|muted|signal)[,)]/,
    );
  }
});
it('gates queue hover feedback on the enabled state', () => {
  expect(read('styles/assistant.css')).not.toMatch(/\.agent-(?:request-queue|queue-actions) button:hover\s*\{/);
});
it('defines native destructive action states without a literal foreground', () => {
  const css = read('styles/confirm-dialog.css');
  expect(css).toContain('--confirm-hover: var(--app-danger-hover)');
  expect(css).toContain('--confirm-active: var(--app-danger-active)');
  expect(css).not.toMatch(/--confirm-foreground:\s*#fff/);
  expect(read('lib/confirm-dialog.ts')).toContain('ButtonBuilder()');
});

it('resolves every authored and freshly generated page role with scoped dependencies', async () => {
  const { auditDesignTokens } = await import('../../bin/design-tokens.mjs');
  const { generate } = await import('../../bin/build-pages.mjs');
  expect(auditDesignTokens(process.cwd(), generate({ outDir: null }))).toEqual([]);
});
it('rejects unknown foundation and removed local roles even with fallbacks', async () => {
  const { unresolvedTokens } = await import('../../bin/design-tokens.mjs');
  expect(
    unresolvedTokens('a{color:var(--ran-typo,red);background:var(--ink,white)}', [' :root{--ran-color-text:black}']),
  ).toEqual(['--ink', '--ran-typo']);
  expect(unresolvedTokens('a{color:var(--ran-color-text,black)}', [':root{--ran-color-text:black}'])).toEqual([]);
  expect(unresolvedTokens('a{color:var(--page-private)}', [':root{--ran-color-text:black}'])).toEqual([
    '--page-private',
  ]);
  expect(
    unresolvedTokens('/* color:var(--old) */ a{--local:var(--ran-color-text);color:var(--local)}', [
      ':root{--ran-color-text:black}',
    ]),
  ).toEqual([]);
});
it('includes the application role layer before page styles on every entry and generated page', async () => {
  const { generate } = await import('../../bin/build-pages.mjs');
  const pages = ['index.html', 'editor.html', 'history.html', 'public/404.html', 'public/embed-demo.html'].map(
    (file) => ({ rel: file, html: read(file) }),
  );
  for (const { rel, html } of [...pages, ...generate({ outDir: null })]) {
    expect(html, rel).toContain('href="/app-tokens.css"');
    expect(html.indexOf('/app-tokens.css'), rel).toBeGreaterThan(html.indexOf('/ran-tokens.css'));
  }
});

it('rejects raw semantic metrics while allowing fluid geometry and real standalone fallbacks', async () => {
  const { semanticLiterals, designTokenSources, authoredStyles } = await import('../../bin/design-tokens.mjs');
  expect(semanticLiterals('a{padding:8px 16px;font-size:13px;border-radius:12px}')).toHaveLength(3);
  expect(semanticLiterals('a{padding:var(--ran-space-2,8px);font-size:clamp(24px,4vw,40px);margin:-1px}')).toEqual([]);
  // Logical properties carry more than one hyphen; the property name has to be
  // read through all of them or the declaration is never checked at all.
  expect(semanticLiterals('a{padding-inline-start:12px;margin-block-end:8px}')).toEqual([
    'padding-inline-start: 12px',
    'margin-block-end: 8px',
  ]);
  const { generate } = await import('../../bin/build-pages.mjs');
  for (const file of designTokenSources(process.cwd())) {
    expect(semanticLiterals(authoredStyles(file, read(file))), file).toEqual([]);
  }
  for (const { rel, html } of generate({ outDir: null })) {
    expect(semanticLiterals(authoredStyles(rel, html)), rel).toEqual([]);
  }
});
it('never transitions a palette property, so a theme flip is instant', async () => {
  // CSS cannot tell why a colour changed, so a palette property in a transition
  // also fades when the theme flips its token — each surface at its own
  // duration while the page around it snaps. DESIGN.md §5 bans the default.
  const { paletteTransitions, designTokenSources, authoredStyles } = await import('../../bin/design-tokens.mjs');
  expect(paletteTransitions('a{transition:0.15s ease}')).toHaveLength(1);
  expect(paletteTransitions('a{transition:all .2s}')).toHaveLength(1);
  expect(paletteTransitions('a{transition:background .15s, color .15s}')).toHaveLength(1);
  expect(paletteTransitions('a{transition:transform .15s, color .15s}')).toHaveLength(1);
  expect(paletteTransitions('a{transition:transform .15s, opacity .2s}')).toEqual([]);
  expect(paletteTransitions('a{transition:none}')).toEqual([]);
  // The documented opt-in hook is the consumer's value, not ours to judge.
  expect(paletteTransitions('a{transition:var(--ran-input-transition, none)}')).toEqual([]);
  const { generate } = await import('../../bin/build-pages.mjs');
  for (const file of designTokenSources(process.cwd())) {
    expect(paletteTransitions(authoredStyles(file, read(file))), file).toEqual([]);
  }
  for (const { rel, html } of generate({ outDir: null })) {
    expect(paletteTransitions(authoredStyles(rel, html)), rel).toEqual([]);
  }
});
it('does not borrow application roles when an HTML consumer omits the role stylesheet', async () => {
  const { auditDesignTokens } = await import('../../bin/design-tokens.mjs');
  expect(
    auditDesignTokens(process.cwd(), [
      {
        rel: 'missing-layer.html',
        html: '<link href="/ran-tokens.css" rel="stylesheet"><style>a{height:var(--app-control-page,42px)}</style>',
      },
    ]),
  ).toContainEqual({ file: 'generated/missing-layer.html', missing: ['--app-control-page'] });
});

it('rejects unary signs prefixed to CSS functions in every authored and generated stylesheet', async () => {
  const { invalidTokenArithmetic, authoredStyles, designTokenSources } = await import('../../bin/design-tokens.mjs');
  const { generate } = await import('../../bin/build-pages.mjs');
  expect(invalidTokenArithmetic('a{margin:-var(--ran-space-2);margin-left:-calc(var(--ran-space-3)/2)}')).toEqual([
    '-var(',
    '-calc(',
  ]);
  expect(
    invalidTokenArithmetic('a{margin:calc(-1 * var(--ran-space-2));margin-left:calc(var(--ran-space-3)/-2)}'),
  ).toEqual([]);
  for (const file of designTokenSources(process.cwd())) {
    expect(invalidTokenArithmetic(authoredStyles(file, read(file))), file).toEqual([]);
  }
  for (const { rel, html } of generate({ outDir: null }))
    expect(invalidTokenArithmetic(authoredStyles(rel, html)), rel).toEqual([]);
});
it('audits shared Markdown block styles as a standalone component consumer', async () => {
  const { designTokenSources } = await import('../../bin/design-tokens.mjs');
  expect(designTokenSources(process.cwd())).toContain('packages/chat-ui/src/markdown-styles.ts');
});
