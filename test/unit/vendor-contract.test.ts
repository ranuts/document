import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { X2T_INITIAL_PAGES, X2T_MAXIMUM_PAGES } from '../../lib/onlyoffice/wasm-memory';

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
      // Our streaming-instantiation patch: without it the 40.2 MB inflated
      // module is back in the peak at the exact moment x2t asks for its 283 MB
      // heap (GitHub #144). A re-vendored helper would drop it silently.
      'instantiateWasm',
      'canStreamWasm',
      'instantiateStreaming',
      // The prefix that makes a streaming failure reach installOpenFailureGuard
      // instead of stalling until the 60 s init timeout. Losing it costs no
      // test but a minute of spinner per failed x2t load.
      'X2T module failed to instantiate',
      // One bad answer from the CDN for a 9.4 MB file used to cost the whole
      // open (a Cloudflare 500 mid-run, PR #159). A re-vendored helper would
      // drop the retry as silently as it would drop the streaming path.
      'WASM_FETCH_ATTEMPTS',
      // The dual-environment branches guard 14 depends on. This file runs both
      // in the editor frame and inside x2t.worker.js, and a re-vendored copy
      // that dropped them would put x2t's 283 MB heap back in the frame for
      // the life of the frame, silently.
      'globalScope',
      'hasDocument',
      'importScripts',
      'setFontSources',
    ]) {
      expect(src.includes(symbol), `x2t_helper: missing '${symbol}'`).toBe(true);
    }
  });

  it('ships the worker entry guard 14 loads x2t through', () => {
    const src = read('public/sdkjs/common/wasm/x2t/x2t.worker.js');
    // It must load the same helper rather than reimplement a conversion:
    // format codes, the doc/xls/ppt two-step, the PDF-changes merge and the
    // exit-code classification all live in that one file.
    expect(src).toContain("importScripts('x2t_helper.js')");
    expect(src).toContain('setFontSources');
    expect(src).toContain('convertToBin');
    expect(src).toContain('convertFromBin');
  });

  it('x2t.wasm is the verified 9.4 build (content hash pinned; re-verify every guard on change)', () => {
    // Hash the *decompressed* module, not the container around it. That is the
    // invariant worth pinning -- "these are the vendor's bytes" -- and it
    // survives recompressing, which we have now done twice (zopfli gzip, then
    // brotli; see the size guard below). Pinning the container instead would
    // have tied provenance to the choice of compressor.
    const wasm = brotliDecompressSync(readFileSync(resolve(ROOT, 'public/sdkjs/common/wasm/x2t/x2t.wasm.br')));
    expect(createHash('sha256').update(wasm).digest('hex')).toBe(
      '7db02f5c74976a82c3fe630c371a163d5df669a6c84fddc553f03e76f67d3dd2',
    );
  });

  it('x2t.wasm stays brotli-compressed (the largest download in the app)', () => {
    // 6,898,179 bytes with `brotli -q 11`, against 9,483,006 for the best gzip
    // we could produce (zopfli --i15) and 42,111,200 raw: 2.58 MB off the
    // single biggest download in the app. brotli is not a repo dependency
    // (one-off, ~80 s of CPU), so this bound is the reminder: after a vendor
    // bump, run
    //   brotli -q 11 -c x2t.wasm > x2t.wasm.br && mv x2t.wasm.br x2t.wasm
    // The content hash above is what proves the bytes inside are unchanged.
    //
    // The file keeps the plain `.wasm` name and every host declares
    // `Content-Encoding: br` for it, so the browser decodes it at the network
    // layer -- see the hosting contract test, which pins that declaration.
    const size = readFileSync(resolve(ROOT, 'public/sdkjs/common/wasm/x2t/x2t.wasm.br')).length;
    expect(size).toBeLessThan(7_200_000);
  });

  it('x2t.wasm still declares the memory lib/onlyoffice/wasm-memory.ts quotes to the user', () => {
    // The out-of-memory message says "about 283 MB" and the probe asks for the
    // declared maximum by number (GitHub #144). Both come from the wasm memory
    // section, so read it out of the binary rather than trusting a comment: a
    // vendor build with different limits would leave the user-facing number
    // wrong and the probe measuring the wrong thing.
    //
    // Neither number is a tunable -- `initial` cannot go below the module's
    // ~267 MB static/BSS floor and `maximum` is a hard ceiling. If a bump
    // lands here, run `node bin/x2t-memory-report.mjs` before changing the
    // constants: it prints the floor and the slack above it.
    const wasm = brotliDecompressSync(readFileSync(resolve(ROOT, 'public/sdkjs/common/wasm/x2t/x2t.wasm.br')));
    let offset = 8; // magic + version
    const uleb = () => {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = wasm[offset++];
        result |= (byte & 0x7f) << shift;
        shift += 7;
      } while (byte & 0x80);
      return result;
    };

    let declared: { initial: number; maximum: number | null } | null = null;
    while (offset < wasm.length && declared === null) {
      const id = wasm[offset++];
      const size = uleb();
      const end = offset + size;
      if (id === 5) {
        // Memory section: one entry, `flags & 1` meaning "has a maximum".
        uleb();
        const flags = uleb();
        const initial = uleb();
        declared = { initial, maximum: flags & 1 ? uleb() : null };
      }
      offset = end;
    }

    expect(declared).toEqual({ initial: X2T_INITIAL_PAGES, maximum: X2T_MAXIMUM_PAGES });
  });

  it('x2t.js glue still stubs the HTML importer (isHtmlDocument routing exists because of this)', () => {
    // If a future wasm build links CHtmlFile2, the SheetJS detour for
    // HTML-as-xls becomes optional; revisit lib/converter.ts then.
    expect(read('public/sdkjs/common/wasm/x2t/x2t.js')).toContain('_ZN10CHtmlFile2C1Ev');
  });

  /**
   * The asm.js fallbacks (*_ie.js, 27.5 MB) were removed: every one of them is
   * chosen only when WebAssembly is unavailable, and x2t makes a browser
   * without WebAssembly unable to open a document at all. That deletion is
   * safe exactly as long as the *condition* stays a WebAssembly check -- if a
   * vendor bump starts picking the _ie variant for some other reason, the
   * files it wants are gone and the failure is a 404 answered with index.html
   * ("Unexpected token '<'"), which is not an obvious symptom.
   */
  it.each(editors)('sdkjs/%s/sdk-all-min.js still gates every asm.js fallback on WebAssembly', (editor) => {
    const src = read(`public/sdkjs/${editor}/sdk-all-min.js`);
    const mentions = [...src.matchAll(/"([a-z]+)_ie\.js"/g)];
    expect(mentions.length, 'no _ie reference at all -- the switch was renamed').toBeGreaterThan(0);
    for (const mention of mentions) {
      // Either an inline WebAssembly probe or the useWasm flag set from one.
      const preceding = src.slice(Math.max(0, mention.index - 400), mention.index);
      expect(preceding, `${mention[1]}_ie.js is chosen without a WebAssembly check`).toMatch(/WebAssembly|useWasm/);
    }
  });

  /**
   * sdk-all-min.js is the bootstrap; sdk-all.js is the full API bundle loaded
   * after it (save-stream.ts waits on isLoadFullApi for exactly this). It
   * looks like dead weight -- requirejs pins `sdk: ".../sdk-all-min"` and
   * nothing in web-apps names the unminified file outside the vendor's own
   * cache-warming pages -- and deleting it on that reasoning turned 11 specs
   * red with "Unexpected token '<'". Both halves have to stay.
   */
  it.each(editors)('sdkjs/%s ships both the bootstrap and the full API bundle', (editor) => {
    for (const bundle of ['sdk-all-min.js', 'sdk-all.js']) {
      expect(existsSync(resolve(ROOT, `public/sdkjs/${editor}/${bundle}`)), `${editor}/${bundle}`).toBe(true);
    }
  });
});
