# 首页 / 编辑器路由拆分（2026-08-16）

路线图第 10 项（方向六 2）。此前 `/` 一页三用：SEO 落地页 + 新建 + 编辑，
首屏被编辑器 bundle 拖累、URL 不可分享、刷新/后退语义混乱。

## 目标形态（已落地）

| 路由      | 文件          | 内容                                                                                                                                                                                |
| --------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`       | `index.html`  | 纯静态落地页：原 hero + SEO/JSON-LD 原样保留；**不再挂 `index.ts`**，与 `/zh-CN/` 同构（ranui IIFE + `lang-switch.js` + `open-local.js` + 新的 `landing-prefetch.js`），内联注册 SW |
| `/editor` | `editor.html` | 编辑器：`?new=docx\|xlsx\|pptx`、`?file=` / `?src=`（+ `readonly`）、`?embed=1`、`?open=local`、`?agent`；`noindex`；挂 `index.ts`                                                  |

- Vite 改双入口 MPA（`rollupOptions.input = { main, editor }`）；`cleanUrls`
  中间件在 dev 下把 `/editor` 解析到根目录 `editor.html`（preview / CF Pages
  本就按 `.html` 自动解析）。
- **向后兼容**：`index.html` `<head>` 顶部一段内联脚本——URL 带
  `file|src|new|open|embed|embedded|readonly|agent` 任一参数，或页面处于
  iframe 中（旧的裸 `/` 嵌入），立刻 `location.replace('/editor' + search)`
  （iframe 无参数时补 `?embed=1`）。E2E 里所有 `page.goto('/?...')` 因此
  不改也能过。
- hero CTA：Open → `data-open-local="/editor?open=local"`（IndexedDB 交接，
  与 zh 首页同一份 `open-local.js`，accept 加了 `.pdf`）；New * →
  `<a href="/editor?new=…">`。语言切换器改 `data-href` 走 `lang-switch.js`。
- `index.ts`：删掉 hero 接线；裸 `/editor`（无参数、非嵌入）与失效的
  `?open=local` 都 `location.replace('/')`；其余不变。
- `public/sw.js` 预缓存加 `./editor`、`./editor.html`。
- `embed-demo.html` iframe → `./editor?embed=1`；docs/embed-api(.zh).md、
  readme(.zh).md、help 内容、embed 落地页示例统一改 `/editor?...` 并注明旧
  链接仍可用；zh 首页与 zh 落地页的 `?locale=zh-CN&new=docx` 改到 `/editor`。
- 意图预取：`/` 上没有 bundle，用 `public/landing-prefetch.js`（与
  `lib/prefetch.ts` 同一套 URL 与规则）挂到 `#hero-open` 与 `[data-prefetch]`。

## 验证

- 单测 499 绿（landing-pages 契约把 zh CTA 允许集改为 `/editor?locale=…`）。
- E2E：`app-smoke.spec` 改写为三条——`/` 是静态落地（有 hero、无
  `#iframe`/`#fab-container`、URL 不含 /editor）、`/?new=docx` 重定向到
  `/editor?new=docx` 且编辑器壳就位、裸 `/editor` 回到 `/`；main-site /
  entry-paths / embed-api / embed-save-default 沿旧 URL 全绿（靠重定向）；
  全套 E2E 结果见 PR。

## 收益与后续

- 首页彻底不下载编辑器 JS（此前即便去掉 api.js 同步标签，`index.ts` 及其
  依赖仍随首页加载）；LCP 复测待部署后用同一方法量。
- 主题切换/`?locale` 等首页交互全部由静态脚本承担，`/` 与 `/zh-CN/` 现在是
  同一形态，多语言落地页（方向八 3）可以直接复制。
- SW 更新策略仍只在编辑器页处理（那里才有"文档打开中"的状态）；首页只做
  裸注册。
