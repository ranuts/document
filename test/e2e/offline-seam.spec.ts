import { expect, test } from './lib/l0';
import { buildDocx, ooxmlDocumentText, toBase64 } from './lib/ooxml';

/**
 * Where the offline build already mocks the Docs Server, and where it does not.
 *
 * "Mock the Docs Server in the browser" is not a path we are off -- we are on
 * it, and the vendor put us there. The offline vendor build appends an IIFE
 * to `sdkjs/<app>/sdk-all-min.js` that sets `window.isOffline = true` and
 * replaces `AscCommon.DocsCoApi.prototype._initSocksJs` with an in-process
 * responder -- the co-authoring client still speaks the full server protocol
 * (auth / isSaveLock / saveChanges / getLock / documentOpen), it just talks to
 * a function instead of a socket. A hand-written MockSocket would replace that
 * responder with an equivalent one and buy nothing structural.
 *
 * What the same patch also establishes is a single seam for conversion. The
 * `Offline` controller (`web-apps/apps/<app>/main/app.js`) overrides
 * `Main.loadDocument` to do:
 *
 *     bin = await AscCommon.x2t.convertToBin(doc.url, doc.title, doc.fileType)
 *     this.api.loadDocumentData(bin)          // { binary, media }
 *
 * and saving goes back out through `AscCommon.x2t.convertFromBin(...)`. So
 * every byte x2t touches crosses two functions on one object. Moving x2t out
 * of the editor frame -- the thing that would make its 283 MB heap
 * terminatable instead of resident for the life of the frame -- is a matter of
 * replacing those two functions with a proxy, not of reimplementing a server.
 *
 * The only thing that could stop it is the realm boundary: whatever
 * `convertToBin` returns has to survive being created somewhere else. A worker
 * delivers its results as objects belonging to the *page's* realm, and the
 * editor consumes them inside the frame's realm, where `instanceof` against
 * frame constructors is false. So this test substitutes exactly that: it lets
 * the real conversion run, re-creates the result with the parent realm's
 * `structuredClone`, hands the foreign object to the editor, and then asks for
 * the document back. If the round trip keeps its text, the seam is realm-safe
 * and a worker can sit behind it.
 */

type ProbeNote = {
  fileName?: string;
  fileExt?: string;
  keys: string[];
  binaryType: string;
  binaryLength: number;
  mediaKeys: string[];
  crossRealm: boolean;
  crossRealmError?: string;
  /** False when the substituted value's constructor came from another realm. */
  sameConstructor: boolean | null;
};

type ProbeState = {
  toBin: ProbeNote[];
  fromBin: Array<{ targetExt?: string; fileExt?: string }>;
};

/**
 * Installed in every frame before any vendor script runs. The vendor writes
 * `window.AscCommon = window.AscCommon || {}`, so a pre-made object survives,
 * and `AscCommon['x2t'] = new X2TConverter()` (x2t_helper.js) then lands on an
 * accessor we own -- the same subscribe-on-assignment trick guard 10 uses.
 */
const installSeamProbe = () => {
  const w = window as unknown as Record<string, any>;
  const state: ProbeState = { toBin: [], fromBin: [] };
  w.__seamProbe = state;

  const asc = (w.AscCommon = w.AscCommon || {});
  let real: any;

  const describe = (value: unknown): { type: string; length: number } => {
    if (typeof value === 'string') return { type: 'string', length: value.length };
    if (value instanceof Uint8Array) return { type: 'Uint8Array', length: value.length };
    if (value instanceof ArrayBuffer) return { type: 'ArrayBuffer', length: value.byteLength };
    return { type: Object.prototype.toString.call(value), length: -1 };
  };

  const wrap = (converter: any) => {
    if (!converter || converter.__probed) return;
    if (typeof converter.convertToBin !== 'function') return;
    converter.__probed = true;

    // Accessors, not assignments. Guard 14 replaces both methods with its
    // worker proxy after this runs, so a plain assignment would be overwritten
    // and this would observe nothing while still passing. Wrapping through a
    // setter keeps the probe in front of whichever implementation ends up
    // there -- which is the point: the seam is what is pinned, not who fills
    // it.
    let toBinImpl = converter.convertToBin.bind(converter);
    const originalToBin = (...args: unknown[]) => toBinImpl(...args);
    const wrappedToBin = async function (data: unknown, fileName?: string, fileExt?: string) {
      const out = await originalToBin(data, fileName, fileExt);
      const shape = describe(out && out.binary);
      const note: ProbeNote = {
        fileName,
        fileExt,
        keys: Object.keys(out || {}),
        binaryType: shape.type,
        binaryLength: shape.length,
        mediaKeys: Object.keys((out && out.media) || {}),
        crossRealm: false,
        sameConstructor: null,
      };

      // Re-create the result in the parent realm, which is where a page-owned
      // worker would hand it over from, and give the editor that object.
      let returned = out;
      try {
        const parent = window.parent as unknown as Record<string, any>;
        if (parent && parent !== window && typeof parent.structuredClone === 'function') {
          returned = parent.structuredClone(out);
          note.crossRealm = true;
          note.sameConstructor = out && out.binary ? returned.binary.constructor === out.binary.constructor : null;
        }
      } catch (error) {
        note.crossRealmError = String((error as Error)?.message || error);
      }

      state.toBin.push(note);
      return returned;
    };
    Object.defineProperty(converter, 'convertToBin', {
      configurable: true,
      get: () => wrappedToBin,
      set: (fn: (...args: unknown[]) => unknown) => {
        toBinImpl = fn.bind(converter);
      },
    });

    if (typeof converter.convertFromBin === 'function') {
      let fromBinImpl = converter.convertFromBin.bind(converter);
      const wrappedFromBin = function (obj: any) {
        state.fromBin.push({ targetExt: obj && obj.targetExt, fileExt: obj && obj.fileExt });
        return fromBinImpl(obj);
      };
      Object.defineProperty(converter, 'convertFromBin', {
        configurable: true,
        get: () => wrappedFromBin,
        set: (fn: (...args: unknown[]) => unknown) => {
          fromBinImpl = fn.bind(converter);
        },
      });
    }
  };

  Object.defineProperty(asc, 'x2t', {
    configurable: true,
    enumerable: true,
    get: () => real,
    set: (value: unknown) => {
      real = value;
      wrap(value);
    },
  });
};

/** Reads the offline markers out of whichever frame runs the SDK. */
const readOfflineMarkers = () => {
  const visit = (): Record<string, unknown> | null => {
    const w = window.__ooFrames.find(
      (win) => typeof (win as any).AscCommon?.DocsCoApi?.prototype?._initSocksJs === 'function',
    ) as any;
    if (!w) return null;
    const source = String(w.AscCommon.DocsCoApi.prototype._initSocksJs);
    return {
      isOffline: w.isOffline === true,
      // A real socket transport would reach for the socket.io global here.
      socksSource: source.slice(0, 400),
      mentionsSocketIo: /io\s*\(|io\.connect|sockjs/i.test(source),
      hasProbe: Boolean(w.__seamProbe),
      probe: w.__seamProbe || null,
    };
  };
  return visit();
};

test.describe('the offline build answers the server protocol in-process', () => {
  test.describe.configure({ timeout: 240_000 });

  test('conversion crosses one seam, and that seam survives a foreign realm', async ({ page }) => {
    await page.addInitScript(installSeamProbe);

    const docx = buildDocx('Seam probe paragraph, unmistakable and unique.');

    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    const saved = await page.evaluate(async (base64: string) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      await post('document:open-buffer', {
        fileName: 'seam.docx',
        buffer: bytes.buffer,
        readonly: false,
      });
      const result = await post('document:save', {});
      const out = new Uint8Array(await result.file.arrayBuffer());
      return { name: result.file.name as string, bytes: Array.from(out) };
    }, toBase64(docx));

    const markers = (await page.evaluate(readOfflineMarkers)) as {
      isOffline: boolean;
      socksSource: string;
      mentionsSocketIo: boolean;
      probe: ProbeState | null;
    } | null;

    expect(markers, 'the SDK frame was found').not.toBeNull();

    // 1. The server protocol is already answered without a socket.
    expect(markers!.isOffline).toBe(true);
    expect(markers!.mentionsSocketIo).toBe(false);

    // 2. Opening went through exactly one conversion seam.
    const toBin = markers!.probe?.toBin ?? [];
    expect(toBin.length, 'convertToBin is the only door the document came through').toBe(1);
    expect(toBin[0].binaryLength).toBeGreaterThan(0);

    // 3. The editor accepted a result built by another realm.
    expect(toBin[0].crossRealm, 'the substitution actually happened').toBe(true);
    expect(toBin[0].crossRealmError).toBeUndefined();
    expect(
      toBin[0].sameConstructor,
      'the substituted value carries a foreign constructor, like a worker result would',
    ).not.toBe(true);

    // 4. Saving goes back out through the same object.
    expect(markers!.probe?.fromBin.length ?? 0).toBeGreaterThan(0);

    // 5. And the document survived the round trip.
    expect(saved.name).toBe('seam.docx');
    const text = await ooxmlDocumentText(new Uint8Array(saved.bytes));
    expect(text).toContain('Seam probe paragraph, unmistakable and unique.');
  });
});
