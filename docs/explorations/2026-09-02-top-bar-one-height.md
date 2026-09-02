# 顶栏四件事：一行里的高度、顺序、手机取舍（2026-09-02）

## 起因

用户截图：顶栏里 hover 到 **GitHub** 和 hover 到 **English**，两个填充块高度不一样。

## 1. 桌面端：39px vs 31px

量出来（`edit.chaxus.com`，1512px）：

| 元素                        | 高度    | line-height |
| --------------------------- | ------- | ----------- |
| `header.bar nav a` (GitHub) | 39.09px | 23.1px      |
| `.lang-trigger` (English)   | 31px    | 14px        |

两者的 padding 完全一样（`8px 12px`），差的是行盒：

- 导航链接**没写** `line-height`，继承 body 的正文行距 `1.65` → 14 × 1.65 = 23.1px；
- 语言触发器写了 `line-height: 1`，而它里面最高的是 15px 的地球图标 → 15px。

39.09 − 31 = 8.09px，正是 23.1 − 15。

`docs/explorations/2026-08-26-language-menu-disclosure.md` 里明确写着这个触发器的设计
意图是"长得和旁边的 GitHub 链接一模一样"——所以这是对既定意图的回归，不是取舍。

**修**：两处都显式写 `line-height: 22px`（`landing.css` 与 `home.css` 各一份，顶栏本来
就有两份实现）。22 不是新数字，是 `.ran-btn-content` 的默认行高，本文件里已经在用；
22 + 8×2 = 38px，正好等于 `/history` 顶栏里那个 `r-theme-switch` 药丸的高度，三件东西
就都是 38 了。顶栏总高 71px 不变（39.09 + 32 本来也是四舍五入到 71）。

## 2. 手机端：同一个 bug，方向相反

`@media (max-width: 620px)` 会把 `.lang-current`（语言名）藏掉，只剩地球和箭头。文本行
盒随之消失，触发器又掉回 31px，而 GitHub 还是 38px——桌面修好，手机照旧。

**修**：`min-height: calc(22px + var(--ran-space-2) * 2)`，从下面顶住，与 padding token
联动而不是手抄 38。

## 3. 顺序：主页和别的页是反的

| 页面                               | 顶栏顺序                             |
| ---------------------------------- | ------------------------------------ |
| `/`（`render-home.mjs`）           | Offline · No sign-up · GitHub · 语言 |
| `/help` `/about` `/404` `/history` | **语言 · GitHub**（· 主题）          |

同一个站，从主页走到 `/help`，语言开关就跳到行的另一头。统一成主页那一版：外链在前，
偏好类控件（语言、主题）收尾。改了 `render-page.mjs`、`public/404.html`、`history.html`。

## 4. 手机上顶栏放不下，两个页面横向溢出

`/history` 与 `/embed-demo` 是仅有的两个"应用面"页面：它们没有页脚，于是把主题开关放进了
顶栏，一行里有三个控件。390px 下实测：

| 页面               | 横向溢出 | 现象                            |
| ------------------ | -------- | ------------------------------- |
| `/history`         | +17px    | 品牌名折成两行                  |
| `/embed-demo.html` | +27px    | "Embed API" 折成两行（60px 高） |

`mobile-overflow.spec.ts` 按 sitemap 遍历，而这两页一个 noindex 一个是 demo，都不在
sitemap 里——所以站点唯一的手机溢出门禁从来没看过它们。

算过几种取法（390px，顶栏左右各 20px gutter）：

| 方案                     | `/history`      | `/embed-demo`             |
| ------------------------ | --------------- | ------------------------- |
| 现状                     | 407 ✗           | 417 ✗                     |
| 藏 GitHub                | 382 ✓（余 8px） | 408 ✗                     |
| 藏 GitHub + 藏页内链接   | —               | 319 ✓（但两个链接都没了） |
| **品牌只留标记，去掉字** | **340 ✓**       | **366 ✓**                 |

最后一种最省事也最不丢信息：24px 的方块标记仍然是回首页的链接、仍然写着站名的首字母，
而 137px 的字号 16 品牌名是这一行唯一付不起的东西（Apple / GitHub / Stripe 的手机顶栏
都是这么做的）。代价是要给品牌名包一个 `<span class="wordmark">`——原来它是裸文本节点，
CSS 根本选不中。五处 chrome 各加一次（两个生成器 + 404 + history + embed-demo），
`@media (max-width: 620px)` 里一行 `display: none`。

顺带清掉一条过期规则：`home.css` 在 620px 以下把 GitHub 链接藏了，注释说是"为了给宽到
能放下 Português 的语言触发器腾地方"——而触发器早就在手机上只剩图标了（landing.css 那份
注释里已经写了"GitHub 现在可以留下"）。主页手机顶栏因此比别的页少一个链接。删掉。

## 5. 顺带：`/history` 工具栏 31px vs 32px

`.history-filter` 药丸 31px，旁边的 `r-input` 搜索框 32px，两者在同一行差半个像素。
`min-height: 32px`。

## 用例

`test/e2e/language-menu.spec.ts` 的 `page chrome` 组新增两条：

- `{desktop, phone} × {/, /zh-CN/, /help, /history, /embed-demo.html}`：顶栏里每一件
  可见控件的 `height@top` 必须全部相同（正则 `^(\S+)( \1)*$` 直接判"这些字符串是不是同
  一个"）。量渲染结果而不是比 CSS 声明，因为顶栏有两份实现，两边都可能坏。
- `the app surfaces fit a phone too`：`/history` 与 `/embed-demo.html` 在 390px 下
  `scrollWidth - clientWidth <= 1`。补上 sitemap 门禁够不到的那两页。

反向验证（三条修复各撤一次，用例都变红）：

| 撤掉                         | 变红的用例                                                    |
| ---------------------------- | ------------------------------------------------------------- |
| `line-height: 22px`          | desktop 那条（`/` 报 items differ）                           |
| `min-height: calc(...)`      | phone 那条（`/` 报 items differ）                             |
| `.wordmark { display:none }` | phone 那条（`/embed-demo`）+ 手机溢出那条（`/history` +17px） |

全量：单测 3410 通过，E2E 159 通过 + `@serial` 2 通过。
