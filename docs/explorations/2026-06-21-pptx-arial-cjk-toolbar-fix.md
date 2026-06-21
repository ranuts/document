# PPTX Arial字体中文乱码 & 工具栏失效修复

**日期：** 2026-06-21  
**分支：** `explore/path-d-desktop-mock`  
**提交：** `8e152bd`  
**影响文件：** `public/font-map.json`、`src/lib/docx-zip.ts`

---

## 一、问题现象

`EMP 微前端解决方案.pptx`（WPS 导出，使用 Arial 作为主题默认字体）打开后出现两个问题：

1. **中文字符部分不可见**：幻灯片中大量汉字显示为空白，但间距正常（字符的 advance width 有效，字形本身不渲染）。例如"微前端概述"只显示"前端"，"什么是"显示为空。
2. **工具栏完全失效**：所有工具栏按钮点击无响应。

同批 PPTX 文件中有 `docProps/app.xml` 的文件（`GoldVideo.pptx` 等）加载正常，而 EMP 文件同时缺少 `app.xml` 和 `core.xml`。

---

## 二、字体乱码根因

### 2.1 字体请求网络分析

通过 Chrome DevTools 网络面板观察字体请求：

| 请求 URL | 状态 | 说明 |
|---------|------|------|
| `/fonts/LiberationSans-Regular.ttf` | 200 | 正常（Arial 映射目标）|
| `/fonts/NotoSansSC-Subset-LongLoca.ttf` | 304（旧缓存）| ❌ 旧 176KB 子集，未被拦截 |
| `/fonts/DejaVuSans.ttf` | 200 | fontRemapMiddleware 正确拦截 → NotoSansSC-Regular.ttf |

关键发现：**FreeType 渲染引擎直接通过 HTTP GET 请求 `NotoSansSC-Subset-LongLoca.ttf`**，而 `fontRemapMiddleware` 只拦截 `font-map.json` 中有 KEY 的字体。`NotoSansSC-Subset-LongLoca.ttf` 是旧子集文件，只有 ~501 个常用汉字，其他汉字渲染为不可见 tofu。

### 2.2 为什么 DOCX 没有这个问题

DOCX 文件（使用 `msyh.ttc` 字体）的渲染路径：
- HarfBuzz（XHR 路径）：`ascdesktop://fonts/msyh.ttc` → font-map.json → `/fonts/NotoSansSC-Regular.ttf` ✓
- FreeType（HTTP 直接路径）：`/fonts/DejaVuSans.ttf` → fontRemapMiddleware 拦截 → NotoSansSC-Regular.ttf ✓

PPTX 文件（使用 `Arial` 字体）的渲染路径：
- HarfBuzz：Arial → `LiberationSans-Regular.ttf`（无 CJK）→ 回退到 SimSun/NotoSansSC-Regular ✓
- FreeType：`/fonts/NotoSansSC-Subset-LongLoca.ttf`（直接请求子集）→ middleware **未拦截** → 176KB 子集 ❌

### 2.3 可见字符 vs 不可见字符

NotoSansSC-Subset-LongLoca.ttf 仅覆盖约 501 个最常用汉字。在幻灯片中：
- 可见：前(U+524D)、端(U+7AEF)、是(U+662F)、的(U+7684)、技(U+6280)、术(U+672F)——在子集内
- 不可见：微(U+5FAE)、概(U+6982)、述(U+8FF0)、什(U+4EC0)、么(U+4E48)——不在子集内

字符的 advance width（排版宽度）由 HarfBuzz 根据 NotoSansSC-Regular.ttf 计算，所以间距正确但字形空白。

### 2.4 修复

在 `public/font-map.json` 添加一行：
```json
"notosanssc-subset-longloca.ttf": "NotoSansSC-Regular.ttf"
```

`fontRemapMiddleware` 做 case-insensitive 匹配（`filename.toLowerCase()`），拦截 `/fonts/NotoSansSC-Subset-LongLoca.ttf` 并返回完整的 10.1MB 字体，同时设置 `Cache-Control: no-store`。

---

## 三、工具栏失效根因

### 3.1 错误堆栈

```
changesError: Error: Uncaught TypeError: Cannot read properties of undefined (reading '$window')
  at n.onError (app.js:8:1609409)
  at Jt (app.js:8:94698)
  at f.<anonymous> (app.js:8:95126)
  at f.<anonymous> (app.js:8:88183)
  at f.Ec (sdk-all-min.js:1783:477)
  at yn.lDa (sdk-all-min.js:1559:14)
  at e.eBe (sdk-all-min.js:243:165)
  at zo.lDa (sdk-all-min.js:236:137)
  at s.<anonymous> (sdk-all-min.js:275:51)
  at L.emit (socket.io.min.js:6:7123)
```

socket.io 触发连接失败事件 → SDK 的 changesError 处理器调用 → `n.onError` 崩溃（`undefined.$window`）。

### 3.2 根因：缺少 docProps/core.xml

对比各文件的 `_rels/.rels` 关系：

| 文件 | `core.xml` 关系 | `app.xml` 关系 | 工具栏 |
|------|---------------|---------------|-------|
| `GoldVideo.pptx` | ✅ rId1 | ❌ | ✅ 正常 |
| `TypeScript Primer.pptx` | ✅ rId1 | ❌ | ✅ 正常 |
| `EMP 微前端解决方案.pptx` | ❌ | ❌ | ❌ 失效 |

EMP 的 `_rels/.rels` 只有一个关系（指向 `ppt/presentation.xml`），完全没有 `docProps/core.xml` 的引用，文件也不存在。

`docProps/core.xml`（核心属性，包含标题、作者、修改日期等）是 OOXML 可选文件，但 OnlyOffice 的 changesError 控制器依赖它完成初始化。当 core.xml 缺失时，控制器的 `$window` 依赖注入（AngularJS DI）未能完成，`onError` 方法里访问 `this.$window` 时崩溃，导致整个主控制器进入错误状态，工具栏停止响应。

这个错误在 `previouslyParsed PPTX` 中被 socket.io 的连接失败事件触发（即使在 Web Mode 下没有 socket.io 服务器，SDK 也会尝试连接并在失败时触发错误路由）。

### 3.3 修复

在 `preprocessPptx()` 中，当 `docProps/core.xml` 不存在时：
1. 注入最小有效 `core.xml`：
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="..." xmlns:dc="..." xmlns:dcterms="..." xmlns:xsi="...">
  <dc:title/><dc:creator/>
</cp:coreProperties>
```
2. 在 `_rels/.rels` 中添加 `core-properties` 关系：
```xml
<Relationship Id="rId3" Type=".../core-properties" Target="docProps/core.xml"/>
```

---

## 四、效果验证

修复前（EMP）：
- 大量中文字符不可见（微、概、述、什、么 等）
- 工具栏按钮点击无响应
- 控制台：`changesError: Cannot read properties of undefined (reading '$window')`

修复后（EMP）：
- 全部中文字符正确显示："EMP 微前端解决方案"、"微前端概述·什么是微前端" 等
- 工具栏 Add Slide、Text Box、Image、Bold/Italic 等全部可用
- 控制台：只有预期的 WebSocket 警告（无 socket.io 服务器时的正常行为）

---

## 五、为什么只有 WPS/Impress 导出的文件受影响

| 属性 | WPS / Impress 导出 | Microsoft PowerPoint 导出 |
|------|---------------------|--------------------------|
| `docProps/core.xml` | 有时省略 | 总是包含 |
| `docProps/app.xml` | 常常省略 | 总是包含 |
| 默认主题字体 | Arial（系统 Latin 字体）| Calibri（Microsoft 字体）|
| FreeType CJK 字体路径 | NotoSansSC-Subset（内置回退）| 通过 XHR 路径加载正确字体 |

---

## 六、fontRemapMiddleware 覆盖范围（更新后）

现在 middleware 可拦截以下对 FreeType 渲染系统的关键字体请求：

| 请求 URL（HTTP GET） | 服务文件 | 用途 |
|--------------------|---------|------|
| `/fonts/DejaVuSans.ttf` | NotoSansSC-Regular.ttf | DOCX/XLSX 系统渲染字体 |
| `/fonts/NotoSansSC-Subset-LongLoca.ttf` | NotoSansSC-Regular.ttf | PPTX CJK 渲染字体（修复此问题）|

其他字体通过 XHR `ascdesktop://fonts/` 路径加载，由 font-map.json + XHR patch 处理。
