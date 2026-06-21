# SDK Shc/Mrc/K8b Web路径修复：DOCX/XLSX/PPTX 文档内容空白根因

**日期：** 2026-06-21  
**分支：** `explore/path-d-desktop-mock`  
**提交：** `00f01d4`  
**影响文件：** `src/lib/onlyoffice-editor.ts`、`vite.config.ts`

---

## 一、问题现象

修复完 `execCommand` / `CreateEditorApi` crash 之后（commit e619fd0），编辑器工具栏可以正常渲染：

- Word 编辑器：File/Home/Insert/Draw/Layout/References 全部可见
- Cell 编辑器：Formula/Data 等 Tab 全部可见
- Slide 编辑器：Transitions/Animation 等 Tab 全部可见

但文档内容区域始终为空——DOCX 显示空白 canvas，XLSX 显示空表格，PPTX 停在 "Loading presentation" toast 无法消失。控制台中：

```
[OO] asc_openDocumentFromBytes 35183 bytes
```

字节数正确，但从未出现 `Document loaded: xxx`，canvas 像素全为零。

---

## 二、根因分析

### 2.1 调用链

`api.asc_openDocumentFromBytes(bytes)` → SDK 内部 `r1i(bytes)`:

```javascript
// Word SDK r1i（asc_openDocumentFromBytes 的真实实现）
function(r) {
  var t = new AscCommon.WYc;
  t.data = r;
  t.PQb = AscCommon.a9c(t.data, AscCommon.SHa.xH);  // 检测是否为 DOCY 格式
  this.Shc(t)  // 调用文档加载门控函数
}
```

`Shc` 是真正决定如何处理字节的函数。

### 2.2 Shc 的条件分支

```javascript
function(d) {
  // Web 路径：浏览器原生 WASM 加载
  if (this.MOa() || !a.AscDesktopEditor) return this.BRj(d);

  // Desktop 路径：由 C++ 宿主读取文件
  this.tma && this.Qk && this.Gig() && (
    this.b_("asc_onDocumentContentReady", function() {
      Z$(Asc.editor || editor);
      setTimeout(function() { a.UpdateInstallPlugins() }, 10)
    }),
    AscCommon.History.C0a = !0,
    a.AscDesktopEditor.LocalStartOpen()   // ← 调用 C++ 宿主读取文件
  )
}
```

**关键条件：`!a.AscDesktopEditor`**

我们的 polyfill 在 iframe 的 `<head>` 里注入了 `window.AscDesktopEditor`，使其始终为 truthy。因此：

- `!a.AscDesktopEditor` = `false`
- `MOa()` 也返回 `false`（非 Web Mode）

→ 走 Desktop 分支 → 调用 `LocalStartOpen()`（我们的 noop stub）→ **字节 `d` 被彻底丢弃**

### 2.3 三种 SDK 的函数名对照

| 作用 | Word SDK | Cell SDK | Slide SDK |
|------|----------|----------|-----------|
| 门控函数（Shc 等价） | `Shc` | `Mrc` | `K8b` |
| Web 路径处理（BRj 等价） | `BRj` | `rxk` | `Fzj` |
| 事件注册（b_ 等价） | `b_` | `tW` | `aN` |
| History flag | `C0a` | `J6a` | `$cb` |
| WASM 就绪标志 | `tma` | `yUa` | `Fda` |
| 权限对象 | `Qk` | `zj` | `ml` |
| 字体就绪函数 | `Gig` | `FCg` | `l7f` |
| 文档缓冲区 | `KXb` | `U4b` | `GNb` |

### 2.4 BRj（Web 路径）的实际行为

`BRj(WYc)` / `rxk(WYc)` / `Fzj(WYc)` 是真正的 WASM 文档加载入口：

```javascript
// BRj（Word SDK）
function(r) {
  r && (this.KXb = r);  // 存储文档缓冲区
  if (this.tma && this.Qk && this.KXb && this.Gig()) {
    // 格式检测
    r = AscCommon.ysj(this.KXb.data);  // 检测字节格式
    if (this.Fm === r) {               // 匹配编辑器类型
      this.Aqb(this.KXb);             // ← 真正开始 WASM 渲染！
      this.bc("asc_onDocumentPassword", "" !== this.Fta);
      this.KXb = null;
    }
  }
}
```

`Aqb(WYc)` 检测字节是否为 OOXML（ZIP 格式）：

```javascript
// Aqb（Word SDK）
function(N) {
  N.PQb ? this.ove(N.url, N.data)
        : (this.OOa = this.asc_isSupportFeature("ooxml") && AscCommon.cac(N.data))
          ? (this.xof = N.data, this.S_f(N.data))  // ← 直接以 OOXML 格式打开！
          : this.nve(N.url, N.data);
}
```

- `PQb = false`（raw DOCX bytes 不是 DOCY 格式）
- `cac(data)` 检测 ZIP magic bytes → `true`（DOCX/XLSX/PPTX 都是 ZIP）
- 走 `S_f(data)` 路径 → 直接以 OOXML 格式加载，**无需 x2t 转换**

---

## 三、修复方案

在 `onAppReady` 里，于调用 `asc_openDocumentFromBytes` 之前，patch 三种 SDK 的门控函数，强制走 BRj 路径：

```typescript
// src/lib/onlyoffice-editor.ts — onAppReady 内部
const patchWebPath = (shcName: string, brjName: string, historyFlag: string, contentReadyCb: string) => {
  const a = api as any;
  if (typeof a[shcName] !== 'function' || typeof a[brjName] !== 'function') return;
  a[shcName] = function (d: unknown) {
    if (d) {
      try {
        // 注册 Desktop 路径本来会注册的 content-ready 回调
        a[contentReadyCb]?.('asc_onDocumentContentReady', function () {
          const w = iwin;
          if (w?.Z$) w.Z$(w.Asc?.editor || w.editor);
          if (w?.X$) w.X$(w.Asc?.editor || w.editor);
          setTimeout(function () { if (w?.UpdateInstallPlugins) w.UpdateInstallPlugins(); }, 10);
        });
        if (iwin?.AscCommon?.History) (iwin.AscCommon.History as any)[historyFlag] = true;
      } catch (_e) {}
    }
    return a[brjName](d);  // 直接调用 Web 路径
  };
};

patchWebPath('Shc', 'BRj', 'C0a', 'b_');   // Word SDK
patchWebPath('Mrc', 'rxk', 'J6a', 'tW');   // Cell SDK
patchWebPath('K8b', 'Fzj', '$cb', 'aN');   // Slide SDK

api.asc_openDocumentFromBytes(ooxmlBytes);
```

**为什么不 restore patch（不恢复原函数）：**

- `BRj(null)` / `rxk(null)` / `Fzj(null)` 当 `KXb/U4b/GNb=null` 时是安全的 noop
- 当 WASM 初始化晚于 `asc_openDocumentFromBytes` 时（如 XLSX 慢启动），字节会被存进缓冲区，WASM 就绪后 SDK 内部会再次触发门控函数（`Shc(null)`），此时需要 patch 仍然有效才能走 `BRj(null)` → 检查缓冲区 → 处理

---

## 四、同期修复：polyfill 同步返回值 stub（vite.config.ts）

之前几个 stub 写成了回调风格，但 SDK 同步读取返回值：

| 方法 | 旧写法（错误） | 新写法（正确） | SDK 调用方式 |
|------|--------------|--------------|-------------|
| `GetEncryptedHeader` | `cb('')` | `return 'ENCRYPTED;'` | `this.EBc = GetEncryptedHeader(); this.CQe = this.EBc.length` |
| `GetDefaultCertificate` | `cb(null)` | `return null` | 直接使用返回值 |
| `GetImageOriginalSize` | `cb(0, 0)` | `return { W: 0, H: 0 }` | `V = GetImageOriginalSize(); 0 != V.W && 0 != V.H` |
| `GetImageBase64` | `cb('')` | `return ''` | 直接使用返回值 |
| `GetInstallPlugins` | `noopArr`（返回 `[]`） | `return '[{"url":"","pluginsData":[]},{"url":"","pluginsData":[]}]'` | `JSON.parse(GetInstallPlugins())[0].url` |

其中 `GetInstallPlugins` 最危险：原来返回 JS 数组 `[]`，SDK 对其执行 `JSON.parse([])` → `JSON.parse("")` → `SyntaxError`，导致 "An error has occurred while opening the file" 弹窗。

---

## 五、效果验证

| 文件类型 | 修复前 | 修复后 |
|---------|--------|--------|
| DOCX（test-resume.docx, 35KB） | 工具栏可见，canvas 全白 | ✅ 中文简历内容完整渲染 |
| XLSX（test-work.xlsx, 211KB） | 工具栏可见，"Loading spreadsheet" 永不消失 | ✅ 表格数据（百度、后端、算法等）完整显示 |
| PPTX（test-pptx.pptx, 4.8MB） | 工具栏可见，"Loading presentation" 永不消失 | ✅ 新东方幻灯片（绿色主题、中文标题、角色插图）完整渲染 |

---

## 六、架构影响

这是整个 OnlyOffice Desktop 适配方案的核心原理修复：

```
之前的状态（错误）：
  asc_openDocumentFromBytes(bytes)
    → SDK 内部 r1i(bytes)
    → Shc(WYc): window.AscDesktopEditor 存在 → Desktop 分支
    → LocalStartOpen(): noop（polyfill）
    → bytes 被丢弃，canvas 永远空白

修复后（正确）：
  patch: Shc = (d) => BRj(d)  [在调用前注入]
  asc_openDocumentFromBytes(bytes)
    → SDK 内部 r1i(bytes)
    → patched Shc(WYc) → BRj(WYc)
    → 检测 OOXML → S_f(data) → WASM 直接解析 OOXML ZIP
    → canvas 渲染文档内容
```

唯一的代价：三个 SDK 内部函数被替换。由于这些函数仅在初始加载时调用一次，替换后无副作用。
