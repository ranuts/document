# v7 字体 XHR 拦截修复 — #62/#64 Excel 渲染问题

**日期**：2026-06-22  
**关联 Issue**：[#62 Date input not displayed in Excel](https://github.com/ranuts/document/issues/62)、[#64 Right-aligned text disappears in Excel](https://github.com/ranuts/document/issues/64)

---

## 根因

### v7 SDK 的字体加载机制（两种 URL 格式）

v7 cell SDK 实际使用 **Windows 绝对路径** 发送字体 XHR 请求（浏览器测试中观察到）：

```
GET c:\Windows\Fonts\arial.ttf      → net::ERR_FAILED
GET c:\Windows\Fonts\Deng.ttf       → net::ERR_FAILED  (DengXian 中文字体)
GET c:\Windows\Fonts\calibri.ttf    → net::ERR_FAILED
```

注：SDK 代码里也有 `ascdesktop://fonts/` 协议路径（`sdk-all-min.js` line 21258），但在当前 macOS 浏览器环境中，SDK 检测到 Windows UA 特征（或其他条件）走了 Windows 路径分支。两种格式都需要拦截。

**在纯浏览器环境中**，两种格式都是无效协议/路径，XHR 请求静默失败。结果：

- `Deng.ttf`（DengXian，Excel 默认 CJK 字体）→ 无法加载 → 中文日期字符显示为空白（#62）
- `calibri.ttf`（Excel 默认西文字体）→ 无法加载 → HarfBuzz 按 calibri 字宽塑形，但 FreeType 按 DejaVuSans 渲染，字体度量不匹配，右对齐文字溢出/消失（#64）

### v9 为何不受影响

v9 在三个编辑器 iframe HTML 的 `<head>` 最前面注入了 `onlyoffice-iframe-patch.js`，其中包含：

1. **XHR 拦截**：`XMLHttpRequest.prototype.open` patch，将 `ascdesktop://fonts/<file>` 重写为 `/fonts/<mapped>`
2. **HTTP 层重映射**：`fontRemapMiddleware` Vite 插件在 HTTP 层把 `/fonts/<file>` 请求转到 font-map.json 指定的实际文件

v7 之前没有这两层机制。

---

## 修复方案

### 三步机制（与 v9 完全对称）

**1. `apps/web/public-v7/font-map.json`（新建）**

字体名称映射表，与 v9 逻辑相同，但映射目标改用 v7 实际拥有的字体文件（VF 变体而非 Regular 分离文件）：

| 分类 | 示例 | 映射目标 |
|---|---|---|
| CJK 简体中文 | `msyh.ttc`, `simsun.ttc` | `NotoSansSC-VF.ttf` |
| CJK 繁体中文 | `msjh.ttc` | `NotoSansTC-VF.ttf` |
| CJK 日文 | `msgothic.ttc`, `meiryo.ttc` | `NotoSansJP-VF.ttf` |
| CJK 韩文 | `malgun.ttf`, `batang.ttc` | `NotoSansKR-VF.ttf` |
| DejaVuSans 系列 | `dejavusans.ttf` | `NotoSansSC-VF.ttf`（split-brain 修复）|
| LiberationSans 系列 | `liberationsans-regular.ttf` | `NotoSansSC-VF.ttf`（split-brain 修复）|
| Arial/Calibri 等 | `arial.ttf`, `calibri.ttf` | `LiberationSans-Regular.ttf` |

**关键**：DejaVuSans 和 LiberationSans 映射到 `NotoSansSC-VF.ttf` 是为了修复 **split-brain 渲染**：
- HarfBuzz 塑形使用文档字体（通过 XHR 拦截后获得 NotoSansSC）→ 返回 CJK GID
- FreeType 渲染使用 DejaVuSans（通过 HTTP GET 直接加载）→ 相同 GID 是 Latin 字符 → 乱码

`fontRemapMiddleware` 在 HTTP 层把 `/fonts/DejaVuSans.ttf` 重定向到 `NotoSansSC-VF.ttf`，使两层使用相同字体。

**2. `apps/web/public-v7/onlyoffice-v7-iframe-patch.js`（新建，2026-06-22 更新补 Windows 路径格式）**

XHR patch 脚本，拦截三种字体 URL 格式：

```js
(function () {
  var fontMap = {};
  fetch('/font-map.json')
    .then(function (r) { return r.json(); })
    .then(function (m) { delete m._comment; fontMap = m; })
    .catch(function () {});

  var FALLBACK = 'NotoSansSC-VF.ttf';

  function extractFilename(path) {
    return path.split(/[/\\]/).pop().toLowerCase();
  }

  var origOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (typeof url === 'string') {
      var fn;
      if (url.indexOf('ascdesktop://fonts/') === 0) {
        // Scheme 1: ascdesktop://fonts/<file>
        fn = extractFilename(url.slice(19));
        arguments[1] = '/fonts/' + (fontMap[fn] || FALLBACK);
      } else if (/^[a-zA-Z]:[/\\]/.test(url)) {
        // Scheme 2: Windows absolute path c:\Windows\Fonts\<file>
        fn = extractFilename(url);
        arguments[1] = '/fonts/' + (fontMap[fn] || FALLBACK);
      } else if (url.indexOf('/fonts/') !== -1) {
        fn = url.slice(url.lastIndexOf('/fonts/') + 7).toLowerCase();
        if (fontMap[fn]) arguments[1] = '/fonts/' + fontMap[fn];
      }
    }
    return origOpen.apply(this, arguments);
  };
})();
```

**3. 三个编辑器 iframe HTML 文件注入（修改）**

在 `<head>` 最前面添加 `<script src="/onlyoffice-v7-iframe-patch.js"></script>`：

- `public-v7/web-apps/apps/documenteditor/main/index.html`
- `public-v7/web-apps/apps/spreadsheeteditor/main/index.html`
- `public-v7/web-apps/apps/presentationeditor/main/index.html`

**4. `vite.v7.config.ts` 添加 `fontRemapMiddleware()`**

```ts
plugins: [fontRemapMiddleware(), injectCriticalStyle(), injectGtag()],
```

`fontRemapMiddleware` 读取 `publicDir`（即 `public-v7/`）下的 `font-map.json`，在 Vite dev server 和 preview server 的 HTTP 层重映射 `/fonts/<file>` 请求。

---

## v7 vs v9 字体差异

| 字体文件 | v7 | v9 |
|---|---|---|
| `NotoSansSC-Regular.ttf` | ❌ 无 | ✅ 有（10.1MB）|
| `NotoSansSC-VF.ttf` | ✅ 有（16.9MB）| ✅ 有（16.9MB）|
| `NotoSansJP-Regular.ttf` | ❌ 无 | ✅ 有 |
| `NotoSansJP-VF.ttf` | ✅ 有（9.1MB）| ✅ 有 |
| 其他 Noto 语言 | VF 版本 | Regular + VF 版本 |

v7 的 font-map.json 使用 VF 变体（变量字体），功能等价，只是文件大于 Regular 分离版本，但包含完整的字符覆盖范围。

---

## 预期效果

| 问题 | 修复前 | 修复后 |
|---|---|---|
| #62 Excel 中文日期不显示 | `msyh.ttc` XHR 失败 → 无 CJK 字体 → 空白 | XHR 拦截 → `/fonts/NotoSansSC-VF.ttf` → 中文字符正常渲染 |
| #64 Excel 右对齐文字消失 | Calibri XHR 失败 → font metrics 不匹配 → 布局错乱 | XHR 拦截 → Liberation 字体 → 度量接近 calibri → 布局修复 |
| CJK split-brain 乱码 | FreeType 用 DejaVuSans（Latin GID）、HarfBuzz 按 CJK 字宽塑形 | HTTP 层重映射 DejaVuSans → NotoSansSC → 两层同一字体 |

---

## 已验证

- `pnpm run test`: 96 tests passed
- `pnpm run lint:ts`: 无新增 TS 错误（现有警告来自 vendor 文件，与本次改动无关）
- **浏览器实测（2026-06-22）**：修复前 19 个字体请求全部 `net::ERR_FAILED`；修复后全部转为 `/fonts/LiberationSans-*.ttf` 和 `/fonts/NotoSansSC-VF.ttf`，HTTP 200/304 成功返回。Excel 编辑器工具栏文字（Normal/Neutral/Bad/Good）正常渲染，DengXian 字体识别正确。
