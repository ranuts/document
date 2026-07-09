# edit.chaxus.com SEO / GEO 流量经验(哥飞「出海做站」方法论 × 本项目现状)

> 2026-07-09

## 背景

首页太素(JS 用户直接进编辑器、可爬正文只有 `<noscript>`)引出一轮讨论,顺带把
`~/Desktop/survival`(哥飞 68 篇「出海做站」文章提炼的 8 个 skill:demand-mining /
keyword-research / seo-optimization / site-building / adsense-monetization /
overseas-indie / content-ip / product-design)的方法论对齐到本项目,沉淀成可执行经验。

同一生态里的三个属性,受众/意图完全不同,不要混为一谈:

| 属性                                        | 是什么                         | 搜索意图                        | 角色             |
| ------------------------------------------- | ------------------------------ | ------------------------------- | ---------------- |
| **edit.chaxus.com**(本仓库 ranuts/document) | 纯前端 Office 编辑器           | 消费者:"在线编辑 docx / 免上传" | 流量磁铁(量在这) |
| **@ranui/preview**(ranuts/fileview)         | 可嵌入的文件预览 web component | 开发者 / npm                    | 背链引擎         |
| **ran.chaxus.com**(chaxus/ran)              | ranui 组件库 + ranuts 工具     | 开发者                          | 品牌中枢         |

## 核查到的现状(2026-07-09)

- `sitemap.xml` 干净:只列 root + 8 个落地页,无内部 app 页(👍,符合「页面三分法」)。
- 9 个落地页**全部 `lang="en"`**,无 `/zh/` 子目录、无 `hreflang`。
- app UI 的 i18n(`packages/shared/src/i18n.ts`)**实际只有 ZH + EN**(CLAUDE.md 里写的
  「中/英/日/韩/德/法/西/葡/俄 9 语言」已过时,不要据此规划)。
- 首页 `index.html` 有 `WebApplication` + `SoftwareSourceCode` JSON-LD,但**缺 `FAQPage`**;
  可爬正文只有 `<noscript>`(渲染型爬虫看不到)。

## 经验(按杠杆从高到低)

### 1. 【最大杠杆·几乎免费】多语言子目录落地页,从 `/zh/` 起步

- 出处 `seo-optimization` / `keyword-research`:同一词换国家 KD 差极多(timestamp 美 98 /
  法语 28);"博客加多语言后访问量翻 10 倍";**多语言必须子目录 `/zh/` `/ja/`,不要子域名、
  不要 `?lang=`**(谷歌把子域名当独立站,权重从零)。
- 现状:落地页全英文,但 ZH 文案现成。中文搜索格局与英文不同 = 免费开新市场。
- 做法:`/zh/` 下镜像现有落地页,本地化 title/H1/FAQ,`hreflang` 互指、各自 canonical。
  app 加语言后再扩 `/ja/` `/de/`。

### 2. 【战略校准】子域名 = 权重从零 → 别把三站互链当主力流量手段

- 出处 `seo-optimization`:子域名被谷歌当独立站,权重从零。
- `edit.chaxus.com` 与 `ran.chaxus.com` 各自攒权重、互不继承。**三站互链只是品牌/实体信号
  (对 GEO 有用),不是权重来源。** 真权重靠外链。
- 长期若真要合并权重,需收敛到 `chaxus.com/edit`(大改,先记着)。

### 3. 【真正的流量引擎】外链启动 + 一次"造势"

- 出处 `seo-optimization` / `overseas-indie`:外链=PageRank 核心、新站最有效;收录≠排名;
  高权重站(掘金/V2EX/知乎、HN/Reddit)留链最快 1 小时收录;"真诚写一篇发 30 渠道"。
- 独特弹药:"隐私优先·零上传·纯浏览器 WASM·开源 Office" 是真正 HN/Reddit/ProductHunt
  级选题(工具站难得能造势)。开发者向 `@ranui/preview` + 开源仓库天然挣**编辑性外链**,可同时指回 edit。
- 动作:提交 GSC + sitemap;中文(掘金/V2EX/知乎)+ 英文(HN/Reddit/IndieHackers/PH)各发一篇;
  各仓库 README 显著挂 live 站链接。

### 4. 【选词纪律】长尾 transactional,避开三陷阱,一定去 SERP 验

- 出处 `keyword-research`:Google 直达 / 季节词 / 来源不明超低 KD 三陷阱;找到词**必去谷歌实搜验证**;
  KD<29 小词起步,"保小图大";看 CPC/kdroi 选离钱近的词。
- 现状:`/convert/*` `/open/*` `/offline` `/no-signup` `/vs` 正是对的长尾方向。大词
  "edit docx online" 被 Google Docs/微软/Smallpdf 占满(先放)。继续扩长尾:
  `open pptx without powerpoint`、`xlsx to csv online`、`docx editor chromebook offline`……
  每个先 `suggest` + 真 SERP 验。

### 5. 【行为数据杠杆】人均访问页数 + 门槛假说

- 出处 `seo-optimization`(2026 大会实证):谷歌看跳出率↓/停留↑/**人均页数↑(最易忽略)**;
  每词进首页有约 1000 条优秀交互门槛,买精准流量可加速跨过。
- 现状:单页编辑器人均页数天然低。用落地页互链(convert 之间、open 之间、生态条)抬人均页数;
  上线初期用一次社区/PH 曝光买精准流量帮跨门槛。

### 6. 【爬虫卫生】页面三分法

- 出处 `seo-optimization`:排名页 / 索引页 / noindex 页;雷同薄页 noindex 免拖权重。
- 现状:sitemap 已干净。补:确保 OnlyOffice `web-apps/*` 内部 HTML、`coverage/`、`redirect/`
  不被索引;未来批量生成 `/convert/*` 组合页别产出雷同薄页。

### 7. 【结构化数据补全】首页 `FAQPage` + 全站 `sameAs`/`isPartOf`

- 出处 `seo-optimization`:主动给 JSON-LD 拿富结果。
- 落地:首页补 `FAQPage`(子页已有);全站加 `sameAs` 串起 GitHub / npm / `ran.chaxus.com` /
  edit → 强化品牌实体(GEO)。

## 落地设计(本轮附带产出)

- 视觉方向:"local boundary"——hero 装进"你的设备"控制台面板(蓝图网格 + 发光蓝周界 +
  等宽角标 `▚ your device — nothing leaves this boundary`),把"文件不外传"画出来。
- 两页共用一套 token/字体/布局:document(编辑器)+ @ranui/preview(可嵌入预览,`?embed=1`
  收起 hero 只留 `<r-preview>` 供 iframe)。
- GitHub 开源标识 + 意图区分交叉链(edit ↔ preview)+ "ran 生态"页脚条(品牌实体信号)。

## 动手顺序

1. 落地设计写进 document 首页(hero 无参时显示、打开文档隐藏)+ 首页 `FAQPage`。
2. `/zh/` 中文镜像落地页 + `hreflang`(第 1 条大杠杆)。
3. `web-apps/*` 等 noindex 卫生 + 全站 `sameAs`。
4. 扩长尾落地页(每个先 SERP 验)+ 写一篇多渠道介绍稿。

## 本轮已落地(2026-07-09)

- **document 首页 hero**:`public/home.css`(样式全 scoped 到 `#landing-hero`)+ `index.html`
  内注入可爬 hero(H1 / 状态行 / 文档窗口 mock / 01-02-03 步骤 / 特性四宫格 / FAQ / GitHub
  开源标识 / 生态条)+ `index.ts` 接线(无 `?file/?src`、非 embed 时显示,打开文档即隐藏,
  CTA 复用 `onOpenDocument`/`onCreateNew`)+ `styles/base.css` 三条守卫(embed 隐藏 hero、
  landing 时隐藏遗留 `#control-panel-container`、landing 时允许滚动)。
- **首页结构化数据**:补 `FAQPage`;`WebApplication` 加 `sameAs`(github/npm @ranui/preview/
  ran.chaxus.com)+ `isPartOf` 品牌。19 个 JSON-LD 块全部合法。
- **`/zh/` 中文镜像**:8 个落地页(`public/zh/**`,`lang="zh-CN"`,本地化 TDK/H/FAQ/JSON-LD/
  面包屑)+ 8 个英文原页回填双向 `hreflang`(en / zh-Hans / x-default)+ `sitemap.xml` 增 8 条。
- **fileview `@ranui/preview` 落地页**(仓库 ranuts/fileview):`index.html` 重写为同套设计 +
  真实 `<r-preview>` demo + `?embed`/iframe 收起为全视口裸预览(`?embed=1&src=` 直载)。
  ⚠️ canonical 暂用占位 `https://fileview.chaxus.com/`,上线前按最终域名替换。
  ⚠️ 该仓库另有与本任务无关的既存未提交改动(package.json / pnpm-lock / vite.config /
  components/preview 等),未触碰,留待自行处置。
- **验证**:document `pnpm run lint:ts`(oxlint + tsc)EXIT=0、`format:check` 全绿;三处
  JSON-LD/hreflang/sitemap 静态校验通过。视觉未截图(MCP 浏览器 profile 被旧会话锁死),
  可 `pnpm dev` 自行核对,设计与已批准稿一致。
- **未做(下一步)**:第 3 条 `web-apps/*` noindex 卫生;第 4 条长尾扩页 + 多渠道介绍稿;
  `/zh/` 首页(SPA,单独处理)。

## code review + ranui 设计体系重建(2026-07-10)

对两仓库做了 review,并按结果修复;随后把 document hero 重建在 **ranui 设计体系**上。

- **两处真 bug(review 漏、截图才发现)**:
  - document hero 出现"巨型黑字坨" —— `.ghost` **类名撞名**:水印选择器 `.console .ghost`
    误命中 `.btn.ghost` 按钮,把按钮放大成 340px 绝对定位黑字。→ 水印类改名 `hero-wm`。
  - 四个悬浮的遗留控制面板按钮 —— 实为 **Service Worker 缓存旧构建**;当前代码
    `showLanding()` 会设 `landing-active`、CSS `!important` 隐藏 `#control-panel-container`
    (运行时 `evaluate` 确认 `display:none`)。硬刷新/清 SW 即恢复。
  - 教训:**纯静态 review 会漏视觉/CSS 碰撞,必须真渲染截图**。
- **review 其它修复**:document(noscript 砍到单 H1、标题层级 h1→h2→h3、landing 切换收进
  `lib/ui.ts` 统一、`--muted` 提对比度、删死 CSS `.star`、octocat 改 `<symbol>`+`<use>`);
  fileview(embed 不再盖 `.r-preview-mask`→空白盒修复、`?src=` 改 `whenDefined` 门控、
  `isSafeSrc` 限 http/https/blob、twitter card 降 summary、标题层级、文案改"全屏预览"、
  删无效 Permissions-Policy meta、noscript 兜底、focus-visible)。
- **ranui 设计体系接入(核心)**:`ranui/dist/ranui.css` 是完整 token 层(Geist 字体、
  `--ran-blue-700 #006bff` 主色、gray/blue/green 色阶、`--ran-color-*` 语义色、radius/space/
  shadow/z、**内置暗色**)。做法:
  - vendored 到 `public/ran-tokens.css`(`bin/build.sh` 每次构建自动 `cp` 同步防漂移;
    加进 `.prettierignore`),`index.html` 在 `home.css` 前静态 `<link>`(首屏 token 即可用、爬虫可见)。
  - `home.css` 把自造 `--paper/--ink/--accent/--signal/...` **改为映射到 `--ran-*`**,
    **删掉手写的暗色/`[data-theme]` 覆盖块** → 暗色由 ranui 免费提供。
  - **可复用配方**:任意页面 `<link>`/`import 'ranui/dist/ranui.css'` → 只用 `--ran-*` token +
    `r-*` 组件搭。下一步可同法套到 `/zh/` 与 fileview,全生态一套视觉。
- **验证**:`lint:ts` EXIT=0、`format:check` 全绿;**真机截图核对**(localhost dev):浅/深色
  均正常、无黑字坨、无悬浮按钮、单 H1、无横向滚动、蓝色=ranui `#006bff`、暗色纯黑底自动生效。

## 参考

- 方法论来源:`~/Desktop/survival`(chaxus/survival,哥飞「出海做站」skill 市场)。
- 上一轮 SEO 上线:[2026-07-05-seo-geo-launch.md](2026-07-05-seo-geo-launch.md)。
