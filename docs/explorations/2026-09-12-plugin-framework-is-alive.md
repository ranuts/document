# The plugin framework is alive in v9, and we had it recorded as dead

2026-09-12

## The claim we were carrying

From the Phase 0 spike on 2026-06-23, against the **v7.5** offline package:

> 标准 OnlyOffice 插件模型**不可用**——离线构建裁掉了插件资源基建（无 `plugins.js`、
> 无 `api/plugins` 目录，编辑器 iframe 内 `Asc.plugin` 单例为 undefined）。
> **不要建 `public/plugins/` 验证插件。**

That is why `lib/agent-plugin` reaches into `window.editor.pluginMethod_*` and `asc_*`
directly instead of running as a plugin. It was a correct conclusion for the build it
was drawn against. We migrated to v9 and never re-checked it.

The question came back while comparing our integration to a third-party local-first
Office site that ships 46 sdkjs plugins including the marketplace. If plugins work,
a lot of what `agent-plugin` hand-rolls has an upstream home.

## What is actually true in v9

Everything works, through the public config, first try.

```
editorConfig.plugins.pluginsData  ->  Plugins controller fetched the config
registered                        ->  ["asc.{1111...5555}"]
run(guid)                         ->  runnedPluginsMap = ["asc.{1111...5555}"]
frames                            ->  ["iframe_asc.{1111...5555}"]
toolbar tabs                      ->  [file, home, ins, draw, layout, links,
                                       review, view, plugins, headerfooter]
```

The Plugins controller is in the app (`Common.Controllers.Plugins`), it reads
`editorConfig.plugins`, fetches each entry of `pluginsData`, registers what it gets with
`g_asc_plugins`, and `run()` creates the plugin frame. The toolbar has its `plugins` tab.

`test/e2e/plugin-availability.spec.ts` pins all of it, with a plugin invented on the
spot: its `config.json` is handed over as a blob URL, so nothing is added to `public/`.

## Why it looked dead

Two things, and both are worth writing down because either one alone is enough to make
a probe report "not supported".

**1. The plugin manager is not in the bundle you first see.**

`Asc.createPluginsManager` is defined only in `sdkjs/<app>/sdk-all.js`. The file the
requirejs config names is `sdk-all-min` -- but that is the _bootstrap_, and it calls

```js
AscCommon.loadSdk = function (dir, cb) {
  window.AscNotLoadAllScript ? cb() : loadScript('.../sdkjs/' + dir + '/sdk-all.js', cb);
};
```

so the full 14 MB SDK arrives afterwards, asynchronously. `onDocumentReady` can fire
before it lands -- `lib/onlyoffice/save-stream.ts` already has a comment saying exactly
that. Our first probe read the frame right after `document:open-buffer` resolved and got

```
createPluginsManager: "undefined"   g_asc_plugins: "undefined"   pluginsManager: null
```

which reads like a stripped build. Polling for another second gives
`function` / `object` / `[object Object]`.

**2. There is a license check that looks like the gate, and it is not.**

```js
baseEditorsApi.prototype._checkLicenseApiFunctions = function () {
  return this.licenseResult && true === this.licenseResult.plugins;
};
```

It returns `false` here: the offline patch's `Offline` controller calls
`api.onLicense({ type: 'license', license: {}, advancedApi: true })`, so
`licenseResult.plugins` is undefined. But **nothing calls it** -- zero call sites in
`sdk-all-min.js`, zero in `sdk-all.js`. It is a leftover.

(The third-party site sends a fabricated `license` with `type: 3`, `branding: false`,
`customization: true`. On this evidence that is not what makes its plugins work, and we
should not copy it -- `branding: false` is the commercial flag, and we deliberately keep
ONLYOFFICE's branding for AGPL §7(b).)

## What we do not have

The `sdkjs-plugins/` tree itself. A plugin page loads `v1/plugins.js` from it to get its
`Asc.plugin` object, and the plugin bundles live under it. We ship none of it:
`public/sdkjs-plugins/` does not exist, and the manager's default `path` --
`../../../../sdkjs-plugins/` -- 404s on this origin. A config that carries its own
absolute `baseUrl` bypasses the default entirely, which is how a plugin hosted elsewhere
would work.

So this is a packaging decision, not a missing capability. Two ways to close it:

- vendor the tree (the official `onlyoffice/documentserver` image has
  `/var/www/onlyoffice/documentserver/sdkjs-plugins`), which costs deploy size and
  brings each plugin's own licence and network behaviour along with it; or
- host plugins on a separate origin and point `pluginsData` at absolute URLs, which is
  what the third-party site does.

Neither is decided here. What is decided is that the door is not locked.

## What this changes for `agent-plugin`

Nothing immediately -- direct `pluginMethod_*` calls keep working and cost no iframe, no
bridge and no round trip, which is why `editor-bridge.ts` has zero imports. But the
options that were closed are open again: shipping the agent panel as a real plugin,
reusing upstream plugins (translator, thesaurus, photo editor) instead of writing
equivalents, and the marketplace.

Worth knowing before the next thing gets hand-rolled.

## Reverse validation

Convention 5. With the `editorConfig.plugins` injection removed from the test's DocEditor
wrapper, the poll for a registered plugin times out and the case fails -- nothing else in
the site registers plugins, so the test is measuring what it claims to.
