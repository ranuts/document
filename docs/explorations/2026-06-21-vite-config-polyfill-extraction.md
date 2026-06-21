# vite.config.ts 瘦身：polyfill 从 Vite 插件迁移到静态 JS 文件

**日期：** 2026-06-21  
**分支：** `explore/path-d-desktop-mock`  
**影响文件：** `vite.config.ts`、`public/onlyoffice-iframe-patch.js`、三个 OnlyOffice iframe HTML 文件

---

## 一、背景与动机

在修复完 DOCX/XLSX/PPTX 渲染（Shc/Mrc/K8b patch）之后，`vite.config.ts` 里有一个 350 行的 `onlyofficeWebModePatch()` 函数，它的职责是：

1. 拦截三个编辑器 iframe 的 HTTP 响应（`/web-apps/apps/.../index.html`）
2. 在响应的 `<head>` 里注入一段 350+ 行的内联 `<script>`，包含：
   - `window.AscDesktopEditor` polyfill（90+ 方法）
   - XHR 字体 URL 重写（`ascdesktop://fonts/` → `/fonts/<mapped>`）
   - `HTMLImageElement.src` 重定向（图片媒体缓存）
   - `Common.UI.alert/warning` 弹窗抑制

这违反了 Vite 作为纯构建工具的职责边界：
- Vite 插件在 dev 和 preview 服务器里生效，但 build 产物里这段代码不存在
- 内联的 JS 字符串无法被 TypeScript / ESLint / Prettier 检查
- 调试时无法在 DevTools 里打断点（内联 script 没有 source URL）
- 嵌入 font-map JSON 的 `var fontMap = ${embeddedFontMap}` 模板字符串需要服务器每次动态生成

---

## 二、更好的方案

用户提出：**既然源码在那里，为什么不直接改 HTML 文件？**

OnlyOffice 的 iframe HTML（`public/web-apps/apps/.../index.html`）本来就是静态文件，Vite 只是透传它们。正确的做法是：

```
public/
  onlyoffice-iframe-patch.js   ← 新建：普通 JS 文件，受 lint/prettier 约束
  web-apps/apps/
    documenteditor/main/index.html   ← 加一行 <script src="/onlyoffice-iframe-patch.js">
    spreadsheeteditor/main/index.html
    presentationeditor/main/index.html
```

静态文件方案的优势：
- Vite 配置回归纯构建职责（-350 行）
- 补丁文件是普通 JS，可被 DevTools Source Maps 追踪
- font-map 用 `fetch('/font-map.json')` 异步加载，无需服务器模板渲染
- build/deploy 产物和 dev server 行为完全一致（静态文件 build 时自动复制）

---

## 三、字体竞态风险评估

旧方案：font-map 内联进 HTML → XHR 拦截器在注册时即有完整 map → 零竞态风险

新方案：`fetch('/font-map.json')` 异步加载 → map 可能在第一次字体 XHR 前没有加载完

**评估结论：安全。**

OnlyOffice 字体 XHR 的触发时序：
1. 浏览器解析并执行 `onlyoffice-iframe-patch.js`（包括发出 fetch 请求）
2. 浏览器执行多个 `<script>` 标签（`sdk-all-min.js`、`app.js` 等，共 ~2–5 MB）
3. `onAppReady` 触发后加载文档
4. 用户操作插入内容 → 触发文档字体 XHR

步骤 1 的 `fetch('/font-map.json')` 是本地服务（<1ms RTT），而步骤 2 的 JS 解析需要 500ms–2s。从 fetch 发出到第一次字体 XHR，有充裕的异步窗口（远超 fetch 的实际延迟）。

此外，`fontRemapMiddleware`（Vite 服务器 HTTP 层）也作为后备：即使 JS 层的 XHR patch 未来出现竞态，HTTP 层也会拦截并重定向字体请求。

---

## 四、改动清单

### 新增：`public/onlyoffice-iframe-patch.js`

5 个模块，顺序执行：
1. `fetch('/font-map.json')` 异步预载字体映射
2. `installAscDesktopEditor()` — `window.AscDesktopEditor` polyfill（50+ 方法）
3. `patchFontUrls()` — XHR 原型 patch，`ascdesktop://fonts/<x>` → `/fonts/<mapped>`
4. `patchImageUrls()` — `HTMLImageElement.prototype.src` setter patch
5. `suppressConnectionLost()` — 轮询等待 `Common.UI` 就绪后抑制弹窗

### 修改：三个 iframe HTML 文件

在 `<head>` 第一行添加：

```html
<script src="/onlyoffice-iframe-patch.js"></script>
```

文件：
- `public/web-apps/apps/documenteditor/main/index.html`
- `public/web-apps/apps/spreadsheeteditor/main/index.html`
- `public/web-apps/apps/presentationeditor/main/index.html`

### 修改：`vite.config.ts`

- 删除 `onlyofficeWebModePatch()` 函数（约 350 行）
- 从 `plugins` 数组移除该插件调用
- 文件从 ~579 行缩减至 ~200 行

---

## 五、与 build 产物的关系

```
pnpm run build
  → Vite 从 pages/ 构建 HTML
  → public/ 目录原样复制到 dist/
    包括 onlyoffice-iframe-patch.js 和已修改的 iframe HTML
  → 产物与 dev server 行为完全一致，无额外配置
```

旧的 Vite 中间件只在 dev/preview 服务器运行，build 产物缺少这段注入，是个潜在隐患（虽然 build 产物实际上通过静态服务器托管，也不会经过 Vite 中间件）。新方案消除了这个不一致。

---

## 六、验证

```bash
pnpm run lint:ts     # ✅ oxlint + tsc --noEmit 通过
pnpm run test        # ✅ 7 files / 96 tests passed
```
