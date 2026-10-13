import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolve local exports to source in dev/tests while production uses built packages.
 * @param {string} root
 * @returns {import('vite').Alias[]}
 */
export function workspaceSourceAliases(root) {
  /** @type {import('vite').Alias[]} */
  const aliases = [];
  for (const dir of readdirSync(resolve(root, 'packages'), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const packageRoot = resolve(root, 'packages', dir.name);
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
    for (const [subpath, entry] of Object.entries(manifest.exports)) {
      const specifier = manifest.name + (subpath === '.' ? '' : subpath.slice(1));
      const source = resolve(packageRoot, entry.import.replace('./dist/', './src/').replace(/\.js$/, '.ts'));
      const escape = (part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      aliases.push({
        find: new RegExp('^' + specifier.split('*').map(escape).join('(.+)') + '$'),
        replacement: source.replace('*', '$1'),
      });
    }
  }
  return aliases;
}
