# Word / Excel / PPT 浏览器全链路调试

**日期：** 2026-06-19  
**分支：** `explore/path-d-desktop-mock`  
**前置文档：** [2026-06-15-web-mode-permissions-debug.md](2026-06-15-web-mode-permissions-debug.md)

---

## 目标

在真实 Chrome 浏览器中逐一打开 Word（docx）、Excel（xlsx）、PowerPoint（pptx）新建文档，
确认无崩溃、无阻塞对话框、完整工具栏可见，并记录所有发现的问题及修复。

---

## 环境

- 开发服务器：`http://localhost:5175/`  
- OnlyOffice Web Apps：9.3.0（无服务器，Web Mode）  
- Vite 中间件：Engine.IO fake handshake + `onlyofficeWebModePatch`（注入 font-URL rewrite 和 dialog suppression）  
- 文档字节来源：`src/lib/empty_bin.ts` 中的 `g_sEmpty_ooxml`

---

## 测试结果总览

| 编辑器     | 工具栏 | isEdit | 加载时间 | 阻塞对话框 |
|------------|--------|--------|----------|-----------|
| Word (docx)  | ✅ 完整 | ✅ true | ~50 ms   | ✅ 无      |
| Excel (xlsx) | ✅ 完整 | ✅ true | ~3000 ms | ✅ 无（修复后）|
| PPT (pptx)   | ✅ 完整 | ✅ true | ~50 ms + 100 ms gate | ✅ 无（修复后）|

---

## 问题一："Connection is lost" 对话框仍然出现

### 症状

在 Excel 和 PPT 测试过程中，`suppressDialogsInFrame` 已经运行（console 有 `[OO] dialog suppression active in iframe`），
但 "Connection is lost. You can still view the document..." 对话框依然弹出。

DevTools 确认：
- `Common.UI.__dlgSuppressed === true`
- `Common.UI.warning` 已被替换为我们的 patched 版本
- 但对话框仍然出现

### 根因调查

通过 `evaluate_script` 在 iframe 内执行 `mainCtrl.onError.toString()`，
追踪 `CoAuthoringDisconnect` 错误 case：

```javascript
case Asc.c_oAscError.ID.CoAuthoringDisconnect:
    o.msg = this.errorViewerDisconnect;
    // ...
    Common.UI.alert(o);  // ← 用的是 alert，不是 warning！
    break;
```

`errorViewerDisconnect` 的内容：
```
"Connection is lost. You can still view the document,<br>but will not be able to download or print it until the connection is restored and page is reloaded."
```

**根因**：`suppressDialogsInFrame` 只 patch 了 `Common.UI.warning`，
但 `CoAuthoringDisconnect` 错误走的是 `Common.UI.alert`。

### 修复

**`src/lib/onlyoffice-editor.ts`** — `suppressDialogsInFrame` 函数同时 patch `warning` 和 `alert`：

```typescript
function suppressDialogsInFrame(frameWindow: any): void {
  const SUPPRESSED_MSGS = ['Connection is lost', 'error occurred during the work'];
  const shouldSuppress = (opts: any): boolean => {
    const msg: string = opts?.msg ?? '';
    return typeof msg === 'string' && SUPPRESSED_MSGS.some((s) => msg.indexOf(s) !== -1);
  };

  let attempts = 0;
  const poll = () => {
    const ui = frameWindow.Common?.UI;
    if (ui?.__dlgSuppressed) return;
    if (!ui || typeof ui.warning !== 'function' || typeof ui.alert !== 'function') {
      if (attempts++ < 50) setTimeout(poll, 200);
      return;
    }
    ui.__dlgSuppressed = true;

    const origWarning = ui.warning.bind(ui);
    ui.warning = (opts: any) => (shouldSuppress(opts) ? undefined : origWarning(opts));

    // "Connection is lost" (Asc.c_oAscError.ID.CoAuthoringDisconnect) calls Common.UI.alert
    const origAlert = ui.alert.bind(ui);
    ui.alert = (opts: any) => (shouldSuppress(opts) ? undefined : origAlert(opts));

    console.log('[OO] dialog suppression active in iframe (warning + alert)');
  };
  poll();
}
```

**`vite.config.ts`** — Vite middleware PATCH 脚本中的 `suppressConnectionLost` IIFE 同步更新，
同样等待 `ui.alert` 可用后才 patch（poll 条件从只检查 `warning` 改为检查 `warning && alert`），
并在 IIFE 内同时覆盖 `warning` 和 `alert`。

修复后 console 输出：
```
[OO] dialog suppression active in iframe (warning + alert)
```
Excel 和 PPT 不再出现阻塞对话框。

---

## Word (docx) 测试

### 加载流程

```
[OO] onAppReady — pendingCopy: null, binData starts with: data:...;base64,...
[OO] loadDocument ready after 50 ms
[OO] onEditorPermissions — isEdit: true
[OO] onDocumentContentReady
Document loaded: New_Document.docx
```

### 工具栏截图状态

- Tab 行：File / Home / Insert / Draw / Layout / References / Collaboration / Plugins / View
- 格式化控件：字体选择、字号、粗/斜/下划线、对齐、段落样式
- 可编辑（isEdit=true）

### 结论

Word 编辑器完全正常，加载快（50 ms），无任何崩溃或对话框。

---

## Excel (xlsx) 测试

### 加载流程

```
[OO] onAppReady — pendingCopy: null, binData starts with: data:...;base64,...
[OO] loadDocument ready after 3024 ms   ← 显著比 docx 慢
[OO] onEditorPermissions — isEdit: true
[OO] onDocumentContentReady
Document loaded: New_Document.xlsx
```

**注意**：xlsx 的 `loadDocument ready` 约需 3 秒，是 docx/pptx 的 60 倍。
这是正常现象——电子表格编辑器初始化时需要加载公式引擎、单元格渲染器等额外模块。

### 工具栏截图状态

- Tab 行：File / Home / Insert / Draw / Layout / Formula / Data / Collaboration / View
- 可见 Sheet1 标签页和网格
- 公式栏可见

### 结论

Excel 编辑器正常，加载约 3 秒，修复对话框 patch 后无阻塞弹窗。

---

## PowerPoint (pptx) 测试

### 加载流程

```
[OO] onAppReady — pendingCopy: null, binData starts with: data:...;base64,...
[OO] loadDocument ready after 50 ms
[OO] presentation openedAt gate after 100 ms    ← pptx 专有
[OO] onEditorPermissions — isEdit: true
[OO] onDocumentContentReady
Document loaded: New_Document.pptx
```

**pptx 特有细节**：存在一个额外的 100 ms "openedAt gate"，
通过访问 `window.editor.WordControl.m_oWordControl.m_oDrawingDocument.Slides[0]` 的 `kvd` 或 `rdg`
属性（均为 minified 属性名）来等待幻灯片数据写入完成后才调用 `asc_openDocumentFromBytes`。

**pptx 空模板大小**：34820 bytes（vs. docx 4204 bytes，xlsx 1938 bytes）

### 工具栏截图状态

- Tab 行：File / Home / Insert / Draw / Design / Transitions / Animation / Collaboration / View
- 幻灯片 1 显示"Slide title"和"Slide subtitle"占位符
- 左侧幻灯片缩略图面板可见

### 结论

PPT 编辑器正常，有 100 ms 额外 gate，修复后无阻塞弹窗。

---

## 已知 404 问题及处理

### `/plugins.json` 404

**现象**：每次加载时出现 `GET /plugins.json 404`。  
**原因**：OnlyOffice 在启动时尝试从服务器根路径获取插件配置。  
**处理**：在 `public/plugins.json` 创建空配置，内容为 `{"pluginsData": []}`，消除 404。

### `/themes.json` 404

**现象**：每次加载时出现 `GET /themes.json 404`。  
**原因**：OnlyOffice 从根路径加载自定义主题配置（区别于 `/web-apps/apps/common/main/resources/themes/themes.json`，后者已存在）。  
**处理**：在 `public/themes.json` 创建空配置，内容为 `{"themes": []}`，消除 404。

### 其他预期 404（无需处理）

| 路径 | 原因 |
|------|------|
| `/document_editor_service_worker.js` | Vite 中间件故意返回 404，避免 SW 注册 |
| WebSocket upgrade 失败 | 预期——Engine.IO fake handshake 只支持 polling，客户端自动降级 |
| Service Worker 注册失败 | 预期——dev 模式下不启用 SW |

---

## `warn: failed to load/parse themes.json` 警告

OnlyOffice 在内部资源路径（`/web-apps/apps/common/main/resources/themes/themes.json`）加载主题时
也会尝试读取同目录下的主题数据。该路径的文件已存在（内容 `{"themes": []}`），
但加载时仍有 parse warning——可能是 OnlyOffice 期望非空主题列表。
该警告为非阻塞性，不影响编辑器功能，暂不处理。

---

## 待验证事项

以下场景仍未测试，留待后续：

1. **保存链路**（Word / Excel / PPT）：`requestSaveDocument` → `onDownloadAs` → File 返回给调用方
2. **格式转换**：docx → pdf / xlsx → csv 等（依赖 x2t WASM）
3. **打开已有文件**：拖入本地文件后 `pendingCopy` 非 null 的路径
4. **连续刷新稳定性**：多次 reload 不出现权限初始化时序问题

---

## 文件变更汇总

| 文件 | 变更 |
|------|------|
| `src/lib/onlyoffice-editor.ts` | `suppressDialogsInFrame` 同时 patch `Common.UI.warning` 和 `Common.UI.alert` |
| `vite.config.ts` | `suppressConnectionLost` IIFE 同步更新，等 `alert` 可用后才激活，同时 patch 两个方法 |
| `public/themes.json` | 新建，内容 `{"themes": []}` |
| `public/plugins.json` | 新建，内容 `{"pluginsData": []}` |
