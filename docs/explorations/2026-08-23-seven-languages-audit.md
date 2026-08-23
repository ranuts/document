# 七语言上线后的整体复查（2026-08-23）

站点从 2 种语言变成 7 种、落地页全部生成化之后，做了一次横向复查。下面是查出来的东西，
按"用户会不会撞到"排序。

## 1. 韩语编辑器在空白文档上弹错误框（已修，PR #194）

单独记在 CLAUDE.md 的 vendor 补丁一节。要点：vendor 的 44 个非英文 locale **没有一个**
对得齐 `en.json`，而有些字符串只存在于 locale 文件里，缺翻译就是 `undefined`，
`updateHint` 直接 `hint[0]` → TypeError → 被 app 当成文档错误。两道防线：
`bin/locale-fill.mjs`（补齐站点 7 种语言）+ 守卫 11（`updateHint(undefined)` 空操作）。

## 2. 语言菜单把语言名切两半（已修）

触发器宽 104px 是当年按 "Deutsch" 定的。组件在 shadow root 里 `overflow: hidden`，
**并且面板宽度按触发器宽度算**，所以 "Português" 同时在两处被切：列表里 `Portug…`，
触发器里文字压到 caret 上。改成 132px，并由 `test/e2e/language-menu.spec.ts` 逐语言
量 `scrollWidth <= clientWidth`——这个数字从此是量出来的，不是猜的。

## 3. 加宽触发器之后，手机顶栏塞不下（同一轮修掉）

390px 下 132px 的触发器把自己的 caret 推出视口，"Document Editor" 被挤成两行。
≤620px 隐藏顶栏的 GitHub 链接（每个页脚都有它），语言切换是那里唯一不能省的控件。
用例同样落在 language-menu.spec.ts。

## 4. 首页 body 还带着浏览器默认的 8px margin（已修）

`landing.css` 一直有 reset，`home.css` 从来没有——因为首页自建 chrome、不加载
landing.css。白色主题下看不出来，暗色下就是页面四周一圈底色。`design-contract`
现在要求两个样式表都有这条，E2E 在四类页面上验计算值。

## 5. `/history` 与 `/404` 的语言切换只有 2 种（已修）

这两个页面是手写的（一个应用页、一个错误页，都不经生成器），语言列表没跟着 `LOCALES`
走，站点都七种语言了它们还只列 en + zh。**没有任何东西会发现**：两者都不在 sitemap、
不在 hreflang 图里。补齐 7 项，并加了一条单测按 `Object.keys(LOCALES)` 比对。

## 6. 葡萄牙语在站点与应用之间不是同一种葡语（已修）

`/pt/` 的页面、`bin/build-pages.mjs` 的 UI 表、编辑器加载的 vendor 包（`pt.json` 而不是
`pt-pt.json`）都是巴西葡语，而 `packages/shared` 的 pt 词条表混着欧洲葡语：
`ficheiro` / `guardados` / `Definições` / `Não é possível anular` / `está a meio`。
于是同一个用户在落地页看到巴西葡语、进 `/history` 看到欧洲葡语、编辑器又回到巴西葡语。
14 条词条改写为巴西葡语（`arquivo` / `salvos` / `Configurações` / `Não dá para desfazer`）。

顺带修掉了更早一轮自己引入的同类问题：新增的 history 词条当时写成了欧洲葡语。

## 7. `llms-full.txt` 被翻译撑到 7 倍（已修）

它遍历 `public/` 下所有 HTML，七种语言进来之后从 97 KB 涨到 680 KB——同样的事实说七遍。
对读它的模型只有害处。改成只收英文页面，开头说明镜像在哪；`/llms.txt` 仍然逐语言列出。

## 复查过但没有问题的

- **SEO 覆盖**：7 种语言 × 21 页齐全；hreflang 是完整的七语言互指 + x-default；
  sitemap 154 条；robots 允许全部。
- **编辑器多语言**：不是七个 HTML，而是 `?locale=` 驱动的同一个 app。逐语言实测过
  `<html lang>` 与 vendor frame 的 `lang=`，工具栏确实是对应语言。
- **横向溢出**：7 种语言 × 桌面/手机两档，除了上面第 3 条之外没有元素越界。
- **德语长词**：`Installieren und im Flugzeug nutzen`（35 字符）在 pillars 列里正常换行，
  没有溢出。
- **`/embed-demo`**：仍然是英文，这是 CLAUDE.md 的规矩（共用页面用英文），不是遗漏。

## 还没做的

- **`bin/design-audit.mjs` 只审英文页面**。七种语言的行宽/字号没有被审计脚本覆盖，
  目前靠 E2E 的溢出检查兜底。
- **`/history` 与 `/404` 仍是手写页**。它们的 chrome 与生成页重复了一份，这次的语言列表
  漏更新就是这个重复的代价。要么把它们也纳入生成器，要么就靠刚加的那条单测钉着。
