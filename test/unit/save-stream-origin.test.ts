import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDiskWriter } from '../../lib/onlyoffice/save-stream';

vi.mock('@ranuts/converter', () => ({
  X2TConverter: class {},
  saveFileToDisk: vi.fn(),
}));

describe('editor save message boundary', () => {
  let frame: HTMLIFrameElement;
  let files: File[];

  beforeEach(() => {
    files = [];
    frame = document.createElement('iframe');
    frame.name = 'frameEditor';
    document.body.appendChild(frame);
    setDiskWriter(async (file) => {
      files.push(file);
      return true;
    });
  });

  afterEach(() => {
    setDiskWriter(null);
    frame.remove();
  });

  function send(source: MessageEventSource | null, origin: string) {
    window.dispatchEvent(
      new MessageEvent('message', {
        source,
        origin,
        data: {
          type: 'onlyoffice-file-stream',
          fileName: 'document.docx',
          fileType: 'docx',
          buffer: new Uint8Array([1, 2, 3]).buffer,
        },
      }),
    );
  }

  it('accepts bytes from the same-origin editor frame', async () => {
    send(frame.contentWindow, window.location.origin);
    await vi.waitFor(() => expect(files).toHaveLength(1));
    expect(files[0].name).toBe('document.docx');
    expect(files[0].size).toBe(3);
  });

  it.each(['opener', 'unrelated-frame', 'no-source', 'wrong-origin'])('ignores a forged save from %s', async (kind) => {
    const unrelated = document.createElement('iframe');
    document.body.appendChild(unrelated);
    try {
      const source =
        kind === 'no-source'
          ? null
          : kind === 'opener'
            ? window
            : kind === 'unrelated-frame'
              ? unrelated.contentWindow
              : frame.contentWindow;
      send(source, kind === 'wrong-origin' ? 'https://untrusted.example' : window.location.origin);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(files).toHaveLength(0);
    } finally {
      unrelated.remove();
    }
  });
});
