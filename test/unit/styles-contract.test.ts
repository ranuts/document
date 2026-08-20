import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The rules that replaced Tailwind's preflight.
 *
 * Dropping the framework (2026-08-20) left the editor page rendering under the
 * browser's own defaults, and the replacement rules are the only thing standing
 * in for a reset that used to apply to every element. Nothing else references
 * them, so a tidy-up deletes them silently: the failures they prevent are a
 * body with an 8 px margin pushing the editor iframe out of the viewport, and
 * native controls sized as if their padding were zero -- `.agent-launcher` is a
 * 48 px circle only if its 48 px includes the UA's `1px 6px`.
 *
 * The FAB regression happened exactly this way, on a surface (`?agent=1`) no
 * E2E case opens, which is why the check is cheap and lives here.
 */
const ROOT = resolve(__dirname, '../..');
const css = readFileSync(resolve(ROOT, 'styles/base.css'), 'utf8');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** The declarations of one rule, by its exact selector list. */
const block = (selector: string): string => {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `styles/base.css must still declare \`${selector}\``).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

describe('styles/base.css stands in for the preflight it replaced', () => {
  it('keeps the body flush and #app full-screen (was html,body h-full + w-full h-full)', () => {
    expect(block('html,\nbody')).toMatch(/margin:\s*0/);
    expect(block('html,\nbody')).toMatch(/height:\s*100%/);
    expect(block('#app')).toMatch(/width:\s*100%/);
    expect(block('#app')).toMatch(/height:\s*100%/);
  });

  it('resets native controls, which size themselves as preflight left them', () => {
    const controls = block('button,\ninput,\nselect,\ntextarea');
    expect(controls).toMatch(/font:\s*inherit/);
    // Without this the agent launcher renders 60x50 -- an ellipse, not a FAB.
    expect(controls).toMatch(/box-sizing:\s*border-box/);
    expect(block('button')).toMatch(/padding:\s*0/);
  });

  it('sizes the agent panel to the width the editor actually gives up', () => {
    // 360px + a 1px border under content-box is 361px against a
    // `calc(100% - 360px)` iframe: a hairline of document down the seam.
    expect(block('.agent-panel')).toMatch(/box-sizing:\s*border-box/);
  });

  it('brings in no CSS framework, by import or by dependency', () => {
    expect(css).not.toMatch(/@import\s+['"](?!\.)/);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(deps)) {
      expect(name, 'design values come from the ranui token layer, not a framework').not.toMatch(
        /tailwind|bootstrap|bulma/i,
      );
    }
  });
});

/**
 * The same reset, where the components that need it actually live.
 *
 * `.cui-send` / `.cui-scroll-bottom` are fixed-size circles in
 * @ranuts/chat-ui, and the site's global `button { padding: 0 }` above is what
 * kept them round -- a coupling nothing states and nothing else in the
 * ecosystem provides, so the same package in another host renders the 60x50
 * ellipse this repo already shipped once.
 */
describe('the packaged chat UI does not rely on the host for its own geometry', () => {
  const packaged = readFileSync(resolve(ROOT, 'packages/chat-ui/src/styles.ts'), 'utf8');

  const rule = (selector: string): string => {
    const at = packaged.indexOf(`\n${selector} {`);
    expect(at, `chat-ui styles must still declare \`${selector}\``).toBeGreaterThan(-1);
    return packaged.slice(at, packaged.indexOf('}', at));
  };

  for (const selector of ['.cui-send', '.cui-scroll-bottom']) {
    it(`${selector} owns its box`, () => {
      expect(rule(selector)).toMatch(/box-sizing:\s*border-box/);
      expect(rule(selector)).toMatch(/padding:\s*0/);
    });
  }
});
