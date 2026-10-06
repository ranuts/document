import { expect, it } from 'vitest';
import { fontSources } from '../../lib/onlyoffice/guards/x2t-worker';

function frame(name = 'ASCW3', size = 6) {
  const data = new Uint8Array([99, 0, 1, 0, 0, 17, 29, 88]);
  const scope = {
    location: { href: 'https://editor.test/web-apps/apps/documenteditor/main/index.html' },
    AscCommon: {
      g_font_loader: { fontFilesPath: '../../../../fonts/', fontFiles: [{ Id: '100', GetStreamIndex: () => 0 }] },
    },
    AscFonts: {
      g_font_infos: [{ Name: name, NeedStyles: 1, indexR: 0, indexI: -1, indexB: -1, indexBI: -1 }],
      getFontStream: () => ({ data: data.subarray(1, 7), size }),
    },
  };
  return { data, scope: scope as unknown as Parameters<typeof fontSources>[0] };
}

it('copies only the decoded embedded symbol stream bounds without retaining its backing heap', () => {
  const { data, scope } = frame();
  const source = fontSources(scope)[0];
  expect(source.fileName).toBe('ASCW3.ttf');
  expect(Array.from(source.bytes!)).toEqual([0, 1, 0, 0, 17, 29]);
  data.fill(0);
  expect(Array.from(source.bytes!)).toEqual([0, 1, 0, 0, 17, 29]);
  expect(source.bytes!.buffer.byteLength).toBe(6);
});

it('keeps ordinary font streams on the URL path', () => {
  const source = fontSources(frame('Arial').scope)[0];
  expect(source.bytes).toBeUndefined();
  expect(source.url).toBe('https://editor.test/fonts/100');
});

it('retains the URL when the embedded stream API is absent', () => {
  const { scope } = frame();
  delete scope.AscFonts!.getFontStream;
  const source = fontSources(scope)[0];
  expect(source.bytes).toBeUndefined();
  expect(source.url).toBe('https://editor.test/fonts/100');
});

it('retains the URL when reading a stale embedded stream throws', () => {
  const { scope } = frame();
  scope.AscFonts!.getFontStream = () => {
    throw new Error('Stream retired');
  };
  const source = fontSources(scope)[0];
  expect(source.bytes).toBeUndefined();
  expect(source.url).toBe('https://editor.test/fonts/100');
});

it.each([0, -1, 1000000, 7, NaN])('falls back to its URL for invalid embedded stream size %s', (size) => {
  const source = fontSources(frame('ASCW3', size).scope)[0];
  expect(source.bytes).toBeUndefined();
  expect(source.url).toBe('https://editor.test/fonts/100');
});
