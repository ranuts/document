# MPA 路径路由系统设计

**日期**：2026-06-22  
**问题**：首页和编辑器页面共享同一路由，浏览器后退按钮无法返回首页  
**结论**：采用 MPA 多页路由，文档类型体现在路径中（`/docx/`、`/xlsx/`、`/pptx/`、`/csv/`）

---

## 背景

原架构中，首页（落地页 + 控制面板）和编辑器（OnlyOffice iframe）均渲染在同一 URL（`/`）。点击"新建 Word 文档"后，URL 不变，只在同一页面内切换 UI 状态。结果是：

- 后退按钮无效（URL 从未改变）
- 刷新编辑器会回到首页
- 无法通过 URL 直接打开特定类型文档

---

## 方案评估

### 排除方案 1：`history.pushState({view:'editor'})`

改变浏览器历史状态但 URL 不变。后退有效，但地址栏无变化，用户无法判断当前文档类型。

### 排除方案 2：Query 参数（`?new=xlsx`）

URL 变化，但文档类型藏在参数里，不清晰。无法用静态托管（GitHub Pages）直接托管特定路径。

### 采用方案 3：MPA 路径路由

每种文档类型对应独立 HTML 入口页面：

| URL | 文档类型 |
|-----|----------|
| `/` | 首页（落地页 + 控制面板） |
| `/docx/` | 新建/打开 Word 文档 |
| `/xlsx/` | 新建/打开 Excel 文档 |
| `/pptx/` | 新建/打开 PowerPoint 文档 |
| `/csv/` | 新建/打开 CSV 文档 |
| `/9.3.0/docx/` | v9 版本 Word 文档（同理） |

后退按钮自然生效——浏览器真实页面导航，无需 JS 介入。

---

## 实现细节

### 新增 HTML 页面

在 `apps/web/pages/` 下新增四个最小 HTML 入口：

```
pages/
  docx/index.html
  xlsx/index.html
  pptx/index.html
  csv/index.html
```

每个页面是精简的编辑器容器（无 SEO 内容）：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="../img/64.png" rel="shortcut icon" />
    <link rel="manifest" href="../manifest.json" />
    <title>Word Document Editor | ByBrowser</title>
    <script src="../web-apps/apps/api/documents/api.js"></script>
  </head>
  <body>
    <div id="app" class="w-full h-full">
      <div id="iframe"></div>
    </div>
  </body>
  <script type="module" src="../../src/index.ts"></script>
</html>
```

### Vite 入口点（`vite.shared.ts`）

```ts
export const rollupInputs = {
  main: resolve(__dirname, 'pages/index.html'),
  // Clean editor routes
  docx: resolve(__dirname, 'pages/docx/index.html'),
  xlsx: resolve(__dirname, 'pages/xlsx/index.html'),
  pptx: resolve(__dirname, 'pages/pptx/index.html'),
  csv: resolve(__dirname, 'pages/csv/index.html'),
  // ...legacy SEO pages
};
```

### 路由检测（`src/index.ts`）

```ts
const EDITOR_ROUTES: Record<string, string> = {
  '/docx/': '.docx',
  '/xlsx/': '.xlsx',
  '/pptx/': '.pptx',
  '/csv/': '.csv',
};

function getEditorExt(): string | null {
  const p = location.pathname;
  for (const [route, ext] of Object.entries(EDITOR_ROUTES)) {
    if (p.endsWith(route)) return ext;
  }
  return null;
}
```

`p.endsWith(route)` 同时兼容：
- v7 根路径：`/docx/`
- v9 前缀路径：`/9.3.0/docx/`

### 首页按钮导航（`src/lib/ui.ts`）

```ts
const newWordButton = createTextButton('new-word-button', t('newWord'), () => {
  window.location.href = './docx/';
});
```

使用相对路径 `./docx/`，无论部署在 `/` 还是 `/9.3.0/` 均可正确解析。

### FAB 菜单按钮（保持不变）

FAB（固定操作按钮）的菜单仍使用 `onCreateNew(ext)` 原地创建文档，这在编辑器路由上是预期行为——用户已在编辑器页，切换文档类型时不需要重新导航。

---

## 清理旧代码

移除了为前两个排除方案临时添加的代码：

- `document.ts`：删除 `pushEditorUrl()` 函数及全部调用（`onCreateNew`、`onOpenDocument`、`openDocumentFromUrl`）
- `ui.ts` `showControlPanel()`：删除 URL stripping（`history.replaceState` + `?new`/`?file`/`?src` 检测）
- `index.ts`：删除 `popstate` 监听器（MPA 真实页面导航，popstate 不再触发）

---

## 版本路由

两个版本的 Vite 构建（v7 和 v9）均使用相同的 `rollupInputs`，产物部署到不同前缀：

| 版本 | 部署路径 | 编辑器路由示例 |
|------|----------|---------------|
| v7（稳定版） | `/` | `/docx/` |
| v9（Beta） | `/9.3.0/` | `/9.3.0/docx/` |

`getEditorExt()` 中 `p.endsWith(route)` 对两者都适用。

---

## 验证

- `npx tsc --noEmit`：无错误
- 首页"新建 Word"点击 → 导航到 `/docx/`，编辑器自动打开新 Word 文档
- 浏览器后退 → 返回 `/`，显示首页控制面板
- `/docx/?src=https://...` → 编辑器路由自动从 URL 加载文档
