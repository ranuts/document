import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../../bin/build-pages.mjs';

/**
 * The ONLYOFFICE attribution, pinned.
 *
 * This site is a derivative work of ONLYOFFICE, whose AGPL-3.0 headers add two
 * terms under Section 7 of that license: 7(b) requires the original product
 * logo to be retained when the program is distributed, and 7(e) declines to
 * grant any rights under trademark law. Both were being violated -- the header
 * logo was hidden by an injected stylesheet and the About pane switched off in
 * the DocEditor config, which left no product mark anywhere in the interface,
 * and no trademark notice existed in the repository or on the site.
 *
 * What makes this worth a test rather than a comment is how it happened: both
 * removals were deliberate UI tidy-ups ("strip the chrome a single-user local
 * editor does not need", docs/explorations/2026-08-12-v9-pure-ui-and-issue-regression-sweep.md).
 * The next tidy-up would do it again, and nothing else in the suite would go
 * red. So: the two suppressions cannot come back, and the notices cannot be
 * dropped. The runtime half -- that the logo and the About entry are really on
 * screen -- is test/e2e/vendor-branding.spec.ts.
 */
const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

/** The sentence that carries both terms, verbatim from the vendor's own headers. */
const SECTION_7 =
  'Pursuant to Section 7(b) of the License you must retain the original Product\n' +
  '    logo when distributing the program. Pursuant to Section 7(e) we decline to\n' +
  '    grant you any rights under trademark law for use of our trademarks.';

const READMES = [
  'readme.md',
  'readme.zh.md',
  'readme.ja.md',
  'readme.ko.md',
  'readme.de.md',
  'readme.es.md',
  'readme.pt.md',
  'readme.fa.md',
];

describe('ONLYOFFICE product logo (AGPL-3.0 Section 7(b))', () => {
  it('is not hidden by the chrome stylesheet the guards inject', () => {
    const guard = read('lib/onlyoffice/guards/chrome.ts');
    expect(guard, 'the header logo must not be hidden -- see NOTICE').not.toContain('#header-logo');
    // The guard still has a job: these two describe a collaboration session a
    // serverless build cannot have, and hiding them is unrelated to branding.
    expect(guard).toContain('.btn-current-user');
    expect(guard).toContain('#tlb-box-users');
  });

  it('is not removed with the About pane by the DocEditor config', () => {
    const editor = read('lib/onlyoffice-editor.ts');
    expect(editor, 'customization.about must stay at its default -- it is where the product logo lives').not.toMatch(
      /\babout:\s*false/,
    );
  });

  it("is joined in the About pane by this build's own source offer (AGPL-3.0 Section 13)", () => {
    const guard = read('lib/onlyoffice/guards/about-source.ts');
    expect(guard).toContain('about-menu-panel');
    expect(guard).toContain('https://github.com/ranuts/document');
    expect(guard).toMatch(/not an official ONLYOFFICE product/);
    // Mounted, or it is a file nothing runs.
    expect(read('lib/onlyoffice/iframe-guards.ts')).toContain('installAboutSourceNotice(doc)');
  });
});

describe('trademark notice (AGPL-3.0 Section 7(e))', () => {
  const notice = read('NOTICE');

  it('reproduces the vendor terms verbatim, and the vendor build still carries them', () => {
    expect(notice).toContain(SECTION_7);
    // The source of that quote: an unminified vendor file that ships with the
    // build. If an upgrade drops it, the quote above needs re-checking against
    // whatever the new build carries.
    const vendor = read('public/web-apps/apps/common/main/lib/util/fix-ie-compat.js');
    expect(vendor).toContain('Pursuant to Section 7(b) of the License you must retain the original Product');
    expect(vendor).toContain('Pursuant to Section 7(e) we decline to');
  });

  it('names the mark, its owner, and that this project is neither', () => {
    expect(notice).toContain('Ascensio System SIA');
    // The notice is hard-wrapped, so the phrases can straddle a line break.
    expect(notice.replace(/\s+/g, ' ')).toMatch(/not an official ONLYOFFICE product/);
    expect(notice.replace(/\s+/g, ' ')).toMatch(/not affiliated with/);
  });

  it('lists the changes made to the vendor tree (Section 5(a))', () => {
    for (const changed of ['x2t_helper.js', 'x2t.wasm', 'locale/*.json', 'public/fonts/']) {
      expect(notice, `NOTICE does not mention ${changed}`).toContain(changed);
    }
  });

  it.each(READMES)('%s points at it and carries the disclaimer', (file) => {
    const markdown = read(file);
    expect(markdown).toContain('(NOTICE)');
    expect(markdown).toContain('Ascensio System SIA');
    expect(markdown).toContain('ONLYOFFICE');
  });
});

describe('trademark notice on the site itself', () => {
  const outputs = generate({ outDir: null }) as Array<{ route: string; kind: string; html: string }>;

  it("is on every generated page, in that page's language", () => {
    expect(outputs.length).toBeGreaterThan(50);
    for (const page of outputs) {
      expect(page.html, `${page.route} has no trademark notice`).toContain('class="tm"');
      expect(page.html, `${page.route} does not name the trademark owner`).toContain('Ascensio System SIA');
    }
  });

  it('says it in Chinese on the Chinese pages, not in English', () => {
    const zh = outputs.find((o) => o.route === '/zh-CN/')!;
    expect(zh.html).toContain('ONLYOFFICE 是 Ascensio System SIA 的商标');
    const en = outputs.find((o) => o.route === '/')!;
    expect(en.html).toContain('ONLYOFFICE is a trademark of Ascensio System SIA');
  });

  it('is styled, or it is a paragraph of legalese in body copy', () => {
    expect(read('public/landing.css')).toContain('.page-foot .tm');
    expect(read('public/home.css')).toContain('#landing-hero .foot .tm');
  });
});
