# 韩语三页在手机上横向滚动（2026-08-27）

## 现象

390px 视口下，`/ko/no-signup-document-editor`、`/ko/edit-documents-without-account`、
`/ko/private-document-editor` 的 `documentElement.scrollWidth` 比 `clientWidth` 宽 23px
——一列纯文字的页面可以左右拖动。桌面视口看不出来，其余 6 种语言的同一批页面都正常。

## 根因

三页的 `lead` 开头都是

```
Word(DOCX)·Excel(XLSX)·PowerPoint(PPTX)·CSV 파일을 …
```

这一串 41 个字符里**没有任何断行机会**：`·` 不是断点，括号里的是拉丁词。测得 393px，
而那一列只有 350px。溢出的元素并不会自己出现滚动条——它把**底下的页面**撑宽，于是
`html` / `body` / `.page` / `main.wrap` 的 scrollWidth 一起变成 413。

为什么只有韩语撞上：韩文可以在任意两个字之间断行，所以韩语页面此前从来不需要断点；
中文同理，但 zh-CN 的同一句话用的是 `、` 分隔，天然可断。ko 自己的其它页面
（`about.md`、`home.json`）写的也是 `Word(DOCX), Excel(XLSX), …`，逗号加空格。
所以这是这三页的写法与同语言其它页不一致，不是韩语本身的问题。

## 修法（两层）

1. **文案**：三页的 `·` 串改成 ko 其它页在用的 `, ` 分隔。
2. **样式**：`public/landing.css` 与 `public/home.css` 的 `body` 加
   `overflow-wrap: break-word`。只在一段文字**整行都放不下**时才断，正常排版不受影响。
   这层是给下一次准备的——下一个撑破页面的串多半也在一门这里没人读的语言里。

两层各自都能让用例变绿（分别验证过），一起上是因为它们防的不是同一件事：第一层修的是
这三页的排版，第二层修的是"任何页面都不该被一个串撑宽"。

## 用例

`test/e2e/mobile-overflow.spec.ts`：390px 视口，遍历 **sitemap 里的每一条 URL**
（不是抽样——下一个出问题的页面不会挑我们看得懂的语言），断言
`scrollWidth - clientWidth <= 1`。等 `document.fonts.ready`，因为回退字体的宽度和真字体不同。
整套跑完 8.8s。

反向验证：同时撤掉文案与 CSS 两处修复，用例报出

```
+ "/ko/edit-documents-without-account (+23px)"
+ "/ko/no-signup-document-editor (+23px)"
+ "/ko/private-document-editor (+23px)"
```

只撤 CSS（留文案）或只撤文案（留 CSS）都是绿的。

## 顺带

`node bin/sitemap-lastmod.mjs` 刷新了 163 条 lastmod——今天早些时候的
`refactor(build): split the page generator into bin/pages/` 动了模板，
`style(content)` 动了内容，两次都没跑这个脚本。

## 这一轮还查了什么（都没问题）

- 170 条生成路由，1280px 与 390px 两个视口：无控制台错误、无 4xx、无空控件、
  都有 h1/title、内部链接全部解析得到目标。
- 七种语言 `home.json`：只有 zh-CN 的 `cta` 是空的（已在上一个 PR 修掉），
  其余与 en 的槽位一一对应。
- `bin/design-audit.mjs`：容器宽度、行宽、顶栏高度全部符合 docs/design-system.md。
- 深色模式首页、`?locale=zh-CN` 的编辑器（工具栏中文、无弹框、控制台干净）。
