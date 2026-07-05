# x2t WASM 走 gzip 客户端解压 —— 解除 Cloudflare Pages 迁移的唯一硬阻塞

> 2026-07-05

## 背景

document 项目计划从 `ranuts.github.io/document` 迁到 `edit.chaxus.com`(Cloudflare Pages)。
唯一的托管硬阻塞:**CF Pages 单文件上限 25 MiB**,而 `public/wasm/x2t/x2t.wasm` = **55 M**,部署时会被直接拒收(dist 文件数 336,远低于 2 万上限,无其它阻塞)。

目标:让浏览器仍拿到 55M 解压后的 wasm,但**部署产物里不再有超限的裸文件**。

## 方案

`x2t.js`(Emscripten 胶水)默认 `fetch('x2t.wasm')` + `instantiateStreaming`。但它:

1. **复用已存在的全局 `Module`**(`if (!Module) Module = ...`,并 `moduleOverrides = Object.assign({}, Module)` 回填)。
2. 第 284 行 `if (Module['wasmBinary']) wasmBinary = Module['wasmBinary']` —— 一旦 `Module.wasmBinary` 有值,`getBinarySync` 直接返回它、`instantiateAsync` 跳过 streaming fetch,**根本不请求 `x2t.wasm`**。

于是在 `@ranuts/converter` 的 `loadScript()` 里、注入 x2t.js **之前**新增 `prepareWasmBinary()`:

- `fetch(x2t.wasm.gz)`(11M,under 25MiB)
- 用浏览器原生 **`DecompressionStream('gzip')`** 解压(无新依赖)
- `window.Module = { ...window.Module, wasmBinary }`

部署产物只保留 `x2t.wasm.gz`(11M) + `x2t.js`,删掉 `x2t.wasm`(55M)与 `x2t.wasm.br`(8M,brotli 需额外解码器,不用)。

## 关键坑:服务器对 `.gz` 的处理不一致

一开始直接 `DecompressionStream('gzip')`,在 `vite preview` 下报 `Z_DATA_ERROR: incorrect header check`。

原因:**vite 的 dev/preview 服务器识别 `.gz` 后缀,给响应加 `Content-Encoding: gzip`**(实测 `Content-Type: application/wasm` + `Content-Encoding: gzip`),浏览器/fetch 层已透明解压了一次,我再手动解压就是对已解压数据二次解压。

而静态托管(CF Pages / GitHub Pages)通常发**原始 gzip 字节**(不加 Content-Encoding)。两种行为都要兼容。

**解法:按 magic bytes 探测**——收到的首字节是 `1f 8b`(gzip)才手动解压;是 `00 61 73 6d`(`\0asm`,已是裸 wasm)就直接用。对任何服务器都正确。

## 验证(端到端)

| 环节 | 方法 | 结果 |
|---|---|---|
| isGzip=false 分支(preview 自动解压) | Node fetch preview 的 .gz → 探测 → compile | 54.7M,magic OK,`WebAssembly.compile` OK(28 exports) |
| isGzip=true 分支(静态托管原始 gzip) | Node 直接读磁盘 .gz 原始字节 → 手动解压 → compile | 54.7M,compile OK |
| 浏览器集成 | Playwright:注入 binary → 加载真实 x2t.js → 等 `onRuntimeInitialized` + 监听网络 | **运行时初始化 OK;FS/ccall 可用;对 `x2t.wasm` 请求 0 次(只请求 `x2t.wasm.gz`)** |
| 构建产物 | `find dist -size +25M` | **空**(最大文件 = x2t.wasm.gz 11M) |
| 回归 | `pnpm run lint:ts` / `pnpm run test` | 通过 / 19 files · 240 tests 全过 |

## 结论 & 影响

- **迁 CF Pages 的唯一硬阻塞已解除**:dist 无 >25MiB 文件。
- 改动集中在 `@ranuts/converter`(`prepareWasmBinary`)+ 删两个大文件,主 app 代码零改动。
- 对现有 GitHub Pages 部署也安全(magic 探测 + 现存 .gz)。

## 遗留(不阻塞 CF 迁移)

- `build:single`(单 HTML,`bin/bundle_single_html.js`)靠内联裸 wasm,删裸文件后该 target 的 wasm 需改为内联 `.gz` + 同款解压逻辑。非部署链,单列跟进。
