# OnlyOffice sdkjs 内部机制：逆向工程经验总结

**日期：** 2026-06-14
**适用版本：** 7.4.1（server-mode）、9.3.0（Desktop tarball）
**背景：** 在 `explore/path-d-desktop-mock` 分支调试 9.3.0 Desktop Mock 时，通过
源码分析 + runtime 验证，系统性地摸清了 sdkjs 文档加载的内部机制。

---

## 一、文档加载的核心数据流

### 7.4.1 Server Mode（当前 main 分支）

```
DocsAPI.DocEditor 创建
  → iframe 加载 app.js + sdk-all.js
  → app.js 发送 {event:"onAppReady"} 给父页面
  → 父页面 onAppReady 回调触发
  → window.editor.sendCommand({command:'asc_openDocument', data:{buf: DOCY_STRING}})
  → postMessage → iframe → app.js gateway
  → api.asc_openDocumentFromBytes(DOCY_STRING)  ← 传字符串
  → r1i(str) → WYc.data=str, WYc.PQb=false → Shc(wyc)
  → Shc 解析 DOCY 字符串 → 渲染
```

### 9.3.0 Desktop Mode（实际 Desktop app）

```
AscDesktopEditor 注入（index.html 启动时检测）
  → execCommand("webapps:entry") → execCommand("webapps:features")
  → 编辑器 UI 就绪 → Shc() 被调用（d=null/undefined）
  → 9.3.0 Desktop 覆写的 Shc：忽略 d，调 LocalStartOpen()
  → Desktop app 读取本地文件（原始 docx ZIP bytes）
  → Desktop app 调 api.asc_openDocumentFromBytes(rawDocxBytes)
  → Shc(wyc) 再次被调用 → 但仍走 Desktop 路径 → 又调 LocalStartOpen()...
  （实际 Desktop app 不通过 asc_openDocumentFromBytes 加载，而是另一套机制）
```

### 9.3.0 Desktop Mock（我们的方案）

```
vite.config.ts 注入 AscDesktopEditor mock
  → CreateEditorApi(api) → patch MOa() → 强制 Shc 走 BRj 路径
  → onAppReady → 通过 iframe.contentWindow.__desktopApi
     调 api.asc_openDocumentFromBytes(DOCY_STRING)  ← 传字符串
  → BRj(wyc) → 解析 DOCY 字符串 → 渲染（待验证）
```

---

## 二、关键函数逆向

### `asc_openDocumentFromBytes` = `r1i`（sdk-all-min.js:1611）

```javascript
d.prototype.r1i = function(r) {
    var t = new AscCommon.WYc;
    t.data = r;                                        // r 可以是字符串或 Uint8Array
    t.PQb = AscCommon.a9c(t.data, AscCommon.SHa.xH); // 检测是否以 DOCY bytes 开头
    this.Shc(t)                                        // 调原始 Shc（或被覆写的版本）
};
```

### `a9c`（sdk-all-min.js:959，runtime 实测）

```javascript
function a9c(pa, Za) {  // pa=data, Za="DOCY"
    if (pa.length > Za.length) {
        for (var fb = 0; fb < Za.length; ++fb)
            if (pa[fb] !== Za.charCodeAt(fb))  // 注意：数组索引返回数字，字符串索引返回字符
                return false;
        return true;
    }
    return false;
}
```

**结论：**
- `a9c(Uint8Array([68,79,67,89,...]), "DOCY")` → **true**（bytes 以 DOCY magic 开头）
- `a9c("DOCY;v5;...", "DOCY")` → **false**（字符 'D' ≠ 数字 68）
- `a9c(anyOtherBytes, "DOCY")` → **false**

即 `WYc.PQb = true` 只有当传入 Uint8Array 且前4字节为 `[68,79,67,89]` 时才为 true。

### `WYc` 对象结构

```javascript
// runtime: Object.keys(new AscCommon.WYc()) = ['PQb', 'data', 'url', 'lV']
{
    PQb: boolean,   // 是否是 DOCY-magic binary
    data: any,      // 原始数据（字符串或 Uint8Array）
    url: string,    // 文档 URL
    lV: any,        // 其他元数据
}
```

### `AscCommon.lHg()`（runtime 实测）

- 返回类型：**string**（不是 Uint8Array）
- 返回值：DOCY 字符串格式 `'DOCY;v5;...;base64...'`
- 用途：`mjg()` 用它生成空文档 WYc 并调 `Shc`

```javascript
d.prototype.mjg = function() {
    var r = new AscCommon.WYc;
    r.data = AscCommon.lHg();             // 返回 DOCY 字符串
    r.PQb = AscCommon.a9c(r.data, ...);  // = false（字符串无法通过）
    this.Shc(r)                           // BRj 处理 DOCY 字符串
};
```

**重要推论：BRj（原版 Shc）天然支持 DOCY 字符串作为输入（PQb=false 时）。**

### 9.3.0 Desktop 覆写的 `Shc`（sdk-all.js:19057）

```javascript
// 先保存原版
AscCommon.r3.prototype.BRj = AscCommon.r3.prototype.Shc;

// Desktop 覆写版
AscCommon.r3.prototype.Shc = function(d) {
    // MOa() 返回 true 或没有 AscDesktopEditor → 走原版 BRj
    if (this.MOa() || !a.AscDesktopEditor) return this.BRj(d);

    // Desktop 模式：忽略 d，改调 LocalStartOpen
    this.tma && this.Qk && this.Gig() && (
        this.b_("asc_onDocumentContentReady", function() {
            Z$(Asc.editor || editor);
            setTimeout(function() { a.UpdateInstallPlugins(); }, 10);
        }),
        AscCommon.History.C0a = true,
        a.AscDesktopEditor.LocalStartOpen()  // 让 Desktop app 提供文件
    );
};
```

**Mock 破解方案：**
```javascript
// 在 CreateEditorApi 中 patch（此时 sdkjs 已加载）：
window.AscCommon.r3.prototype.MOa = function() { return true; };
// → Shc 永远走 BRj → Desktop 路径被绕过
```

### `MOa()` 的作用（推测）

原始含义：检测是否处于"服务器模式"（server-connected state）。
- 有网络连接：`true` → 走 server-mode path
- Desktop 离线模式：`false` → 走 Desktop path（LocalStartOpen）

---

## 三、DOCY 格式详解

### DOCY 字符串格式（transport encoding）

```
DOCY;v5;{byteLen};{base64data}
```

- `DOCY`：格式标识
- `v5`：版本（对应 `AscCommon.SHa = {GKd:5, xH:"DOCY"}`）
- `{byteLen}`：解码后字节数（用于验证）
- `{base64data}`：DOCY binary 的 base64 编码

**7.4.1 使用场景：** server 通过 WebSocket/postMessage 把 DOCY 字符串发给 sdkjs，
sdkjs 的 `Shc` 接收字符串，解码 base64，得到 DOCY binary，渲染。

### DOCY binary 格式（内部容器）

- 是 OnlyOffice 内部专有二进制格式（非 ZIP）
- 7.4.1 DOCY binary ≠ 9.3.0 DOCY binary（版本间二进制布局可能变化）
- 以 magic bytes `[68,79,67,89]`（ASCII "DOCY"）开头时，`a9c()` 返回 true

### 版本兼容性问题

| 场景 | 数据格式 | 7.4.1 sdkjs | 9.3.0 sdkjs |
|------|---------|-------------|-------------|
| `empty_bin.ts` 中的字符串 | DOCY 字符串（含 7.4.1 binary） | ✅ 可解析 | ❓ 字符串路径待验证 |
| `empty_bin.ts` base64 解码后的 bytes | 7.4.1 DOCY binary | ❓ | ❌ 格式不兼容 |
| x2t 转换输出的 bytes | 对应版本 DOCY binary | ✅ | ✅（如 x2t 也是 9.3.0）|
| 原始 .docx ZIP bytes | PKZIP | ❌ | ✅（Desktop 模式接受）|

---

## 四、`openDocument` vs `sendCommand` API 差异

### 7.4.1 DocsAPI（api.js）

```javascript
// window.editor 暴露的方法：
{
    sendCommand: (opts) => { /* postMessage to iframe */ },
    downloadAs: ...,
    destroyEditor: ...,
}

// 发送文档数据：
window.editor.sendCommand({
    command: 'asc_openDocument',
    data: { buf: DOCY_STRING }
});
// → app.js gateway: this.api.asc_openDocumentFromBytes(data.buf)
//   传的是字符串！
```

### 9.3.0 DocsAPI（api.js）

```javascript
// window.editor 暴露的方法（runtime 实测）：
{
    // sendCommand 不存在！（silent no-op via optional chaining）
    openDocument: _openDocumentFromBinary,  // = 传 binary buffer
    downloadAs: ...,
    destroyEditor: ...,
    // 还有: showMessage, processRightsChange, refreshHistory, ...
}

// _openDocumentFromBinary 内部：
function _openDocumentFromBinary(bytes) {
    // bytes 必须是 Uint8Array
    postMessage(iframe.contentWindow,
        { command: 'openDocumentFromBinary', data: bytes.buffer },
        [bytes.buffer]  // transferable — buffer 传后被 detach！
    );
}

// app.js gateway 接收：
binary: function(t) { t && this.api.asc_openDocumentFromBytes(new Uint8Array(t)) }
// 传的是 Uint8Array（bytes）！
```

**关键差异：**
- 7.4.1：字符串路径（DOCY string → string parameter）
- 9.3.0 `openDocument`：binary 路径（bytes → Uint8Array parameter）

**陷阱：** `openDocument(pendingCopy)` 调用后 `pendingCopy.buffer` 被 transfer，
`window.__pendingBinary`（同一引用）的 `byteLength` 变为 0。可用此现象判断是否已调用。

---

## 五、iframe 访问模式

### DocsAPI 创建 iframe 的容器选择器

```javascript
new window.DocsAPI.DocEditor('iframe', config)
// 参数 'iframe' 是容器 div 的 id
```

**问题：** 容器 `div#iframe` 可能不存在于 DOM（取决于页面框架），
DocsAPI 可能将 `<iframe>` 插入到 `#app` 或其他容器中。

**正确查找 iframe 的方式：**
```javascript
// ❌ 错误：依赖容器 ID
document.getElementById('iframe')?.querySelector('iframe')

// ✅ 正确：直接找页面上的 iframe
document.querySelector('iframe')

// ✅ 或者：更健壮的方式（找包含 onlyoffice 的 iframe）
document.querySelector('iframe[src*="documenteditor"]')
```

### 跨 iframe 访问 API（同源）

```javascript
// 父页面访问子 iframe 的 window 变量（同源时可用）：
const iframeEl = document.querySelector('iframe');
const iwin = iframeEl.contentWindow;

// 访问在 mock 脚本中注入的 __desktopApi：
const api = iwin.__desktopApi;

// 直接调用 sdkjs 方法（绕过 postMessage 编码）：
api.asc_openDocumentFromBytes(docyString);  // 传字符串！
```

**适用场景：** 当需要以特定格式（如 DOCY 字符串）调用 sdkjs 接口，
而外层 API（`openDocument`）只支持 binary 时。

---

## 六、Desktop Mode Mock 架构模式

### 完整 Mock 结构

```javascript
window.AscDesktopEditor = {
    // 1. 消息通道：sdkjs → 外部（no-op 即可）
    execCommand: function(cmd, data) {
        log('execCommand', cmd);
    },

    // 2. API 桥接：sdkjs 就绪时调用，传入 sdk api 对象
    CreateEditorApi: function(api) {
        window.__desktopApi = api;

        // 关键：patch MOa 强制走 server-mode 文档加载路径
        window.AscCommon.r3.prototype.MOa = function() { return true; };

        // 注册回调（可选）
        api.asc_registerCallback('asc_onCoAuthoringDisconnect', function(){});
        api.asc_registerCallback('asc_onConnectionStateChanged', function(){});
    },

    // 3. 文档名称：Z$() 函数可能调用
    SetDocumentName: function(name) { },
    LocalFileGetSourcePath: function() { return ''; },

    // 4. 本地文件加载：MOa=true 后不再被调用，保留为 no-op
    LocalStartOpen: function() { },

    // 5. 插件信息：SDK 调用，必须返回合法结构
    GetInstallPlugins: function() {
        return JSON.stringify([
            { url: '', pluginsData: [] },
            { url: '', pluginsData: [] }
        ]);
    },

    // 6. 缩放支持：scale 检测需要
    GetSupportedScaleValues: function() {
        return [1, 1.25, 1.5, 1.75, 2];
    },

    // 7. onDocumentContentReady：文档渲染完成时调用（可选）
    onDocumentContentReady: function() { },
};
```

### 注入时机

Desktop mock 必须在 **editor iframe 的 index.html 的 `<head>` 最开始** 注入，
早于任何 sdkjs 加载。通过 vite 中间件拦截 `index.html` 响应并插入 `<script>` 标签实现：

```javascript
const injected = html.replace('<head>', `<head>\n${MOCK}`);
```

### 字体重定向

9.3.0 Desktop sdkjs 从 `ascdesktop://fonts/` 加载字体（Electron 协议），
浏览器无法识别。需要拦截 `XMLHttpRequest.open` 重定向到开源字体：

```javascript
var origOpen = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && url.indexOf('ascdesktop://fonts/') === 0) {
        // 映射到 /fonts/ 目录下的开源字体
        arguments[1] = '/fonts/' + map[filename] || url;
    }
    return origOpen.apply(this, arguments);
};
```

---

## 七、调试方法论

### 利用 `[DE]` 日志追踪 Mock 执行顺序

在 mock 的所有函数中加统一前缀日志，直接在父页面 console 可见（同源 iframe 日志会透传）：

```javascript
console.log('[DE]', ...parts);
// 典型序列（正常）：
// [DE] execCommand | webapps:entry
// [DE] execCommand | webapps:features
// [DE] CreateEditorApi
// [DE] MOa patched → BRj path active
// [DE] SetDocumentName | New_Document.docx
// [DE] execCommand | title:button | {"disabled":{"all":true}}
// [DE] execCommand | editor:onready
```

`title:button disabled` 是 socket.io 连接失败的标志（约 10 秒后触发）。
`editor:onready` 是编辑器 UI 就绪的标志（不代表文档已渲染）。

### 用 Chrome DevTools 做 runtime 验证

通过 `mcp__chrome-devtools__evaluate_script` 直接在浏览器中检验假设：

```javascript
// 1. 检查 iframe 访问
const iwin = document.querySelector('iframe')?.contentWindow;
iwin.__desktopApi;  // 确认 mock 是否已绑定

// 2. 检查 API 形态（区分 7.4.1 vs 9.3.0）
Object.keys(window.editor);
// 7.4.1: ['sendCommand', 'downloadAs', ...]
// 9.3.0: ['openDocument', 'downloadAs', 'showMessage', ...]

// 3. 检查 buffer 是否被 transfer（检测 onAppReady 是否触发）
window.__pendingBinary?.byteLength;
// 0 = buffer 已 transfer（openDocument 被调用了）
// >0 = 未被调用

// 4. 在 iframe 内运行函数
const iwin = document.querySelector('iframe').contentWindow;
iwin.AscCommon.a9c(new Uint8Array([68,79,67,89]), "DOCY");  // true/false
```

### 错误溯源：`ConvertationOpenFormat`

`Asc.c_oAscError.ID.ConvertationOpenFormat` → app.js 显示 `errorInconsistentExt` 弹窗。
触发条件：sdkjs 尝试解析传入数据时，检测到格式与文件扩展名不符（或格式完全不认识）。
排查方向：检查传给 `asc_openDocumentFromBytes` 的数据格式是否匹配当前 sdkjs 版本。

---

## 八、`empty_bin.ts` 与版本兼容性

### 现状

```typescript
// src/lib/empty_bin.ts
g_sEmpty_bin['.docx'] = 'DOCY;v5;7372;{base64_of_7.4.1_DOCY_binary}';
g_sEmpty_bin['.xlsx'] = 'XLSY;v1;{byteLen};{base64_of_7.4.1_DOCY_binary}';
```

这些 base64 数据是 **7.4.1 时期的 DOCY binary**，在 7.4.1 sdkjs 中通过字符串路径解析。

### 9.3.0 兼容性分析

| 用法 | 是否可行 |
|------|----------|
| 将字符串整体传给 9.3.0 `asc_openDocumentFromBytes` | ✅ 待验证（BRj 理应支持） |
| 将 base64 解码后的 bytes 传给 9.3.0 `asc_openDocumentFromBytes` | ❌ 7.4.1 binary 格式不兼容 |
| 用 9.3.0 x2t 重新生成并更新 | ✅ 长期解法 |

### 更新 `empty_bin.ts` 的方法（待执行）

```javascript
// 在 x2t WASM 初始化后，转换一个最小空 docx 得到新的 DOCY binary：
const emptyDocxBytes = /* minimal valid .docx ZIP */;
const result = await x2t.convert(emptyDocxBytes, 'docx', 'docy');
// result 是 9.3.0 DOCY binary（bytes）
// base64 编码：
const base64 = btoa(String.fromCharCode(...result));
const docyString = `DOCY;v5;${result.byteLength};${base64}`;
// 更新 g_sEmpty_bin['.docx'] = docyString
```

---

## 九、已知陷阱和反直觉点

### 1. `sendCommand` 在 9.3.0 是静默 no-op

```typescript
window.editor?.sendCommand({...});  // 9.3.0 中：没有此方法，?.链静默跳过
// 不会报错，但也没有任何效果！
```

排查方法：`Object.keys(window.editor)` 检查是否包含 `sendCommand`。

### 2. `openDocument(bytes)` 会 transfer ArrayBuffer

```javascript
editorAny.openDocument(pendingCopy);  // pendingCopy.buffer 被 transfer
// 调用后：pendingCopy.byteLength === 0！
// window.__pendingBinary 是同一引用，也变成 0。
```

### 3. `getElementById('iframe')` vs `querySelector('iframe')`

DocsAPI 的容器参数 `'iframe'`（字符串 ID）不保证对应 DOM 中存在 `#iframe` 元素。
实际 iframe 的 DOM 位置由页面框架决定（可能在 `#app` 内）。
始终用 `document.querySelector('iframe')` 而非 `getElementById('iframe')?.querySelector('iframe')`。

### 4. Desktop sdkjs 的 `Shc` 覆写在 sdk-all.js 末尾

不是在 sdk-all.js 的类定义处，而是在文件末尾的独立 IIFE 中：
```javascript
// sdk-all.js:19057
(function(a, b) {
    AscCommon.r3.prototype.ljg = function() { this.MOa() && this.mjg() };
    AscCommon.r3.prototype.BRj = AscCommon.r3.prototype.Shc;  // 保存原版
    AscCommon.r3.prototype.Shc = function(d) { /* Desktop 覆写 */ };
    // ... 其他 Desktop-specific 方法
})(window);
```

patch `MOa` 必须在这段代码执行**之后**（即 `CreateEditorApi` 回调中），否则被覆盖无效。

### 5. `a9c` 比较数字 vs 字符

```javascript
// a9c 的逻辑：pa[fb] !== Za.charCodeAt(fb)
// 对字符串：'D' !== 68  → true → return false
// 对 Uint8Array：68 !== 68 → false → 继续
```

这意味着：相同内容，字符串 vs Uint8Array 会得到不同的 `PQb` 值。
`BRj` 根据 `PQb` 采用不同的解析路径（具体逻辑待进一步逆向）。

### 6. 同源 iframe 的 console 日志在父页面可见

Chrome DevTools 的 Console 显示所有 frames 的日志（包括 iframe）。
`[DE]` 前缀日志虽然在 iframe 中 `console.log`，父页面 Console 也会显示。
可以直接在父页面 Console 看到 mock 的执行情况，无需切换 frame。

---

## 十、本次调查的方法论价值

### 有效的调试流程

1. **先确认症状**（截图 + console log）
2. **定位 API 调用链**（从父页面到 iframe，追 postMessage）
3. **在 runtime 验证假设**（用 evaluate_script 直接调函数）
4. **逐层缩小范围**（先确认 bytes 到达 BRj，再分析 BRj 拒绝原因）
5. **查找关键函数的真实实现**（grep sdkjs 源码）

### 在极度压缩的 minified JS 中寻找函数

技巧：
- 用 `grep -n "functionName"` 找使用点
- 在使用点附近寻找赋值语句（`a.AscCommon.xxx = fn`）
- 配合 runtime `fn.toString()` 直接获取函数体（比 grep 源码更可靠）

```javascript
// 比在 minified 文件中搜索更有效：
iwin.AscCommon.a9c.toString()
// → "function w(pa,Za){if(pa.length>Za.length)..."
```

### 用 `__pendingBinary.byteLength` 作为执行探针

在父页面设 `window.__pendingBinary = pendingCopy`，调用 `openDocument(pendingCopy)` 后
buffer 被 transfer，`__pendingBinary.byteLength` 从正常值变为 0。
无需添加 console.log，通过状态变化就能判断函数是否被调用。
