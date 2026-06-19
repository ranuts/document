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
ENOENT: no such file or directory, open '/Users/ranzhouhang/Desktop/document/index.html'
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
- [ ] 全局 `format:check` 仍因既有文件失败
- [ ] Web Mode “New Word → asc_openDocumentFromBytes” 真实浏览器验证未完成（当前环境 Chromium 启动受阻）
- [ ] 连续 3 次刷新稳定性未验证
- [ ] Excel / PowerPoint 编辑器同路径未验证
- [ ] Web Mode 下保存链路未重新验证
- [ ] `onlyofficeWebModePatch` 注入问题未排查

下一轮建议顺序：

1. 在可稳定启动浏览器的环境中先验证 `New Word`：确认 `[OO] onAppReady`、`permissions ready`、`asc_openDocumentFromBytes` 日志出现，且无 toolbar 相关 TypeError。
2. 连续刷新 3 次，确认权限初始化不会随机卡在 `_isPermissionsInited=false`。
3. 验证 `New Excel` / `New PowerPoint` 是否同样能加载最小 OOXML 模板。
4. 验证 Ctrl+S / 保存链路在 Web Mode 下仍触发 `onSaveDocument`。
5. 再处理 `onlyofficeWebModePatch` 注入失败和 EditingError -25 弹窗抑制。
