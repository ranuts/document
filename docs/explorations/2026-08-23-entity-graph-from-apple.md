# 照着 apple.com 抄结构化数据：把 154 个页面收拢成一个实体

日期：2026-08-23
方法：抓 `www.apple.com/`、`/iphone/`、`/shop/buy-mac/macbook-air`、
`/macbook-air/specs/`、`/iphone/compare/` 的原始 HTML，以及 robots.txt 与 sitemap，
逐项比对本站生成器的输出。

## 苹果做对的、且能搬过来的

### 1. 稳定 `@id` + 互相引用（最值钱的一条）

苹果不在每页重新定义"苹果公司"。它定义一次：

```json
{ "@id": "https://www.apple.com/#organization", "@type": "Organization", "name": "Apple", ... }
```

之后所有页面只写引用：`"manufacturer": { "@id": "https://www.apple.com/#organization" }`。
`#website`、`#webpage`、`/mac/#brand` 同理。MacBook Air 规格页的 `Product` 节点
里，manufacturer 和 brand 都只是两个 `@id`。

本站原本反过来：每个页面各发一份匿名的 `WebApplication` 和 `SoftwareSourceCode`。
**154 个页面 = 154 个碰巧同名的应用**。对排名影响有限，对回答问题的机器影响很大——
读了三个页面的助手应该得出"一个编辑器"，而不是三个。

改成：

| 节点                                   | `@id`                                       | 出现在       |
| -------------------------------------- | ------------------------------------------- | ------------ |
| `Organization`                         | `/#organization`                            | 每页         |
| `WebSite`                              | `/#website`                                 | 每页         |
| `WebApplication`                       | `/#app`                                     | 每页         |
| `SoftwareSourceCode`                   | `/#source`                                  | 每页         |
| `WebPage`                              | `<页面 url>#webpage`                        | 每页（本页） |
| `FAQPage` / `HowTo` / `BreadcrumbList` | `<页面 url>#faq` / `#howto` / `#breadcrumb` | 有则有       |

`WebApplication` 的 `url` 恒为站点根，**不再是当前页面的 URL**——否则七种语言看起来
就是七个不同的产品。语言这件事挪到了它该在的地方：`WebPage.inLanguage` 说这一页是
什么语言，`WebSite.inLanguage` / `WebApplication.inLanguage` 是七种语言的数组，
本身也是一条对 LLM 有用的事实（"这个编辑器有七种语言"）。

落地页仍然发完整的 app 节点（价格、类别、平台，Google 的 rich result 要这些），
**文档页只发一个 stub**（`@type` + `@id` + `name` + `url`）。理由是两头都要顾：
`/help` 不该因为带了价格而去竞争应用类富媒体结果，但 `about: { "@id": ... }`
指向一个图里不存在的 id 会被消费方直接丢掉，那样这一页又退回"描述一个匿名应用"。

### 2. `max-image-preview:large`

苹果每页都发 `<meta name="robots" content="max-image-preview:large">`。本站原本只有
`index, follow`。补成
`index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`——
后两个不是苹果的做法，但它们放开的正是 AI 摘要与搜索摘要能引用的长度上限。

### 3. `sameAs` 指向可核对的身份

苹果的 Organization 指向 **Wikidata**（`Q312`）+ 各社交账号。这是把站点绑到知识图谱
实体上的做法。本站没有 Wikidata 条目，用能核对的那几个：GitHub 组织、仓库、生态站点。
`sameAs` 从 app 节点挪到 Organization（那是组织的身份），app 自己留仓库这一条。

## 苹果做了但**不该**抄的

- **没有 `x-default`**。137 条 hreflang，一条 x-default 都没有。本站有，保持。
- **sitemap 只有 `<loc>`**，没有 lastmod/priority。本站按 git 提交日期发 lastmod，更好。
- **规格页几乎不带正文 HTML**。`/macbook-air/specs/` 324 KB，`<h1>` 之后直到页脚
  再没有正文标题——规格全靠 JS 渲染。对爬虫和 LLM 都是净损失，苹果的品牌撑得住，我们不行。
- **没有 llms.txt**（404）。本站有 `/llms.txt` + `/llms-full.txt`。

## 考虑过但决定不改的

- **`hreflang="pt"` 改成 `pt-BR`**。本站的葡语内容确实是巴西葡语（og 已经是 `pt_BR`），
  按苹果的做法应该声明 `pt-BR`。但苹果有 pt 和 br 两套站，我们只有一套：声明 `pt-BR`
  会让葡萄牙读者落回 x-default 的英文。只有一个变体时，覆盖面胜过精确度，保持 `pt`。

## 还没做的：`/specs/` 与 `/compare/` 这两种页型

苹果给**每个**产品配一张规格页和一张对比页（sitemap 里 `/airpods-4/compare/`、
`/airpods-4/specs/` 逐个都在）。这两种页型吃的正是高意图长尾词，也正是 LLM 最容易
整段引用的密集事实。

本站有 `/open/<格式>` 与 `/convert/<格式对>`，**没有**：

- 一张"支持什么、限制是什么"的规格页：格式清单、大小上限、浏览器要求、
  哪些功能只在 Chromium 上（写回原文件、剪贴板）、离线可用范围。
- 任何对比页型：`docx vs pdf` 这类格式对比，或"和需要上传的在线编辑器相比"。

这是一次内容项目（× 7 种语言），需要先定内容，没有在这次改动里做。

## 用例与反向验证

`test/unit/landing-pages.test.ts` 三条新契约，逐页跑（154 页 × 3）：

1. 本页的 `WebPage` 节点 url/@id 必须是本页；
2. 出现的 `WebApplication` 必须是共享实体（`@id` = `/#app`，`url` = 站点根）；
3. **图里每一个 `@id` 引用都必须能解析到图里的定义**，且没有重复 `@id`。

第 3 条当场就抓到一个真的悬空引用：文档页的 `WebPage.about` 与
`SoftwareSourceCode.about` 指向 `/#app`，而那些页面根本没定义它——`appStub()`
就是为此加的。

反向验证：`git stash` 掉 `bin/build-pages.mjs`，441 条断言变红。
