import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  delete (window as unknown as { AscCommon?: unknown }).AscCommon;
  vi.unstubAllGlobals();
});

it('writes decoded embedded font bytes without a network request or wire decoding', async () => {
  const w = window as unknown as {
    AscCommon?: {
      x2t: {
        x2tModule: unknown;
        setFontSources: (sources: unknown[]) => void;
        fetchFonts: () => Promise<void>;
      };
    };
  };
  delete w.AscCommon;
  new Function(readFileSync(resolve(__dirname, '../../public/sdkjs/common/wasm/x2t/x2t_helper.js'), 'utf8'))();
  const files = new Map<string, number[]>();
  w.AscCommon!.x2t.x2tModule = {
    FS: {
      writeFile(path: string, bytes: Uint8Array) {
        files.set(path, Array.from(bytes));
      },
    },
  };
  vi.stubGlobal('fetch', () => {
    throw new Error('Embedded font must remain available offline');
  });
  w.AscCommon!.x2t.setFontSources([
    { fileName: 'ASCW3.ttf', url: '/fonts/100', bytes: new Uint8Array([0, 1, 0, 0, 17, 29]) },
  ]);
  await w.AscCommon!.x2t.fetchFonts();
  expect(files.get('/working/fonts/ASCW3.ttf')).toEqual([0, 1, 0, 0, 17, 29]);
});

it('still decodes ordinary font wire bytes when no embedded bytes are supplied', async () => {
  const w = window as unknown as {
    AscCommon?: {
      x2t: {
        x2tModule: unknown;
        setFontSources: (sources: unknown[]) => void;
        fetchFonts: () => Promise<void>;
      };
    };
  };
  delete w.AscCommon;
  new Function(readFileSync(resolve(__dirname, '../../public/sdkjs/common/wasm/x2t/x2t_helper.js'), 'utf8'))();
  const files = new Map<string, number[]>();
  w.AscCommon!.x2t.x2tModule = {
    FS: {
      writeFile(path: string, bytes: Uint8Array) {
        files.set(path, Array.from(bytes));
      },
    },
  };
  // Independently encoded raw TTF prefix [0,1,0,0,17,29]. A wrong branch or
  // missing XOR would leave the wire prefix in the converter filesystem.
  vi.stubGlobal('fetch', async (url: string) => {
    if (url !== '/fonts/ordinary') throw new Error('Unexpected font source');
    return { ok: true, arrayBuffer: async () => new Uint8Array([160, 103, 214, 32, 5, 139]).buffer };
  });
  w.AscCommon!.x2t.setFontSources([{ fileName: 'Ordinary.ttf', url: '/fonts/ordinary' }]);
  await w.AscCommon!.x2t.fetchFonts();
  expect(files.get('/working/fonts/Ordinary.ttf')).toEqual([0, 1, 0, 0, 17, 29]);
});
