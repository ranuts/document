# 页面版式规范（业界基准与本站取值）

日期：2026-08-22
适用：所有用户可见页面（落地页、生成页、`/history`、demo、404），以及 `/editor` 的应用壳与
AI 工作区。下述站点列宽不套用到全屏编辑器；AI 工作区的布局与验收见本文末尾的应用布局契约。
OnlyOffice 内部界面由 vendor 持有。

审计脚本：`node bin/design-audit.mjs <baseUrl>`——渲染每个页面，打印下面这些数字；
加 `--all` 则把每种页型在**七种语言**下各量一遍（默认只量英文，那是本规范写作时的基准）。
一致性应该是可核对的，而不是靠记忆：漂移都是一页一页来的，每一页单看都合理，
只有并排列出来才看得见。

## 一、两档宽度，没有第三档

| 档           | 取值       | 用在哪                                          | 声明处                                                               |
| ------------ | ---------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| 宽版（列式） | **1152px** | 首页、内容页与 `/history` 的**外框**            | `home.css --maxw`、`landing.css .page`、`history.css .history-shell` |
| 正文（读式） | **720px**  | 内容页的正文列（含 56px 内边距，文本宽 ~608px） | `landing.css .wrap`                                                  |

业界的做法是一样的分层：营销/仪表盘类容器普遍落在 1100–1280（Stripe、Linear、
Tailwind 的 `max-w-7xl` 是 1280），文档正文列普遍落在 700–800（Stripe Docs 约 720、
Notion 正文 708）。**不存在"一个正确的宽度"，只存在按内容类型分层**。

为一个页面新造第三个宽度，是"站点看起来像两个站点"的最常见起点。
`test/unit/design-contract.test.ts` 把这两个数字的三处声明钉在一起。

## 二、正文行宽 45–75 字符

排版学的老结论（Bringhurst 给的理想值是 66 字符），至今仍是可读性研究的共识区间。
落到 CSS：**正文段落用 `max-width: 60–72ch` 限制，不要靠容器宽度限制**——
`/history` 的容器是 1152（表格需要横向空间），但它的导语是 `60ch`。

当前实测（1440 视口）：首页 71、`/help` 72、落地页 72、`/history` 66、404 59。
全部在区间内。

### 中日韩另有一档：30–40 全角字符

拉丁字母的 45–75 换算成中日韩就是 22–37 全角字（一个汉字约等于两个字母宽），
业界惯例（JLReq / CLReq、以及知乎/少数派一类中文长文站）给的是 **30–40**。
**审计脚本按 `<html lang>` 选探针**：中日韩页面用汉字量、拉丁页面用字母量，
输出带 `cjk` 后缀。这一条不是多余的讲究——探针写死成字母时，七种语言全部报 72，
那个数字其实只是"容器宽度换算成字母"，中日韩页面真实跑在 41，审计等于没审。

当前实测：中日韩内容页 **40–41 全角字**（660 ÷ 16px 字号 = 41.25），首页同值。
比 40 高出 1，**刻意不改**：要压到 40 以内只能单独收窄段落，而整站的标题、发丝线、
表格都对齐在 660 上，段落缩进去会让右边缘参差，代价大于收益。这个数字记在这里，
是为了下次有人动字号或列宽时知道它已经贴着上沿。

### 内容页在宽屏上是两栏，不是一根柱子

`≥1081px` 时内容页（`/open/*`、`/convert/*`、特性页、`/help`、`/changelog`）用
`landing.css .page` 的两栏框架：**正文列 660 + 目录栏 284**，合起来 1152。

- **正文列不加宽**。旧版单柱是"720 容器 + 56px 内边距"，文本宽其实只有 608px、66 字符。
  把列直接放到 720 会让行宽变成 77 字符——比原来更难读。660 落在 72，与首页同值。
  `test/unit/design-contract.test.ts` 钉住这个区间。
- **`/history` 用同一套框架**（`history.css .history-shell`）。它此前刻意留在 720，理由是
  "1152 下每行有 236px 死空隙"——那个理由在右栏出现之后就不成立了：现在右栏放的是存储用量、
  自动保存开关、全部删除与保留规则，列表只剩文档本身。区别只有一处：**`/history` 的右栏在窄屏
  不隐藏**（那是控件，不是导航），它落到列表下方，也就是它原本待的位置。
- **右栏放三样东西**：常驻 CTA（滚过首屏后仍在）、本页目录（h2 锚点）、相关页面。
  依据是文档站的通行结构（Stripe Docs / Vercel Docs / MDN 都是"约 700 正文 + 目录栏"），
  它们同样不靠加宽正文来填满宽屏。
- **`<1081px` 直接不渲染右栏**（`.side { display: none }`）：手机上 CTA 本来就在首屏，
  目录只会挡在读者和正文之间。
- **每个内容页都必须有右栏**，且栏里的锚点要与页面 h2 一一对应——
  `test/unit/landing-pages.test.ts` 钉住（少写一个 section 会红）。
- 页脚移出正文列、铺满 1152（`.page-foot`）。

## 三、字号与页面骨架

|                   | 首页                     | 其它内容页                       | 应用页（`/history`、demo） |
| ----------------- | ------------------------ | -------------------------------- | -------------------------- |
| h1                | 64/700（hero，刻意更重） | 40/700，`letter-spacing: -1.2px` | 同内容页                   |
| body              | 16px / 1.65              | 16px / 1.65                      | 16px / 1.65                |
| 顶栏 `header.bar` | 有                       | 有                               | 有                         |
| 页脚              | 有                       | 有                               | **无**                     |

**"应用页有顶栏、无页脚"是有意的**：`/history` 和 `/embed-demo.html` 是来办事的地方，
不是浏览站点的地方；页脚的站内导航在那里只会挡路。这与 Gmail / Notion / Linear 一致。
但顶栏必须有——用户是从首页走过来的，顶栏消失会让人以为跳到了别的站。

顶栏和页脚的样式**只有一份**（`landing.css`），页面复用它的类名与结构，
而不是抄一遍数值。`/history` 因此直接 `<link>` 了 `landing.css`。

## 四、按钮两档

| 档     | 高度  | 用在哪                           |
| ------ | ----- | -------------------------------- |
| 页面级 | ~42px | 落地页 CTA、页头动作、"全部删除" |
| 行内   | ~32px | 表格每行的操作                   |

依据是"这个按钮作用于什么"，不是"它在哪"。一行一个的表格操作若与 CTA 同尺寸，
一屏就变成一叠行动号召。组件库的 `size` 分级是同一个道理。

## 五、四个视觉手法（站点自己的语言，新页面照抄）

这几条不是装饰，是让不同页面看起来出自同一处的东西。首页早就在用，`/history`、
恢复条、首页的自动保存条现在也用同一套：

1. **hairline 画在 shadow 层，不用 border**：`box-shadow: 0 0 0 1px var(--ran-color-border)`。
   零偏移零模糊的 1px 扩散，不占 box model，所以圆角处不会裁掉行的 hover 底色，
   线本身也能跟着表面一起过渡。Geist 的做法，比真 border 更轻。
2. **mono 用来"盖章"，不用来读**：文件类型、时间戳、用量这些机器事实用
   `--ran-font-mono`（首页 chip / trust 行、`/history` 的格式徽章与计数）。
   反过来说——**不要把每个标签都做成 mono**，正文永远是 Geist Sans。
3. **状态用点，不用灰色 pill**：一个 6px 的圆点加一个词，点用语义色
   （成功绿、警示橙）并带一圈 22% 透明的光晕，读起来是"亮着的"而不是"画上去的"。
   首页 chip、`/history` 的"未导出"、恢复条标题都是这个形状。
4. **chip → 标题 → 说明** 是页面开场的固定顺序（首页 hero 定的），
   `/history` 沿用，所以从首页走过去不会觉得进了另一个后台。

**空状态是要做产品判断的地方，不是省略号**：说明为什么是空的、接下来做什么，
并给一个真图标（ranui 内置 52 个，`<r-icon name="book">` 零注册懒加载，
打包成独立 chunk），不是拿排版字符凑。

## 六、颜色一律走 `--ran-*`

不写死任何颜色值。暗色模式因此不需要任何额外工作——token 层自己翻转，
`/history` 的暗色版本是零成本得到的。

## 七、已知的合理例外

- **首页 h1 是 64px**，比其它页大——hero 就该更重，这是有意的层级差。
- **`/embed-demo.html` 是全宽两栏**（340px 控制面板 + 编辑器），侧栏文字行宽 41 字符。
  侧栏不是正文列，短行宽是常态。
- **`/embed-demo.html` 顶栏 72px vs 全站 77px**：它少一个语言切换控件（它只有英文版），
  是内容差异不是样式差异。

## Application icon

The PWA and browser icon uses two offset angular bands around an open center.
The mark is abstract rather than a file illustration, with solid monochrome fills,
broad negative space and restrained rounded corners that match the interface.
SVG sources live in `public/icons/`.
The universal launcher icon resolves the light-theme tokens
`--ran-gray-1000` (#171717) and `--ran-background-100` (#ffffff).
Exported assets use these fixed values because launcher icons do not inherit
page CSS variables. There are no additional accent colors, gradients or shadows.
The same silhouette is used at every size, including the 16 px browser display.

The ordinary icon has a rounded background; the maskable variant has an opaque,
full-bleed background. The entire mark fits within the central 80%-diameter
safe circle, so platform masks can crop the background without clipping the mark.
The 32 px favicon, 180 px touch icon, 192/512 px PWA icons and 512 px maskable icon
are checked in. Regenerate PNG files from the SVG sources with:

```sh
npm install --prefix /tmp/document-icon-tools --no-audit --no-fund @resvg/resvg-js@2.6.2
node bin/build-app-icons.mjs /tmp/document-icon-tools/package.json
```

Keep this functional icon separate from legal attribution and from page headers.

### Light and dark browser presentation

Browser favicons use `document-light.svg` / `document-dark.svg` and their 32 px
PNG fallbacks. Both share the abstract mark geometry. The light variant uses the
foreground token on a transparent canvas; the dark variant uses
`--ran-gray-1000` (#ededed) on the same transparent canvas. Browser tab icons must not inherit the filled PWA installation tile. Regenerate these PNGs with the same command above.

`public/theme-presentation.js` follows the effective `data-ran-theme`, then the
stored choice, then the system preference. It updates the favicon, native
`color-scheme` and browser `theme-color` before page styles paint, and follows
runtime changes. A manual choice takes precedence over an opposite OS theme.
The helper is precached and treated as a deploy-coupled, revalidated asset.

The manifest and Apple touch icons retain the universal monochrome design.
Manifest icon entries have no theme selector; publishing competing light/dark
entries at the same size would not establish a reliable selection rule.
The manifest's white startup background is a fallback; the page's browser color
tracks its effective theme once running. Native launch screens remain subject
to platform behavior. See [manifest icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)
and [theme colors](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/theme_color).

## Application roles and regression enforcement

`public/ran-tokens.css` remains the dependency-owned foundation. `public/app-tokens.css`
adds only product roles missing from that foundation: page actions (42px), compact
controls (the foundation's 32px size), coarse-pointer targets (44px), and destructive
fill/foreground/state pairs. Every authored entry and generated page loads this layer
after the foundation and before its page styles. The service worker precaches it and
revalidates its deploy-coupled URL; shared chat keeps standalone defaults in its own
`--cui-*` roles rather than depending on an application stylesheet.

Page actions, inline commands and physical touch targets have different jobs. Choose
by semantic context; do not resize every action to the largest size. Hover and active
feedback apply only to enabled controls, keyboard focus stays visible, and destructive
commands retain their colour and readable foreground in every state and theme.

`test/unit/site-token-consistency.test.ts` audits all authored application CSS, the
shared chat stylesheet, handwritten HTML styles and freshly generated pages. Roles
resolve against each consumer's own definitions and loaded dependencies; an unknown
role still fails when a fallback is present. The same contract rejects raw semantic
spacing, type sizes and corners. Intentional exceptions are fluid viewport/brand
composition (`clamp()`), breakpoints and fixed page geometry, hairline borders and
optical 1px offsets, accessible offscreen sentinels, and standalone fallbacks inside
validated token references. Static icon artwork and vendor assets are separate owners.
The browser suite verifies real component parts, page families, seven locales, both
themes, narrow widths and coarse-pointer targets. Token audit success alone does not
prove component API or interaction correctness.

Two rules are mechanical because both fail silently in review:

- **Logical properties count as spacing.** The property pattern has to read through
  every hyphen (`padding-inline-start`, not just `padding-inline`); when it stopped at
  the first one, three literal insets were invisible to the contract.
- **A palette property never appears in a `transition`.** CSS cannot tell why a colour
  changed, so `background`, `color`, `border-*-color`, `box-shadow`, `fill` and `stroke`
  in a transition also fade on a theme flip — each surface at its own duration while the
  page snaps. Bare durations (`transition: 0.15s`) mean `all` and fail the same way. The
  documented `var(--…-transition)` hook is the opt-in escape hatch and is not judged.

## Assistant application layout contract

The canonical composition rules are owned by
[ranui DESIGN section 11](https://github.com/chaxus/ran/blob/main/packages/ranui/docs/DESIGN.md#11-composition--the-page-not-the-component).
This section supplies the application's geometry and browser acceptance; the site's marketing
column widths do not apply inside the assistant. `styles/assistant.css` owns the shared values.

| Geometry        | Product contract                                                                                                   | Acceptance subject                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Content rail    | 16px from the panel's inside edge                                                                                  | Header title text, onboarding copy, unframed copy, section labels, field/list outer frames |
| Header title    | Text-sized target with 8px inline padding; leading hit area extends into the gutter                                | DOM Range text left, actual button width, hover/focus area and neighboring actions         |
| Back navigation | Center a 16px SVG viewport in the 32px fine / 44px coarse pointer target; the viewport returns to the content rail | SVG viewport and full target bounds, not painted path bounds                               |
| Subpage heading | An explicit navigation column followed by an 8px gap; shared by every subpage and nested artifact state            | Repeated title rail: 48px fine / 54px coarse, relative to the panel's inside edge          |
| Framed fields   | Outer frame follows the content rail; internal text retains its control inset                                      | Native frame and real ranui shadow parts are separate subjects                             |
| Vertical groups | 8px internal, 16px group and 24px section spacing                                                                  | Actual related-region edges; empty status paragraphs reserve no anonymous margins          |

The title's flexible trailing filler is layout space, not a clickable/hovering title surface.
At panel widths up to 360px, the runtime header gives the readable title its own row above
the five action slots. Coarse input retains 44px targets without constraining the title to
an icon's flex basis. Back focus outlines use zero offset so their full 2px ring remains
inside the scrolling view. Populated result lists keep a 16px boundary before Import.
Back navigation is a declared hierarchy, not an unexplained extra body inset. Centered empty
states remain centered within their content frame. Frame, text, icon viewport and hit area
must not be substituted for each other during review. CSS token compliance alone cannot prove
these relationships. Do not nudge individual pages or SVG paths to compensate for a shared
layout error.

Apply this contract to onboarding/chat, Models, Conversations, Sources and Artifacts, including
list/import/editor, empty/populated states, statuses and disclosures. Layout owners retain
callbacks, focus return, busy guards and drafts. New sibling views must join the same checks.

`test/e2e/agent-layout-rails.spec.ts` and `test/e2e/lib/layout-geometry.ts` read actual text
Ranges and layout frames after fonts and async view content settle. They cover 432px desktop
panels, 360px/320px windows, English/Portuguese, both themes and coarse input, with nested
artifact import/editor/return paths. The existing sidebar test also measures title text rather
than its padded button rectangle. Relevant focus, navigation, workspace and source/artifact
suites remain required alongside the geometry assertions.

Acceptance must reject a text-only 8px drift even when the outer frame stays fixed, a title
target expanded into free toolbar space, and a sibling view shifted off its content rail.
Review screenshots with these measured relationships; a stored screenshot without assertions
or inspection is not acceptance evidence.

### Settings command groups

History & data is already a named section inside the assistant pane. Restore, Import and
Export therefore use flat native button rows: no inner group frame, added group fill,
shadow or row separators. Each row has an 18px decorative icon, a 14px label and a minimum
44px target. Row frames return to the content rail; shared internal padding keeps icons
and labels aligned across routine and destructive commands. Long translations wrap inside
their row rather than changing columns. The save-history checkbox uses the monochrome primary role.

Deletion commands use quiet danger text/icons and a 16px group gap without another divider.
Explicit verbs, aligned icons, repeated full-row targets and hover/press/focus feedback provide
the command affordance. Only explicit confirmation has a solid danger fill. Draft, confirmation,
busy and focus-return behavior remain owned by the existing controls.

Review boundaries in the full pane. The panel/editor edge owns the independent sidebar;
the search/input frames identify editable values; the single History & data section divider
separates task regions; keyboard outlines identify focus. An inner card or more row rules
would repeat those relationships. Models picker frames, Sources search/attachment controls
and Artifacts form fields keep their functional control boundaries. Do not remove every
border globally, add transparent borders to preserve obsolete card insets, or require a
decorative group outline in acceptance.
