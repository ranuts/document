# Letting the browser decompress x2t.wasm, and the one server that would not

2026-09-12

## What changed

The x2t module ships brotli-compressed under `x2t.wasm.br`, and every host we
deploy to declares `Content-Encoding: br` for it. The browser decodes it at the
network layer, so `WebAssembly.instantiateStreaming` compiles the module
straight off the response and **nothing in our code decompresses anything**.

|                 | before                                                             | after                             |
| --------------- | ------------------------------------------------------------------ | --------------------------------- |
| on the wire     | 9,483,006 B (zopfli gzip)                                          | 6,898,179 B (brotli -q 11)        |
| decompressed by | `DecompressionStream('gzip')` in JS                                | the browser, at the network layer |
| loader          | fetch → sniff magic bytes → rebuild stream → inflate → instantiate | fetch → instantiate               |

2.58 MB off the single largest download in the app, and ~100 lines gone from the
two loaders that had to stay in step with each other
(`public/sdkjs/common/wasm/x2t/x2t_helper.js` and
`packages/converter/src/document-converter.ts`): `sniffAndRebuild` in both, the
gzip branch of `prepareWasmBinary` in both, and the `DecompressionStream`
capability check.

The idea came from reading a third-party local-first Office site that does the
same thing (see
[2026-09-12-server-mock-already-in-vendor.md](2026-09-12-server-mock-already-in-vendor.md)).
Verified against their production deployment first: Cloudflare Pages serves the
stored brotli bytes to a client that accepts br, and decompresses them for one
that does not.

## The part that took the time

`wrangler pages dev` -- what the `e2e-pages` job runs to reproduce Cloudflare
Pages' hosting semantics -- **re-compresses responses and overwrites
`Content-Encoding` with its own result.** A pre-encoded asset therefore arrives
double-encoded: the browser decodes once and is left holding brotli, which no
browser API can decode. The whole suite went red on `ran: false` -- x2t never
instantiated.

Measured, serving the same file under four conditions:

```
name                 Accept-Encoding      response
x2t.wasm             br                   Content-Encoding: br, body = br(br(wasm))
x2t.wasm             (none)               Content-Encoding: br, body = br(br(wasm))
x2t.wasm             identity             no Content-Encoding, body = br(wasm)
x2t.wasm.br + CT     br                   Content-Encoding: gzip, body = gzip(br(wasm))
```

The third row is the tell: with `identity` wrangler passes the file through and
**drops our header entirely**, so it is not merging with our declaration, it is
replacing it. `--compatibility-flags brotli_content_encoding` makes no
difference.

What it does respect is its own compressibility rule. Serve the same bytes as
`application/octet-stream` -- which is what an extension it does not recognise
gets -- and it does not touch them:

```
x2t-probe.bin        br                   Content-Encoding: br, body = br(wasm)   ✓
```

So the fix is the filename. `x2t.wasm.br` gets `application/octet-stream`,
wrangler leaves it alone, and our declaration survives. `instantiateStreaming`
needs `application/wasm`, but the loader already re-labels the response itself
(`new Response(response.body, { headers: { 'Content-Type': 'application/wasm' } })`),
so nothing depends on the host typing it.

**Two things are load-bearing and neither looks it**: the `.br` extension, and
the _absence_ of a `Content-Type` rule for that path in `public/_headers`.
Adding `Content-Type: application/wasm` there is enough to make wrangler
consider the file compressible again -- that is the fourth row above, and it is
how this was first written. Both are noted in `_headers` itself, next to the
rule.

## Verified in all four environments

| environment                      | how                                                            | result                                                                      |
| -------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| vite preview (`test:e2e`)        | `vite.config.ts` middleware sets the header in dev and preview | 160 specs green                                                             |
| wrangler pages dev (`e2e-pages`) | `public/_headers`                                              | green after the rename                                                      |
| static-web-server (`e2e-docker`) | `sws.toml` twin rule                                           | passes the file through untouched, header preserved                         |
| real Cloudflare Pages            | `public/_headers`                                              | the `preview-smoke` job, which runs against the PR's own preview deployment |

The last row is the one that matters most and the one we cannot run locally --
which is exactly what that job is for.

One asymmetry worth knowing: static-web-server keeps sending
`Content-Encoding: br` even to a client that asked for `identity`, where
Cloudflare decompresses for it. Technically sloppy of sws, practically
irrelevant -- every browser in the support matrix accepts br, and the only
client we have ever seen ask for identity is curl.

## What is still ours

The `Module.instantiateWasm` hook stays. It is no longer doing any
decompression, but it still carries:

- **the fetch retry** (5xx / 408 / 429 and a rejected fetch, 3 attempts, linear
  backoff). Cloudflare Pages answered 500 for this file mid-run on 2026-08-20
  and cost a whole open; nothing about this change makes that less likely.
- **the failure reporting**, which has to happen twice: rethrown with the
  `X2T module` prefix that `classifyOpenFailure` recognises, and parked on the
  instance so a waiting `doInitialize` is settled instead of sitting out the
  60 s init timeout.

The buffered fallback (`prepareWasmBinary`, for engines without
`instantiateStreaming`) also stays, and is now four lines: fetch, `arrayBuffer`,
assign to `Module.wasmBinary`. It is still the path guard 10
(`guards/wasm-binary-release.ts`) exists to clean up after.

One nice side effect: emscripten's own fallback is `locateFile('x2t.wasm')`,
which used to 404 because no such file was deployed. It still does -- the file
is `.br` -- so that has not changed either way, but the hook is installed before
x2t.js runs in both paths.

## After a vendor upgrade

```
brotli -q 11 -c x2t.wasm > x2t.wasm.br
```

~80 s of CPU, and brotli is not a repo dependency -- same arrangement the
zopfli step had. `test/unit/vendor-contract.test.ts` pins the sha256 of the
**decompressed** module (unchanged by this migration: it is still
`7db02f5c…`, which is how we know the recompression is lossless) and bounds the
compressed size, so a forgotten step turns it red.

## Tests

- `test/unit/hosting-contract.test.ts` gained a case per host: `_headers` and
  `sws.toml` must both declare `Content-Encoding: br` for that path. Losing it
  is not a degradation, it is "no document opens at all".
- `test/unit/vendor-contract.test.ts` switched to `brotliDecompressSync` and a
  brotli size bound.
- `test/unit/converter-wasm-loading.test.ts` lost its `sniffAndRebuild` block;
  the "engine cannot stream" cases now stub `WebAssembly.instantiateStreaming`
  rather than `DecompressionStream`, because that is what `canStreamWasm` reads
  now.
- `test/e2e/wasm-memory.spec.ts` is unchanged and still the real check: it
  asserts the streaming path was taken and nothing was buffered.
