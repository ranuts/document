/**
 * 4. Serverless image pipeline. The SDK expects a Document Server to turn
 * pasted/URL-inserted images into registered local media names (sendImgUrls
 * posts an "imgurls" command and waits for the server to answer). Without a
 * server nothing registers, the document model keeps a raw data:/blob:/https:
 * src, the DOCY writer embeds that raw string as the image path (getImageLocal
 * hard-rejects data: URLs), and x2t.wasm blocks the main thread forever trying
 * to resolve it. Three coordinated patches:
 * 4a. a self-healing getImageLocal that registers external ids on lookup miss,
 *    so the writers always serialize a local name;
 * 4b. a serverless sendImgUrls that registers the source directly;
 * 4c. a medias fallback on convertFromBin, since the vendor's save glue passes
 *    an empty media map.
 *
 * Root cause and the offline verification:
 * docs/explorations/2026-08-15-image-save-hang-root-cause-fix.md
 */
export function installServerlessImagePipeline(win: Window): boolean {
  const imgWin = win as unknown as {
    AscCommon?: {
      x2t?: { convertFromBin?: unknown };
      sendImgUrls?: unknown;
      g_oDocumentUrls?: {
        mediaPrefix?: string;
        addImageUrl: (name: string, url: string) => void;
        getLocal: (url: string) => string | null;
        getUrl: (path: string) => string | null;
        getUrls: () => Record<string, string>;
        getImageLocal: (url: string) => string | null;
      };
    };
    Asc?: {
      editor?: { ImageLoader?: { map_image_index?: Record<string, unknown> }; _downloadAsFromLocal?: unknown };
    };
    editor?: { ImageLoader?: { map_image_index?: Record<string, unknown> }; _downloadAsFromLocal?: unknown };
    __ooImagePipelinePatched?: boolean;
  };
  const ac = imgWin.AscCommon;
  const editorApi = imgWin.Asc?.editor || imgWin.editor;
  if (ac?.g_oDocumentUrls && ac.x2t && editorApi && !imgWin.__ooImagePipelinePatched) {
    const docUrls = ac.g_oDocumentUrls;
    const MEDIA = docUrls.mediaPrefix || 'media/';
    let imgSeq = 0;

    const extFromSrc = (src: string): string => {
      const dataMime = /^data:image\/([a-z0-9+.-]+)/i.exec(src);
      if (dataMime) {
        const sub = dataMime[1].toLowerCase();
        return sub === 'svg+xml' ? 'svg' : sub === 'jpeg' ? 'jpg' : sub;
      }
      const fromPath = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(src);
      return fromPath ? fromPath[1].toLowerCase() : 'png';
    };

    const registerSrc = (src: unknown): string | null => {
      if (typeof src !== 'string' || !/^(data:image|blob:|https?:)/i.test(src)) return null;
      const existing = docUrls.getLocal(src);
      if (existing) return existing;
      let name: string;
      do {
        name = `image_oo${imgSeq++}.${extFromSrc(src)}`;
      } while (docUrls.getUrl(MEDIA + name));
      docUrls.addImageUrl(name, src);
      return MEDIA + name;
    };

    // 4a. Self-healing resolver. The DOCY writers call getImageLocal
    //     with the model's RasterImageId right before serializing it; a
    //     miss makes them embed the raw external URL into the DOCY,
    //     which is exactly what x2t.wasm loops forever on (verified
    //     offline: the same DOCY converts in ~100ms once the path is a
    //     local media name). So on a miss for an external id, register
    //     it on the spot and return the fresh local name.
    docUrls.getImageLocal = function (url: string) {
      let local = this.getLocal(url) || registerSrc(url);
      if (local && local.indexOf(MEDIA) === 0) local = local.substring(MEDIA.length);
      return local || null;
    };

    // 4b. The callback contract mirrors the server response: url is what
    //     the editor displays, path is the document-relative media name.
    ac.sendImgUrls = function (
      _api: unknown,
      images: string[],
      callback: (r: Array<{ url: string; path: string }>) => void,
    ) {
      const out = (images || []).map((src) => {
        const path = registerSrc(src);
        return path ? { url: src, path } : { url: 'error', path: 'error' };
      });
      setTimeout(() => callback(out), 0);
    };

    // 4c. The vendor's save glue passes medias: [] even when the
    //     document references media -- refill it from the registry so
    //     x2t_helper's writeMediaFiles materializes the bytes (it
    //     decodes data: URLs and fetches blob:/http(s): sources). A
    //     fetch failure degrades to a missing image in the output,
    //     never a hang (verified offline).
    const x2tProto = Object.getPrototypeOf(ac.x2t) as {
      convertFromBin: (obj: { medias?: Record<string, string> }) => unknown;
    };
    const origConvertFromBin = x2tProto.convertFromBin;
    x2tProto.convertFromBin = function (obj: { medias?: Record<string, string> }) {
      if (obj && (!obj.medias || Object.keys(obj.medias).length === 0)) {
        const urls = docUrls.getUrls() || {};
        const medias: Record<string, string> = {};
        for (const key of Object.keys(urls)) {
          if (key.indexOf(MEDIA) === 0) medias[key] = urls[key];
        }
        if (Object.keys(medias).length > 0) obj.medias = medias;
      }
      return origConvertFromBin.call(this, obj);
    };

    imgWin.__ooImagePipelinePatched = true;
    console.log('[OO] serverless image pipeline installed (sendImgUrls, media registry, convertFromBin medias)');
  }
  return Boolean(imgWin.__ooImagePipelinePatched);
}
