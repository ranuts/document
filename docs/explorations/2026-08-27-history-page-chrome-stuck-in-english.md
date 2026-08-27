# /history 的顶栏与标签页标题卡在英文（2026-08-27）

## 现象

`/history?locale=zh-CN`：正文全中文（标题"本机保存的文档"、按钮、保留规则），
而**语言切换器写着 English**、**浏览器标签写着 Local history**。
`<html lang>` 已经是 `zh-CN`。等于一边用中文读，一边被告知自己在英文站上。
七种语言都一样，只是英文看不出来。

## 根因

`/history` 是手写页（`history.html`，应用页，不进 sitemap、不由 `bin/build-pages.mjs`
生成），它的 `<title>` 与 `<span class="lang-current">English</span>` 是写死的英文字面量；
`lib/history-page.ts` 在运行时把**正文**换成当前语言，但从来没管这两处。
落地页没有这个问题——它们的当前语言是生成时写进 HTML 的。

CLAUDE.md 里已经记着同一类事故：`/history` 与 `/404` 的语言菜单曾经长期只列 en 和 zh，
因为它们是手写的。这次是同一个成因的另一面。

## 修法

`syncPageChrome()`（`lib/history-page.ts`，紧跟 `applyDocumentLanguage()`）：

- `document.title = t('historyTitle')`，与页面 h1 用同一个词条；
- 按 `<html lang>` 找到对应的 `<a class="lang-option" lang>`，把它的文字复制到
  `.lang-current`，并把 `is-current` / `aria-current="page"` 移到它身上。

**自称标签不另建一张表**：七种语言的自称已经在 DOM 里（每个 lang-option 一个），
再写一份就又多了一处要跟 `bin/pages/locales.mjs` 对齐的地方。

## 用例

`test/e2e/history-page.spec.ts` 加一条 `the chrome follows the language, not just the body`：
`?locale=zh-CN` 下断言 `<html lang>`、`.lang-current`、`aria-current` 的那一项都是"中文"，
且 `document.title` 等于页面 h1 的文字。

反向验证：撤掉 `syncPageChrome()`，该用例报 `Expected "中文" / Received "English"`；
恢复后 16 条全绿。
