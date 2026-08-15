# 编辑器界面默认改用经典 Office 主题（theme-classic-light）

日期：2026-08-15

## 现象

v9 转正后编辑器界面是纯白扁平风（工具栏头与页面同色），用户希望回到
经典 Office 观感（Word 蓝 / Excel 绿 / PPT 橙的工具栏头）。

## 根因

v9 加载器 `web-apps/apps/*/main/index.html` 里：

```js
window.uitheme.DEFAULT_LIGHT_THEME_ID = !window.isIEBrowser ? 'theme-white' : 'theme-classic-light';
```

非 IE 浏览器的浅色默认是 `theme-white`；vendor 里 `theme-classic-light` 完整
可用（`app.js` 主题表含 classic-light / light / white / gray / dark /
contrast-dark / system）。我们的配置没有传 `customization.uiTheme`，于是走
默认。

## 启动时主题解析顺序（决定实现方式）

同一段 index.html：

1. `uitheme.set_id(localStorage.getItem("ui-theme-id"))` —— 先读用户在编辑器
   里选过的主题；
2. `if (params.uitheme) { ... }` —— 再被 frame URL 参数覆盖；`api.js` 把
   `editorConfig.customization.uiTheme` 拼成这个 `uitheme=` 参数。

也就是说 **配置值总是赢过用户存储的选择**。如果每次挂载都硬传
`theme-classic-light`，用户在"文件 → 高级设置 → 界面主题"里改的主题会在下一次
打开时被冲掉。

## 修法

`lib/onlyoffice-editor.ts` 新增 `resolveUiTheme()`：优先返回同源
`localStorage['ui-theme-id']`（编辑器 iframe 与页面同源、同一 storage），没有
时才回退 `DEFAULT_UI_THEME = 'theme-classic-light'`；`createPersonalEditorInstance`
的 `customization.uiTheme` 使用它。`types/editor.d.ts` 补 `uiTheme?: string`。

## 用例

- 单测 `test/unit/onlyoffice-editor.test.ts`：无存储 → classic；存储
  `theme-dark` → 保留。
- E2E `test/e2e/main-site.spec.ts`（New Excel 流）：断言编辑器 frame 的
  `body` 带 `theme-classic-light`（真实 v9 编辑器，已在本地跑绿）。

## 备注

- 图表 / OLE 子编辑器自己读 `localStorage['ui-theme-id']`（默认 theme-light）；
  用户没手选过时它们仍是浅色扁平，属于弹窗内的次要界面，先不追。
- 若日后要暴露"暗色 / 跟随系统"给站点设置，直接写 `ui-theme-id` 即可，
  `resolveUiTheme` 会带过去。
