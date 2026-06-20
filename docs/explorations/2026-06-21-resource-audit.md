# OnlyOffice Web Mode 资源加载全面审计

**日期：** 2026-06-20（接续 [2026-06-20-docx-image-fix.md](2026-06-20-docx-image-fix.md)）
**分支：** `explore/path-d-desktop-mock`
**背景：** 修复 DOCX 图片加载后，全面检查其他资源类型是否存在相同的 "SPA fallback 陷阱"。

---

## 问题背景：SPA fallback 陷阱

Vite dev server 对 `public/` 中不存在的路径返回 **SPA fallback HTML**（6640 字节，`text/html`，HTTP 200）。
若 SDK 通过 HTTP 请求了不存在的资源，且将结果作为二进制数据（图片、字体、WASM）处理，
就会发生静默失败或程序崩溃。

---

## 审计方法

1. 从 SDK minified JS（`public/sdkjs/word/sdk-all-min.js`）提取所有绝对路径字符串
2. 列举 SDK 的所有 HTTP 请求类别（XHR、`fetch()`、`new Image()`、CSS `url()`、Worker）
3. 逐类检查资源是否存在于 `public/` 中，是否有 fallback 处理

---

## 资源分类审计结果

### ✅ 已修复

| 资源类型 | 请求路径 | 修复方式 |
|---------|---------|---------|
| 文档图片（DOCX） | `/media/word/media/*.{png,jpg,...}` | `HTMLImageElement.prototype.src` patch + ZIP 解析（`src/lib/docx-zip.ts`） |
| 文档图片（XLSX） | `/media/xl/media/*` | 同上（MEDIA_PREFIXES 包含 `xl/media/`）|
| 文档图片（PPTX） | `/media/ppt/media/*` | 同上（MEDIA_PREFIXES 包含 `ppt/media/`）|
| 系统兜底字体 | `/fonts/DejaVuSans.ttf` 等 | `fontRemapMiddleware`（HTTP 层重写）|
| 文档字体（XHR） | `ascdesktop://fonts/<name>` | XHR prototype patch（`vite.config.ts` → `patchFontUrls`）|
| Socket.IO 握手 | `/doc/*/c/*` | `onlyofficeEngineIOHandshake` 中间件 |
| SW 404 | `/document_editor_service_worker.js` | 中间件直接返回 404 |

### ✅ 不受影响（静态文件已存在）

| 资源类型 | 路径前缀 | 说明 |
|---------|---------|-----|
| SDK JS | `/sdkjs/*` | 全部在 `public/sdkjs/` 下 |
| WASM（x2t） | `/wasm/x2t/x2t.js`, `x2t.wasm` | 在 `public/wasm/x2t/` 下 |
| Web Apps JS | `/web-apps/apps/*/main/app.js` 等 | 在 `public/web-apps/` 下 |
| 编辑器图标/精灵图 | `/web-apps/apps/*/resources/img/` | 在 `public/web-apps/` 下 |
| 拼写检查 WASM | `/sdkjs/common/spell/spell/spell.wasm` | 在 `public/sdkjs/common/spell/spell/` 下 |
| ChartStyles | `/sdkjs/common/Charts/ChartStyles.js` | 在 `public/sdkjs/common/Charts/` 下 |
| locale JSON | `/web-apps/apps/*/locale/*.json` | 在 `public/web-apps/` 对应目录下 |
| CSS 内联图片 | `url(../../img/controls/*.png)` | 相对路径，均存在 |
| plugins.json | `/plugins.json` | `public/plugins.json`（空数组）|
| themes.json | `/themes.json` | `public/themes.json`（空数组）|

### ℹ️ 缺失但静默降级（非 crash）

| 资源类型 | 路径 | 行为 |
|---------|------|-----|
| 断字词典 | `/hyph_<lang>.dic` | SDK 检测不到后关闭自动断字功能，文档仍可打开编辑 |
| 拼写检查词典 | `/dictionaries/<lang>/...` | 拼写错误不会有红色下划线提示，但编辑不受影响 |

这两类缺失不会产生报错 dialog，也不会导致文档加载失败。

---

## 结论

**文档内嵌图片是唯一存在 SPA fallback 陷阱的资源类型**，已在前一轮修复。

其他所有 SDK 使用的资源：
- 要么已经是 `public/` 目录下的静态文件（SDK JS/WASM/图标/locale）
- 要么通过已有中间件处理（字体、Socket.IO）
- 要么在资源缺失时优雅降级（断字/拼写）

**不需要额外修复**。

---

## 附：x2t "memory access out of bounds" 错误的根因

本轮调试末尾出现了 alert 弹窗：

```
Document operation failed: Document conversion failed: memory access out of bounds.
```

**根因**：调试期间 `public/test-report.docx` 被清理删除，但浏览器地址栏仍保留指向该文件的 URL。
页面刷新后，Vite 对 `/test-report.docx` 返回 SPA fallback HTML（6640 字节）。
x2t WASM 把 HTML 字节流当作 DOCX 二进制解析，触发内存越界崩溃。

**正常使用路径**：用户通过文件选择器打开文档时，内容以 `File → ArrayBuffer → Uint8Array` 方式传给
x2t，完全在内存中处理，不经过 HTTP 请求。该错误在正常使用中不会出现。

**不影响生产使用，无需额外处理。**

---

## 相关文件

| 文件 | 说明 |
|------|------|
| [2026-06-20-docx-image-fix.md](2026-06-20-docx-image-fix.md) | DOCX 图片修复详情 |
| [2026-06-20-cjk-font-split-brain-fix.md](2026-06-20-cjk-font-split-brain-fix.md) | 字体 split-brain 修复详情 |
| `src/lib/docx-zip.ts` | browser-side ZIP 解析器（含 XLSX/PPTX media 支持）|
| `vite.config.ts` | 中间件汇总：EngineIO、fontRemap、WebModePatch（图片 + 字体 + dialog）|
