/**
 * Guard 14: x2t converts in a worker, so its heap is something we can hand back.
 *
 * x2t declares a 283 MB initial heap and measures ~340 MB after an open
 * (test/e2e/wasm-memory.spec.ts), ~408 MB after saving a large workbook. In the
 * editor frame that is resident for the life of the frame: x2t.js is an
 * unwrapped classic script, so `wasmMemory` / `HEAPU8` are properties of the
 * frame's global and nothing drops them.
 * `X2TConverter.prototype.destroy` exists, is never called, and only clears a
 * JS reference anyway.
 *
 * The offline vendor patch routes every conversion through exactly two methods
 * on one object -- `AscCommon.x2t.convertToBin` on open,
 * `AscCommon.x2t.convertFromBin` on save (see
 * docs/explorations/2026-09-12-server-mock-already-in-vendor.md, pinned by
 * test/e2e/offline-seam.spec.ts). This replaces those two with a proxy over a
 * worker that runs the same `x2t_helper.js`, and terminates the worker once it
 * has been idle. Editing therefore runs with that heap handed back to the
 * browser, and conversion stops blocking the frame's main thread.
 *
 * What this is not: a fix for GitHub #144. The peak at open time is unchanged
 * -- x2t still asks for 283 MB the moment it instantiates. A dedicated worker
 * also shares its document's renderer process, so nothing gains isolation. The
 * win is lifecycle.
 *
 * Three things have to cross the boundary, and the cheapness of each is why
 * this is affordable:
 *
 *  - **the document**, as bytes. It was going to be read anyway.
 *  - **media**, as bytes both ways. Blob URLs are realm-bound in practice and
 *    the frame is the side that holds them, so the frame mints them from what
 *    comes back.
 *  - **fonts, as a list rather than as bytes.** This is the one that decides
 *    it. `AscCommon.fetchFonts` walks `AscFonts.g_font_infos` for the faces the
 *    open document flagged `NeedStyles` and de-obfuscates each file: 14 files
 *    and 4.6 MB for a one-paragraph Latin document, 16 files and 25.4 MB for a
 *    CJK PDF export, *per conversion*. Sending those bytes would have cost more
 *    than the memory is worth. The list is a few KB, and the worker fetches the
 *    same URLs off the same HTTP and Service Worker cache.
 */

import { waitForFontSystem, type FontSystemWindow } from '../font-system';

/** How long an idle worker is kept before its heap is handed back. */
const IDLE_TERMINATE_MS = 30_000;

const WORKER_URL = '/sdkjs/common/wasm/x2t/x2t.worker.js';

/** Style suffixes the vendor's own fetchFonts uses, keyed by the info field. */
const FONT_STYLE_SUFFIX: Record<string, string> = {
  indexR: '',
  indexB: '_Bold',
  indexBI: '_Bold_Italic',
  indexI: '_Italic',
};

type FontSource = { fileName: string; url: string };
type MediaPayload = { bytes: Uint8Array; mime: string };

type X2TConverterLike = {
  convertToBin: (data: unknown, fileName?: string, fileExt?: string) => Promise<unknown>;
  convertFromBin: (request: Record<string, unknown>) => Promise<unknown>;
  __ooWorkerProxied?: boolean;
};

type FrameScope = Window & {
  AscCommon?: {
    x2t?: X2TConverterLike;
    g_font_loader?: { fontFilesPath?: string; fontFiles?: Array<{ Id?: string }> };
  };
  AscFonts?: { g_font_infos?: Array<Record<string, unknown>> };
  Worker?: typeof Worker;
  __ooX2tWorkerGuard?: boolean;
};

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/** One worker per frame, created on demand and dropped when it goes quiet. */
class WorkerChannel {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly win: FrameScope) {}

  private start(): Worker {
    if (this.worker) return this.worker;
    const WorkerCtor = this.win.Worker;
    if (!WorkerCtor) throw new Error('X2T worker unavailable: this engine has no Worker');
    // Constructed through the frame's own Worker so the realm dies with the
    // frame even if nothing terminates it first.
    const worker = new WorkerCtor(WORKER_URL);
    worker.onmessage = (event: MessageEvent) => {
      const data = (event.data ?? {}) as { id?: number; ok?: boolean; result?: unknown; error?: string };
      if (data.id === undefined) return; // the worker's initial ready ping
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      if (data.ok) pending.resolve(data.result);
      else pending.reject(new Error(data.error || 'X2T worker conversion failed'));
      this.scheduleIdleTermination();
    };
    worker.onerror = (event: ErrorEvent) => {
      // A worker that died takes every request in flight with it, and leaving
      // them pending is what turns a failure into a spinner that never stops.
      const failure = new Error(`X2T module failed to instantiate: ${event.message || 'worker error'}`);
      this.failAll(failure);
      this.terminate();
    };
    this.worker = worker;
    return worker;
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private scheduleIdleTermination(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.pending.size === 0) this.terminate();
    }, IDLE_TERMINATE_MS);
  }

  terminate(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (!this.worker) return;
    this.worker.terminate();
    this.worker = null;
  }

  /**
   * Nothing is transferred on the way in, deliberately. The bytes going out
   * are the editor's own -- `convertFromBin` is handed the live `Editor.bin`
   * -- and transferring detaches it in the frame. It costs a copy per
   * conversion and buys not corrupting the document: with the transfer in
   * place, exporting to PDF and then opening the result left the editor
   * holding a zero-length view and the next open never completed. The worker
   * does transfer its results back; those buffers are its own.
   */
  send(op: string, payload: Record<string, unknown>, fonts: FontSource[]): Promise<unknown> {
    const worker = this.start();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, op, payload, fonts });
    });
  }
}

/**
 * The faces the open document needs, as URLs rather than as megabytes.
 *
 * Ordered behind the font system on purpose. This reads exactly what the
 * vendor's `fetchFonts` reads, and guard 3 exists because those two halves are
 * built in parallel with the document load: walking a half-built one there
 * throws a TypeError that surfaces as a -82 the failure guard retries. Here it
 * would not throw -- an entry that is not there yet is simply skipped -- which
 * is worse, because the document opens silently with no fonts at all (#146).
 */
async function fontSourcesWhenReady(win: FrameScope): Promise<FontSource[]> {
  await waitForFontSystem(win as unknown as FontSystemWindow);
  return fontSources(win);
}

function fontSources(win: FrameScope): FontSource[] {
  const infos = win.AscFonts?.g_font_infos;
  const loader = win.AscCommon?.g_font_loader;
  if (!infos || !loader?.fontFiles) return [];
  // `fontFilesPath` is relative to the editor frame's document
  // ('../../../../fonts/'), and the worker would resolve it against its own
  // directory. Absolute before it crosses.
  const base = loader.fontFilesPath || '';
  const sources: FontSource[] = [];
  for (const info of infos) {
    if (!info || !info.NeedStyles) continue;
    for (const field of Object.keys(FONT_STYLE_SUFFIX)) {
      const index = info[field];
      if (typeof index !== 'number' || index === -1) continue;
      const file = loader.fontFiles[index];
      if (!file?.Id) continue;
      sources.push({
        fileName: `${String(info.Name)}${FONT_STYLE_SUFFIX[field]}.ttf`,
        url: new URL(base + file.Id, win.location.href).href,
      });
    }
  }
  return sources;
}

/**
 * Anything the vendor hands us -- blob URL, Blob, typed array -- as bytes.
 *
 * Never `instanceof`. This runs in the page's realm and the values come from
 * the editor frame's, where `x instanceof Uint8Array` is false for a perfectly
 * good Uint8Array. The PDF editor is what finds it: it opens through
 * `loadLocalBinaryDocument`, which passes the bytes straight in rather than a
 * blob URL, so an `instanceof` check reports "nothing to convert" and the
 * document never loads -- while docx, which arrives as a URL string, is fine.
 * The same trap is documented for the E2E harness in CLAUDE.md.
 */
async function toBytes(value: unknown): Promise<Uint8Array | null> {
  if (value == null) return null;
  if (typeof value === 'string') {
    const response = await fetch(value);
    if (!response.ok) throw new Error(`Failed to read document data (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }
  // Works across realms: both read internal slots, not prototypes.
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  const tag = Object.prototype.toString.call(value);
  if (tag === '[object ArrayBuffer]') return new Uint8Array(value as ArrayBuffer);
  if (tag === '[object Blob]' || tag === '[object File]') {
    return new Uint8Array(await (value as Blob).arrayBuffer());
  }
  return null;
}

/** The document's media (a map of path to blob URL) as bytes. */
async function mediaToBytes(medias: unknown): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  if (!medias || typeof medias !== 'object') return out;
  for (const [path, url] of Object.entries(medias as Record<string, unknown>)) {
    try {
      const bytes = await toBytes(url);
      if (bytes) out[path] = bytes;
    } catch {
      // A medium that cannot be read is one the conversion does without,
      // which is what the in-frame path did with it too.
    }
  }
  return out;
}

/** Turn the worker's media bytes back into the blob URLs the editor holds. */
function mintMediaUrls(media: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!media || typeof media !== 'object') return out;
  for (const [path, value] of Object.entries(media as Record<string, MediaPayload>)) {
    if (!value?.bytes) continue;
    out[path] = URL.createObjectURL(
      new Blob([value.bytes as BlobPart], { type: value.mime || 'application/octet-stream' }),
    );
  }
  return out;
}

export function installX2tWorkerProxy(win: Window): boolean {
  const frame = win as FrameScope;
  if (frame.__ooX2tWorkerGuard) return true;

  const asc = frame.AscCommon;
  // x2t_helper.js lands during the editor's boot; report "not yet" so the
  // caller keeps re-applying until it does.
  if (!asc?.x2t || typeof asc.x2t.convertToBin !== 'function') return false;
  if (!frame.Worker) {
    // No Worker in this engine: the in-frame path is still correct, just
    // heavier. Claim the guard so nothing keeps retrying.
    frame.__ooX2tWorkerGuard = true;
    return true;
  }

  const converter = asc.x2t;
  if (converter.__ooWorkerProxied) {
    frame.__ooX2tWorkerGuard = true;
    return true;
  }

  const channel = new WorkerChannel(frame);

  converter.convertToBin = async (data: unknown, fileName?: string, fileExt?: string) => {
    const bytes = await toBytes(data);
    if (!bytes) throw new Error('Document conversion failed: nothing to convert');
    const result = (await channel.send(
      'convertToBin',
      { data: bytes, fileName, fileExt },
      await fontSourcesWhenReady(frame),
    )) as Record<string, unknown>;
    return { ...result, media: mintMediaUrls(result.media) };
  };

  converter.convertFromBin = async (request: Record<string, unknown>) => {
    const binary = await toBytes(request.binary);
    const pdfChanges = request.pdfChanges;
    const medias = await mediaToBytes(request.medias);
    const result = (await channel.send(
      'convertFromBin',
      { request: { ...request, binary: binary ?? request.binary, pdfChanges, medias } },
      await fontSourcesWhenReady(frame),
    )) as Record<string, unknown>;
    return { ...result, media: mintMediaUrls(result.media) };
  };

  converter.__ooWorkerProxied = true;
  frame.__ooX2tWorkerGuard = true;
  return true;
}
