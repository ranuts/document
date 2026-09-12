/**
 * Guard 13: the offline patch must not replace a translated string with a
 * hardcoded Chinese one.
 *
 * `errorBadImageUrl` is an ordinary vendor locale key -- every one of the 45
 * locale files carries a translation of it ("Image URL is incorrect",
 * "画像のURLが正しくありません", "이미지 URL이 잘못되었습니다."), and the usual
 * l10n idiom merges those onto `<NS>.Controllers.Main.prototype` when the
 * controller is defined. The editor reads it as `this.errorBadImageUrl` when
 * the engine reports `Asc.c_oAscError.ID.UplImageUrl`, which is what an
 * inserted image URL that 404s or fails CORS produces.
 *
 * The offline build's `Offline` controller then overwrites it, on the
 * instance, inside `loadDocument`:
 *
 *     this.errorBadImageUrl = "无法加载图片：地址无效或目标站不允许跨域访问" +
 *                             "（可通过 editorConfig.imageProxy 配置图片代理）"
 *
 * So every user of this site, in all seven languages, gets that sentence in
 * Chinese when an image URL fails -- and it advises configuring
 * `editorConfig.imageProxy`, a knob our users have no way to reach and which
 * we deliberately do not set (it would route their image URLs through a third
 * party, which is the one thing this site promises not to do).
 *
 * The fix is not to translate the sentence: the vendor already translated the
 * original into more languages than we ship. It is to keep the assignment from
 * landing. An accessor on the prototype swallows exactly that one string and
 * lets every other write through, so a vendor upgrade that changes the message
 * legitimately still wins.
 *
 * Only word / cell / slide carry the assignment; pdfeditor has the locale key
 * but no override. Installing on all four is harmless and keeps the guard
 * honest if a future build adds it.
 */

/** The literal the offline patch assigns. Pinned by test/unit/vendor-bad-image-url.test.ts. */
export const OFFLINE_BAD_IMAGE_URL =
  '无法加载图片：地址无效或目标站不允许跨域访问（可通过 editorConfig.imageProxy 配置图片代理）';

/** Editor namespaces, one per app; exactly one exists in any given frame. */
const APP_NAMESPACES = ['DE', 'SSE', 'PE', 'PDFE'] as const;

type MainController = {
  errorBadImageUrl?: string;
  __ooBadImageUrl?: string;
};

type MainConstructor = { prototype?: MainController & { __ooBadImageGuarded?: boolean } };

type EditorNamespace = {
  Controllers?: { Main?: MainConstructor };
  getController?: (name: string) => MainController | undefined;
  getApplication?: () => { getController?: (name: string) => MainController | undefined } | undefined;
};

function mainController(ns: EditorNamespace): MainController | undefined {
  try {
    return ns.getController?.('Main') ?? ns.getApplication?.()?.getController?.('Main');
  } catch {
    return undefined;
  }
}

export function installBadImageUrlGuard(win: Window): boolean {
  const frame = win as Window & { __ooBadImageGuarded?: boolean };
  const namespaces = APP_NAMESPACES.map((name) => (win as unknown as Record<string, EditorNamespace>)[name]).filter(
    (ns): ns is EditorNamespace => Boolean(ns?.Controllers?.Main?.prototype),
  );
  // The app namespace lands during boot; report "not yet" so the caller keeps
  // re-applying.
  if (!namespaces.length) return Boolean(frame.__ooBadImageGuarded);

  for (const ns of namespaces) {
    const proto = ns.Controllers!.Main!.prototype!;
    if (proto.__ooBadImageGuarded) continue;

    // Whatever the locale merge left on the prototype. If the locale fetch has
    // not resolved yet there is nothing worth protecting, and installing now
    // would pin an empty string -- wait for the next pass instead.
    const localized = proto.errorBadImageUrl;
    if (!localized) continue;

    Object.defineProperty(proto, 'errorBadImageUrl', {
      configurable: true,
      get(this: MainController) {
        return this.__ooBadImageUrl ?? localized;
      },
      set(this: MainController, value: string) {
        if (value !== OFFLINE_BAD_IMAGE_URL) this.__ooBadImageUrl = value;
      },
    });
    proto.__ooBadImageGuarded = true;

    // `loadDocument` may already have run, in which case the instance carries
    // its own copy that shadows the accessor we just installed.
    const controller = mainController(ns);
    if (controller && Object.prototype.hasOwnProperty.call(controller, 'errorBadImageUrl')) {
      const own = (controller as Record<string, unknown>).errorBadImageUrl;
      if (own === OFFLINE_BAD_IMAGE_URL) delete (controller as Record<string, unknown>).errorBadImageUrl;
    }
  }

  frame.__ooBadImageGuarded = true;
  return true;
}
