# markdown→HTML 生成器 + /help + /changelog（2026-08-16）

路线图第 6、7 项（方向七 1/2/3）。同时按方向八的要求把生成器设计成
"任意 locale × 任意页"，多语言落地页以后可直接搭车。

## 生成器 `bin/build-pages.mjs`

- 输入：`PAGES` 清单 `{ slug, sources: { <locale>: <md 文件> }, meta?,
stripFirstHeading? }`；`LOCALES` 表（en → `/`，zh-CN → `/zh-CN/`，含
  `dir` 为 RTL 预留）。source 可以是仓库任何 markdown（`content/`、
  `docs/`、`CHANGELOG.md`），frontmatter 只支持标量 `key: value`，
  `meta[locale]` 可覆盖/补齐（docs/embed-api.md 这类没有 frontmatter 的
  文件靠它给 title/description）。
- 渲染：`marked`（16.4.2，已在依赖树里——ranui→mermaid——本次显式加为
  devDependency）+ 自定义 heading（生成 id，收集 h2 做目录）与 link
  （外链 rel=noopener）。h3 以 ?/？ 结尾且紧跟段落 → 自动抽成 FAQPage
  JSON-LD；≥3 个 h2 → 页顶目录。
- 外壳与手写落地页逐项一致：TDK、canonical、hreflang 全集（按该 slug 有
  哪些 locale 自动生成）、OG/Twitter、JSON-LD（WebPage + SoftwareSourceCode
  - FAQPage + BreadcrumbList）、no-flash 主题脚本、同一份 landing.css、
    ranui IIFE（button/card/select/theme-switch）、语言 `<r-select data-href>`
    互指、同一组页脚互链、`r-theme-switch`。
- 输出确定性。**第一版曾把产物提交入库**并用 `--check` 钉漂移，但同日
  就撞上问题：main 关掉 strict up-to-date 后，几个并发合并、各自带着
  自己那份 `public/changelog.html` 的 PR 会让主干上的产物只反映最后合入
  的那份 CHANGELOG。当天改为**构建期生成、产物不入库**（peer 建议）：
  `vite.config.ts` 的 `generated-pages` 插件在 `buildStart`（含 E2E 用的裸
  `vite build --outDir dist-e2e-<port>`）与 dev server 启动时调 `generate()`
  写进 public/（已 gitignore），dev 下监听源 markdown 改动即重渲染 +
  full-reload；`bin/build.sh` 不再单独跑。`generated-pages.test.ts` 改为
  "真实 markdown 源 → 形状正确的页面"，`landing-pages.test.ts` 把生成页从
  内存渲染并入同一契约（canonical/hreflang/JSON-LD/sitemap/双语互指）。
- landing.css 追加 `.doc` 段：h3/h4、code/pre、table、blockquote、toc、
  notice、source，全部 token；`landing-pages.test.ts` 遍历 public/ 时自动
  覆盖新页（JSON-LD 主节点断言放宽为 WebApplication | WebPage | Article）。

## 页面

| 路由                     | 来源                                              |
| ------------------------ | ------------------------------------------------- |
| /help, /zh-CN/help       | content/{en,zh-CN}/help.md（新写）                |
| /help/embed-api（en/zh） | docs/embed-api.md / docs/embed-api.zh.md          |
| /changelog（en/zh）      | CHANGELOG.md（单一数据源；zh 页带"英文维护"提示） |

帮助内容按路线图方向七 2 的清单写：打开/新建、保存与转换、CSV 中文
乱码、PDF 能做什么/不能做什么、只读与嵌入、离线与 PWA、隐私边界（页面
到底会从网络拉什么）、错误码（-85/-82/-24/80）、反馈、自托管。每条都
对照代码核过（`?readonly=1` 解析、CSV 导出带 BOM、`?new=`、accept 列表、
Docker 命令）。

同步：sitemap 6 条、llms.txt 3 行、全部手写落地页页脚 + 双首页页脚加
Help / Changelog（首页页脚顺手补了 Embed API / Privacy 内链——方向一 4
的欠账）。

## 未做

- CHANGELOG 中文版（保持单一数据源；要做的话是 `CHANGELOG.zh-CN.md` +
  PAGES 换 source，一行改动）。
- docs/fonts.md 未发布（开发者向），需要时加一条 PAGES。
- 生成器暂无 E2E；靠 landing-pages + generated-pages 两个单测 + pages 层
  E2E 的托管语义兜底。
