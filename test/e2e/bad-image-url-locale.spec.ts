import { expect, test } from './lib/l0';
import { buildDocx, buildXlsx, toBase64 } from './lib/ooxml';

/**
 * Guard 13: an image URL that fails must report it in the user's language.
 *
 * The offline patch overwrites `errorBadImageUrl` -- an ordinary vendor locale
 * key, translated in all 45 locale files -- with a hardcoded Chinese sentence,
 * on the controller instance, inside `loadDocument`. The editor reads that
 * property when the engine raises `Asc.c_oAscError.ID.UplImageUrl`, which is
 * what an inserted image URL that 404s or fails CORS produces. Before the
 * guard, every user of this site saw Chinese there, in all seven languages.
 *
 * This reads the property the error handler reads, on the live controller,
 * after a real document is open -- the value, not the mechanism, because the
 * mechanism is the vendor's and can move. `test/unit/vendor-bad-image-url.test.ts`
 * pins the literal the guard matches and the translations it falls back to.
 */
const OFFLINE_BAD_IMAGE_URL =
  '无法加载图片：地址无效或目标站不允许跨域访问（可通过 editorConfig.imageProxy 配置图片代理）';

/** Reads `errorBadImageUrl` off the live Main controller, whichever app it is. */
const readBadImageUrl = () => {
  type Ctl = { errorBadImageUrl?: string };
  type Ns = {
    Controllers?: { Main?: { prototype?: Ctl } };
    getController?: (name: string) => Ctl | undefined;
    getApplication?: () => { getController?: (name: string) => Ctl | undefined } | undefined;
  };

  const APPS = ['DE', 'SSE', 'PE', 'PDFE'] as const;
  const nameOf = (win: Window): string | null => {
    const scope = win as unknown as Record<string, Ns | undefined>;
    return APPS.find((app) => scope[app]?.Controllers?.Main?.prototype) ?? null;
  };
  const found = window.__ooFrames.find((win) => nameOf(win));
  if (!found) return null;

  const app = nameOf(found)!;
  const ns = (found as unknown as Record<string, Ns>)[app];
  let instance: Ctl | undefined;
  try {
    instance = ns.getController?.('Main') ?? ns.getApplication?.()?.getController?.('Main');
  } catch {
    instance = undefined;
  }
  return {
    app,
    fromInstance: instance ? (instance.errorBadImageUrl ?? null) : null,
    fromPrototype: ns.Controllers!.Main!.prototype!.errorBadImageUrl ?? null,
  };
};

const openBuffer = async ({ base64, fileName }: { base64: string; fileName: string }) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  await post('document:open-buffer', { fileName, buffer: bytes.buffer, readonly: false });
};

test.describe('the bad-image-url message stays in the editor language', () => {
  test.describe.configure({ timeout: 240_000 });

  for (const doc of [
    { name: 'bad-image.docx', app: 'DE', bytes: () => buildDocx('Image URL message check.') },
    {
      name: 'bad-image.xlsx',
      app: 'SSE',
      bytes: () => buildXlsx({ rows: [['a', 'b']] }),
    },
  ]) {
    test(`${doc.app}: the message the error handler reads is the translated one`, async ({ page }) => {
      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
      await page.evaluate(openBuffer, { base64: toBase64(doc.bytes()), fileName: doc.name });

      await expect
        .poll(async () => (await page.evaluate(readBadImageUrl))?.app ?? null, { timeout: 60_000 })
        .toBe(doc.app);

      const state = (await page.evaluate(readBadImageUrl))!;

      // The controller instance is what the error handler reads through `this`.
      const effective = state.fromInstance ?? state.fromPrototype;
      expect(effective, 'the message exists at all').toBeTruthy();
      expect(effective).not.toBe(OFFLINE_BAD_IMAGE_URL);
      expect(effective).toBe('Image URL is incorrect');
    });
  }
});
