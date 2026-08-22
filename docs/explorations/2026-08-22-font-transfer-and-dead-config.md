# 字体在线上是裸传的，外加三处从未生效的配置

日期：2026-08-22
相关：`public/_headers`、`sws.toml`、`vite.config.ts`、`tsconfig.json`、`package.json`
后续：字体版权与多语言回退（同一轮排查的下半场，另见后续记录）

## 一、`/fonts/*` 既没压缩，边缘也没缓存

线上探针（`curl -H 'Accept-Encoding: br, gzip'`，2026-08-22）：

```
/fonts/103                    content-length: 17151049   （无 content-encoding）  cf-cache-status: DYNAMIC
/fonts/007                                               （无 content-encoding）  cf-cache-status: DYNAMIC
/sdkjs/common/AllFonts.js     content-type: application/javascript   content-encoding: br   cf-cache-status: REVALIDATED
```

同一个源，隔壁的 `.js` 走 brotli 且边缘有缓存，字体两样都没有。连续两次 GET
`cf-cache-status` 都是 `DYNAMIC`，即每次都回源。

### 原因

catalog 文件按索引命名（`/fonts/103`），**没有扩展名**。Pages 因此把它们类型
成 `application/octet-stream`：

- 这个 content-type 不在 Cloudflare 的可压缩清单里 → 不压缩；
- 也不属于 CF 默认按扩展名判定的可缓存静态资源 → 边缘不缓存。

`_headers` 里那条 `Cache-Control: public, max-age=31536000, immutable` 只管住了
浏览器，管不到这两件事——注释里"Long-lived at both the CF edge and the browser"
这句与线上事实不符，本次一并更正。

### 代价

本地实测这批 catalog 字体的 gzip 压缩率：

| 文件 | 原始       | gzip      | 比例  |
| ---- | ---------- | --------- | ----- |
| 103  | 17,151,049 | 9,900,427 | 57.7% |
| 266  | 16,791,251 | 9,196,472 | 54.8% |
| 020  | 15,228,012 | 7,918,588 | 52.0% |
| 007  | 12,591,068 | 8,688,627 | 69.0% |

267 个文件共 356 MB，其中 53 个超过 1 MB。首次打开一篇中日韩文档要串行拉几十 MB，
其中接近一半是本可以省掉的。

### 处理

`_headers` 与 `sws.toml` 的 `/fonts/*` 组各加一行 `Content-Type: font/ttf`——
它在 CF 的可压缩清单上。

这是**传输标签，不是格式承诺**：catalog 文件是前 32 字节被 XOR 混淆的 TTF
（见 docs/fonts.md），不能当 webfont 直接用。也没有任何东西按 webfont 解析它——
vendor 的字体加载器走 `XMLHttpRequest` + `responseType = 'arraybuffer'`
（`sdkjs/word/sdk-all-min.js` 里那个 `Eb.responseType = bb` 的 XHR 包装），
响应的 Content-Type 不参与其中，`X-Content-Type-Options: nosniff` 也只约束
`<script>` / `<style>` 这类加载路径。

**边缘缓存这条仓库里够不着**：`cf-cache-status: DYNAMIC` 要靠 Cloudflare 面板
的 Cache Rule 才能改，而面板配置不在仓库里（CLAUDE.md 已记载这一类只能靠线上
冒烟兜底）。已在 `_headers` 注释里写明，避免下次有人以为改完 `_headers` 就完事。

### 用例

`test/unit/hosting-contract.test.ts` 两侧各加一条，钉住 `_headers` 与 `sws.toml`
的 `/fonts/*` 都声明 `font/ttf`（两份配置必须同步是既有约定）。

**反向验证**：把两个文件里的 `Content-Type` 行删掉，两条用例双双变红
（`expected undefined to be 'font/ttf'`）；恢复后 12 条全绿。

## 二、三处从未生效的配置

### 1. 路径别名全是死的

`vite.config.ts` 的 5 条 alias（`@/lib` `@/store` `@/assets` `@/types`
`@/styles`）与 `tsconfig.json` 的 11 条 `paths`，**全仓库 import 次数为 0**。
其中 `@/store` 和 `@/assets` 指向 `store/` 和 `assets/`，`paths` 还列着
`src/` `components/` `router/` `pages/` `locales/`——这些目录一个都不存在。

两边各留一条通配（`tsconfig` 的 `"@/*": ["./*"]`，vite 的 `alias: { '@': __dirname }`），
让 CLAUDE.md 里"路径别名使用 `paths` + `@/*` 前缀"这条约定继续成立，且 tsc 与
打包器对同一个 `@/lib/x` 解析一致——之前 vite 侧只认那 5 个前缀，tsconfig 侧另有
一套，本来就对不齐。

### 2. scss 预处理配置空转

`css.preprocessorOptions.scss.additionalData` 往每个 `.scss` 里注入
`@import "@/styles/base.css"`。仓库里没有任何 `.scss` 文件，删除。

### 3. 根 `package.json` 两个幽灵重依赖

`@anthropic-ai/sdk` 和 `@mlc-ai/web-llm` 在 `lib/`、`index.ts`、`test/` 里
一次都没被 import，只有 `packages/agent-core` 用，而它自己声明了这两个依赖。

更糟的是版本号：根写 `^0.116.0`，`agent-core` 写 `^0.106.0`。npm 对 0.x 的
caret 锁次版本号，两个 range 不相交，于是装了两份：

```
node_modules/.pnpm/@anthropic-ai+sdk@0.106.0
node_modules/.pnpm/@anthropic-ai+sdk@0.116.0
```

与此前 ranui 双版本那次是同一类问题。删掉根上这两条后 `pnpm why` 只剩一个版本。

## 三、顺带记录：本轮没有动的两件事

- **vendor 死重量约 85 MB**：`sdkjs/{word,cell,slide,visio}/sdk-all.js`（54 MB，
  requirejs 配的是 `sdk: "../../sdkjs/word/sdk-all-min"`，非 min 那份从不加载）、
  `*_ie*.js`（27.5 MB，加载条件是 `WebAssembly.Memory` 缺失，而本站 x2t 强依赖
  WASM）、visio 整套（`DOCUMENT_TYPE_MAP` 里没有 vsdx）。删掉不会让用户少下一个
  字节，但镜像、部署上传、`VENDOR_VERSION` 哈希、worktree checkout 都会受益。
- **`__fonts_files` 是位置索引**：删 catalog 文件不能直接从数组里摘条目，会打乱
  后面所有位置。这条约束决定了字体清理该怎么做，见后续记录。
