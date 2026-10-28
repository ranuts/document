/**
 * The handful of values every other slice of the generator needs.
 *
 * `ROOT` is resolved from this file, which sits one directory deeper than the
 * entry point -- hence `../..`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ORIGIN = 'https://edit.chaxus.com';
export const REPO = 'https://github.com/ranuts/document';
export const SITE_NAME = 'Online Document Editor';

/**
 * The author, shared with chaxus.com and the ran sites. `id`, `name` and `url`
 * must stay identical in all three places: the graph merges on `@id`.
 */
export const AUTHOR = {
  id: 'https://chaxus.com/#person',
  name: 'chaxus',
  url: 'https://chaxus.com/',
  sameAs: ['https://github.com/chaxus'],
};

/** chaxus.com has an English root and a Chinese section; other locales get English. */
export const authorHome = (locale) => (locale === 'zh-CN' ? 'https://chaxus.com/zh/' : AUTHOR.url);
