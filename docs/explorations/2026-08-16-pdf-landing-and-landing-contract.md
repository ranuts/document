# /open/pdf 落地页与落地页契约测试（2026-08-16）

路线图方向一第 1/4 项（`docs/superpowers/plans/2026-08-15-next-phase-roadmap.md`）。
本轮只动静态内容与测试，不触碰编辑器运行逻辑。

## 做了什么

1. `public/open/pdf.html`（en）+ `public/zh-CN/open/pdf.html`（zh-CN）
   与 `/open/docx` 同构：TDK、canonical、hreflang 三件套、OG/Twitter、
   JSON-LD（WebApplication / SoftwareSourceCode / FAQPage / HowTo /
   BreadcrumbList）、同一份 landing.css + ranui 组件（r-button / r-card /
   r-select / r-theme-switch）、语言切换 `data-href` 互指、页脚互链。
   目标词：_open pdf in browser without upload_ / _在线打开 PDF 不上传_。
2. 全站互链同步：`index.html` 与 `public/zh-CN/index.html` 各加一张
   `.PDF` 格式卡片；20 个落地页页脚加 "Open PDF / 打开 PDF"；
   `public/sitemap.xml` 加两条（lastmod 2026-08-16）；`public/llms.txt`
   Pages 段加一行。
3. 新增 `test/unit/landing-pages.test.ts`：遍历 `public/**/*.html`
   （排除 404 / embed-demo / vendor 目录）+ 根 `index.html`，逐页断言
   canonical = 自身、hreflang en/zh-CN/x-default 指向存在的文件、
   `<html lang>` 一致、og:url = canonical、JSON-LD 可解析且
   WebApplication.url = 自身、FAQPage ≥3 条、另一语言的对应页存在且
   本页 `data-href` 指向它、sitemap 含本页；再整体断言 sitemap 无孤儿
   URL、四个 /open/\* 都被双首页与 llms.txt 引用、zh-CN CTA 规则（见下）。
   119 个断言，600 ms。

## 文案边界（为什么不写"编辑 PDF"）

`test/e2e/pdf-roundtrip.spec.ts` 实际验证过的能力是：pdfeditor 打开、
`AddFreeTextAnnot`、`document:save` 拿回 `%PDF-` 且含 `/Annots`；
读写正文段落没有验证过、引擎也不支持。所以页面承诺的只有
"阅读 / 搜索 / 评论与文字批注 / 另存回 PDF"，FAQ 里显式回答
"不能像 Word 一样改写已有正文"，并把改正文需求引到 /open/docx +
"下载为 PDF"。这样避免了落地页承诺 > 实际能力被 issue 打脸的老问题。

## 顺手修的一个内容 bug

zh-CN 侧 `/open/{docx,xlsx,pptx}`、`/convert/*` 五个页面的主 CTA
"打开你的 XLSX →" 全部指向 `/?locale=zh-CN&new=docx`——`index.ts` 里
`?new=docx` 的语义是**直接新建一份空白 Word 并跳过首页**，与"打开你的
XLSX"完全对不上（用户落进空白 Word，还得自己找 Open）。EN 侧 CTA 是 `/`
（首页 hero → Open）。统一改成 `/zh-CN/`（中文首页自带 `open-local.js`
选文件流程）；`private` / `edit-without-account` 两页原本指向英文 `/`，
也改成 `/zh-CN/`。`no-signup` / `offline` 两页的"打开编辑器"保留
`?locale=zh-CN&new=docx`（这里语义正确）。测试里把这条规则钉住：zh CTA
只允许 `/zh-CN/`、`/?locale=zh-CN&new=docx`、`/embed-demo.html` 三种，
且标签含"打开你的"的必须是 `/zh-CN/`。

## 测试里踩的坑

`path.resolve(PUBLIC, '/zh-CN/open/pdf.html')`——第二参数以 `/` 开头会被
当作绝对路径，直接丢掉 PUBLIC，导致 23 个"对应页不存在"的假失败。
拼接站内路由要用 `path.join`。

## 验证

- `pnpm exec vitest run test/unit/landing-pages.test.ts` → 119 passed
- `pnpm exec vite` 下 `GET /open/pdf`、`/zh-CN/open/pdf` 均 200 且 title
  正确（clean URL 由 vite.config.ts 中间件解析；Pages 线上由 CF 的
  `.html` 自动解析承担，`playwright.pages.config.ts` 层可复现）
- prettier / oxlint 对触碰文件通过

## 附：vendor 树 noindex（路线图方向二 1）

`public/_headers` 给 `/web-apps/*`、`/sdkjs/*`、`/fonts/*` 加
`X-Robots-Tag: noindex`（只加这一个头，不动缓存策略——sdkjs/web-apps
仍需 revalidate）。选头而不是 robots.txt `Disallow`：Disallow 只是不抓，
被外链到的 URL 仍可能"无摘要收录"，且爬虫永远看不到 noindex；允许抓一次

- noindex 才会真正从索引中移除。Cloudflare Pages 会合并所有匹配规则的头，
  所以 `x2t.wasm.gz` 同时得到 immutable 与 noindex。
  `hosting-contract.test.ts` 新增一条：三个 vendor 前缀必须 noindex，
  `/*`、`/open/*`、`/zh-CN/*`、`/assets/*` 不得带 X-Robots-Tag。

## 未做 / 后续

- 方向一 2（CSV 中文乱码长文 + `/fix/csv-garbled` 评估）、3（embed 页
  runtime read-only 一节）、4 的 index.html 页脚 6 条内链——下一轮。
- 页面 E2E（真实浏览器里 r-select 语言切换跳转、r-theme-switch）沿用
  现有 pages 层，本轮未加专项 spec。
