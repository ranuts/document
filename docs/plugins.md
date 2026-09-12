# Plugins

The ONLYOFFICE plugin framework **works in this build**. Nothing is bundled,
and that is a decision rather than a limitation. This page says what is true,
what is missing, and what a self-hoster would change to enable plugins.

## What was verified

Passing a plugin through `editorConfig.plugins.pluginsData` takes the whole
path, first try:

```
editorConfig.plugins.pluginsData  ->  the Plugins controller fetches the config
registered                        ->  g_asc_plugins.plugins
run(guid)                         ->  an iframe_<guid> frame is created
toolbar                           ->  carries its "plugins" tab
```

`test/e2e/plugin-availability.spec.ts` pins all of it, with a plugin invented
on the spot whose `config.json` is handed over as a blob URL, so nothing has to
be added to `public/`.

This contradicts a conclusion we carried for months — that the offline build
had the plugin infrastructure stripped. That was correct for the **v7.5**
package and is why `lib/agent-plugin` calls `window.editor.pluginMethod_*`
directly instead of running as a plugin. It is not true of v9.

### Two things that make it look dead

Worth knowing before anyone re-tests it and concludes the same thing again.

**`Asc.createPluginsManager` is not in the bundle you first see.** It is
defined in `sdkjs/<app>/sdk-all.js`. The file requirejs names is
`sdk-all-min.js` — the bootstrap — and `AscCommon.loadSdk` pulls the full 14 MB
SDK afterwards, asynchronously. `onDocumentReady` can fire before it lands, so
a probe run right after a document opens finds `createPluginsManager:
undefined`, which reads exactly like a stripped build. One second later it is a
function.

**`_checkLicenseApiFunctions()` returns false here, and nothing calls it.** The
offline patch sends `onLicense({ license: {} })`, so `licenseResult.plugins` is
undefined. It reads like a gate. It has zero call sites in either bundle.

## What is not shipped

The `sdkjs-plugins/` tree: the `v1/plugins.js` bridge a plugin page loads to get
its `Asc.plugin` object, and the plugin bundles themselves.

Upstream does not ship the bundles either. The official
`onlyoffice/documentserver` image carries 364 KB under `sdkjs-plugins/` — the
bridge, `pluginBase.js`, `plugins.css`, a `plugin-list-default.json` that is a
list of _names_, and the marketplace UI. Each of the ~46 plugins is its own
repository; a deployment that offers them hosts them itself.

## Why nothing is bundled

Most plugins talk to the network. The AI plugin sends document content to
whichever provider the reader configures; the translation plugins send the
selection; the marketplace exists to fetch a remote catalogue; YouTube and
Jitsi embed third-party frames.

This site's whole claim is that documents never leave the device. Shipping a
row of buttons that do the opposite, enabled by default, would contradict it —
and "it is off until you click it" is not much of an answer when the thing it
promises is that there is nothing to click.

Filtering the stock default list (`ai`, `highlightcode`, `mendeley`, `ocr`,
`photoeditor`, `speech`, `speechrecognition`, `thesaurus`, `translator`,
`youtube`, `zotero`) by "does it stay local" leaves roughly two —
`highlightcode` and `photoeditor`. `ocr` downloads language data; the `speech`
pair goes through the Web Speech API, which in Chrome is a cloud service.

So the trade is two plugins against two more third-party upstreams vendored
into a public repository, each with its own licence to record in `NOTICE`. That
is a supply-chain decision, and it is open rather than settled: if a specific
plugin is worth it, the question to answer first is whether it goes online.

## Enabling plugins in a fork

Two changes, both small.

**1. Serve the tree.** Copy `sdkjs-plugins/` out of the official image (the
bridge is what plugin pages load; without it a plugin cannot get its
`Asc.plugin`) and put the plugins you want beside it:

```sh
docker create --name ds onlyoffice/documentserver:9.3.1
docker cp ds:/var/www/onlyoffice/documentserver/sdkjs-plugins - > plugins.tar
docker rm ds
```

The manager's default path is `../../../../sdkjs-plugins/`, relative to the
editor frame — i.e. `/sdkjs-plugins/` on the origin. A config that carries its
own absolute `baseUrl` bypasses that entirely, which is how a plugin hosted on
another origin works.

**2. Pass the list.** In `createPersonalEditorInstance`
(`lib/onlyoffice-editor.ts`), add to `editorConfig`:

```ts
plugins: {
  autostart: [],
  pluginsData: ['/sdkjs-plugins/highlightcode/config.json'],
},
```

### Not from the URL

Do not wire this to a query parameter. `pluginsData` is a list of URLs whose
code runs **inside the editor frame, on this origin** — a `?plugins=` parameter
would let any page that can get a reader to follow a link execute arbitrary
same-origin JavaScript against their open document. It belongs in the build, or
in a host's own configuration, and nowhere a stranger can write it.

## Related

- `test/e2e/plugin-availability.spec.ts` — the pinned pathway
- `docs/explorations/2026-09-12-plugin-framework-is-alive.md` — how this was
  found, and the measurements behind it
- `lib/agent-plugin/` — the direct `pluginMethod_*` route, which needs no
  bridge, no iframe and no round trip, and is why the agent panel does not run
  as a plugin
