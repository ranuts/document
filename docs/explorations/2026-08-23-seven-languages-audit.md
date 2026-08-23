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

## 8. Open Graph 不知道站点有七种语言（已修）

`hreflang` 是完整的七语言互指，但 Open Graph 那边**一个字都没说**：既没有 `og:locale`
也没有 `og:locale:alternate`。后果是任何读 OG 的消费者（Facebook、LinkedIn、Slack、
各类抓取器）把 `/ja/` 和 `/pt/` 的分享都当成英文页。补上之后每页声明自己的
`og:locale`，并列出其余六种的 `og:locale:alternate`。

映射写在 `LOCALES` 表里，因为 OG 要的是 `language_TERRITORY` 而不是 BCP47：
`en_US` / `zh_CN` / `ja_JP` / `de_DE` / `es_ES` / `ko_KR` / **`pt_BR`**。最后一个再次
确认了第 6 条的取舍——页面、shell 词条、vendor 包（`pt.json`）、OG locale 四处都是巴西葡语。

顺带补上落地页 `WebApplication` 节点缺的 `inLanguage`（首页和文档页早就有）。

## 9. 选了语言，走到 app 页面就丢（已修）

用户报的：首页切到日语，跳去其它页面还是英文。复现路径正是这样：

    /ja/ 是日语 → 点「保存したドキュメント」→ /history → 英文

两个独立的原因，各修各的：

1. **首页指向 app 的链接没带语言**。站点是七个静态目录 **加上一个 app**（`/editor`
   与 `/history`），app 不在任何语言目录下面。`/ja/` 上的 `/history` 链接因此是裸的，
   app 只能按浏览器语言猜。生成器现在输出 `/history?locale=ja`；
   `history-recent.js` 拼的「继续编辑」链接同样带上（它读 `<html lang>`）；
   `/history` 自己的行链接与「返回首页」也带（`withLocale` / `localeHomePath`，
   新导出在 `packages/shared/src/i18n.ts`）。
2. **选择从来没被记住**。`lang-switch.js` 过去只是导航——语言只存在于用户当前站着的
   那条路径里。现在它在跳转前写 `locale` cookie（一年，`samesite=lax`）。app 的语言解析链
   第二位就是 cookie，所以之后直接打开 `/editor` 或 `/history` 也跟随。

两条缺一不可：链接带参数让**第一次点击**就对（新浏览器、别人分享的链接都算），
cookie 让**之后的直接访问**也对。

实测整条路径（浏览器语言 en-US）：落地英文首页 → 菜单选日语 → 保存的文档 → 裸
`/editor` → 裸 `/history` → 落地页，六步全是 `lang=ja`。反向验证：去掉 cookie 那段，
E2E 的第 4/5 步立刻回落英文。

## 复查过但没有问题的

- **SEO 覆盖**：7 种语言 × 21 页齐全；hreflang 是完整的七语言互指 + x-default；
  sitemap 154 条；robots 允许全部。
- **编辑器多语言**：不是七个 HTML，而是 `?locale=` 驱动的同一个 app。逐语言实测过
  `<html lang>` 与 vendor frame 的 `lang=`，工具栏确实是对应语言。
- **横向溢出**：7 种语言 × 桌面/手机两档，除了上面第 3 条之外没有元素越界。
- **德语长词**：`Installieren und im Flugzeug nutzen`（35 字符）在 pillars 列里正常换行，
  没有溢出。
- **`/embed-demo`**：仍然是英文，这是 CLAUDE.md 的规矩（共用页面用英文），不是遗漏。
- **站内死链**：158 个页面、5043 条内链、165 个不同目标，逐个请求，零 4xx。
- **基础可达性**：五类页面上没有缺 alt 的图、没有无名链接/按钮、标题层级不跳级、
  每页恰好一个 h1、`<html lang>` 都在。格式索引的行、右栏链接、语言选择器都能 Tab 到。
- **首屏性能**：落地页 10 个请求 / 392 KB，FCP 44 ms。首页看起来 9 MB 是
  `landing-prefetch.js` 在预热三个编辑器引擎（既有行为，有 E2E 钉着），发生在
  load 之后；线上走 br 压缩（`sdk-all.js` 13.7 MB → 3.0 MB）。
- **缓存头**：`sdkjs/` 与 `web-apps/` 故意不上 `immutable`（里面有我们的补丁和
  iframe HTML），4 小时 + `must-revalidate`。这次补齐的 locale JSON 也在这棵树里，
  但 SW 的 runtime cache 按 `VENDOR_VERSION` 命名，vendor 一变就是新 cache，
  拿不到旧副本。

## 还没做的

- **`bin/design-audit.mjs` 只审英文页面**。七种语言的行宽/字号没有被审计脚本覆盖，
  目前靠 E2E 的溢出检查兜底。
- **`/history` 与 `/404` 仍是手写页**。它们的 chrome 与生成页重复了一份，这次的语言列表
  漏更新就是这个重复的代价。要么把它们也纳入生成器，要么就靠刚加的那条单测钉着。
