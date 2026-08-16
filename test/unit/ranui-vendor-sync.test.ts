import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ranui vendoring sentinel. Static pages under public/ cannot import from
 * node_modules, so bin/build.sh copies the per-component IIFE bundles the
 * pages reference into public/ranui-iife/ from the INSTALLED ranui. The
 * copies are committed; if someone edits or forgets to rebuild them, pages
 * silently run an older component build than the app (the "IIFE still on a
 * historical version" class). Pin: every referenced bundle exists, every
 * vendored bundle is byte-identical to the installed package's, and every
 * workspace package pins the same ranui/ranuts versions as the root.
 */
const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel));

describe('ranui vendored IIFE bundles', () => {
  const vendoredDir = resolve(ROOT, 'public/ranui-iife');
  const installedDir = resolve(ROOT, 'node_modules/ranui/dist/iife');
  const vendored = readdirSync(vendoredDir).filter((f) => f.endsWith('.iife.js'));

  it('are byte-identical to the installed ranui dist', () => {
    expect(vendored.length).toBeGreaterThan(0);
    for (const f of vendored) {
      const installed = resolve(installedDir, f);
      expect(existsSync(installed), `${f} is not shipped by the installed ranui`).toBe(true);
      expect(
        read(`public/ranui-iife/${f}`).equals(readFileSync(installed)),
        `${f} drifted from node_modules/ranui/dist/iife`,
      ).toBe(true);
    }
  });

  it('cover every bundle a static page references', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        if (e.name === 'sdkjs' || e.name === 'web-apps' || e.name === 'fonts') return [];
        const p = resolve(dir, e.name);
        return e.isDirectory() ? walk(p) : e.name.endsWith('.html') ? [p] : [];
      });
    const refs = new Set<string>();
    for (const html of walk(resolve(ROOT, 'public'))) {
      for (const m of readFileSync(html, 'utf8').matchAll(/ranui-iife\/([a-z-]+\.iife\.js)/g)) refs.add(m[1]);
    }
    expect(refs.size).toBeGreaterThan(0);
    for (const r of refs) expect(vendored, `page references ${r} but it is not vendored`).toContain(r);
  });
});

describe('ranui / ranuts versions', () => {
  const root = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  const installed = JSON.parse(readFileSync(resolve(ROOT, 'node_modules/ranui/package.json'), 'utf8')).version;

  it('the installed ranui is the version the root pins', () => {
    expect(installed).toBe(root.dependencies.ranui);
  });

  it('every workspace package pins the same ranui / ranuts as the root (a second copy = first-registered custom elements win, icons vanish)', () => {
    for (const pkg of readdirSync(resolve(ROOT, 'packages'))) {
      const file = resolve(ROOT, 'packages', pkg, 'package.json');
      if (!existsSync(file)) continue;
      const deps = {
        ...JSON.parse(readFileSync(file, 'utf8')).dependencies,
        ...JSON.parse(readFileSync(file, 'utf8')).peerDependencies,
      };
      if (deps.ranui) expect(deps.ranui, `packages/${pkg} ranui`).toBe(root.dependencies.ranui);
      if (deps.ranuts) expect(deps.ranuts, `packages/${pkg} ranuts`).toBe(root.dependencies.ranuts);
    }
  });
});
