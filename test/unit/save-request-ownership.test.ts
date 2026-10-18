import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setDocmentObj } from '@ranuts/shared/store';
import { cancelDocumentOpen } from '../../lib/document-open';
import { installServerlessSaveSemantics } from '../../lib/onlyoffice/guards/serverless-save';
import { markDocumentContentReady, resetOpenState } from '../../lib/onlyoffice/open-state';
import { setReadonlyState } from '../../lib/onlyoffice/readonly';
import { requestSaveDocument, setDiskWriter, SAVE_REQUEST_TIMEOUT_MS } from '../../lib/onlyoffice/save-stream';

let frame: HTMLIFrameElement;
let conversions: Array<{ finish: (value: { binary: Uint8Array }) => void }>;
let writes: File[];
let api: { asc_Save: (auto?: boolean) => void; asc_DownloadAs: () => void; isLongAction: () => boolean };

beforeEach(() => {
  vi.useFakeTimers();
  resetOpenState();
  setReadonlyState(false);
  history.replaceState(null, '', '/editor');
  setDocmentObj({ fileName: 'A.docx', file: new File(['original A'], 'A.docx') });
  frame = document.createElement('iframe');
  frame.name = 'frameEditor';
  document.body.append(frame);
  conversions = [];
  writes = [];
  const win = frame.contentWindow!;
  const converter = {
    convertFromBin: () => new Promise<{ binary: Uint8Array }>((finish) => conversions.push({ finish })),
    downloadFile: (binary: Uint8Array) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: win,
          origin: location.origin,
          data: { type: 'onlyoffice-file-stream', fileType: 'docx', buffer: binary.buffer },
        }),
      );
    },
  };
  api = {
    asc_Save: () => {},
    isLongAction: () => false,
    asc_DownloadAs: () => {
      if (!api.isLongAction()) void converter.convertFromBin().then(({ binary }) => converter.downloadFile(binary));
    },
  };
  Object.assign(win, {
    AscCommon: { x2t: converter },
    Asc: {
      editor: { ...api, documentFormatSave: 65, isLoadFullApi: true, isDocumentLoadComplete: true },
      asc_CDownloadOptions: class {},
    },
  });
  api = (win as any).Asc.editor;
  window.editor = { downloadAs: vi.fn() } as any;
  installServerlessSaveSemantics(win);
  setDiskWriter(async (file) => {
    writes.push(file);
    return 'written';
  });
});

afterEach(async () => {
  await vi.runAllTimersAsync();
  setDiskWriter(null);
  frame.remove();
  window.editor = undefined;
  vi.useRealTimers();
});

it.each(['replace', 'close'])('rejects a readiness-waiting save immediately on %s', async (operation) => {
  let failure: Error | undefined;
  void requestSaveDocument('DOCX').catch((error) => {
    failure = error;
  });
  if (operation === 'replace') {
    setDocmentObj({ fileName: 'B.docx' });
    window.editor = { downloadAs: vi.fn() } as any;
    resetOpenState();
  } else cancelDocumentOpen();
  await vi.advanceTimersByTimeAsync(0);
  expect(failure?.name).toBe('AbortError');
  markDocumentContentReady();
  await vi.advanceTimersByTimeAsync(150_000);
  expect(conversions).toHaveLength(0);
});

it('never returns a replacement original from the opt-in timeout fallback', async () => {
  const result = requestSaveDocument('DOCX', { returnOriginalOnTimeout: true }).catch((error: Error) => error);
  setDocmentObj({ fileName: 'B.docx', file: new File(['B'], 'B.docx') });
  window.editor = { downloadAs: vi.fn() } as any;
  await vi.advanceTimersByTimeAsync(8000);
  expect(await result).toMatchObject({ name: 'AbortError' });
});

it('keeps the same-document opt-in original fallback available', async () => {
  const result = requestSaveDocument('DOCX', { returnOriginalOnTimeout: true });
  await vi.advanceTimersByTimeAsync(8000);
  expect(await result).toMatchObject({ name: 'A.docx', size: 10 });
});

it.each(['snapshot first', 'manual first'])('preserves the manual disk save when %s finishes', async (order) => {
  markDocumentContentReady();
  const snapshot = requestSaveDocument('DOCX');
  await vi.advanceTimersByTimeAsync(0);
  api.asc_Save(false);
  expect(conversions).toHaveLength(2);
  for (const index of order === 'snapshot first' ? [0, 1] : [1, 0]) {
    conversions[index].finish({ binary: new Uint8Array(index === 0 ? [1] : [2, 2]) });
    await vi.advanceTimersByTimeAsync(0);
  }
  expect(await snapshot).toMatchObject({ name: 'A.docx', size: 1 });
  expect(writes.map((file) => [file.name, file.size])).toEqual([['A.docx', 2]]);
});

it('does not let an expired conversion satisfy a later programmatic request', async () => {
  markDocumentContentReady();
  const expired = requestSaveDocument('DOCX').catch((error: Error) => error);
  await vi.advanceTimersByTimeAsync(SAVE_REQUEST_TIMEOUT_MS);
  expect(await expired).toMatchObject({ message: expect.stringContaining('timed out') });
  const next = requestSaveDocument('DOCX');
  await vi.advanceTimersByTimeAsync(0);
  conversions[0].finish({ binary: new Uint8Array([1]) });
  conversions[1].finish({ binary: new Uint8Array([2, 2]) });
  await vi.advanceTimersByTimeAsync(0);
  expect(await next).toMatchObject({ name: 'A.docx', size: 2 });
  expect(writes).toHaveLength(0);
});

it('waits for stream tracking before starting a cold editor export', async () => {
  const common = (frame.contentWindow as any).AscCommon;
  const converter = common.x2t;
  delete common.x2t;
  markDocumentContentReady();
  const snapshot = requestSaveDocument('DOCX').catch((error: Error) => error);
  await vi.advanceTimersByTimeAsync(0);
  expect(conversions).toHaveLength(0);
  common.x2t = converter;
  await vi.advanceTimersByTimeAsync(500);
  expect(conversions).toHaveLength(1);
  conversions[0].finish({ binary: new Uint8Array([1]) });
  await vi.advanceTimersByTimeAsync(0);
  expect(await snapshot).toMatchObject({ name: 'A.docx', size: 1 });
  expect(writes).toHaveLength(0);
});
