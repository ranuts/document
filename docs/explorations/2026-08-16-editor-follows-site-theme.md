# 编辑器跟随站点深色/亮色主题（2026-08-16）

用户问"当前项目是否支持深色和亮色切换"。结论：站点层早就支持（ranui
`<r-theme-switch>` + `--ran-*` token，首页/落地页/embed-demo 全部覆盖），
但编辑器层不跟随——深色站点里点"新建文档"，弹出的是亮色的
`theme-classic-light` 编辑器。本轮把这一层补上。

## 机制

OnlyOffice 有自己的主题系统：启动时 `customization.uiTheme` →
`uitheme=` frame 参数；运行时 `Common.UI.Themes.setTheme(id)`；只有主题
**真的变化**时才把 `ui-theme-id` 写进 localStorage（实测挂载时不写）。
vendor 9.3 的 app.css 里 `theme-dark` / `theme-type-dark` 变量齐全，
`theme-system` 也在，但我们不用它——它的亮色分支是 `theme-light`，
而站点默认要 classic。

新增 `lib/editor-theme.ts`：

- `isSiteDark()`：`<html data-ran-theme>`（ranui 已把 system 解析成
  light/dark 写进去）→ localStorage `ran-theme` → `prefers-color-scheme`。
- `resolveEditorUiTheme(lightDefault)`：用户在编辑器里选过（`ui-theme-id`
  且 ≠ 我们上次驱动的值）→ 用用户的；否则 dark → `theme-dark`、light →
  classic，并把驱动值写到 `ui-theme-site-driven`。这个标记是关键：编辑器
  会把我们 setTheme 的值再存一份到 `ui-theme-id`，没有它下次一律被当作
  "用户手选"、跟随永远失效。
- `installEditorThemeFollow()`：MutationObserver 盯 `data-ran-theme` +
  `matchMedia('(prefers-color-scheme: dark)')`，变化时遍历 frames 找
  `Common.UI.Themes` 调 `setTheme`（`currentThemeId` 相同则跳过）。
  `lib/onlyoffice-editor.ts` 的 `resolveUiTheme()` 改为委托，模块加载时
  装一次监听。

## 验证

- `test/unit/editor-theme.test.ts` 9 条 + `onlyoffice-editor.test.ts` 新增
  "dark 站点 → uiTheme=theme-dark"；原有"用户选过的主题优先"仍绿。
- 真浏览器：`ran-theme=dark` 打开 `?new=docx` → 编辑器 body
  `theme-dark theme-type-dark`，`#toolbar` 计算色 `rgb(42,42,42)`；
  切 light → `theme-classic-light`（蓝色标题栏）；再切 dark → 回 dark，
  全程 `ui-theme-id` 与 `ui-theme-site-driven` 同步、不会被误判为用户选择。
- 一个截图坑：chrome-devtools `take_screenshot` 在主题刚切换后可能吐出
  上一帧（DOM 计算色已是 dark、截图仍亮）——resize 一下再截才是真实画面。
  以计算样式为准。

## 没做 / 后续

- 编辑器打开后站点顶栏隐藏，页面上没有主题切换入口；建议随方向六 2
  把 `<r-theme-switch>` 放进右下角 FAB Menu。
- 文档画布深色（`asc_setContentDarkMode`）刻意不跟随。
- 一处流程教训：上一轮给路线图打 ✅ 的 python 替换因表格被 prettier 重排
  而静默 no-op（没有 assert），本轮补回并给所有替换加了断言。
