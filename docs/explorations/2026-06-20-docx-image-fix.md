# DOCX 图片不显示：根因分析与修复

**日期：** 2026-06-20  
**分支：** `explore/path-d-desktop-mock`  
**前置文档：** [2026-06-20-cjk-font-split-brain-fix.md](2026-06-20-cjk-font-split-brain-fix.md)

---

## 问题现象

打开含图片的本地 DOCX 文件（如 `test-report.docx`，包含 `word/media/image1.png`、`image1.tiff`、`image2.png`、`image3.png`），图片区域空白，图片未渲染。

---

## 一、根因定位

### 1.1 SDK 的图片 URL 构造方式

OnlyOffice 在 Web Mode 下，`AscCommon.Ys.fia`（文档基路径）值为空字符串 `""`。  
`KS()` 函数构造图片 URL 的方式：

```javascript
a = this.fia + "/media/" + a;
// 例：fia="" + "/media/" + "word/media/image2.png"
// 结果：/media/word/media/image2.png
```

SDK 对每张图片发出 HTTP GET 请求：

```
GET /media/word/media/image1.png
GET /media/word/media/image1.tiff
GET /media/word/media/image2.png
GET /media/word/media/image3.png
```

### 1.2 Vite SPA 回退问题

`public/media/` 目录不存在。Vite dev server 对不匹配静态文件的路径返回 **SPA fallback HTML**（`text/html`，6640 字节），HTTP 状态码 200。

浏览器将这个 HTML 响应缓存为"图片"，后续请求命中缓存返回 304。  
SDK 收到 HTML 字节，无法解码为图片，图片静默失败，显示为空白。

### 1.3 请求类型是 Image 对象，非 XHR

通过网络请求头确认：

```
accept: image/avif,image/webp,image/apng,...
sec-fetch-dest: image
sec-fetch-mode: cors
origin: http://localhost:5173
```

SDK 使用 `new Image(); img.src = url` 加载图片（非 `XMLHttpRequest`）。  
因此，已有的 XHR 原型链 patch（`window.XMLHttpRequest.prototype.open`）无法拦截这些请求。

### 1.4 既有 `asc_setImageUrls` 命令无效

`converter.ts` 通过 x2t 提取图片后，调用：

```javascript
editorSendCommand({ command: 'asc_setImageUrls', data: { urls: mediaUrls } });
```

但 SDK 的 `web-apps`、`sdkjs` 代码中不存在 `asc_setImageUrls` 这个命令处理器。该调用是 no-op，无任何效果。

### 1.5 x2t 重命名问题

即使 `__mediaCache` 中有 x2t 提取的 blob URL，x2t 在转换时会对图片重命名（如 `image1.tiff` → `image3.jpg`），导致文件名与 SDK 请求的原始文件名不匹配：

| SDK 请求（原始 DOCX 名）| x2t 提取名（cache 中的 key）|
|------------------------|---------------------------|
| `image1.png` | `media/image1.png` ✓ |
| `image2.png` | `media/image2.png` ✓ |
| `image1.tiff` | `media/image3.jpg` ✗（重命名）|
| `image3.png` | `media/image4.png` ✗（重命名）|

---

## 二、修复方案

### 2.1 思路

由于 SDK 使用 `img.src = url` 加载图片，可以在 iframe 内 patch `HTMLImageElement.prototype.src` 的 setter，拦截 `/media/` 路径并重定向到 blob URL。  
同时，为了解决 x2t 重命名问题，直接从原始 DOCX ZIP 字节中提取图片（保留原始文件名）。

### 2.2 第一层：iframe 内 HTMLImageElement.prototype.src patch

在 `vite.config.ts` 的 `buildPatch()` 中注入（注入方式与字体 XHR patch 相同，写入 editor `<head>`）：

```javascript
(function patchImageUrls() {
  var srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (!srcDesc || !srcDesc.set) return;
  var origSet = srcDesc.set;
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set: function(url) {
      if (typeof url === 'string' && url.indexOf('/media/') !== -1) {
        var parts = url.split('/');
        var fname = parts[parts.length - 1].split('?')[0];
        var cache = window.parent && window.parent.__mediaCache;
        if (cache && fname) {
          var blobUrl = cache['media/' + fname];
          if (blobUrl) {
            console.log('[OO vite-patch] image redirect', fname, '->', blobUrl.slice(0, 60));
            url = blobUrl;
          }
        }
      }
      origSet.call(this, url);
    },
    get: srcDesc.get,
    configurable: true,
    enumerable: srcDesc.enumerable,
  });
})();
```

拦截逻辑：
- SDK 设置 `img.src = '/media/word/media/image2.png'`
- 提取最后一段文件名：`image2.png`
- 查找 `window.parent.__mediaCache['media/image2.png']`（从父页面获取，同源可访问）
- 替换为 blob URL：`img.src = 'blob://...'`

### 2.3 第二层：browser-side ZIP 解析（`src/lib/docx-zip.ts`）

新增工具模块，直接解析 DOCX 的 ZIP 字节，提取 `word/media/*`，**保留原始文件名**：

```typescript
export async function extractDocxMediaUrls(docxBytes: Uint8Array): Promise<Record<string, string>>;
```

实现要点：
1. 查找 ZIP End of Central Directory（`PK\x05\x06`）
2. 遍历 Central Directory 条目（`PK\x01\x02`）
3. 筛选 `word/media/*` 路径
4. 读取本地文件头，确定数据起始偏移
5. 若压缩方式为 DEFLATE（method=8），使用 `DecompressionStream('deflate-raw')` 解压
6. 创建 blob URL，key 格式为 `"media/image1.png"`

返回 `{ "media/image1.png": "blob://...", "media/image1.tiff": "blob://...", ... }`，文件名与原始 DOCX 一致。

### 2.4 集成到 `src/lib/onlyoffice-editor.ts`

#### 在 `createEditorInstance` 入口处，初始化 `__mediaCache`

```typescript
// Publish media blob URLs so the iframe's HTMLImageElement.src patch can redirect.
(window as unknown as Record<string, unknown>).__mediaCache = mediaUrls ?? {};
```

`mediaUrls` 来自 x2t 提取（仅作为初始值，后续被 ZIP 解析覆盖）。

#### 在 `asc_openDocumentFromBytes` 调用前，用 ZIP 解析结果更新 cache

```typescript
if (['docx', 'xlsx', 'pptx'].includes(fileType.toLowerCase())) {
  const zipMedia = await extractDocxMediaUrls(ooxmlBytes);
  const cache = window.__mediaCache as Record<string, string>;
  for (const [key, url] of Object.entries(zipMedia)) {
    cache[key] = url; // 覆盖 x2t 可能重命名的条目
  }
  console.log('[OO] media cache updated from ZIP:', Object.keys(zipMedia));
}
api.asc_openDocumentFromBytes(ooxmlBytes);
```

---

## 三、验证

### 3.1 控制台日志（成功路径）

```
[OO] media cache updated from ZIP: ['media/image1.png', 'media/image1.tiff', 'media/image2.png', 'media/image3.png']
[OO] asc_openDocumentFromBytes 381775 bytes
[OO vite-patch] image redirect image2.png -> blob:http://localhost:5173/419b4d14...
[OO vite-patch] image redirect image3.png -> blob:http://localhost:5173/54c89536...
[OO vite-patch] image redirect image1.tiff -> blob:http://localhost:5173/09c6ba6c...
[OO vite-patch] image redirect image1.png -> blob:http://localhost:5173/63075ffd...
Document loaded: test-report.docx
```

全部 4 张图片均成功重定向到 blob URL。

### 3.2 网络层

修复前：
- `GET /media/word/media/image1.tiff [304]` → 浏览器缓存的 HTML（6640 字节）
- SDK 收到 HTML，无法解码，图片空白

修复后：
- 请求在 `img.src = url` 设置时被 patch 拦截，URL 替换为 `blob://...`
- 网络层无 `/media/word/media/` 请求（因 src 在设置前已被替换）

### 3.3 单元测试

```bash
pnpm run test   # 7 files / 96 tests passed
pnpm run lint:ts  # 0 errors
```

---

## 四、约束与限制

### 4.1 TIFF 格式

Chrome 不原生支持 `<img>` 标签中的 TIFF。`image1.tiff` 的 blob URL 虽已正确重定向，但 Chrome 可能仍无法渲染。这是浏览器兼容性问题，不是本修复的责任范围。

### 4.2 生产环境

`HTMLImageElement.prototype.src` patch 通过 `vite.config.ts` 的 `buildPatch()` 注入 editor iframe 的 `<head>`，由 Vite 中间件服务端注入（`onlyofficeWebModePatch` 插件）。

`configurePreviewServer` 已注册，因此 `pnpm preview` 模式也会生效。  
但静态托管（GitHub Pages）没有 Vite 服务端，此 patch 不适用。生产环境需要 Service Worker 方案或服务端 ZIP 提取。

### 4.3 `__mediaCache` 生命周期

blob URL 在 `createEditorInstance` 时创建，但从未调用 `URL.revokeObjectURL()`。  
每次打开文档都会泄漏 blob。对于短会话不成问题，长时间运行或频繁切换文档时可能积累。  
后续可在 `destroyEditor` 时清理 `window.__mediaCache` 中的所有 blob URL。

---

## 五、文件变更汇总

| 文件 | 变更说明 |
|------|---------|
| `src/lib/docx-zip.ts` | 新增，browser-side ZIP 解析器，提取 `word/media/*` 为 blob URL（保留原始文件名）|
| `src/lib/onlyoffice-editor.ts` | 新增 `__mediaCache` 初始化；在 `asc_openDocumentFromBytes` 前用 ZIP 解析结果更新 cache |
| `vite.config.ts` | 在 `buildPatch()` 新增 `patchImageUrls()` — 拦截 `HTMLImageElement.prototype.src` setter，将 `/media/` 路径重定向到 blob URL |
