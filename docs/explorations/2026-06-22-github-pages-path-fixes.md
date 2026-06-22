# GitHub Pages 子路径部署修复记录

**日期**: 2026-06-22  
**症状**:
1. `ranuts.github.io/document/zh-cn/` 未检测为中文（显示英文界面）
2. `ranuts.github.io/document/zh-cn/pptx/` 404
3. `ranuts.github.io/document/9.3.0/docx/` 一直 loading，永远不打开编辑器
4. 控制台 `onlyoffice-v7-iframe-patch.js:1 Failed to load resource: 404`
5. 控制台大量 `c:\Windows\Fonts\arial.ttf CORS blocked`
6. CI `playwright-report` artifact 超过 1 GB

---

## 根因分析

### 问题 1-2: iframe patch 脚本 404

v7 和 v9 的编辑器 iframe HTML（`web-apps/apps/<editor>/main/index.html`）均位于 `publicDir`，Vite 将其原样复制，**不经过任何路径重写**。

两个文件里的 script 标签都使用**绝对路径**：
```html
<!-- v7 -->
<script src="/onlyoffice-v7-iframe-patch.js"></script>
<!-- v9 -->
<script src="/onlyoffice-iframe-patch.js"></script>
```

在本地开发服务器（`localhost:5174`/`localhost:5173`）上，`/` 就是 web root，所以能正确找到。但 **GitHub Pages 部署在 `/document/` 子路径**：

- 站点根 = `https://ranuts.github.io/document/`
- iframe 加载自 `.../document/web-apps/apps/documenteditor/main/index.html`
- 绝对路径 `/onlyoffice-v7-iframe-patch.js` → 解析为 `ranuts.github.io/onlyoffice-v7-iframe-patch.js`（缺 `/document/` 前缀）→ **404**

同样，patch 脚本内部的 `fetch('/font-map.json')` 也因同样原因 404，导致 `fontMap` 为空，字体映射失败，CJK 乱码。

### 问题 3: v9 loading forever

v9 patch 404 → `AscDesktopEditor` polyfill 未安装 → SDK 初始化最早期同步调用 `window.AscDesktopEditor.execCommand()` 崩溃 → 整个初始化链断开 → `onAppReady` 永远不触发 → 编辑器停留在 loading skeleton（详见 CLAUDE.md AscDesktopEditor 章节）。

### 问题 4: `c:\Windows\Fonts\` CORS 错误

v7 cell SDK 在非 macOS UA 环境会发出 Windows 绝对路径 XHR（`c:\Windows\Fonts\arial.ttf`）。patch 脚本负责拦截这些请求并改写为 `/fonts/<mapped>`。patch 404 导致拦截器从未安装，SDK 直接向 Windows 路径发起请求，浏览器 CORS 拒绝。

### 问题 5: zh-cn i18n 检测失败

`packages/editor-v{7,9}/src/i18n.ts` 里：
```typescript
if (window.location.pathname.startsWith('/zh-cn/')) {
```

在 GitHub Pages 上 `pathname` 是 `/document/zh-cn/...`，不以 `/zh-cn/` 开头 → 中文检测失败，编辑器用浏览器语言（英文）初始化。

同样，`apps/web/src/lib/ui.ts` 的 `normalizePathname()` 用 `replace(/^\/zh-cn/, '')` 只能去掉路径开头的 `/zh-cn`，子路径部署下无效。

### 问题 6: zh-cn 编辑器路由 404

`pages/zh-cn/` 只有 `-editor` SEO 落地页（如 `zh-cn/docx-editor/`），没有干净编辑器路由（`zh-cn/docx/`、`zh-cn/xlsx/` 等）。用户从 zh-cn 首页点击"新建文档"，`navigateNewDocument('.docx')` 用相对路径 `docx/`，在 `/zh-cn/` 下即 `/zh-cn/docx/` → **404**。

### 问题 7: CI playwright 1 GB artifact

`playwright.config.ts` 设置了 `video: 'retain-on-failure'`。OnlyOffice 加载需要 20-30 秒，多次测试失败时录屏累积超过 1 GB，触发 GitHub Actions artifact 上传警告。

---

## 修复方案

### Fix 1: iframe patch 脚本路径改为相对路径

将 iframe HTML 里的绝对路径改为相对路径（从 `web-apps/apps/<editor>/main/` 往上四级到达 public root）：

```html
<!-- 修改前 -->
<script src="/onlyoffice-v7-iframe-patch.js"></script>
<!-- 修改后 -->
<script src="../../../../onlyoffice-v7-iframe-patch.js"></script>
```

影响文件：
- `public-v7/web-apps/apps/documenteditor/main/index.html`
- `public-v7/web-apps/apps/spreadsheeteditor/main/index.html`
- `public-v7/web-apps/apps/presentationeditor/main/index.html`
- `public-v9/web-apps/apps/documenteditor/main/index.html`
- `public-v9/web-apps/apps/spreadsheeteditor/main/index.html`
- `public-v9/web-apps/apps/presentationeditor/main/index.html`

### Fix 2: patch 脚本内部路径动态计算

在 v7/v9 patch 脚本的 IIFE 开头，从 `document.currentScript.src` 推导 deployment base URL：

```javascript
var _base = (document.currentScript && document.currentScript.src)
  ? document.currentScript.src.replace(/[^/]+$/, '')
  : '/';
```

然后所有绝对路径引用改为：
- `fetch('/font-map.json')` → `fetch(_base + 'font-map.json')`
- `'/fonts/' + mapped` → `_base + 'fonts/' + mapped`

### Fix 3: i18n zh-cn 检测改用 `includes()`

```typescript
// 修改前
if (window.location.pathname.startsWith('/zh-cn/')) {
// 修改后（兼容子路径部署）
if (window.location.pathname.includes('/zh-cn/')) {
```

同时修 `ui.ts` 的 `normalizePathname()` 把 `replace(/^\/zh-cn/, '')` 改为 `replace(/\/zh-cn\//, '/')`，使其在子路径下也能正确剥离 zh-cn 段。

### Fix 4: 添加 zh-cn 编辑器路由页面

新建 4 个页面：
- `pages/zh-cn/docx/index.html`
- `pages/zh-cn/xlsx/index.html`
- `pages/zh-cn/pptx/index.html`
- `pages/zh-cn/csv/index.html`

并在 `vite.shared.ts` 的 `rollupInputs` 中注册。

同时在 `ui.ts` 的 `pageSlugs` 数组中加入 `'docx', 'xlsx', 'pptx', 'csv'`，使语言切换按钮能正确构建 `/zh-cn/docx/` 等 URL。

### Fix 5: CI 禁用视频录制

```typescript
// playwright.config.ts
video: process.env.CI ? 'off' : 'retain-on-failure',
```

---

## 验证

- `pnpm run lint:ts` ✅
- `pnpm run test` ✅ (7 files / 96 tests)
- 构建完成后，`dist/web-apps/apps/documenteditor/main/index.html` 中 patch 路径变为相对路径
- GitHub Pages 部署后需手动验证 `/document/9.3.0/docx/` 正常加载
