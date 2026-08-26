# 语言切换器：从 combobox 换成 disclosure（2026-08-26）

起因是一张截图：顶栏的语言菜单"看着不对"。查下来不是一个问题，是一串，而且根子在
组件选型上——**它是个表单控件，站在一排导航链接里**。

## 现象与根因

打开的菜单里六项是语言自称全名（中文 / 日本語 / Deutsch / Español / 한국어 /
Português），只有英语写成 `EN`；地球图标和输入框分家；文字和箭头之间空出 ~70px；
面板比触发器还偏左。

这些是同一个原因的四种表现。`r-select` 在语义上是 combobox——一个表单字段——
而表单字段的设计意图就是固定宽度、标签左对齐、caret 右对齐（选项长短不一，布局要稳）。
于是：

- 地球只能贴在框**外面**，因为框里塞不进去；
- `min-width: 132px` 减掉左右各 12px padding，"EN" 占 20px、caret 占 16px，中间白白空掉；
- 缩写是宽度紧张时的省地方；
- 面板偏左是 `computePlacement` 的 shift：面板左对齐时会溢出视口右缘，被推回来，
  结果落在触发器**左边** 33px（1512px 视口实测：触发器 [1291,1355]，246px 的面板被推到 1258）。

W3C ARIA 的 APG 对此有明确说法：**菜单项是导航链接时用 disclosure（一个
`aria-expanded` 按钮 + 一组链接），不要用 menu，更不要用 combobox**。combobox 是
"从一组值里选一个填进表单"，语言切换不是那个东西。

## 做法

换成 `r-popover`（disclosure）+ 真链接列表：

```html
<r-popover class="lang-menu" placement="bottom-end" trigger="click">
  <button class="lang-trigger" aria-label="Language">地球 + English + caret</button>
  <r-content>
    <div class="lang-list">
      <a class="lang-option" href="/ja/" lang="ja" hreflang="ja">日本語</a>
      …
    </div>
  </r-content>
</r-popover>
```

- **触发器长得和旁边的 GitHub 链接一模一样**（`inline-flex`、8px gap、`8px 12px`
  padding、radius-sm、14px、`text-secondary`、hover 出底色），只多一个 caret，宽度
  `fit-content`。框没了，"图标和框分家"与"文字箭头空隙"随之消失。
- **每项是 `<a href lang hreflang>`**。`lang` 让屏幕阅读器用日语的音去读"日本語"——
  这个菜单的整个受众就是读不懂当前页的人，用当前页的语音去念其它语言的名字是噪音。
  `hreflang`、真 href 让中键新开、复制链接、爬虫跟随都成立。
- **当前项 ✓ + `aria-current="page"` + 600 字重，不用底色**。底色留给 hover：原来
  active 和 hover 都是灰底，两个灰几乎一样，第一眼读起来像"鼠标停在上面"。
- **对齐到触发器的起始边**（`placement="bottom"`），让菜单每一行的文字和触发器自己的
  标签落在同一条竖线上（差 5px，是地球与勾的 gutter 之差，不是错位）。
- **顺序**是显式列表 `MENU_ORDER`（Deutsch, English, Español, Português, 中文,
  日本語, 한국어），不是运行时排序——`localeCompare` 按宿主的 ICU 数据给答案，本地
  构建和 CI 可能不同，而会自己变顺序的菜单没人记得住。
- **手机上触发器只留地球 + caret**，藏掉语言名。原来是反过来的：为了给"装得下
  Português"的触发器腾地方，把 GitHub 链接在窄屏隐藏掉了；现在 GitHub 可以留下。

## 顺带的收获与代价

**落地页少下载 84K**：`select.iife.js` 是 152K，换成 `popover.iife.js` + `content.iife.js`
共 68K。r-select 在本站只用于语言切换器，所以它整个从 vendored 列表里移除了。

**箭头要显式关掉**。`r-popover` 总给面板配一个指向触发器的小三角——那是它作为
tooltip 的语言，不是导航菜单的（菜单挂在按钮下方，不是在注解按钮）。用
`.ran-popover-dropdown { --ran-dropdown-arrow-display: none; }` 关掉，scope 在
popover 自己给 portal 面板的那个 class 上，将来真要做 tooltip 不受影响。

**JS 几乎不需要了**。`lang-switch.js` 从"监听 r-select 的 change 事件、读
data-href、手动 `location.href`"缩成"点链接时写一个 cookie"——跳转是链接自己的事。
cookie 仍然要写：静态页把语言放在 URL 里，而 `/editor` 和 `/history` 是一个 app，
按 `?locale=` → cookie → localStorage → 浏览器的顺序解析语言；没有 cookie，在日语
首页选了日语再打开"保存的文档"，人就回到英文了。

监听器绑在链接上而不是 document 上：**`r-popover` 在面板上调了 `stopPropagation`**，
面板又是 portal 到 `<body>` 的，document 级委托根本收不到点击。节点被移动时监听器
跟着走，所以在 portal 发生前绑定是安全的。

## 用例

`test/e2e/language-menu.spec.ts` 整个重写（原来全是围绕 r-select 的 shadow DOM 写的），
现在测的是：七种语言下菜单都列全 7 项且不裁字、每项是带 `lang`/`hreflang` 的真链接、
当前项唯一且触发器与之一致、面板右边缘贴着触发器右边缘且不溢出视口、手机上语言名
隐藏而触发器仍在视口内、Escape 与外点关闭。

`landing-pages.test.ts` 那条 `data-href` 断言换成新结构，并补了两条：菜单里不许出现
缩写（每项必须是该语言的 endonym）、`MENU_ORDER` 必须覆盖 `LOCALES` 的全部键——
顺序是手写列表，加语言时漏掉它会静默地把那门语言从全站菜单里删掉。

反向验证：去掉 `lang` 属性，156 条用例变红；把 `placement` 改回 `bottom`，右对齐
用例报"偏差 24px"。

## 面板宽度定错了，对齐方式跟着错了

第一版给面板写了 `min-width: 152px`（"够放下最长的 endonym"的估计），并用
`bottom-end` 右对齐——理由是"顶栏右端的菜单要向内展开，否则溢出被推回来"。

实测下来两条都站不住：152px 比最长的名字实际需要的**宽了 84px**，于是面板比触发器
宽 67px、整块挂在左侧，而菜单文字比触发器文字左了 65px——用户看到的"上下没对齐、
空了这么多"就是这两个数。

改成 `width: max-content` 后面板收到 113px（比触发器只宽 18px）。而右对齐的理由是
建立在"面板比触发器宽很多"之上的，前提没了：触发器右边在桌面宽度下还有 236px 余量，
手机上则由 `computePlacement` 的 shift 兜底。改回起始边对齐后，左边缘完全对齐，文字
错位从 23px 降到 5px。

|                  | 右对齐 `bottom-end` | 起始边对齐 `bottom` |
| ---------------- | ------------------- | ------------------- |
| 左边缘 vs 触发器 | −18px（突出）       | 0                   |
| 文字错位         | 23px                | 5px                 |

教训：**先把盒子量准，再谈对齐方式**。对齐的选择依赖于面板和触发器的相对宽度，而
那个宽度当时是猜的。

## 触发器就是 r-popover 自己，不要在里面再放一个 button

第一版把 `<button class="lang-trigger">` 放进 `<r-popover>` 里。看起来天经地义——
disclosure 的触发器就该是 button——但 **r-popover 把 `tabindex`、`aria-haspopup`、
`aria-expanded` 设在它自己身上**，它的设计假设是"host 就是触发器"。

于是这个控件占了**两个 tab stop**，而且信息是分家的：

- `r-popover` 上有 `tabindex=0`、`aria-expanded="false"`，但没有 role、没有名字
- 内层 `<button>` 上有 `aria-label="Language"`，但不报告展开状态

屏幕阅读器因此永远读不到"Language, collapsed"这一个完整的控件——它先遇到一个匿名的
popup，再遇到一个从不说自己开着的按钮。

改法是把 `role="button"` 和 `aria-label` 放到 host 上，内层降成 `<span>`（它只是那排
图标+文字的布局容器）。一个 tab stop、名字和状态在同一个元素上，正是 ARIA disclosure
要的形状。焦点环也跟着挪到 host 上（`:focus-visible .lang-trigger`）。

反向验证：把内层 button 放回去，"one tab stop" 那条用例报 `Expected 1, Received 2`。

## 生成 HTML 用 ranui 的 DOM，不要拼字符串

第一版 `langMenu` 是模板字符串拼的——因为我以为 `ranui/builder` 需要浏览器 DOM，
而这是 Node 构建脚本。**这个假设是错的，没有验证过**：builder 在 Node 里能用，
它在没有 `document` 时自动落到 ranui 自己的 DOM mock。

但直接用 `View()`/`Div()` 又踩到另一件事：它们按环境二选一（mock 或
`document.createElement`），而这个文件会在**两个环境**里渲染同一批页面——真正构建
时在 Node，vitest 里在 jsdom。真实 document 会把 `createElement` 元素的属性名小写化，
于是 `viewBox` 变成 `viewbox`——**SVG 读这个属性是大小写敏感的，小写的不生效**——
两个环境产出的字节因此不同，`check()`（"一次全新渲染会不会改变已提交的页面"）永远红。

所以这里显式用 `HTMLElementMock`（`ranui/builder` 的公开导出）：两个环境行为一致，
属性和文本自动转义，仍然是 ranui 的体系。生态规则真正要的东西一条没丢——不手拼 HTML、
不手动 `escapeHtml`。

顺带发现 builder 的一个真实缺口：**它没有 `createElementNS` 路径**
（`utils/builder/core.ts` 只有 `document.createElement(tag)`），所以在真实浏览器里
它根本构造不出 SVG——`View('svg')` 得到的是 `HTMLUnknownElement`，属性被小写，浏览器
也不会当 SVG 渲染。任何拿它做图标的人都会撞上。值得回 chaxus/ran 修。

## 别再试这些

- **别把语言切换器做成 `r-select`/combobox**。上面那四个症状会一起回来。
- **`::part(dropdown)` 够不到这个面板**——它是 portal 到 `<body>` 的独立
  `r-dropdown`，不是页面 shadow root 的后代。要定制走 `.ran-popover-dropdown` 或
  `dropdownclass`。
- **别用 document 级事件委托监听菜单里的点击**（`stopPropagation`，见上）。
- **别把菜单顺序改成运行时排序**。
- **别在 `r-popover` 里再放一个 `<button>`**。host 已经是触发器（tabindex / haspopup /
  expanded 都在它身上），再放一个就是第二个 tab stop，且名字和状态分家。
- **别给面板写死宽度**。`max-content` 让它跟着最长的语言名走；写死的数字既会留下
  一列空白，又会把对齐方式带偏。
- **别在这个文件里用 `View()`/`Div()` 构造 SVG**（`viewBox` 会在 jsdom 下被小写，
  两个环境的产物就对不上了）。用 `HTMLElementMock`。

## 相关

上游 ranui 侧的配套改动见 chaxus/ran#395：`placement` 的对齐后缀（`bottom-end`）、
`open` 成为反射属性、四个生命周期事件、以及 r-select 那个"幽灵行"——`:host` 是
inline-block 套 inline-block，在字段下方预留了没人绘制的 descender 空间，导致
**地球图标看起来偏了 3px，而实际上偏的是菜单**。那个间隙的大小等于消费者继承的
`line-height`，所以每个页面还不一样。
