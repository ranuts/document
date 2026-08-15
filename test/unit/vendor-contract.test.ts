import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Vendor contract sentinel (docs/superpowers/plans/2026-08-15-v9-test-coverage-strategy.md
 * section 5). lib/onlyoffice-editor.ts patches the OnlyOffice vendor build at
 * runtime by name (prepareEditorIframe guards, triggerPersonalDownloadAs,
 * installOpenFailureGuard) and the corpus/E2E harness reads SDK flags by
 * name. None of that is a public API: a vendor upgrade can rename or drop
 * any of it silently and the guards would just stop applying. Pin what we
 * depend on so an upgrade turns the test red first, with a pointer to what
 * must be re-verified. When this fails on purpose (vendor bump), re-check
 * every guard against the new build, then update the expectations here.
 */
const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('vendor contract sentinel', () => {
  const editors = ['cell', 'word', 'slide'] as const;

  it.each(editors)('sdkjs/%s/sdk-all-min.js still exposes every symbol the runtime guards hook', (editor) => {
    const src = read(`public/sdkjs/${editor}/sdk-all-min.js`);
    for (const symbol of [
      // guard 3 (fetchFonts race), guard 4 (image pipeline)
      'fetchFonts',
      'sendImgUrls',
      'g_oDocumentUrls',
      'getImageLocal',
      // guard 5 (serverless save semantics)
      'asc_setAutoSaveGap',
      'autoSaveGapFast',
      'asc_Save',
      'asc_DownloadAs',
      'asc_CDownloadOptions',
      // readiness flags used by triggerPersonalDownloadAs and the corpus harness
      'isDocumentLoadComplete',
      'isLoadFullApi',
      // runtime readonly, error routing (installOpenFailureGuard sendEvent path)
      'asc_setRestriction',
      'asc_registerCallback',
      'ConvertationOpenError',
      'asc_onEndAction',
    ]) {
      expect(src.includes(symbol), `${editor}: missing '${symbol}'`).toBe(true);
    }
  });

  it('slide SDK still loads the theme catalog from <themesPath>/themes.js (our stub relies on it)', () => {
    const src = read('public/sdkjs/slide/sdk-all-min.js');
    expect(src).toContain('SetThemesPath');
    expect(src).toContain('/themes.js');
    expect(existsSync(resolve(ROOT, 'public/sdkjs/slide/themes/themes.js'))).toBe(true);
    expect(read('public/sdkjs/slide/themes/themes.js')).toContain('g_defaultThemes');
  });

  it('x2t_helper.js keeps the file-stream contract and the conversion entry points we wrap', () => {
    const src = read('public/sdkjs/common/wasm/x2t/x2t_helper.js');
    for (const symbol of [
      'onlyoffice-file-stream',
      'OO_FILE_STREAM_ONLY',
      'convertToBin',
      'convertFromBin',
      '_convertDocument',
      'sanitizeFileName',
      'Document conversion failed',
      'Conversion failed with code',
    ]) {
      expect(src.includes(symbol), `x2t_helper: missing '${symbol}'`).toBe(true);
    }
  });

  it('x2t.wasm.gz is the verified 9.4 build (hash pinned; re-verify every guard on change)', () => {
    const bytes = readFileSync(resolve(ROOT, 'public/sdkjs/common/wasm/x2t/x2t.wasm.gz'));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    expect(sha256).toBe('767c5d2cb6808fbdaaece1ea48e29a709399bb594eeb0ccd42633e7c0d5d8e7c');
  });

  it('x2t.js glue still stubs the HTML importer (isHtmlDocument routing exists because of this)', () => {
    // If a future wasm build links CHtmlFile2, the SheetJS detour for
    // HTML-as-xls becomes optional; revisit lib/converter.ts then.
    expect(read('public/sdkjs/common/wasm/x2t/x2t.js')).toContain('_ZN10CHtmlFile2C1Ev');
  });
});
