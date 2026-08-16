# 性能基线 + 首页去掉渲染阻塞的 api.js（2026-08-16）

路线图第 9 项（方向四 2 前半）。方法：chrome-devtools MCP 直接打线上
edit.chaxus.com，冷 profile、无节流，performance trace + 逐帧
`performance.getEntriesByType('resource')`。数字与结论已写进路线图方向四 2
"基线"小节，这里只记过程与首刀。

## 首页

LCP 774 ms（TTFB 205 / render delay 569）。渲染阻塞请求 5 个：home.css、
index-_.css、fonts.css、ran-tokens._.css，以及 **`web-apps/apps/api/documents/
api.js`——一个同步 `<script>`，479 ms**。它是 OnlyOffice DocsAPI 加载器，
只有真的打开/新建文档才需要；`lib/onlyoffice-editor.ts` 早有幂等的
`loadEditorApi()`，但只有 `onCreateNew` 与 embed 路径调用它，
`openLocalFile` / `openDocumentFromUrl` / 桌面事件路径都在吃 head 里那个
同步标签。

首刀：删同步标签，`lib/converter.ts` 的 `handleDocumentOperation`（所有
打开路径的汇合点）开头 `await loadEditorApi()`；index.html 留一条
`<link rel="prefetch" as="script">`（低优先级、不阻塞）。验证：单测 461
绿；E2E app-smoke / main-site / entry-paths / embed-api / embed-save-default
16 passed（覆盖 hero 打开、New Excel、`?file=`、`?open=local`、embed 三种打开）。

## 编辑器冷打开（`?new=docx`）

就绪（`isDocumentLoadComplete && isLoadFullApi`）≈ 16 s。瀑布：
app.js 0.35–0.9 s → sdk-all-min.js 1.2–1.9 s → **sdk-all.js 2.95 MB br，
2.0–8.6 s** → 14 个字体文件 8.9–15.0 s。sdk-all.js 边缘已命中
（REVALIDATED、br），是纯带宽；字体仍 DYNAMIC（`_headers` immutable 已上，
但无扩展名路径要 CF 面板 Cache Rule，待用户）。空白文档拉 14 个字体文件
偏多，留给字体专项查 `fonts_loading`。

## 预取决策

不做无差别 idle 预取（3 MB 对落地页访客是浪费）；改"意图触发"——hover /
focus 打开与新建按钮、文件选择框弹出时 prefetch sdk-all-min.js /
sdk-all.js / app.js。留在路线图第 11 项，与路由拆分一起做。

## 顺手

第 8 项"PPT E2E"实际早已被战役里的 format-parity / embed-save-default /
resave-idempotence / visual-roundtrip / corpus 覆盖，路线图打 ✅ 并注明。
