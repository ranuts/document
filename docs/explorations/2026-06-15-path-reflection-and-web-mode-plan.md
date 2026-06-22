# 路径反思与 Web Mode 实施方案

**日期：** 2026-06-15  
**分支：** `explore/path-d-desktop-mock` → 新建 `explore/path-e-web-mode`  

---

## 为什么工作了这么久还没解决根本问题

### 实际工作轨迹

```
目标：让 9.3.0 编辑器在浏览器里正常工作

实际做了什么：
  ✅ 让 canvas 渲染出来（有像素）
  ✅ 修 onSave → onSaveDocument 事件名
  ✅ 研究 LocalFileSave/Bsf 保存链路
  ✅ 修 WASM ArrayBuffer .slice() 问题
  ✅ 修 X2T 吃 DOCX 当 .bin 问题
  ✅ 修 SecurityError fallback
  ✅ 修 sendCommand → serviceCommand
  
  结果：文件能下载 ✅
  但是：工具栏从第1天就是空的，从未改变 ❌
```

### 根本原因：一直在解决症状而不是病根

**1. 每次会话从上次断点继续，而不是重新审视方向**

上下文总结总是「继续修复保存链路」。工具栏问题始终在「遗留问题」列表里，从未成为会话主目标。

**2. Desktop Mock 越走越深（沉没成本效应）**

选了 Desktop Mock 之后，每次调试都在这条路上打补丁。打得越多，越难说「这条路本身就错了」。

**3. 文档记录了发现，但没有触发决策**

CLAUDE.md 和 exploration docs 写得很详细，但「需要改用 Web Mode + loadBinary」这个结论一直停留在文档里，没有变成行动。记录发现 ≠ 解决问题。

**4. 成功标准定错了**

调试成功标准 = 「控制台出现 `[OO] save binary XXXX bytes`」，而不是「工具栏完整、用户能正常使用」。成功标准错误，就会在错误的地方花时间。

---

## 两种模式的根本差异

### 7.4.1 Web Mode（正常工作）

```
editorConfig 无 type: 'desktop'
  → isDesktopApp = false
  → iframe 渲染完整 HTML 工具栏
  → createDelayedElements() 正常运行
  → toolbar.btnUndo / btnPrint / btnsPageBreak 全部初始化
  → 文档通过 sendCommand('asc_openDocument', {buf: binary}) 注入
```

### 9.3.0 Desktop Mock（问题所在）

```
editorConfig 有 type: 'desktop' 或 targetApp === 'desktop'
  → isDesktopApp = true  [app.js:1709250]
  → 假设工具栏由 C++ 原生 UI 提供，不在 iframe 里渲染
  → createDelayedElements() 里的 DOM 元素根本不存在
  → 我们的 mock 不得不 guard（跳过）它
  → toolbar.btnUndo / btnsPageBreak = undefined
  → onDocumentReady → activateControls() → 连串 TypeError
```

### 为什么当初不用 Web Mode

9.3.0 移除了 `asc_openDocument` 命令（7.4.1 的文档注入路径）。  
Web Mode 需要通过 URL 从服务器加载文档 + socket.io 协同连接。  
没有真实服务器 → 404 → 文档无法加载。  
Desktop Mock 是绕过服务器依赖的临时方案，但代价是失去了完整 UI。

---

## 正确的解决方案：Web Mode + 最小 Engine.IO 握手

### 核心发现（app.js:1808437）

```javascript
// 9.3.0 app.js 里存在 loadBinary Gateway 命令处理器
loadBinary: function(t) {
  t && this.api.asc_openDocumentFromBytes(new Uint8Array(t))
}
```

`asc_openDocumentFromBytes` 在 Web Mode 下仍然存在于 SDK api 对象上。  
在 `onAppReady` 时通过同源 iframe 访问直接调用即可注入文档二进制。

### 实施方案

**Step 1：Vite 添加最小 Engine.IO 握手中间件**

OnlyOffice 9.3.0 连接 socket.io 的 URL 格式：
```
GET /doc/{sessionId}/c/?EIO=4&transport=polling
POST /doc/{sessionId}/c/?EIO=4&transport=polling&sid=xxx
```

最小响应（让编辑器以为连上了服务器，不再重试）：
```
GET  → 97:0{"sid":"x","upgrades":[],"pingInterval":25000,"pingTimeout":5000}2:40
POST → ok
后续 GET → 2:40  (socket.io noop)
```

**Step 2：移除 vite.config.ts 中的 Desktop Mock**

移除：
- `window.AscDesktopEditor` mock
- `window.DesktopOfflineAppDocumentStartSave/EndSave`
- `AscDesktopEditor.LocalFileSave` (含 Bsf 调用)
- `AscDesktopEditor.LocalFileGetSourcePath`
- MOa/BRj patch（`__desktopApi` 注入）
- 所有 `createDelayedElements` / `setExtra` / `setLanguages` 等 guard stubs
- `canSaveDocumentToBinary: true` 覆盖（Web Mode 下 api.js 会自动从 events.onSaveDocument 推导）

保留：
- `html()` URL rewrite（让 `/docx-editor/?...` 加载正确的 HTML）
- `offlineMode` 注入（canDownload, canCoAuthoring: false 等）
- `canDownload: true`

**Step 3：修改 onlyoffice-editor.ts 文档加载路径**

```typescript
// onAppReady 里：
const iframeEl = document.querySelector('iframe') as HTMLIFrameElement | null;
const iwin = iframeEl?.contentWindow as any;
const api = iwin?.Asc?.editor;

if (typeof api?.asc_openDocumentFromBytes === 'function') {
  // Web Mode 9.3.0：直接通过同源 iframe 访问 SDK api 注入文档
  api.asc_openDocumentFromBytes(ooxmlBytes);
} else {
  // 7.4.1 fallback
  editorSendCommand({ command: 'asc_openDocument', data: { buf: binData } });
}
```

**Step 4：保留已验证可用的保存链路**

`onSaveDocument` → `handleSaveDocument` → OOXML ZIP 检测 → `downloadFile` 链路已验证，无需改动。

---

## 预期效果

| 项目 | Desktop Mock（现状） | Web Mode（目标） |
|------|---------------------|-----------------|
| 工具栏 | ❌ 空（蓝色条） | ✅ 完整 |
| 保存 | ✅ 可下载 | ✅ 可下载（复用已有链路） |
| TypeError 数量 | ~8 个 | 0 |
| createDelayedElements | guarded/跳过 | 正常运行 |
| socket.io 404 洪水 | 持续 | 消除（握手成功） |

---

## 教训（供未来参考）

**工作量不等于接近目标。方向错了，做得越精细只会离出口越远。**

每次会话开始时应该先问：**「架构上是否正确？」**，而不是「上次的 bug 修完了没？」。

「遗留问题」列表里长期存在的条目，是方向需要重新审视的信号，不是可以无限推迟的技术债。
