# Code Review Bug Fixes

**日期**：2026-06-22

---

## Bug 1 — `editor-file-lost` 路由缺失 popstate 监听器

### 问题

用户打开本地文件 → 刷新页面 → 应用冷启动落入 `editor-file-lost` 分支。该分支调用了 `createControlPanel()` 展示恢复界面，但**没有调用 `registerLocalFilePopstate()`**。

`_popstateRegistered` 是模块级变量，冷启动后为 `false`。只有 `registerLocalFilePopstate()` 才会调用 `window.addEventListener('popstate', _handlePopstate)`。结果：

- 用户从恢复界面重新打开文件 → `pushLocalFileRoute()` 推入 history 条目
- 浏览器没有 popstate 监听器
- 点击回退按钮 → URL 变回首页路径，但 UI 卡在编辑器，无法返回首页

### 修复

**`apps/web/src/index.ts`** — `editor-file-lost` 分支增加 `registerLocalFilePopstate()` 调用，与 `home` 分支保持一致：

```typescript
case 'editor-file-lost': {
  createControlPanel();
  registerLocalFilePopstate({
    showHome: showControlPanel,
    destroyEditor: () => { ... },
  });
  break;
}
```

---

## Bug 2 — `fontsLoaded` 在字体全部获取失败时仍被置为 `true`

### 问题

`loadFontsForPdf()` 的 `Promise.all` 内部每个 fetch 都有独立 try/catch，失败时静默 return。`Promise.all` 本身不会 throw。无论有没有字体成功写入 WASM FS，最后一行 `this.fontsLoaded = true` 无条件执行。

后续再调用 `loadFontsForPdf()` 时，`if (this.fontsLoaded ...) return` 立即退出，字体永久无法写入。PDF 导出产生不可见文字。

### 修复

**`packages/editor-v9/src/document-converter.ts`** 和 **`packages/editor-v7/src/document-converter.ts`**：

引入 `loaded` 计数器，只有至少一个字体写入成功才置位：

```typescript
let loaded = 0;
await Promise.all(fontNames.map(async (name) => {
  try {
    const res = await fetch(`${BASE_PATH}fonts/${name}`);
    if (!res.ok) return;
    const buf = new Uint8Array(await res.arrayBuffer());
    this.x2tModule!.FS.writeFile(`/working/fonts/${name}`, buf);
    loaded++;
  } catch { /* Non-fatal */ }
}));
if (loaded > 0) this.fontsLoaded = true;
```

---

## Bug 3 — WASM 重新初始化后 `fontsLoaded` 不重置

### 问题

`doInitialize()` 失败后 `initPromise = null` 以允许重试。但 `fontsLoaded` 没有重置。

重试成功后拿到全新 WASM 实例，`/working/fonts/` 目录是空的。此时 `loadFontsForPdf()` 检测到 `fontsLoaded = true`（来自上次失败前的尝试），立即返回，字体永远不会写入新 FS。

### 修复

在 `doInitialize()` 的 catch 块中同步重置 `fontsLoaded`（v7 + v9）：

```typescript
} catch (error) {
  this.initPromise = null;
  this.fontsLoaded = false; // 重置，确保重试时字体重新写入新 FS
  throw error;
}
```

---

## 验证结果

```
pnpm run lint:ts   → passed
pnpm run test      → 7 files / 96 tests passed
```
