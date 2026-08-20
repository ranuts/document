# 拆掉 Tailwind，样式全部交给 ranui 设计体系（2026-08-20）

用户原话（光标停在 `styles/base.css` 第 1 行的 `@import 'tailwindcss'` 上）：
"不需要这个 import 吧，也不需要这个依赖，全部使用 ranui 的设计系统"。

## 先查清它到底在干什么

动手前把"Tailwind 在本仓提供了什么"量了一遍，结论是**两件事，仅此两件**：

1. **preflight**（框架自带的全局重置）；
2. **两个 utility class**——`editor.html` 里 `<div id="app" class="w-full h-full">`。

`class` / `className` 全量扫描（排除 `public/web-apps/**`、`public/sdkjs/**` 等
vendor 目录）在自有代码里只命中 `w-full` 与 `h-full` 各 1 次；运行时的
`classList.add/remove/toggle` 全部是语义类名（`embed-mode`、`landing-active`、
`agent-panel-hidden`、chat-ui 的 `cui-*`）。`public/web-apps/**` 里出现的
`hidden` 是 OnlyOffice 自带 CSS 的类名，与我们无关。

`styles/base.css` 剩下的 311 行**每一个设计值都已经是 `--ran-*` token**，
UI chrome 也早就是真 ranui 组件（`r-button` / `r-loading` / `r-input` /
`r-select` + `::part` 定制）。也就是说这次不是"迁移"，只是**把一个只剩重置
作用的框架摘掉**。

另外：`tailwind.config.ts` 在 `tsconfig.json` 的 `include` 里挂着，但**文件
根本不存在**（大概是早期删掉了配置忘了删引用）；`postcss.config.ts` 的插件
表里只有 `@tailwindcss/postcss` 一项；`postcss` 这个 devDependency 也只为那个
插件而在（仓库无任何 `import 'postcss'`，vite 自带 postcss）。

## 改了什么

| 文件                | 改动                                                           |
| ------------------- | -------------------------------------------------------------- |
| `styles/base.css`   | 删 `@import 'tailwindcss'`，补三条显式规则（见下）             |
| `editor.html`       | `<div id="app" class="w-full h-full">` → `<div id="app">`      |
| `postcss.config.ts` | 删除（唯一插件就是 Tailwind）                                  |
| `package.json`      | 移除 `tailwindcss` / `@tailwindcss/postcss` / `postcss`        |
| `tsconfig.json`     | `include` 去掉不存在的 `tailwind.config.ts`                    |
| `CLAUDE.md`         | 技术栈行由 "Tailwind CSS" 改为 "ranui 设计体系（无 CSS 框架）" |

## preflight 里编辑器页真正依赖的三条

preflight 是个大重置，但只有编辑器页（`editor.html` + `index.ts` 引入
`base.css`）在它下面渲染——落地页（`home.css` / `landing.css`）本来就不吃
Tailwind，各自用 `#landing-hero *{box-sizing}` 做**作用域内**重置；
`public/ran-tokens.css` 是纯 token（只有 `--ran-*` 变量，零重置）。

所以只把编辑器页会因缺失而坏掉的部分写成显式规则，其余任其回到浏览器默认：

```css
html,
body {
  height: 100%;
  margin: 0;
} /* 少了 margin:0 → body 8px 外边距把 iframe 顶出视口，出现滚动条 */
#app {
  width: 100%;
  height: 100%;
} /* 替代 w-full h-full；编辑器 iframe 的宿主必须满屏 */
button,
input,
select,
textarea {
  font: inherit;
} /* agent 面板的原生按钮/输入框否则回落到平台按钮字体 */
```

没有加回来的、刻意让它回到浏览器默认的部分：`* { margin/padding: 0 }`、
标题字号重置（`base.css` 本来就显式写了 `h2 { font-size: 1.5rem }`）、
列表 marker、`img/svg { display:block }`、全局 `box-sizing: border-box`
——后者不需要全局化，因为 `base.css` 里凡是需要它的选择器
（`.control-panel-container`、`.agent-panel-key-input`、`.agent-panel-provider`）
早就各自写了 `box-sizing: border-box`，chat-ui 的 `cui-*` 也自带
（`packages/chat-ui/src/styles.ts` 里已有 `font: inherit`）。

一个优先级细节：`w-full/h-full` 原先在 Tailwind 的 `@layer utilities` 里，
而 `body.landing-active #app { height: auto }` 是无层规则，靠"无层胜过分层"
压过它；现在 `#app` 也变成无层规则，靠**选择器特异性**（`body.landing-active #app`

> `#app`）继续压过，落地态的 `height:auto` 行为不变。

## 验证

- `lint:ts`（oxlint + `tsc --noEmit`）、`format:check` 通过
- 单元测试全绿（当时 702/702，35 个文件；随后两轮 review 追补到 733/38）
- 生产构建通过；产物 `dist/assets/editor-*.css` = **4101 字节**，`tailwind` /
  `--tw-` / `.w-full` 零残留，首行即
  `html,body{height:100%;margin:0}#app{width:100%;height:100%}`
- **E2E 全套（非 `@serial`）84 passed / 16 skipped**。真实编辑器那批正是这次
  的关键判据：`sw-warm`、`wasm-memory`、`xlsx-features` / `xlsx-panes`、
  `mobile-slide`（窄视口 / 旋转 / canvas 丢失重绘 / viewport follow）全绿说明
  `#app` 满屏与 `body` 无外边距的替代规则等效；`visual-roundtrip` 逐像素差异
  docx 0.007% / pptx 0.000% / xlsx 0.000%，即去掉 preflight 后渲染无位移。

顺带一个跑道教训（与 CLAUDE.md 里 docker 分片那条同源）：
`pnpm run test:e2e -- app-smoke.spec.ts …` 的 spec 过滤参数**被 pnpm 吞掉**，
实际跑的是整套。本次结果因此比预期更强，但如果反过来是想"只跑这几条"，
它会安静地跑全套（或在分片场景下让分片等于没做）。要过滤得绕开 pnpm 的
参数转发，直接调 `npx playwright test <spec>`。

## 补记：漏了一条，"零用户可感知变化"不成立（同日 review 追补）

上面"preflight 里编辑器页真正依赖的几条"数漏了：**全局 `box-sizing: border-box`
不只服务于那三个已显式声明的选择器**。`.agent-launcher` 是 `ButtonBuilder()`
造出来的**原生 `<button>`**，只写了 `width/height: 48px` + `border-radius: 50%`，
从没写过 padding——preflight 的 `*{padding:0}` + `border-box` 一直在替它兜底。
拆掉之后浏览器默认的 `1px 6px` padding 加在 48px **外面**，FAB 从 48×48 的圆
变成 60×50 的椭圆。同理 `.agent-panel` 的 `width: 360px` + `border-left: 1px`
在 content-box 下是 361px，而编辑器只让出 `calc(100% - 360px)`，接缝处漏出
一条 1px 的文档。

两处都在 `?agent=1` 这个实验开关后面，而**没有任何 E2E 打开过那个面板**——
这正是"没加契约用例"的代价：上面列的那批真实编辑器 E2E 全绿，恰恰因为它们
只走编辑器主界面这一条路。

修法（`styles/base.css`）：把原生控件那条重置补成 preflight 当初的语义，
再给面板补上 border-box——

```css
button,
input,
select,
textarea {
  font: inherit;
  box-sizing: border-box;
}
button {
  padding: 0;
} /* 这两条合起来才等价于 preflight 下 .agent-launcher 的圆形 */
.agent-panel {
  box-sizing: border-box;
} /* 360px 含边框，与 calc(100% - 360px) 对齐 */
```

## 契约用例：`test/unit/styles-contract.test.ts`（原先刻意没加，现已补上）

原判断是"纯构建层拆除、零用户可感知变化，不需要钉"。上面那条缺陷推翻了它：
替代规则**没有任何东西引用**，删掉不会有编译错误，而它们防的失效（body 8px
外边距把 iframe 顶出视口、原生控件按 padding 为零的假设排版）只在没人跑的
表面上现形。于是按当时自己写的"成本最低的做法"补了这条测试，形式参照
`hosting-contract.test.ts`：读 `styles/base.css` 与 `package.json`，断言
`html,body` 的 margin/height、`#app` 满屏、原生控件重置（含 `border-box` 与
`button{padding:0}`）、`.agent-panel` 的 border-box，以及不存在任何 CSS 框架
依赖或非相对 `@import`。

反向验证（2026-08-18 制度）：删掉原生控件那条 `box-sizing` 与
`.agent-panel` 的 border-box，`styles-contract` 的两条用例立刻变红；恢复后
全绿（725/725，37 个文件）。

## 补记二：字体那条也漏了（同日第二轮 review）

上面的补记补齐了原生控件的重置，但 preflight 还有一条没被替代：**`html` 的字体族**。

`ran-tokens.css` 只**声明** `--ran-font-family`，真正把它应用到页面的规则在
`public/home.css` —— 而 `/editor` 不加载 home.css（它只引 `/ran-fonts/fonts.css`
与 `/ran-tokens.css`）。preflight 走了之后，编辑器页整页回落到浏览器默认的
**Times**。更糟的是紧挨着的那条 `button, input, select, textarea { font: inherit }`
会把这个衬线字体主动灌进 agent 面板的输入框和原生控件里——与它注释写的意图正好相反
——而旁边的 ranui 组件仍然渲染 Geist（它们在自己的 shadow DOM 里解析
`--ran-skin-font-family`）。一个面板里两种字体。

```css
html {
  font-family: var(--ran-font-family);
  line-height: var(--ran-line-height);
}
```

用 token 而不是 preflight 自己的值（`ui-sans-serif` / `1.5`），这样页面和组件说的是
同一套字。

### `iframe { display: block }` 刻意不补

preflight 还有这一条，第二轮 review 一度判它是"桌面端 4px 溢出"。**实测不成立**：
编辑器 frame 是本页唯一的 iframe，而厂商自己给它设了 `vertical-align: top`，
inline 盒不再贡献基线下沉——真实页面上 `#app` 的 `scrollHeight` 与
`clientHeight` 都是 700。合成页面能复现 704，是因为那里的 iframe 用的是默认
`vertical-align: baseline`。所以不加这条规则，改为由 E2E 断言"页面装得进视口"
（见下），厂商哪天不再设 `vertical-align` 就会在那里红，而不是悄悄多一条滚动条。

### 顺带抓到一条与 Tailwind 无关的既有缺陷

写上面那条断言时它先红了，而且不是 4px 而是 **25px**：`lib/document.ts` 那个隐藏
文件选择框用的是 `visibility: hidden`——控件看不见但**仍然占位**，而它是 body 的
子节点、排在 `height: 100%` 的 `#app` 之后，于是 `/editor` 一直带着一条页面滚动条。
改成 `display: none`（文件框只由 `fileInput.click()` 程序化打开，`display: none`
不影响它）。与拆 Tailwind 无关，preflight 时代也是这样。

### 用例

`test/e2e/app-smoke.spec.ts` 新增 "the editor page fits the viewport and renders in
the ranui typeface"：1280×700 打开 `/editor?new=docx`，断言
`documentElement.scrollHeight === clientHeight` 且 `body` 的 `font-family` 命中
`Geist`。断在 document 上而不是断在那个 input 上，所以下一个溢出的东西也会被它抓到。

反向验证：去掉 `html` 那条 → 收到 `"Times"`，变红；把 input 改回
`visibility: hidden` → 725 vs 700，变红；去掉 `iframe { display: block }`（本就没加）
→ 仍然全绿，这也是判它不需要的依据。
