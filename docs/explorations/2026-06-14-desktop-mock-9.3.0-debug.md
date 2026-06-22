# 9.3.0 Desktop Mock 调试记录

**日期：** 2026-06-14
**分支：** `explore/path-d-desktop-mock`（基于 `upgrade/onlyoffice-9.3.0`）
**状态：** 🔴 已放弃 — Desktop Mock 方案证明无法完整渲染工具栏，2026-06-15 转向 Web Mode 方案。见 [path-reflection-and-web-mode-plan.md](2026-06-15-path-reflection-and-web-mode-plan.md)

---

## 问题描述

点击 "New Word" → 编辑器 iframe 打开、灰色骨架屏可见，但弹出错误：

> **An error has occurred while opening the file.**
> **The file content does not match the file extension.**

对应 `Asc.c_oAscError.ID.ConvertationOpenFormat` → `errorInconsistentExt`。

---

## 已完成的修复（生效）

### 1. MOa patch ✅

**文件：** `vite.config.ts` → `CreateEditorApi`

```javascript
try {
  if (window.AscCommon && window.AscCommon.r3) {
    window.AscCommon.r3.prototype.MOa = function() { return true; };
    log('MOa patched → BRj path active');
  }
} catch(e) { log('MOa patch err', e.message || String(e)); }
```

**作用：** 强制 `Shc` 走 `BRj`（server-mode path），跳过 Desktop 模式的循环。
**验证：** Console 出现 `[DE] MOa patched → BRj path active` ✓

**背景：** 9.3.0 sdkjs 在 `sdk-all.js:19057` 有 Desktop 模式覆写：
```javascript
AscCommon.r3.prototype.BRj = AscCommon.r3.prototype.Shc;  // 保存原版
AscCommon.r3.prototype.Shc = function(d) {
    if (this.MOa() || !a.AscDesktopEditor) return this.BRj(d);
    // Desktop 模式：忽略 d，只调 LocalStartOpen() → 循环
    this.tma && this.Qk && this.Gig() && (
        this.b_("asc_onDocumentContentReady", ...),
        a.AscDesktopEditor.LocalStartOpen()
    );
};
```

### 2. DOCY string 解码 ✅

**文件：** `src/lib/onlyoffice-editor.ts` → `createEditorInstance`

```typescript
} else if (typeof binData === 'string' && binData.includes(';')) {
  // DOCY/XLSY string format: 'DOCY;v5;{byteLen};{base64data}'
  const base64 = binData.split(';').slice(3).join(';');
  const binaryStr = atob(base64);
  src = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    src[i] = binaryStr.charCodeAt(i);
  }
}
```

**验证：** `bin=7372` 出现在 console ✓（不再是 0）

---

## 当前错误根因分析

### `asc_openDocumentFromBytes` 内部流程（sdk-all-min.js:1611）

```javascript
d.prototype.r1i = function(r) {  // r1i = asc_openDocumentFromBytes
    var t = new AscCommon.WYc;
    t.data = r;
    t.PQb = AscCommon.a9c(t.data, AscCommon.SHa.xH);  // 关键
    this.Shc(t)
};
```

### `a9c` 函数（sdk-all-min.js:959 附近，runtime 验证）

```javascript
function a9c(pa, Za) {
    // pa = data (Uint8Array or string)
    // Za = "DOCY" (AscCommon.SHa.xH)
    if (pa.length > Za.length) {
        for (var fb = 0; fb < Za.length; ++fb)
            if (pa[fb] !== Za.charCodeAt(fb))  // 比较 pa[i] (number) vs charCode (number)
                return false;
        return true;
    }
    return false;
}
```

**判断逻辑：**
- 如果 `data` 是以 DOCY bytes `[68,79,67,89]` 开头的 Uint8Array → `PQb = true`
- 否则（包括 DOCY 字符串 / 其他格式的 bytes）→ `PQb = false`

**关键发现：字符串 vs Uint8Array 的区别：**
- `'DOCY;...'[0]` = `'D'`（字符），`'DOCY'.charCodeAt(0)` = `68`（数字）
- `'D' !== 68` → **返回 false**（字符串无法通过 a9c）
- `Uint8Array([68,79,67,89,...])[0]` = `68`（数字）
- `68 === 68` → **可能返回 true**（如果 bytes 以 DOCY magic 开头）

### `lHg()` 函数（runtime 验证）

- `AscCommon.lHg()` 返回**字符串**（type: "string"）
- 这是 server 模式的空文档模板，格式是 DOCY 字符串 `'DOCY;v5;...'`
- `mjg()` 调用 `Shc(wyc)` 其中 `wyc.data = lHg()` = DOCY 字符串，`wyc.PQb = false`
- → **BRj 知道如何处理 `PQb=false` 且 `data` 是 DOCY 字符串的情况**

### 当前失败原因

我们的 `pendingCopy`（7372 bytes）= `empty_bin.ts` 中 DOCY 字符串的 base64 解码结果。

问题：这 7372 bytes 是 **7.4.1 时代的 DOCY 二进制容器格式**，不是：
1. 以 DOCY magic bytes `[68,79,67,89]` 开头的 9.3.0 DOCY 二进制
2. 也不是原始 ZIP（docx 格式，`[0x50, 0x4B, ...]`）

9.3.0 sdkjs 的 `BRj` 无法识别 7.4.1 DOCY 二进制 → 触发 `ConvertationOpenFormat` 错误。

---

## 下一步修复方案

### 方案 A：直接传 DOCY 字符串给 `asc_openDocumentFromBytes` ⭐推荐

**思路：** `lHg()` 返回 DOCY 字符串 → `mjg()` 用字符串调 `Shc` → `BRj` 处理字符串。
所以 `BRj` 本来就支持 DOCY 字符串作为输入！

**实现：** 在 `onAppReady` 中通过 iframe.contentWindow 访问 `__desktopApi`，
直接调用 `api.asc_openDocumentFromBytes(docyString)`（传字符串，不是 bytes）：

```typescript
onAppReady: () => {
    const iframeEl = document.querySelector('iframe') as HTMLIFrameElement | null;
    const api = (iframeEl?.contentWindow as any)?.__desktopApi;
    if (api && typeof api.asc_openDocumentFromBytes === 'function') {
        if (typeof binData === 'string') {
            // 新文档：直接传 DOCY 字符串
            api.asc_openDocumentFromBytes(binData);
        } else if (pendingCopy.byteLength > 0) {
            // 已有文档（从 x2t 得到的 bytes）
            api.asc_openDocumentFromBytes(pendingCopy);
        }
    }
}
```

**前提：** `__desktopApi` 已通过 `CreateEditorApi` 赋值，且 `document.querySelector('iframe')` 可用。

**runtime 验证（已确认）：**
- `document.querySelector('iframe')` → 存在（在 `#app` 内，非 `#iframe`）
- `iframeEl.contentWindow.__desktopApi` → 存在，`hasAscOpen: true`
- `window.__pendingBinary.byteLength` = 0 → 说明 `onAppReady` 已调用 `openDocument(pendingCopy)` 导致 buffer 被 transfer（当前代码走的是 fallback 的 binary 路径）

**需要修复：** 当前代码用 `document.getElementById('iframe')` 找不到（返回 null），
导致走到 `editorAny.openDocument(pendingCopy)` fallback，传了 binary bytes 而非字符串。

**修复代码（onlyoffice-editor.ts 的 onAppReady）：**

```typescript
onAppReady: () => {
    if (mediaUrls) {
        window.editor?.sendCommand({ command: 'asc_setImageUrls', data: { urls: mediaUrls } });
    }
    const editorAny = window.editor as any;
    if (typeof editorAny?.openDocument === 'function') {
        // 9.3.0: 直接通过 iframe 访问 __desktopApi，传 DOCY 字符串（非 binary）
        // BRj 原生支持 DOCY 字符串（lHg() → mjg() → Shc() 就走这条路）
        const iframeEl = document.querySelector('iframe') as HTMLIFrameElement | null;
        const api = (iframeEl?.contentWindow as any)?.__desktopApi;
        if (api && typeof api.asc_openDocumentFromBytes === 'function') {
            if (typeof binData === 'string') {
                api.asc_openDocumentFromBytes(binData);  // DOCY string for new docs
            } else if (pendingCopy.byteLength > 0) {
                api.asc_openDocumentFromBytes(pendingCopy);  // bytes for existing docs
            }
        }
    } else {
        // 7.4.1 server 模式 fallback
        window.editor?.sendCommand({ command: 'asc_openDocument', data: { buf: binData } });
    }
},
```

### 方案 B：用 9.3.0 x2t 重新生成 empty_bin.ts

**思路：** 从 9.3.0 x2t WASM 生成空 .docx/.xlsx/.pptx 的 DOCY binary，更新 `empty_bin.ts`。

**复杂度：** 需要使用 x2t API 将一个最小空 docx 转换，捕获输出，base64 编码，构造新的 DOCY 字符串。
**用途：** 解决已有文档（BlobPart）路径中，bytes 格式不兼容 9.3.0 的问题。

---

## 已验证的调试信息

| 项目 | 状态 |
|------|------|
| `[DE] MOa patched → BRj path active` 出现 | ✅ |
| `[DE] CreateEditorApi` 出现 | ✅ |
| `[DE] SetDocumentName | New_Document.docx` 出现 | ✅ |
| `[DE] editor:onready` 出现 | ✅ |
| `pendingBinaryLen = 0`（buffer 被 transfer） | ✅ onAppReady 已触发 |
| `document.querySelector('iframe')` 返回非 null | ✅ |
| `__desktopApi.asc_openDocumentFromBytes` 是函数 | ✅ |
| `window.editor.openDocument` 存在 | ✅ 9.3.0 确认 |
| `document.getElementById('iframe')` 返回 **null** | ❌ 选择器错误！ |

---

## 关键 API 差异：7.4.1 vs 9.3.0

| 项目 | 7.4.1 | 9.3.0 |
|------|-------|-------|
| `window.editor` 方法 | `sendCommand` | `openDocument` |
| `sendCommand` 是否存在 | ✅ | ❌（silent no-op） |
| `openDocument` 是否存在 | ❌ | ✅（= `_openDocumentFromBinary`） |
| 文档传输格式（new doc） | DOCY 字符串 via sendCommand | 待确认：DOCY 字符串 via `asc_openDocumentFromBytes` 直调 |
| `BRj` 接受的数据 | WYc.data = DOCY 字符串 | WYc.data = DOCY 字符串（lHg()）/ DOCY bytes（以 D-O-C-Y 开头）|

---

## 文件修改记录

### `vite.config.ts`
- `execCommand` 简化为 no-op（移除 editor:onready fallback）
- `CreateEditorApi` 新增 `MOa` patch
- `LocalStartOpen` 改为 no-op（MOa=true 后不再被调用）

### `src/lib/onlyoffice-editor.ts`
- `createEditorInstance` 新增 DOCY string → Uint8Array 解码
- `onAppReady` 改为尝试 `getElementById('iframe') + querySelector('iframe')` 访问 `__desktopApi`
  - **BUG：** `getElementById('iframe')` 返回 null，导致走 fallback binary 路径
  - **NEXT：** 改为 `document.querySelector('iframe')` 直接访问

---

## 第二轮修复：OOXML ZIP 路径（2026-06-14 续）

### 根因确认：g.prototype.nve 在 9.3.0 中已删除

```javascript
// sdk-all-min.js line 2059:
g.prototype.OpenDocument = g.prototype.nve;  // nve 从未被定义 → undefined
// → g.prototype.Aqb 调用 this.nve() 抛出 TypeError
```

验证方法：`grep -c "prototype\.nve\s*=\s*function" sdk-all-min.js` → 0

`g.prototype.Aqb` 的三条分支：
```javascript
N.PQb ? this.ove(N.url, N.data)          // DOCY binary (starts with [68,79,67,89])
      : OOa ? this.S_f(N.data)            // OOXML ZIP (PK magic, AscCommon.cac()=true)
             : this.nve(N.url, N.data)     // ← 已死，9.3.0 删除
```

### 修复方案：传入最小空 OOXML docx

**`empty_bin.ts`** 新增 `g_sEmpty_ooxml` 导出 — 存储 base64 编码的最小空 docx/xlsx/pptx（ZIP 格式）。

**`onlyoffice-editor.ts` `onAppReady`** 修改：新文档时解码 OOXML base64 → Uint8Array，调用 `api.asc_openDocumentFromBytes(ooxmlBytes)`。

关键验证点：
- `first4=[80,75,3,4]` (PK magic) → `AscCommon.cac()=true` → `OOa=true` → `S_f()` 调用 ✅
- Console 出现 `[OO] new doc OOXML ZIP .docx 1224 bytes, first4= [80,75,3,4]` ✅
- 不再出现 `TypeError: this.nve is not a function` ✅
- Canvas 元素创建（`id_viewer` 2292x1146）✅
- iframe 标题变为 `New_Document.docx - ONLYOFFICE` ✅

### 当前剩余问题：.doc-placeholder 未消失（旧判断，已被第四轮修正）

**现象：** `class="doc-placeholder"` 仍为 `display:block`，canvas 全为透明（RGBA 全0）。

**注意：** `.placeholder` 选择器找不到 → 要用 `.doc-placeholder`！

**旧原因分析：** 字体加载阻塞了文档渲染：
- `ascdesktop://fonts/symbol.ttf` CORS 失败
- `ascdesktop://fonts/wingding.ttf` CORS 失败
- 字体未加载 → 布局未完成 → canvas 未绘制 → `asc_onDocumentContentReady` 未触发 → `.doc-placeholder` 不消失

**修复尝试：** `vite.config.ts` 字体映射表新增：
```javascript
'symbol.ttf':'DejaVuSans.ttf',
'wingding.ttf':'DejaVuSans.ttf',
// + wingdng2/3, webdings, marlett
```

第四轮 Chrome DevTools 验证显示：字体映射已生效，`ascdesktop://fonts/...` CORS 错误消失，但 `canvas#id_viewer` 仍透明。因此“字体阻塞渲染”不是当前最终根因。

### 调试信息汇总（最新）

| 项目 | 状态 |
|------|------|
| `g.prototype.nve` 是否存在 | ❌ 9.3.0 已删除 |
| OOXML ZIP (PK magic) → `cac()=true` → `S_f()` | ✅ |
| Canvas `id_viewer` 2292x1146 存在 | ✅ |
| iframe title = `New_Document.docx - ONLYOFFICE` | ✅ |
| Canvas 像素内容 | ❌ 全透明（字体未加载完） |
| `.doc-placeholder` 消失 | ❌ 仍可见 |
| `symbol.ttf`/`wingding.ttf` CORS 失败 | ❌ → 加入字体映射修复 |

---

## 关键 API 差异：7.4.1 vs 9.3.0（更新）

| 项目 | 7.4.1 | 9.3.0 |
|------|-------|-------|
| `window.editor` 方法 | `sendCommand` | `openDocument` |
| `g.prototype.nve` (DOCY string path) | ✅ 存在 | ❌ 已删除 |
| 新文档数据格式 | DOCY string → `sendCommand` | OOXML ZIP → `asc_openDocumentFromBytes` |
| `g.prototype.S_f` | ✅ | ✅ OOXML ZIP 入口 |
| `g.prototype.ove` | ✅ | ✅ DOCY binary 入口 |
| 占位符选择器 | `.placeholder` | `.doc-placeholder` |

---

## 第三轮验证：字体映射与工程检查（2026-06-14 续）

### 已确认

1. **Desktop mock 注入生效**
   - 请求 `http://localhost:5174/web-apps/apps/documenteditor/main/index.html`
   - 返回 HTML 中包含 `window.AscDesktopEditor`、`CreateEditorApi`、`MOa patched → BRj path active`
   - 字体映射表也已注入，包含 `symbol.ttf`、`wingding.ttf`

2. **字体资源本身可访问**
   - `curl http://localhost:5174/fonts/DejaVuSans.ttf`
   - 返回 `200 font/ttf 757076`
   - `file` 识别为 `TrueType Font data`

3. **SDK 静态证据支持 OOXML ZIP 路径**
   - `public/sdkjs/word/sdk-all-min.js`
   - `AscCommon.cac()` 存在，用于 ZIP/OOXML 检测
   - `g.prototype.S_f` 存在，且最终导出为 `OpenDocumentFromZip`
   - `g.prototype.ove` 存在，且最终导出为 `OpenDocumentFromBin`
   - `g.prototype.OpenDocument = g.prototype.nve` 仍存在，但没有 `prototype.nve = function` 定义

4. **当前变更的类型错误已修复**
   - `sendCommand({ data: { buf } })` 的 7.4 fallback 仍可能传 DOCY 字符串
   - `src/lib/document-types.ts` 和 `src/types/editor.d.ts` 的 `buf` 类型更新为 `ArrayBuffer | string`

5. **生产构建通过**
   - `pnpm run build` 成功
  - Vite 仍提示多页 HTML 中 OnlyOffice `api.js` 非 module script 无法被 bundle，这是既有警告，不阻塞构建

---

## 第四轮验证：Chrome DevTools 运行态结论（2026-06-14 续）

### 关于 `chrome-devtools` unsupported

`/mcp` 中显示 `chrome-devtools unsupported` 不等于本轮不可用。实际通过 `tool_search` lazy-load 后，`mcp__chrome_devtools` 工具可正常执行：
- `list_pages`
- `evaluate_script`
- `take_snapshot`
- `list_console_messages`
- `list_network_requests`

需要区分两套能力：
- Chrome Extension 后端不可用：扩展/native host 通信失败
- Chrome DevTools MCP 可用：本轮所有浏览器运行态验证都来自 `mcp__chrome_devtools`

### Dev 环境缓存问题

发现项目入口在 Vite dev 下仍注册 `./sw.js`，会导致旧 Service Worker/Cache 拦截 localhost 请求。典型症状：

```text
Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".
```

对应 `/src/index.ts` 被旧 SW 返回成 HTML。

已修复：
- `src/index.ts`：`!import.meta.env.DEV` 时才注册 PWA Service Worker
- `vite.config.ts`：dev 下拦截 `document_editor_service_worker.js`，返回 404 + `no-store`，避免 OnlyOffice iframe 注册到同一 localhost scope

验证：
- 清理后 `navigator.serviceWorker.getRegistrations()` 返回 `[]`
- `caches.keys()` 返回 `[]`
- `/src/index.ts` 正常 200，不再被 HTML fallback 污染

### 空 docx 模板迭代

1. **1224 bytes 最小 OOXML ZIP**
   - `[OO] new doc OOXML ZIP .docx 1224 bytes`
   - 不再报 `ConvertationOpenFormat`
   - 字体请求已映射到 `/fonts/*.ttf`
   - `canvas#id_viewer` 仍透明

2. **3397 bytes `textutil` 生成 docx**
   - 暴露 SDK 运行时错误：
   ```text
   TypeError: Cannot read properties of null (reading 'indexOf')
   at df.Rad (sdk-all.js:18829:133)
   ```
   - 对应源码片段会对 `(vc && vc.QC()).indexOf(...)` 直接调用
   - `textutil` 的 `word/_rels/document.xml.rels` 包含 `customXml` 关系，`vc.QC()` 为空时触发崩溃

3. **4204 bytes sanitized `textutil` docx**
   - 删除 `customXml` relationship、`docProps/meta.xml`、content type override
   - 浏览器动态导入确认：
   ```json
   {"docxBase64Len":5608,"docxBytes":4204,"first4":[80,75,3,4],"pk":"PK"}
   ```
   - 不再出现 `df.Rad` / `indexOf` 崩溃
   - 但 75 秒后文档层仍未渲染：
   ```json
   {
     "api": {"OOa": true, "KXb": null, "Fm": 0, "gig": true},
     "canvasInfo": {
       "id": "id_viewer",
       "width": 2254,
       "height": 1094,
       "sampledNonzero": 0
     },
     "serviceWorkers": []
   }
   ```

### 当前稳定现象

- `CreateEditorApi` 生效
- `MOa patched → BRj path active` 生效
- 新文档走 OOXML ZIP 分支，`first4=[80,75,3,4]`
- 字体映射生效，`symbol/wingding/webdings/marlett` 不再是当前主因
- `canvas#id_viewer`、`id_viewer_overlay` 可见但全透明
- 只有 UI canvas（如 `id_buttonTabs`）有像素，文档层没有像素
- `canCoAuthoring: false` 与 `coEditing.change=false` 对 Desktop 9.3 路径无效，仍会请求：
  `ws://localhost:5174/doc/<id>/c/?...transport=websocket`
  和 `/doc/<id>/c/?...transport=polling`
- 手动调用 `api.asc_coAuthoringDisconnect()`、`api.asc_SpellCheckDisconnect()` 不会触发文档层绘制

### 当前判断

已经排除：
- 旧 7.4 DOCY binary 不兼容导致的格式错误
- `g.prototype.nve` 缺失导致的死分支
- `customXml` relationship 导致的 `null.indexOf`
- Service Worker 缓存污染
- 常见字体 CORS 阻塞

尚未解决：
- 9.3.0 Desktop mock 下，OOXML ZIP 已进入打开流程但文档层未触发实际绘制
- `/doc/<id>/c/` socket.io 通道仍被 SDK 启动，简单关闭 coauthoring 配置无效
- 需要继续定位 `S_f()` 后续是否停在协作初始化、layout scheduler，还是缺少 Desktop-only 回调（例如某个 `AscDesktopEditor` 方法）

### 仍未完成的运行态验证

自动化浏览器当前不可用：
- in-app Browser 返回 `Browser is not available: iab`
- 本地 Playwright 启动 Chromium 失败：
  `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer... Permission denied`

因此本轮只能确认：
- Desktop mock 和字体映射已注入
- 被映射字体可被 Vite 正常提供
- 构建通过

还需要在可用浏览器中手动验证：
- 点击 `New Word`
- Console 不再出现 `ascdesktop://fonts/symbol.ttf` / `wingding.ttf` CORS 失败
- `.doc-placeholder` 变为隐藏
- `canvas#id_viewer` 有非透明像素
- `asc_onDocumentContentReady` / `onDocumentReady` 触发

### 独立工程问题：测试路径仍是旧布局

`pnpm run tsc` 和 `pnpm run test` 仍失败，但失败原因已不是本轮 9.3 打开链路改动：

- 单元测试导入 `../../lib/document-utils`、`../../lib/embed-api`、`../../lib/i18n`、`../../lib/onlyoffice-editor`
- 当前源码实际在 `src/lib/*`
- SEO 测试读取根目录 `index.html` 和 `docx-editor/index.html`
- 当前静态页面实际在 `pages/index.html`、`pages/docx-editor/index.html`
- `pages/src -> ../src` 是 symlink，导致 `tsconfig` 会把同一份源码按 `pages/src/*` 再纳入一次

建议单独修：
1. 将单元测试导入改到 `../../src/lib/*` 或统一使用 `@/lib/*`
2. 将 `vitest.config.ts` alias 从根目录 `lib/store/styles` 改到 `src/lib/src/store/src/styles`
3. 将 SEO 测试路径改到 `pages/*`，或在测试前先跑构建并读取 `dist/*`
4. `tsconfig.json` 排除 `pages/src` symlink，避免源码重复编译

---

## 下一步操作

1. **继续定位 Word 渲染链路：** 在 iframe 内 patch/记录 `S_f`、`Aqb`、`asc_onDocumentContentReady`、layout/draw 入口，确认 OOXML 是否已转成 internal document model
2. **验证 socket.io 最小 mock：** 如果 SDK 必须完成 auth/change handshake，尝试返回 Engine.IO v4 handshake，而不是一直 404
3. **补齐 Desktop mock API：** 观察 console 中未实现的 `AscDesktopEditor` 方法调用，逐个实现最小 no-op/返回值
4. **Word 成功后再扩展：** 继续验证 New Excel / New PowerPoint
5. **并行工程修复：** 单独整理 `tsconfig` / `vitest` / SEO 测试路径，恢复 `pnpm run tsc && pnpm run test` 可作为升级分支护栏

---

## 第七轮：静态代码分析发现保存链路完全断裂（2026-06-15）

### 根因：`onSave` → `onSaveDocument` 事件名变更 + 数据格式变更

通过静态分析 `public/web-apps/apps/api/documents/api.js` 和 `public/web-apps/apps/documenteditor/main/app.js`，确认了 9.3.0 保存链路的完整变更：

#### 证据链

**api.js:408**
```javascript
_config.editorConfig.canSaveDocumentToBinary = _config.events && !!_config.events.onSaveDocument;
```
→ `onSave` 不在此判断中，传 `onSave` 导致 `canSaveDocumentToBinary = false`。

**app.js:1772392**
```javascript
t.appOptions.canSaveDocumentToBinary && 
  t.api.asc_registerCallback("asc_onSaveDocument", _.bind(t.onSaveDocumentBinary, t))
```
→ `canSaveDocumentToBinary=false` 时，`asc_onSaveDocument` SDK 回调**永远不注册**，保存事件链断裂。

**app.js:1808384**
```javascript
onSaveDocumentBinary: function(t) { Common.Gateway.saveDocument(t) }
```
**app.js gateway（143842）**
```javascript
saveDocument: function(t) { t && n({event:"onSaveDocument", data:t.buffer}, t.buffer) }
```
→ postMessage 发出 `{event:"onSaveDocument", data:ArrayBuffer}`（ArrayBuffer 通过 transfer 传递）。

**api.js:455-477（消息路由）**
```javascript
handler = events[msg.event],  // msg.event = "onSaveDocument"
handler.call(_self, {target: _self, data: msg.data});  // msg.data = ArrayBuffer
```

#### 与 7.4.1 的对比

| 项目 | 7.4.1 | 9.3.0 |
|------|-------|-------|
| 事件名 | `onSave` | `onSaveDocument` |
| `canSaveDocumentToBinary` 依赖 | 不存在此标志 | `!!events.onSaveDocument` |
| `event.data` 结构 | `{ data: { data: Uint8Array }, option: { outputformat: number } }` | `ArrayBuffer`（直接二进制，transfer） |
| SDK 内部回调 | 不明 | `asc_onSaveDocument` |

#### 已修复（2026-06-15）

**`src/lib/onlyoffice-editor.ts`**：
1. `onSave: handleSaveDocument` → `onSaveDocument: handleSaveDocument`（事件名修正）
2. `handleSaveDocument` 新增双路解析：
   - 9.3.0 路径：`event.data instanceof ArrayBuffer` → `new Uint8Array(event.data)`，targetFormat 从 fileName 推导
   - 7.4.1 路径：`event.data?.data?.data` 存在 → 保留原有嵌套结构 + `c_oAscFileType2[option.outputformat]`

**`src/types/editor.d.ts`**：
- `onSaveDocument?` 新增，类型 `(event: { target: DocEditor; data: ArrayBuffer }) => void`
- `onSave?` 保留为 legacy 注释

**`vite.config.ts`**：
- `offlineMode.canSaveDocumentToBinary: false` → `true`（当 Main.appOptions 未初始化时正确填充默认值）

#### 待验证

- [ ] 浏览器打开 New Word，Ctrl+S，console 出现 `[OO] save 9.3.0 binary ... bytes → format DOCX`
- [ ] 文档成功下载为 .docx（x2t 转换正常）
- [ ] New Excel（.xlsx）、New PowerPoint（.pptx）保存路径相同逻辑，验证一致
- [ ] `sendCommand({command:'asc_onSaveCallback',...})` 在 9.3.0 是否需要？如果 editor 在保存后出现错误提示，说明需要特殊处理

## 第五轮验证：Chrome DevTools 接入后的新结论

### 已确认的推进

Chrome DevTools MCP 可用；`/mcp` 中显示 `chrome-devtools unsupported` 不代表工具不可用，本轮通过 `mcp__chrome_devtools` 完成 console、运行态和 canvas 采样。

新增的 Desktop mock 缺口：

- `AscDesktopEditor.LocalFileRecents()`：9.3 `doc:onready` 后会调用，缺失会触发 `LocalFileRecents is not a function`
- `AscDesktopEditor.onDocumentModifiedChanged()`：手动触发收尾链路时会调用，缺失会报错
- LeftMenu / Toolbar / Statusbar / RightMenu / DocumentHolder 等 controller 在 Desktop mock 离线路径下会比正常路径更早进入 delayed hooks，需要 seed 最小 offline mode
- `ViewTab.onDocumentReady()` 会读取 `view.lockedControls`，但当前路径下 `ViewTab.view` 可能尚未创建，需要最小空结构兜底

新增运行态判断：

```json
{
  "state": {
    "Fia": true,
    "I0c": true,
    "Cvc": true,
    "MVb": false,
    "Vo": true,
    "content": 1
  },
  "id_viewer": {
    "samples": 2450,
    "nonzeroSamples": 0
  }
}
```

含义：

- 文档模型已经存在：`get_ContentCount() === 1`
- 离线推进 `api.Aqg({ offline: true })` 可以把 `I0c` 推到 true，并触发 `doc:onready`
- app 层仍有 delayed UI 初始化错误，导致文档层画布仍未绘制
- 当前主画布 `id_viewer` / `id_viewer_overlay` 仍为全透明

### 本轮新增代码经验

`api.Aqg(r)` 的函数体很小：

```javascript
function(r) {
  this.kbe(r);
  this.I0c = true;
  this.O_a && (this.Xo.apply(this, this.O_a), this.O_a = null);
  this.hyb();
}
```

因此 `Aqg({ offline: true })` 可以作为 Desktop mock 离线路径的最小推进信号，但它会让 app 进入 content-ready / document-ready 事件链，随后暴露 UI mode 初始化缺口。

### 当前最新阻断点

自动 `Aqg offline apply` 已触发，但 console 仍有：

```text
Aqg offline apply err | Cannot read properties of undefined (reading 'canReview')
TypeError: Cannot read properties of undefined (reading 'on')
    at n.l (.../documenteditor/main/app.js:8:1005294)
```

`canReview` 说明仍有某个 Toolbar/View 侧 mode 对象不是 controller.mode，也不是当前已 seed 的 `toolbar.toolbar.mode`。`undefined.on` 位于 Statusbar 初始化语言菜单附近，可能是前一个 UI 异常打断后的连锁问题，也可能是另一个 view 初始化顺序缺口。

### 下一步更明确的方向

1. 继续定位 `canReview` 的具体对象：在 `app.js` 相关 offset 周围确认是 `toolbar.mode`、菜单 item source，还是 `appOptions` 的某个子对象。
2. 如果继续使用 Desktop mock 路径，需要把 appOptions 初始化做成一个统一入口，而不是继续分散 seed controller/view 字段。
3. 对 socket.io 不再建议纯 404；当前 404 不会自然触发 `Aqg()`，应实现最小 Engine.IO / coauthoring handshake，或明确走纯离线 Desktop 初始化路径。
4. 主画布仍全透明，不能宣称 Word 升级完成；当前状态是“模型已加载，UI ready 链路仍阻断绘制”。

---

## 第六轮验证：Word 画布已渲染，剩余问题转向 UI 外壳

### 关键推进

Chrome DevTools 重新验证后，`New Word` 已经不再停在透明画布：

```json
{
  "state": {
    "Fia": true,
    "I0c": true,
    "Cvc": true,
    "MVb": false,
    "Vo": true,
    "content": 1
  },
  "id_viewer": {
    "samples": 2450,
    "nonzeroSamples": 1666
  },
  "id_vert_ruler": {
    "nonzeroSamples": 1813
  },
  "id_hor_ruler": {
    "nonzeroSamples": 1820
  }
}
```

含义：

- OOXML ZIP 新建 Word 数据已经进入 9.3.0 文档模型：`content=1`
- `api.Aqg({ offline: true })` 可以推进 Desktop 离线路径，使 `Fia/I0c/Cvc` 到达 ready 状态
- 文档主画布 `canvas#id_viewer` 已有非透明像素，说明文档层已经实际绘制
- 之前第五轮的“主画布全透明”结论已过期

### 本轮补齐的 Desktop mock 缺口

1. `ReviewChanges.appConfig`
   - 错误：`Cannot read properties of undefined (reading 'canReview')`
   - 经验：只 seed controller.mode 不够，部分 controller 读取 `appConfig` / `appOptions`
   - 处理：为 `LeftMenu`、`Toolbar`、`Statusbar`、`RightMenu`、`DocumentHolder`、`ReviewChanges`、`Comments`、`Plugins`、`Navigation` 统一 seed offline defaults

2. Header 用户信息
   - 错误：`getUserInitials(undefined).split`
   - 经验：9.3 Desktop header 假设 `header.options.userName/currentUserId` 已存在
   - 处理：注入匿名用户 `Anonymous / desktop-mock-user`

3. `Main.setLanguages`
   - 错误：`Cannot read properties of undefined (reading 'btnsDocLang')`
   - 经验：语言菜单不是挂在 `Toolbar` controller 上，而是 `Main.setLanguages()` 内部调用 toolbar view
   - 处理：在 dev server 重启后验证 `Main.setLanguages guarded` 生效；注意 `vite.config.ts` 的 middleware 注入改动必须重启 Vite，HMR 不会更新已注册 middleware

4. `Toolbar.createDelayedElements`
   - 错误：`btnsPageBreak.forEach`、`btnStrikeout.updateHint`、`setButtons(...).is`、`menu`
   - 经验：9.3 Desktop delayed toolbar 初始化依赖完整桌面 UI 控件树；当前浏览器 mock 只够支撑文档渲染，不够支撑完整 toolbar
   - 处理：探索分支中先跳过该 delayed hook，保留文档模型和 canvas 渲染路径

### 当前仍未完成

不能宣称 9.3 升级完成，原因：

- Console 仍有 UI 外壳错误：
  - `Cannot read properties of undefined (reading 'forEach')`
  - `Cannot read properties of undefined (reading 'is')`
  - `Cannot read properties of undefined (reading 'menu')`
- 这些错误发生在 `Document loaded: New_Document.docx` 之后，当前不阻断主画布绘制，但会影响 toolbar / 菜单 / 编辑交互完整性
- `/doc/<id>/c/` socket.io 仍会请求并 404；当前是靠 `Aqg({ offline: true })` 推进离线 ready，不是完整协议模拟
- `document_editor_service_worker.js` 404 是本地 dev 下刻意拦截，用于避免 iframe service worker 污染 localhost scope；生产策略需要另行设计

### 下一步建议

1. 不要继续无限补零散 guard；优先选择方向：
   - 补完整 `Desktop appOptions + toolbar view` mock，目标是让 9.3 Desktop UI 全量初始化
   - 或改走非 Desktop/server 模式，提供最小 socket.io / coauthoring handshake，减少 Desktop shell 假设
2. 短期验证应先聚焦：
   - Word 编辑输入是否可用
   - 保存/export 路径是否还能从 9.3 API 拿到二进制
   - Excel / PowerPoint 是否也能从新建模板进入非透明 canvas
3. 工程上继续保留 `pnpm run build` 作为当前护栏；`pnpm run tsc/test` 的旧测试路径问题需要单独修复
