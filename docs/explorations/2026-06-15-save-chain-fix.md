# 9.3.0 保存链路修复记录

**日期：** 2026-06-15
**分支：** `explore/path-d-desktop-mock`
**状态：** ✅ 代码已修复，待浏览器验证

---

## 背景

基于前六轮调试（见 [2026-06-14-desktop-mock-9.3.0-debug.md](2026-06-14-desktop-mock-9.3.0-debug.md)），Word 画布已能渲染（`canvas#id_viewer` 非透明像素 1666/2450），但保存功能从未测试。本轮通过静态代码分析 `api.js` + `app.js` 发现保存链路完全断裂。

---

## 根因分析：`onSave` → `onSaveDocument` 事件名变更

### api.js:408 — `canSaveDocumentToBinary` 标志

```javascript
_config.editorConfig.canSaveDocumentToBinary = _config.events && !!_config.events.onSaveDocument;
```

这是关键：`canSaveDocumentToBinary` 只在 `events.onSaveDocument` 存在时为 `true`。
旧代码用的是 `events.onSave`，所以 `canSaveDocumentToBinary = false`。

### app.js:1772392 — 回调注册被标志门控

```javascript
t.appOptions.canSaveDocumentToBinary &&
  t.api.asc_registerCallback("asc_onSaveDocument", _.bind(t.onSaveDocumentBinary, t))
```

`canSaveDocumentToBinary = false` → `asc_onSaveDocument` SDK 回调**永远不注册**。

### 完整保存链路（9.3.0）

```
用户 Ctrl+S
  → SDK 内部处理文档 → 触发 asc_onSaveDocument(uint8array)
  → app.js onSaveDocumentBinary(t) → Common.Gateway.saveDocument(t)
  → postMessage({event:"onSaveDocument", data:t.buffer}, [t.buffer])  ← ArrayBuffer transfer
  → api.js MessageDispatcher 接收，msg.data.event === 'onSaveDocument'
  → _fn(msg.data)  → 外层 _onMessage(msg)
  → handler = events['onSaveDocument']  ← 必须定义此 key
  → handler({target: DocEditor, data: ArrayBuffer})
```

### 数据格式对比

| 项目 | 7.4.1 (`onSave`) | 9.3.0 (`onSaveDocument`) |
|------|-----------------|--------------------------|
| `event.data` 类型 | `{ data: { data: Uint8Array }, option: { outputformat: number } }` | `ArrayBuffer`（postMessage transfer） |
| `targetFormat` 来源 | `c_oAscFileType2[option.outputformat]` | 从 `fileName` 推导文件扩展名 |
| SDK 回调名 | 未知 | `asc_onSaveDocument` |

---

## 已修复

### `src/lib/onlyoffice-editor.ts`

**1. 事件名修正（最关键）**

```diff
- onSave: handleSaveDocument,
+ // 9.3.0: api.js maps this event to canSaveDocumentToBinary flag, name changed from 7.4.1 onSave
+ onSaveDocument: handleSaveDocument,
```

**2. `handleSaveDocument` 双路解析**

```typescript
async function handleSaveDocument(event: any) {
  let binaryData: Uint8Array;
  let targetFormat: string;
  const { fileName } = getDocmentObj() || {};

  if (event.data instanceof ArrayBuffer) {
    // 9.3.0 路径 — onSaveDocument 通过 transfer 传 ArrayBuffer
    binaryData = new Uint8Array(event.data);
    const ext = (fileName?.split('.').pop() || 'docx').toUpperCase();
    targetFormat = fileName?.toLowerCase().endsWith('.csv') ? 'CSV' : ext;
    console.log(`[OO] save 9.3.0 binary ${binaryData.byteLength} bytes → format ${targetFormat}`);
  } else if (event.data?.data?.data) {
    // 7.4.1 路径 — 嵌套对象，含 option.outputformat
    binaryData = event.data.data.data as Uint8Array;
    targetFormat = c_oAscFileType2[event.data.option?.outputformat] || 'DOCX';
    if (fileName?.toLowerCase().endsWith('.csv')) targetFormat = 'CSV';
  } else {
    console.warn('[OO] handleSaveDocument: unrecognized event format', typeof event.data);
    return;
  }
  // ... 后续 convertBinToDocumentAndDownloadFn(binaryData, fileName, targetFormat)
}
```

### `src/types/editor.d.ts`

```typescript
events: {
  // 9.3.0+ 事件名
  onSaveDocument?: (event: { target: DocEditor; data: ArrayBuffer }) => void;
  // 7.4.1 legacy，9.3.0 api.js 不再 dispatch
  onSave?: (event: SaveEvent) => void;
  // ...
}
```

### `vite.config.ts`

```diff
- canSaveDocumentToBinary: false,
+ canSaveDocumentToBinary: true,
```

`offlineMode` 里的值只在 `appOptions[key] === undefined` 时填充。将它改为 `true` 是为了在 Main.appOptions 未正确初始化的边缘情况下不阻断保存。正常路径下 api.js 会在 init 时将 `canSaveDocumentToBinary=true` 传给 iframe，不依赖此默认值。

---

## 关键经验

### 经验 1：升级时必须对照检查所有事件名

OnlyOffice 9.3.0 api.js 的事件名发生了 breaking change：

| 旧名（7.4.1） | 新名（9.3.0） | 影响 |
|--------------|--------------|------|
| `onSave` | `onSaveDocument` | 保存完全失效，且静默（无报错） |

原因：新版引入了 `canSaveDocumentToBinary` 能力标志，只有事件名正确时才会激活保存回调链。错误的事件名不会报错，只会让 `canSaveDocumentToBinary=false`，SDK 静默跳过保存路径。

**经验：** 升级 OnlyOffice 大版本后，需对照 api.js 的事件文档逐个验证事件名。事件更名通常没有明显错误，只是功能静默失效。

### 经验 2：postMessage transfer 导致接收端类型是 ArrayBuffer

9.3.0 用 `postMessage(msg, [buffer])` 的 transfer 方式传文档二进制：
- 发送端 `t.buffer` (Uint8Array.buffer) 被 transfer 后变为 neutered（长度为 0）
- 接收端 `msg.data.data = ArrayBuffer`（非 Uint8Array）

判断方式：`event.data instanceof ArrayBuffer`（不是 `instanceof Uint8Array`）。

转换方式：`new Uint8Array(event.data)`。

### 经验 3：静态分析 minified JS 的有效手段

本轮不依赖浏览器 DevTools，直接用 `grep` + `python3` 在 minified `app.js`（7MB）中定位关键逻辑：

```bash
# 找 saveDocument 在哪里被调用
python3 -c "
with open('app.js') as f: content = f.read()
idx = content.find('.saveDocument(')
while idx >= 0:
    print(content[max(0,idx-200):idx+300])
    idx = content.find('.saveDocument(', idx+1)
"
```

先找显式字符串（`saveDocument`、`onSaveDocument`），再向前/向后扩展上下文，比正则全局搜索更精准。

### 经验 4：api.js MessageDispatcher 的双通道

api.js 有两个消息通道：

**通道 1（主通道，line 455）**：用于常规 iframe → parent 通信，按 `msg.event` 路由到 `events[msg.event]`。要求消息含 `frameEditorId`。

**通道 2（辅通道，line 992-1000）**：用于 `onSaveDocument`，直接检查 `msg.data.event === 'onSaveDocument'` 后调用 `_fn(msg.data)`。这是因为 ArrayBuffer transfer 后 `msg.data` 不能 `JSON.parse`，所以提前拦截。

`onSaveDocument` 消息最终还是由通道 1 路由（因为它带 `frameEditorId`），通道 2 的 `_fn` 是另一个独立监听器（用于特定场景，如嵌入模式）。

---

## 验证结果 ✅ 已全部确认

### 主线验证

- [x] **New Word → save（无用户激活路径）**
  - console：`[OO] save 9.3.0 binary 34424 bytes → format DOCX` ✅
  - `showSaveFilePicker` 因无 transient activation 抛 SecurityError → fallback to `downloadFile` ✅
  - `<a download="New_Document.docx">` 被点击 → 下载到 `~/Downloads/New_Document.docx` ✅
  - 文件 33.6KB，ZIP magic `PK\x03\x04`，包含 `word/styles.xml` 等标准结构 ✅
  - 保存后无 "Uncaught (in promise)" 错误（见下方 sendCommand 修复）✅

- [ ] New Excel → Ctrl+S → `.xlsx` 下载正常（待测）
- [ ] New PowerPoint → Ctrl+S → `.pptx` 下载正常（待测）

### sendCommand → serviceCommand（已修复）

9.3.0 的 `DocEditor` 实例已不再暴露 `sendCommand` 方法，改为 `serviceCommand`。
`handleSaveDocument` 完成后调用 `window.editor.sendCommand(...)` 会抛 `TypeError`，
导致 `handleSaveDocument` 以 rejected promise 结束 → "Uncaught (in promise)"。

**已修复**：在 `onlyoffice-editor.ts` 顶部添加 `editorSendCommand()` helper，
优先尝试 `serviceCommand`，降级到 `sendCommand`（7.4.1 兼容）。
所有 8 处 `window.editor?.sendCommand(...)` 均已替换。

`serviceCommand` 接受完全相同的参数格式（`{command, data}`），行为一致。

### 下载路径行为（关键发现）

`showSaveFilePicker` 调用结果取决于是否有 transient user activation：

| 调用来源 | 有 activation? | 行为 |
|---------|---------------|------|
| CDP `evaluate_script`（5s 内）| ✅ 有 | 显示原生文件保存对话框 |
| postMessage handler（Ctrl+S 经由 iframe）| ❌ 无 | SecurityError → `downloadFile` |
| CDP setTimeout > 5s 后 | ❌ 无 | SecurityError → `downloadFile` |

实际用户流程（Ctrl+S in iframe → postMessage → parent handler）不会传递 transient activation，
因此 `showSaveFilePicker` 会抛 SecurityError，自动触发 `downloadFile`，文件保存到浏览器默认下载目录。

---

## 遗留问题（本轮未处理）

| 问题 | 影响 | 建议 |
|------|------|------|
| Toolbar `createDelayedElements` 被 guard 跳过 | toolbar 按钮不初始化，但键盘编辑可能仍可用 | 测试后决定是否补 stub |
| Socket.io 404 + `Aqg` timer 驱动文档 ready | 依赖 250ms 轮询，有竞态风险 | 评估是否实现最小 Engine.IO handshake |
| 测试 `../../lib/` 导入路径错误 | `pnpm run tsc && pnpm run test` 失败 | 独立修复，不影响编辑器运行 |
| Excel/PowerPoint `g_sEmpty_ooxml` 模板质量未验证 | 可能触发类似 `df.Rad null.indexOf` 的崩溃 | 打开时观察 console |
