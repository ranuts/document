import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';

/**
 * The sdkjs plugin framework is alive in this build, and reachable the public way.
 *
 * We have long recorded the opposite. That conclusion was drawn against the
 * v7.5 offline package, where the plugin infrastructure really had been
 * stripped, and it is why `lib/agent-plugin` calls `window.editor.pluginMethod_*`
 * directly instead of running as a plugin. It is no longer true of v9 and it is
 * worth knowing before building anything else on the assumption.
 *
 * Two details made it look dead from the outside:
 *
 *  - `Asc.createPluginsManager` lives in `sdk-all.js`, not `sdk-all-min.js`.
 *    The minified bundle is the bootstrap; `AscCommon.loadSdk` pulls the full
 *    14 MB SDK afterwards, and `onDocumentReady` can fire before it lands. Look
 *    too early and the manager is genuinely undefined.
 *  - `_checkLicenseApiFunctions` returns false here (the offline patch sends
 *    `onLicense({license:{}})`, so `licenseResult.plugins` is undefined). It
 *    reads like a gate, but nothing in either bundle calls it.
 *
 * What we do not ship is the `sdkjs-plugins/` tree itself -- the `v1/plugins.js`
 * bridge a plugin page loads to get its `Asc.plugin` object, and the plugin
 * bundles. That is a packaging decision, not a missing capability: the manager
 * defaults to `../../../../sdkjs-plugins/`, which 404s on this origin, and a
 * config that carries its own absolute `baseUrl` bypasses it entirely.
 *
 * So this pins the reachable pathway, end to end, with a plugin made up on the
 * spot: config through `editorConfig.plugins`,
 * registration with the manager, `run()` creating the plugin frame, and the
 * toolbar tab that exposes it. If a vendor upgrade breaks any of that, we want
 * to hear about it before we build on it -- not after.
 */
const PLUGIN_GUID = 'asc.{11111111-2222-3333-4444-555555555555}';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Injects `editorConfig.plugins` into whatever config the site passes to
 * DocEditor, with the plugin's config.json handed over as a blob URL so nothing
 * has to be added to `public/`. api.js assigns `window.DocsAPI` first and
 * `DocEditor` onto it afterwards, so both assignments need subscribing to.
 */
const injectPluginsConfig = (guid: string) => {
  const w = window as unknown as Record<string, any>;

  // Same-origin on purpose: a blob: or data: page would give the plugin frame
  // an opaque origin, and every init script (the L0 fixture's included) would
  // throw trying to reach the top window from it. What the frame contains does
  // not matter -- only that the manager created it.
  const pageUrl = location.origin + '/manifest.json';
  const config = {
    name: 'Seam Probe',
    guid,
    baseUrl: '',
    variations: [
      {
        description: 'probe',
        url: pageUrl,
        icons: [],
        isViewer: true,
        EditorsSupport: ['word', 'cell', 'slide'],
        isVisual: true,
        isModal: false,
        isInsideMode: false,
        initDataType: 'none',
        initData: '',
        isUpdateOleOnResize: false,
        buttons: [],
      },
    ],
  };
  const configUrl = URL.createObjectURL(new Blob([JSON.stringify(config)], { type: 'application/json' }));

  let docsApi: any;
  Object.defineProperty(w, 'DocsAPI', {
    configurable: true,
    get: () => docsApi,
    set: (value: any) => {
      docsApi = value;
      if (!value || value.__pluginProbed) return;
      value.__pluginProbed = true;
      let Original: any;
      Object.defineProperty(value, 'DocEditor', {
        configurable: true,
        get: () => {
          if (!Original) return undefined;
          const Wrapped = function (this: unknown, placeholder: string, cfg: any) {
            cfg = cfg || {};
            cfg.editorConfig = cfg.editorConfig || {};
            cfg.editorConfig.plugins = { autostart: [], pluginsData: [configUrl] };
            return new Original(placeholder, cfg);
          } as any;
          Object.setPrototypeOf(Wrapped, Original);
          Object.assign(Wrapped, Original);
          return Wrapped;
        },
        set: (ctor: any) => {
          Original = ctor;
        },
      });
    },
  });
};

const openBuffer = async ({ base64, fileName }: { base64: string; fileName: string }) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  await post('document:open-buffer', { fileName, buffer: bytes.buffer, readonly: false });
};

/** Reads the plugin manager's state out of whichever frame runs the SDK. */
const readPlugins = (guid: string) => {
  const visit = (win: Window): Record<string, unknown> | null => {
    try {
      const w = win as unknown as Record<string, any>;
      const manager = w.g_asc_plugins;
      if (manager) {
        const app = w.DE || w.SSE || w.PE || w.PDFE;
        const controller = app?.getController?.('Common.Controllers.Plugins');
        return {
          registered: (manager.plugins || []).map((plugin: any) => plugin.guid),
          runned: Object.keys(manager.runnedPluginsMap || {}),
          frames: Array.from(win.document.querySelectorAll('iframe'))
            .map((frame) => (frame as HTMLIFrameElement).id)
            .filter(Boolean),
          tabs: Array.from(win.document.querySelectorAll('[data-tab]'))
            .map((el) => el.getAttribute('data-tab'))
            .filter(Boolean),
          configReached: Boolean(controller?.configPlugins?.config?.pluginsData?.length),
          configPluginCount: Array.isArray(controller?.configPlugins?.plugins)
            ? controller.configPlugins.plugins.length
            : -1,
        };
      }
    } catch {
      /* cross-origin frame, skip */
    }
    for (let i = 0; i < win.frames.length; i++) {
      const found = visit(win.frames[i]);
      if (found) return found;
    }
    return null;
  };
  void guid;
  return visit(window);
};

/** Asks the manager to start the registered plugin. */
const runPlugin = (guid: string) => {
  const visit = (win: Window): boolean => {
    try {
      const manager = (win as unknown as Record<string, any>).g_asc_plugins;
      if (manager) {
        manager.run(guid, 0, '');
        return true;
      }
    } catch {
      /* cross-origin frame, skip */
    }
    for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
    return false;
  };
  return visit(window);
};

test.describe('the sdkjs plugin framework is reachable through editorConfig', () => {
  test.describe.configure({ timeout: 240_000 });

  test('a plugin passed as config registers, runs, and gets its frame', async ({ page }) => {
    await page.addInitScript(injectPluginsConfig, PLUGIN_GUID);

    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    await page.evaluate(openBuffer, { base64: toBase64(buildDocx('plugin probe')), fileName: 'plugin.docx' });

    // The plugin manager ships in sdk-all.js, which loads lazily after the
    // document is already open -- wait for it rather than for the document.
    await expect
      .poll(async () => (await page.evaluate(readPlugins, PLUGIN_GUID))?.registered ?? null, { timeout: 90_000 })
      .toEqual([PLUGIN_GUID]);

    const registered = (await page.evaluate(readPlugins, PLUGIN_GUID))!;
    expect(registered.configReached, 'editorConfig.plugins reached the Plugins controller').toBe(true);
    expect(registered.configPluginCount).toBe(1);
    expect(registered.tabs, 'the toolbar exposes a plugins tab').toContain('plugins');

    expect(await page.evaluate(runPlugin, PLUGIN_GUID)).toBe(true);

    await expect
      .poll(async () => (await page.evaluate(readPlugins, PLUGIN_GUID))?.runned ?? null, { timeout: 30_000 })
      .toEqual([PLUGIN_GUID]);

    const running = (await page.evaluate(readPlugins, PLUGIN_GUID))!;
    expect(running.frames, 'the manager created the plugin frame').toContain(`iframe_${PLUGIN_GUID}`);
  });
});
