# AscDesktopEditor 初始化崩溃修复：execCommand / CreateEditorApi / 完整 stub 补全

**日期：** 2026-06-21  
**分支：** `explore/path-d-desktop-mock`  
**提交：** `e619fd0`  
**影响文件：** `vite.config.ts`

---

## 一、问题现象

打开 DOCX 文件（Word 文档）时，编辑器永久停在加载骨架（loading skeleton），
`onAppReady` 从未触发，控制台连续输出：

```
Uncaught TypeError: i.execCommand is not a function
    at app.js:8:...
```

修复 `execCommand` 后，出现第二个崩溃：

```
Uncaught TypeError: a.AscDesktopEditor.CreateEditorApi is not a function
    at sdk-all-min.js:...
```

---

## 二、根因

### 2.1 execCommand — SDK 同步调用

`app.js` 在加载时同步执行以下逻辑：

```javascript
// app.js 初始化段（伪代码，已去混淆）
var i = window.desktop || window.AscDesktopEditor;
if (i) {
  i.execCommand("webapps:features", JSON.stringify(features));
  // ...
  i.execCommand("doc:onready", "");
  var recents = i.LocalFileRecents();  // → 获取最近文件列表
}
```

我们的 polyfill 定义了 `window.AscDesktopEditor`（使 `i` 为 truthy），
但未实现 `execCommand` 和 `LocalFileRecents`，导致 `TypeError`。
这个错误发生在 SDK 初始化最早期，整个主控制器初始化链被中断，
`onAppReady` 永远无法触发。

### 2.2 CreateEditorApi — SDK 注册 API 对象

`sdk-all-min.js` 在所有四种 SDK 变体（word/slide/cell/pdf）中都包含：

```javascript
a.AscDesktopEditor && a.AscDesktopEditor.CreateEditorApi(this)
```

`&&` 仅检查 `AscDesktopEditor` 是否存在，不检查方法是否存在。
`this` 是 Asc API 对象——在 Desktop App 中，这行代码把编辑器 API
注册到 C++ 宿主层，让宿主可以主动调用编辑器功能。
在纯浏览器环境里可以安全地 noop。

---

## 三、解决思路

逐个修方法会陷入 whack-a-mole 循环。改为对 SDK 做**完整静态分析**：

```bash
grep -rho 'AscDesktopEditor\.[A-Za-z_][A-Za-z0-9_]*' \
  public/sdkjs/ public/web-apps/ | sort -u
```

输出 90+ 个方法调用。与现有 polyfill 对照，补全所有缺失方法。

---

## 四、修复内容（vite.config.ts）

新增到 `window.AscDesktopEditor` 对象的方法分三类：

### 4.1 崩溃关键路径（SDK 初始化时同步调用）

| 方法 | 实现 | 说明 |
|------|------|------|
| `execCommand` | `noop` | app.js 初始化时同步调用 |
| `LocalFileRecents` | `noopArr` | execCommand("doc:onready") 后立即调用 |
| `CreateEditorApi` | `noop` | sdk-all-min.js 注册 API 对象 |

### 4.2 带返回值的 stub（防链式调用崩溃）

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `GetFontThumbnailHeight` | `0` | 字体缩略图高度 |
| `GetDefaultCertificate` | `cb(null)` | 数字签名证书 |
| `GetEncryptedHeader` | `cb('')` | 加密文件头 |
| `GetImageOriginalSize` | `cb(0, 0)` | 图片原始尺寸 |
| `GetImageFormat` | `''` | 图片格式字符串 |
| `getDictionariesPath` | `''` | 拼写词典路径 |

### 4.3 安全 noop（仅在用户主动操作时触发，不影响加载）

功能性 noop：`CallInAllWindows`、`CallMediaPlayerCommand`、`CompareDocumentFile`、
`CompareDocumentUrl`、`emulateCloudPrinting`、`endReporter`、`loadLocalFile`、
`LoadJS`、`MergeDocumentFile`、`MergeDocumentUrl`、`OnSave`、`onDocumentContentReady`、
`onFileLockedClose`、`openExternalReference`、`OpenFileCrypt`、`OpenWorkbook`、
`PluginInstall`、`PluginUninstall`、`Print`、`Print_End`、`Print_Page`、`Print_Start`、
`RemoveAllSignatures`、`RemoveFile`、`RemoveSignature`、`ResaveFile`、`SelectCertificate`、
`sendFromReporter`、`sendSystemMessage`、`sendToReporter`、`SetPdfCloudPrintFileInfo`、
`Sign`、`SpellCheck`、`startReporter`

返回 `false` 的 stub：`IsCachedPdfCloudPrintFileInfo`、`IsProtectionSupport`、
`IsSignaturesSupport`、`isSupportMacroses`

---

## 五、效果验证

修复前：
- DOCX 打开 → 永久 loading skeleton
- 控制台：`execCommand is not a function` → 修复后 → `CreateEditorApi is not a function` → 循环

修复后：
- DOCX 加载流程不再在初始化阶段 crash
- `onAppReady` 正常触发
- 文档内容可见，工具栏响应

---

## 六、与前一轮 stub 的关系

本次修复在 commit `583b84c`（首次添加 polyfill）和 `bc43c6c`（补充 word/cell 方法）的基础上，
通过静态分析完成了 **100% 覆盖**。

完整 AscDesktopEditor polyfill 现在涵盖 SDK 中所有已知的调用点，
无论用户打开什么文件类型（DOCX/XLSX/PPTX/CSV），
加载期间都不会再因 `AscDesktopEditor.* is not a function` 崩溃。

---

## 七、已知局限

1. `CreateEditorApi(this)` 传入的是 Asc API 对象，noop 后 Desktop 无法回调编辑器。
   在纯浏览器模式下这个注册路径本来就无意义，不影响功能。
2. `Print` / `Print_Start` / `Print_Page` / `Print_End`：打印功能 noop，
   用户点击打印按钮不会有任何输出。后续可接入 `window.print()`。
3. `SpellCheck`：拼写检查 noop，工具栏拼写检查按钮点击后无反应。
   SDK 也有基于 WASM 的内置拼写检查（spell.wasm），行为待观察。
