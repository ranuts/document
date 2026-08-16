# FAB 菜单加主题切换（2026-08-16）

编辑器跟随站点主题（`lib/editor-theme.ts`）落地后留下的缺口：文档一打开
首页 hero（连同页脚的 `<r-theme-switch>`）就隐藏，用户没有任何地方切换主题。

改动：`lib/ui.ts` 的 FAB 菜单末尾追加一行 `Div.fab-menu-item.fab-menu-theme`
包一个 `View('r-theme-switch')`（ranui builder 直接建自定义元素），
label / label-system / label-light / label-dark 走 i18n 新词条
`themeLabel/themeSystem/themeLight/themeDark`（zh：主题/跟随系统/浅色/深色）；
`styles/base.css` 给该行居中 + 顶部 hairline、去 hover 填充（它是控件不是
命令）。`index.ts` 早已 `import 'ranui/theme-switch'`。

验证：真浏览器 `?new=docx` → hover Menu → 点"Dark"：`<html data-ran-theme>`
= dark、`ran-theme` 存 dark、菜单面板底色随 token 变深、编辑器
`currentThemeId()` = theme-dark。注意 r-theme-switch 是 closed shadow，
脚本里拿不到内部按钮，用 a11y 树（button "Dark"）点。
