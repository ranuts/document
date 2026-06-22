# 第二轮 Code Review Bug 修复

**日期**：2026-06-22

---

## Bug 1 — `editor-new` 启动时 unhandled rejection

### 问题

`apps/web/src/index.ts` 的 `editor-new` case 调用 `onCreateNew(action.ext)` 时既没有 `await` 也没有 `.catch()`。`onCreateNew` 是 `async` 函数，catch 块会调用 `showControlPanelFn()` 恢复 UI 后再 `throw error`（注释"Re-throw to let the menu button handler catch it"），但调用方没有捕获，导致浏览器触发 `unhandledrejection` 事件。

### 修复

```typescript
case 'editor-new': {
  // onCreateNew handles its own errors internally (shows control panel on
  // failure). Suppress the re-thrown rejection here to avoid an
  // unhandledrejection browser event.
  onCreateNew(action.ext).catch(() => {});
  break;
}
```

---

## Bug 2 — `onOpenDocument` 失败后 URL 永久与 UI 不同步

### 问题

`apps/web/src/lib/document.ts` 的 `onOpenDocument` 在异步操作链之前就调用 `pushLocalFileRoute(file)`，把 URL 更新为 `/docx/?file=report.docx`。如果后续 `initX2T()` 或 `handleDocumentOperation()` 抛出异常，catch 块只调用 `showControlPanelFn()` 显示首页，**从不回滚 URL**。

结果：地址栏显示 `/docx/?file=report.docx`，UI 显示首页控制面板，永久不一致。用户下次刷新会进入 `editor-file-lost`（虽然他们从未成功打开过文件）。

### 修复

在 `pushLocalFileRoute` 之前保存当前 URL，catch 块中用 `history.replaceState` 回滚（不触发 popstate，不导致二次 destroyEditor）：

```typescript
const prevUrl = location.href;
try {
  pushLocalFileRoute(file);
  // ...
} catch (error) {
  history.replaceState(null, '', prevUrl); // 回滚 URL
  if (showControlPanelFn) showControlPanelFn();
}
```

---

## Bug 3 — `?file=`（空值）被 falsy 检查误判为"无 file 参数"

### 问题

`apps/web/src/lib/app-router.ts` `getStartupAction()` 中：

```typescript
const file = params.get('file'); // 空值时返回 '' (空字符串)
if (file) { ... }               // '' 被 falsy，跳过
```

当 URL 为 `/docx/?file=`（key 存在但 value 为空），`params.get('file')` 返回 `''`，falsy 检查跳过，落入 `editor-new` 创建空白文档，而非 `editor-file-lost` 恢复界面。

### 修复

改为严格的 null 检查：

```typescript
if (file !== null) { ... }
```

`params.get()` 在 key 不存在时返回 `null`，存在时（包括空值）返回字符串。

---

## Bug 4 — `fontsLoaded` 在部分字体加载失败时过早置 `true`

### 问题

`packages/editor-v9/src/document-converter.ts` 和 `packages/editor-v7/src/document-converter.ts` 中，`loadFontsForPdf()` 用 `if (loaded > 0) this.fontsLoaded = true`。

如果 3 个字体成功、NotoSansSC-Regular.ttf 失败（网络抖动 / CDN 404），`loaded=3>0` 仍置位 `fontsLoaded=true`。之后所有 PDF 导出跳过 `loadFontsForPdf()`，CJK 字符在生成的 PDF 中永久不可见，直到页面刷新。

### 修复（v7 + v9）

要求**全部**字体加载成功才置位，部分失败时保留重试机会（DejaVu/LiberationSans 命中浏览器缓存，开销小）：

```typescript
if (loaded === fontNames.length) this.fontsLoaded = true;
```

---

## Bug 5 — `getVersionPrefix()` 硬编码 `'/9.3.0/'`，升级到 v9.4.0 时静默失效

### 问题

`apps/web/src/lib/app-router.ts` 中：

```typescript
function getVersionPrefix(): string {
  return location.pathname.startsWith('/9.3.0/') ? '/9.3.0/' : '/';
}
```

CLAUDE.md 明确计划升级到 OnlyOffice 9.4.0。升级后在 `/9.4.0/` 部署时，`startsWith('/9.3.0/')` 返回 false，所有 `editorPath()` 生成的路径变为 `/docx/` 而非 `/9.4.0/docx/`，用户被导航到错误路由。

### 修复

改为正则动态检测任何 semver 路径前缀：

```typescript
function getVersionPrefix(): string {
  // Detect any semver-style version prefix (/1.2.3/) so this survives
  // OnlyOffice upgrades (e.g. 9.3.0 → 9.4.0) without code changes.
  const m = /^(\/\d+\.\d+\.\d+\/)/.exec(location.pathname);
  return m ? m[1] : '/';
}
```

---

## 其他改进 — `index.ts` destroyEditor 闭包去重

`home` 和 `editor-file-lost` case 原先各自包含完全相同的 6 行 destroyEditor 匿名闭包。提取为 `const destroyEditor = () => { ... }` 并在两处引用，消除未来维护时只更新一处的风险。

---

## 验证结果

```
pnpm run lint:ts   → passed
pnpm run test      → 7 files / 96 tests passed
```
