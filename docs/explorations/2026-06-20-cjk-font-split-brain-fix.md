# CJK 中文乱码：split-brain 渲染根因分析与修复

**日期：** 2026-06-20  
**分支：** `explore/path-d-desktop-mock`  
**前置文档：** [2026-06-19-word-excel-ppt-browser-debug.md](2026-06-19-word-excel-ppt-browser-debug.md)

---

## 背景

在打开本地 DOCX 文件（字体：Microsoft YaHei / `msyh.ttc`，标题"新东方大学事业部第6期高潜人才联合选拔工作报告"）时，
全部中文字符显示为 Latin 乱码：`Š`、`ä`、`š`、`ı`、`ê`、`ã` 等，而非预期的汉字。

已有的 JS-level XHR patch（将 `ascdesktop://fonts/msyh.ttc` 重写为 `/fonts/NotoSansSC-Subset-LongLoca.ttf`）
从网络层看已生效，服务端也返回了正确字节，但渲染结果仍然错误。

---

## 一、确认根因：split-brain 渲染

### 1.1 乱码字符与 GID 的精确对应

通过 Python + fonttools 分析 `public/fonts/DejaVuSans.ttf` 的 glyph 顺序：

| 汉字（正确） | GID | DejaVuSans 中的字符（错误） |
|------------|-----|--------------------------|
| 新          | 290 | Š (U+0160, Scaron)       |
| 东          | 166 | ä (U+00E4, adieresis)    |
| 方          | 291 | š (U+0161, scaron)       |
| 大          | 238 | İ (U+0130, Idotaccent)   |
| 学          | 243 | ı (U+0131, dotlessi)     |
| 事          | 172 | ê (U+00EA, ecircumflex)  |

6 个字符全部与实际乱码内容**完全吻合**。

这意味着：
- **HarfBuzz 塑形**使用了 NotoSansSC 的 GID 空间（290=新，166=东）
- **FreeType 渲染**使用了 DejaVuSans 的 face（相同 GID → Latin 字符）

### 1.2 对照实验验证

| 实验 | msyh.ttc 映射目标 | 显示结果 | 结论 |
|------|-----------------|---------|------|
| A | `DejaVuSans.ttf` | □ (tofu，CJK GID 0) | HarfBuzz 用 DejaVuSans 找不到 CJK → GID=0 |
| B | `NotoSansSC-Subset-LongLoca.ttf` | Š ä š ı ê ã（乱码）| HarfBuzz 给 CJK GID，渲染用 DejaVuSans → Latin |
| C（修复后）| 同 B，但 DejaVuSans 也重定向到 NotoSansSC | 新东方大学事业部...（正确）| 两条路径一致 |

实验 A → B 的变化证明塑形（HarfBuzz）路径**已被正确拦截**，问题在渲染（FreeType）路径。

---

## 二、SDK 的两条字体加载路径

### 2.1 文档字体（XHR 路径）

`public/sdkjs/word/sdk-all-min.js` 中文档字体通过 XHR 加载：

```javascript
var h = new XMLHttpRequest;
h.open("GET", "ascdesktop://fonts/" + a, !0);
h.responseType = "arraybuffer";
```

我们在 vite.config.ts 的 `onlyofficeWebModePatch` 插件中，向 iframe HTML `<head>` 注入脚本，
patch `window.XMLHttpRequest.prototype.open`，将 `ascdesktop://fonts/<name>` 重写为
`/fonts/<mapped>`（根据 `public/font-map.json`）。该拦截**确认有效**。

### 2.2 系统字体（直接 HTTP GET 路径）

SDK 初始化时，还会直接加载一批系统/兜底字体：

```
GET /fonts/DejaVuSans.ttf         200
GET /fonts/DejaVuSansMono.ttf     200
GET /fonts/LiberationSans-Regular.ttf  200
GET /fonts/LiberationSans-Bold.ttf     200
...
```

这批请求**不走 `ascdesktop://fonts/` 路径**，直接请求 `/fonts/<name>`，完全绕过了
`window.XMLHttpRequest.prototype.open` 的 patch。

### 2.3 为什么 JS XHR patch 无效

在调试过程中，对父页面和 iframe 的 `XMLHttpRequest` 都加了 `console.log`，
重新加载页面并打开文档后，**没有任何 `[IFRAME-XHR]` 或 `[PARENT-XHR]` 日志**
对应这些 `/fonts/DejaVuSans.ttf` 请求。

也就是说这些请求**根本没有通过 `window.XMLHttpRequest`**，
而是通过某个 JS patch 无法覆盖的内部机制发出的。

经过排查，可排除：
- Web Worker（SDK 只有拼写检查用 Worker，无字体 Worker）
- `fetch()`（全 SDK 无 font 相关 `fetch()` 调用）
- 浏览器缓存（清除缓存后问题复现）

最合理的解释：这些系统字体请求发生在 SDK 最早期初始化阶段，
可能早于 iframe HTML 中的 patch 脚本执行，或通过 emscripten 内部的
同步 XHR（`readBinary`）机制绕过了原型链 patch。

---

## 三、修复方案

### 3.1 思路

既然 JS 层拦截不到这些请求，就在 **HTTP 服务端层面**拦截。
Vite dev server 基于 Node.js `http.Server`，可以在 `configureServer` 里注册自定义 middleware，
先于 Vite 自己的静态文件服务处理请求。

这样无论请求来自哪个 JS 上下文（主线程、Worker、emscripten），
只要到达服务端，就会被重定向。

### 3.2 实现：`fontRemapMiddleware` 插件

在 `vite.config.ts` 新增一个 Vite 插件（注册在 `plugins[]` 最前面）：

```typescript
function fontRemapMiddleware(): Plugin {
  const FONT_MAP_PATH = path.join(__dirname, 'public', 'font-map.json');
  const FONTS_DIR = path.join(__dirname, 'public', 'fonts');
  let cachedMap: Record<string, string> | null = null;

  async function loadMap(): Promise<Record<string, string>> {
    if (cachedMap !== null) return cachedMap;
    try {
      const raw = await fs.readFile(FONT_MAP_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, string>;
      delete parsed['_comment'];
      cachedMap = parsed;
    } catch { cachedMap = {}; }
    return cachedMap;
  }

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url || req.method !== 'GET') return next();
    const match = /^\/fonts\/([^?#]+)/.exec(req.url);
    if (!match) return next();

    const filename = match[1].toLowerCase();
    const map = await loadMap();
    const mapped = map[filename];
    if (!mapped || mapped.toLowerCase() === filename) return next();

    const targetPath = path.join(FONTS_DIR, mapped);
    try {
      const data = await fs.readFile(targetPath);
      console.log(`[vite:font-remap] ${filename} → ${mapped} (${data.length} bytes)`);
      res.setHeader('Content-Type', 'font/truetype');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(data);
    } catch { next(); }
  };

  return {
    name: 'font-remap',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
```

### 3.3 font-map.json 关键映射

```json
{
  "dejavusans.ttf":             "NotoSansSC-Subset-LongLoca.ttf",
  "dejavusans-bold.ttf":        "NotoSansSC-Subset-LongLoca.ttf",
  "dejavusans-oblique.ttf":     "NotoSansSC-Subset-LongLoca.ttf",
  "dejavusans-boldoblique.ttf": "NotoSansSC-Subset-LongLoca.ttf",
  "liberationsans-regular.ttf": "NotoSansSC-Subset-LongLoca.ttf",
  "liberationsans-bold.ttf":    "NotoSansSC-Subset-LongLoca.ttf",
  ...
  "msyh.ttc":   "NotoSansSC-Subset-LongLoca.ttf",
  "simsun.ttc": "NotoSansSC-Subset-LongLoca.ttf",
  ...
}
```

**核心逻辑**：将系统兜底字体（DejaVuSans、LiberationSans）与文档 CJK 字体（msyh、simsun 等）
全部映射到**同一个** `NotoSansSC-Subset-LongLoca.ttf`，
使 HarfBuzz（塑形）和 FreeType（渲染）共用同一 GID 空间，消除 split-brain。

### 3.4 `NotoSansSC-Subset-LongLoca.ttf` 的构造

标准 NotoSansSC-Regular.ttf（~10MB）无法直接使用，因为 `indexToLocFormat=0`（SHORT loca），
而 SHORT loca 限制单个 glyph 的偏移不超过 `0x1FFFE` 字节，不适合大字体作为兜底字体使用。

通过 fonttools 从 NotoSansSC-Regular.ttf 中提取测试文档的字符子集（501 个 glyph），
再添加 200 个占位 glyph（每个含 400 个点，4条等高线），将 glyf 表撑过 131,070 字节，
强制 fonttools 生成 `indexToLocFormat=1`（LONG loca），最终文件 176KB。

```python
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen

font = TTFont('NotoSansSC-Regular.ttf')
# ... subset to test doc chars ...

# Force LONG loca by padding with 200 dummy glyphs (400 pts each)
for i in range(200):
    pen = TTGlyphPen(None)
    for _ in range(4):
        pen.moveTo((0, 0))
        for j in range(100):
            pen.lineTo((j * 10, j * 10))
        pen.closePath()
    glyph = pen.glyph()
    font['glyf'].glyphs[f'dummy_{i}'] = glyph
    # also update hmtx, cmap ...

font['head'].indexToLocFormat = 1
font.save('NotoSansSC-Subset-LongLoca.ttf')
```

---

## 四、验证

### 4.1 服务端日志（dev server 启动后打开文档）

```
[vite:font-remap] dejavusans.ttf → NotoSansSC-Subset-LongLoca.ttf (179980 bytes)
[vite:font-remap] liberationsans-regular.ttf → NotoSansSC-Subset-LongLoca.ttf (179980 bytes)
[vite:font-remap] liberationsans-italic.ttf → NotoSansSC-Subset-LongLoca.ttf (179980 bytes)
[vite:font-remap] liberationsans-bold.ttf → NotoSansSC-Subset-LongLoca.ttf (179980 bytes)
[vite:font-remap] liberationsans-bolditalic.ttf → NotoSansSC-Subset-LongLoca.ttf (179980 bytes)
[vite:font-remap] dejavusansmono*.ttf → NotoSansSC-Subset-LongLoca.ttf (×4)
```

### 4.2 浏览器网络层

| 请求 | 状态 | 实际内容 |
|------|------|---------|
| `GET /fonts/DejaVuSans.ttf` | 200 | NotoSansSC-Subset 字节（由 middleware 返回）|
| `GET /fonts/LiberationSans-Regular.ttf` | 200 | NotoSansSC-Subset 字节 |
| `GET /fonts/NotoSansSC-Subset-LongLoca.ttf` | 304 | XHR patch 拦截 msyh.ttc 后的直接请求（缓存命中）|

两条路径的响应内容均为 NotoSansSC-Subset，GID 空间一致。

### 4.3 渲染结果

打开 `test-report.docx`（Microsoft YaHei 字体），标题正确显示：

> 新东方大学事业部第6期高潜人才联合选拔工作报告

正文中文字符全部正常，无乱码。

---

## 五、关键约束与限制

### 5.1 子集字体的局限

`NotoSansSC-Subset-LongLoca.ttf` 仅包含测试文档中出现的 501 个字形（汉字 + 基础 Latin）。
其他 CJK 文档中若含子集以外的汉字，将显示 tofu（□）。

生产化方案：
- 将映射目标改为完整 `NotoSansSC-Regular.ttf`（~10MB）
- 或在服务端按需动态生成子集（需要知道文档字符集）

NotoSansSC-Regular.ttf 已在 `.gitignore` 中排除（太大，需另行下载）。
当前 Git 仅提交 176KB 的 Subset 版本。

### 5.2 fonRemapMiddleware 仅作用于开发服务器

`configurePreviewServer` 也已注册，但生产构建（GitHub Pages 等静态托管）无服务端逻辑，
font-map.json 的 HTTP 层重定向**在生产环境不会生效**。

生产环境只有 JS-level XHR patch（`onlyofficeWebModePatch`），可拦截 `ascdesktop://fonts/` 路径，
但无法拦截系统字体的直接 HTTP GET。

如需在生产也修复 CJK 渲染，需要在 CDN/反向代理层配置 URL 重写规则，或改用 Service Worker 拦截。

### 5.3 缓存清理

`fontRemapMiddleware` 对 font-map.json 只读取一次（`cachedMap`），
修改 font-map.json 后需**重启 dev server** 才会生效（同 `onlyofficeWebModePatch` 的 `cachedFontMap`）。

---

## 六、文件变更汇总

| 文件 | 变更说明 |
|------|---------|
| `vite.config.ts` | 新增 `fontRemapMiddleware()` 插件，注册在 `plugins[]` 最前面 |
| `public/font-map.json` | 新增 `dejavusans*.ttf`、`liberationsans-*.ttf` → `NotoSansSC-Subset-LongLoca.ttf` 映射；CJK 字体（msyh、simsun 等）也指向同一文件 |
| `public/fonts/NotoSansSC-Subset-LongLoca.ttf` | 新增，176KB，NotoSansSC 子集字体，LONG loca（indexToLocFormat=1）|
| `.gitignore` | 新增排除 `NotoSans*-Regular.ttf`、`NotoSans*-Bold.ttf`、`NotoSans*-VF.ttf`、`NotoSerif*-VF.ttf`（各 5–24MB）及 `docs/screenshots/` |
| `CLAUDE.md` | 更新 Vite 中间件字体重写小节，补充 split-brain 根因与两层修复机制说明 |
