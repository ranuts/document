# 意图触发的编辑器资产预取（2026-08-16）

路线图第 11 项前半（方向四 2 后半）。基线（explorations/2026-08-16-perf-
baseline-and-api-loader.md）显示冷打开 ≈16 s 里有 ≈9 s 是纯下载：api.js →
app.js（≈2 MB 原始）→ sdk-all-min.js → sdk-all.js（≈14 MB 原始 / ≈3 MB br）。
决策是不做无差别 idle 预取（对只读落地页的访客是 3 MB 浪费），改"意图触发"。

## 实现 `lib/prefetch.ts`

- `editorAssetUrls(kind?)`：loader + 该 app 的 app.js + sdk-all-min.js +
  sdk-all.js（docx→word/documenteditor，xlsx→cell/spreadsheeteditor，
  pptx→slide/presentationeditor）。
- `prefetchEditorAssets(kind?)`：往 `<head>` 插 `<link rel="prefetch" as="script">`，
  按 URL 去重；`navigator.connection.saveData` 或 2G 直接跳过。prefetch 走
  fetch 事件，SW 的 stale-while-revalidate 会顺手把它们放进 RUNTIME_CACHE，
  所以随后真正的加载是缓存命中。
- `prefetchOnIntent(el, kind)`：pointerenter / focus / touchstart 首次触发。
- 接线：FAB 菜单的 View/Edit（loader）与三个 New（全套）。首页 hero 的
  同款接线在路由拆分（同日）后改由静态 `public/landing-prefetch.js` 承担
  （`/` 不再有 bundle），规则与 URL 表与本文件一致。

## 验证

- 单测 `test/unit/prefetch.test.ts` 5 条（URL 映射、文件名→app、去重、
  Save-Data/2G 否决、intent 只触发一次）。jsdom 的 `<link>` 没有 `.as`
  属性，要用 `setAttribute('as', 'script')`。
- 真浏览器：hover "New Word" 后 `<head>` 出现 4 条 prefetch link，
  Resource Timing 中 4 个请求 initiatorType=link 已发出。

## 度量待办

上线后用 chrome-devtools 复测"hover 1 s 后点 New Word"的就绪时间；预期
把 sdk-all.js 的 6.6 s 从关键路径挪到 hover 与点击之间。
