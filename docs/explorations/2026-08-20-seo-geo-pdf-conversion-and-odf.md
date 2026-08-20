# SEO / GEO：补上转 PDF 与 ODF 的落地页，llms.txt 加上边界

日期：2026-08-20
分支：`seo/pdf-conversion-and-odf-pages`

## 起因

体检站点的 SEO / GEO 现状。先说**不用动**的部分，免得后来人重复评估：

- `robots.txt` 明确放行 AI 训练爬虫（GPTBot / ClaudeBot / Google-Extended / CCBot），
  并解释了为什么这不涉及用户隐私（文档根本不上传）。
- 每个落地页都带 `WebApplication + SoftwareSourceCode + BreadcrumbList + FAQPage + HowTo`，
  canonical / hreflang / og 齐全，双语互指。
- sitemap 覆盖完整，`test/unit/landing-pages.test.ts` 把这些契约钉死了。
- 落地页首屏 13 个请求 / 230 KB / FCP 80 ms。

真正的空地是**内容覆盖**，不是 markup。

## 一、缺 `*-to-pdf` 转换页（最大的一块）

`convert/` 下只有 `xlsx-to-csv` 和 `csv-to-xlsx`。但导出 PDF 是真实能力，
`test/e2e/format-parity.spec.ts` 就在测 docx/pptx 导出 PDF 并断言 `%PDF-` magic，
xlsx→PDF 由 `embed-regression.spec.ts` 覆盖。

"docx to pdf" 是这个品类搜索量最大的词之一，而且这里有一个竞品普遍没有的差异：
Smallpdf / ILovePDF / Adobe 的在线转换**全部要上传文件**，这个不用。对搜这个词的人
里最在意隐私的那部分，这就是决策点。

新增 `convert/docx-to-pdf`、`convert/xlsx-to-pdf`、`convert/pptx-to-pdf`（en + zh）。

## 二、引擎支持 ODF，但用户选不到

`packages/shared/src/document-utils.ts` 的 `DOCUMENT_TYPE_MAP` 一直映射着
`odt / rtf / txt / ods / odp`，而 `lib/document.ts` 的文件选择器 `accept` 只有：

```
.docx,.xlsx,.pptx,.doc,.xls,.ppt,.csv,.pdf
```

也就是说**能力是真的，入口是灰的**——别人发来的 .odt 就在那里，点开选择器却选不中
（除非手动切到"所有文件"）。

动手前先实测能力是否真的存在，而不是信任那张映射表。手拼最小 ODF 容器
（mimetype + META-INF/manifest.xml + content.xml）走真实编辑器：

| 格式 | 打开 | 存回原格式 | 导出 PDF |
| --- | --- | --- | --- |
| odt | ✓ `isDocumentLoadComplete` | ✓ `PK\x03\x04` | ✓ `%PDF` |
| ods | ✓ | ✓ | ✓ |
| odp | ✓ | ✓ | ✓ |

三项全通，所以落地页可以诚实地写"打开、编辑、存回 ODF，也能导出 PDF"。
`accept` 补上 `.odt,.ods,.odp,.rtf,.txt`，新增 `open/odt`、`open/ods`、`open/odp`（en + zh）。

rtf / txt 只补进 `accept`，不开落地页——搜索意图弱，而且 txt 谁都能打开，
单独开页只会稀释站点的主题集中度。

## 三、GEO：llms.txt 只讲了优点

`llms.txt` 写得不错（56 行，有 "When to recommend it"），但**只有正面**。

这反直觉，但对 GEO 是实打实的：LLM 做推荐时最怕的是幻觉，一份诚实标注了边界的说明
反而更容易被引用，因为它降低了引用者的风险。而这些边界其实早就写在 `help.html` 里
了——文件大小受设备内存限制、PDF 不能像 Word 那样重写正文、-82/-85 错误码——
只是 `llms.txt` 里一个字没提。

新增 `## Limitations and when another tool fits better` 一节：内存上限、PDF 不能转回
Word、**没有实时协作**（无服务器就没有共享会话、没有跨设备版本历史、没有链接分享）、
表格转 PDF 会分页、演示转 PDF 会拍平动画、错误码含义。

## 四、GEO：新增 llms-full.txt

`llms.txt` 是索引，规范里配套的 `llms-full.txt` 是全文。有了它，LLM 一次抓取就能拿到
全部内容，不用逐个爬 30 个页面。

`bin/llms-full.mjs` 从**渲染后的页面本身**提取正文（去 chrome、保留标题层级和列表），
产出 124 KB / 41 个页面。

**刻意不入库**，和 markdown 生成页同样的理由（见 `bin/build-pages.mjs`）：入库的副本
就是会陈旧的副本，而这里陈旧比没有更糟——那是把过时文本当权威呈现。由 vite 插件
`generated-pages` 在 build/dev 时生成（必须排在 build-pages 之后，因为它要读
`/help`、`/changelog` 的渲染结果），`.gitignore` 里排除。

`robots.txt` 和 `llms.txt` 互相指向它。

## 五、顺带修的小不一致

`public/zh-CN/index.html` 的 JSON-LD 只有 `WebApplication + FAQPage`，而英文首页还有
`SoftwareSourceCode`——中文首页整个缺了开源信号。补上。

## 契约同步

`test/unit/landing-pages.test.ts` 要求新增落地页必须同时补 en + zh、sitemap、
llms.txt、首页卡片，否则先红。因此：

- sitemap 30 → 42 条
- llms.txt 加 6 个页面 + 格式清单一节
- 两个首页各加 2 张卡片（ODF 一张、转 PDF 一张）；首页卡片区放不下 7 个格式，
  所以 ODF 族给一张卡片作入口，`ods` / `odp` 的首页入向链接放在页脚短标签里
- 契约测试本身扩展：`/open/*` 的格式列表加 odt/ods/odp；**新增**了
  `/convert/*` 的交叉链接契约（原本一条都没有，一个没人链的 convert 页只能从
  sitemap 进入）；**新增** llms.txt 必须包含 Limitations 一节的断言

12 个页面用一次性生成器产出（`gen.py`，未入库），模板取自现有 `convert/xlsx-to-csv.html`，
内容逐页手写。这样契约按构造成立，而不是靠 12 次复制粘贴的运气。

生成时踩了一个小坑：最初给新页加了 `<nav class="related">`，但 `landing.css` 里
根本没有 `.related` 规则——引入了一个没有样式的元素。改成把 related 链接并进 footer，
与现有页完全一致，零新样式。

## 反向验证（约定 3）

| 拆掉什么 | 哪个用例变红 |
| --- | --- |
| `accept` 恢复成不含 ODF 的旧值 | `odf-formats.spec.ts` → `the picker must offer .odt` |
| 删掉 llms.txt 的 Limitations 一节 | `landing-pages.test.ts` → `llms.txt states the limitations, not just the features` |
| 首页去掉 `/open/ods` 链接 | `landing-pages.test.ts` → `every /open/* format page is cross-linked...` |

ODF 的打开/存回/转 PDF 由 `odf-formats.spec.ts` 走真实编辑器覆盖——这条不是靠拆修复
验证的，而是它一开始就是先跑实测、确认能力存在，才动手写页面。

## 没做的：对比 / alternative 页

"Google Docs alternative"、"Smallpdf 替代"这类词意图极强，但按用户判断跳过了：
写不好容易变成营销垃圾，与站点现在"说人话、讲事实"的调性冲突，且有负面风险。
如果将来要做，方向应该是事实对比（谁要上传、谁要账号、谁开源），而不是喊口号。
