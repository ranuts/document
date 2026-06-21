# 工具栏功能修复：AscDesktopEditor Polyfill + $window 级联崩溃

**日期：** 2026-06-21  
**分支：** `explore/path-d-desktop-mock`  
**提交：** `583b84c`  
**影响文件：** `vite.config.ts`、`src/lib/onlyoffice-editor.ts`

---

## 一、问题现象

PPTX 文件打开正常（幻灯片可见），工具栏按钮也可点击，但实际操作时大量工具无效：

- 点击 **插入图片** → 立即报错，无文件选择框出现
- 点击 **插入视频/音频** → 同样报错
- 其他涉及文件选取的操作 → 全部失败

控制台出现两组错误：

```
changesError: Error: Uncaught TypeError:
  Cannot read properties of undefined (reading 'OpenFilenameDialog')
  at Asc.asc_docs_api.E4d.Asc.asc_docs_api.Ddb (sdk-all.js:18620:99)
  at app.js:8:986714

Uncaught TypeError:
  Cannot read properties of undefined (reading '$window')
  at n.onError (app.js:8:1609409)
  at Jt (app.js:8:94698)
  ...
```

---

## 二、根因 1：window.AscDesktopEditor 不存在

### 2.1 SDK 的设计假设

OnlyOffice Web Apps（我们用的 `web-apps/` 目录）是设计在两种环境下运行的：

| 环境 | 后端 |
|------|------|
| 有服务器（标准部署） | OnlyOffice Document Server（socket.io、实时协作、License 服务） |
| 桌面模式（Desktop App 内嵌）| `window.AscDesktopEditor`（C++ 提供的原生 OS 接口） |

我们的项目既没有真实服务器，也没有 Desktop App，属于两边都不是的第三种情况。SDK 在调用涉及文件选取的功能时，走的是**桌面模式路径**，直接读取 `window.AscDesktopEditor`。

### 2.2 SDK 真实调用代码（sdk-all.js:18620）

通过 `sed` 定位 18620 行，找到插入图片的完整逻辑：

```javascript
// pptx: Insert Image（E4d 是 Ddb 的别名，Ddb 是 asc_addImage 的实现）
Asc.asc_docs_api.prototype.E4d = Asc.asc_docs_api.prototype.Ddb = function(a) {
  window.AscDesktopEditor.OpenFilenameDialog("images", !1, function(b) {
    Array.isArray(b) && (b = b[0]);
    b && (b = window.AscDesktopEditor.LocalFileGetImageUrl(b),
          editor.F4d(AscCommon.uu.IR(b), void 0, a))
  })
};

// pptx: Insert Video
Asc.asc_docs_api.prototype.asc_AddVideo = function(a) {
  window.AscDesktopEditor.OpenFilenameDialog("video", !1, function(b) {
    b && window.AscDesktopEditor.AddVideo(b, function(f, g) { d.Dti(f, g, a) })
  })
};

// word SDK、cell SDK 里的 Insert Image 完全相同的模式
```

三种编辑器（pptx/docx/xlsx）所有文件选取操作都依赖同一接口：
1. `OpenFilenameDialog(filter, isMultiselect, callback)` → 打开文件选择框
2. `LocalFileGetImageUrl(path)` → 把路径转成可用 URL
3. `AddVideo(path, callback)` / `AddAudio(path, callback)` → 媒体文件处理

### 2.3 涉及的全部方法（从三个 SDK grep 归总）

从 `sdkjs/slide/sdk-all.js`、`sdkjs/word/sdk-all.js`、`sdkjs/cell/sdk-all.js` 统计：

| 类别 | 方法 |
|------|------|
| 文件对话框 | `OpenFilenameDialog`、`GetDropFiles` |
| 本地文件 URL | `LocalFileGetImageUrl`、`LocalFileGetImageUrlCorrect` |
| 媒体插入 | `AddVideo`、`AddAudio` |
| 本地保存 | `LocalFileSave`、`LocalFileSaveChanges`、`LocalFileGetSaved`、`LocalFileGetSourcePath`、`LocalFileGetOpenChangesCount` |
| 文档状态 | `onDocumentModifiedChanged`、`GetOpenedFile`、`LocalStartOpen` |
| UI 杂项 | `SetDocumentName`、`SetFullscreen`、`SetLocalRestrictions`、`CheckNeedWheel`、`SaveQuestion`、`GetSupportedScaleValues` |
| 加密/区块链 | `buildCryptedEnd`、`buildCryptedStart`、`CryptoMode`、`Crypto_GetLocalImageBase64`、`PreloadCryptoImage`、`isBlockchainSupport`、`ViewCertificate` |
| 媒体/插件检测 | `IsSupportMedia`、`isSupportPlugins`、`isSupportNetworkFunctionality`、`GetInstallPlugins` |
| 其他 | `CheckUserId`、`convertFile`、`getEngineVersion`、`GetImageBase64`、`IsFilePrinting`、`IsImageFile`、`IsLocalFile`、`IsLocalFileExist`、`LoadFontBase64`、`NativeViewerOpen`、`startExternalConvertation`、`SetAdvancedOptions` |

---

## 三、根因 2：弹窗抑制返回 undefined 导致 $window 级联崩溃

### 3.1 发现过程

`n.onError (app.js:8:1609409)` 中的 `$window` 错误原本以为是 AngularJS DI 未完成（core.xml 缺失时的副作用）。但实际上真正的触发路径是：

```javascript
// app.js:8 line, col 1609409 — n.onError 函数内
(!Common.Utils.ModalWindow.isVisible() || ...)
  && Common.UI.alert(s).$window.attr("data-value", t)
//                    ^^^^^^^^ 链式调用：访问 alert() 返回值的 $window 属性
```

`Common.UI.alert(s)` 正常返回一个 Backbone.View（有 `.$window` jQuery 属性）。

### 3.2 我们引入的 bug

`suppressDialogsInFrame` 和 Vite 中间件的 `suppressConnectionLost` 都这样写：

```typescript
// 错误的写法 ❌
ui.alert = (opts: any) => (shouldSuppress(opts) ? undefined : origAlert(opts));
//                                                ^^^^^^^^^ 返回 undefined
```

当条件触发（"Connection is lost" 等消息）时：
1. `Common.UI.alert(s)` → 返回 `undefined`
2. `undefined.$window` → **TypeError: Cannot read properties of undefined (reading '$window')**
3. 这个 TypeError 在 SDK 错误处理链里又变成新的 `changesError`

这就是 `$window` 错误反复出现的真正原因——是我们自己的 suppress 逻辑引入的。

---

## 四、修复方案

### 4.1 AscDesktopEditor polyfill（vite.config.ts buildPatch 函数）

在 Vite 中间件注入到 iframe `<head>` 的脚本里，添加 polyfill：

```javascript
(function installAscDesktopEditor() {
  if (window.AscDesktopEditor) return;
  var _map = {}, _seq = 0;

  function pickFile(acc, multi, cb) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = !!multi;
    if (acc) inp.accept = acc;
    inp.style.cssText = 'position:fixed;top:-9999px;...opacity:0;';
    document.body.appendChild(inp);
    function done() { try { document.body.removeChild(inp); } catch(e) {} }
    inp.addEventListener('change', function() {
      done();
      var files = inp.files;
      if (!files || !files.length) return;
      var paths = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i], key = 'asc-local-' + (++_seq) + '-' + f.name;
        _map[key] = { url: URL.createObjectURL(f), file: f };
        paths.push(key);
      }
      cb(multi ? paths : paths[0]);
    });
    inp.addEventListener('cancel', done);
    inp.click();
  }

  window.AscDesktopEditor = {
    OpenFilenameDialog:   function(f, m, cb) { pickFile(filterToAccept(f), m, cb); },
    LocalFileGetImageUrl: function(k) { var e = _map[k]; return e ? e.url : k; },
    // ... 40+ 个 stub 方法
  };
})();
```

**关键设计：**
- `OpenFilenameDialog` → 创建隐藏的 `<input type="file">` 并调用 `.click()`
- 文件选取后通过 `URL.createObjectURL` 生成 blob URL，存入 `_map`
- 回调中传递 fake key（`asc-local-N-filename`），SDK 后续通过 `LocalFileGetImageUrl(key)` 获取真实 URL
- filter 类型映射：`"images"` → `image/*`、`"video"` → `video/*` 等

**为什么不会破坏现有保存机制：**

`LocalFileSave` 只在 `this.Aja === true` 时被调用（SDK 内部保存状态机）。当使用 `asc_openDocumentFromBytes` 打开文档时，`Aja` 始终为 `undefined`（grep 证实只有 `Aja = !1` 赋值，且在保存块内部）。因此现有的 `onSaveDocument` 服务器路径不受影响。

### 4.2 修复弹窗抑制（vite.config.ts + onlyoffice-editor.ts）

```typescript
// 构造可链式调用的 mock dialog（替代 undefined）
const jq: Record<string, unknown> = {};
['attr','on','off','show','hide','css','addClass','removeClass','find','remove',
 'val','text','html','prop','data','trigger','focus','blur','one','click'].forEach((m) => {
  jq[m] = () => jq;  // 每个方法返回自身，支持无限链式调用
});
const MOCK_DIALOG = { $window: jq, close: () => {}, show: () => {}, hide: () => {}, remove: () => {} };

// 正确的写法 ✅
ui.alert = (opts: any) => (shouldSuppress(opts) ? MOCK_DIALOG : origAlert(opts));
```

`MOCK_DIALOG.$window.attr("data-value", t)` → `jq.attr(...)` → 返回 `jq` → 不再 crash。

---

## 五、效果验证

修复前：
- 点击 Insert Image → 立即崩溃
- 控制台：`OpenFilenameDialog` TypeError + `$window` TypeError（每次打开文档都有）

修复后：
- 点击 Insert Image → 弹出文件选择框，选择图片后插入成功
- 控制台：无 `OpenFilenameDialog` 错误，无 `$window` 错误

---

## 六、通用性分析

这个修复是**通用的**，覆盖所有编辑器类型：

| 编辑器 | 涉及功能 |
|--------|---------|
| 演示文稿 (PPTX) | Insert Image、Insert Video、Insert Audio |
| 文档 (DOCX) | Insert Image、Insert Multiple Word Docs、Watermark Image、Bullet Image |
| 电子表格 (XLSX) | Insert Image、Insert Cell Reference Doc |

所有这些功能都通过同一个 `OpenFilenameDialog` → `LocalFileGetImageUrl` 路径，polyfill 一次性解决所有。

---

## 七、已知局限

1. **视频/音频插入**：`AddVideo(path, callback)` 的 callback 参数 `g`（数据）在 Desktop 模式下是经过转码的视频数据。我们直接传 blob URL，SDK 能否正确渲染到幻灯片里还需实测。
2. **input.click() 用户手势要求**：某些浏览器要求 `<input type="file">` 的 `.click()` 在用户手势（event handler）内调用。由于用户点击了工具栏按钮，事件链路满足要求。
3. **cancel 事件支持**：Chrome 113+、Firefox、Safari 15.4+ 支持 `<input type="file">` 的 `cancel` 事件；旧浏览器不支持时，隐藏的 input 会残留在 DOM 里（无功能影响）。
