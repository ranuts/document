# OnlyOffice 7.5 vs 9.3.0 离线能力对比分析

**日期：** 2026-06-07  
**分支：** `upgrade/onlyoffice-9.3.0`  
**关联文档：** [2026-05-31-onlyoffice-desktop-mode-mock.md](./2026-05-31-onlyoffice-desktop-mode-mock.md)

---

## 背景

[Desktop Mode Mock 探索](./2026-05-31-onlyoffice-desktop-mode-mock.md) 已确认：mock `AscDesktopEditor` 的方案遇到架构瓶颈——`ta.Ec.Ms`（渲染守门员）无法通过现有路径设置，canvas 始终黑色。

本文从另一个角度入手：**对比 7.5（能离线）和 9.3.0（不能离线）的源码差异，找出根本原因，并规划适用于 9.3.0 的可行方案。**

---

## 核心发现：`onEndLoadFile` 的消失

### 7.5 的工作原理

**文件结构：**
- `sdk-all-min.js`：完整 SDK，含文档 API（62 个公开方法）
- `app.js`：465 行，自包含的应用逻辑
- `code.js`：**不存在**

**文档加载路径（完全离线）：**

```
父页面 onAppReady
  → sendCommand({ command: 'asc_openDocument', data: { buf: binData } })
  → app.js Gateway 处理：
      openDocument: function(t) {
        this.api.asc_setLocalRestrictions(t.localRestrintions || 0);
        this.api.onEndLoadFile({ bSerFormat: true, data: t.buf });
      }
  → sdk-all-min.js 中 Q6b() 直接解析 binary → 触发渲染
```

`onEndLoadFile` 在 7.5 的 `sdk-all-min.js` 中公开暴露：`p.onEndLoadFile = p.Q6b`。

**`Q6b` 的工作逻辑（反编译）：**
```javascript
// 检查前置条件（字体已加载、视图已初始化等）
if (this.$ha && this.Xl && this.V6b && this.LZf()) {
  let s = AscCommon.Mwg(this.V6b.data);  // 格式检测（docx/xlsx/pptx...）
  let c = Asc.jqe.indexOf(this.JTa) !== -1;
  if ((!!c || this.cn !== s) && (!c || s !== null)) {
    // 根据格式分发到对应处理器，直接渲染
  }
}
```

**不需要服务器、不需要 socket.io、不需要 Desktop 桥。**

---

### 9.3.0 的架构变化

**文件结构：**
- `sdk-all-min.js`：仅渲染引擎（FreeType/HarfBuzz，38 个公开方法，全是字体/Canvas 底层接口）
- `app.js`：1325 行（含 jQuery 3.7.1 + 完整 AMD 应用逻辑）
- `code.js`：1201 KB，81 个 AMD 模块（UI 组件、控制器、视图）

**架构对比：**

| 维度 | 7.5 | 9.3.0 |
|------|-----|-------|
| `sdk-all-min.js` 公开方法数 | 62（含高层文档 API） | 38（仅底层渲染原语） |
| `onEndLoadFile` | ✅ `p.onEndLoadFile = p.Q6b` | ❌ 完全移除 |
| `code.js` | 不存在 | 存在（应用层，81 个 AMD 模块） |
| socket.io 依赖 | 可选（仅协同编辑） | **SDK shim 强制依赖** |
| 文档加载路径 | `onEndLoadFile` 直接处理 | `Shc()` → Desktop 桥 或 server-mode（BRj） |

**9.3.0 的 AMD 配置（在 `app.js` 中）：**
```javascript
paths: {
  socketio: "../vendor/socketio/socket.io.min",
  sdk: "../../sdkjs/word/sdk-all-min",
  // ...
},
shim: {
  sdk: { deps: ["jquery", "allfonts", "xregexp", "socketio"] }
}
```

`sdk-all-min.js` 的 shim 依赖包含 `socketio`——SDK 初始化时 socket.io 客户端库必须已加载。

---

## `Ec.Ms` 设置路径深度分析

`ta.Ec.Ms`（Word Control，渲染视图）是 9.3.0 渲染的唯一守门员：

```javascript
// M_f() 渲染条件（sdk-all.js 中）
if (!ta.Bf.jEa || !ta.Ec.Ms) → 进入错误路径，渲染不启动
```

### 全局唯一赋值点

在整个 `sdk-all-min.js`（9.3.0）中，`Ec.Ms` 仅被赋值一次：

```javascript
// d.prototype.qYg（PDF/Viewer 渲染类）
d.prototype.qYg = function() {
  if (this.kf) {
    this.kf.close();
  } else {
    var h = new AscCommon.Xxh(this.rBd, this);  // 创建 Word Control
    // ... 注册 onNeedPassword、onStructure 等回调
    this.kf = h;
    this.ta.Ec.Ms = h;   // ← 全局唯一赋值
    this.EAb.tf(this);
  }
};
```

### 两个类的 `asc_nativeOpenFile` 对比

```javascript
// asc_docs_api.prototype.asc_nativeOpenFile（Word 编辑器公开 API）
a.asc_docs_api.prototype.asc_nativeOpenFile = function(N, ba) {
  this.ta.Tm();
  this.jre();         // ← 只创建文档模型，不设置 Ec.Ms
  this.DocumentType = 2;
  // ...
};

// d.prototype.asc_nativeOpenFile（另一个内部类）
d.prototype.asc_nativeOpenFile = function(h, g) {
  this.ta.Tm();
  this.qYg();         // ← 调用 qYg，设置 Ec.Ms
  this.DocumentType = 2;
  g.file = a.AscViewer.vQe(h);
  g.nlg();
  // ...
};
```

`g.prototype.jre()` 的实现：
```javascript
g.prototype.jre = function() {
  this.ta.Ga = new AscCommonWord.e2(this.ta.Ec);  // 文档模型（数据层）
  this.ta.Ec.Ga = this.ta.Ga;
  // ... 不设置 Ec.Ms（渲染层）
};
```

### `Shc()` 的 Desktop 路径（关键上下文）

```javascript
// sdk-all.js（位于 onEndLoadFile 等价函数处）
AscCommon.r3.prototype.Shc = function(d) {
  if (this.MOa() || !a.AscDesktopEditor) {
    return this.BRj(d);  // server-mode：socket.io 路径
  }
  // Desktop 路径：
  this.tma && this.Qk && this.Gig() && (
    this.b_("asc_onDocumentContentReady", function() {
      Z$(Asc.editor || editor);              // 文档就绪回调
      setTimeout(function() { a.UpdateInstallPlugins(); }, 10);
    }),
    AscCommon.History.C0a = true,
    a.AscDesktopEditor.LocalStartOpen()     // 触发 native 文件打开
  );
};
```

在真实 Desktop 应用中，`LocalStartOpen()` 是 C++ native 方法，它完成文件打开后回调 JS，最终触发 `qYg()` 设置 `Ec.Ms`。我们的 JS mock 无法复现这个 native 调用链。

---

## `window.io` 拦截点：GitHub Pages 可行的核心机制

### 关键发现

`sdk-all-min.js` 中有一个显式的 `io()` 查找函数：

```javascript
a.AscCommon.jxj = function() {
  return "function" === typeof a.io ? a.io : require("socketio");
};
```

SDK 在建立 socket.io 连接时（`UGi` 函数）调用：
```javascript
x = k.jxj()(options);   // 等价于 window.io(options)
x.on("connect", function() { ... });
x.on("disconnect", function() { ... });
```

**只要在 SDK 运行前设置 `window.io = mockFn`，SDK 就会使用这个 mock，完全不发起网络请求。** 这是纯客户端 JavaScript，不需要任何服务端，在 GitHub Pages 上完全可行。

### 连接后的最小消息序列

从 `$Hi`（connect 回调）和 `GHi`（auth 消息处理器）逆向出的协议：

```
客户端 → mock socket: socket.emit("message", {type:"auth", docid, documentCallbackUrl, token, user, ...})

mock socket → 客户端 emit("message"):
  1. {type: "authChanges", changes: []}   ← 空历史（新文档），客户端回复 authChangesAck
  2. {type: "auth", result: 1, sessionId: "mock", indexUser: 0,
      participants: [], messages: [], changes: []}
     → 触发 IKc() → 触发 qYg() → Ec.Ms 设置 ✅
  3. {type: "documentOpen", messages: [...]}  或 auth.messages 中携带文档内容
     → 触发 Gld() → 文档渲染启动 ✅
```

`auth.result === 1` 是触发渲染初始化的关键字段。

---

## 三条可行路径

### 路径一（推荐）：`window.io` mock + 两层实现

**核心思路：** 用一个纯 JS 的假 socket 替代真实 socket.io 连接，在内存中完成整个 OnlyOffice 协议交互。

**为什么比 Vite 服务端插件更好：**

| 方案 | dev | GitHub Pages | 复杂度 |
|------|-----|-------------|-------|
| Vite 服务端插件（HTTP 拦截） | ✅ | ❌ 静态托管无服务端 | 中 |
| `window.io` mock（JS 拦截） | ✅ | ✅ 纯客户端 | 低 |
| Service Worker（HTTP 拦截） | ✅ | ✅ SW 可拦截 fetch | 高（WebSocket 无法拦截） |

**实现位置：** `vite.config.ts` 的 `onlyofficeDesktopMock` Vite 插件中注入到编辑器 `index.html` 的脚本，与现有 `suppressDialog`、`LocalStartOpen` 等逻辑并列。

**mock io 骨架：**
```javascript
window.io = function(options) {
  var listeners = {};
  var socket = {
    on: function(event, fn) { listeners[event] = fn; return socket; },
    emit: function(event, data) {
      if (event === 'message' && data && data.type === 'auth') {
        // 客户端发来 auth 请求，启动 mock 响应序列
        _startMockSession(data);
      }
    },
    disconnect: function() {}
  };

  function _startMockSession(authReq) {
    // 1. 发送空的 authChanges（无历史）
    setTimeout(function() {
      listeners['message'] && listeners['message']({type: 'authChanges', changes: []});
    }, 10);
    // 2. 发送 auth 成功 → 触发 IKc() → qYg() → Ec.Ms 设置
    setTimeout(function() {
      listeners['message'] && listeners['message']({
        type: 'auth',
        result: 1,
        sessionId: 'offline-mock',
        indexUser: 0,
        participants: [],
        messages: [],
        changes: []
      });
    }, 20);
    // 3. 发送 documentOpen + 文档二进制（格式待验证）
    setTimeout(function() {
      var bin = window.parent && window.parent.__pendingBinary;
      if (bin) {
        listeners['message'] && listeners['message']({
          type: 'documentOpen',
          messages: [ /* 文档内容，格式待逆向 */ ]
        });
      }
    }, 100);
  }

  // 立即触发 connect
  setTimeout(function() {
    listeners['connect'] && listeners['connect']();
  }, 0);

  return socket;
};
```

### 完整协议（已逆向确认）

通过逆向 `sdk-all-min.js` 中的消息分发函数，完整的五步握手序列如下：

```
Step 1: socket "connect" 触发
        → $Hi() → Jld() → Cm.Jld() → OHc=false → cHe() → 无动作

Step 2: Mock 发送 {type:"license", license:{type:3}}
        → UHi() → Lld(license) → Cm.Lld → OHc=true → cHe()
        → cHe 触发客户端发送: emit("message", {type:"auth", docid, token, user, ...})

Step 3: Mock 回复 {type:"auth", result:1, sessionId:"offline", indexUser:0,
                   participants:[], messages:[], changes:[], locks:{}}
        → GHi() → IKc() → Cm.IKc → Aqg() → I0c=true（session 完全初始化）

Step 4: Mock 发送 {type:"documentOpen", data:{
                    type:"open", status:"ok", openedAt:null,
                    data:{"origin.docx": blobUrl}   ← x2t binary 的 Blob URL
                  }}
        → oFi() → Gld() → Cm.Gld() → djg(blobUrl)
        → AscCommon.jSj 下载 binary → Shc(binary) → BRj(binary)
        → 渲染管道启动 → Ec.Ms 设置 → canvas 渲染 ✅

Step 5: BRj 完成 → asc_onDocumentContentReady 触发 → appReady() 通知父页面
```

**关键细节：**
- `license.type = 3` 是 Developer License，无文档限制
- `origin.docx` 的值是 `URL.createObjectURL(new Blob([binaryData]))`（x2t 转换结果）
- `socket.io`（Manager）需暴露 `reconnectionAttempts`/`reconnectionDelay`/`kfh`/`Dfh`（空实现即可）
- `socket.auth` 需是对象 `{token: null, session: null}`（SDK 会直接赋值）
- `origin.docx` 键名可以替换为 `origin.xlsx` / `origin.pptx`，对应不同文档类型

### 完整 mock 实现

注入到 `vite.config.ts` 的 `onlyofficeDesktopMock` 脚本中（同样适用于 GitHub Pages 静态文件）：

```javascript
(function injectOfflineSocketMock() {
  // SDK 通过 AscCommon.jxj() 查找 window.io，在此拦截
  window.io = function(options) {
    var cbs = {};
    var socket = {
      on: function(ev, fn) { cbs[ev] = fn; return socket; },
      disconnect: function() {},
      auth: options.auth || {},       // SDK 会直接赋值 token/session
      io: {                           // Manager 接口（空实现）
        reconnectionAttempts: function() {},
        reconnectionDelay: function() {},
        reconnectionDelayMax: function() {},
        kfh: function() {},           // token 刷新
        Dfh: function() {}            // session 刷新
      }
    };

    function send(msg) {
      setTimeout(function() { cbs['message'] && cbs['message'](msg); }, 0);
    }

    socket.emit = function(ev, data) {
      if (ev !== 'message' || !data) return;
      if (data.type === 'auth') {
        // Step 3: 客户端发来 auth 请求，回复成功
        send({ type: 'auth', result: 1, sessionId: 'offline',
               indexUser: 0, participants: [], messages: [], changes: [], locks: {} });
        // Step 4: 发送文档内容（延迟确保 auth 先处理完）
        setTimeout(function() {
          var bin = window.parent && window.parent.__pendingBinary;
          if (!bin) return;
          var url = URL.createObjectURL(new Blob([bin]));
          var ext = (window.__pendingExt || 'docx').toLowerCase();
          var fileData = {};
          fileData['origin.' + ext] = url;
          send({ type: 'documentOpen', data: {
            type: 'open', status: 'ok', openedAt: null, data: fileData
          }});
        }, 50);
      }
      // authChangesAck 等其他消息正常忽略
    };

    // Step 1+2: connect → 发 license
    setTimeout(function() {
      cbs['connect'] && cbs['connect']();
      setTimeout(function() {
        send({ type: 'license', license: { type: 3 } });
      }, 20);
    }, 0);

    return socket;
  };
})();
```

**预期收益：**
- 彻底消除 socket.io 网络请求和 60-120s 超时
- `Ec.Ms` 正确初始化（通过 `BRj` 在完整 session 上下文中调用）
- "Connection is lost" 弹框自然消失
- GitHub Pages 与 dev 行为完全一致
- 加载时间从 120s 降至 ~5s（字体加载时间）

---

### 路径二（低成本验证）：直接调用 `qYg()` + 补全 `Xxh` 初始化

**原理：** `d.prototype.qYg()` 是可以创建 `Xxh` 并设置 `Ec.Ms` 的函数，尝试在正确时机直接调用它。

**快速验证（浏览器控制台）：**
```javascript
// 在编辑器 iframe 内执行
const editor = window.Asc.editor;
// 找到 d 类实例（如果存在）
// 或者直接找 qYg 方法的宿主
const keys = Object.keys(Object.getPrototypeOf(editor.__proto__));
console.log(keys.filter(k => k.length <= 4));
// 然后尝试：editor.qYg?.()
```

**已知障碍（来自 Desktop Mode Mock 探索）：**
- 手动 `new AscCommon.Xxh(editor.rBd, editor)` + 设置 `ta.Ec.Ms` → `EcMs=true`，但 canvas 仍黑
- `Xxh` 需要完整的初始化序列（`rBd` 等参数的上下文必须正确）

**验证方向：** 查看 `sdk-all.js` 中 `AscCommon.Xxh = e`（位于偏移 7090676）之后的构造器定义，确认 `Xxh` 初始化需要哪些参数，以及在调用 `qYg()` 时 `this` 的状态需要满足什么条件。

---

### 路径三（备用）：定位 9.3.0 中 `Q6b` 的等价函数

**原理：** 7.5 的 `Q6b`（`onEndLoadFile`）核心是 `AscCommon.Mwg(buf)` 格式检测 + 分发渲染。检查 9.3.0 是否仍然保留了类似的内部函数，只是未暴露为公开 API。

**检验步骤：**
```javascript
// 在编辑器 iframe 内检查
typeof AscCommon.Mwg  // 如果存在，说明格式检测机制保留
```

如果 `AscCommon.Mwg` 存在，进一步在 `sdk-all-min.js` 中搜索调用它的函数，找到 9.3.0 版的 `Q6b` 等价实现，尝试直接调用。

**风险：** 即使函数存在，其依赖的内部状态（`this.$ha`、`this.Xl` 等前置条件）在 9.3.0 可能已经改变。

---

## 建议实施顺序

### Step 1：验证拦截点（15 分钟）

在编辑器 iframe 控制台注入最小 mock，确认 SDK 调用 `window.io`：

```javascript
window.io = function(options) {
  console.log('[MOCK] io() called, path:', options.path);
  return {
    on: function(ev, fn) { return this; },
    emit: function() {},
    disconnect: function() {},
    auth: options.auth || {},
    io: { reconnectionAttempts(){}, reconnectionDelay(){},
          reconnectionDelayMax(){}, kfh(){}, Dfh(){} }
  };
};
```

预期：控制台出现 `[MOCK] io() called, path: ...doc/.../c`，同时不再出现 socket.io 60s 超时。

### Step 2：注入完整 mock，验证 Session 初始化（半天）

将"完整 mock 实现"中的代码注入到 `vite.config.ts` 的 `onlyofficeDesktopMock` 脚本里。

先验证 Step 3（auth 成功）是否触发 session 初始化：

```javascript
// 在 iframe 控制台监听
var origAqg = window.Asc?.editor?.Aqg?.bind(window.Asc.editor);
if (origAqg) window.Asc.editor.Aqg = function(r) {
  console.log('[MOCK] Aqg called (session init)', r);
  return origAqg(r);
};
```

预期：`Aqg called` 出现后，`window.Asc.editor.I0c === true`。

### Step 3：验证文档渲染（半天）

在 mock 中增加 `documentOpen` 消息（Step 4），注入 `window.__pendingBinary`（x2t 转换结果的 Blob URL）。

验证命令（canvas 内容检查）：

```javascript
const canvases = Array.from(document.querySelectorAll('canvas'));
const main = canvases.find(c => c.width > 1000);
const ctx = main?.getContext('2d');
const px = ctx?.getImageData(200, 200, 50, 50).data;
const dark = px ? Array.from(px).filter((v,i) => i%4<3 && v<100).length/3 : 0;
console.log('Dark pixels:', dark, '/ 2500');  // > 0 表示有内容
```

### Step 4：GitHub Pages 验证（1 小时）

将 `window.io` mock 提取为独立脚本 `public/web-apps/apps/documenteditor/main/offline-mock.js`，在编辑器 `index.html` 中 `<script>` 直接引入（放在 `require.js` 之前），确认 GitHub Pages 静态部署下行为与 dev 一致。

---

---

## 参考项目：electroluxcode/mvp-onlyoffice

**仓库：** https://github.com/electroluxcode/mvp-onlyoffice  
**Stars：** 153，最后更新 2026-06-04  
**定位：** 与本项目高度相似——同样是纯浏览器端、无服务端的 OnlyOffice 文档编辑方案。

### 版本情况

```
public/packages/onlyoffice/
  7/    ← 正在使用（const.ts 指向 v7）
  9/    ← 目录存在，但 readme.md 为 0 字节
```

**结论：他们也还没解决 v9 离线问题**，`v9/readme.md` 是空的，说明和我们一样在探索阶段。v9 目录可能是占位或早期实验，实际功能仍依赖 v7。

### 文档加载方式（v7）

与本项目 7.5 完全一致——`onAppReady` 后用 `asc_openDocument` 命令传入 binary：

```typescript
// x2t.ts createEditorInstance()
events: {
  onAppReady: () => {
    editor.sendCommand({
      command: 'asc_openDocument',
      data: { buf: binData },
    });
  },
}
```

### 值得借鉴的实现

**1. IndexedDB 缓存 WASM 文件**

`x2t.ts` 中拦截 `fetch`，将 `x2t.wasm` 缓存进 IndexedDB，下次直接读取，避免重复下载（x2t.wasm ~10MB）：

```typescript
// 拦截 fetch，命中缓存直接返回，否则下载后存入 IndexedDB
const cached = await this.getCachedWasm(url);
if (cached) {
  return new Response(cached, { headers: { 'Content-Type': 'application/wasm' } });
}
// 未命中 → 下载 → 存入 IndexedDB
```

**2. gzip 压缩 WASM**

`x2t.wasm` 以 `.wasm.gz` 形式存储，fetch 时自动解压：

```typescript
// const.ts
ONLYOFFICE_CACHE_FILE: [{
  url: 'wasm/x2t/x2t.wasm',
  event: (url) => ({
    fetchUrl: url.replace('x2t.wasm', 'x2t.wasm.gz'),
    isCompressed: true,
    compressionType: 'gzip',
  }),
}]
```

本项目的 `x2t.wasm` 当前直接静态伺服，可参考此方案减少约 60% 传输体积。

**3. EditorManagerFactory 多实例模式**

用工厂模式 + `nanoid` 实例 ID 管理多个并发编辑器，每个实例有独立的 `instanceId`、`containerId`、媒体映射，保存事件通过 `instanceId` 过滤，避免多实例互相干扰：

```typescript
// 多实例场景
const mgr1 = editorManagerFactory.create('container-1');
const mgr2 = editorManagerFactory.create('container-2');
// 保存事件过滤
if (data.instanceId === currentInstanceId) { resolve(data); }
```

**4. Proxy 包装 DocEditor**

用 `Proxy` 包装编辑器实例，统一处理销毁和命令发送，防止外部直接操作裸编辑器对象。

### 与本项目的差异

| 维度 | mvp-onlyoffice | 本项目 |
|------|---------------|-------|
| 框架 | Next.js 15 + React 19 | 纯 TypeScript + Vite |
| OnlyOffice 版本 | v7（v9 未实现） | v7.5（当前），v9.3 探索中 |
| WASM 缓存 | IndexedDB + gzip | 无（每次重新下载） |
| 多实例 | EditorManagerFactory | 单实例队列 |
| 部署目标 | Vercel / Next.js server | GitHub Pages（纯静态） |
| v9 离线方案 | ❌ 未实现 | 本文档正在探索 |

### 核心价值

确认了一件事：**v9 离线方案在社区中尚无公开实现**，本文档的探索方向（`window.io` mock）是当前已知最有可能成功的路径。

---

## 与升级计划的关系

本文的分析同样适用于 9.4.0 及更新版本——只要 OnlyOffice 保持 server-first 架构，`Ec.Ms` 初始化路径的问题就会持续存在。

建议在实施路径一时，直接针对目标版本（9.4.0）进行，避免在 9.3.0 上完成后再重做。

参见 [CLAUDE.md 中的版本升级分析](../../CLAUDE.md#onlyoffice-web-apps-版本升级750--940)。
