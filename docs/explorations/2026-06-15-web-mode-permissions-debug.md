# 9.3.0 Web Mode：onEditorPermissions 时序调试

**日期：** 2026-06-15  
**分支：** `explore/path-d-desktop-mock`  
**前置文档：** [path-reflection-and-web-mode-plan.md](2026-06-15-path-reflection-and-web-mode-plan.md)

---

## 背景

切换为 Web Mode（无 `window.AscDesktopEditor`）+ Engine.IO 最小握手后，完整工具栏（Tab 行 + 格式化控件）已能渲染。  
但在多次刷新测试中，出现了两类新崩溃，暴露了 9.3.0 SDK 的权限初始化时序。

---

## 崩溃 1：`this.mode` undefined → `createDelayedElements` 失败

### 错误信息

```
Cannot read properties of undefined (reading 'canCoAuthoring')
  at toolbar.createDelayedElements
```

### 根因（app.js:965038 → 807863 → 876767）

`onDocumentContentReady` 在 50ms `setInterval` 内调用 `Main.createDelayedElements()`，后者调用：
1. `this.toolbar.createDelayedElements()` — 内部读取 `this.mode.canCoAuthoring`
2. `this.attachUIEvents(this.toolbar)` — 访问 `toolbar.btnTextFromFile.menu.on(...)`

`this.mode` 由 `applyModeCommonElements()` 在 `onEditorPermissions` 内部设置（app.js:1751022）。  
**如果 `onEditorPermissions` 没有在 `onDocumentContentReady` 之前运行，`this.mode` 就是 `undefined`。**

### 服务器正常流程

```
socket.io 连接 → 服务器推送 join/permissions 事件
  → SDK 触发 asc_onGetEditorPermissions(perms)
  → app.js onEditorPermissions(perms)
  → applyModeCommonElements() → this.mode 有值
  → _isPermissionsInited = true
```

没有真实服务器，这条路永远不会走。

### 修复：轮询 + 手动调用 fakePerms

```typescript
// onAppReady 里，等 loadDocument 运行完毕：
while (!mainCtrl.appOptions?.user || !mainCtrl.document) {
  await new Promise(r => setTimeout(r, 50));
}
// 手动触发权限初始化
mainCtrl.onEditorPermissions(fakePerms);
```

`fakePerms` 关键字段：
- `asc_getLicenseType()` → `3`（`c_oLicenseResult.Success`）
- `asc_getRights()` → `1`（`c_oRights.Edit`）
- `asc_getBuildVersion()` → 从 `LeftMenu.about.txtVersionNum` 读取 3 位版本号（防止 onServerVersion 报版本不匹配）

**验证：** `isEdit=true`, `_isPermissionsInited=true` 出现在 console ✓

---

## 崩溃 2：`btnTextFromFile.menu.on is not a function`（第二次刷新）

### 错误信息

```
Uncaught TypeError: t.btnTextFromFile.menu.on is not a function
  at attachUIEvents (app.js:876767)
```

### 根因：SDK 的第二次 `onEditorPermissions` 调用覆盖了 fakePerms

时序如下：

```
1. api.js 发 'init' + 'opendocument' postMessage（同一事件循环轮）
2. iframe 处理 opendocument → loadDocument(e)（app.js:1714869）
     → 注册 asc_onGetEditorPermissions 回调
     → 调用 api.asc_setDocInfo(e)         ← 设置文档 URL
     → 调用 api.asc_getEditorPermissions() ← 触发 SDK 许可证检查
3. 我们的 onAppReady 异步轮询结束 → 调用 mainCtrl.onEditorPermissions(fakePerms)
     → isEdit=true, _isPermissionsInited=true ✓
4. SDK 许可证检查返回（无证书 → canLicense=false）
     → 触发 asc_onGetEditorPermissions → onEditorPermissions(realPerms)
     → isEdit = canLicense(false) && canEdit → isEdit = false ❌

5. toolbar.view.onAppReady 里的 Promise.then() 跑到：
     if (t.isEdit) { t.btnTextFromFile.setMenu(new Common.UI.Menu(...)) }
     → isEdit=false → setMenu 不调用 → btnTextFromFile.menu 为 undefined

6. attachUIEvents → t.btnTextFromFile.menu.on(...) → CRASH
```

### 修复：拦截 onEditorPermissions，永远使用 fakePerms

```typescript
if (!mainCtrl._isPermissionsInited && typeof mainCtrl.onEditorPermissions === 'function') {
  const origPerms = mainCtrl.onEditorPermissions.bind(mainCtrl);
  mainCtrl.onEditorPermissions = (_perms: any) => {
    // 无论 SDK 传什么（含无许可证的真实响应），都替换为 fakePerms
    try { return origPerms(fakePerms); } catch (e) { console.warn('[OO] perms failed', e); }
  };
}
```

注意：只在 `_isPermissionsInited=false` 时打补丁，已初始化后 SDK 不会再调用。

---

## 问题 3：`_isPermissionsInited` 始终为 false（第 3/4 次刷新）

### 症状

console 中 `Fia: false` 持续不变，`asc_openDocumentFromBytes` 没有触发文档加载。

### 根因

`_isPermissionsInited` 在 `onEditorPermissions` 的末尾设置（app.js:1763285）：

```javascript
this.applyModeCommonElements(), this.applyModeEditorElements(),
this._isPermissionsInited = !0
```

SDK 调用 `asc_getEditorPermissions()` 后等待 socket.io 服务器响应。  
我们的 Engine.IO noop 服务器不发任何 socket.io 事件，所以 SDK 一直在等 → `asc_onGetEditorPermissions` 永不触发 → `_isPermissionsInited` 永远是 `false`。

**Run 2 为何工作：** 推测 SDK 在首次连接失败后有短暂的 fallback（或 timeout），碰巧在 50ms 窗口内就返回了。后续刷新 SDK 复用了连接状态（已知 404）直接等待超时，导致 `_isPermissionsInited` 长期为 false。

### 修复：超时 fallback，2s 后手动触发

```typescript
// 等 SDK 自己触发（来自 socket.io 响应）
let waited = 0;
while (!mainCtrl._isPermissionsInited && waited < 2000) {
  await new Promise(r => setTimeout(r, 100));
  waited += 100;
}
// 2s 后仍未触发 → 手动调用（已打了补丁，所以还是走 fakePerms）
if (!mainCtrl._isPermissionsInited) {
  mainCtrl.onEditorPermissions(fakePerms);
}
```

---

## 完整 onAppReady 四步流程

```typescript
onAppReady: async () => {
  // STEP 1: 等 loadDocument 运行完毕（user + document 都有值）
  while (!mainCtrl.appOptions?.user || !mainCtrl.document) {
    await new Promise(r => setTimeout(r, 50));
  }

  // STEP 2: 拦截 onEditorPermissions，固定使用 fakePerms
  const origPerms = mainCtrl.onEditorPermissions.bind(mainCtrl);
  mainCtrl.onEditorPermissions = (_perms: any) => origPerms(fakePerms);

  // STEP 3: 等 SDK 许可证检查触发（或 2s 后手动触发）
  while (!mainCtrl._isPermissionsInited && waited < 2000) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!mainCtrl._isPermissionsInited) {
    mainCtrl.onEditorPermissions(fakePerms);   // 此时走补丁版
  }

  // STEP 4: 注入文档字节
  api.asc_openDocumentFromBytes(ooxmlBytes);
}
```

---

## 关键代码位置索引（app.js）

| 位置 | 含义 |
|------|------|
| 1714869 | `loadDocument` — 注册 `asc_onGetEditorPermissions`，调用 `asc_setDocInfo` + `asc_getEditorPermissions` |
| 1736229 | `onDocumentContentReady` — 触发 `app:ready`，启动 50ms `setInterval` |
| 1744507 | `setInterval` 内 — 调用 `createDelayedElements()` |
| 1751022 | `onEditorPermissions` 函数入口 |
| 1752961 | `this.appOptions.isEdit = canLicense && canEdit && mode !== 'view'` |
| 1763285 | `this._isPermissionsInited = true`（在 `applyModeCommonElements` 之后） |
| 797146  | toolbar.view.`onAppReady` — `if (t.isEdit) { btnTextFromFile.setMenu(...) }` |
| 876767  | `attachUIEvents` — `t.btnTextFromFile.menu.on(...)` CRASH 位置 |
| 965038  | Main 控制器 `createDelayedElements` — 调用 toolbar 和 attachUIEvents |
| 1808402 | `loadBinary: function(t) { api.asc_openDocumentFromBytes(new Uint8Array(t)) }` |

---

## 经验总结

### 经验 1：SDK 权限初始化是文档加载的前提

9.3.0 的文档加载链路有隐式前提：  
`onEditorPermissions` 必须运行 → `applyModeCommonElements()` 设置各 controller 的 `this.mode` → `_isPermissionsInited=true` 后才能接受 `asc_openDocumentFromBytes`。

没有真实服务器时，需要手动 **拦截并替换** `onEditorPermissions`，而不只是提前调用一次——因为 SDK 的第二次调用（来自 `asc_getEditorPermissions` 许可证检查结果）会覆盖 `isEdit` 为 false。

### 经验 2：打补丁比先调用更可靠

**先调用（错误方式）：**
```
我们调用 onEditorPermissions(fakePerms) → isEdit=true
然后 SDK 调用 onEditorPermissions(realPerms) → isEdit=false ❌
```

**打补丁（正确方式）：**
```
mainCtrl.onEditorPermissions = (_) => origPerms(fakePerms)
SDK 调用 onEditorPermissions(realPerms) → 被拦截 → 实际走 fakePerms → isEdit=true ✓
```

### 经验 3：`isEdit=false` 会静默跳过关键初始化

`btnTextFromFile.setMenu(...)` 只在 `if (t.isEdit)` 内执行。如果 `isEdit=false`，`setMenu` 不调用，`menu` 属性为 `undefined`。后续 `attachUIEvents` 调用 `menu.on(...)` 直接崩溃。

这个模式在 OnlyOffice 代码里很普遍：很多 UI 控件的初始化都被 `isEdit` / `isEdit && !isViewModeOnly` 等条件门控。任何导致 `isEdit=false` 的因素都会产生级联崩溃。

### 经验 4：`_isPermissionsInited` 是异步网络操作的产物

SDK 的 `asc_getEditorPermissions()` 是异步的（等服务器响应）。在离线模式下：
- 不能假设它会在有限时间内完成
- 需要设超时 + 手动 fallback
- 超时时间 2s 足够（SDK 通常 <1s 内触发，无响应的话一直不触发）

---

---

## 已知遗留问题（本轮未解决）

### `onlyofficeWebModePatch` 未注入 iframe

`vite.config.ts` 里的 `onlyofficeWebModePatch` 插件拦截编辑器 HTML，注入一段 `<script>`（字体 URL 重写 + `suppressConnectionLost`）。

**问题：** 实际运行时 console 显示 `patchFound: false`，说明该 `<script>` 没有被注入到 iframe 里。

可能原因：
- Vite 中间件的 `res.end(injected)` 被 Vite 内部的缓存层拦截，返回了原始文件
- 正则 `EDITOR_HTML` 没有匹配到实际请求 URL（可能有 query string 或大小写差异）
- `path.join(__dirname, 'public', req.url.split('?')[0])` 路径拼接错误

**实际影响：**
- 字体 URL 重写失效（`ascdesktop://fonts/*.ttf` 仍 404）— 但 Web Mode 下字体路径已改为正常 URL，暂时不影响
- `Common.UI.warning` 未被替换，"Connection is lost" 和 "error occurred" 对话框仍会弹出

**临时缓解（已做）：** `suppressConnectionLost` 里加了对 "error occurred during the work" 的抑制（EditingError -25，无服务器时 co-authoring save 失败触发）。但这段代码因为注入失败所以实际上没有生效。

### `EditingError -25`：co-authoring save 失败

SDK 在文档修改后尝试向 socket.io 服务器推送变更，失败后触发 `asc_onError(-25, level)`，app.js 调用 `Common.UI.warning({ msg: '..error occurred during the work..' })`。

抑制方式（一旦注入生效）：已在 vite.config.ts 的 `suppressConnectionLost` 里添加：
```javascript
if (opts.msg.indexOf('error occurred during the work') !== -1) return;
```

---

## `binData` vs `pendingCopy`：文档字节来源

`onAppReady` 里需要决定注入哪些字节，来源有两条路：

| 场景 | 变量 | 内容 |
|------|------|------|
| 新建文档 | `binData` | `'DOCX;v5;...'` 格式的 DOCY 字符串（来自 `empty_bin.ts`），含分号 |
| 打开已有文件 | `pendingCopy` | 原始文件的 `Uint8Array` 副本（在 `createEditorInstance` 调用前拷贝） |

判断逻辑：`typeof binData === 'string' && binData.includes(';')` → 新建文档，从 `g_sEmpty_ooxml` 取对应扩展名的最小 OOXML ZIP。

`g_sEmpty_ooxml` 是 `onlyoffice-editor.ts` 内定义的常量，包含 `.docx`、`.xlsx`、`.pptx`、`.csv` 各自的 base64 编码最小模板。

---

## 当前验证状态

**本节记录截至 2026-06-15 会话结束时的实际状态（代码已写，浏览器未验证）：**

- [x] 崩溃 1 (`this.mode undefined`) 诊断完成，补丁代码已写
- [x] 崩溃 2 (`btnTextFromFile.menu.on`) 诊断完成，拦截补丁代码已写
- [x] 问题 3 (`_isPermissionsInited` 不变) 诊断完成，2s fallback 代码已写
- [ ] **四步 onAppReady 浏览器验证**（下次会话首要任务）
- [ ] 连续 3 次刷新均稳定
- [ ] Excel / PowerPoint 编辑器同样路径验证
- [ ] 保存链路在 Web Mode 下仍正常触发
- [ ] `onlyofficeWebModePatch` 注入问题排查

---

## 2026-06-19 追加：CI / 测试体系恢复记录

**分支：** `explore/path-d-desktop-mock`
**目标：** 先恢复目录迁移后失效的自动化质量门禁，为后续 Web Mode 浏览器验证提供稳定基线。
**范围约束：** 本轮不改变 `onAppReady` 四步 Web Mode 加载逻辑，不继续深入 OnlyOffice SDK 行为调试。

### 初始状态

工作区干净，分支与远端同步：

```bash
git status --short --branch
# ## explore/path-d-desktop-mock...origin/explore/path-d-desktop-mock
```

但自动化检查失败：

```bash
pnpm run lint:ts
# oxlint 通过
# tsc --noEmit 失败
```

主要错误：

1. 测试文件仍从旧目录导入：
   - `../../lib/document-utils`
   - `../../lib/embed-api`
   - `../../lib/i18n`
   - `../../lib/onlyoffice-editor`
   - `../../store`
2. `test/unit/seo-pages.test.ts` 仍读取根目录 `index.html`，但 Vite root 已迁到 `pages/`。
3. `seo-pages.test.ts` 仍期待旧的 GitHub Pages URL `https://ranuts.github.io/document/{slug}/`，但当前 `public/sitemap.xml` 使用 `https://bybrowser.com/{slug}/`。
4. TypeScript 6 对 `BlobPart` 的泛型约束更严格，`src/lib/document-converter.ts` 中 `Uint8Array<ArrayBufferLike>` 不能直接作为 `BlobPart` 返回。

`pnpm run test` 同样失败，核心原因与路径迁移一致：

```text
Failed to resolve import "../../lib/document-utils"
Failed to resolve import "../../lib/embed-api"
Failed to resolve import "../../lib/i18n"
Failed to resolve import "../../lib/onlyoffice-editor"
ENOENT: no such file or directory, open '/Users/Desktop/document/index.html'
```

### 修复内容

#### 1. `vitest.config.ts`

将 alias 和 coverage include 从旧目录迁到新目录：

```diff
- '@/lib': resolve(__dirname, 'lib')
- '@/store': resolve(__dirname, 'store')
+ '@/lib': resolve(__dirname, 'src/lib')
+ '@/store': resolve(__dirname, 'src/store')

- include: ['lib/document-utils.ts', ...]
+ include: ['src/lib/document-utils.ts', ...]
```

原因：源码已在前序提交中迁入 `src/`，测试配置没有同步，导致动态 import 和 coverage include 仍指向不存在的旧路径。

#### 2. 单元测试导入路径

更新以下测试文件的 import / mock 路径：

- `test/unit/document-utils.test.ts`
- `test/unit/i18n.test.ts`
- `test/unit/embed-api.test.ts`
- `test/unit/onlyoffice-editor.test.ts`

路径从：

```ts
../../lib/*
../../store
```

改为：

```ts
../../src/lib/*
../../src/store
```

注意：`embed-api.test.ts` 使用 `vi.resetModules()` + 动态 `import()`，动态 import 的路径也必须同步更新，否则即使静态 mock 路径正确，测试仍会在运行时解析失败。

#### 3. SEO landing page 测试

`test/unit/seo-pages.test.ts` 同步 Vite root 和 sitemap 域名：

```diff
- read('index.html')
+ read('pages/index.html')

- path.join(root, slug, 'index.html')
+ path.join(root, 'pages', slug, 'index.html')

- https://ranuts.github.io/document/${slug}/
+ https://bybrowser.com/${slug}/
```

原因：项目当前 `vite.config.ts` 已设置 `root: 'pages'`，且 `public/sitemap.xml` 的 canonical host 已切到 `bybrowser.com`。

#### 4. TypeScript 6 `BlobPart` 类型修复

`src/lib/document-converter.ts` 的 OOXML ZIP 快路径原来直接返回 `Uint8Array`：

```ts
return { fileName: outputFileName, data: bin };
```

在当前 TS / DOM 类型下，`Uint8Array<ArrayBufferLike>` 不能赋给 `BlobPart`，因为其 `buffer` 可能是 `SharedArrayBuffer`。修复为返回当前视图对应范围的 `ArrayBuffer`：

```ts
return {
  fileName: outputFileName,
  data: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer,
};
```

行为影响：只改变类型承载形式，不改变字节内容。该路径仍然表示“SDK 已输出 OOXML ZIP，跳过 X2T，原样作为目标文档返回”。

### 验证结果

以下命令均已通过：

```bash
pnpm run lint:ts
# oxlint && tsc --noEmit

pnpm run test
# 7 test files passed
# 96 tests passed

pnpm run test:coverage
# thresholds passed
# All files: statements 45.72%, branches 46.2%, functions 57.14%, lines 46.13%

pnpm run build
# Build completed successfully

pnpm run test:e2e
# 10 passed

pnpm exec prettier --check \
  src/lib/document-converter.ts \
  test/unit/document-utils.test.ts \
  test/unit/embed-api.test.ts \
  test/unit/i18n.test.ts \
  test/unit/onlyoffice-editor.test.ts \
  test/unit/seo-pages.test.ts \
  vitest.config.ts
# All matched files use Prettier code style

git diff --check
# no whitespace errors
```

`pnpm run build` 和 `pnpm run test:e2e` 仍会打印既有警告：

- Vite 无法 bundle 非 `type="module"` 的 OnlyOffice `api.js` script。
- 主 chunk 超过 500 kB。
- Node 26 下 `module.register()` deprecated warning。

这些都是警告，未导致构建或测试失败。

### `format:check` 状态

全局 `pnpm run format:check` 仍失败，但失败来自大量既有文件，不是本轮改动引入：

- `CLAUDE.md`
- `pages/**/*.html`
- `src/lib/empty_bin.ts`
- `src/lib/loading.ts`
- `src/lib/onlyoffice-editor.ts`
- `src/lib/ui.ts`
- `src/styles/base.css`

本轮只对触碰文件执行 Prettier 检查并通过。没有批量格式化全仓库，避免把大量无关 HTML / 生成常量 / 既有样式改动混进当前修复。

### 浏览器专项验证尝试

本轮尝试做一个更贴近主问题的 Playwright 专项验证：

目标流程：

```text
打开首页 → 点击 New Word → 等待 console 出现 [OO] asc_openDocumentFromBytes
```

曾临时新增 `test/e2e/web-mode-new-word.spec.ts`，断言：

- 页面点击 `#new-word-button`
- 30 秒内出现 `[OO] asc_openDocumentFromBytes`
- 无 `TypeError` pageerror

但测试没有进入应用逻辑，Chromium 在启动阶段失败：

```text
FATAL: base/apple/mach_port_rendezvous_mac.cc
bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.*:
Permission denied (1100)
```

同样的错误也出现在直接用 Node 脚本 `chromium.launch()` 时。为避免把环境限制引入仓库，临时专项测试已删除。

也尝试接入 Codex in-app browser，返回：

```text
Browser is not available: iab
```

Chrome 插件控制不适用本轮，因为用户没有要求使用既有 Chrome 会话，也不需要读取登录态。

### 当前结论

截至 2026-06-19：

- [x] `lint:ts` 恢复通过
- [x] 单元测试恢复通过（96 tests）
- [x] coverage 阈值通过
- [x] 生产构建通过
- [x] 现有 E2E 冒烟通过（10 tests）
- [x] 本轮触碰文件格式检查通过
- [x] Web Mode `New Word -> asc_openDocumentFromBytes -> canvas render` 新增 E2E 通过
- [x] Web Mode `New Word` 连续 3 次刷新/重开稳定性通过
- [x] Web Mode `New Excel -> asc_openDocumentFromBytes -> canvas render` 新增 E2E 通过
- [x] 本地上传/预览 `.docx`、`.xlsx`、`.csv` 文件通过
- [ ] 全局 `format:check` 仍因既有文件失败
- [ ] PowerPoint 编辑器同路径未通过，仍停在 `Loading presentation`
- [ ] Web Mode 下保存链路验证未通过：`downloadAs('DOCX')` 触发 `LocalFileSave` 空引用

### 2026-06-19 追加：调试工具约定

后续继续排查 Web Mode 文档加载时，优先使用 `chrome-devtools-mcp` 进行真实浏览器运行态调试。Playwright trace 适合保留回归证据，但 OnlyOffice iframe 内部状态、controller 字段、network/WebSocket/polling 响应、DOM loading mask、canvas 像素和 console 日志需要通过 Chrome DevTools 直接检查。

本轮验证时再次尝试 `chrome-devtools-mcp`，`list_pages` 返回 `Transport closed`，因此用 Playwright 进行同等运行态采样。后续如果 MCP transport 恢复，仍优先使用它复核 iframe 内部状态。

建议下一轮先用 `chrome-devtools-mcp` 打开本地 preview，然后在 iframe 内采样：

- `DE.getController('Main')` 的 `_isPermissionsInited`、`appOptions.isEdit`、`document`、loading/progress 状态。
- `Asc.editor` 上与 `asc_openDocumentFromBytes`、内容 ready、错误回调相关的状态。
- `/doc/{sid}/c/?EIO=4&transport=polling` 是否返回 Engine.IO 文本包，而不是站点 HTML。
- `ascdesktop://fonts/*.ttf` 是否仍有 CORS/加载错误。
- `canvas#id_viewer` 尺寸、透明像素比例，以及 `.doc-placeholder` / loading mask 是否消失。

### 2026-06-19 追加：Web Mode ready 门闩

Playwright 回归已覆盖 `New Word -> asc_openDocumentFromBytes -> canvas render` 和 `New Excel -> asc_openDocumentFromBytes -> canvas render`。本轮定位到一个 OnlyOffice 9.x serverless Web Mode 差异：`asc_openDocumentFromBytes()` 注入 OOXML 后，SDK 进度可以到 100%，但没有服务端 auth/openedAt 响应时 Word 的 `Asc.editor.I0c` / Spreadsheet 的 `Asc.editor.cSd` 仍为 `false`，不会继续触发 `asc_onDocumentContentReady`。

当前补丁在注入字节后补齐已验证的 ready 条件：

- Word：`!api.I0c && typeof api.Aqg === 'function'` 时调用 `api.Aqg(Date.now())`。
- Excel：`!api.cSd && typeof api.LNg === 'function'` 时调用 `api.LNg(Date.now())`。

验证结果：

- loading mask 消失，toolbar 从禁用态变为可编辑态。
- status bar 显示 `Page 1 of 1`。
- `canvas#id_viewer` 出现非透明像素。
- 新增 `test/e2e/onlyoffice-new-document.spec.ts` 通过。

PowerPoint 仍未通过。运行态采样显示 `PE.getController('Main')._isPermissionsInited=true`、`document=true`、`appOptions.isEdit=true`，但 `Asc.editor.kvd=false`、`Asc.editor.Joa=false`，页面停在 `Loading presentation`。直接调用内部 `rdg(Date.now())` 会触发 `Cannot read properties of null (reading 'Ka')`，因此当前不把 PPT ready gate 写入产品代码。

保存链路仍未通过。运行态探测 `window.editor.downloadAs('DOCX')` 可以被调用，但 SDK 进入 `DesktopOfflineAppDocumentStartSave` 后抛出 `Cannot read properties of undefined (reading 'LocalFileSave')`，没有进入当前 `handleSaveDocument` 的成功分支。下一步需要确认 Web Mode 下应补 `AscDesktopEditor.LocalFileSave` mock，还是绕过 DesktopOfflineApp 路径改用 `onDownloadAs`/二进制导出事件。

### 2026-06-19 追加：验证明细

本轮目标是验证 Web Mode 升级路径的真实可用性，而不是只确认 `asc_openDocumentFromBytes` 被调用。判定标准如下：

| 场景 | 输入 | 判定条件 | 结果 |
| --- | --- | --- | --- |
| Word 新建稳定性 | `.docx`，连续 3 次 `window.onCreateNew('.docx')` | 出现 `[OO] asc_openDocumentFromBytes`；权限初始化完成；Word ready gate `I0c/Aqg/Fia` 完成；loading mask 消失；`canvas#id_viewer` 有非透明像素；无 pageerror | 通过 |
| Excel 新建 | `.xlsx`，`window.onCreateNew('.xlsx')` | 出现 `[OO] asc_openDocumentFromBytes`；`SSE.getController('Main')` 权限初始化完成；Spreadsheet ready gate `cSd/LNg/l0` 完成；loading mask 消失；canvas 有非透明像素；无 pageerror | 通过 |
| PowerPoint 新建 | `.pptx`，`window.onCreateNew('.pptx')` | 同上，但对应 `PE` namespace 和 Presentation ready gate | 未通过 |
| 本地上传/预览 | `.docx`、`.xlsx`、`.csv`，点击 Upload 后设置 file input | 出现 `[OO] asc_openDocumentFromBytes`；权限初始化完成；对应 ready gate 完成；loading mask 消失；canvas 有非透明像素；无 pageerror | 通过 |
| 本地 PowerPoint 上传/预览 | `.pptx`，点击 Upload 后设置 file input | 应完成 Presentation ready gate 并渲染 canvas | 未通过 |
| Word 保存 | `.docx` 打开完成后调用 `window.editor.downloadAs('DOCX')` | 应触发 `onSaveDocument` 或可处理的导出回调，并进入 `handleSaveDocument` 成功分支 | 未通过 |

本轮执行的命令和结果：

```text
pnpm exec prettier --check src/lib/onlyoffice-editor.ts vite.config.ts test/e2e/onlyoffice-new-document.spec.ts docs/explorations/2026-06-15-web-mode-permissions-debug.md
=> passed

pnpm run lint:ts
=> passed

pnpm run test
=> 7 files / 96 tests passed

pnpm run build
=> passed，仍有既有 Vite 警告：OnlyOffice api.js 非 module script、主 chunk > 500 kB、module.register() deprecation

CI=1 pnpm run test:e2e
=> 12 passed, 1 skipped

CI=1 pnpm run test:e2e -- test/e2e/onlyoffice-new-document.spec.ts
=> 3 passed, 2 skipped
```

新增/调整的 E2E 覆盖位于 `test/e2e/onlyoffice-new-document.spec.ts`：

- `New Word opens reliably through OnlyOffice 9.x Web Mode and renders the document canvas`
  - 同一个测试内连续 3 次打开 `.docx`。
  - 每次都等待 `[OO] asc_openDocumentFromBytes`。
  - 采样 iframe 内部 `Asc.editor`、`DE/SSE/PE.getController('Main')`、loading mask 和 canvas 像素。
- `New Excel opens through OnlyOffice 9.x Web Mode and renders the document canvas`
  - 验证 `.xlsx` 走 `SSE` namespace。
  - 确认 `cSd/LNg/l0` ready gate 完成。
- `Local Word, Excel, and CSV files open through the upload preview flow`
  - 通过 UI 的 `#upload-button` 触发真实本地文件入口，再设置隐藏 `input[type=file]`。
  - 使用最小 `.docx` / `.xlsx` OOXML fixture 和简单 CSV fixture。
  - 复用同一套 iframe runtime、loading mask 和 canvas 像素断言。
- `New PowerPoint opens through OnlyOffice 9.x Web Mode and renders the document canvas`
  - 当前 `test.skip`，skip 原因写在测试内：PPTX 停在 `Loading presentation`，`kvd=false/Joa=false`，直接调用 `rdg()` 会触发 `Ka` 空引用。
- `Local PowerPoint files open through the upload preview flow`
  - 当前 `test.skip`，本地 `.pptx` 上传同样在 `asc_openDocumentFromBytes` 后触发 `Ka` 空引用并停在 `Loading presentation`。

运行态采样要点：

| 编辑器 | namespace | 权限状态 | ready gate | canvas | 备注 |
| --- | --- | --- | --- | --- | --- |
| Word | `DE` | `_isPermissionsInited=true`、`appOptions.isEdit=true` | `I0c=true`、`Fia=true` | `canvas#id_viewer` 非透明像素 > 0 | `api.Aqg(Date.now())` 可补齐 serverless openedAt |
| Excel | `SSE` | `_isPermissionsInited=true`、`appOptions.isEdit=true` | `cSd=true`、`l0=true` | canvas 非透明像素 > 0 | 最初失败是因为代码只查 `DE`；改为 `DE ?? SSE ?? PE` 后进入注入流程 |
| PowerPoint | `PE` | `_isPermissionsInited=true`、`document=true`、`appOptions.isEdit=true` | `kvd=false`、`Joa=false` | `id_viewer` 存在，但页面仍显示 `Loading presentation` | 最小 PPTX 注入阶段出现 `Cannot read properties of null (reading 'Ka')` |

本地上传/预览复现结果：

| 文件 | namespace | 注入字节 | ready 状态 | canvas | pageerror |
| --- | --- | --- | --- | --- | --- |
| `sample.docx` | `DE` | `[OO] asc_openDocumentFromBytes 4581 bytes` | `documentReady=true`、`openedAtReady=true` | `id_viewer` 非透明像素 > 0 | 无 |
| `sample.xlsx` | `SSE` | `[OO] asc_openDocumentFromBytes 1192 bytes` | `documentReady=true`、`openedAtReady=true` | `ws-canvas` 非透明像素 > 0 | 无 |
| `sample.csv` | `SSE` | `[OO] asc_openDocumentFromBytes 9693 bytes` | `documentReady=true`、`openedAtReady=true` | `ws-canvas` 非透明像素 > 0 | 无 |
| `sample.pptx` | `PE` | `[OO] asc_openDocumentFromBytes 1032 bytes` | `documentReady=false`、`openedAtReady=false` | `id_viewer` 非透明像素 = 0 | `Cannot read properties of undefined (reading 'Ka')` |

本地上传/预览判断：

- 当前代码下 `.docx`、`.xlsx`、`.csv` 已能通过真实 upload flow 打开；如果外部“预览功能”仍打不开这三类文件，下一步要优先检查宿主侧传入的是不是同一路径，例如 `RENDER_OFFICE` 分片消息、文件名扩展名、MIME、以及是否传入的是旧格式 `.doc/.xls` 而不是 OOXML `.docx/.xlsx`。
- `.csv` 会先通过 SheetJS 转成 `.xlsx`，再由 x2t 转换并交给 OnlyOffice；当前最小 CSV fixture 已验证通过。
- `.pptx` 和新建 PPT 同源失败，问题集中在 Presentation SDK 对注入字节的解析/ready gate，而不是 upload flow 本身。

PowerPoint 失败细节：

```text
window.onCreateNew('.pptx')
-> [OO] onAppReady {hasIframe: true, hasApi: true}
-> [OO] permissions ready: isEdit= true inited= true
-> [OO] new doc .pptx 3427 bytes
-> [OO] asc_openDocumentFromBytes 3427 bytes
-> pageerror: Cannot read properties of null (reading 'Ka')
```

PPT 运行态字段：

```json
{
  "namespace": "PE",
  "permissionsInited": true,
  "hasDocument": true,
  "appOptions": { "isEdit": true, "canEdit": true },
  "api": {
    "Joa": false,
    "kvd": false,
    "hasRdg": true,
    "hasDzj": true,
    "hasOpenBytes": true
  },
  "loading": "Loading presentation"
}
```

保存链路失败细节：

```text
window.editor.downloadAs('DOCX')
-> called: true
-> changesError: Cannot read properties of undefined (reading 'LocalFileSave')
-> stack includes DesktopOfflineAppDocumentStartSave -> Asc.asc_docs_api.$0 -> onDownloadAs
```

保存链路判断：

- 当前 `handleSaveDocument` 支持 9.3.0 的 `onSaveDocument` ArrayBuffer 事件，但本次 `downloadAs('DOCX')` 没有进入该事件。
- SDK 选择了 DesktopOfflineApp 保存路径，依赖 `AscDesktopEditor.LocalFileSave`。
- 下一步应先确认 Web Mode 下 `downloadAs` 是否应被替换为另一个导出 API；如果必须保留当前路径，则需要补一个可控的 `AscDesktopEditor.LocalFileSave` mock，并验证回调数据格式。

下一轮建议顺序：

1. 使用 `chrome-devtools-mcp` 在真实 Chrome 中复核 `New Word`：确认 `[OO] onAppReady`、`permissions ready`、`asc_openDocumentFromBytes` 日志出现，且无 toolbar 相关 TypeError。
2. 使用 `chrome-devtools-mcp` 复核 `New Excel`：确认 `SSE.getController('Main')`、`cSd/LNg/l0` ready gate 和 canvas 渲染状态。
3. 继续排查 `New PowerPoint`：重点看 `rdg` 的合法输入/调用时机，以及触发 `Ka` 空引用前缺失的 slide/theme 对象。
4. 修复保存链路：重点排查 `DesktopOfflineAppDocumentStartSave -> AscDesktopEditor.LocalFileSave` 依赖，以及 `onSaveDocument` / `onDownloadAs` 事件在 Web Mode 下的正确出口。
5. 再处理 EditingError -25 弹窗抑制。

## 2026-06-19 本地预览继续修复：PPT/PPTX 打开链路

本轮目标来自本地预览反馈：Word、XLSX、CSV、PPT 通过本地文件打开时仍有失败风险。先复核现状后确认：

| 项目 | 复核结论 |
| --- | --- |
| 本地 `.docx` | 已能通过 upload flow 打开并渲染，E2E 覆盖保持通过 |
| 本地 `.xlsx` | 已能通过 upload flow 打开并渲染，E2E 覆盖保持通过 |
| 本地 `.csv` | 已能转换为表格并渲染，E2E 覆盖保持通过 |
| 本地 `.pptx` | 之前停在 `Loading presentation`，本轮修复后通过 |
| 新建 `.pptx` | 之前使用最小模板会触发 `Ka` 空引用，本轮改用 SDK 同代 blank theme 模板后通过 |

关键发现：

1. SDK 自带真实模板 `public/sdkjs/slide/themes/src/01_blank.pptx` 通过 upload flow 后，`PE` namespace、权限和 `document` 都已就绪，但 `Asc.editor.kvd=false`、`Asc.editor.Joa=false`，页面停在 `Loading presentation: 39%`。
2. 在这个状态下调用 `Asc.editor.rdg(Date.now())` 可以补齐 Presentation 的 openedAt gate；之后 `kvd=true`、`Joa=true`、loading mask 消失，`canvas#id_viewer` 采样到非透明像素。
3. 旧的内联最小 `.pptx` 模板不兼容 9.3 Presentation SDK，过早或直接注入会触发 `Cannot read properties of null (reading 'Ka')`。因此新建 PPT 不再使用 `g_sEmpty_ooxml['.pptx']`，改为读取 SDK 同代的 `01_blank.pptx`。
4. 本地 `.docx/.xlsx/.pptx` 预览优先使用原始 OOXML ZIP bytes，而不是 `x2t` 转换后的内部 `.bin`。这与已通过的新建 Word/Excel/PPT 输入格式一致；CSV 仍保持现有转换链路。

代码调整：

| 文件 | 调整 |
| --- | --- |
| `src/lib/onlyoffice-editor.ts` | 新建 `.pptx` 时 fetch `/sdkjs/slide/themes/src/01_blank.pptx`；本地 OOXML 预览优先注入 `__pendingOriginalFile`；Presentation 编辑器补发受保护的 `rdg(Date.now())` gate |
| `test/e2e/onlyoffice-new-document.spec.ts` | 本地 PPT fixture 改为复制 SDK blank PPTX；打开 `New PowerPoint` 和 `Local PowerPoint` 两个回归测试 |

验证结果：

```text
pnpm exec playwright test test/e2e/onlyoffice-new-document.spec.ts --grep "PowerPoint"
=> 2 passed

pnpm run lint:ts
=> passed

pnpm run test
=> 7 files / 96 tests passed

pnpm run build
=> passed，仍有既有 Vite 警告：OnlyOffice api.js 非 module script、主 chunk > 500 kB、module.register() deprecation

CI=1 pnpm run test:e2e
=> 15 passed
```

最终状态：

| 场景 | 当前状态 |
| --- | --- |
| New Word | 通过 |
| New Excel | 通过 |
| New PowerPoint | 通过 |
| Local Word upload preview | 通过 |
| Local Excel upload preview | 通过 |
| Local CSV upload preview | 通过 |
| Local PowerPoint upload preview | 通过 |

剩余注意事项：

- 本轮验证的是 OOXML `.docx/.xlsx/.pptx` 和 `.csv`。旧二进制 `.doc/.xls/.ppt` 仍需单独验证转换兼容性。
- `chrome-devtools-mcp` 是推荐调试方式；本轮曾尝试过该 MCP，但连接返回 `Transport closed`，因此实际运行态验证使用 Playwright fallback。
- 保存/导出链路仍是后续工作，当前记录只覆盖打开和渲染。

---

## 2026-06-19 追加：`suppressConnectionLost` 修复 + Vite 中间件诊断

**分支：** `explore/path-d-desktop-mock`
**目标：** 解决"Connection is lost"弹窗问题，并排查 `onlyofficeWebModePatch` 中间件注入失效的根本原因。

---

### 问题：`onlyofficeWebModePatch` 中间件为何注入失效

#### 调查结论

对中间件代码逐行验证：

| 检查项 | 结论 |
|--------|------|
| 正则是否匹配 | ✅ `/\/web-apps\/apps\/(documenteditor\|presentationeditor\|spreadsheeteditor)\/main\/index\.html/` 能匹配实际请求 URL |
| `path.join` 结果 | ✅ `path.join('/project', 'public', '/web-apps/...')` 在 Node.js 里等价于 `/project/public/web-apps/...`，路径正确 |
| 目标文件是否存在 | ✅ `public/web-apps/apps/documenteditor/main/index.html` 存在（120 KB） |
| `<head>` 是否存在于 HTML | ✅ 第 3 行即 `<head>`，`replace('<head>', ...)` 必然成功 |
| CSP 是否阻止内联脚本 | ✅ 编辑器 HTML 无 Content-Security-Policy |

**潜在根因（无法在本地精确确认，因为需要实际开发服务器运行）：**

可能是 Vite 的 `async` 中间件与 `publicDir` 静态文件服务之间存在竞态。`configureServer` 里 `server.middlewares.use()` 注册的中间件理论上先于 Vite 内部的 `sirv`（静态文件服务）运行，但 `async (req, res, next) => {}` 形式在 connect 里存在一个隐患：connect 调用中间件函数后立即返回（不 await），若 `res.writableEnded` 被某个先行中间件（如 HMR 握手）提前设置，则 `await fs.readFile()` 完成时已无法写响应。

#### 诊断增强（已做，本次提交）

1. **`vite.config.ts`**：
   - 中间件改用字符串拼接而非 `path.join` 第三个参数避免潜在歧义：`path.join(__dirname, 'public') + reqPath`
   - 加 `console.log('[vite:oo-patch] intercepting', reqPath)` — 下次跑 dev server 时可从终端看到是否命中
   - 加 `if (res.writableEnded)` 守卫并打印警告，确认是否竞态导致
   - PATCH script 本身加 `console.log('[OO vite-patch] running in', window.location.href)` — 若在浏览器 console 看到，说明注入成功

2. **`src/lib/onlyoffice-editor.ts`**：
   - 新增 `suppressDialogsInFrame(frameWindow)` 函数（见下一节）

---

### 修复：`suppressDialogsInFrame` 直接注入法

#### 为什么改用直接注入

`onAppReady` 里已有 `const iwin = iframeEl?.contentWindow`，对编辑器 iframe 有同源访问权限。无需通过 Vite 中间件把 script 注入到 HTML——可直接在 JS 里操作 `iwin.Common.UI`。

这比中间件方式更可靠：
- 中间件注入的时机取决于 HTTP 请求拦截（受 Vite 内部调度影响）
- 直接注入的时机受 `onAppReady` 控制，与文档加载流程一致

#### 实现（`src/lib/onlyoffice-editor.ts` 顶部函数区）

```typescript
function suppressDialogsInFrame(frameWindow: any): void {
  let attempts = 0;
  const poll = () => {
    const ui = frameWindow.Common?.UI;
    if (ui?.__dlgSuppressed) return;
    if (!ui || typeof ui.warning !== 'function') {
      if (attempts++ < 50) setTimeout(poll, 200); // 最多重试 ~10s
      return;
    }
    ui.__dlgSuppressed = true;
    const orig = ui.warning.bind(ui);
    ui.warning = (opts: any) => {
      if (opts?.msg && typeof opts.msg === 'string') {
        if (opts.msg.indexOf('Connection is lost') !== -1) return;
        if (opts.msg.indexOf('error occurred during the work') !== -1) return;
      }
      return orig(opts);
    };
    console.log('[OO] dialog suppression active in iframe');
  };
  poll();
}
```

调用点（`onAppReady` 里获得 `iwin` 后立即调用）：

```typescript
const iwin = iframeEl?.contentWindow as any;
// ...
if (iwin) suppressDialogsInFrame(iwin);
```

#### 效果

- 无需 Vite 中间件注入即可抑制弹窗
- 使用 200ms 轮询，最多 50 次（约 10s），确保在 `Common.UI.warning` 初始化后成功 patch
- `__dlgSuppressed` 标志防止重复 patch
- vite-patch 中间件保留，其抑制逻辑作为额外防线（一旦中间件被确认有效）

---

### Excel/PowerPoint 保存链路代码审查

（实际浏览器验证受 macOS `MachPortRendezvousServer` 权限限制无法自动化，此处为代码路径分析）

#### xlsx 保存链路

```
用户 Ctrl+S
→ onSaveDocument(event) 触发
  event.data = ArrayBuffer  (9.3.0 路径)
  binaryData = new Uint8Array(event.data)
  targetFormat = 'XLSX'  (从 fileName.split('.').pop() 得到)
→ convertBinToDocumentAndDownloadFn(binaryData, fileName, 'XLSX')
→ convertBinToDocument():
    isOoxmlZip = (bin[0..3] === PK\x03\x04)  → true (xlsx 是 OOXML ZIP)
    → 直接返回 { fileName: 'xxx.xlsx', data: bin.buffer.slice(...) }  (跳过 X2T)
→ 创建 File 对象并 download
```

**结论：** 链路完整，xlsx 的 OOXML ZIP 快路径会跳过 X2T，直接下载原始字节。

#### pptx 保存链路

```
用户 Ctrl+S
→ onSaveDocument(event) 触发
  binaryData = new Uint8Array(event.data)
  targetFormat = 'PPTX'
→ convertBinToDocumentAndDownloadFn(binaryData, fileName, 'PPTX')
→ convertBinToDocument():
    isOoxmlZip = true (pptx 同样是 OOXML ZIP)
    → 直接返回
→ 下载
```

**已知风险点：** pptx 的 `openedAt` gate（`api.kvd` / `api.rdg`）依赖 SDK 内部混淆变量名（`api.Jne`、`api.ta?.Ha`），这些名称可能在后续版本变动。若名称已改，轮询 5000ms 超时后会尝试调用 `api.rdg(Date.now())`，若 `rdg` 同样被重命名则 catch 异常继续执行，不影响流程但 openedAt 可能未正确触发，导致演示文稿页面不显示。

**待验证（需真实浏览器）：**
- xlsx 在 Spreadsheet Editor 中编辑后触发 `onSaveDocument` 事件
- pptx 在 Presentation Editor 中完整加载（`rdg` gate 是否成功）
- 保存后文件可正常用 Excel/PowerPoint 打开

---

### 测试验证

```bash
pnpm run lint:ts    # ✅ 通过
pnpm run test       # ✅ 96/96 通过
pnpm run test:coverage  # ✅ 阈值通过（stmt 41.25% > 35%）
```

覆盖率说明：`onlyoffice-editor.ts` 覆盖率从 22% 降至 ~19%，因新增的 `suppressDialogsInFrame` 函数无法在 jsdom 环境测试（依赖真实 iframe + Common.UI）。总体阈值仍通过，符合预期。
