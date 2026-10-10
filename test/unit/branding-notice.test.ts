import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { injectLocalChromeCss } from '../../lib/onlyoffice/guards/chrome';
import { installAboutSourceNotice } from '../../lib/onlyoffice/guards/about-source';
import { generate } from '../../bin/build-pages.mjs';

/** Legal attribution stays available independently of product branding. */
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

describe('neutral editor with legal attribution', () => {
  it('keeps a neutral title after the editor updates its document caption', async () => {
    const frame = document.createElement('iframe');
    frame.id = 'branding-fixture';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.title = 'Report.docx - ONLYOFFICE';
    injectLocalChromeCss(doc);
    expect(doc.title).toBe('Report.docx');
    doc.title = '* Renamed.docx - ONLYOFFICE';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(doc.title).toBe('* Renamed.docx');
    doc.title = 'ONLYOFFICE migration.docx';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(doc.title).toBe('ONLYOFFICE migration.docx');
  });

  afterEach(() => {
    document.querySelector('#branding-fixture')?.remove();
    document.querySelector('#oo-local-chrome-css')?.remove();
  });
  it('hides product marks but preserves the About entry, copyright and version', () => {
    const doc = document;
    const fixture = doc.createElement('section');
    fixture.id = 'branding-fixture';
    doc.body.appendChild(fixture);
    fixture.innerHTML = `<div id="header-logo"><i></i></div>
      <button id="left-btn-about">About</button><div id="about-menu-panel">
      <div class="asc-about-office"></div><div id="id-about-company-logo"></div>
      <label class="asc-about-companyname">Ascensio System SIA</label>
      <label id="id-about-licensor-version-name">9.3.0</label></div>`;
    injectLocalChromeCss(doc);
    for (const selector of ['#header-logo', '.asc-about-office', '#id-about-company-logo']) {
      expect(window.getComputedStyle(doc.querySelector(selector)!).display).toBe('none');
    }
    for (const selector of ['#left-btn-about', '.asc-about-companyname', '#id-about-licensor-version-name']) {
      expect(window.getComputedStyle(doc.querySelector(selector)!).display).not.toBe('none');
    }
  });

  it('offers source, license, copyright and warranty information from About', () => {
    const doc = document.implementation.createHTMLDocument('Editor');
    doc.body.innerHTML = '<div id="about-menu-panel"><p>Ascensio System SIA</p></div>';
    installAboutSourceNotice(doc);
    installAboutSourceNotice(doc);
    expect(doc.querySelectorAll('#oo-source-notice')).toHaveLength(1);
    const notice = doc.querySelector('#oo-source-notice')!;
    expect(notice.textContent).toContain('not an official ONLYOFFICE product');
    expect(notice.textContent).toContain('Copyright');
    expect(notice.textContent).toContain('WITHOUT ANY WARRANTY');
    expect(notice.querySelector('a[href="https://github.com/ranuts/document"]')).not.toBeNull();
    expect(notice.querySelector('a[href="/LICENSE"]')).not.toBeNull();
    expect(notice.querySelector('a[href="/NOTICE"]')).not.toBeNull();
  });

  it('adds the legal notice when the vendor populates About lazily', async () => {
    const panel = document.createElement('div');
    panel.id = 'about-menu-panel';
    document.body.appendChild(panel);
    try {
      installAboutSourceNotice(document);
      panel.innerHTML = '<p>Ascensio System SIA</p>';
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(panel.querySelectorAll('#oo-source-notice')).toHaveLength(1);
      expect(panel.textContent).toContain('WITHOUT ANY WARRANTY');
    } finally {
      panel.remove();
    }
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
