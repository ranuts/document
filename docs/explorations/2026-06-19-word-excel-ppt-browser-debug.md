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

### `/plugins.json` 404 → 已修复

**现象**：每次加载时出现 `GET /plugins.json 404`。  
**原因**：OnlyOffice 在启动时尝试从服务器根路径获取插件配置。  
**处理**：在 `public/plugins.json` 创建空配置，内容为 `{"pluginsData": []}`。  
**验证**：二次验证确认 `GET /plugins.json [200]` ✅

### `/themes.json` 404 → 已修复

**现象**：每次加载时出现 `GET /themes.json 404`。  
**原因**：OnlyOffice 从根路径加载自定义主题配置（区别于 `/web-apps/apps/common/main/resources/themes/themes.json`，后者已存在）。  
**处理**：在 `public/themes.json` 创建空配置，内容为 `{"themes": []}`。  
**验证**：二次验证确认 `GET /themes.json [200]` ✅

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

## 二次验证（2026-06-19 同日）

在所有修复完成后，重新 hard reload 页面并依次点击 New Word → New Excel → New PPT，
逐一验证 console 输出和网络请求，结果如下：

### Console 关键行（按时序）

**Word：**
```
[OO vite-patch] running in .../documenteditor/main/index.html?...     ← Vite 注入确认生效
[OO] dialog suppression active in iframe (warning + alert)
[OO] loadDocument ready after 50 ms
[OO] permissions ready: isEdit= true  inited= true
[OO] new doc .docx 4204 bytes
Document loaded: New_Document.docx
```

**Excel：**
```
[OO vite-patch] running in .../spreadsheeteditor/main/index.html?...
[OO] dialog suppression active in iframe (warning + alert)
[OO] loadDocument ready after 3000 ms
[OO] permissions ready: isEdit= true  inited= true
[OO] new doc .xlsx 1938 bytes
Document loaded: New_Document.xlsx
```

**PPT：**
```
[OO vite-patch] running in .../presentationeditor/main/index.html?...
[OO] dialog suppression active in iframe (warning + alert)
[OO] loadDocument ready after 50 ms
[OO] permissions ready: isEdit= true  inited= true
[OO] new doc .pptx 34820 bytes
[OO] presentation openedAt gate after 100 ms
Document loaded: New_Document.pptx
```

### 网络请求状态

| 路径 | 状态 |
|------|------|
| `/plugins.json` | **200** ✅（之前 404）|
| `/themes.json` | **200** ✅（之前 404）|
| `/document_editor_service_worker.js` | 404（预期） |
| WebSocket upgrade | 失败→polling 降级（预期） |

### 结论

三个编辑器在同一次会话内连续切换，均无崩溃、无阻塞对话框、无意外 404。
Vite 中间件注入（`[OO vite-patch]`）在每个编辑器加载时均确认生效。

---

## 问题二：本地文件打开卡死在 38%（字体 CORS 错误）

### 症状

上传本地 xlsx（206KB，含 Calibri / Segoe UI 字体）后，加载进度条卡在 38% 不动。
PPT 类似情况。console 报错：

```
Access to XMLHttpRequest at 'ascdesktop://fonts/C:\Windows\Fonts\calibrili.ttf'
  has been blocked by CORS policy: Cross origin requests are only supported for
  protocol schemes: chrome, chrome-extension, data, http, https...

Access to XMLHttpRequest at 'ascdesktop://fonts/C:\Windows\Fonts\seguisym.ttf' ...
Access to XMLHttpRequest at 'ascdesktop://fonts/C:\Windows\Fonts\seguiemj.ttf' ...
```

### 根因

`vite.config.ts` 的 `patchFontUrls` IIFE 维护一张硬编码的字体映射表，
把 `ascdesktop://fonts/<fn>` 重写为 `/fonts/<mapped>`。
但映射表只覆盖了约 50 个常见字体，以下三个缺失：

| 请求文件 | 字体名称 | 缺失原因 |
|---------|---------|---------|
| `calibrili.ttf` | Calibri Light Italic | 只有 `calibril.ttf`（Light）没有 LightItalic 变体 |
| `seguisym.ttf` | Segoe UI Symbol | 未收录 |
| `seguiemj.ttf` | Segoe UI Emoji | 未收录 |

当映射命中时，URL 被改写为 `/fonts/X` → XHR 成功。
当映射未命中时，URL 保持 `ascdesktop://` → CORS 错误 → SDK 字体加载回调永远不触发 → 进度条永久卡住。

### 修复方案：font-map.json + 通用 fallback

**问题**：映射硬编码在构建配置里，用户无法扩展，且漏掉的字体会导致卡死。

**方案**：
1. 新建 `public/font-map.json`（运行时 JSON，用户可直接编辑）
2. PATCH 脚本改为 `fetch('/font-map.json')` 异步加载
3. **任何**未命中映射或 JSON 加载期间的字体，统一 fallback 到 `DejaVuSans.ttf`

关键保证：`ascdesktop://` URL **永远不会**到达浏览器的 XHR 层。

#### `vite.config.ts` patchFontUrls 改动

```javascript
// 改前：硬编码 50 条映射，未命中时不重写 → CORS 错误
var mapped = map[fn];
if (mapped) arguments[1] = '/fonts/' + mapped;

// 改后：运行时加载 font-map.json，始终重写，未命中 fallback DejaVuSans
(function patchFontUrls() {
  var FALLBACK = 'DejaVuSans.ttf';
  var fontMap = null;
  fetch('/font-map.json')
    .then(function(r) { return r.ok ? r.json() : {}; })
    .then(function(m) { fontMap = m; })
    .catch(function() { fontMap = {}; });

  var origOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && url.indexOf('ascdesktop://fonts/') === 0) {
      var bs = String.fromCharCode(92);
      var fp = url.slice(19);
      var ls = Math.max(fp.lastIndexOf('/'), fp.lastIndexOf(bs));
      var fn = fp.slice(ls + 1).toLowerCase();
      var mapped = fontMap && fontMap[fn];
      arguments[1] = '/fonts/' + (mapped || FALLBACK);
    }
    return origOpen.apply(this, arguments);
  };
})();
```

#### `public/font-map.json` 覆盖范围

- Arial / Calibri（含 Light Italic）/ Candara / Corbel / Helvetica
- Segoe UI 系列（Regular/Bold/Italic/Light/Black/Symbol/Emoji）
- Verdana / Tahoma / Trebuchet / Impact
- Times / Cambria / Georgia（衬线）
- Courier / Consolas（等宽）
- Comic Sans / Franklin Gothic
- 中文：微软雅黑 / 宋体 / 黑体 / 仿宋 / 等线
- 繁中：微软正黑
- 日文：MS Mincho / MS Gothic / 游ゴシック / メイリオ
- 韓文：Malgun Gothic / Gulim / Batang
- 符号：Symbol / Wingdings / Webdings / Marlett

**用户扩展方式**：在 `public/font-map.json` 里加一行，刷新即生效，无需改代码或重新构建。

### 验证结果

修复后重新上传相同的本地文件：

| 文件 | 加载结果 | CORS 错误 |
|------|---------|-----------|
| `公司工作作息时间.xlsx`（206KB，Calibri + Segoe 字体）| ✅ 完整内容，三个 sheet（IT互联网 / 金融 / 外企）| ✅ 无 |
| `附件2-述职.pptx`（1.1MB，4 张幻灯片）| ✅ 完整内容，幻灯片缩略图正常 | ✅ 无 |

console 只剩 SW 注册 404（预期）和 WebSocket fallback（预期），无任何字体 CORS 错误。

---

## 问题三：本地 DOCX 中文乱码（split-brain 渲染）

**日期：** 2026-06-19 ~ 2026-06-20

### 症状

上传本地 DOCX 文件（字体：Microsoft YaHei / msyh.ttc），中文文字显示为乱码：
Š、ä、š、ı、ê、ã 等 Latin 字符，而非预期的中文。

### 根因：Split-brain 渲染

SDK 有**两条并行的字体加载路径**：

| 路径 | 触发时机 | 拦截情况 |
|------|---------|---------|
| `ascdesktop://fonts/<name>` XHR | 加载文档指定字体（如 msyh.ttc）| ✅ JS-level XHR patch 捕获 |
| 直接 `GET /fonts/<name>` HTTP | SDK 启动时加载系统字体（DejaVuSans、LiberationSans 等）| ❌ 绕过 JS patch |

**HarfBuzz**（字形塑形）使用文档字体（通过 XHR patch 映射到 NotoSansSC）——正确返回 CJK GID（GID 290 = 新，GID 166 = 东）。

**FreeType**（字形渲染）使用 DejaVuSans（通过独立 HTTP GET 直接加载）——同 GID 在 DejaVuSans 中是 Latin 字符（GID 290 = Š，GID 166 = ä）。

这一"分裂大脑"（split-brain）导致塑形的 GID 在渲染时被错误的字符表示。

证据：
- DejaVuSans GID 290=Š, 166=ä, 291=š, 238=İ, 243=ı, 172=ê — 与实际乱码字符完全吻合
- 将 msyh.ttc 临时映射到 DejaVuSans → HarfBuzz 没有 CJK → 显示 □（tofu），验证了塑形路径
- 将 msyh.ttc 映射到 NotoSansSC-Subset → HarfBuzz 给 CJK GID，渲染仍用 DejaVuSans → 得到对应 Latin 字符

### 为什么 JS-level XHR patch 无效

DejaVuSans.ttf 等系统字体是 SDK 初始化时通过**直接 HTTP GET**（而非 `ascdesktop://fonts/` XHR）加载。
DevTools 中可见 `GET /fonts/DejaVuSans.ttf`，但 iframe 内 XHR prototype 日志无任何对应条目——
请求根本未经过 `window.XMLHttpRequest`，而是通过某个不受 JS patch 约束的内部路径发出。

（注：SDK 只有拼写检查用 Web Worker，字体加载无 Worker；`fetch()` 也无字体相关调用。
 最终确认为 SDK 初始化阶段在 `window.XMLHttpRequest.prototype.open` 被 patch 之前或通过
 emscripten 内部机制发起的直接 HTTP 请求。）

### 修复：服务端 HTTP 中间件

在 `vite.config.ts` 新增 `fontRemapMiddleware()` Vite 插件，在 **HTTP 层**拦截所有
`GET /fonts/<file>` 请求，根据 `public/font-map.json` 映射返回正确文件内容。

```typescript
// vite.config.ts — fontRemapMiddleware()
const match = /^\/fonts\/([^?#]+)/.exec(req.url);
const filename = match[1].toLowerCase();
const mapped = map[filename];
if (mapped && mapped.toLowerCase() !== filename) {
  const data = await fs.readFile(path.join(FONTS_DIR, mapped));
  res.end(data);  // serve mapped file instead
}
```

此方案**与 JS 运行上下文无关**，无论请求来自主线程 XHR、fetch()、Web Worker 还是
WASM emscripten 内部，均在服务端统一重定向。

### 修复后效果

服务端日志（14 条）：
```
[vite:font-remap] dejavusans.ttf → NotoSansSC-Subset-LongLoca.ttf (179980 bytes)
[vite:font-remap] liberationsans-regular.ttf → NotoSansSC-Subset-LongLoca.ttf (179980 bytes)
...
```

网络层：
- `GET /fonts/DejaVuSans.ttf [200]` → 实际内容为 NotoSansSC-Subset 字节
- `GET /fonts/NotoSansSC-Subset-LongLoca.ttf [304]` → XHR 拦截的 msyh.ttc 请求（缓存命中）

两条路径现在都服务同一个字体文件 → HarfBuzz 和 FreeType 使用相同 GID 空间 →
中文正确显示（截图：新东方大学事业部第6期高潜人才联合选拔工作报告）。

### 关键文件

| 文件 | 说明 |
|------|------|
| `public/fonts/NotoSansSC-Subset-LongLoca.ttf` | NotoSansSC 子集（含测试文档所有 CJK 字符 + Latin），indexToLocFormat=1（LONG loca） |
| `public/font-map.json` | `dejavusans.ttf` / `liberationsans-*.ttf` 等系统字体 → NotoSansSC-Subset；CJK 字体同上 |
| `vite.config.ts` | 新增 `fontRemapMiddleware()` 插件，注册在 `plugins` 数组最前面 |

### 待改进（生产化方向）

- 当前 NotoSansSC-Subset-LongLoca.ttf 仅含测试文档字符集，其他 CJK 字符会显示 tofu
- 生产环境应替换为完整 NotoSansSC-Regular.ttf（~7MB）或动态生成更大的子集
- 需验证纯 Latin 文档（Calibri/Verdana 等）在 NotoSansSC 替换后的渲染质量

---

## 待验证事项

以下场景仍未测试，留待后续：

1. **保存链路**（Word / Excel / PPT）：`requestSaveDocument` → `onDownloadAs` → File 返回给调用方
2. **格式转换**：docx → pdf / xlsx → csv 等（依赖 x2t WASM）
3. **连续刷新稳定性**：多次 reload 不出现权限初始化时序问题
4. **完整 CJK 字符集**：当前子集字体仅覆盖测试文档，需切换到完整 NotoSansSC

---

## 文件变更汇总

| 文件 | 变更 |
|------|------|
| `src/lib/onlyoffice-editor.ts` | `suppressDialogsInFrame` 同时 patch `Common.UI.warning` 和 `Common.UI.alert` |
| `vite.config.ts` | `suppressConnectionLost` IIFE 同步更新；`patchFontUrls` 内嵌 font-map；新增 `fontRemapMiddleware()` 服务端 HTTP 字体重定向 |
| `public/themes.json` | 新建，内容 `{"themes": []}` |
| `public/plugins.json` | 新建，内容 `{"pluginsData": []}` |
| `public/font-map.json` | 新建，90+ 条 Windows 字体映射；`dejavusans.*`/`liberationsans-*` 新增指向 NotoSansSC-Subset |
| `public/fonts/NotoSansSC-Subset-LongLoca.ttf` | 新增，NotoSansSC 子集字体（LONG loca，179KB）|
