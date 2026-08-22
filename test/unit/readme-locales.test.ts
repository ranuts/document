import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The readme is the project's front page, and it now exists in the same eight
 * languages the site's own language menu offers. What goes wrong with a set of
 * translated files is not that one is badly written -- it is that one drifts:
 * a section gets added to the English one and nowhere else, or a new language
 * is added and the older files never learn to link to it, leaving a menu that
 * is missing an entry depending on which file you landed on.
 *
 * So this pins the shape, not the prose: same set of files, every file links
 * to every other one, and every file carries the same sections in the same
 * order.
 */
const ROOT = resolve(__dirname, '../..');

/** File name -> the label its own switcher entry shows. Order is the menu order. */
const READMES: Array<[file: string, label: string]> = [
  ['readme.md', 'English'],
  ['readme.zh.md', '简体中文'],
  ['readme.ja.md', '日本語'],
  ['readme.ko.md', '한국어'],
  ['readme.de.md', 'Deutsch'],
  ['readme.es.md', 'Español'],
  ['readme.pt.md', 'Português'],
  ['readme.fa.md', 'فارسی'],
];

const read = (file: string) => readFileSync(resolve(ROOT, file), 'utf8');

/** Heading levels in order, e.g. ['#', '##', '##'] -- the document's skeleton. */
const skeleton = (markdown: string): string[] =>
  markdown
    .split('\n')
    .filter((line) => /^#{1,3} /.test(line))
    .map((line) => line.match(/^#+/)![0]);

/** Fenced code blocks, which are the same commands in every language. */
const codeBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map(([, lang]) => lang);

describe('readme translations', () => {
  it.each(READMES)('%s exists', (file) => {
    expect(existsSync(resolve(ROOT, file)), `${file} is in the language switcher but not on disk`).toBe(true);
  });

  it.each(READMES)('%s links to every other language, and marks itself', (file) => {
    const markdown = read(file);
    for (const [other, otherLabel] of READMES) {
      if (other === file) {
        expect(markdown, `${file} should mark ${otherLabel} as the current language`).toContain(`<b>${otherLabel}</b>`);
      } else {
        expect(markdown, `${file} does not link to ${other}`).toContain(`<a href="${other}">${otherLabel}</a>`);
      }
    }
  });

  /**
   * Structure, not wording: a translation that quietly lost the Docker section
   * still reads fine on its own, and only someone reading that language would
   * find out the hard way.
   */
  it.each(READMES.filter(([file]) => file !== 'readme.md'))('%s has the same sections as the English one', (file) => {
    expect(skeleton(read(file))).toEqual(skeleton(read('readme.md')));
  });

  it.each(READMES.filter(([file]) => file !== 'readme.md'))('%s carries the same code blocks', (file) => {
    expect(codeBlocks(read(file))).toEqual(codeBlocks(read('readme.md')));
  });

  /** The live URL and the license are facts, not prose; they must not be "translated". */
  it.each(READMES)('%s keeps the shared links intact', (file) => {
    const markdown = read(file);
    expect(markdown).toContain('https://edit.chaxus.com/');
    expect(markdown).toContain('[AGPL-3.0](LICENSE)');
    expect(markdown).toContain('ghcr.io/ranuts/document:latest');
  });
});
