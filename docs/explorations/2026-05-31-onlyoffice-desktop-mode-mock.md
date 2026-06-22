# OnlyOffice 9.3.0 Desktop Mode Mock 探索

**日期：** 2026-05-31 → 2026-06-14（持续更新）  
**分支：** `upgrade/onlyoffice-9.3.0`  
**状态：** ❌ 放弃 — `Ec.Ms` 初始化路径在 mock 环境下不可达，根本原因已明确

> **2026-06-14 补充**：Desktop Mode Mock 卡在 `Ec.Ms`（WordControl）无法初始化。
> 根本原因：`window.Asc.editor.asc_nativeOpenFile` 走 `jre()` 路径，不调用 `qYg()`，
> 而只有 `qYg()` 会执行 `this.ta.Ec.Ms = new AscCommon.Xxh(...)`。
> 即便手动创建 `Xxh` 实例并赋值，canvas 仍黑——`Xxh` 需要完整的服务端初始化上下文。
>
> **结论**：Mock 方案无法绕过 server-mode 渲染引擎的初始化依赖。
> 下一步应走[路径 B（最小 socket.io 协议服务）](./2026-05-31-onlyoffice-9.3.0-upgrade.md#最终结论2026-06-14)。

---

## 问题背景

在 [2026-05-31-onlyoffice-9.3.0-upgrade.md](./2026-05-31-onlyoffice-9.3.0-upgrade.md) 中确认，9.3.0 Document Server（Docker）是服务端连接版本，无法离线使用。`code.js` 需要 socket.io 握手才加载，`onAppReady` 永远不触发。

Desktop Editors 9.3.0 的文件结构与 Document Server 几乎相同（build 140 vs 138），同样有 `code.js`。但 Desktop 模式通过 `window.AscDesktopEditor` native bridge 绕过 socket.io。

本文记录：**如何 mock `AscDesktopEditor` 让 9.3.0 在纯 web 环境下离线运行**。

---

## 核心发现：两种初始化路径

### Server 模式（9.3.0 默认）

```
index.html → require(['app']) → app.js
  → socket.io 连接 /doc/{id}/c/?EIO=4&transport=polling
  → 服务器响应 → 动态加载 code.js
  → Common.Gateway.appReady() 触发
  → 父页面收到 onAppReady → 发送 openDocumentFromBinary
  → 文档渲染
```

**关键问题**：没有 socket.io 服务器，code.js 永远不加载，onAppReady 不触发。

### Desktop 模式（mock 目标）

```
index.html（检测到 AscDesktopEditor）
  → execCommand("webapps:entry", ...) → execCommand("webapps:features", ...)
  → CreateEditorApi(sdkApi)
  → SetDocumentName(fileName)
  → GetInstallPlugins() → UpdateSystemPlugins()
  → LocalStartOpen()   ← 关键转折点
  → [500ms 后] asc_openDocumentFromBytes(binary, AscDesktopEditor=null)
  → BRj(data) — 原始二进制加载路径
  → 字体加载 → 文档渲染
  → preloader:hide → execCommand("editor:onready")
```

Desktop 模式完全不依赖 socket.io。

---

## Shc() 覆盖是最关键的发现

这是整个机制的核心：

```javascript
// SDK 在 Desktop 模式下重写了 Shc()
AscCommon.r3.prototype.BRj = AscCommon.r3.prototype.Shc;  // 保存原始版本
AscCommon.r3.prototype.Shc = function(d) {
  if (this.MOa() || !a.AscDesktopEditor) {
    return this.BRj(d);  // 无 Desktop → 原始二进制加载路径
  }
  // Desktop 路径：忽略数据 d，只调 LocalStartOpen
  a.AscDesktopEditor.LocalStartOpen();
};
```

**因此**：直接调用 `asc_openDocumentFromBytes(data)` 时，因为 `AscDesktopEditor` 存在，`Shc` 会忽略 `data` 直接调 `LocalStartOpen`，形成递归（guard 拦截）。

**解决方案**：临时清除 `AscDesktopEditor` 再调用：

```javascript
var savedDE = window.AscDesktopEditor;
window.AscDesktopEditor = null;
try { editor.asc_openDocumentFromBytes(copy); }
finally { window.AscDesktopEditor = savedDE; }
// → Shc 走 BRj(d) 原始路径，正确加载二进制
```

---

## 完整工作机制

### 初始化链路（每次文档打开）

```
1. 用户上传文件 → x2t 转换 → binary 存入 window.__pendingBinary（34370 字节）
2. DocsAPI.DocEditor 创建（api.js 补丁：ver='', parentOrigin="file://"）
3. AscDesktopEditor mock 触发：
   - execCommand("webapps:entry") → 记录
   - execCommand("webapps:features") → 记录
   - CreateEditorApi(api) → 注册 asc_onCoAuthoringDisconnect no-op
4. GetInstallPlugins → 返回 '[{"url":"","pluginsData":[]},{"url":"","pluginsData":[]}]'
   （必须 2 个 group，SDK 强制访问 a[0].url 和 a[1].url）
5. LocalStartOpen 触发（每个字体脚本加载都会触发，guard 确保只处理一次）
6. 500ms 后：tryLoad() 调用：
   a. 临时清除 window.AscDesktopEditor = null
   b. editor.asc_openDocumentFromBytes(copy) → BRj(d) → server-mode 文档加载
   c. 恢复 window.AscDesktopEditor
7. BRj 启动 server-mode 文档加载，同时尝试 socket.io 连接
8. socket.io GET /doc/{id}/c/?EIO=4&transport=polling → Vite 返回 404
9. socket.io 重试（指数退避 1s→5s→...）约 60-120 秒后放弃
10. asc_onCoAuthoringDisconnect 触发（Common.UI.warning 拦截抑制弹框）
11. app.js Main controller 初始化（onLaunch）：
    - 注册 opendocumentfrombinary 监听器
    - 调用 Common.Gateway.appReady()
12. title:button / editor:onready execCommand 触发
13. 字体加载：ascdesktop://fonts/ XHR → prototype patch 重定向 → /fonts/*.ttf
14. 21 个字体成功加载（70MB，含 Noto CJK 变字体）
15. 文档在 canvas 渲染（1806×1298 像素，darkPixels=2500/2500 确认有内容）
```

### api.js 两处必要补丁

```bash
# 补丁一：去掉版本哈希前缀
sed -i '' "s|const ver = '/9.3.0-{{HASH_POSTFIX}}'|const ver = ''|" \
  public/web-apps/apps/api/documents/api.js

# 补丁二：parentOrigin 设为 file://
sed -i '' "s|_config.parentOrigin = window.location.origin;|_config.parentOrigin = \"file://\";|" \
  public/web-apps/apps/api/documents/api.js
```

`parentOrigin="file://"` 让 `openDocumentFromBinary` postMessage 走 file:// 分支（SDK 在 app.js 中有两个不同的消息处理路径）。

---

## Vite 插件结构

### onlyofficeVersionRewrite

```typescript
// 对 socket.io /doc/ 轮询返回 404
// SDK 经过 60-120s 重试后放弃，触发 asc_onCoAuthoringDisconnect
```

**注意**：fake handshake（返回合法 EIO4 握手包）会让 socket.io 进入无限重连循环，反而更糟。简单 404 虽慢但可靠。

### onlyofficeDesktopMock（注入到编辑器 index.html）

关键部分：

**1. XHR prototype patch（字体重定向）**
```javascript
// 把 ascdesktop://fonts/C:\Windows\Fonts\arial.ttf → /fonts/LiberationSans-Regular.ttf
// 未映射字体保持 ascdesktop:// → CORS 失败 → SDK 优雅跳过
// 注意：不能用 404 替代，SDK 对 404 会等待（hang），对 CORS 失败会跳过
var map = {
  'arial.ttf':'LiberationSans-Regular.ttf',
  'calibri.ttf':'LiberationSans-Regular.ttf',
  // ... 50+ 映射
  'msyh.ttc':'NotoSansSC-VF.ttf',  // 微软雅黑 → Noto 简体
  // ...
};
XMLHttpRequest.prototype.open = function(method, url) {
  if (url.startsWith('ascdesktop://fonts/')) {
    var fn = /* 提取文件名 */ .toLowerCase();
    if (map[fn]) arguments[1] = '/fonts/' + map[fn];
  }
  return origOpen.apply(this, arguments);
};
```

**2. suppressDialog（抑制 Connection is lost 弹框）**
```javascript
// 轮询直到 Common.UI.warning 可用，然后包裹它屏蔽特定消息
(function suppressDialog() {
  var ui = window.Common && window.Common.UI;
  if (!ui || !ui.warning || ui.__dlgSuppressed) {
    setTimeout(suppressDialog, 200); return;
  }
  ui.__dlgSuppressed = true;
  var orig = ui.warning.bind(ui);
  ui.warning = function(opts) {
    if (opts && opts.msg && opts.msg.indexOf('Connection is lost') !== -1) return;
    return orig.apply(ui, arguments);
  };
})();
```

**问题**：有时弹框在 `Common.UI.warning` 可用前就出现（通过不同代码路径），导致偶尔抑制失败。

**3. LocalStartOpen（二进制注入）**
```javascript
LocalStartOpen: function() {
  if (window.__localStartOpenFired) return;  // guard：每字体脚本都触发
  window.__localStartOpenFired = true;
  // ... gwCheckInterval 尝试拦截 appReady（备用路径）
  setTimeout(function() { tryLoad(); }, 500);

  function tryLoad() {
    if (window.__localBinaryInjected) return false;
    var bin = window.parent.__pendingBinary;
    var editor = window.Asc && window.Asc.editor;
    if (!bin || !editor) return false;
    var copy = new Uint8Array(bin.byteLength);
    copy.set(bin);
    window.__localBinaryInjected = true;
    var savedDE = window.AscDesktopEditor;
    window.AscDesktopEditor = null;  // 关键：临时清除让 BRj 走原始路径
    try { editor.asc_openDocumentFromBytes(copy); }
    finally { window.AscDesktopEditor = savedDE; }
    window.parent.__localDocumentLoaded = true;
  }
},
```

---

## 关键陷阱汇总

| 陷阱 | 现象 | 原因 | 解决 |
|------|------|------|------|
| `Shc()` 忽略 binary 数据 | asc_openDocumentFromBytes 不加载文档 | Desktop 模式重写 Shc，检测到 AscDesktopEditor 就调 LocalStartOpen | 临时清除 AscDesktopEditor |
| LocalStartOpen 每字体脚本触发一次 | binary 被注入多次 | HTMLScriptElement.onload → Y7g → Shc → LocalStartOpen | guard：`__localStartOpenFired` |
| AllFonts.js 改为短文件名 | LocalStartOpen 不触发，初始化链路变 | SDK 字体脚本加载（触发 LocalStartOpen）vs XHR 加载是不同机制 | 保持原版 AllFonts.js（Windows 路径） |
| XHR 构造函数替换 | SDK 挂起或行为异常 | XMLHttpRequest 构造函数替换破坏了内部机制 | 改为 prototype.open patch |
| 未映射字体返回 404 | 文档挂起（hang） | SDK 对 404 等待，对 CORS 失败跳过 | 只重定向有映射的字体，其余保持 ascdesktop:// |
| fake socket.io 握手 | socket.io 无限重连 | 收到合法握手后 socket.io 认为能连，不断重试 | 简单 404，让 socket.io 自然超时 |
| Common.Gateway.appReady 不可写 | intercepted appReady 不生效 | return 对象属性赋值被忽略 | 已发现但 gwCheckInterval 方式实际能写入 |
| GetInstallPlugins 返回 '[]' | SDK 崩溃 | UpdateSystemPlugins 强制访问 a[0].url | 返回含 2 个 group 的 JSON |
| template 里的反斜杠 | 脚本语法错误 | 模板字符串转义，`\\` → `\` | 用 `String.fromCharCode(92)` |

---

## 当前状态（2026-05-31 最终）

### 已工作
- ✅ 文档成功加载（`test.docx - ONLYOFFICE` 标题出现）
- ✅ Canvas 1806×1298 有实际内容（darkPixels = 2500/2500）
- ✅ 21 个字体成功加载（70MB，LiberationSans + DejaVu + NotoSans CJK）
- ✅ `editor:onready` 触发，preloader 消失
- ✅ 无 "An error has occurred while opening the file" 错误
- ✅ XHR prototype patch 字体重定向工作正常

### 待优化
- ⏳ **CSS 骨架层不消失**：截图显示 gray bars，但底层 canvas 有内容。原因待查（可能是 `preloader:hide` CSS 动画还没结束，或 screenshot 工具无法捕获 canvas 内容）
- ⏳ **加载时间**：60-120 秒（socket.io 60s 超时 + 70MB 字体解析）
- ⏳ **Connection is lost 弹框**：偶尔在 Common.UI.warning 抑制就位前出现
- ⏳ **新建文档**：`empty_bin.ts` 是 7.5.0 格式，需用 9.3.0 x2t 重新生成

### 验证方法

```javascript
// 在浏览器控制台验证文档真实渲染：
const iframe = document.querySelector('iframe');
const canvases = Array.from(iframe.contentWindow.document.querySelectorAll('canvas'));
const main = canvases.find(c => c.width > 1000);
const ctx = main.getContext('2d');
const px = ctx.getImageData(230, 310, 50, 50).data;
const dark = Array.from(px).filter((v, i) => i % 4 < 3 && v < 100).length / 3;
console.log('Dark pixels:', dark, '/ 2500');  // 应该 > 0 表示有内容
```

---

## Canvas 渲染问题深度调查（2026-06-01）

### 问题现象

尽管文档 `docType=2`、标题变为 `"test.docx - ONLYOFFICE"`、21 个字体成功加载，canvas 始终全黑。`.doc-placeholder` CSS 骨架层不消失，说明 `asc_onDocumentContentReady` 未触发（或触发了但 `SetDrawingFreeze(false)` 未被调用）。

### 关键发现

**`onDocumentContentReady` 触发链路（pos 1736229 in app.js）：**
```javascript
me._isDocReady = true;
Common.NotificationCenter.trigger("app:ready", this.appOptions);  // 初始化所有 controller
me.api.SetDrawingFreeze(false);  // ← 这行开启 canvas 渲染
me.hidePreloader();              // ← 这行移除 doc-placeholder
```

**`asc_openDocumentFromBytes(BRj)` vs `asc_nativeOpenFile` 对比：**

| 路径 | docType | 字体 XHR | canvas | 触发渲染 |
|------|---------|---------|--------|---------|
| `asc_openDocumentFromBytes(BRj)` | 2 | 21 个加载 | 全黑 | ❌ |
| `asc_nativeOpenFile(docx)` | 2 | 0 | 全黑 | ❌ |

**`BRj` 路径的特点（server-mode 原始 Shc）：**
- 字体 XHR 请求会被触发（21 个字体通过 XHR patch 加载）
- `docType=2` 被设置
- 但 socket.io 服务端未能提供文档内容，rendering pipeline 不启动

**`asc_nativeOpenFile` 路径的特点：**
- 字体 XHR = 0（使用 native 字体加载路径，不走 XHR）
- `docType=2` 被设置
- `api.ta` 在 `CreateEditorApi` 时为 null，须在 `LocalStartOpen` 后调用
- 文档标题更新说明 OOXML 被处理，但 `asc_onDocumentContentReady` 未触发

**`editor:onready → appReady() → loadBinary` 链路：**
1. `editor:onready` execCommand → 我们调 `Common.Gateway.appReady()`
2. 父页面收到 `onAppReady` → 调 `openDocument(x2t_bin)`
3. `openDocumentFromBinary` postMessage → iframe `loadBinary(x2t_bin)`
4. `loadBinary` → `api.asc_openDocumentFromBytes(new Uint8Array(x2t_bin))`
5. 我们包裹的 `asc_openDocumentFromBytes`（自动清 AscDE）→ `BRj(x2t_bin)` 

字体加载（step 4 的 `BRj` 触发）发生在 30s 后，第二次 `loadBinary` 在 120s 后（socket.io 超时后）。但两次 `BRj` 调用后 canvas 仍黑。

### 根本假设

`BRj`（server-mode Shc）的文档内容来自 **socket.io 服务端**，不来自本地 binary。Binary 只是设置加载上下文（文件名、文档 ID），实际页面内容由服务端推送。没有服务端 → 有加载上下文、有字体 → 但无内容 → canvas 黑色。

### 实测结果（2026-06-01）

**`editor:onready` 时调用 `asc_nativeOpenFile(docx)`：**

| 观察 | 结果 |
|------|------|
| `docType` | 2（设置成功）|
| `title` | test.docx - ONLYOFFICE（更新）|
| `title:button {"disabled":{}}` | 出现（`app:ready` 触发！）|
| `asc_onDocumentContentReady` | 从未触发 |
| `SetDrawingFreeze(false)` | 手动调后才触发 |
| `WordControl` | 始终 `false` |
| canvas 内容 | 全黑 (rgb 0,0,0) |

**`_isDocReady` 陷阱：**
`onDocumentContentReady` 被 guard `if (!this._isDocReady)` 保护。第一次 `BRj` 调用时 `_isDocReady` 被设为 `true`，此后所有调用（包括 `asc_nativeOpenFile` 后的调用）都是 no-op。即使手动重置 `_isDocReady = false`，`SetDrawingFreeze(false)` 被调用，canvas 仍然全黑。

**`WordControl` 从未创建的根本原因：**
- `asc_nativeOpenFile(original_docx)` → `T_f(docx)` → OOXML path
- `asc_nativeOpenFile(x2t_binary)` → `wKa.wt(binary)` → word binary path
- 两条路都调用成功（返回 `docType=2`），但 `WordControl` 始终为 `false`
- 说明文档内容加载处于某种挂起状态，渲染引擎未初始化

**`title:button {"disabled":{}}` 出现的意义：**
这是 `app:ready` 触发的信号，说明 app.js 认为文档已就绪（toolbar 已启用）。但 `WordControl` 的缺失意味着 SDK 内部的渲染引擎从未为这个文档实例建立连接。

### 渲染引擎深度调查（2026-06-01）

**`ta.Ec.Ms` 是渲染的关键守门员：**

`M_f()` 条件：`if (!ta.Bf.jEa || !ta.Ec.Ms)` → 任意一个为假就进入错误路径。
当前状态：`ta.Bf.jEa=true, ta.Ec.Ms=false` → M_f 进入错误路径 → 渲染无法启动。

**`Ec.Ms` 在哪里设置：**
- SDK 内部 `d.prototype.qYg`：`this.ta.Ec.Ms = new AscCommon.Xxh(this.rBd, this)` 
- `window.Asc.editor.asc_nativeOpenFile` 调 `jre()` 而非 `qYg()` → **永远不设置 Ec.Ms**
- `d` 类的 `asc_nativeOpenFile` 调 `qYg()` → 设置 Ec.Ms

**`Xxh`（Word Control）是渲染视图：**
- `Xxh` 创建成功：`new AscCommon.Xxh(editor.rBd, editor)` ✅
- 手动设置 `ta.Ec.Ms = Xxh实例` → `EcMs=true` ✅
- 但 canvas 仍黑 → `Xxh` 需要更多初始化

**正确的文档加载流程：**
- `asc_nativeOpenFile(docx)` → `jre()` → `ta.Ga = new e2(ta.Ec)` → `T_f(docx)` → `ta.Ga.aa.length=3` ✅
- 但 `ta.Ec.Ms` 从未被设置 ❌

**下一步最有希望的方向：**

**实现最小化 socket.io 协议服务端**

9.3.0 的 server-mode 完整支持：
1. 连接建立后 SDK 设置 `Ec.Ms` 等完整渲染上下文
2. 服务端发送文档数据 → SDK 渲染

实现一个返回正确 OnlyOffice 协议的本地 socket.io 服务，能绕过所有 Desktop mode 限制。

OnlyOffice Document Server 是开源的（https://github.com/ONLYOFFICE/server）。
协议关键：连接建立后服务端发送 `{"type":"authChanges","changes":[],...}` 和文档数据。

---

## 文件变更清单（当前 upgrade/onlyoffice-9.3.0 分支）

```
public/web-apps/apps/api/documents/api.js
  - ver = ''（去掉版本哈希前缀）
  - _config.parentOrigin = "file://"（激活 Desktop 文档路由）

public/sdkjs/common/AllFonts.js
  - 7.5.0 原版（Windows 字体路径，触发字体脚本加载链路 → LocalStartOpen）
  - 注意：改为我们的字体路径会破坏初始化顺序

lib/onlyoffice-editor.ts
  - 存储 binData 到 window.__pendingBinary
  - onAppReady 时检查 __localDocumentLoaded，跳过重复 openDocument
  - parentOrigin: 'file://' 加入 DocEditor config（冗余但保留）

lib/document-converter.ts
  - absolutePath = new URL(SCRIPT_PATH, window.location.href).href
  （新版 x2t.js 要求绝对 URL）

vite.config.ts
  - onlyofficeVersionRewrite：socket.io /doc/ 返回 404
  - onlyofficeDesktopMock：
    * XHR prototype patch（字体重定向，含 50+ Windows→开源字体映射）
    * suppressDialog（Common.UI.warning 拦截）
    * CreateEditorApi（存 api，注册 disconnect no-op）
    * SetDocumentName, GetInstallPlugins（2 groups）
    * LocalStartOpen（binary 注入，guard 防重复，临时清除 AscDesktopEditor）
    * execCommand handler（title:button / editor:onready 信号）

types/editor.d.ts
  - 添加 openDocument? 方法声明
```
